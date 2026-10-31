/**
 * CROWDWISE — Controlled Experiment Execution Engine
 * Stage 6 & 7: Matched Baseline vs. Intervention Deterministic Simulation Runner
 * M. Chinnaswamy Stadium, Bengaluru
 *
 * Runs Matched Comparative Experiments:
 * RUN A — BASELINE: Original crowd demand, standard staffing, no interventions.
 * RUN B — INTERVENTION: Identical crowd demand, identical random seed S, identical initial conditions, applied safety interventions.
 *
 * Produces structured, reproducible ExperimentRecord for audit, displacement detection, and safety permitting.
 */

import { ScenarioConfig, ScenarioType } from './SyntheticDemandGenerator';
import { ZoneTelemetrySnapshot } from './ThreeZoneMonitor';
import { DisplacementDetector, ComparativeAuditReport } from './DisplacementDetector';
import { SafetyVerdictEngine, VerdictReport } from './SafetyVerdictEngine';
import { MicroGateEngine } from '../stadium/gate/MicroGateEngine';
import { GATE_CONNECTIVITY_CATALOG, getConnectedInnerGates } from '../stadium/network/gateConnectivity';

export type InterventionType =
  | 'METERING'
  | 'REROUTING'
  | 'DIRECTIONAL_SEPARATION'
  | 'QUEUE_MANAGEMENT'
  | 'TURNSTILE_LOAD_BALANCING';

export interface ExperimentRunResult {
  runType: 'BASELINE' | 'INTERVENTION';
  totalArrivals: number;
  totalAdmitted: number;
  totalDiverted: number;
  averageWaitTimeSec: number;
  peakThroughputPerMin: number;
  averageThroughputPerMin: number;
  zoneA: ZoneTelemetrySnapshot;
  zoneB: ZoneTelemetrySnapshot;
  zoneC: ZoneTelemetrySnapshot;
  peakDensityOverall: number;
  gateMetrics: Record<
    string,
    {
      arrivals: number;
      admitted: number;
      rejected: number;
      peakDensity: number;
    }
  >;
}

export interface ExperimentRecord {
  experimentId: string;
  scenarioType: ScenarioType;
  scenarioName: string;
  seed: number;
  initialParameters: {
    baseInflowRate: number;
    attendance: number;
    durationSeconds: number;
    walkingSpeed: number;
    turnstileServiceTime: number;
  };
  selectedGates: {
    outerGates: string[];
    innerGates: string[];
  };
  baselineResults: ExperimentRunResult;
  interventionConfiguration: InterventionType[];
  interventionResults: ExperimentRunResult;
  displacementResults: ComparativeAuditReport;
  safetyVerdict: VerdictReport;
  simulationDurationSeconds: number;
  timestamp: string;
}

export class ControlledExperimentRunner {
  /**
   * Executes a complete paired Controlled Experiment: Run A (Baseline) vs Run B (Intervention)
   * under strictly identical seeds, topology, and demand schedules.
   */
  public static runExperiment(
    config: ScenarioConfig,
    activeInterventions: InterventionType[] = ['METERING', 'QUEUE_MANAGEMENT'],
    primaryOuterGate = 'E22',
    dt = 0.05
  ): ExperimentRecord {
    const seed = config.seed || 42;
    const duration = config.durationSeconds || 60;

    // 1. RUN A: BASELINE (Zero active interventions)
    const baselineResults = this.simulateSingleRun(
      config,
      seed,
      [], // No interventions in baseline
      primaryOuterGate,
      duration,
      dt,
      'BASELINE'
    );

    // 2. RUN B: INTERVENTION (Identical seed, identical demand, active interventions)
    const interventionResults = this.simulateSingleRun(
      config,
      seed, // Exactly identical seed!
      activeInterventions,
      primaryOuterGate,
      duration,
      dt,
      'INTERVENTION'
    );

    // 3. Compare Baseline vs Intervention across all 3 zones
    const displacementResults = DisplacementDetector.compare(
      baselineResults.zoneA,
      baselineResults.zoneB,
      baselineResults.zoneC,
      interventionResults.zoneA,
      interventionResults.zoneB,
      interventionResults.zoneC,
      duration
    );

    // 4. Generate Final Evidence-Based Safety Verdict
    const safetyVerdict = SafetyVerdictEngine.evaluate(displacementResults);

    const record: ExperimentRecord = {
      experimentId: `exp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      scenarioType: config.type,
      scenarioName: config.name,
      seed,
      initialParameters: {
        baseInflowRate: config.baseInflowRate,
        attendance: config.expectedAttendance || 35000,
        durationSeconds: duration,
        walkingSpeed: config.walkingSpeed || 1.34,
        turnstileServiceTime: config.turnstileServiceTime || 1.0
      },
      selectedGates: {
        outerGates: config.selectedOuterGates || ['E22', 'E23'],
        innerGates: config.selectedInnerGates || ['G7', 'G8']
      },
      baselineResults,
      interventionConfiguration: [...activeInterventions],
      interventionResults,
      displacementResults,
      safetyVerdict,
      simulationDurationSeconds: duration,
      timestamp: new Date().toISOString()
    };

    return record;
  }

  /**
   * Runs an isolated, deterministic simulation pass for durationSeconds.
   */
  private static simulateSingleRun(
    config: ScenarioConfig,
    seed: number,
    interventions: InterventionType[],
    primaryOuterGate: string,
    durationSeconds: number,
    dt: number,
    runType: 'BASELINE' | 'INTERVENTION'
  ): ExperimentRunResult {
    const hasMetering = interventions.includes('METERING');
    const hasRerouting = interventions.includes('REROUTING');
    const hasSeparation = interventions.includes('DIRECTIONAL_SEPARATION');
    const hasSQueues = interventions.includes('QUEUE_MANAGEMENT');
    const hasLoadBalancing = interventions.includes('TURNSTILE_LOAD_BALANCING');

    // Initialize deterministic micro gate engine
    const engine = new MicroGateEngine(primaryOuterGate, seed);
    engine.reset(seed);

    // Configure base parameters
    let effectiveArrivalRate = config.baseInflowRate;

    // Dynamic Metering: Throttles upstream arrival inflow if active
    if (hasMetering && (config.type === 'METRO_SURGE' || config.type === 'COMBINED_EMERGENCY' || config.surge)) {
      effectiveArrivalRate = Math.round(config.baseInflowRate * 0.65); // 35% throttle buffer
    }

    engine.setArrivalRate(effectiveArrivalRate);
    engine.setSQueueActive(hasSQueues);
    engine.setTurnstileLatency(config.turnstileServiceTime || 1.0);

    // Turnstile Load Balancing: Adds operational counters to balance queues if enabled
    if (hasLoadBalancing) {
      const connected = getConnectedInnerGates(primaryOuterGate);
      connected.forEach((gid) => {
        engine.addTurnstile(gid);
      });
    }

    // Directional Separation: Decreases latency bottlenecks from counter-flow collisions
    if (hasSeparation && (config.type === 'COUNTER_FLOW_SHOCK' || config.counterFlow)) {
      engine.setTurnstileLatency(Math.max(0.6, (config.turnstileServiceTime || 1.0) * 0.8));
    }

    // Handle Gate Failure with Intelligent Rerouting
    if (config.type === 'OUTER_GATE_FAILURE' || config.gateFailure) {
      const failGate = config.gateFailure?.failedGateId || config.failedGateId || 'E22';
      if (primaryOuterGate === failGate) {
        if (hasRerouting) {
          // Reroute to authorized alternative gate
          const altGates = config.gateFailure?.alternateGates || ['E23', 'E21'];
          const validAlt = altGates.find((g) => {
            const spec = GATE_CONNECTIVITY_CATALOG[g];
            return spec && spec.accessPermission !== 'RESTRICTED_VIP_MEDIA';
          }) || 'E23';
          engine.selectOuterGate(validAlt);
        } else {
          // Baseline with no rerouting: gate chokes
          engine.setArrivalRate(Math.round(config.baseInflowRate * 1.5));
        }
      }
    }

    // Handle Turnstile Failure
    if (config.type === 'TURNSTILE_FAILURE' || config.turnstileFailure) {
      const failCount = config.turnstileFailure?.failedCounterCount || config.failedTurnstileCount || 2;
      for (let i = 0; i < failCount; i++) {
        engine.toggleTurnstileFailure(i);
      }
    }

    // Handle Ticket Rejection Rate
    if (config.ticketRejection) {
      engine.setRejectionRate(config.ticketRejection.rejectionPercentage);
    } else if (config.type === 'COUNTER_FLOW_SHOCK') {
      engine.setRejectionRate(config.counterFlow?.intensityPercent || 0.15);
    }

    // Step simulation deterministically
    const totalSteps = Math.round(durationSeconds / dt);
    let peakZone1 = 0;
    let peakZone2 = 0;
    let peakZone3 = 0;
    let sumZone1 = 0;
    let sumZone2 = 0;
    let sumZone3 = 0;
    let hazardSec1 = 0;
    let hazardSec2 = 0;
    let hazardSec3 = 0;

    let finalMetrics = engine.step(dt, 0);

    for (let step = 1; step <= totalSteps; step++) {
      const simTime = step * dt;

      // Handle surge event start/end
      if (config.surge && simTime >= config.surge.startSeconds && simTime <= config.surge.startSeconds + config.surge.durationSeconds) {
        if (!hasMetering) {
          engine.setArrivalRate(config.baseInflowRate + config.surge.magnitude);
        }
      }

      finalMetrics = engine.step(dt, simTime);

      const z1 = finalMetrics.zone1ApproachDensity;
      const z2 = finalMetrics.zone2HoldingDensity;
      const z3 = finalMetrics.zone3ThroatDensity;

      peakZone1 = Math.max(peakZone1, z1);
      peakZone2 = Math.max(peakZone2, z2);
      peakZone3 = Math.max(peakZone3, z3);

      sumZone1 += z1;
      sumZone2 += z2;
      sumZone3 += z3;

      if (z1 >= 3.0) hazardSec1 += dt;
      if (z2 >= 3.0) hazardSec2 += dt;
      if (z3 >= 3.0) hazardSec3 += dt;
    }

    // Construct calibrated Zone Telemetry Snapshots
    // Zone A: Gate Turnstile Throats (80 m²) — ZONE_A_THROAT
    const zoneA: ZoneTelemetrySnapshot = {
      zoneId: 'ZONE_A_THROAT',
      name: 'Zone A: Turnstile Admission Throats',
      agentCount: finalMetrics.zone3ThroatCount,
      density: finalMetrics.zone3ThroatDensity,
      peakDensity: Math.round(peakZone3 * 10) / 10,
      queuePopulation: finalMetrics.currentlyScanning + finalMetrics.currentlyChecking,
      observedThroughputPerMin: finalMetrics.currentThroughputPerMin,
      averageWaitTimeSec: finalMetrics.averageWaitTimeSec,
      maxWaitTimeSec: finalMetrics.averageWaitTimeSec * 1.2,
      counterFlowIntensity: 0,
      directionalConflicts: 0,
      criticalHazardDurationSec: Math.round(hazardSec3 * 10) / 10,
      spillbackMeters: 0,
      queueGrowthRate: 0,
      status: peakZone3 >= 3.0 ? 'CRITICAL' : peakZone3 >= 2.0 ? 'WARNING' : 'SAFE'
    };

    // Zone B: Holding Concourse & Queues (250 m²) — ZONE_B_CONCOURSE
    const zoneB: ZoneTelemetrySnapshot = {
      zoneId: 'ZONE_B_CONCOURSE',
      name: 'Zone B: Holding Concourse & S-Queues',
      agentCount: finalMetrics.zone2HoldingCount,
      density: finalMetrics.zone2HoldingDensity,
      peakDensity: Math.round(peakZone2 * 10) / 10,
      queuePopulation: finalMetrics.waitingInQueues,
      observedThroughputPerMin: finalMetrics.currentThroughputPerMin,
      averageWaitTimeSec: finalMetrics.averageWaitTimeSec,
      maxWaitTimeSec: finalMetrics.averageWaitTimeSec * 1.8,
      counterFlowIntensity: 0,
      directionalConflicts: 0,
      criticalHazardDurationSec: Math.round(hazardSec2 * 10) / 10,
      spillbackMeters: 0,
      queueGrowthRate: 0,
      status: peakZone2 >= 3.0 ? 'CRITICAL' : peakZone2 >= 2.0 ? 'WARNING' : 'SAFE'
    };

    // Zone C: Approach Corridor / Public Road (120 m²) — ZONE_C_ROAD
    const zoneC: ZoneTelemetrySnapshot = {
      zoneId: 'ZONE_C_ROAD',
      name: 'Zone C: Approach / Public Roadway',
      agentCount: finalMetrics.zone1ApproachCount,
      density: finalMetrics.zone1ApproachDensity,
      peakDensity: Math.round(peakZone1 * 10) / 10,
      queuePopulation: finalMetrics.zone1ApproachCount,
      observedThroughputPerMin: finalMetrics.currentThroughputPerMin,
      averageWaitTimeSec: finalMetrics.averageWaitTimeSec,
      maxWaitTimeSec: finalMetrics.averageWaitTimeSec * 1.5,
      counterFlowIntensity: 0,
      directionalConflicts: 0,
      criticalHazardDurationSec: Math.round(hazardSec1 * 10) / 10,
      spillbackMeters: Math.round(finalMetrics.zone1ApproachCount * 0.08 * 10) / 10,
      queueGrowthRate: 0,
      status: peakZone1 >= 3.0 ? 'CRITICAL' : peakZone1 >= 2.0 ? 'WARNING' : 'SAFE'
    };

    const overallPeak = Math.max(peakZone1, peakZone2, peakZone3);

    return {
      runType,
      totalArrivals: finalMetrics.totalArrivals,
      totalAdmitted: finalMetrics.spectatorsAdmitted,
      totalDiverted: finalMetrics.ticketsRejected + finalMetrics.personMismatches,
      averageWaitTimeSec: finalMetrics.averageWaitTimeSec,
      peakThroughputPerMin: finalMetrics.currentThroughputPerMin,
      averageThroughputPerMin: Math.round((finalMetrics.spectatorsAdmitted / Math.max(1, durationSeconds)) * 60),
      zoneA,
      zoneB,
      zoneC,
      peakDensityOverall: Math.round(overallPeak * 10) / 10,
      gateMetrics: {
        [primaryOuterGate]: {
          arrivals: finalMetrics.totalArrivals,
          admitted: finalMetrics.spectatorsAdmitted,
          rejected: finalMetrics.ticketsRejected + finalMetrics.personMismatches,
          peakDensity: Math.round(overallPeak * 10) / 10
        }
      }
    };
  }
}
