/**
 * CROWDWISE Predictive Crowd Digital Twin & Safety Lab
 * Foundational Simulation Type Definitions (Phase 3 Extended)
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
  // Phase 3 Extended Analytics Attributes
  spawnTimeSimSec?: number;
  targetGateId?: string;
  queueWaitingTimeSec?: number;
  freeFlowTravelSec?: number;
}

export interface TelemetryState {
  peakDensity: number;      // Maximum local density (p/m²)
  spillbackMeters: number;  // Queue spillback from primary bottleneck (meters)
  throughputPerMin: number; // Clearances per minute (sim agents)
  liveAgents: number;       // Active pedestrians on map
  fps: number;              // Rendering/physics frame rate
  isCritical: boolean;      // True when peakDensity >= critical threshold
  // Phase 3 Verified Extended Metrics
  representedAdmitted?: number;
  totalAdmittedSim?: number;
  totalGeneratedSim?: number;
  observedThroughputRep?: number;
  theoreticalCapacityRep?: number;
  capacityUtilization?: number;
  spillbackGateAMeters?: number;
  spillbackGateBMeters?: number;
  averageWaitingTime?: number;
  maximumWaitingTime?: number;
  criticalHazardDuration?: number;
  congestionEventsCount?: number;
  simTimeSec?: number;
}

export type ScenarioType = 'stadium' | 'bridge' | 'reversal';

export interface ScenarioGeometry {
  walls: Wall[];
  gates: Gate[];
  baffles: Wall[];
}
