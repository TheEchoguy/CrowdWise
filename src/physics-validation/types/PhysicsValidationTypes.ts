/**
 * CROWDWISE — Physics Credibility & Safety Verification Engine
 * Types and Empirical Reference Definitions
 *
 * Citations:
 * - Weidmann, U. (1993). Transporttechnik der Fussgänger (IVT Schriftenreihe 90, ETH Zürich).
 * - Schadschneider, A., & Seyfried, A. (2011). Empirical Results for Pedestrian Dynamics.
 * - Feliciani, C., & Nishinari, K. (2016). Empirical Analysis of Lane Formation in Bidirectional Pedestrian Flow.
 * - Fruin, J. J. (1971). Pedestrian Planning and Design. Metropolitan Association of Urban Designers and Environmental Planners.
 */

export type MovementIntent = 'INGRESS' | 'EGRESS' | 'REJECTED' | 'STAFF' | 'EMERGENCY';

export type ValidationStatus =
  | 'VALIDATED_AGAINST_REFERENCE'
  | 'PARTIALLY_VALIDATED'
  | 'NOT_VALIDATED'
  | 'INSUFFICIENT_REFERENCE_DATA';

export type SpatialZoneId =
  | 'ZONE_1_PUBLIC_ROAD'
  | 'ZONE_2_HOLDING_AREA'
  | 'ZONE_3_QUEUE_CONCOURSE'
  | 'ZONE_4_THROAT'
  | 'ZONE_5_DOWNSTREAM_STAND';

export type FinalSafetyVerdict =
  | 'IMPROVED'
  | 'ZERO_DISPLACEMENT'
  | 'DISPLACED'
  | 'DETERIORATED'
  | 'INCONCLUSIVE';

export interface EmpiricalReferencePoint {
  density: number; // pedestrians per m²
  velocity: number; // m/s
  specificFlow: number; // pedestrians / (m * s)
  source: string;
}

/**
 * Weidmann (1993) Standard Empirical Fundamental Diagram
 * v(rho) = v0 * (1 - exp(-gamma * (1/rho - 1/rho_max)))
 * Parameters: v0 = 1.34 m/s, rho_max = 5.4 p/m², gamma = 1.913
 */
export const WEIDMANN_EMPIRICAL_BENCHMARKS: EmpiricalReferencePoint[] = [
  { density: 0.5, velocity: 1.34, specificFlow: 0.67, source: 'Weidmann (1993)' },
  { density: 1.0, velocity: 1.25, specificFlow: 1.25, source: 'Weidmann (1993)' },
  { density: 1.5, velocity: 1.05, specificFlow: 1.58, source: 'Weidmann (1993)' },
  { density: 2.0, velocity: 0.82, specificFlow: 1.64, source: 'Weidmann (1993)' }, // Peak flow plateau
  { density: 2.5, velocity: 0.62, specificFlow: 1.55, source: 'Weidmann (1993)' },
  { density: 3.0, velocity: 0.44, specificFlow: 1.32, source: 'Weidmann (1993)' },
  { density: 4.0, velocity: 0.20, specificFlow: 0.80, source: 'Weidmann (1993)' },
  { density: 5.0, velocity: 0.05, specificFlow: 0.25, source: 'Weidmann (1993)' },
  { density: 5.4, velocity: 0.00, specificFlow: 0.00, source: 'Weidmann (1993) Jam Density' }
];

/**
 * Schadschneider & Seyfried (2011) Bottleneck Specific Capacity
 * Specific flow J_s ~ 1.2 to 1.9 p/(m*s) depending on constriction geometry
 */
export const BOTTLE_NECK_BENCHMARK = {
  minSpecificFlow: 1.2, // p/(m*s)
  maxSpecificFlow: 1.9, // p/(m*s)
  turnstileNominalDischargeRate: 0.75, // p/s per lane (for 1.33s service time)
  source: 'Schadschneider & Seyfried (2011)'
};

export interface FundamentalDiagramDataPoint {
  density: number; // p/m²
  meanVelocity: number; // m/s
  specificFlow: number; // p/(m*s)
  sampleCount: number;
  referenceVelocity?: number;
  velocityError?: number;
}

export interface ValidationEvidence {
  referenceModel: string;
  referenceDataset: string;
  sampleCount: number;
  simulationDurationSec: number;
  densityRangeTested: string;
  meanVelocityError: number;
  mveThreshold: number;
  flowCurveRMSE: number;
  rmseThreshold: number;
  status: ValidationStatus;
  isEmpiricalComparison: boolean;
}

export interface FundamentalDiagramResult {
  dataPoints: FundamentalDiagramDataPoint[];
  maxObservedFlow: number;
  densityAtMaxFlow: number;
  meanVelocityError: number;
  densityFlowCurveDeviation: number;
  validationStatus: ValidationStatus;
  statusRationale: string;
  evidence?: ValidationEvidence;
}

export interface DirectionalInteractionVector {
  cosineTheta: number; // cos(theta) = (vi . vj) / (|vi| * |vj|)
  interactionType: 'SAME_DIRECTION' | 'PERPENDICULAR' | 'OPPOSING';
  relativeClosingVelocity: number; // m/s
  lateralDisplacement: number; // m
}

export interface CounterFlowExperimentResult {
  forwardRatio: number; // e.g. 1.0, 0.75, 0.50
  reverseRatio: number; // e.g. 0.0, 0.25, 0.50
  totalPedestrians: number;
  activeAgents: number;
  blockedAgents: number;
  forwardThroughputPerMin: number;
  reverseThroughputPerMin: number;
  netThroughputPerMin: number;
  meanForwardVelocity: number; // m/s
  meanReverseVelocity: number; // m/s
  meanLocalDensity: number; // p/m²
  laneFormationOrderParameter: number; // Phi in [0, 1]
  laneFormationStatus: 'STRONG_SEGREGATION' | 'PARTIAL_LANE_FORMATION' | 'UNORGANIZED_COLLISION';
  collisionContactCount: number;
  deadlockDurationSec: number;
  capacityReductionPercent: number; // Emergent reduction, NOT hardcoded
}

export interface FiveZoneGeometryBounds {
  id: SpatialZoneId;
  name: string;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  areaM2: number;
  hazardThresholdDensity: number; // p/m²
}

export interface ZoneRiskMetrics {
  zoneId: SpatialZoneId;
  zoneName: string;
  activeCount: number;
  maxDensity: number;
  meanDensity: number;
  avgVelocity: number;
  maxQueueLength: number;
  longitudinalSpillbackMeters: number;
  avgWaitTimeSec: number;
  maxWaitTimeSec: number;
  counterFlowIntensity: number;
  collisionContactCount: number;
  hazardDurationSec: number;
  hasMissingTelemetry: boolean;
}

export interface FiveZoneSnapshot {
  timestamp: number;
  zones: Record<SpatialZoneId, ZoneRiskMetrics>;
  systemPeakDensity: number;
  hasMissingTelemetry: boolean;
}

export interface ZoneDisplacementComparison {
  zoneId: SpatialZoneId;
  zoneName: string;
  baselinePeakDensity: number;
  mitigatedPeakDensity: number;
  baselineDensity: number; // mean
  interventionDensity: number; // mean
  deltaDensity: number;
  baselineQueue: number;
  interventionQueue: number;
  deltaQueue: number;
  baselineSpillbackMeters: number;
  mitigatedSpillbackMeters: number;
  baselineMeanVelocity: number;
  mitigatedMeanVelocity: number;
  baselineHazardDurationSec: number;
  interventionHazardDurationSec: number;
  deltaHazardDurationSec: number;
  isImproved: boolean;
  isDeteriorated: boolean;
  isHotspot: boolean;
  isNewHotspot: boolean;
  isWorstRisk: boolean;
  hasMissingData: boolean;
}

export interface RiskDisplacementReport {
  isDisplacementDetected: boolean;
  displacedSourceZone?: string;
  displacedTargetZone?: string;
  worstAffectedZone?: string;
  verdict: FinalSafetyVerdict;
  overallThroughputImpactPercent: number;
  zoneComparisons: Record<SpatialZoneId, ZoneDisplacementComparison>;
  confidencePercent: number;
  rationale: string;
  permitOfficerRecommendation: string;
}

export interface PairedExperimentResult {
  baselineSnapshot: FiveZoneSnapshot;
  mitigatedSnapshot: FiveZoneSnapshot;
  baselinePeakDensity: number;
  mitigatedPeakDensity: number;
  baselineHoldingAreaDensity: number;
  mitigatedHoldingAreaDensity: number;
  baselineGateDensity: number;
  mitigatedGateDensity: number;
  maxSpillbackMeters: number;
  avgWaitTimeSec: number;
  throughputPerMin: number;
  hazardDurationSec: number;
  displacementReport: RiskDisplacementReport;
}

export interface PhysicsValidationMasterReport {
  timestamp: string;
  fundamentalDiagram: FundamentalDiagramResult;
  counterFlow: {
    forwardOnly: CounterFlowExperimentResult;
    seventyFiveTwentyFive: CounterFlowExperimentResult;
    fiftyFifty: CounterFlowExperimentResult;
    validationStatus: ValidationStatus;
    emergentVsHardcodedVerified: boolean;
  };
  queueDischarge: {
    nominalCapacity: number;
    observedDischargeRate: number;
    specificDischargeCapacity: number;
    dischargeErrorPercent: number;
    validationStatus: ValidationStatus;
  };
  spatialDisplacement: RiskDisplacementReport;
  pairedExperiment: PairedExperimentResult;
  overallStatus: ValidationStatus;
  summaryFindings: string[];
}
