/**
 * CROWDWISE Microscopic Pedestrian Dynamics Engine
 * Type Definitions & Vector Physics Interfaces
 */

export interface Agent {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;           // Pedestrian physical radius (pixels, ~0.25m = 5px at 20px/m)
  targetX: number;
  targetY: number;
  density: number;          // Local density in agents/m²
  color: string;            // Dynamic color code
  stuckTime: number;        // Accumulated time in seconds where velocity < threshold
  desiredSpeed: number;     // Nominal walking speed in px/s (~1.34 m/s)
  maxSpeed: number;         // Maximum clamp speed (~2.2 m/s)
  mass: number;             // Agent mass for momentum calculations (kg)
  group?: number;           // 0: default forward, 1: counter-flow, etc.
  targetGateId?: string;
  flashPhase?: number;      // Alternating tick for high-density flash
  active: boolean;          // Alive and simulated
}

export interface Wall {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  thickness?: number;
  color?: string;
  type?: 'boundary' | 'funnel' | 'barrier' | 'divider';
}

export interface Gate {
  id: string;
  name: string;
  x: number;                // Center X of gate opening
  y: number;                // Center Y of gate opening
  width: number;            // Opening width (pixels)
  height: number;           // Gate boundary zone depth
  cooldown: number;         // Current countdown timer (seconds)
  maxCooldown: number;      // Base latency per person inspection (seconds)
  active: boolean;
  color?: string;
  totalPassed: number;      // Total agents cleared through this gate
}

export interface Baffle {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  active: boolean;
  thickness?: number;
  label?: string;
}

export interface TelemetryState {
  peakDensity: number;       // Maximum local density (agents/m²)
  maxSpillback: number;      // Queue spillback from bottleneck (meters)
  throughput: number;        // Agents processed per minute
  totalAgents: number;       // Current live agents in arena
  fps: number;               // Engine render loop FPS
  isCritical: boolean;       // Density >= 5.0 crush warning
  activeCrushZones: number;  // Number of clusters exceeding crush limit
  avgVelocity: number;       // Mean agent speed (m/s)
}

export type ScenarioType = 'stadium' | 'bridge' | 'reversal';

export interface SpawnZone {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  directionX: number;
  directionY: number;
  group?: number;
}

export interface TargetZone {
  id: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  radius?: number;
  group?: number;
  associatedGateId?: string;
}

export interface ScenarioPreset {
  id: ScenarioType;
  name: string;
  tagline: string;
  description: string;
  width: number;
  height: number;
  pixelsPerMeter: number;     // Scale factor: e.g. 20 pixels = 1 meter
  walls: Wall[];
  gates: Gate[];
  baffles: Baffle[];
  spawnZones: SpawnZone[];
  targetZones: TargetZone[];
  defaultInflowRate: number;  // Inflow agents per minute
  defaultGateLatency: number; // Gate turnstile check latency (seconds)
}
