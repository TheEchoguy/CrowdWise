/**
 * CROWDWISE Predictive Crowd Digital Twin & Safety Lab
 * Foundational Simulation Type Definitions (Phase 3 & Surprise Hurdle Extended)
 */

import {
  CounterflowTelemetry,
  DisplacementAnalysisResult,
  FlowDirection,
  PhysicsValidationTelemetry,
  ThreeZoneTelemetry
} from '../scenarios/types/ScenarioTypes';
import { SafetyRecommendationItem } from '../scenarios/engine/SafetyController';

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
  direction?: FlowDirection; // 'inbound' | 'outbound'
  // Analytics Attributes
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
  representedAdmitted?: number;
  totalAdmittedSim?: number;
  totalGeneratedSim?: number;
  totalInboundInjected?: number;
  totalOutboundInjected?: number;
  totalOutboundExited?: number;
  activeInbound?: number;
  activeOutbound?: number;
  observedThroughputRep?: number;
  theoreticalCapacityRep?: number;
  effectiveSimInflowRate?: number;
  capacityUtilization?: number;
  spillbackGateAMeters?: number;
  spillbackGateBMeters?: number;
  averageWaitingTime?: number;
  maximumWaitingTime?: number;
  criticalHazardDuration?: number;
  congestionEventsCount?: number;
  simTimeSec?: number;
  isDemoMode?: boolean;
  demoTimeMultiplier?: number;
  // Surprise Hurdle Telemetry
  threeZone?: ThreeZoneTelemetry;
  counterflow?: CounterflowTelemetry;
  displacementResult?: DisplacementAnalysisResult;
  safetyRecommendations?: readonly SafetyRecommendationItem[];
  physicsValidation?: PhysicsValidationTelemetry;
  // 21-Gate Stadium Network Telemetry
  networkSummary?: any;
  focusedGateId?: string;
  focusedGateNumber?: number;
  focusedGateState?: any;
}

export type ScenarioType = 'stadium' | 'bridge' | 'reversal';

export interface ScenarioGeometry {
  walls: Wall[];
  gates: Gate[];
  baffles: Wall[];
}
