/**
 * CROWDWISE Predictive Crowd Digital Twin & Safety Lab
 * Three-Zone Micro-Ingress Monitor & Directional Counterflow Tracker
 *
 * Implements:
 * 1. Independent 3-Zone Spatial Monitoring (Gate Approach, Holding, Upstream)
 * 2. Strictly non-overlapping calibrated observation regions (zero double-counting)
 * 3. Bidirectional crossing line counting at y = 300 (Inbound vs Outbound)
 * 4. Empirical capacity reduction calculation & operational safety recommendations
 */

import { AgentData } from '../../types/simulation';
import {
  CounterflowTelemetry,
  ThreeZoneTelemetry,
  ZoneId,
  ZoneMetrics
} from '../types/ScenarioTypes';

export interface ZoneDefinition {
  readonly id: ZoneId;
  readonly name: string;
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
  readonly areaM2: number;
}

export class ThreeZoneMonitor {
  public static readonly PPM = 20; // 20 pixels = 1 meter

  // Calibrated, mutually exclusive observation regions
  public static readonly ZONES: readonly ZoneDefinition[] = [
    {
      id: 'zone_gate',
      name: 'Zone 1 — Gate Approach',
      minX: 180,
      maxX: 860,
      minY: 60,
      maxY: 180,
      areaM2: ((860 - 180) / 20) * ((180 - 60) / 20) // 34m x 6m = 204 m²
    },
    {
      id: 'zone_holding',
      name: 'Zone 2 — Intermediate Holding Area',
      minX: 140,
      maxX: 880,
      minY: 180,
      maxY: 360,
      areaM2: ((880 - 140) / 20) * ((360 - 180) / 20) // 37m x 9m = 333 m²
    },
    {
      id: 'zone_upstream',
      name: 'Zone 3 — Upstream Arrival Area',
      minX: 80,
      maxX: 880,
      minY: 360,
      maxY: 540,
      areaM2: ((880 - 80) / 20) * ((540 - 360) / 20) // 40m x 9m = 360 m²
    }
  ];

  // Peak density trackers across life of simulation run
  private peakGateDensity = 0;
  private peakHoldingDensity = 0;
  private peakUpstreamDensity = 0;

  // Time-integrated congestion exposure: Integral of max(0, rho - 4.5) * dt
  private cumulativeTimeIntegratedExposure = 0;

  // Counterflow Crossing Tracker (midline at y = 300)
  private measurementLineY = 300;
  private agentPreviousY: Map<number, number> = new Map();
  private inboundCrossingTimestampsSec: number[] = [];
  private outboundCrossingTimestampsSec: number[] = [];
  private inboundSpeeds: number[] = [];
  private outboundSpeeds: number[] = [];

  // Baseline pure-inflow throughput benchmark (calibrated under 0% counterflow)
  private baselineThroughputPerMin = 240;

  /**
   * Evaluates all three zones against live agents on the canvas.
   *
   * @param agents Active microscopic agents
   * @param dt Physical simulation time elapsed
   * @param currentSimTimeSec Total simulation time elapsed
   * @param observedGateThroughput Live turnstile throughput per min
   */
  public update(
    agents: readonly AgentData[],
    dt: number,
    currentSimTimeSec: number,
    observedGateThroughput: number = 0
  ): ThreeZoneTelemetry {
    // 1. Group agents into mutually exclusive zones
    const gateAgents: AgentData[] = [];
    const holdingAgents: AgentData[] = [];
    const upstreamAgents: AgentData[] = [];

    const len = agents.length;
    for (let i = 0; i < len; i++) {
      const a = agents[i];
      if (a.active === false) continue;

      if (a.y >= 60 && a.y < 180 && a.x >= 180 && a.x <= 860) {
        gateAgents.push(a);
      } else if (a.y >= 180 && a.y < 360 && a.x >= 140 && a.x <= 880) {
        holdingAgents.push(a);
      } else if (a.y >= 360 && a.y < 540 && a.x >= 80 && a.x <= 880) {
        upstreamAgents.push(a);
      }

      // Check line crossing for counterflow
      this.checkLineCrossing(a, currentSimTimeSec);
    }

    // 2. Compute metrics for each zone independently
    const gateMetrics = this.computeZoneMetrics(
      ThreeZoneMonitor.ZONES[0],
      gateAgents,
      this.peakGateDensity,
      observedGateThroughput
    );
    this.peakGateDensity = gateMetrics.peakDensity;

    const holdingMetrics = this.computeZoneMetrics(
      ThreeZoneMonitor.ZONES[1],
      holdingAgents,
      this.peakHoldingDensity,
      gateMetrics.observedThroughputPerMin
    );
    this.peakHoldingDensity = holdingMetrics.peakDensity;

    const upstreamMetrics = this.computeZoneMetrics(
      ThreeZoneMonitor.ZONES[2],
      upstreamAgents,
      this.peakUpstreamDensity,
      0
    );
    this.peakUpstreamDensity = upstreamMetrics.peakDensity;

    // 3. System Maximum Density & Integrated Exposure
    const systemMaxDensity = Math.max(
      gateMetrics.currentDensity,
      holdingMetrics.currentDensity,
      upstreamMetrics.currentDensity
    );

    if (systemMaxDensity > 4.5 && dt > 0) {
      this.cumulativeTimeIntegratedExposure += (systemMaxDensity - 4.5) * dt;
    }

    // 4. Prune rolling crossing timestamps older than 60s
    this.pruneOldCrossings(currentSimTimeSec);

    return {
      gateApproach: gateMetrics,
      intermediateHolding: holdingMetrics,
      upstreamArrival: upstreamMetrics,
      systemMaxDensity: Math.round(systemMaxDensity * 10) / 10,
      timeIntegratedExposure: Math.round(this.cumulativeTimeIntegratedExposure * 10) / 10,
      timestampSec: currentSimTimeSec
    };
  }

  /**
   * Computes individual zone metrics from agents currently inside zone bounding box.
   */
  private computeZoneMetrics(
    zone: ZoneDefinition,
    zoneAgents: readonly AgentData[],
    historicalPeak: number,
    throughputPerMin: number
  ): ZoneMetrics {
    const count = zoneAgents.length;
    const currentDensity = count / zone.areaM2;
    const peakDensity = Math.max(historicalPeak, currentDensity);

    let totalSpeed = 0;
    let waitingCount = 0;
    let totalWaitingTime = 0;
    let maxDistFromBarrier = 0;

    for (let i = 0; i < count; i++) {
      const a = zoneAgents[i];
      const speedMps = Math.hypot(a.vx, a.vy) / ThreeZoneMonitor.PPM;
      totalSpeed += speedMps;

      if (a.stuckTime > 0.5) {
        waitingCount++;
        totalWaitingTime += a.stuckTime;
        // Longitudinal distance from zone front barrier (minY)
        const distMeters = (a.y - zone.minY) / ThreeZoneMonitor.PPM;
        if (distMeters > maxDistFromBarrier) {
          maxDistFromBarrier = distMeters;
        }
      }
    }

    const avgSpeed = count > 0 ? totalSpeed / count : 1.3;
    const avgWait = count > 0 ? totalWaitingTime / count : 0;

    return {
      zoneId: zone.id,
      name: zone.name,
      currentDensity: Math.round(currentDensity * 100) / 100,
      peakDensity: Math.round(peakDensity * 100) / 100,
      averageSpeedMps: Math.round(avgSpeed * 100) / 100,
      agentCount: count,
      waitingAgentsCount: waitingCount,
      averageWaitingTimeSec: Math.round(avgWait * 10) / 10,
      queueLengthMeters: Math.round(maxDistFromBarrier * 10) / 10,
      observedThroughputPerMin: throughputPerMin,
      spillbackMeters: Math.round(maxDistFromBarrier * 10) / 10,
      areaM2: Math.round(zone.areaM2),
      warningTriggered: currentDensity >= 4.5
    };
  }

  /**
   * Tracks line crossings at y = measurementLineY (300px) for bidirectional throughput.
   * Inbound: y crosses downwards to upwards (previousY > line && currentY <= line)
   * Outbound: y crosses upwards to downwards (previousY < line && currentY >= line)
   */
  private checkLineCrossing(agent: AgentData, currentSimTimeSec: number): void {
    const prevY = this.agentPreviousY.get(agent.id);
    const currY = agent.y;
    this.agentPreviousY.set(agent.id, currY);

    if (prevY === undefined) return;

    const line = this.measurementLineY;
    const speedMps = Math.hypot(agent.vx, agent.vy) / ThreeZoneMonitor.PPM;

    // Inbound: moving towards Gate (approaching y = 60, so moving -Y direction)
    if (prevY > line && currY <= line) {
      this.inboundCrossingTimestampsSec.push(currentSimTimeSec);
      this.inboundSpeeds.push(speedMps);
    }
    // Outbound: moving towards Concourse Exit (approaching y = 540, so moving +Y direction)
    else if (prevY < line && currY >= line) {
      this.outboundCrossingTimestampsSec.push(currentSimTimeSec);
      this.outboundSpeeds.push(speedMps);
    }
  }

  private pruneOldCrossings(currentSimTimeSec: number): void {
    const cutoff = currentSimTimeSec - 60;
    while (this.inboundCrossingTimestampsSec.length > 0 && this.inboundCrossingTimestampsSec[0] < cutoff) {
      this.inboundCrossingTimestampsSec.shift();
      this.inboundSpeeds.shift();
    }
    while (this.outboundCrossingTimestampsSec.length > 0 && this.outboundCrossingTimestampsSec[0] < cutoff) {
      this.outboundCrossingTimestampsSec.shift();
      this.outboundSpeeds.shift();
    }
  }

  /**
   * Computes directional counterflow telemetry and capacity reduction percentage.
   */
  public getCounterflowTelemetry(opposingFlowPercent: number): CounterflowTelemetry {
    const inboundThroughput = this.inboundCrossingTimestampsSec.length;
    const outboundThroughput = this.outboundCrossingTimestampsSec.length;
    const totalCrossingCount = inboundThroughput + outboundThroughput;

    const avgInboundSpeed = this.inboundSpeeds.length > 0
      ? this.inboundSpeeds.reduce((a, b) => a + b, 0) / this.inboundSpeeds.length
      : 1.3;

    const avgOutboundSpeed = this.outboundSpeeds.length > 0
      ? this.outboundSpeeds.reduce((a, b) => a + b, 0) / this.outboundSpeeds.length
      : 1.3;

    // Capacity reduction formula: ((baseline - observedInbound) / baseline) * 100%
    const baseline = this.baselineThroughputPerMin > 0 ? this.baselineThroughputPerMin : 240;
    let reductionPct = 0;
    if (opposingFlowPercent > 0 && inboundThroughput > 0) {
      reductionPct = Math.max(0, Math.min(100, Math.round(((baseline - inboundThroughput) / baseline) * 100)));
    } else if (opposingFlowPercent > 0 && inboundThroughput === 0) {
      // If severe deadlock occurred and zero crossings registered
      reductionPct = opposingFlowPercent * 1.5;
    }

    // Recommendation logic
    let recommendation = 'Normal unidirectional laminar flow.';
    if (opposingFlowPercent >= 25 || reductionPct >= 25) {
      recommendation = 'Deploy central lane divider / directional stanchions immediately to eliminate head-on shear.';
    } else if (opposingFlowPercent >= 10 || reductionPct >= 10) {
      recommendation = 'Implement temporary inbound admission metering and assign separate egress lanes.';
    }

    return {
      opposingFlowPercent,
      inboundThroughputPerMin: inboundThroughput,
      outboundThroughputPerMin: outboundThroughput,
      totalCrossingCount,
      averageInboundSpeedMps: Math.round(avgInboundSpeed * 100) / 100,
      averageOutboundSpeedMps: Math.round(avgOutboundSpeed * 100) / 100,
      peakLocalDensity: Math.round(this.peakHoldingDensity * 10) / 10,
      maxQueueLengthMeters: Math.round(this.peakHoldingDensity * 4.5 * 10) / 10,
      baselineThroughputPerMin: baseline,
      capacityReductionPercent: reductionPct,
      operationalRecommendation: recommendation
    };
  }

  /**
   * Resets internal trackers.
   */
  public reset(): void {
    this.peakGateDensity = 0;
    this.peakHoldingDensity = 0;
    this.peakUpstreamDensity = 0;
    this.cumulativeTimeIntegratedExposure = 0;
    this.agentPreviousY.clear();
    this.inboundCrossingTimestampsSec = [];
    this.outboundCrossingTimestampsSec = [];
    this.inboundSpeeds = [];
    this.outboundSpeeds = [];
  }

  public setBaselineThroughput(throughputPerMin: number): void {
    if (throughputPerMin > 0) {
      this.baselineThroughputPerMin = throughputPerMin;
    }
  }
}
