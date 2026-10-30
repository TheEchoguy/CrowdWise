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

export type StadiumSide = 'ALL' | 'NORTH' | 'WEST' | 'SOUTH' | 'EAST' | 'CUSTOM';

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
