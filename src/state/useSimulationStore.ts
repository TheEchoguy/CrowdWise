import { create } from 'zustand';
import { ScenarioType } from '../engine/types';

export interface TelemetryData {
  peakDensity: number;       // agents/m²
  spillbackMeters: number;   // meters
  throughputPerMin: number;  // agents/min
  liveAgents: number;        // count
  isCritical: boolean;       // peakDensity >= 5.0
  fps: number;
  activeCrushZones: number;
  avgVelocity: number;       // m/s
}

export interface SimulationStoreState {
  // Scenario & Core Parameters
  scenario: ScenarioType;
  inflowRate: number;        // 60 - 600/min
  gateLatency: number;       // 1.0 - 12.0s
  bafflesActive: boolean;
  auxGateActive: boolean;
  dividerActive: boolean;
  isPlaying: boolean;

  // Real-time calculated telemetry
  telemetry: TelemetryData;

  // Triggers & Counters for Canvas Sync
  resetKey: number;
  reversalTriggerKey: number;

  // Actions
  setScenario: (scenario: ScenarioType) => void;
  setInflowRate: (inflowRate: number) => void;
  setGateLatency: (gateLatency: number) => void;
  setBafflesActive: (active: boolean) => void;
  toggleBaffles: () => void;
  setAuxGateActive: (active: boolean) => void;
  toggleAuxGate: () => void;
  setDividerActive: (active: boolean) => void;
  toggleDivider: () => void;
  setIsPlaying: (isPlaying: boolean) => void;
  togglePlay: () => void;
  updateTelemetry: (data: Partial<TelemetryData>) => void;
  resetSimulation: () => void;
  triggerEmergencyReversal: () => void;
}

export const useSimulationStore = create<SimulationStoreState>((set) => ({
  scenario: 'stadium',
  inflowRate: 240,
  gateLatency: 2.5,
  bafflesActive: false,
  auxGateActive: false,
  dividerActive: true,
  isPlaying: true,

  telemetry: {
    peakDensity: 0,
    spillbackMeters: 0,
    throughputPerMin: 0,
    liveAgents: 0,
    isCritical: false,
    fps: 60,
    activeCrushZones: 0,
    avgVelocity: 0
  },

  resetKey: 0,
  reversalTriggerKey: 0,

  setScenario: (scenario) =>
    set((state) => ({
      scenario,
      // Adjust smart scenario defaults
      inflowRate: scenario === 'stadium' ? 240 : scenario === 'bridge' ? 320 : 360,
      gateLatency: scenario === 'stadium' ? 2.5 : scenario === 'bridge' ? 1.0 : 8.0,
      bafflesActive: false,
      auxGateActive: false,
      dividerActive: scenario === 'bridge',
      resetKey: state.resetKey + 1
    })),

  setInflowRate: (inflowRate) =>
    set({ inflowRate: Math.max(60, Math.min(600, inflowRate)) }),

  setGateLatency: (gateLatency) =>
    set({ gateLatency: Math.max(1.0, Math.min(12.0, gateLatency)) }),

  setBafflesActive: (bafflesActive) => set({ bafflesActive }),
  toggleBaffles: () => set((state) => ({ bafflesActive: !state.bafflesActive })),

  setAuxGateActive: (auxGateActive) => set({ auxGateActive }),
  toggleAuxGate: () => set((state) => ({ auxGateActive: !state.auxGateActive })),

  setDividerActive: (dividerActive) => set({ dividerActive }),
  toggleDivider: () => set((state) => ({ dividerActive: !state.dividerActive })),

  setIsPlaying: (isPlaying) => set({ isPlaying }),
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),

  updateTelemetry: (data) =>
    set((state) => ({
      telemetry: {
        ...state.telemetry,
        ...data
      }
    })),

  resetSimulation: () =>
    set((state) => ({
      resetKey: state.resetKey + 1
    })),

  triggerEmergencyReversal: () =>
    set((state) => ({
      reversalTriggerKey: state.reversalTriggerKey + 1
    }))
}));
