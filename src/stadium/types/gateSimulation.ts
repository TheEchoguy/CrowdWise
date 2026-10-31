/**
 * CROWDWISE — Phase 2.1: Microscopic Gate Simulation & Heatmap Data Types
 * M. Chinnaswamy Stadium, Bengaluru
 */

export type MicroAgentState =
  | 'ARRIVING'
  | 'WAITING_IN_QUEUE'
  | 'TICKET_SCANNING'
  | 'TICKET_VALIDATION'
  | 'SECURITY_SCREENING'
  | 'TURNSTILE_WAITING'
  | 'TURNSTILE_PROCESSING'
  | 'ADMITTED'
  | 'REJECTED'
  | 'SECONDARY_INSPECTION'
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
  assignedLaneIndex: number;
  assignedScanStationId: string | null;
  assignedScreeningStationId: string | null;
  assignedTurnstileCounterId: string | null;
  targetInnerGateId: string;
  targetStandName: string;
  entryTimeSec: number;
  timeInCurrentStateSec: number;
  totalWaitTimeSec: number;
  isDiverted: boolean;
  isSecondaryScreening: boolean;
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

export interface SecurityScreeningStationState {
  id: string; // e.g. 'SEC-1'
  name: string;
  x: number;
  y: number;
  status: 'IDLE' | 'SCREENING' | 'FAILED';
  currentAgentId: number | null;
  screeningRemainingSec: number;
  nominalLatencySec: number; // e.g. 2.0s
  totalInspected: number;
  totalCleared: number;
  totalSecondaryReferrals: number;
}

export interface MicroTurnstileCounterState {
  counterId: string; // e.g. 'G8-1'
  gateId: string;    // e.g. 'G8'
  standName: string;
  laneIndex: number;
  x: number;
  y: number;
  status: 'IDLE' | 'BUSY' | 'FAILED';
  currentAgentId: number | null;
  serviceRemainingSec: number;
  nominalLatencySec: number; // e.g. 1.0s
  processedCount: number;
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
  securityCleared: number;
  waitingInQueues: number;
  currentlyScanning: number;
  currentlyScreening: number;
  turnstilesOperational: number;
  turnstilesTotal: number;
  spectatorsAdmitted: number;
  averageWaitTimeSec: number;
  currentThroughputPerMin: number;
  gateUtilizationPercent: number;

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

export type HeatmapVisualizationMode = 'HEATMAP' | 'AGENTS' | 'HYBRID' | 'ROUTES_ONLY';

export interface GateLogEvent {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARNING' | 'ALERT';
  message: string;
  gateId: string;
}

