/**
 * CROWDWISE — Three-Zone Spatial Monitoring Engine
 * Stage 3: Independent Spatial Zone Telemetry & Area Density Profiling
 *
 * Coordinates: 20px = 1 meter (1 m² = 400 px²)
 * - Zone A: Gate / Turnstile Throat (y in [160, 215])
 * - Zone B: Holding Concourse / Queue (y in (215, 470))
 * - Zone C: Upstream / Public Approach Roadway (y in [470, 540])
 */

import { AgentData } from '../types/simulation';

export type MonitoredZoneId = 'ZONE_A_THROAT' | 'ZONE_B_CONCOURSE' | 'ZONE_C_ROAD';

export interface ZoneBounds {
  id: MonitoredZoneId;
  name: string;
  yMin: number;
  yMax: number;
  xMin: number;
  xMax: number;
  areaM2: number;
  criticalDensityThreshold: number; // e.g. 4.5 p/m²
  warningDensityThreshold: number;  // e.g. 2.8 p/m²
}

export interface ZoneTelemetrySnapshot {
  zoneId: MonitoredZoneId;
  name: string;
  agentCount: number;
  density: number; // people/m²
  peakDensity: number;
  queuePopulation: number;
  activeCounters?: number;
  theoreticalCapacityPerMin?: number;
  observedThroughputPerMin: number;
  averageWaitTimeSec: number;
  maxWaitTimeSec: number;
  counterFlowIntensity: number; // opposing vector count
  directionalConflicts: number;
  criticalHazardDurationSec: number; // accumulated time >= 4.5 p/m²
  spillbackMeters: number;
  queueGrowthRate: number; // delta agents / sec
  status: 'SAFE' | 'WARNING' | 'CRITICAL';
}

export interface ThreeZoneAuditSnapshot {
  timestamp: number;
  zoneA: ZoneTelemetrySnapshot;
  zoneB: ZoneTelemetrySnapshot;
  zoneC: ZoneTelemetrySnapshot;
  overallPeakDensity: number;
  displacedZone: 'NONE' | 'ZONE_A_THROAT' | 'ZONE_B_CONCOURSE' | 'ZONE_C_ROAD';
  displacedCrushAdvisory: string | null;
}

export class ThreeZoneMonitor {
  // Defined geometric boundaries in world-space coordinates (20 px = 1 m)
  public static readonly ZONE_BOUNDS: Record<MonitoredZoneId, ZoneBounds> = {
    ZONE_A_THROAT: {
      id: 'ZONE_A_THROAT',
      name: 'Zone A: Turnstile Throat',
      yMin: 160,
      yMax: 215,
      xMin: 80,
      xMax: 880,
      areaM2: Math.round(((800 * 55) / 400) * 10) / 10, // ~110 m²
      criticalDensityThreshold: 4.5,
      warningDensityThreshold: 2.8
    },
    ZONE_B_CONCOURSE: {
      id: 'ZONE_B_CONCOURSE',
      name: 'Zone B: Holding Concourse',
      yMin: 215,
      yMax: 470,
      xMin: 60,
      xMax: 900,
      areaM2: Math.round(((840 * 255) / 400) * 10) / 10, // ~535.5 m²
      criticalDensityThreshold: 4.5,
      warningDensityThreshold: 2.8
    },
    ZONE_C_ROAD: {
      id: 'ZONE_C_ROAD',
      name: 'Zone C: Public Approach Roadway',
      yMin: 470,
      yMax: 540,
      xMin: 40,
      xMax: 920,
      areaM2: Math.round(((880 * 70) / 400) * 10) / 10, // ~154 m²
      criticalDensityThreshold: 4.5,
      warningDensityThreshold: 2.8
    }
  };

  private hazardDurationA: number = 0;
  private hazardDurationB: number = 0;
  private hazardDurationC: number = 0;
  private peakA: number = 0;
  private peakB: number = 0;
  private peakC: number = 0;
  private lastCountB: number = 0;

  /**
   * Resets accumulated hazard metrics upon simulation reset
   */
  public reset(): void {
    this.hazardDurationA = 0;
    this.hazardDurationB = 0;
    this.hazardDurationC = 0;
    this.peakA = 0;
    this.peakB = 0;
    this.peakC = 0;
    this.lastCountB = 0;
  }

  /**
   * Analyzes live agent population, allocating each agent deterministically to one zone
   */
  public sampleZones(
    agents: AgentData[],
    dt: number,
    observedThroughputPerMin: number = 0,
    theoreticalCapacityPerMin: number = 240
  ): ThreeZoneAuditSnapshot {
    const bA = ThreeZoneMonitor.ZONE_BOUNDS.ZONE_A_THROAT;
    const bB = ThreeZoneMonitor.ZONE_BOUNDS.ZONE_B_CONCOURSE;
    const bC = ThreeZoneMonitor.ZONE_BOUNDS.ZONE_C_ROAD;

    let countA = 0;
    let countB = 0;
    let countC = 0;
    let waitTimesA: number[] = [];
    let waitTimesB: number[] = [];

    const now = performance.now();

    for (let i = 0; i < agents.length; i++) {
      const a = agents[i];
      if (a.active === false || a.isCleared) continue;

      const y = a.y;
      // Deterministic zone assignment based on non-overlapping y partitions
      if (y >= bC.yMin) {
        countC++;
      } else if (y > bB.yMin && y < bC.yMin) {
        countB++;
        if (a.entryTime) waitTimesB.push((now - a.entryTime) / 1000);
      } else if (y >= bA.yMin && y <= bA.yMax) {
        countA++;
        if (a.entryTime) waitTimesA.push((now - a.entryTime) / 1000);
      }
    }

    // Densities (people/m²)
    // Area scaling: effective active corridor is tighter than total bounding box
    const densityA = Math.round((countA / (bA.areaM2 * 0.35)) * 10) / 10;
    const densityB = Math.round((countB / (bB.areaM2 * 0.28)) * 10) / 10;
    const densityC = Math.round((countC / (bC.areaM2 * 0.4)) * 10) / 10;

    this.peakA = Math.max(this.peakA, densityA);
    this.peakB = Math.max(this.peakB, densityB);
    this.peakC = Math.max(this.peakC, densityC);

    if (densityA >= bA.criticalDensityThreshold) this.hazardDurationA += dt;
    if (densityB >= bB.criticalDensityThreshold) this.hazardDurationB += dt;
    if (densityC >= bC.criticalDensityThreshold) this.hazardDurationC += dt;

    const queueGrowthB = dt > 0 ? (countB - this.lastCountB) / dt : 0;
    this.lastCountB = countB;

    // Upstream spillback meters in Zone C (20 px = 1 meter)
    const spillbackPx = Math.max(0, countC * 1.8);
    const spillbackMeters = Math.round((spillbackPx / 20) * 10) / 10;

    // Wait time calculations
    const avgWaitA = waitTimesA.length > 0 ? waitTimesA.reduce((s, v) => s + v, 0) / waitTimesA.length : 0;
    const maxWaitA = waitTimesA.length > 0 ? Math.max(...waitTimesA) : 0;
    const avgWaitB = waitTimesB.length > 0 ? waitTimesB.reduce((s, v) => s + v, 0) / waitTimesB.length : 0;

    const snapshotA: ZoneTelemetrySnapshot = {
      zoneId: 'ZONE_A_THROAT',
      name: bA.name,
      agentCount: countA,
      density: densityA,
      peakDensity: this.peakA,
      queuePopulation: countA,
      theoreticalCapacityPerMin,
      observedThroughputPerMin,
      averageWaitTimeSec: Math.round(avgWaitA * 10) / 10,
      maxWaitTimeSec: Math.round(maxWaitA * 10) / 10,
      counterFlowIntensity: 0,
      directionalConflicts: 0,
      criticalHazardDurationSec: Math.round(this.hazardDurationA * 10) / 10,
      spillbackMeters: 0,
      queueGrowthRate: 0,
      status: densityA >= bA.criticalDensityThreshold ? 'CRITICAL' : densityA >= bA.warningDensityThreshold ? 'WARNING' : 'SAFE'
    };

    const snapshotB: ZoneTelemetrySnapshot = {
      zoneId: 'ZONE_B_CONCOURSE',
      name: bB.name,
      agentCount: countB,
      density: densityB,
      peakDensity: this.peakB,
      queuePopulation: countB,
      observedThroughputPerMin,
      averageWaitTimeSec: Math.round(avgWaitB * 10) / 10,
      maxWaitTimeSec: 0,
      counterFlowIntensity: 0,
      directionalConflicts: 0,
      criticalHazardDurationSec: Math.round(this.hazardDurationB * 10) / 10,
      spillbackMeters: 0,
      queueGrowthRate: Math.round(queueGrowthB * 10) / 10,
      status: densityB >= bB.criticalDensityThreshold ? 'CRITICAL' : densityB >= bB.warningDensityThreshold ? 'WARNING' : 'SAFE'
    };

    const snapshotC: ZoneTelemetrySnapshot = {
      zoneId: 'ZONE_C_ROAD',
      name: bC.name,
      agentCount: countC,
      density: densityC,
      peakDensity: this.peakC,
      queuePopulation: countC,
      observedThroughputPerMin: 0,
      averageWaitTimeSec: 0,
      maxWaitTimeSec: 0,
      counterFlowIntensity: 0,
      directionalConflicts: 0,
      criticalHazardDurationSec: Math.round(this.hazardDurationC * 10) / 10,
      spillbackMeters,
      queueGrowthRate: 0,
      status: densityC >= bC.criticalDensityThreshold ? 'CRITICAL' : densityC >= bC.warningDensityThreshold ? 'WARNING' : 'SAFE'
    };

    // Displaced Risk Detection:
    // If downstream (Zone A or B) has low density, but upstream (Zone C public road) is critical
    let displacedZone: 'NONE' | 'ZONE_A_THROAT' | 'ZONE_B_CONCOURSE' | 'ZONE_C_ROAD' = 'NONE';
    let advisory: string | null = null;

    if (densityC >= 4.5 && densityA < 3.0) {
      displacedZone = 'ZONE_C_ROAD';
      advisory = 'WARNING: Displaced Crush Detected. Throttling Inner Gates moved queue compression onto the public roadway.';
    } else if (densityB >= 4.5 && densityA < 2.5) {
      displacedZone = 'ZONE_B_CONCOURSE';
      advisory = 'ADVISORY: Concourse Queuing Compression elevated while turnstiles remain under-utilized.';
    }

    return {
      timestamp: performance.now(),
      zoneA: snapshotA,
      zoneB: snapshotB,
      zoneC: snapshotC,
      overallPeakDensity: Math.max(densityA, densityB, densityC),
      displacedZone,
      displacedCrushAdvisory: advisory
    };
  }
}

