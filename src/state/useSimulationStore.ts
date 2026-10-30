import { create } from 'zustand';
import { ScenarioType, TelemetryState } from '../types/simulation';
import {
  PreGeneratedArrivalSchedule,
  ScenarioComparisonResult,
  ScenarioId,
  SyntheticEventData,
  TripletScenarioComparisonResult
} from '../scenarios/types/ScenarioTypes';
import { SCENARIO_DEFINITIONS } from '../scenarios/data/scenarioDefinitions';
import { SyntheticDemandGenerator } from '../scenarios/engine/SyntheticDemandGenerator';

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

  // Phase 3 Scenario Studio State
  activeScenarioId: ScenarioId;
  syntheticEvent: SyntheticEventData | null;
  activeSchedule: PreGeneratedArrivalSchedule | null;
  comparisonResult: ScenarioComparisonResult | null;
  tripletComparisonResult: TripletScenarioComparisonResult | null;
  isComparisonModalOpen: boolean;

  // Live Telemetry
  telemetry: TelemetryState;

  // Actions
  setScenario: (scenario: ScenarioType) => void;
  loadScenario: (id: ScenarioId) => void;
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
  setComparisonModalOpen: (open: boolean) => void;
  setComparisonResult: (result: ScenarioComparisonResult | null) => void;
  setTripletComparisonResult: (result: TripletScenarioComparisonResult | null) => void;
  applyMitigationPreset: () => void;
}

// Pre-generate initial default scenario (stadium_normal)
const initialDef = SCENARIO_DEFINITIONS['stadium_normal'];
const initialEvent = SyntheticDemandGenerator.generateSyntheticEvent(initialDef.defaultEvent);
const initialSchedule = SyntheticDemandGenerator.generateArrivalSchedule(initialEvent);

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

  // Phase 3 Defaults
  activeScenarioId: 'stadium_normal',
  syntheticEvent: initialEvent,
  activeSchedule: initialSchedule,
  comparisonResult: null,
  tripletComparisonResult: null,
  isComparisonModalOpen: false,

  telemetry: {
    peakDensity: 0,
    spillbackMeters: 0,
    throughputPerMin: 0,
    liveAgents: 0,
    fps: 60,
    isCritical: false,
    representedAdmitted: 0,
    totalAdmittedSim: 0,
    totalGeneratedSim: 0,
    observedThroughputRep: 0,
    theoreticalCapacityRep: 0,
    capacityUtilization: 0,
    spillbackGateAMeters: 0,
    spillbackGateBMeters: 0,
    averageWaitingTime: 0,
    maximumWaitingTime: 0,
    criticalHazardDuration: 0,
    congestionEventsCount: 0,
    simTimeSec: 0
  },

  setScenario: (scenario) =>
    set((state) => ({
      scenario,
      dividerActive: scenario === 'bridge',
      bafflesActive: false,
      auxGateActive: false,
      resetSignal: state.resetSignal + 1
    })),

  /**
   * Loads one of the 6 canonical scenarios, generates its calibrated
   * synthetic event and immutable arrival schedule, and resets simulation.
   */
  loadScenario: (id: ScenarioId) => {
    const def = SCENARIO_DEFINITIONS[id];
    if (!def) return;

    const event = SyntheticDemandGenerator.generateSyntheticEvent(def.defaultEvent);
    const schedule = SyntheticDemandGenerator.generateArrivalSchedule(event);

    const gateA = def.defaultEvent.gates['gate-a'] || Object.values(def.defaultEvent.gates)[0];
    const latency = gateA?.turnstileLatencySec ?? 4.0;
    const simPeak = event.peak_arrival_rate_sim > 0 ? event.peak_arrival_rate_sim : 240;

    set((state) => ({
      activeScenarioId: id,
      syntheticEvent: event,
      activeSchedule: schedule,
      scenario: def.initialGeometryType,
      inflowRate: Math.max(30, Math.min(600, Math.round(simPeak))),
      gateLatency: latency,
      bafflesActive: def.defaultMitigations.bafflesActive,
      auxGateActive: def.defaultMitigations.auxGateActive,
      dividerActive: def.defaultMitigations.dividerActive,
      resetSignal: state.resetSignal + 1
    }));
  },

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

  setComparisonModalOpen: (isComparisonModalOpen) => set({ isComparisonModalOpen }),
  setComparisonResult: (comparisonResult) => set({ comparisonResult }),
  setTripletComparisonResult: (tripletComparisonResult) => set({ tripletComparisonResult }),

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
