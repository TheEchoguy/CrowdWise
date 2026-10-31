import { create } from 'zustand';
import {
  ScenarioType,
  TelemetryState,
  StadiumViewMode,
  StadiumSectorId,
  RoadSectorId,
  AppViewMode,
  SimulationDisplayMode,
  ActiveGateSector,
  MatchPhase
} from '../types/simulation';
import { calculateTimeToFillHours, calculateCrushProbabilityIndex } from '../engine/ChinnaswamyData';
import { ExperimentType, ScenarioConfig, PRESET_SCENARIOS } from '../engine/SyntheticDemandGenerator';
import { VerdictReport } from '../engine/SafetyVerdictEngine';
import { ComparativeAuditReport } from '../engine/DisplacementDetector';
import { CrowdInteractionAnalysis } from '../engine/CrowdInteractionAnalyzer';
import { ControllerDecisions, InterventionType } from '../engine/SafetyController';
import {
  HeatmapVisualizationMode,
  MicroGateMetrics,
  GateLogEvent
} from '../stadium/types/gateSimulation';

export interface SimulationStoreState {
  // Scenario & Simulation Parameters
  scenario: ScenarioType;
  inflowRate: number;         // people/min (default 360)
  gateLatency: number;        // sec/person (default 4.0)
  walkingSpeed: number;       // m/s (default 1.3)
  bafflesActive: boolean;     // default false
  auxGateActive: boolean;     // default false
  dividerActive: boolean;     // default false
  isPaused: boolean;          // default false
  timeScale: number;          // default 1.0 (1x, 2x, etc.)
  resetSignal: number;        // incremented to trigger reset
  isModalOpen: boolean;       // default false
  isBenchmarkOpen: boolean;   // default false
  appMode: 'BLUEPRINT' | 'SIMULATION'; // Phase 1 Blueprint vs Simulation Lab

  // Master Safety Workflow State
  activeExperiment: ExperimentType;
  scenarioConfig: ScenarioConfig;
  currentVerdict: VerdictReport | null;
  comparativeAudit: ComparativeAuditReport | null;
  interactionAnalysis: CrowdInteractionAnalysis | null;
  controllerDecisions: ControllerDecisions | null;

  // View Mode: 'MACRO_STADIUM' (360° Satellite CAD) vs 'SECTOR_CONCOURSE' (Micro CAD)
  currentView: AppViewMode;
  simulationDisplayMode: SimulationDisplayMode;
  selectedOuterGateId: string | null;
  selectedInnerGateId: string | null;
  gateInflowOverrides: Record<string, number>;
  viewMode: 'stadium' | 'gate';
  stadiumViewMode: StadiumViewMode;   // 'MACRO_VIEW' | 'MICRO_VIEW_EAST'
  selectedSector: RoadSectorId | StadiumSectorId;
  selectedRoadSector: RoadSectorId;
  activeSector: ActiveGateSector;     // 'G1-G6_EAST' | 'G7-G11_SOUTH' | 'G12-G15_WEST' | 'G16-G21_NORTH'
  activeGateSector: ActiveGateSector; // Synced alias
  matchPhase: MatchPhase;             // 'PRE_GATES' | 'METRO_PEAK' | 'ANTHEM_RUSH' | 'EGRESS'
  sectorInflow: Record<string, number>;
  overflowRerouteActive: boolean;      // Gates 4-6 Overflow Reroute
  scannerFailureActive: boolean;       // Turnstile Scanner Failure (Gate 1-2)
  stadiumSeatedCount: number;         // Actual seated patrons (out of 35,000)

  // Two-Tier Turnstile & Screening Latency Controls
  baggageScanLatency: number;         // default 3.5s, min 1.0s, max 8.0s
  turnstileScanLatency: number;       // default 0.2s, min 0.2s, max 4.0s
  counterFlowActive: boolean;         // default false (or 8% rejection simulation)
  sectorTurnstileOverrides: Record<string, number>;

  // Dynamic Multi-Counter Scaling (Stage 3 Security Counters)
  counterCountGate1: number;          // Default 4 (min: 2, max: 10)
  counterCountGate2: number;          // Default 3 (min: 1, max: 8)
  gate1CounterCount: number;          // Synced alias
  gate2CounterCount: number;          // Synced alias
  sQueueEnabled: boolean;             // Default true
  scannerSpeed: number;               // Default 0.2s
  securityCheckSpeed: number;         // Default 1.0s

  // Autonomous Smart Rerouting (AI Incident Commander)
  autonomousRerouteActive: boolean;

  // Surge & Metro Train Pulse Triggers
  surgeSignal: number;
  surgeCount: number;
  metroPulseSignal: number;

  // Live Telemetry
  telemetry: TelemetryState;

  // Actions
  setCurrentView: (view: AppViewMode) => void;
  setSimulationDisplayMode: (mode: SimulationDisplayMode) => void;
  setSelectedOuterGateId: (id: string | null) => void;
  setSelectedInnerGateId: (id: string | null) => void;
  setGateInflowOverride: (gateId: string, rate: number) => void;
  setScenario: (scenario: ScenarioType) => void;
  setViewMode: (mode: 'stadium' | 'gate') => void;
  setStadiumViewMode: (mode: StadiumViewMode) => void;
  setSelectedSector: (sector: any) => void;
  setBaggageScanLatency: (latency: number) => void;
  setTurnstileScanLatency: (latency: number) => void;
  toggleCounterFlow: () => void;
  setCounterFlowActive: (active: boolean) => void;
  setSectorTurnstileCount: (gateId: string, count: number) => void;
  setSectorTurnstileOverrides: (overrides: Record<string, number>) => void;
  setActiveSector: (sector: ActiveGateSector) => void;
  setActiveGateSector: (sector: ActiveGateSector) => void;
  setMatchPhase: (phase: MatchPhase) => void;
  setSectorInflow: (sector: string, rate: number) => void;
  setInflowRate: (inflowRate: number) => void;
  setGateLatency: (gateLatency: number) => void;
  setWalkingSpeed: (walkingSpeed: number) => void;
  setBafflesActive: (active: boolean) => void;
  toggleBaffles: () => void;
  setAuxGateActive: (active: boolean) => void;
  toggleAuxGate: () => void;
  toggleOverflowReroute: () => void;
  toggleScannerFailure: () => void;
  toggleAutonomousReroute: () => void;
  setAutonomousRerouteActive: (active: boolean) => void;
  addCounter: (gateId: string) => void;
  removeCounter: (gateId: string) => void;
  addSecurityCounter: (gateId: 'gate-1' | 'gate-2') => void;
  removeSecurityCounter: (gateId: 'gate-1' | 'gate-2') => void;
  setCounterCount: (gateId: 'gate-1' | 'gate-2', count: number) => void;
  setSQueueEnabled: (enabled: boolean) => void;
  setScannerSpeed: (speed: number) => void;
  setSecurityCheckSpeed: (speed: number) => void;
  setDividerActive: (active: boolean) => void;
  toggleDivider: () => void;
  setIsPaused: (isPaused: boolean) => void;
  togglePause: () => void;
  setTimeScale: (timeScale: number) => void;
  triggerReset: () => void;
  triggerSurgeWave: (count?: number) => void;
  triggerMetroPulse: () => void;
  triggerBurstRush: (count?: number) => void;
  setTelemetry: (telemetry: Partial<TelemetryState>) => void;
  incrementSeatedCount: (amount: number) => void;
  setIsModalOpen: (isModalOpen: boolean) => void;
  toggleModal: () => void;
  setIsBenchmarkOpen: (isBenchmarkOpen: boolean) => void;
  toggleBenchmark: () => void;
  setAppMode: (mode: 'BLUEPRINT' | 'SIMULATION') => void;
  applyMitigationPreset: () => void;

  // Master Safety Workflow Actions
  setExperiment: (type: ExperimentType) => void;
  setComparativeAudit: (audit: ComparativeAuditReport | null) => void;
  setVerdict: (verdict: VerdictReport | null) => void;
  setInteractionAnalysis: (analysis: CrowdInteractionAnalysis | null) => void;
  setControllerDecisions: (decisions: ControllerDecisions | null) => void;
  triggerIntervention: (type: InterventionType, enabled?: boolean) => void;

  // Phase 2.1 Microscopic Gate & Heatmap Actions
  heatmapVisualizationMode: HeatmapVisualizationMode;
  setHeatmapVisualizationMode: (mode: HeatmapVisualizationMode) => void;
  ticketScanLatency: number;
  setTicketScanLatency: (latency: number) => void;
  securityScreeningLatency: number;
  setSecurityScreeningLatency: (latency: number) => void;
  ticketRejectionRate: number;
  setTicketRejectionRate: (rate: number) => void;
  auxiliaryBypassEnabled: boolean;
  toggleAuxiliaryBypass: () => void;
  microGateMetrics: MicroGateMetrics | null;
  setMicroGateMetrics: (metrics: MicroGateMetrics) => void;
  gateLogs: GateLogEvent[];
  addGateLog: (level: 'INFO' | 'WARNING' | 'ALERT', message: string, gateId: string) => void;
  clearGateLogs: () => void;
}

export const useSimulationStore = create<SimulationStoreState>((set) => ({
  scenario: 'stadium',
  inflowRate: 360,
  gateLatency: 0.2,
  walkingSpeed: 1.3,
  bafflesActive: false,
  auxGateActive: false,
  dividerActive: false,
  isPaused: false,
  timeScale: 1.0,
  resetSignal: 0,
  isModalOpen: false,
  isBenchmarkOpen: false,
  appMode: 'BLUEPRINT',

  // Master Safety Workflow Initial State
  activeExperiment: 'NORMAL',
  scenarioConfig: PRESET_SCENARIOS.NORMAL,
  currentVerdict: null,
  comparativeAudit: null,
  interactionAnalysis: null,
  controllerDecisions: null,

  // KSCA 2-Tier Ground Truth Initial State
  currentView: 'MACRO_STADIUM',
  simulationDisplayMode: 'FULL_STADIUM',
  selectedOuterGateId: 'E11',
  selectedInnerGateId: 'G15',
  gateInflowOverrides: {},
  viewMode: 'stadium',
  stadiumViewMode: 'MACRO_VIEW',
  selectedSector: 'LINK_ROAD',
  selectedRoadSector: 'LINK_ROAD',
  baggageScanLatency: 3.5,
  turnstileScanLatency: 0.2,
  counterFlowActive: false,
  sectorTurnstileOverrides: {},

  activeSector: 'G1-G6_EAST',
  activeGateSector: 'G1-G6_EAST',
  matchPhase: 'PRE_GATES',
  sectorInflow: {
    'G1-G6_EAST': 300,
    'G16-G21_NORTH': 200,
    'G7-G11_SOUTH': 180,
    'G12-G15_WEST': 100
  },
  overflowRerouteActive: false,
  scannerFailureActive: false,
  stadiumSeatedCount: 14200,
  counterCountGate1: 4,
  counterCountGate2: 3,
  gate1CounterCount: 4,
  gate2CounterCount: 3,
  sQueueEnabled: true,
  scannerSpeed: 0.2,
  securityCheckSpeed: 3.5,
  autonomousRerouteActive: true, // Default AI Incident Commander active

  surgeSignal: 0,
  surgeCount: 45,
  metroPulseSignal: 0,

  telemetry: {
    peakDensity: 0,
    spillbackMeters: 0,
    throughputPerMin: 0,
    liveAgents: 0,
    fps: 60,
    isCritical: false,
    timeToTurbulence: null,
    densityTrend: 'stable',
    activeArrivalProfile: 'steady',
    stadiumFillPercentage: Math.round((14200 / 35000) * 100),
    estimatedTimeToFillHours: calculateTimeToFillHours(240, 14200, 35000),
    crushProbabilityIndex: 12,
    selectedSector: 'LINK_ROAD',
    metroBurstActive: false,
    gateMetrics: {
      'gate-1': { queueCount: 0, density: 0, inflowRate: 240, capacity: 300, status: 'NORMAL' },
      'gate-2': { queueCount: 0, density: 0, inflowRate: 0, capacity: 240, status: 'NORMAL' }
    },
    activeRerouteAlert: null,
    burstRateAnalysis: { excessPeoplePerMin: 0, timeToGridlockSeconds: null },
    activeCountersCount: 4,
    averageWaitTimeSec: 18.4,
    fastScanThroughput: 240,
    securityCheckThroughput: 240,
    counterFlowPenaltyPercent: 0,
    zoneADensity: 0.8,
    zoneBDensity: 0.8,
    zoneCDensity: 0.8,
    displacedCrushAdvisory: null,
    fruinLOS: 'A',
    counterFlowActive: false
  },

  setCurrentView: (currentView) =>
    set((state) => ({
      currentView,
      viewMode: currentView === 'MACRO_STADIUM' ? 'stadium' : 'gate',
      stadiumViewMode: currentView === 'MACRO_STADIUM' ? 'MACRO_VIEW' : 'MICRO_VIEW_EAST',
      resetSignal: state.resetSignal + 1
    })),

  setSimulationDisplayMode: (simulationDisplayMode) => set({ simulationDisplayMode }),
  setSelectedOuterGateId: (selectedOuterGateId) => set({ selectedOuterGateId }),
  setSelectedInnerGateId: (selectedInnerGateId) => set({ selectedInnerGateId }),

  // Phase 2.1 Microscopic Gate & Heatmap State & Actions
  heatmapVisualizationMode: 'HEATMAP',
  setHeatmapVisualizationMode: (heatmapVisualizationMode) => set({ heatmapVisualizationMode }),
  ticketScanLatency: 0.4,
  setTicketScanLatency: (ticketScanLatency) => set({ ticketScanLatency }),
  securityScreeningLatency: 2.0,
  setSecurityScreeningLatency: (securityScreeningLatency) => set({ securityScreeningLatency }),
  ticketRejectionRate: 0.05,
  setTicketRejectionRate: (ticketRejectionRate) => set({ ticketRejectionRate }),
  auxiliaryBypassEnabled: true,
  toggleAuxiliaryBypass: () => set((state) => ({ auxiliaryBypassEnabled: !state.auxiliaryBypassEnabled })),
  microGateMetrics: null,
  setMicroGateMetrics: (microGateMetrics) => set({ microGateMetrics }),
  gateLogs: [
    {
      id: 'log-init',
      timestamp: '00:00:01',
      level: 'INFO',
      message: 'Gate simulation initialized with KSCA two-tier access architecture.',
      gateId: 'E11'
    }
  ],
  addGateLog: (level, message, gateId) =>
    set((state) => ({
      gateLogs: [
        {
          id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
          level,
          message,
          gateId
        },
        ...state.gateLogs.slice(0, 49)
      ]
    })),
  clearGateLogs: () => set({ gateLogs: [] }),
  setGateInflowOverride: (gateId, rate) =>
    set((state) => ({
      gateInflowOverrides: { ...state.gateInflowOverrides, [gateId]: rate }
    })),

  setBaggageScanLatency: (baggageScanLatency) =>
    set({ baggageScanLatency, securityCheckSpeed: baggageScanLatency }),

  setTurnstileScanLatency: (turnstileScanLatency) =>
    set({ turnstileScanLatency, scannerSpeed: turnstileScanLatency, gateLatency: turnstileScanLatency }),

  toggleCounterFlow: () =>
    set((state) => ({ counterFlowActive: !state.counterFlowActive })),

  setCounterFlowActive: (counterFlowActive) =>
    set({ counterFlowActive }),

  setSectorTurnstileCount: (gateId, count) =>
    set((state) => ({
      sectorTurnstileOverrides: {
        ...state.sectorTurnstileOverrides,
        [gateId]: Math.max(1, Math.min(12, count))
      }
    })),

  setSectorTurnstileOverrides: (overrides) =>
    set((state) => ({
      sectorTurnstileOverrides: {
        ...state.sectorTurnstileOverrides,
        ...overrides
      }
    })),

  setScenario: (scenario) =>
    set((state) => ({
      scenario,
      dividerActive: scenario === 'bridge',
      bafflesActive: false,
      auxGateActive: false,
      overflowRerouteActive: false,
      scannerFailureActive: false,
      resetSignal: state.resetSignal + 1,
      telemetry: {
        ...state.telemetry,
        activeArrivalProfile: scenario === 'reversal' ? 'reversal' : 'steady',
        timeToTurbulence: null,
        densityTrend: 'stable',
        metroBurstActive: false,
        activeRerouteAlert: null
      }
    })),

  setViewMode: (viewMode) =>
    set((state) => ({
      viewMode,
      stadiumViewMode: viewMode === 'stadium' ? 'MACRO_VIEW' : 'MICRO_VIEW_EAST',
      resetSignal: state.resetSignal + 1
    })),

  setStadiumViewMode: (stadiumViewMode) =>
    set((state) => ({
      stadiumViewMode,
      viewMode: stadiumViewMode === 'MACRO_VIEW' ? 'stadium' : 'gate',
      resetSignal: state.resetSignal + 1
    })),

  setSelectedSector: (selectedSector) =>
    set((state) => {
      let roadSector: RoadSectorId = 'LINK_ROAD';
      if (selectedSector === 'CUBBON_ROAD' || selectedSector === 'NORTH') roadSector = 'CUBBON_ROAD';
      else if (selectedSector === 'LINK_ROAD' || selectedSector === 'EAST') roadSector = 'LINK_ROAD';
      else if (selectedSector === 'MG_ROAD' || selectedSector === 'SOUTH') roadSector = 'MG_ROAD';
      else if (selectedSector === 'QUEENS_ROAD' || selectedSector === 'WEST') roadSector = 'QUEENS_ROAD';

      return {
        selectedSector: roadSector,
        selectedRoadSector: roadSector,
        telemetry: {
          ...state.telemetry,
          selectedSector: roadSector
        }
      };
    }),

  setActiveSector: (activeSector) =>
    set((state) => {
      let mappedSector: StadiumSectorId = 'EAST';
      if (activeSector === 'G7-G11_SOUTH') mappedSector = 'SOUTH';
      else if (activeSector === 'G12-G15_WEST') mappedSector = 'WEST';
      else if (activeSector === 'G16-G21_NORTH') mappedSector = 'NORTH';

      return {
        activeSector,
        activeGateSector: activeSector,
        selectedSector: mappedSector,
        resetSignal: state.resetSignal + 1,
        telemetry: {
          ...state.telemetry,
          selectedSector: mappedSector
        }
      };
    }),

  setActiveGateSector: (activeGateSector) =>
    set((state) => {
      let mappedSector: StadiumSectorId = 'EAST';
      if (activeGateSector === 'G7-G11_SOUTH') mappedSector = 'SOUTH';
      else if (activeGateSector === 'G12-G15_WEST') mappedSector = 'WEST';
      else if (activeGateSector === 'G16-G21_NORTH') mappedSector = 'NORTH';

      return {
        activeSector: activeGateSector,
        activeGateSector,
        selectedSector: mappedSector,
        resetSignal: state.resetSignal + 1,
        telemetry: {
          ...state.telemetry,
          selectedSector: mappedSector
        }
      };
    }),

  setMatchPhase: (matchPhase) =>
    set((state) => {
      let east = 300;
      let north = 200;
      let south = 180;
      let west = 100;

      if (matchPhase === 'METRO_PEAK') {
        east = 950;
        north = 280;
        south = 220;
        west = 140;
      } else if (matchPhase === 'ANTHEM_RUSH') {
        east = 1100;
        north = 750;
        south = 550;
        west = 350;
      } else if (matchPhase === 'EGRESS') {
        east = 1200;
        north = 800;
        south = 600;
        west = 400;
      }

      const activeRate = state.activeSector === 'G16-G21_NORTH'
        ? north
        : state.activeSector === 'G7-G11_SOUTH'
        ? south
        : state.activeSector === 'G12-G15_WEST'
        ? west
        : east;

      return {
        matchPhase,
        inflowRate: activeRate,
        sectorInflow: {
          'G1-G6_EAST': east,
          'G16-G21_NORTH': north,
          'G7-G11_SOUTH': south,
          'G12-G15_WEST': west
        }
      };
    }),

  setSectorInflow: (sector, rate) =>
    set((state) => {
      const updated = { ...state.sectorInflow, [sector]: rate };
      const activeRate = sector === state.activeSector ? rate : state.inflowRate;
      return {
        sectorInflow: updated,
        inflowRate: activeRate
      };
    }),

  setInflowRate: (inflowRate) =>
    set((state) => {
      const rate = Math.max(30, Math.min(1200, inflowRate));
      return {
        inflowRate: rate,
        telemetry: {
          ...state.telemetry,
          estimatedTimeToFillHours: calculateTimeToFillHours(rate, state.stadiumSeatedCount, 35000)
        }
      };
    }),

  setGateLatency: (gateLatency) => set({ gateLatency: Math.max(0.5, Math.min(12.0, gateLatency)) }),
  setWalkingSpeed: (walkingSpeed) => set({ walkingSpeed: Math.max(0.5, Math.min(3.0, walkingSpeed)) }),

  setBafflesActive: (bafflesActive) => set({ bafflesActive }),
  toggleBaffles: () => set((state) => ({ bafflesActive: !state.bafflesActive })),

  setAuxGateActive: (auxGateActive) => set({ auxGateActive }),
  toggleAuxGate: () => set((state) => ({ auxGateActive: !state.auxGateActive })),

  toggleOverflowReroute: () =>
    set((state) => {
      const next = !state.overflowRerouteActive;
      return {
        overflowRerouteActive: next,
        auxGateActive: next // sync aux gate bypass
      };
    }),

  toggleScannerFailure: () =>
    set((state) => ({
      scannerFailureActive: !state.scannerFailureActive
    })),

  toggleAutonomousReroute: () =>
    set((state) => ({
      autonomousRerouteActive: !state.autonomousRerouteActive
    })),

  setAutonomousRerouteActive: (autonomousRerouteActive) =>
    set({ autonomousRerouteActive }),

  addCounter: (gateId) =>
    set((state) => {
      if (gateId === 'gate-1') {
        const next = Math.min(10, state.counterCountGate1 + 1);
        return { counterCountGate1: next, gate1CounterCount: next };
      } else {
        const next = Math.min(8, state.counterCountGate2 + 1);
        return { counterCountGate2: next, gate2CounterCount: next };
      }
    }),

  removeCounter: (gateId) =>
    set((state) => {
      if (gateId === 'gate-1') {
        const next = Math.max(2, state.counterCountGate1 - 1);
        return { counterCountGate1: next, gate1CounterCount: next };
      } else {
        const next = Math.max(1, state.counterCountGate2 - 1);
        return { counterCountGate2: next, gate2CounterCount: next };
      }
    }),

  addSecurityCounter: (gateId) =>
    set((state) => {
      if (gateId === 'gate-1') {
        const next = Math.min(10, state.counterCountGate1 + 1);
        return { counterCountGate1: next, gate1CounterCount: next };
      } else {
        const next = Math.min(8, state.counterCountGate2 + 1);
        return { counterCountGate2: next, gate2CounterCount: next };
      }
    }),

  removeSecurityCounter: (gateId) =>
    set((state) => {
      if (gateId === 'gate-1') {
        const next = Math.max(2, state.counterCountGate1 - 1);
        return { counterCountGate1: next, gate1CounterCount: next };
      } else {
        const next = Math.max(1, state.counterCountGate2 - 1);
        return { counterCountGate2: next, gate2CounterCount: next };
      }
    }),

  setCounterCount: (gateId, count) =>
    set(() => {
      if (gateId === 'gate-1') {
        const clamped = Math.max(2, Math.min(10, Math.round(count)));
        return { counterCountGate1: clamped, gate1CounterCount: clamped };
      } else {
        const clamped = Math.max(1, Math.min(8, Math.round(count)));
        return { counterCountGate2: clamped, gate2CounterCount: clamped };
      }
    }),

  setSQueueEnabled: (sQueueEnabled) => set({ sQueueEnabled }),
  setScannerSpeed: (scannerSpeed) => set({ scannerSpeed: Math.max(0.05, scannerSpeed) }),
  setSecurityCheckSpeed: (securityCheckSpeed) => set({ securityCheckSpeed: Math.max(0.2, securityCheckSpeed) }),

  setDividerActive: (dividerActive) => set({ dividerActive }),
  toggleDivider: () => set((state) => ({ dividerActive: !state.dividerActive })),

  setIsPaused: (isPaused) => set({ isPaused }),
  togglePause: () => set((state) => ({ isPaused: !state.isPaused })),

  setTimeScale: (timeScale) => set({ timeScale }),

  triggerReset: () => set((state) => ({ resetSignal: state.resetSignal + 1 })),

  triggerSurgeWave: (count = 45) =>
    set((state) => ({
      surgeSignal: state.surgeSignal + 1,
      surgeCount: count,
      telemetry: {
        ...state.telemetry,
        activeArrivalProfile: 'burst'
      }
    })),

  triggerMetroPulse: () =>
    set((state) => ({
      metroPulseSignal: state.metroPulseSignal + 1,
      surgeSignal: state.surgeSignal + 1,
      surgeCount: 400,
      telemetry: {
        ...state.telemetry,
        metroBurstActive: true,
        activeArrivalProfile: 'burst'
      }
    })),

  triggerBurstRush: (count = 500) =>
    set((state) => ({
      surgeSignal: state.surgeSignal + 1,
      surgeCount: count,
      telemetry: {
        ...state.telemetry,
        activeArrivalProfile: 'burst',
        burstRateAnalysis: {
          excessPeoplePerMin: 320,
          timeToGridlockSeconds: 16.5
        }
      }
    })),

  incrementSeatedCount: (amount) =>
    set((state) => {
      const newCount = Math.min(35000, state.stadiumSeatedCount + amount);
      const fillPercentage = Math.round((newCount / 35000) * 100);
      const hoursRemaining = calculateTimeToFillHours(state.inflowRate, newCount, 35000);
      return {
        stadiumSeatedCount: newCount,
        telemetry: {
          ...state.telemetry,
          stadiumFillPercentage: fillPercentage,
          estimatedTimeToFillHours: hoursRemaining
        }
      };
    }),

  setTelemetry: (data) =>
    set((state) => {
      const merged = { ...state.telemetry, ...data };
      if (data.peakDensity !== undefined || data.spillbackMeters !== undefined) {
        merged.crushProbabilityIndex = calculateCrushProbabilityIndex(
          merged.peakDensity,
          merged.isCritical ? 24 : 8,
          merged.spillbackMeters
        );
      }
      return { telemetry: merged };
    }),

  setIsModalOpen: (isModalOpen) => set({ isModalOpen }),
  toggleModal: () => set((state) => ({ isModalOpen: !state.isModalOpen })),
  setIsBenchmarkOpen: (isBenchmarkOpen) => set({ isBenchmarkOpen }),
  toggleBenchmark: () => set((state) => ({ isBenchmarkOpen: !state.isBenchmarkOpen })),
  setAppMode: (appMode) => set({ appMode }),

  /**
   * Simultaneously activates Upstream Baffles and Gates 4–6 Auxiliary Bypass
   */
  applyMitigationPreset: () =>
    set((state) => {
      const willEnable = !(state.bafflesActive && (state.auxGateActive || state.overflowRerouteActive));
      return {
        bafflesActive: willEnable,
        auxGateActive: willEnable,
        overflowRerouteActive: willEnable
      };
    }),

  // Master Safety Workflow Implementations
  setExperiment: (type) => {
    const config = PRESET_SCENARIOS[type];
    set((state) => ({
      activeExperiment: type,
      scenarioConfig: config,
      inflowRate: config.baseInflowRate,
      counterFlowActive: type === 'COUNTER_FLOW',
      scannerFailureActive: type === 'GATE_FAILURE',
      resetSignal: state.resetSignal + 1
    }));
  },

  setComparativeAudit: (comparativeAudit) => set({ comparativeAudit }),
  setVerdict: (currentVerdict) => set({ currentVerdict }),
  setInteractionAnalysis: (interactionAnalysis) => set({ interactionAnalysis }),
  setControllerDecisions: (controllerDecisions) => set({ controllerDecisions }),

  triggerIntervention: (type, enabled) => {
    set((state) => {
      if (type === 'METERING') {
        const next = enabled !== undefined ? enabled : !state.bafflesActive;
        return { bafflesActive: next };
      }
      if (type === 'REROUTING') {
        const next = enabled !== undefined ? enabled : !state.overflowRerouteActive;
        return { overflowRerouteActive: next, auxGateActive: next };
      }
      if (type === 'DIRECTIONAL_SEPARATION') {
        const next = enabled !== undefined ? enabled : !state.dividerActive;
        return { dividerActive: next };
      }
      if (type === 'QUEUE_MANAGEMENT') {
        const next = enabled !== undefined ? enabled : !state.sQueueEnabled;
        return { sQueueEnabled: next };
      }
      return {};
    });
  }
}));
