/**
 * CROWDWISE Predictive Crowd Digital Twin & Safety Lab
 * Upgraded Incident Mitigation Twin Simulation Types
 */

export interface Wall {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  thickness?: number;
  color?: string;
  type?: 'boundary' | 'funnel' | 'barrier' | 'divider' | 'baffle';
  label?: string;
}

export interface SecurityCounter {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  isOccupied: boolean;
  occupantAgentId: number | null;
  processingRemaining: number; // in seconds
  totalProcessed: number;
  status: 'IDLE' | 'PROCESSING' | 'BLOCKED' | 'DISABLED';
  serviceProgress?: number; // 0.0 to 1.0 for visual progress ring/bar
}

export interface OuterGateState {
  id: string; // E1 to E23
  road: RoadSectorId;
  x: number;
  y: number;
  approachVector: { dx: number; dy: number };
  active: boolean;
  inflowShare: number;
  bufferCapacity: number;
  queueCount: number;
  admittedTotal: number;
  status: 'OPEN' | 'CONGESTED' | 'CLOSED';
  connectedInnerGates: string[];
}

export interface InnerGateBankState {
  id: string; // G1 to G14
  standName: string;
  sector: RoadSectorId;
  x: number;
  y: number;
  turnstileCount: number;
  activeCounters: number;
  counters: SecurityCounter[];
  queueCount: number;
  status: 'NORMAL' | 'WARNING' | 'CRITICAL' | 'BLOCKED';
  averageWaitTimeSec: number;
  maxWaitTimeSec: number;
  theoreticalCapacityPerMin: number;
  observedThroughputPerMin: number;
  rejectionRate: number; // e.g. 0.08 (8%)
}

export interface ThreeZoneMetrics {
  zoneA_ArrivalRoadDensity: number;      // Density on public roadway / sidewalk (p/m²)
  zoneA_SpillbackMeters: number;         // Queue spillback into traffic
  zoneB_HoldingConcourseDensity: number; // Density in concourse / S-queue
  zoneB_CounterFlowConflicts: number;    // Counter-flow collision occurrences
  zoneC_InnerThroatDensity: number;      // Density directly at turnstile throats
  zoneC_AdmissionThroughput: number;     // Admitted people/minute
  displacedZone: 'NONE' | 'ZONE_A_ROAD' | 'ZONE_B_CONCOURSE' | 'ZONE_C_THROAT';
}

export interface GateCompound {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  active: boolean;
  scanBarY: number; // Y-coordinate of 0.2s automated tap line
  counters: SecurityCounter[]; // Dynamic list of 1.0s counters
}

export interface Gate {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  cooldown: number;
  active: boolean;
  name?: string;
  totalPassed?: number;
  maxCooldown?: number;
  sector?: 'EAST' | 'WEST' | 'NORTH' | 'SOUTH';
  gateNumber?: number;
  compound?: GateCompound;
}

export interface AgentData {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  targetX: number;
  targetY: number;
  density: number;
  stuckTime: number;
  color: string;
  isReverse?: boolean;
  desiredSpeed?: number;
  maxSpeed?: number;
  active?: boolean;
  compressivePressure: number; // Force accumulated from rear agents pushing (Phase 2)
  assignedSector?: 'EAST' | 'WEST' | 'NORTH' | 'SOUTH';
  sectorRoad?: RoadSectorId;
  targetOuterGate?: string;
  targetInnerGate?: string;
  isRejected?: boolean;
  isVipMedia?: boolean;
  friskingRemaining?: number;
  turnstileScanRemaining?: number;

  // Active Incident Mitigation Extensions:
  waypoints?: { x: number; y: number }[];
  currentWaypointIndex: number;
  assignedGateId: string;
  stage?: 1 | 2 | 3; // 1: S-curve Queue, 2: 0.2s NFC Scan Tap, 3: 1.0s Security Screening Counter
  assignedCounterId?: number | null;
  nfcTapRemaining?: number;
  entryTime?: number;
  isCleared?: boolean;
  clearanceAlpha?: number; // for smooth fade-out (1.0 -> 0.0)
  isClearedConcourse?: boolean;
  concourseDispersalTarget?: { x: number; y: number };
}

export type StadiumViewMode = 'MACRO_VIEW' | 'MICRO_VIEW_EAST';
export type StadiumSectorId = 'EAST' | 'WEST' | 'NORTH' | 'SOUTH';
export type RoadSectorId = 'CUBBON_ROAD' | 'LINK_ROAD' | 'MG_ROAD' | 'QUEENS_ROAD';
export type AppViewMode = 'MACRO_STADIUM' | 'SECTOR_CONCOURSE';
export type SimulationDisplayMode = 'FULL_STADIUM' | 'SECTOR_VIEW' | 'GATE_VIEW';
export type ActiveGateSector = 'G1-G6_EAST' | 'G7-G11_SOUTH' | 'G12-G15_WEST' | 'G16-G21_NORTH';
export type MatchPhase = 'PRE_GATES' | 'METRO_PEAK' | 'ANTHEM_RUSH' | 'EGRESS';

export interface GateOperationalMetric {
  queueCount: number;
  density: number;
  inflowRate: number;
  capacity: number;
  activeCounters?: number;
  status: 'NORMAL' | 'WARNING' | 'CRITICAL';
}

export interface ActiveRerouteAlert {
  sourceGate: string;
  targetGate: string;
  diversionPercentage: number;
  message: string;
}

export interface BurstRateAnalysis {
  excessPeoplePerMin: number;
  timeToGridlockSeconds: number | null;
}

export interface TelemetryState {
  peakDensity: number;                                // Maximum local density (p/m²)
  spillbackMeters: number;                            // Queue spillback from primary bottleneck (meters)
  throughputPerMin: number;                           // Clearances per minute
  liveAgents: number;                                 // Active pedestrians on map
  fps: number;                                        // Rendering/physics frame rate
  isCritical: boolean;                                // True when peakDensity >= 5.0
  timeToTurbulence: number | null;                    // Estimated seconds until density exceeds 5.0 p/m²
  densityTrend: 'rising' | 'stable' | 'clearing';      // Real-time density trend
  activeArrivalProfile: 'steady' | 'burst' | 'reversal'; // Synthetic arrival mode

  // Chinnaswamy Stadium Digital Twin Telemetry
  stadiumFillPercentage: number;                      // 0 - 100% capacity filled
  estimatedTimeToFillHours: number;                   // Hours until 35,000 capacity
  crushProbabilityIndex: number;                      // 0 to 100% composite crush index
  selectedSector: StadiumSectorId | RoadSectorId;
  metroBurstActive: boolean;                          // Namma Metro mass transit pulse indicator

  // Active Incident Mitigation Metrics:
  gateMetrics: Record<string, GateOperationalMetric>;
  activeRerouteAlert: ActiveRerouteAlert | null;
  burstRateAnalysis: BurstRateAnalysis;

  // Real-Time Security Gantry & Multi-Stage Metrics:
  activeCountersCount: number;
  averageWaitTimeSec: number;
  fastScanThroughput: number;
  securityCheckThroughput: number;

  // Real-World Physics Hurdle Audit Metrics & Three-Zone Monitoring:
  counterFlowPenaltyPercent: number;                  // Throughput penalty (e.g. -38% due to reverse flow)
  zoneADensity: number;                               // Zone A: Roadway / sidewalk arrival density (p/m²)
  zoneBDensity: number;                               // Zone B: Holding concourse / S-queue density (p/m²)
  zoneCDensity?: number;                              // Zone C: Turnstile throat local density (p/m²)
  threeZones?: ThreeZoneMetrics;                      // Structured three-zone analysis
  displacedZone?: 'NONE' | 'ZONE_A_ROAD' | 'ZONE_B_CONCOURSE' | 'ZONE_C_THROAT';
  displacedCrushAdvisory: string | null;              // Warning if metering moves danger upstream
  fruinLOS: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';         // Fruin Level of Service (1971)
  counterFlowActive: boolean;                         // True if reverse stream active
  outerGateMetrics?: Record<string, OuterGateState>;   // E1 - E23 telemetry
  innerBankMetrics?: Record<string, InnerGateBankState>; // G1 - G14 telemetry
}

export type ScenarioType = 'stadium' | 'bridge' | 'reversal';

export interface ScenarioGeometry {
  walls: Wall[];
  gates: Gate[];
  baffles: Wall[];
  compounds?: GateCompound[];
  viewMode?: StadiumViewMode;
}
