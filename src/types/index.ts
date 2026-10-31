export interface Vector2D {
  x: number;
  y: number;
}

export type GateDirection = 'ENTRY' | 'EXIT' | 'BIDIRECTIONAL' | 'CLOSED' | 'EMERGENCY_ONLY';

export type GateStatus =
  | 'OPERATIONAL'
  | 'BUSY'
  | 'HIGH_CONGESTION'
  | 'ENTRY_RESTRICTED'
  | 'SCANNER_FAILURE'
  | 'TEMPORARILY_CLOSED'
  | 'EXIT_ONLY'
  | 'EMERGENCY_ONLY'
  | 'UNAVAILABLE';

export type StadiumSide = 'ALL' | 'NORTH' | 'WEST' | 'SOUTH' | 'EAST' | 'CUSTOM';

export type GateType = 'REGULAR' | 'VIP' | 'EXIT_ONLY';

export type CounterStatus = 'OPERATIONAL' | 'FAILED';

export interface ScannerCounter {
  id: string; // e.g. 'gate-e2-c1'
  name: string; // 'Counter 1'
  status: CounterStatus;
  serviceRatePerSec: number; // people per second
  totalProcessedCount: number;
  position?: Vector2D;
  isProcessing?: boolean;
  currentProcessingAgentId?: number;
  queueCount?: number;
}

export type OverflowDoorStatus = 'CLOSED' | 'OPENING' | 'OPEN' | 'CLOSING' | 'UNAVAILABLE';

export interface OverflowDoorConfig {
  enabled: boolean;
  status: OverflowDoorStatus;
  doorProgress: number; // 0.0 (fully closed) to 1.0 (fully open)
  highCongestionThreshold: number; // default: 60 people waiting per regular lane
  extremeCongestionThreshold: number; // default: 80 people waiting in each of the three lanes
  minSustainedExtremeSecs: number; // default: 5.0 seconds
  sustainedExtremeTimer: number; // live tracking seconds
  recoveryThreshold: number; // default: 40 people waiting per regular lane
  minRecoveryDurationSecs: number; // default: 5.0 seconds
  recoveryTimer: number; // live tracking seconds
  serviceRatePerSec: number; // default: 1.0 p/s (60 p/m)
  serviceRatePerMin: number; // 60 p/m
  queueCount: number; // live count waiting for overflow door
  processingCount: number; // live count being processed at overflow door
  totalProcessedCount: number; // total admitted through overflow door
  estimatedWaitSecs: number;
  timeSpentOpenSecs: number;
  activationReason?: string;
  isAuthorized: boolean;
  manualOverride?: 'AUTO' | 'FORCE_OPEN' | 'FORCE_CLOSED';
}

export type DemonstrationProfileType =
  | 'NORMAL'
  | 'HEAVY'
  | 'SURGE'
  | 'FAIL_1'
  | 'FAIL_2'
  | 'FAIL_ALL';

export function createDefaultOverflowDoor(gateId: string): OverflowDoorConfig {
  return {
    enabled: true,
    status: 'CLOSED',
    doorProgress: 0.0,
    highCongestionThreshold: 60,
    extremeCongestionThreshold: 80,
    minSustainedExtremeSecs: 5.0,
    sustainedExtremeTimer: 0.0,
    recoveryThreshold: 40,
    minRecoveryDurationSecs: 5.0,
    recoveryTimer: 0.0,
    serviceRatePerSec: 1.0,
    serviceRatePerMin: 60,
    queueCount: 0,
    processingCount: 0,
    totalProcessedCount: 0,
    estimatedWaitSecs: 0,
    timeSpentOpenSecs: 0.0,
    isAuthorized: true,
    manualOverride: 'AUTO',
  };
}

export interface GateLaneMetrics {
  laneIndex: number; // 0, 1, 2 for regular, 3 for overflow
  laneNumber: number; // 1, 2, 3, 4 (Overflow)
  counterId: string;
  counterName: string;
  counterStatus: CounterStatus | OverflowDoorStatus;
  waitingCount: number;
  processingCount: number;
  totalLaneCount: number;
  serviceRatePerSec: number;
  serviceRatePerMin: number;
  throughputPerMin: number;
  estimatedWaitSecs: number;
  counterUtilization: number;
  laneCapacity: number;
  laneOccupancyPercent: number;
  congestionStatus: 'OPTIMAL' | 'MODERATE' | 'CONGESTED' | 'OVERFLOW';
  totalAdmitted: number;
  laneSwitchesIn: number;
  laneSwitchesOut: number;
}

export type GateOperationalControlState =
  | 'NORMAL'
  | 'QUEUE_BUILDING'
  | 'CONGESTED'
  | 'ADMISSION_METERING'
  | 'ADMISSION_PAUSED'
  | 'RECOVERY';

export type GateAdmissionScheduleMode = 'RATE' | 'BATCHES';

export interface GateArrivalSchedule {
  mode: GateAdmissionScheduleMode;
  arrivalRatePerMin: number;
  batchSize?: number;
  batchIntervalMins?: number;
  totalBatches?: number;
  batchesCompleted?: number;
}

export interface Gate {
  id: string;
  name: string;
  position: Vector2D;
  width: number; // in meters
  direction: GateDirection;
  scannerCount: number;
  operationalScanners: number;
  scannerProcessingRatePerMin: number; // people per scanner per minute
  physicalPassageCapacityPerMin: number;
  currentQueue: number;
  queueWaitTimeSecs: number;
  status: GateStatus;
  warningLevel: 'NORMAL' | 'WATCH' | 'HIGH' | 'CRITICAL';
  downstreamCorridorId?: string;
  externalApproachId?: string;
  failureDurationSecs?: number;
  suggestedAction?: string;
  scannerProcessingRatePerSec?: number;
  initialQueue?: number;
  totalArrivalsCount?: number;
  totalProcessedCount?: number;
  admittedCount?: number;
  currentArrivalRatePerMin?: number;
  actualProcessingRatePerMin?: number;
  effectiveCapacityPerMin?: number;
  counterUtilizationPercent?: number;
  maxQueueRecorded?: number;
  queueAreaCapacity?: number;
  spillbackCount?: number;
  redirectedCount?: number; // count of redirected pedestrians received
  deflectedCount?: number; // count of pedestrians deflected away due to failure/closure
  assignedIncomingDemand?: number; // count of pedestrians currently approaching this gate
  isReroutingActive?: boolean;
  unavailabilityReason?: string;

  // 12-Gate Ticket-Restricted System additions
  stadiumSide?: StadiumSide;
  gateType?: GateType;
  counters?: ScannerCounter[];
  assignedSpectatorCount?: number;
  holdingAreaCapacity?: number;
  holdingAreaOccupancy?: number;
  holdingAreaPosition?: Vector2D;
  maxSafeQueueOccupancy?: number;
  operationalControlState?: GateOperationalControlState;
  arrivalSchedule?: GateArrivalSchedule;
  inHoldingCount?: number;
  waitingInQueueCount?: number;
  processingCount?: number;
  remainingToArriveCount?: number;
  strictTicketEnforcement?: boolean;
  spawnPosition?: Vector2D;
  arrivalRatePerMin?: number;
  counter1QueueCount?: number;
  counter2QueueCount?: number;
  counter3QueueCount?: number;
  queueGrowthRatePerMin?: number;
  estimatedClearanceTimeSecs?: number;
  laneMetrics?: GateLaneMetrics[];
  totalLaneSwitches?: number;
  laneBalancingEnabled?: boolean;
  overflowDoor?: OverflowDoorConfig;
  isArrivalsPaused?: boolean;
  approachingCount?: number;
  demonstrationProfile?: DemonstrationProfileType;
}

export type ZoneRiskLevel = 'NORMAL' | 'WATCH' | 'HIGH_CONGESTION' | 'CRITICAL';

export type ZoneCategory =
  | 'EXTERNAL_PLAZA'
  | 'APPROACH_ROAD'
  | 'CONCOURSE'
  | 'SEATING'
  | 'FIELD'
  | 'STAGE_ZONE'
  | 'CORRIDOR'
  | 'HOLDING_AREA'
  | 'SHELTER';

export interface Zone {
  id: string;
  name: string;
  polygon: Vector2D[];
  usableAreaSqM: number;
  maxRecommendedDensity: number; // people / m^2
  currentPopulation: number;
  currentDensity: number; // people / m^2
  inflowRatePerMin: number;
  outflowRatePerMin: number;
  avgMovementSpeed: number; // m/s
  riskLevel: ZoneRiskLevel;
  category: ZoneCategory;
  warningDurationSecs: number;
}

export interface Corridor {
  id: string;
  name: string;
  start: Vector2D;
  end: Vector2D;
  width: number;
  fromZoneId: string;
  toZoneId: string;
  maxCapacityPerMin: number;
  isBlocked: boolean;
  isEmergencyRoute: boolean;
  currentFlowPerMin: number;
}

export interface Obstacle {
  id: string;
  name: string;
  polygon: Vector2D[];
}

export interface MedicalPoint {
  id: string;
  name: string;
  position: Vector2D;
  capacity: number;
  activePatients: number;
}

export interface AttractionPoint {
  id: string;
  name: string;
  position: Vector2D;
  category: 'STAGE' | 'PODIUM' | 'FOOD_STALL' | 'MERCH' | 'INFO_DESK';
}

export interface ApproachRoute {
  id: string;
  name: string;
  startPoint: Vector2D;
  entryGateIds: string[];
  sharePercentage: number; // percentage of incoming crowd
  width: number;
}

export interface Venue {
  id: string;
  name: string;
  description: string;
  dimensions: { width: number; height: number }; // meters
  seatingCapacity: number;
  planningCapacity: number;
  gates: Gate[];
  zones: Zone[];
  corridors: Corridor[];
  obstacles: Obstacle[];
  medicalPoints: MedicalPoint[];
  attractions: AttractionPoint[];
  approachRoutes: ApproachRoute[];
  sourceAttribution?: {
    text: string;
    links: { label: string; url: string }[];
  };
}

export type AgentState =
  | 'APPROACHING'
  | 'QUEUING'
  | 'PROCESSING'
  | 'HOLDING'
  | 'ADMITTED'
  | 'INSIDE'
  | 'EN_ROUTE_DESTINATION'
  | 'WAITING_ATTRACTION'
  | 'REROUTING'
  | 'LEAVING'
  | 'STATIONARY'
  | 'DIVERTED'
  | 'ASSISTANCE_REQUIRED';

export interface CrowdAgent {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetX: number;
  targetY: number;
  preferredSpeed: number; // m/s (1.0 to 1.5)
  radius: number; // pedestrian body radius (~0.3m)
  state: AgentState;
  targetGateId?: string;
  targetZoneId?: string;
  pathWaypoints: Vector2D[];
  currentWaypointIdx: number;
  shirtColor: string;
  skinColor: string;
  stridePhase: number;
  facingAngle: number;
  arrivalTime: number;
  waitDurationSecs: number;
  enteredTime?: number;
  groupId?: number;
  requiresAssistance?: boolean;
  lastRerouteTime?: number;
  rerouteCount?: number;
  originalTargetGateId?: string;
  isRerouted?: boolean;
  ticketGateId?: string;
  permittedAlternativeGateIds?: string[];
  inHoldingArea?: boolean;
  assignedCounterId?: string;
  assignedGateId?: string;
  assignedLane?: number; // 0, 1, or 2 for Counter 1, 2, or 3
  lastLaneSwitchTime?: number;
  laneSwitchCount?: number;
  isSwitchingLane?: boolean;
  switchSourceLane?: number;
}

export type IncidentType =
  | 'MEDICAL'
  | 'SCANNER_FAILURE'
  | 'GATE_CLOSURE'
  | 'CORRIDOR_BOTTLENECK'
  | 'STAGE_SURGE'
  | 'EXTERNAL_OVERFLOW'
  | 'DEPARTURE_SURGE'
  | 'BLOCKED_ROUTE'
  | 'WEATHER_RAIN';

export type IncidentStatus =
  | 'REPORTED'
  | 'ACKNOWLEDGED'
  | 'ROUTE_CALCULATED'
  | 'ROUTE_OBSTRUCTED'
  | 'IN_PROGRESS'
  | 'RESOLVED';

export interface Incident {
  id: string;
  title: string;
  type: IncidentType;
  position: Vector2D;
  zoneId?: string;
  gateId?: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: IncidentStatus;
  timestamp: number;
  description: string;
  suggestedAction: string;
  responderPath?: Vector2D[];
  assignedMedicalPointId?: string;
}

export type ArrivalPatternType =
  | 'GRADUAL'
  | 'PEAK_SURGE'
  | 'BURST'
  | 'MULTIPLE_WAVES'
  | 'TRANSPORT_PULSE';

export interface InflowConfig {
  estimatedAttendance: number;
  eventStartTimeMinutes: number; // minutes from sim start (e.g. 60 mins)
  arrivalDurationMinutes: number;
  pattern: ArrivalPatternType;
  burstIntensity: number; // 1 to 5 multiplier
  transportPulseIntervalMinutes: number;
  unexpectedCrowdAddition: number; // un-ticketed external crowd
}

export interface Intervention {
  id: string;
  name: string;
  description: string;
  category:
    | 'REGULATE_ADMISSION'
    | 'OPEN_HOLDING_AREA'
    | 'STAGGER_INFLOW'
    | 'REROUTE_APPROACH'
    | 'ADMISSION_PAUSE'
    | 'SPARE_SCANNERS'
    | 'PHASED_DEPARTURE'
    | 'EARLY_PUBLIC_COMMUNICATION';
  isActive: boolean;
  params: Record<string, any>;
}

export interface ScenarioDefinition {
  id: string;
  name: string;
  category: string;
  description: string;
  venueId: string;
  initialConditions: string;
  triggerTimeSecs: number;
  parameters: Record<string, any>;
  expectedRisks: string[];
  recommendedInterventions: string[];
  completionCriteria: string;
  factualBackground?: string;
}

export interface SimulationEvent {
  id: string;
  timestamp: number; // simulation seconds
  timeFormatted: string;
  type: 'INFO' | 'WARNING' | 'CRITICAL' | 'INCIDENT' | 'INTERVENTION' | 'GATE';
  location: string;
  description: string;
  suggestedAction?: string;
  gateId?: string;
  zoneId?: string;
}

export interface OperatorRecommendation {
  id: string;
  timestamp: number;
  title: string;
  problem: string;
  location: string;
  cause: string;
  supportingMetrics: string;
  proposedAction: string;
  possibleSideEffects: string;
  approved: boolean;
}

export interface PublicAnnouncement {
  id: string;
  timestamp: number;
  title: string;
  audience: 'PUBLIC_LED' | 'STAFF_RADIO' | 'MEGAPHONE' | 'APP_NOTIFICATION';
  category: 'NORMAL' | 'CONGESTION' | 'REROUTE' | 'PAUSE' | 'EMERGENCY';
  text: string;
  broadcasted: boolean;
  editable: boolean;
}

export interface SimulationMetricsSummary {
  simTimeSecs: number;
  totalArrived: number;
  totalInside: number;
  totalOutside: number;
  totalDeparted: number;
  totalTurnedAway: number;
  peakQueueLength: number;
  maxZoneDensity: number;
  avgWaitTimeSecs: number;
  maxWaitTimeSecs: number;
  externalHoldingOccupancy: number;
  activeWarningsCount: number;
  blockedRoutesCount: number;
  activeIncidentsCount: number;
  arrivalRatePerMin: number;
  gateThroughputPerMin: number;
  destinationReachedCount: number;
  totalAdmitted?: number;
  totalWaitingOutside?: number;
  totalProcessing?: number;
  totalRedirectedCount?: number;
  unavailableGatesCount?: number;
  totalAvailableCapacityPerMin?: number;
  demandToCapacityRatio?: number;
  unservedDemandCount?: number;
  affectedPedestriansCount?: number;
  totalInHolding?: number;
  totalAssigned?: number;
}

export interface GateEntrySnapshot {
  timestamp: number; // simulation seconds
  timeFormatted: string; // mm:ss
  gateEntries: Record<string, number>; // gateId -> cumulative admitted count
  totalAdmitted: number;
}

export type ZoneComparisonStatus =
  | 'RELIEVED'
  | 'UNCHANGED'
  | 'WORSENED'
  | 'NEW_HOTSPOT';

export interface ZoneComparisonResult {
  zoneId: string;
  zoneName: string;
  category: ZoneCategory;
  usableAreaSqM: number;
  maxRecommendedDensity: number;
  baselineDensity: number;
  baselinePopulation: number;
  baselineRisk: ZoneRiskLevel;
  interventionDensity: number;
  interventionPopulation: number;
  interventionRisk: ZoneRiskLevel;
  deltaDensity: number; // interventionDensity - baselineDensity
  deltaPopulation: number; // interventionPopulation - baselinePopulation
  status: ZoneComparisonStatus;
  description: string;
}

export interface SpatialInterventionSummary {
  totalZonesEvaluated: number;
  relievedZonesCount: number;
  unchangedZonesCount: number;
  worsenedZonesCount: number;
  newHotspotCount: number;
  worstDensityIncrease: {
    zoneId: string;
    zoneName: string;
    deltaDensity: number;
    finalDensity: number;
  } | null;
  largestRelief: {
    zoneId: string;
    zoneName: string;
    deltaDensity: number;
    finalDensity: number;
  } | null;
  riskTransferred: boolean;
  originalHotspotRelieved: boolean;
  plainLanguageSummary: string;
  spatialVerdict: 'IMPROVED' | 'TRANSFERRED_RISK' | 'CRITICAL_CONCERN' | 'BALANCED';
}

export interface CounterfactualComparison {
  id: string;
  name: string;
  scenarioId: string;
  seed: number;
  timestamp: string;
  baseline: SimulationMetricsSummary;
  interventionPlan: SimulationMetricsSummary;
  interventionsApplied: string[];
  tradeOffAnalysis: {
    benefit: string;
    downstreamRisk: string;
    verdict: 'IMPROVED' | 'TRANSFERRED_RISK' | 'CRITICAL_CONCERN' | 'BALANCED';
  };
  zoneComparisons: ZoneComparisonResult[];
  spatialSummary: SpatialInterventionSummary;
}

export interface RenderLayers {
  venueLayout: boolean;
  animatedCrowd: boolean;
  densityHeatmap: boolean;
  spatialComparison: boolean;
  flowArrows: boolean;
  queueVisuals: boolean;
  gateStatus: boolean;
  emergencyRoutes: boolean;
  incidentMarkers: boolean;
  riskZones: boolean;
  gridReference: boolean;
}

export type RenderDetailLevel = 'DETAILED' | 'SIMPLIFIED' | 'DENSITY_ONLY';

export type GateRoutingPolicy =
  | 'SHORTEST_QUEUE'
  | 'LEAST_WAIT_TIME'
  | 'ROUTE_AWARE'
  | 'FIXED_ALLOCATION';

export interface GateSideSimConfig {
  selectedSide: StadiumSide;
  selectedGateIds: string[];
  inflowRatePerMin: number;
  arrivalPattern: ArrivalPatternType;
  processingRatePerSec: number; // people per second per active scanner (e.g. 1.0)
  scannerCountOverride?: number;
  operationalScannersOverride?: number;
  initialQueue: number;
  routingPolicy: GateRoutingPolicy;
  spillbackThreshold: number; // queue count before spillback outside queue pen
  durationSecs: number;
}

export interface GateSideEvent {
  id: string;
  timestamp: number;
  timeFormatted: string;
  type:
    | 'INFLOW_CHANGE'
    | 'COUNTER_FAILURE'
    | 'COUNTER_RESTORED'
    | 'GATE_CLOSED'
    | 'GATE_OPENED'
    | 'SPILLBACK'
    | 'DOWNSTREAM_HOLD'
    | 'CONFIG_CHANGE';
  message: string;
}

// ============================================================================
// MODULE 1: GATE CLOSURE & RECOVERY MANAGEMENT TYPES
// ============================================================================
export type GateClosureReason =
  | 'SECURITY'
  | 'OBSTRUCTION'
  | 'STRUCTURAL'
  | 'CONGESTION'
  | 'SCANNER_FAILURE'
  | 'OPERATOR_DIRECTIVE';

export type GateClosureState =
  | 'OPERATIONAL'
  | 'DEGRADED'
  | 'CLOSURE_INITIATED'
  | 'CLOSED'
  | 'RECOVERY_CHECK'
  | 'REOPENING'
  | 'OPERATIONAL_AFTER_RECOVERY';

export type GateClosureScenarioType =
  | 'FAIL_1_COUNTER'
  | 'FAIL_2_COUNTERS'
  | 'FAIL_3_COUNTERS'
  | 'FULL_CLOSURE_SECURITY'
  | 'FULL_CLOSURE_OBSTRUCTION'
  | 'FULL_CLOSURE_STRUCTURAL'
  | 'FULL_CLOSURE_CONGESTION'
  | 'TEMPORARY_CLOSURE_RECOVERY';

export interface AlternativeGateEvaluation {
  gateId: string;
  gateName: string;
  isAuthorized: boolean;
  isAccessible: boolean;
  walkingDistanceM: number;
  currentQueue: number;
  operationalCapacity: number;
  estimatedWaitSecs: number;
  recommendationScore: number; // 0 to 100
  rejectionReason?: string;
}

export interface GateClosureIncidentRecord {
  incidentId: string;
  gateId: string;
  gateName: string;
  state: GateClosureState;
  reason: GateClosureReason;
  initiatedAtSimTime: number;
  recoveredAtSimTime?: number;
  closureDurationSecs: number;
  affectedQueuersCount: number;
  divertedToHoldingCount: number;
  reroutedToAlternativeCount: number;
  overflowDoorAllowed: boolean;
  recoveryChecklist: {
    scannersVerified: boolean;
    obstructionCleared: boolean;
    securityAuthorized: boolean;
    structureApproved: boolean;
    congestionReduced: boolean;
  };
}

// ============================================================================
// MODULE 2: CROWD MODEL CALIBRATION & VALIDATION TYPES
// ============================================================================
export type ValidationMetricType =
  | 'WALKING_SPEED'
  | 'SPEED_VS_DENSITY'
  | 'PEDESTRIAN_DENSITY'
  | 'PASSAGE_FLOW_RATE'
  | 'QUEUE_GROWTH_RATE'
  | 'QUEUE_DISCHARGE_RATE'
  | 'COUNTER_SERVICE_TIME'
  | 'AVERAGE_WAIT_TIME'
  | 'COUNTERFLOW_SPEED_REDUCTION'
  | 'BOTTLENECK_THROUGHPUT'
  | 'TRAVEL_TIME'
  | 'INFLOW_OUTFLOW_BALANCE';

export type ReferenceDatasetSource =
  | 'PUBLISHED_REFERENCE'
  | 'MEASURED_REAL_WORLD'
  | 'USER_ENTERED'
  | 'SYNTHETIC_TEST';

export interface ReferenceDataset {
  id: string;
  name: string;
  metric: ValidationMetricType;
  referenceValue?: number;
  referenceRange?: [number, number];
  unit: string;
  sourceTitle: string;
  sourceOrganization: string;
  publicationDate: string;
  sourceUrl?: string;
  measurementConditions: string;
  geometryOrPassageWidth?: string;
  densityConditions?: string;
  dataLimitations: string;
  sourceType: ReferenceDatasetSource;
}

export interface ValidationComparisonResult {
  metric: ValidationMetricType;
  metricLabel: string;
  simulatedValue: number;
  referenceValue: number;
  referenceRange?: [number, number];
  difference: number;
  absoluteError: number;
  percentageError?: number;
  isWithinReferenceRange: boolean;
  unit: string;
  sampleSize: number;
  provenance: string;
  evaluationStatus: 'PASS' | 'DEVIATION' | 'UNVALIDATED';
}

export interface ModelCalibrationParameters {
  preferredSpeed: number; // m/s
  socialRepulsionStrength: number;
  personalSpaceRadius: number;
  densitySpeedSensitivity: number;
  counterServiceRate: number; // p/s
  laneSwitchSensitivity: number;
}

// ============================================================================
// MODULE 3: MULTI-DIRECTIONAL CROWD FLOW TYPES
// ============================================================================
export type MultiDirectionalPresetType =
  | 'INBOUND_ONLY'
  | 'INBOUND_VS_OUTBOUND'
  | 'TWO_CROSSING_FLOWS'
  | 'HEAVY_BIDIRECTIONAL'
  | 'NARROW_CORRIDOR_COUNTERFLOW'
  | 'COUNTERFLOW_DIRECTIONAL_SEPARATION'
  | 'COUNTERFLOW_CONTROLLED_ARRIVALS'
  | 'COUNTERFLOW_ROUTE_REDISTRIBUTION';

export type StreamInterventionType =
  | 'NONE'
  | 'DIRECTIONAL_LANES'
  | 'METERED_INFLOW'
  | 'ROUTE_REDISTRIBUTION'
  | 'TIME_BASED_ALTERNATION';

export interface PedestrianStreamConfig {
  id: string;
  name: string;
  color: string;
  origin: Vector2D;
  destination: Vector2D;
  spawnRatePerMin: number;
  totalPedestrians: number;
  preferredSpeedMean: number;
  activeCount: number;
  completedCount: number;
  stalledCount: number;
  averageSpeed: number;
}

export interface MultiDirectionalMetrics {
  simTimeSecs: number;
  totalActive: number;
  totalCompleted: number;
  totalStalled: number;
  counterflowFrictionIndex: number;
  passageThroughputPerMin: number;
  streamMetrics: {
    streamId: string;
    streamName: string;
    activeCount: number;
    completedCount: number;
    avgSpeed: number;
    avgTravelTimeSecs: number;
    stalledCount: number;
    throughputPerMin?: number;
  }[];
}

// ============================================================================
// MODULE 4: SPATIAL RISK PROPAGATION & COUNTERFACTUAL TYPES
// ============================================================================
export interface SpatialZoneRiskSummary {
  zoneId: string;
  zoneName: string;
  category: ZoneCategory;
  usableAreaSqM: number;
  maxRecommendedDensity: number;
  currentOccupancy: number;
  currentDensity: number;
  maxDensityRecorded: number;
  durationAtElevatedRiskSecs: number;
  inflowRatePerMin: number;
  outflowRatePerMin: number;
  netAccumulationRate: number;
  riskLevel: ZoneRiskLevel;
  isHotspot: boolean;
  isSecondaryHotspot: boolean;
  riskTransferSourceZoneId?: string;
  connectedZoneIds: string[];
}

export interface HotspotPropagationPrediction {
  sourceHotspotZoneId: string;
  sourceHotspotZoneName: string;
  predictedImpactedZoneIds: string[];
  predictedImpactedZoneNames: string[];
  estimatedSpilloverRatePerMin: number;
  hasCapacityForSpillover: boolean;
  predictedSecondaryHotspot: boolean;
  explanation: string;
  confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW';
}

export type CounterfactualRunMode =
  | 'BASELINE'
  | 'PROPOSED_INTERVENTION'
  | 'ALTERNATIVE_INTERVENTION';

export interface CounterfactualComparisonSummary {
  scenarioId: string;
  scenarioName: string;
  simTimeSecs: number;
  baselineMaxRisk: ZoneRiskLevel;
  proposedMaxRisk: ZoneRiskLevel;
  alternativeMaxRisk: ZoneRiskLevel;
  transferredRiskDetected: boolean;
  transferredRiskDetails: string;
  newHotspotZoneNames: string[];
  relievedZoneNames: string[];
  worsenedZoneNames: string[];
  overallVerdict: 'NET_IMPROVEMENT' | 'TRANSFERRED_RISK' | 'INEFFECTIVE' | 'MIXED';
}
