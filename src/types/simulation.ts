/**
 * CROWDWISE Predictive Crowd Digital Twin & Safety Lab
 * Phase 2 Upgraded Simulation Type Definitions
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
  compressivePressure: number; // Force accumulated from rear agents pushing (Phase 2)
}

export interface TelemetryState {
  peakDensity: number;                                // Maximum local density (p/m²)
  spillbackMeters: number;                            // Queue spillback from primary bottleneck (meters)
  throughputPerMin: number;                           // Clearances per minute
  liveAgents: number;                                 // Active pedestrians on map
  fps: number;                                        // Rendering/physics frame rate
  isCritical: boolean;                                // True when peakDensity >= 5.0
  timeToTurbulence: number | null;                    // Estimated seconds until density exceeds 5.0 p/m² (Phase 2)
  densityTrend: 'rising' | 'stable' | 'clearing';      // Real-time density trend (Phase 2)
  activeArrivalProfile: 'steady' | 'burst' | 'reversal'; // Synthetic arrival mode (Phase 2)
}

export type ScenarioType = 'stadium' | 'bridge' | 'reversal';

export interface ScenarioGeometry {
  walls: Wall[];
  gates: Gate[];
  baffles: Wall[];
}
