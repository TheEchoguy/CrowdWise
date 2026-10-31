/**
 * CROWDWISE — Displacement Audit & Decision Brief Structured JSON Exporter
 * Generates genuine, comprehensive experiment JSON exports for paired counterfactual evaluations.
 * Venue: M. Chinnaswamy Stadium, Bengaluru (35,000 capacity)
 */

import {
  ScenarioComparisonResult,
  SyntheticEventData,
  PreGeneratedArrivalSchedule
} from '../types/ScenarioTypes';
import { TelemetryState } from '../../types/simulation';
import { SafetyRecommendationItem } from '../engine/SafetyController';

export interface DisplacementAuditExportData {
  readonly exportMetadata: {
    readonly system: string;
    readonly version: string;
    readonly venue: string;
    readonly venueCapacity: number;
    readonly exportTimestampIso: string;
    readonly exportTimestampEpochMs: number;
    readonly experimentId: string;
    readonly auditStatus: 'PAIRED_COUNTERFACTUAL_COMPLETE' | 'LIVE_TELEMETRY_SNAPSHOT';
  };
  readonly scenarioConfiguration: {
    readonly scenarioId: string;
    readonly scenarioName: string;
    readonly inflowRatePerMin: number;
    readonly gateLatencySec: number;
    readonly walkingSpeedMps: number;
    readonly bafflesActive: boolean;
    readonly auxGateActive: boolean;
    readonly opposingFlowPercent: number;
    readonly physicsValidationMode: boolean;
  };
  readonly arrivalScheduleMetadata: {
    readonly seed: number;
    readonly scheduleId: string;
    readonly totalScheduledAgents: number;
    readonly representedTotalAttendance: number;
    readonly eventDurationMinutes: number;
    readonly peakArrivalRateRepPerMin: number;
    readonly scalingRatio: number;
  };
  readonly pairedAuditSummary: {
    readonly displacementVerdict: string;
    readonly confidenceScore: number;
    readonly baselineSystemMaxDensity: number;
    readonly mitigatedSystemMaxDensity: number;
    readonly systemMaxDensityDeltaPercent: number;
    readonly empiricalExplanation: string;
    readonly operationalRecommendation: string;
  } | null;
  readonly threeZoneMeasurements: {
    readonly zone1GateApproach: {
      readonly name: string;
      readonly baselinePeakDensity?: number;
      readonly mitigatedPeakDensity?: number;
      readonly densityDeltaPercent?: number;
      readonly queueDeltaPercent?: number;
      readonly currentDensity?: number;
      readonly currentAvgSpeedMps?: number;
      readonly currentQueueDepthMeters?: number;
      readonly currentWaitingCount?: number;
      readonly currentSpillbackDistanceMeters?: number;
    };
    readonly zone2HoldingArea: {
      readonly name: string;
      readonly baselinePeakDensity?: number;
      readonly mitigatedPeakDensity?: number;
      readonly densityDeltaPercent?: number;
      readonly queueDeltaPercent?: number;
      readonly currentDensity?: number;
      readonly currentAvgSpeedMps?: number;
      readonly currentQueueDepthMeters?: number;
      readonly currentWaitingCount?: number;
      readonly currentSpillbackDistanceMeters?: number;
    };
    readonly zone3UpstreamArrival: {
      readonly name: string;
      readonly baselinePeakDensity?: number;
      readonly mitigatedPeakDensity?: number;
      readonly densityDeltaPercent?: number;
      readonly queueDeltaPercent?: number;
      readonly currentDensity?: number;
      readonly currentAvgSpeedMps?: number;
      readonly currentQueueDepthMeters?: number;
      readonly currentWaitingCount?: number;
      readonly currentSpillbackDistanceMeters?: number;
    };
  };
  readonly simulationPerformance: {
    readonly simTimeSec: number;
    readonly representedAdmitted: number;
    readonly totalAdmittedSim: number;
    readonly totalGeneratedSim: number;
    readonly observedThroughputRepPerMin: number;
    readonly currentFps: number;
    readonly peakDensity: number;
    readonly maxQueueSpillbackMeters: number;
  };
  readonly safetyRecommendations: readonly SafetyRecommendationItem[];
}

export interface BuildExportParams {
  readonly comparisonResult: ScenarioComparisonResult | null;
  readonly telemetry: TelemetryState;
  readonly activeScenarioId: string;
  readonly scenarioName?: string;
  readonly activeSchedule: PreGeneratedArrivalSchedule | null;
  readonly syntheticEvent: SyntheticEventData | null;
  readonly inflowRate: number;
  readonly gateLatency: number;
  readonly walkingSpeed: number;
  readonly bafflesActive: boolean;
  readonly auxGateActive: boolean;
  readonly opposingFlowPercent: number;
  readonly physicsValidationMode: boolean;
}

/**
 * Builds a structured, complete audit export object from recorded simulation and comparison telemetry.
 * Gracefully handles missing comparison results by exporting the live snapshot state.
 */
export function buildDisplacementAuditExport(params: BuildExportParams): DisplacementAuditExportData {
  const {
    comparisonResult,
    telemetry,
    activeScenarioId,
    scenarioName = activeScenarioId,
    activeSchedule,
    syntheticEvent,
    inflowRate,
    gateLatency,
    walkingSpeed,
    bafflesActive,
    auxGateActive,
    opposingFlowPercent,
    physicsValidationMode
  } = params;

  const now = new Date();
  const seed = comparisonResult?.seed ?? activeSchedule?.seed ?? 2026;
  const experimentId = `EXP-CHINNASWAMY-${activeScenarioId.toUpperCase()}-${seed}-${now.getTime()}`;

  const displacement = comparisonResult?.displacementResult;

  // System Max Density Delta calculation
  let systemMaxDensityDeltaPercent = 0;
  if (displacement && displacement.baselineSystemMaxDensity > 0) {
    systemMaxDensityDeltaPercent = Math.round(
      ((displacement.mitigatedSystemMaxDensity - displacement.baselineSystemMaxDensity) /
        displacement.baselineSystemMaxDensity) *
        1000
    ) / 10;
  }

  const pairedSummary = displacement
    ? {
        displacementVerdict: displacement.verdict,
        confidenceScore: displacement.confidenceScore,
        baselineSystemMaxDensity: displacement.baselineSystemMaxDensity,
        mitigatedSystemMaxDensity: displacement.mitigatedSystemMaxDensity,
        systemMaxDensityDeltaPercent,
        empiricalExplanation: displacement.empiricalExplanation,
        operationalRecommendation: displacement.operationalRecommendation
      }
    : null;

  const z1Live = telemetry.threeZone?.gateApproach;
  const z2Live = telemetry.threeZone?.intermediateHolding;
  const z3Live = telemetry.threeZone?.upstreamArrival;

  return {
    exportMetadata: {
      system: 'CROWDWISE Predictive Safety Digital Twin',
      version: '1.0.0',
      venue: 'M. Chinnaswamy Stadium, Bengaluru',
      venueCapacity: 35000,
      exportTimestampIso: now.toISOString(),
      exportTimestampEpochMs: now.getTime(),
      experimentId,
      auditStatus: displacement ? 'PAIRED_COUNTERFACTUAL_COMPLETE' : 'LIVE_TELEMETRY_SNAPSHOT'
    },
    scenarioConfiguration: {
      scenarioId: activeScenarioId,
      scenarioName,
      inflowRatePerMin: inflowRate,
      gateLatencySec: gateLatency,
      walkingSpeedMps: walkingSpeed,
      bafflesActive,
      auxGateActive,
      opposingFlowPercent,
      physicsValidationMode
    },
    arrivalScheduleMetadata: {
      seed,
      scheduleId: activeSchedule?.eventId ?? 'SYNTH-DEMAND-35K-CHINNASWAMY',
      totalScheduledAgents: activeSchedule?.totalAgentsToSpawn ?? 2500,
      representedTotalAttendance: syntheticEvent?.expected_attendance ?? 33250,
      eventDurationMinutes: syntheticEvent ? (syntheticEvent.arrival_end_time_min - syntheticEvent.arrival_start_time_min) : 90,
      peakArrivalRateRepPerMin: syntheticEvent?.peak_arrival_rate_real ?? 554,
      scalingRatio: activeSchedule?.populationScalingRatio ?? syntheticEvent?.population_scaling_ratio ?? 13.3
    },
    pairedAuditSummary: pairedSummary,
    threeZoneMeasurements: {
      zone1GateApproach: {
        name: 'Zone 1: Gate Approach Area (204 m²)',
        baselinePeakDensity: displacement?.gateApproach.baselinePeakDensity,
        mitigatedPeakDensity: displacement?.gateApproach.mitigatedPeakDensity,
        densityDeltaPercent: displacement?.gateApproach.densityDeltaPercent,
        queueDeltaPercent: displacement?.gateApproach.queueDeltaPercent,
        currentDensity: z1Live?.currentDensity,
        currentAvgSpeedMps: z1Live?.averageSpeedMps,
        currentQueueDepthMeters: z1Live?.queueLengthMeters,
        currentWaitingCount: z1Live?.waitingAgentsCount,
        currentSpillbackDistanceMeters: z1Live?.spillbackMeters
      },
      zone2HoldingArea: {
        name: 'Zone 2: Intermediate Holding Concourse (333 m²)',
        baselinePeakDensity: displacement?.intermediateHolding.baselinePeakDensity,
        mitigatedPeakDensity: displacement?.intermediateHolding.mitigatedPeakDensity,
        densityDeltaPercent: displacement?.intermediateHolding.densityDeltaPercent,
        queueDeltaPercent: displacement?.intermediateHolding.queueDeltaPercent,
        currentDensity: z2Live?.currentDensity,
        currentAvgSpeedMps: z2Live?.averageSpeedMps,
        currentQueueDepthMeters: z2Live?.queueLengthMeters,
        currentWaitingCount: z2Live?.waitingAgentsCount,
        currentSpillbackDistanceMeters: z2Live?.spillbackMeters
      },
      zone3UpstreamArrival: {
        name: 'Zone 3: Upstream Arrival Concourse (360 m²)',
        baselinePeakDensity: displacement?.upstreamArrival.baselinePeakDensity,
        mitigatedPeakDensity: displacement?.upstreamArrival.mitigatedPeakDensity,
        densityDeltaPercent: displacement?.upstreamArrival.densityDeltaPercent,
        queueDeltaPercent: displacement?.upstreamArrival.queueDeltaPercent,
        currentDensity: z3Live?.currentDensity,
        currentAvgSpeedMps: z3Live?.averageSpeedMps,
        currentQueueDepthMeters: z3Live?.queueLengthMeters,
        currentWaitingCount: z3Live?.waitingAgentsCount,
        currentSpillbackDistanceMeters: z3Live?.spillbackMeters
      }
    },
    simulationPerformance: {
      simTimeSec: telemetry.simTimeSec ?? 0,
      representedAdmitted: telemetry.representedAdmitted ?? 0,
      totalAdmittedSim: telemetry.totalAdmittedSim ?? 0,
      totalGeneratedSim: telemetry.totalGeneratedSim ?? 0,
      observedThroughputRepPerMin: telemetry.observedThroughputRep ?? 0,
      currentFps: telemetry.fps,
      peakDensity: telemetry.peakDensity,
      maxQueueSpillbackMeters: telemetry.spillbackMeters
    },
    safetyRecommendations: telemetry.safetyRecommendations ?? []
  };
}

/**
 * Triggers a genuine JSON file download in a browser environment.
 * Safe no-op in headless / SSR environments.
 */
export function triggerJsonDownload(data: object, filename: string = 'crowdwise-displacement-audit.json'): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }

  try {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  } catch (err) {
    console.error('Failed to trigger JSON report download:', err);
    return false;
  }
}
