import { create } from 'zustand';
import { ScenarioType, TelemetryState } from '../types/simulation';

export interface SimulationStoreState {
  // Scenario & Simulation Parameters
  scenario: ScenarioType;
  inflowRate: number;         // people/min (default 240)
  gateLatency: number;        // sec/person (default 4.0)
  walkingSpeed: number;       // m/s (default 1.3)
  bafflesActive: boolean;     // default false
  auxGateActive: boolean;     // default false
  dividerActive: boolean;     // default false
  isPaused: boolean;          // default false
  timeScale: number;          // default 1.0 (1x, 2x, etc.)
  resetSignal: number;        // incremented to trigger reset
  isModalOpen: boolean;       // default false

  // Live Telemetry
  telemetry: TelemetryState;

  // Actions
  setScenario: (scenario: ScenarioType) => void;
  setInflowRate: (inflowRate: number) => void;
  setGateLatency: (gateLatency: number) => void;
  setWalkingSpeed: (walkingSpeed: number) => void;
  setBafflesActive: (active: boolean) => void;
  toggleBaffles: () => void;
  setAuxGateActive: (active: boolean) => void;
  toggleAuxGate: () => void;
  setDividerActive: (active: boolean) => void;
  toggleDivider: () => void;
  setIsPaused: (isPaused: boolean) => void;
  togglePause: () => void;
  setTimeScale: (timeScale: number) => void;
  triggerReset: () => void;
  setTelemetry: (telemetry: Partial<TelemetryState>) => void;
  setIsModalOpen: (isModalOpen: boolean) => void;
  toggleModal: () => void;
  applyMitigationPreset: () => void;
}

export const useSimulationStore = create<SimulationStoreState>((set) => ({
  scenario: 'stadium',
  inflowRate: 240,
  gateLatency: 4.0,
  walkingSpeed: 1.3,
  bafflesActive: false,
  auxGateActive: false,
  dividerActive: false,
  isPaused: false,
  timeScale: 1.0,
  resetSignal: 0,
  isModalOpen: false,

  telemetry: {
    peakDensity: 0,
    spillbackMeters: 0,
    throughputPerMin: 0,
    liveAgents: 0,
    fps: 60,
    isCritical: false
  },

  setScenario: (scenario) =>
    set((state) => ({
      scenario,
      dividerActive: scenario === 'bridge',
      bafflesActive: false,
      auxGateActive: false,
      resetSignal: state.resetSignal + 1
    })),

  setInflowRate: (inflowRate) => set({ inflowRate: Math.max(30, Math.min(600, inflowRate)) }),
  setGateLatency: (gateLatency) => set({ gateLatency: Math.max(0.5, Math.min(12.0, gateLatency)) }),
  setWalkingSpeed: (walkingSpeed) => set({ walkingSpeed: Math.max(0.5, Math.min(3.0, walkingSpeed)) }),

  setBafflesActive: (bafflesActive) => set({ bafflesActive }),
  toggleBaffles: () => set((state) => ({ bafflesActive: !state.bafflesActive })),

  setAuxGateActive: (auxGateActive) => set({ auxGateActive }),
  toggleAuxGate: () => set((state) => ({ auxGateActive: !state.auxGateActive })),

  setDividerActive: (dividerActive) => set({ dividerActive }),
  toggleDivider: () => set((state) => ({ dividerActive: !state.dividerActive })),

  setIsPaused: (isPaused) => set({ isPaused }),
  togglePause: () => set((state) => ({ isPaused: !state.isPaused })),

  setTimeScale: (timeScale) => set({ timeScale }),

  triggerReset: () => set((state) => ({ resetSignal: state.resetSignal + 1 })),

  setTelemetry: (data) =>
    set((state) => ({
      telemetry: {
        ...state.telemetry,
        ...data
      }
    })),

  setIsModalOpen: (isModalOpen) => set({ isModalOpen }),
  toggleModal: () => set((state) => ({ isModalOpen: !state.isModalOpen })),

  /**
   * Simultaneously activates both Upstream Baffles and Auxiliary Gate B Bypass
   * to immediately test counterfactual safety optimization.
   */
  applyMitigationPreset: () =>
    set((state) => {
      const willEnable = !(state.bafflesActive && state.auxGateActive);
      return {
        bafflesActive: willEnable,
        auxGateActive: willEnable
      };
    })
}));

