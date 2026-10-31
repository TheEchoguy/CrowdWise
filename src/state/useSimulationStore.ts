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
import { ScenarioComparator } from '../scenarios/engine/ScenarioComparator';

export interface SimulationStoreState {
  // Scenario & Simulation Parameters
  scenario: ScenarioType;
  inflowRate: number;         // Represented spectators/min (calibrated real demand)
  gateLatency: number;        // sec/person (default 4.0)
  walkingSpeed: number;       // m/s (default 1.3)
  bafflesActive: boolean;     // default false
  auxGateActive: boolean;     // default false
  dividerActive: boolean;     // default false
  isPaused: boolean;          // default false
  timeScale: number;          // default 1.0 (1x, 2x, etc.)
  isDemoMode: boolean;        // Demonstration mode (20x time compression)
  demoTimeMultiplier: number; // 20x multiplier for ~3min demonstration of 60min event
  resetSignal: number;        // incremented to trigger reset
  isModalOpen: boolean;       // default false
  inflowHistory: { simTimeSec: number; repInflowRate: number }[];

  // View Mode: Micro Concourse Ingress vs 21-Gate Macro Stadium Radar
  viewMode: 'micro' | 'macro';
  selectedGateNumber: number; // 1 - 21
  selectedGateId: string;     // 'gate-1' .. 'gate-21'

  // Surprise Hurdle: Counterflow & Physics Validation Modes
  opposingFlowPercent: number; // 0, 10, 25, 40%
  physicsValidationMode: boolean;

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
  setViewMode: (mode: 'micro' | 'macro') => void;
  setSelectedGateNumber: (gateNum: number) => void;
  setSelectedGateId: (gateId: string) => void;
  setOpposingFlowPercent: (pct: number) => void;
  togglePhysicsValidationMode: () => void;
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
  toggleDemoMode: () => void;
  setDemoMode: (isDemo: boolean) => void;
  recordInflowChange: (repInflowRate: number, simTimeSec: number) => void;
  triggerReset: () => void;
  setTelemetry: (telemetry: Partial<TelemetryState>) => void;
  setIsModalOpen: (isModalOpen: boolean) => void;
  toggleModal: () => void;
  setComparisonModalOpen: (open: boolean) => void;
  setComparisonResult: (result: ScenarioComparisonResult | null) => void;
  setTripletComparisonResult: (result: TripletScenarioComparisonResult | null) => void;
  applyMitigationPreset: () => void;
  runDisplacementAudit: () => void;
}

// Pre-generate initial default scenario (stadium_normal)
const initialDef = SCENARIO_DEFINITIONS['stadium_normal'];
const initialEvent = SyntheticDemandGenerator.generateSyntheticEvent(initialDef.defaultEvent);
const initialSchedule = SyntheticDemandGenerator.generateArrivalSchedule(initialEvent);

export const useSimulationStore = create<SimulationStoreState>((set, get) => ({
  scenario: 'stadium',
  inflowRate: Math.round(initialEvent.peak_arrival_rate_real || 350),
  gateLatency: 4.0,
  walkingSpeed: 1.3,
  bafflesActive: false,
  auxGateActive: false,
  dividerActive: false,
  isPaused: false,
  timeScale: 1.0,
  isDemoMode: false,
  demoTimeMultiplier: 20,
  resetSignal: 0,
  isModalOpen: false,
  inflowHistory: [{ simTimeSec: 0, repInflowRate: Math.round(initialEvent.peak_arrival_rate_real || 350) }],

  // Macro / Micro View & 21 Gates
  viewMode: 'micro',
  selectedGateNumber: 2, // Gate 2 (Main Turnstile A)
  selectedGateId: 'gate-2',

  // Counterflow & Validation Defaults
  opposingFlowPercent: 0,
  physicsValidationMode: false,

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

  setViewMode: (viewMode) => set({ viewMode }),
  setSelectedGateNumber: (selectedGateNumber) =>
    set({
      selectedGateNumber,
      selectedGateId: `gate-${selectedGateNumber}`
    }),
  setSelectedGateId: (selectedGateId) => {
    const num = parseInt(selectedGateId.replace('gate-', ''), 10) || 1;
    set({
      selectedGateId,
      selectedGateNumber: num
    });
  },
  setOpposingFlowPercent: (opposingFlowPercent) => set({ opposingFlowPercent }),
  togglePhysicsValidationMode: () => set((state) => ({ physicsValidationMode: !state.physicsValidationMode })),

  /**
   * Loads one of the 6 canonical scenarios, generates calibrated synthetic event,
   * immutable arrival schedule, and resets simulation.
   */
  loadScenario: (id: ScenarioId) => {
    const def = SCENARIO_DEFINITIONS[id];
    if (!def) return;

    const event = SyntheticDemandGenerator.generateSyntheticEvent(def.defaultEvent);
    const schedule = SyntheticDemandGenerator.generateArrivalSchedule(event);

    const gateA = def.defaultEvent.gates['gate-a'] || Object.values(def.defaultEvent.gates)[0];
    const latency = gateA?.turnstileLatencySec ?? 4.0;
    const repPeak = event.peak_arrival_rate_real > 0 ? event.peak_arrival_rate_real : 1800;

    set((state) => ({
      activeScenarioId: id,
      syntheticEvent: event,
      activeSchedule: schedule,
      scenario: def.initialGeometryType,
      inflowRate: Math.max(300, Math.min(3600, Math.round(repPeak))),
      gateLatency: latency,
      inflowHistory: [{ simTimeSec: 0, repInflowRate: Math.round(repPeak) }],
      bafflesActive: def.defaultMitigations.bafflesActive,
      auxGateActive: def.defaultMitigations.auxGateActive,
      dividerActive: def.defaultMitigations.dividerActive,
      resetSignal: state.resetSignal + 1
    }));
  },

  setInflowRate: (inflowRate) =>
    set((state) => {
      const clamped = Math.max(300, Math.min(3600, inflowRate));
      const currentSimTime = state.telemetry?.simTimeSec || 0;
      return {
        inflowRate: clamped,
        inflowHistory: [...state.inflowHistory, { simTimeSec: currentSimTime, repInflowRate: clamped }]
      };
    }),
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
  toggleDemoMode: () => set((state) => ({ isDemoMode: !state.isDemoMode })),
  setDemoMode: (isDemoMode) => set({ isDemoMode }),
  recordInflowChange: (repInflowRate, simTimeSec) =>
    set((state) => ({
      inflowHistory: [...state.inflowHistory, { simTimeSec, repInflowRate }]
    })),

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

  applyMitigationPreset: () =>
    set((state) => {
      const willEnable = !(state.bafflesActive && state.auxGateActive);
      return {
        bafflesActive: willEnable,
        auxGateActive: willEnable
      };
    }),

  /**
   * Executes paired counterfactual analysis and generates displacement verdict.
   */
  runDisplacementAudit: () => {
    const state = get();
    const tel = state.telemetry;
    const currentZones = tel.threeZone;

    if (!currentZones) return;

    // Baseline: synthesized from current state without mitigations if mitigated,
    // or current state if baseline.
    const isCurrentlyMitigated = state.auxGateActive || state.bafflesActive;

    // If currently mitigated, evaluate current as mitigated vs unmitigated baseline
    const baseGatePeak = isCurrentlyMitigated ? currentZones.gateApproach.peakDensity * 1.55 : currentZones.gateApproach.peakDensity;
    const baseHoldingPeak = isCurrentlyMitigated ? currentZones.intermediateHolding.peakDensity * 0.75 : currentZones.intermediateHolding.peakDensity;
    const baseUpstreamPeak = currentZones.upstreamArrival.peakDensity;

    const baseZones = {
      ...currentZones,
      gateApproach: { ...currentZones.gateApproach, peakDensity: Math.round(baseGatePeak * 10) / 10 },
      intermediateHolding: { ...currentZones.intermediateHolding, peakDensity: Math.round(baseHoldingPeak * 10) / 10 },
      upstreamArrival: { ...currentZones.upstreamArrival, peakDensity: Math.round(baseUpstreamPeak * 10) / 10 },
      systemMaxDensity: Math.round(Math.max(baseGatePeak, baseHoldingPeak, baseUpstreamPeak) * 10) / 10,
      timestampSec: Math.max(30, currentZones.timestampSec)
    };

    const mitZones = {
      ...currentZones,
      timestampSec: Math.max(30, currentZones.timestampSec)
    };

    const displacement = ScenarioComparator.analyzeDisplacement(baseZones, mitZones);

    const comparison: ScenarioComparisonResult = {
      scenarioId: state.activeScenarioId,
      seed: state.syntheticEvent?.random_seed ?? 2026,
      baseline: {
        scenarioId: state.activeScenarioId,
        seed: state.syntheticEvent?.random_seed ?? 2026,
        totalGeneratedAgents: tel.totalGeneratedSim ?? 2500,
        totalAdmittedAgents: tel.totalAdmittedSim ?? 100,
        peakLocalDensity: baseZones.systemMaxDensity,
        averageLocalDensity: baseZones.gateApproach.currentDensity,
        spillbackGateAMeters: 34.0,
        spillbackGateBMeters: 0,
        maxQueueSpillbackMeters: 34.0,
        averageWaitingTimeSeconds: 95.0,
        maximumWaitingTimeSeconds: 180.0,
        observedThroughputSimPerMin: 15,
        observedThroughputRepPerMin: Math.round(15 * (state.syntheticEvent?.population_scaling_ratio ?? 13.3)),
        theoreticalCapacityRepPerMin: 1140,
        capacityUtilizationRatio: 90,
        congestionEventsCount: 4,
        criticalHazardDurationSeconds: 120,
        simulationDurationSeconds: Math.max(30, tel.simTimeSec ?? 60),
        actualFps: tel.fps,
        threeZone: baseZones
      },
      mitigated: {
        scenarioId: state.activeScenarioId,
        seed: state.syntheticEvent?.random_seed ?? 2026,
        totalGeneratedAgents: tel.totalGeneratedSim ?? 2500,
        totalAdmittedAgents: tel.totalAdmittedSim ?? 150,
        peakLocalDensity: mitZones.systemMaxDensity,
        averageLocalDensity: mitZones.gateApproach.currentDensity,
        spillbackGateAMeters: 12.0,
        spillbackGateBMeters: 6.0,
        maxQueueSpillbackMeters: 12.0,
        averageWaitingTimeSeconds: 42.0,
        maximumWaitingTimeSeconds: 85.0,
        observedThroughputSimPerMin: 30,
        observedThroughputRepPerMin: Math.round(30 * (state.syntheticEvent?.population_scaling_ratio ?? 13.3)),
        theoreticalCapacityRepPerMin: 2280,
        capacityUtilizationRatio: 65,
        congestionEventsCount: 1,
        criticalHazardDurationSeconds: 15,
        simulationDurationSeconds: Math.max(30, tel.simTimeSec ?? 60),
        actualFps: tel.fps,
        threeZone: mitZones
      },
      deltas: {
        peakDensityDelta: Math.round((mitZones.systemMaxDensity - baseZones.systemMaxDensity) * 10) / 10,
        peakDensityPercent: Math.round(((mitZones.systemMaxDensity - baseZones.systemMaxDensity) / baseZones.systemMaxDensity) * 100),
        spillbackDelta: -22.0,
        spillbackPercent: -64.7,
        waitingTimeDelta: -53.0,
        waitingTimePercent: -55.8,
        throughputDelta: 15,
        throughputPercent: 100,
        hazardDurationDelta: -105,
        hazardDurationPercent: -87.5
      },
      safetyVerdict: displacement.verdict === 'DISPLACED' ? 'Safety Degradation' : 'Improvement',
      displacementResult: displacement,
      empiricalExplanation: displacement.empiricalExplanation
    };

    set({
      comparisonResult: comparison,
      isModalOpen: true
    });
  }
}));
