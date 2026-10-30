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
  status: 'IDLE' | 'PROCESSING' | 'BLOCKED';
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
  selectedSector: 'EAST' | 'WEST' | 'NORTH' | 'SOUTH';
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
}

export type ScenarioType = 'stadium' | 'bridge' | 'reversal';

export interface ScenarioGeometry {
  walls: Wall[];
  gates: Gate[];
  baffles: Wall[];
  compounds?: GateCompound[];
  viewMode?: StadiumViewMode;
}
