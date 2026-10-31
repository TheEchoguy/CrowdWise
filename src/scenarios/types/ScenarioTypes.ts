/**
 * CROWDWISE Predictive Crowd Digital Twin & Safety Lab
 * Scenario & Synthetic Data Engine: Type Definitions (v1.4)
 *
 * Provides strongly typed schemas for:
 * 1. M. Chinnaswamy 35,000 capacity stadium specifications
 * 2. Six canonical operational scenarios
 * 3. Three-Zone Micro-Ingress Monitoring (Gate Approach, Holding, Upstream)
 * 4. Bidirectional Counterflow Experimentation & Throughput Reduction
 * 5. Paired Counterfactual Displacement Detection & Verdicts
 * 6. Pure Physics Validation & Fundamental Diagram (J = rho * v)
 */

export type ArrivalPatternType = 'uniform' | 'gaussian_peak' | 'burst';

export type ScenarioId =
  | 'stadium_normal'
  | 'ticket_surge'
  | 'gate_failure'
  | 'uneven_distribution'
  | 'emergency_reversal'
  | 'safety_intervention';

export type GateTargetId =
  | 'gate-a'
  | 'gate-b'
  | 'gate-bridge-east'
  | 'gate-bridge-west'
  | 'gate-emergency-rear';

export type RoutingMode = 'fixed' | 'adaptive';

export type FlowDirection = 'inbound' | 'outbound';

export type SafetyVerdict =
  | 'Improvement'
  | 'Moderate Improvement'
  | 'Neutral'
  | 'Safety Degradation';

export type DisplacementVerdict =
  | 'IMPROVED'
  | 'DISPLACED'
  | 'DEGRADED'
  | 'INCONCLUSIVE';

/**
 * Configurable simulation assumptions for crowd density thresholds.
 * Treated as research parameters rather than universal constants.
 */
export interface DensityThresholdAssumptions {
  readonly frictionThreshold: number;      // Default: 4.5 people/m² (LOS E elevated friction)
  readonly criticalCrushThreshold: number; // Default: 5.0 people/m² (LOS F compressive crush risk)
}

/**
 * Downstream physical concourse / corridor capacity parameters.
 */
export interface CorridorCapacityAssumptions {
  readonly downstreamCorridorWidthMeters: number; // Clear internal concourse width (meters)
  readonly specificFlowRatePerMeterMin: number;   // Normal specific flow (default: 75 p/(m·min))
}

/**
 * Discrete multi-lane gate configuration.
 */
export interface GateLaneConfig {
  readonly gateId: string;
  readonly name: string;
  readonly totalLanes: number;         // Total physical turnstile lanes installed
  readonly operationalLanes: number;   // Active functioning lanes (0 <= operational <= total)
  readonly turnstileLatencySec: number;// Inspection/scan latency per person (seconds)
}

/**
 * Event-level parameters and attendance generation input.
 */
export interface SyntheticEventConfigInput {
  readonly eventId?: string;
  readonly eventName?: string;
  readonly venueCapacity: number;          // Chinnaswamy physical capacity: 35,000
  readonly ticketSalesPercentage: number;  // 0.0 to 1.0 (e.g. 0.95 for 95%)
  readonly attendancePercentage?: number;  // 0.0 to 1.0 (default: 1.0 = 100%)
  readonly expectedAttendanceOverride?: number;
  readonly maxSimulatedAgents?: number;    // Cap: 2,500 for 60 FPS budget
  readonly arrivalStartTimeMin?: number;   // In minutes (default: 0)
  readonly arrivalEndTimeMin?: number;     // In minutes (default: 60)
  readonly arrivalDistribution: ArrivalPatternType;
  readonly gaussianPeakMin?: number;       // Peak minute for gaussian distribution
  readonly gaussianStdDevMin?: number;     // Standard deviation for gaussian distribution
  readonly targetPeakArrivalRateReal?: number; // Target peak arrival rate in real people/min
  readonly burstIntervals?: readonly { readonly startMin: number; readonly endMin: number; readonly weight: number }[];
  readonly gateAShare: number;             // Proportion routed to Gate A (0.0 to 1.0)
  readonly gateBShare: number;             // Proportion routed to Gate B (0.0 to 1.0)
  readonly gates: Record<string, GateLaneConfig>;
  readonly randomSeed: number;
  readonly routingMode?: RoutingMode;      // Default: 'fixed'
  readonly densityThresholds?: DensityThresholdAssumptions;
  readonly corridorAssumptions?: CorridorCapacityAssumptions;
  readonly sectorId?: 'east' | 'north' | 'west' | 'south';
}

/**
 * Fully calculated and validated synthetic event dataset.
 */
export interface SyntheticEventData {
  readonly event_id: string;
  readonly event_name: string;
  readonly venue_capacity: number;           // Chinnaswamy physical capacity: 35,000
  readonly tickets_sold: number;             // Real tickets sold
  readonly attendance_percentage: number;    // Show-up rate (0.0 to 1.0)
  readonly expected_attendance: number;      // Real expected attendees
  readonly simulated_agent_population: number; // Microscopic entities instantiated in sim (<= 2,500)
  readonly population_scaling_ratio: number; // S_pop = expected_attendance / simulated_agent_population
  readonly arrival_start_time_min: number;
  readonly arrival_end_time_min: number;
  readonly arrival_distribution: ArrivalPatternType;
  readonly peak_arrival_rate_real: number;   // Real spectators per minute at peak
  readonly peak_arrival_rate_sim: number;    // Simulated agents per minute at peak
  readonly gate_A_share: number;
  readonly gate_B_share: number;
  readonly gates: Record<string, GateLaneConfig>;
  readonly random_seed: number;
  readonly routing_mode: RoutingMode;
  readonly density_thresholds: DensityThresholdAssumptions;
  readonly corridor_assumptions: CorridorCapacityAssumptions;
  readonly sector_id?: 'east' | 'north' | 'west' | 'south';
  readonly is_synthetic: true;
}

/**
 * Immutable descriptor for an individual pedestrian agent.
 */
export interface PreGeneratedAgentDescriptor {
  readonly agentIndex: number;
  readonly spawnTimeSimSec: number;        // Physical simulation time in seconds
  readonly initialConcourseX: number;      // Lateral spawn coordinate (px)
  readonly initialConcourseY: number;      // Longitudinal spawn coordinate (px)
  readonly defaultGateTarget: GateTargetId; // Initial assigned destination
  readonly walkingSpeedMps: number;        // Desired free-flow velocity (m/s)
  readonly physicalRadiusPx: number;       // Circular collision radius (px)
  readonly direction?: FlowDirection;      // 'inbound' (default) or 'outbound'
}

/**
 * Complete immutable schedule of pre-generated pedestrian arrivals.
 */
export interface PreGeneratedArrivalSchedule {
  readonly eventId: string;
  readonly seed: number;
  readonly populationScalingRatio: number;
  readonly totalAgentsToSpawn: number;
  readonly schedule: readonly PreGeneratedAgentDescriptor[];
}

/**
 * Mathematical validation response for scenario inputs.
 */
export interface ConfigValidationResult {
  readonly isValid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

/**
 * Scenario definition specification (declarative template).
 */
export interface ScenarioDefinition {
  readonly id: ScenarioId;
  readonly name: string;
  readonly subtitle: string;
  readonly category: 'operational' | 'stress_test' | 'emergency' | 'counterfactual';
  readonly description: string;
  readonly researchHypothesis: string;
  readonly defaultEvent: SyntheticEventConfigInput;
  readonly initialGeometryType: 'stadium' | 'bridge' | 'reversal';
  readonly defaultMitigations: {
    readonly bafflesActive: boolean;
    readonly auxGateActive: boolean;
    readonly dividerActive: boolean;
  };
}

// =========================================================================
// SURPRISE HURDLE — THREE-ZONE MONITORING TYPES
// =========================================================================

export type ZoneId = 'zone_gate' | 'zone_holding' | 'zone_upstream';

export interface ZoneMetrics {
  readonly zoneId: ZoneId;
  readonly name: string;
  readonly currentDensity: number;       // people / m²
  readonly peakDensity: number;          // Max observed density (p/m²)
  readonly averageSpeedMps: number;      // Mean velocity magnitude (m/s)
  readonly agentCount: number;           // Active pedestrians in zone
  readonly waitingAgentsCount: number;   // Agents with stuckTime > 0.5s
  readonly averageWaitingTimeSec: number;// Mean queue delay (s)
  readonly queueLengthMeters: number;    // Longitudinal queue extent (m)
  readonly observedThroughputPerMin: number; // Clearances / min
  readonly spillbackMeters: number;      // Upstream propagation from zone barrier (m)
  readonly areaM2: number;               // Zone calibrated area in m²
  readonly warningTriggered: boolean;    // True if density >= frictionThreshold
}

export interface ThreeZoneTelemetry {
  readonly gateApproach: ZoneMetrics;
  readonly intermediateHolding: ZoneMetrics;
  readonly upstreamArrival: ZoneMetrics;
  readonly systemMaxDensity: number;     // max(gate, holding, upstream)
  readonly timeIntegratedExposure: number; // Integral of (density - threshold)+ dt
  readonly timestampSec: number;
}

// =========================================================================
// SURPRISE HURDLE — BIDIRECTIONAL COUNTER-FLOW TYPES
// =========================================================================

export interface CounterflowConfig {
  readonly opposingFlowPercent: number; // 0%, 10%, 25%, 40%
  readonly measurementLineY: number;    // Mid-corridor Y coordinate (px)
  readonly enableSeparationBarrier: boolean;
}

export interface CounterflowTelemetry {
  readonly opposingFlowPercent: number;
  readonly inboundThroughputPerMin: number;
  readonly outboundThroughputPerMin: number;
  readonly totalCrossingCount: number;
  readonly averageInboundSpeedMps: number;
  readonly averageOutboundSpeedMps: number;
  readonly peakLocalDensity: number;
  readonly maxQueueLengthMeters: number;
  readonly baselineThroughputPerMin: number;
  readonly capacityReductionPercent: number;
  readonly operationalRecommendation: string;
}

// =========================================================================
// SURPRISE HURDLE — DISPLACEMENT DETECTOR TYPES
// =========================================================================

export interface PairedZoneComparison {
  readonly zoneId: ZoneId;
  readonly name: string;
  readonly baselinePeakDensity: number;
  readonly mitigatedPeakDensity: number;
  readonly densityDeltaPercent: number;
  readonly baselineQueueMeters: number;
  readonly mitigatedQueueMeters: number;
  readonly queueDeltaPercent: number;
  readonly baselineAvgSpeedMps: number;
  readonly mitigatedAvgSpeedMps: number;
  readonly speedDeltaPercent: number;
}

export interface DisplacementAnalysisResult {
  readonly verdict: DisplacementVerdict;
  readonly empiricalExplanation: string;
  readonly baselineSystemMaxDensity: number;
  readonly mitigatedSystemMaxDensity: number;
  readonly gateApproach: PairedZoneComparison;
  readonly intermediateHolding: PairedZoneComparison;
  readonly upstreamArrival: PairedZoneComparison;
  readonly operationalRecommendation: string;
  readonly confidenceScore: number;
}

// =========================================================================
// SURPRISE HURDLE — PHYSICS VALIDATION & FUNDAMENTAL DIAGRAM
// =========================================================================

export interface FundamentalDiagramPoint {
  readonly density: number; // rho (p/m²)
  readonly speed: number;   // v (m/s)
  readonly flow: number;    // J = rho * v (p/(m·s))
  readonly timestampSec: number;
}

export interface PhysicsValidationTelemetry {
  readonly isValidationModeActive: boolean;
  readonly currentJFlowRate: number;      // Pedestrian flow (p/(m·s))
  readonly currentDensityRho: number;     // Density (p/m²)
  readonly currentSpeedV: number;         // Velocity (m/s)
  readonly theoreticalJ: number;          // rho * v product
  readonly flowDecayObserved: boolean;    // True if flow drops as density rises past capacity
  readonly diagramHistory: readonly FundamentalDiagramPoint[];
}

// =========================================================================
// COMPREHENSIVE EXPERIMENT ANALYTICS
// =========================================================================

export interface DetailedSimulationAnalytics {
  readonly scenarioId: ScenarioId;
  readonly seed: number;
  readonly totalGeneratedAgents: number;
  readonly totalAdmittedAgents: number;
  readonly peakLocalDensity: number;
  readonly averageLocalDensity: number;
  readonly spillbackGateAMeters: number;
  readonly spillbackGateBMeters: number;
  readonly maxQueueSpillbackMeters: number;
  readonly averageWaitingTimeSeconds: number;
  readonly maximumWaitingTimeSeconds: number;
  readonly observedThroughputSimPerMin: number;
  readonly observedThroughputRepPerMin: number;
  readonly theoreticalCapacityRepPerMin: number;
  readonly capacityUtilizationRatio: number;
  readonly congestionEventsCount: number;
  readonly criticalHazardDurationSeconds: number;
  readonly simulationDurationSeconds: number;
  readonly actualFps: number;
  readonly threeZone?: ThreeZoneTelemetry;
}

export interface ComparisonDeltas {
  readonly peakDensityDelta: number;
  readonly peakDensityPercent: number;
  readonly spillbackDelta: number;
  readonly spillbackPercent: number;
  readonly waitingTimeDelta: number;
  readonly waitingTimePercent: number;
  readonly throughputDelta: number;
  readonly throughputPercent: number;
  readonly hazardDurationDelta: number;
  readonly hazardDurationPercent: number;
}

export interface ScenarioComparisonResult {
  readonly scenarioId: ScenarioId;
  readonly seed: number;
  readonly baseline: DetailedSimulationAnalytics;
  readonly mitigated: DetailedSimulationAnalytics;
  readonly deltas: ComparisonDeltas;
  readonly safetyVerdict: SafetyVerdict;
  readonly displacementResult?: DisplacementAnalysisResult;
  readonly empiricalExplanation: string;
}

export interface TripletScenarioComparisonResult {
  readonly scenarioId: ScenarioId;
  readonly seed: number;
  readonly baseline: DetailedSimulationAnalytics;
  readonly experimentA: DetailedSimulationAnalytics;
  readonly experimentB: DetailedSimulationAnalytics;
  readonly deltasA: ComparisonDeltas;
  readonly deltasB: ComparisonDeltas;
  readonly deltasBaffleOnly: ComparisonDeltas;
  readonly verdictA: SafetyVerdict;
  readonly verdictB: SafetyVerdict;
  readonly empiricalExplanation: string;
}
