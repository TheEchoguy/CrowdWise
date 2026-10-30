/**
 * CROWDWISE Predictive Crowd Digital Twin & Safety Lab
 * Scenario & Synthetic Data Engine: Type Definitions (v1.3)
 *
 * Provides strongly typed schemas for synthetic event demand,
 * discrete multi-lane turnstiles, immutable pre-generated arrival schedules,
 * configurable density/corridor assumptions, and 3-way paired ablation experiments.
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

export type SafetyVerdict =
  | 'Improvement'
  | 'Moderate Improvement'
  | 'Neutral'
  | 'Safety Degradation';

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
 * Separates physical corridor walkway throughput from turnstile scan capacity.
 * Source: UK Green Guide (6th Edition) & Fruin pedestrian transit manuals:
 * Specific flow rate Js ≈ 66 - 82 pedestrians / meter clear width / minute.
 */
export interface CorridorCapacityAssumptions {
  readonly downstreamCorridorWidthMeters: number; // Clear internal concourse width (meters)
  readonly specificFlowRatePerMeterMin: number;   // Normal specific flow (default: 75 p/(m·min))
}

/**
 * Discrete multi-lane gate configuration.
 * Authoritative single source for gate capacity calculations.
 */
export interface GateLaneConfig {
  readonly gateId: string;
  readonly name: string;
  readonly totalLanes: number;         // Total physical turnstile lanes installed
  readonly operationalLanes: number;   // Discrete active functioning lanes (0 <= operational <= total)
  readonly turnstileLatencySec: number;// Inspection/scan latency per person (seconds)
}

/**
 * Event-level parameters and attendance generation input.
 *
 * ATTENDANCE SEMANTICS:
 * - venueCapacity: Maximum physical occupancy of the venue (e.g. 50,000).
 * - ticketSalesPercentage: Ratio of tickets sold to venue capacity (e.g. 0.95 -> 47,500 tickets).
 * - attendancePercentage: Ratio of ticket holders who actually show up (default: 1.0 = 100%).
 * - expectedAttendance: ticketsSold * attendancePercentage (e.g. 47,500 * 1.0 = 47,500).
 * - maxSimulatedAgents: Cap on microscopic entities instantiated (default: 2,500).
 * - S_pop = expectedAttendance / simulatedAgents (e.g. 47,500 / 2,500 = 19.0).
 */
export interface SyntheticEventConfigInput {
  readonly eventId?: string;
  readonly eventName?: string;
  readonly venueCapacity: number;          // Real venue capacity (e.g., 50,000)
  readonly ticketSalesPercentage: number;  // 0.0 to 1.0 (e.g. 0.95 for 95%)
  readonly attendancePercentage?: number;  // 0.0 to 1.0 (default: 1.0 = 100% of ticket holders)
  readonly expectedAttendanceOverride?: number; // Optional direct specification of expected attendance
  readonly maxSimulatedAgents?: number;    // Capped at 2,500 for 60 FPS budget
  readonly arrivalStartTimeMin?: number;   // In minutes (default: 0)
  readonly arrivalEndTimeMin?: number;     // In minutes (default: 60)
  readonly arrivalDistribution: ArrivalPatternType;
  readonly gaussianPeakMin?: number;       // Peak minute for gaussian distribution (e.g. 25)
  readonly gaussianStdDevMin?: number;     // Standard deviation for gaussian distribution (in minutes)
  readonly targetPeakArrivalRateReal?: number; // Target peak arrival rate in real people/min (e.g. 1800)
  readonly burstIntervals?: readonly { readonly startMin: number; readonly endMin: number; readonly weight: number }[];
  readonly gateAShare: number;             // Proportion routed to Gate A (0.0 to 1.0)
  readonly gateBShare: number;             // Proportion routed to Gate B (0.0 to 1.0)
  readonly gates: Record<string, GateLaneConfig>;
  readonly randomSeed: number;
  readonly routingMode?: RoutingMode;      // Default: 'fixed'
  readonly densityThresholds?: DensityThresholdAssumptions;
  readonly corridorAssumptions?: CorridorCapacityAssumptions;
}

/**
 * Fully calculated and validated synthetic event dataset.
 */
export interface SyntheticEventData {
  readonly event_id: string;
  readonly event_name: string;
  readonly venue_capacity: number;           // Real venue physical capacity (e.g., 50,000)
  readonly tickets_sold: number;             // Real tickets sold (venue_capacity * ticketSalesPercentage)
  readonly attendance_percentage: number;    // Show-up rate (0.0 to 1.0, default: 1.0)
  readonly expected_attendance: number;      // Real expected attendees (tickets_sold * attendance_percentage)
  readonly simulated_agent_population: number; // Discrete entities instantiated in sim (<= 2,500)
  readonly population_scaling_ratio: number; // Real spectators represented per sim agent (S_pop)
  readonly arrival_start_time_min: number;   // In minutes
  readonly arrival_end_time_min: number;     // In minutes
  readonly arrival_distribution: ArrivalPatternType;
  readonly peak_arrival_rate_real: number;   // Real spectators per minute at peak
  readonly peak_arrival_rate_sim: number;    // Simulated agents per minute at peak
  readonly gate_A_share: number;             // Fraction of patrons targeting Gate A
  readonly gate_B_share: number;             // Fraction of patrons targeting Gate B
  readonly gates: Record<string, GateLaneConfig>;
  readonly random_seed: number;
  readonly routing_mode: RoutingMode;
  readonly density_thresholds: DensityThresholdAssumptions;
  readonly corridor_assumptions: CorridorCapacityAssumptions;
  readonly is_synthetic: true;               // Explicit marker distinguishing from real telemetry
}

/**
 * Immutable descriptor for an individual pedestrian agent.
 * Pre-computed before simulation begins to guarantee 100% paired reproducibility.
 */
export interface PreGeneratedAgentDescriptor {
  readonly agentIndex: number;
  readonly spawnTimeSimSec: number;        // Physical simulation time in seconds
  readonly initialConcourseX: number;      // Exact lateral spawn coordinate (px)
  readonly initialConcourseY: number;      // Exact longitudinal spawn coordinate (px)
  readonly defaultGateTarget: GateTargetId; // Initial assigned destination
  readonly walkingSpeedMps: number;        // Individual desired free-flow velocity (m/s)
  readonly physicalRadiusPx: number;       // Physical circular collision radius (px)
}

/**
 * Complete immutable schedule of pre-generated pedestrian arrivals.
 * Ingested identically by both Baseline and Mitigated counterfactual runs.
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
  readonly researchHypothesis: string;     // Empirical research hypothesis
  readonly defaultEvent: SyntheticEventConfigInput;
  readonly initialGeometryType: 'stadium' | 'bridge' | 'reversal';
  readonly defaultMitigations: {
    readonly bafflesActive: boolean;
    readonly auxGateActive: boolean;
    readonly dividerActive: boolean;
  };
}

/**
 * Comprehensive empirical simulation metrics calculated per run.
 */
export interface DetailedSimulationAnalytics {
  readonly totalGeneratedSim: number;
  readonly totalAdmittedSim: number;
  readonly representedAdmitted: number;
  readonly peakLocalDensity: number;               // Fruin local density (people/m²)
  readonly averageLocalDensity: number;            // Concourse spatial-temporal mean (people/m²)
  readonly spillbackGateAMeters: number;           // Longitudinal upstream queue Gate A (m)
  readonly spillbackGateBMeters: number;           // Longitudinal upstream queue Gate B (m)
  readonly maxQueueSpillbackMeters: number;        // Max(Spillback A, Spillback B) (m)
  readonly averageWaitingTimeSeconds: number;      // Mean turnstile queue delay (s)
  readonly maximumWaitingTimeSeconds: number;      // Maximum turnstile queue delay (s)
  readonly observedThroughputSimPerMin: number;    // Rolling 60s sim agents / min
  readonly observedThroughputRepPerMin: number;    // Rolling 60s represented people / min
  readonly theoreticalCapacityRepPerMin: number;   // Calculated max capacity (people / min)
  readonly capacityUtilizationRatio: number;       // (Observed / Theoretical) * 100%
  readonly congestionEventsCount: number;          // Hysteresis triggers (density >= threshold)
  readonly criticalHazardDurationSeconds: number; // Cumulative time density >= critical threshold (s)
  readonly simulationDurationSeconds: number;     // Physical simulation elapsed time (s)
  readonly actualFps: number;                      // Physics calculation frame rate
}

/**
 * Mathematical comparison deltas between two simulation runs.
 */
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

/**
 * Standard 2-way comparison result.
 */
export interface ScenarioComparisonResult {
  readonly scenarioId: ScenarioId;
  readonly seed: number;
  readonly baseline: DetailedSimulationAnalytics;
  readonly mitigated: DetailedSimulationAnalytics;
  readonly deltas: ComparisonDeltas;
  readonly safetyVerdict: SafetyVerdict;
  readonly empiricalExplanation: string;
}

/**
 * Scenario 6: 3-Way Paired Ablation Experiment Result.
 * Ingests the EXACT SAME immutable schedule for:
 * 1. Baseline: Gate B closed, Baffles off
 * 2. Experiment A: Gate B open, Baffles off (isolates Gate B reopening effect)
 * 3. Experiment B: Gate B open, Baffles on (isolates additional chicane wave-damping effect)
 */
export interface TripletScenarioComparisonResult {
  readonly scenarioId: ScenarioId;
  readonly seed: number;
  readonly baseline: DetailedSimulationAnalytics;   // Gate B closed, Baffles off
  readonly experimentA: DetailedSimulationAnalytics; // Gate B open, Baffles off
  readonly experimentB: DetailedSimulationAnalytics; // Gate B open, Baffles on
  readonly deltasA: ComparisonDeltas;                // Exp A vs Baseline (Gate B effect)
  readonly deltasB: ComparisonDeltas;                // Exp B vs Baseline (Combined effect)
  readonly deltasBaffleOnly: ComparisonDeltas;       // Exp B vs Exp A (Pure Baffle effect)
  readonly verdictA: SafetyVerdict;
  readonly verdictB: SafetyVerdict;
  readonly empiricalExplanation: string;
}
