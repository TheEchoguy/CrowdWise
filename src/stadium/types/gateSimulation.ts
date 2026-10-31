/**
 * CROWDWISE — Phase 2.2: Simplified Gate Simulation & Point-Cloud Types
 * M. Chinnaswamy Stadium, Bengaluru
 *
 * Simplified 2-Stage Verification:
 * OUTER GATE -> APPROACH CORRIDOR -> HOLDING/QUEUES -> TICKET SCAN -> PERSON CHECK -> TURNSTILE -> VOMITORY -> STAND
 */

export type MicroAgentState =
  | 'ARRIVING'
  | 'WAITING_IN_QUEUE'
  | 'TICKET_SCANNING'
  | 'TICKET_VALIDATED'
  | 'PERSON_CHECKING'
  | 'PERSON_VERIFIED'
  | 'WAITING_FOR_TURNSTILE'
  | 'TURNSTILE_WAITING'
  | 'TURNSTILE_PROCESSING'
  | 'ADMITTED'
  | 'VOMITORY_DISPERSAL'
  | 'DESTINATION_STAND'
  | 'REJECTED'
  | 'DIVERTED'
  | 'EXITED';

export type TicketValidationResult =
  | 'VALID'
  | 'INVALID_QR'
  | 'DUPLICATE'
  | 'EXPIRED'
  | 'WRONG_STAND'
  | 'WRONG_GATE'
  | 'SCANNER_MALFUNCTION';

export type PersonCheckResult =
  | 'VERIFIED'
  | 'MISMATCH'
  | 'MANUAL_REVIEW_REQUIRED'
  | 'STATION_UNAVAILABLE';

export interface SecurityScreeningStationState {
  id: string;
  name: string;
  x: number;
  y: number;
  status: string;
  currentAgentId: number | null;
  screeningRemainingSec: number;
  nominalLatencySec: number;
  totalInspected: number;
  totalCleared: number;
  totalSecondaryReferrals: number;
}

export interface SyntheticTicket {
  ticketId: string;
  isValid: boolean;
  authorizedStand: string;
  authorizedInnerGate: string;
  isDuplicate: boolean;
  isExpired: boolean;
  scannedAt?: number;
  status: TicketValidationResult;
}

export interface MicroGateAgent {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  desiredSpeed: number;
  radius: number;
  state: MicroAgentState;
  ticket: SyntheticTicket;
  attendeeName: string;
  ticketHolderName: string;
  personCheckStatus?: PersonCheckResult;
  assignedLaneIndex: number;
  assignedScanStationId: string | null;
  assignedPersonCheckStationId: string | null;
  assignedTurnstileCounterId: string | null;
  targetInnerGateId: string;
  targetStandName: string;
  entryTimeSec: number;
  timeInCurrentStateSec: number;
  totalWaitTimeSec: number;
  isDiverted: boolean;
  currentWaypointIndex: number;
  waypoints: { x: number; y: number }[];
}

export interface TicketScanStationState {
  id: string; // e.g. 'SCAN-1'
  name: string;
  x: number;
  y: number;
  status: 'IDLE' | 'SCANNING' | 'FAILED';
  currentAgentId: number | null;
  scanRemainingSec: number;
  nominalLatencySec: number; // e.g. 0.4s
  totalScanned: number;
  totalAccepted: number;
  totalRejected: number;
}

export interface PersonCheckStationState {
  id: string; // e.g. 'CHK-1'
  name: string;
  x: number;
  y: number;
  status: 'IDLE' | 'CHECKING' | 'FAILED';
  currentAgentId: number | null;
  checkRemainingSec: number;
  nominalLatencySec: number; // e.g. 1.0s
  totalChecked: number;
  totalVerified: number;
  totalMismatches: number;
}

export interface MicroTurnstileCounterState {
  counterId: string; // e.g. 'G8-T01'
  gateId: string;    // e.g. 'G8'
  standName: string;
  laneIndex: number;
  x: number;
  y: number;
  status: 'IDLE' | 'BUSY' | 'FAILED' | 'OFFLINE';
  currentAgentId: number | null;
  serviceRemainingSec: number;
  nominalLatencySec: number; // e.g. 1.0s
  processedCount: number;
  processingCapacityPerMin?: number;
  queueLength?: number;
  assignedQueue?: number[]; // list of agent IDs waiting specifically for this counter
}

export interface QueueLaneState {
  laneIndex: number;
  label: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  waypoints: { x: number; y: number }[];
  occupancy: number;
  capacity: number;
  isCongested: boolean;
}

export interface MicroGateMetrics {
  totalArrivals: number;
  ticketsScanned: number;
  ticketsAccepted: number;
  ticketsRejected: number;
  personsChecked: number;
  personsVerified: number;
  personMismatches: number;
  securityCleared?: number; // Alias for personsVerified
  currentlyScreening?: number; // Alias for currentlyChecking
  waitingInQueues: number;
  currentlyScanning: number;
  currentlyChecking: number;
  turnstilesOperational: number;
  turnstilesTotal: number;
  turnstilesBusy?: number;
  turnstilesIdle?: number;
  turnstilesFailed?: number;
  spectatorsAdmitted: number;
  averageWaitTimeSec: number;
  currentThroughputPerMin: number;
  gateUtilizationPercent: number;

  // Capacity breakdown
  ticketScanCapacityPerMin: number;
  personCheckCapacityPerMin: number;
  turnstileCapacityPerMin: number;
  effectiveCapacityPerMin: number;

  // Microscopic 3-Zone Metrics
  zone1ApproachDensity: number;
  zone1ApproachCount: number;
  zone2HoldingDensity: number;
  zone2HoldingCount: number;
  zone3ThroatDensity: number;
  zone3ThroatCount: number;

  // Peak Density in Gate Corridors
  peakMicroDensity: number;
}

export type HeatmapVisualizationMode = 'DENSITY_POINTS' | 'HEATMAP' | 'AGENTS' | 'HYBRID' | 'ROUTES_ONLY';

export interface GateLogEvent {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARNING' | 'ALERT';
  message: string;
  gateId: string;
}

