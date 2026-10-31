import { create } from 'zustand';
import {
  Venue,
  InflowConfig,
  Intervention,
  Incident,
  SimulationEvent,
  OperatorRecommendation,
  PublicAnnouncement,
  SimulationMetricsSummary,
  CounterfactualComparison,
  RenderLayers,
  RenderDetailLevel,
  Gate,
  Zone,
  StadiumSide,
  GateSideSimConfig,
  GateSideEvent,
  GateEntrySnapshot,
  CounterStatus,
  GateOperationalControlState,
  GateArrivalSchedule,
  DemonstrationProfileType,
  OverflowDoorConfig,
} from '../types';
import { SimulationEngine } from '../engine/SimulationEngine';
import { SpatialAnalyzer } from '../engine/SpatialAnalyzer';
import { CHINNASWAMY_STADIUM_PROFILE } from '../data/chinnaswamyStadium';
import { OPEN_FESTIVAL_PROFILE } from '../data/openFestival';
import { STREET_GATHERING_PROFILE } from '../data/streetGathering';
import { SCENARIOS } from '../data/scenarios';
import { DEFAULT_INTERVENTIONS } from '../data/interventions';
import { INITIAL_ANNOUNCEMENTS } from '../data/announcements';

export type NavigationTab =
  | 'command-centre'
  | 'digital-twin'
  | 'crowd-inflow'
  | 'scenario-lab'
  | 'gate-operations'
  | 'incident-response'
  | 'reports-history'
  | 'settings'
  | 'gate-detail'
  | 'gate-closure'
  | 'model-validation'
  | 'multi-directional'
  | 'spatial-risk';

export type SimulationMode = 'PLANNING' | 'SIMULATION' | 'DEMO_LIVE';

interface SimulationStoreState {
  // Navigation & Mode
  activeTab: NavigationTab;
  setActiveTab: (tab: NavigationTab) => void;
  simulationMode: SimulationMode;
  setSimulationMode: (mode: SimulationMode) => void;

  // Simulation Engine & State
  engine: SimulationEngine;
  isRunning: boolean;
  isPaused: boolean;
  simTimeSecs: number;
  speedMultiplier: number;
  randomSeed: number;

  // Current Venue & Selection
  currentVenue: Venue;
  selectedGateId: string | null;
  selectedZoneId: string | null;
  setSelectedGateId: (id: string | null) => void;
  setSelectedZoneId: (id: string | null) => void;
  setVenueProfile: (venueId: string) => void;
  updateGate: (gateId: string, updates: Partial<Gate>) => void;
  updateZone: (zoneId: string, updates: Partial<Zone>) => void;

  // 12-Gate Scanner Counter & Admission Control Actions
  toggleCounter: (gateId: string, counterId: string) => void;
  setCounterServiceRate: (gateId: string, counterId: string, rate: number) => void;
  setGateOperationalControlState: (gateId: string, state: GateOperationalControlState) => void;
  setGateAssignedSpectators: (gateId: string, count: number) => void;
  setGateArrivalSchedule: (gateId: string, schedule: Partial<GateArrivalSchedule>) => void;
  setGateArrivalRate: (gateId: string, rate: number) => void;
  failCounters: (gateId: string, count: number) => void;
  recoverCounter: (gateId: string, counterIndex: number) => void;
  restoreAllCounters: (gateId: string) => void;
  setGateLaneBalancingEnabled: (gateId: string, enabled: boolean) => void;
  setupMultiGateCongestionDemo: () => void;
  setDemonstrationProfile: (gateId: string, profile: DemonstrationProfileType) => void;
  startArrivals: (gateId: string) => void;
  pauseArrivals: (gateId: string) => void;
  resumeArrivals: (gateId: string) => void;
  stopArrivals: (gateId: string) => void;
  addArrivalSurge: (gateId: string, count: number) => void;
  resetGateSimulation: (gateId: string) => void;
  setGateOverflowConfig: (gateId: string, updates: Partial<OverflowDoorConfig>) => void;
  setOverflowDoorOverride: (gateId: string, override: 'AUTO' | 'FORCE_OPEN' | 'FORCE_CLOSED') => void;

  // Gate-Side Simulation
  focusedSide: StadiumSide;
  setFocusedSide: (side: StadiumSide) => void;
  selectedGateIds: string[];
  setSelectedGateIds: (ids: string[]) => void;
  gateSideConfig: GateSideSimConfig;
  updateGateSideConfig: (updates: Partial<GateSideSimConfig>) => void;
  applyInitialQueue: (count: number, gateIds?: string[]) => void;
  resetGateSideSim: () => void;
  gateSideEvents: GateSideEvent[];
  gateEntryHistory: GateEntrySnapshot[];

  // Scenarios & Interventions
  activeScenarioId: string;
  setActiveScenarioId: (id: string) => void;
  interventions: Intervention[];
  toggleIntervention: (id: string) => void;
  setInterventionParam: (id: string, key: string, value: any) => void;

  // Inflow Configuration
  inflowConfig: InflowConfig;
  updateInflowConfig: (updates: Partial<InflowConfig>) => void;

  // Rendering Layers & Controls
  layers: RenderLayers;
  toggleLayer: (layer: keyof RenderLayers) => void;
  detailLevel: RenderDetailLevel;
  setDetailLevel: (level: RenderDetailLevel) => void;

  // Real-time Collections from Engine
  events: SimulationEvent[];
  recommendations: OperatorRecommendation[];
  announcements: PublicAnnouncement[];
  incidents: Incident[];
  metricsSummary: SimulationMetricsSummary;
  metricsHistory: SimulationMetricsSummary[];

  // Actions
  startSimulation: () => void;
  pauseSimulation: () => void;
  resumeSimulation: () => void;
  resetSimulation: () => void;
  stepForward: (dt?: number) => void;
  setSpeedMultiplier: (speed: number) => void;
  setRandomSeed: (seed: number) => void;
  triggerActiveScenario: () => void;
  approveRecommendation: (recId: string) => void;
  broadcastAnnouncement: (annId: string) => void;
  addAnnouncement: (ann: Omit<PublicAnnouncement, 'id' | 'timestamp' | 'broadcasted'>) => void;
  addHypotheticalIncident: (incident: Omit<Incident, 'id' | 'timestamp' | 'status'>) => void;

  // Counterfactual Lab
  comparisons: CounterfactualComparison[];
  activeComparisonId: string | null;
  setActiveComparisonId: (id: string | null) => void;
  runCounterfactualComparison: (scenarioId: string, interventionIds: string[]) => void;

  // Periodic UI Syncer
  syncFromEngine: () => void;
}

const initialVenue = CHINNASWAMY_STADIUM_PROFILE;
const initialEngine = new SimulationEngine(initialVenue, 1337);


export const SIDE_GATES: Record<StadiumSide, string[]> = {
  ALL: [],
  NORTH: ['gate-n1', 'gate-n2', 'gate-n3'],
  EAST: ['gate-e1', 'gate-e2', 'gate-e3'],
  SOUTH: ['gate-s1', 'gate-s2', 'gate-s3'],
  WEST: ['gate-w1', 'gate-w2', 'gate-w3'],
  CUSTOM: [],
};

export const getSideForGate = (gateId: string): StadiumSide => {
  if (['gate-n1', 'gate-n2', 'gate-n3', 'gate-1', 'gate-2', 'gate-3', 'gate-4', 'gate-5'].includes(gateId)) return 'NORTH';
  if (['gate-e1', 'gate-e2', 'gate-e3', 'gate-17', 'gate-18', 'gate-19', 'gate-20', 'gate-21'].includes(gateId)) return 'EAST';
  if (['gate-s1', 'gate-s2', 'gate-s3', 'gate-11', 'gate-12', 'gate-13', 'gate-14', 'gate-15', 'gate-16'].includes(gateId)) return 'SOUTH';
  if (['gate-w1', 'gate-w2', 'gate-w3', 'gate-6', 'gate-7', 'gate-8', 'gate-9', 'gate-10'].includes(gateId)) return 'WEST';
  return 'NORTH';
};

export const useSimulationStore = create<SimulationStoreState>((set, get) => ({
  activeTab: 'command-centre',
  setActiveTab: (tab) => {
    if (tab === 'gate-detail' && !get().selectedGateId) {
      const defaultGate =
        get().currentVenue.gates.find((g) => g.id === 'gate-e2' || g.id === 'gate-n2') ||
        get().currentVenue.gates[0];
      if (defaultGate) {
        get().setSelectedGateId(defaultGate.id);
      }
    }
    set({ activeTab: tab });
  },
  simulationMode: 'SIMULATION',
  setSimulationMode: (mode) => set({ simulationMode: mode }),

  engine: initialEngine,
  isRunning: false,
  isPaused: false,
  simTimeSecs: 0,
  speedMultiplier: 1.0,
  randomSeed: 1337,

  currentVenue: initialVenue,
  selectedGateId: null,
  selectedZoneId: null,
  focusedSide: 'ALL',
  selectedGateIds: [],
  gateSideConfig: {
    selectedSide: 'ALL',
    selectedGateIds: [],
    inflowRatePerMin: 120,
    arrivalPattern: 'GRADUAL',
    processingRatePerSec: 1.0,
    initialQueue: 0,
    routingPolicy: 'SHORTEST_QUEUE',
    spillbackThreshold: 80,
    durationSecs: 300,
  },
  gateSideEvents: [],
  gateEntryHistory: [],

  setSelectedGateId: (id) => {
    const { engine, gateSideConfig } = get();
    if (id) {
      const side = getSideForGate(id);
      const updatedConfig = {
        ...gateSideConfig,
        selectedSide: side,
        selectedGateIds: [id],
      };
      engine.setGateSideConfig(updatedConfig);
      set({
        selectedGateId: id,
        focusedSide: side,
        selectedGateIds: [id],
        gateSideConfig: updatedConfig,
      });
    } else {
      const updatedConfig = {
        ...gateSideConfig,
        selectedSide: 'ALL' as StadiumSide,
        selectedGateIds: [],
      };
      engine.setGateSideConfig(updatedConfig);
      set({
        selectedGateId: null,
        focusedSide: 'ALL',
        selectedGateIds: [],
        gateSideConfig: updatedConfig,
      });
    }
  },

  setFocusedSide: (side) => {
    const { engine, gateSideConfig, selectedGateIds } = get();
    let gateIds: string[] = [];
    if (side === 'ALL') {
      gateIds = [];
    } else if (side === 'CUSTOM') {
      gateIds = selectedGateIds.length > 0 ? selectedGateIds : ['gate-n2'];
    } else {
      gateIds = SIDE_GATES[side];
    }

    const updatedConfig = {
      ...gateSideConfig,
      selectedSide: side,
      selectedGateIds: gateIds,
    };
    engine.setGateSideConfig(updatedConfig);
    set({
      focusedSide: side,
      selectedGateIds: gateIds,
      selectedGateId: gateIds.length > 0 ? gateIds[0] : null,
      gateSideConfig: updatedConfig,
    });
  },

  setSelectedGateIds: (ids) => {
    const { engine, gateSideConfig } = get();
    const updatedConfig = {
      ...gateSideConfig,
      selectedGateIds: ids,
      selectedSide: ids.length > 0 ? ('CUSTOM' as StadiumSide) : ('ALL' as StadiumSide),
    };
    engine.setGateSideConfig(updatedConfig);
    set({
      selectedGateIds: ids,
      focusedSide: ids.length > 0 ? 'CUSTOM' : 'ALL',
      selectedGateId: ids.length > 0 ? ids[0] : null,
      gateSideConfig: updatedConfig,
    });
  },

  updateGateSideConfig: (updates) => {
    const { engine, gateSideConfig } = get();
    const updated = { ...gateSideConfig, ...updates };
    engine.setGateSideConfig(updated);
    set({ gateSideConfig: updated });
  },

  applyInitialQueue: (count, gateIds) => {
    const { engine, selectedGateIds } = get();
    const targets = gateIds && gateIds.length > 0 ? gateIds : selectedGateIds;
    engine.applyInitialQueue(count, targets);
    get().syncFromEngine();
  },

  resetGateSideSim: () => {
    const { engine } = get();
    engine.reset();
    get().syncFromEngine();
  },

  setSelectedZoneId: (id) => set({ selectedZoneId: id }),

  setVenueProfile: (venueId: string) => {
    let v: Venue = CHINNASWAMY_STADIUM_PROFILE;
    if (venueId === 'open-festival') v = OPEN_FESTIVAL_PROFILE;
    else if (venueId === 'street-gathering') v = STREET_GATHERING_PROFILE;

    const { engine } = get();
    engine.setVenue(v);
    set({
      currentVenue: JSON.parse(JSON.stringify(v)),
      selectedGateId: null,
      selectedZoneId: null,
    });
    get().syncFromEngine();
  },

  updateGate: (gateId, updates) => {
    const { currentVenue, engine } = get();
    const updatedGates = currentVenue.gates.map((g) => (g.id === gateId ? { ...g, ...updates } : g));
    const newVenue = { ...currentVenue, gates: updatedGates };
    engine.state.venue = JSON.parse(JSON.stringify(newVenue));
    set({ currentVenue: newVenue });
  },

  updateZone: (zoneId, updates) => {
    const { currentVenue, engine } = get();
    const updatedZones = currentVenue.zones.map((z) => (z.id === zoneId ? { ...z, ...updates } : z));
    const newVenue = { ...currentVenue, zones: updatedZones };
    engine.state.venue = JSON.parse(JSON.stringify(newVenue));
    set({ currentVenue: newVenue });
  },

  toggleCounter: (gateId, counterId) => {
    const { currentVenue } = get();
    const gate = currentVenue.gates.find((g) => g.id === gateId);
    if (!gate || !gate.counters) return;

    const updatedCounters = gate.counters.map((c) => {
      if (c.id === counterId) {
        return {
          ...c,
          status: (c.status === 'OPERATIONAL' ? 'FAILED' : 'OPERATIONAL') as CounterStatus,
        };
      }
      return c;
    });

    const activeCount = updatedCounters.filter((c) => c.status === 'OPERATIONAL').length;
    const isAllFailed = activeCount === 0;

    const updates: Partial<Gate> = {
      counters: updatedCounters,
      operationalScanners: activeCount,
      status: isAllFailed
        ? 'SCANNER_FAILURE'
        : (activeCount < gate.scannerCount ? 'BUSY' : 'OPERATIONAL'),
      operationalControlState: isAllFailed
        ? 'ADMISSION_PAUSED'
        : (gate.operationalControlState === 'ADMISSION_PAUSED' ? 'RECOVERY' : gate.operationalControlState),
      warningLevel: isAllFailed
        ? 'CRITICAL'
        : (activeCount < gate.scannerCount ? 'HIGH' : 'NORMAL'),
    };

    get().updateGate(gateId, updates);
    get().syncFromEngine();
  },

  setCounterServiceRate: (gateId, counterId, rate) => {
    const { currentVenue } = get();
    const gate = currentVenue.gates.find((g) => g.id === gateId);
    if (!gate || !gate.counters) return;

    const updatedCounters = gate.counters.map((c) =>
      c.id === counterId ? { ...c, serviceRatePerSec: Math.max(0.1, rate) } : c
    );
    get().updateGate(gateId, { counters: updatedCounters });
    get().syncFromEngine();
  },

  setGateOperationalControlState: (gateId, state) => {
    get().updateGate(gateId, { operationalControlState: state });
    get().syncFromEngine();
  },

  setGateAssignedSpectators: (gateId, count) => {
    get().updateGate(gateId, { assignedSpectatorCount: Math.max(0, count) });
    get().syncFromEngine();
  },

  setGateArrivalSchedule: (gateId, schedule) => {
    const { currentVenue } = get();
    const gate = currentVenue.gates.find((g) => g.id === gateId);
    if (!gate) return;
    const currentSchedule = gate.arrivalSchedule || {
      mode: 'RATE',
      arrivalRatePerMin: 100,
    };
    get().updateGate(gateId, { arrivalSchedule: { ...currentSchedule, ...schedule } });
    get().syncFromEngine();
  },

  setGateArrivalRate: (gateId: string, rate: number) => {
    const { currentVenue, engine } = get();
    const gate = currentVenue.gates.find((g) => g.id === gateId);
    if (!gate) return;
    get().updateGate(gateId, { arrivalRatePerMin: Math.max(0, rate) });
    const targetEngineGate = engine.state.venue.gates.find((g) => g.id === gateId);
    if (targetEngineGate) {
      targetEngineGate.arrivalRatePerMin = Math.max(0, rate);
    }
    get().syncFromEngine();
  },

  failCounters: (gateId: string, count: number) => {
    const { currentVenue, engine } = get();
    const gate = currentVenue.gates.find((g) => g.id === gateId);
    if (!gate || !gate.counters) return;

    const totalCounters = gate.counters.length;
    const targetFail = Math.min(totalCounters, Math.max(0, count));

    const updatedCounters = gate.counters.map((c, idx) => ({
      ...c,
      status: (idx < targetFail ? 'FAILED' : 'OPERATIONAL') as CounterStatus,
    }));

    const activeCount = updatedCounters.filter((c) => c.status === 'OPERATIONAL').length;
    const isAllFailed = activeCount === 0;

    const updates: Partial<Gate> = {
      counters: updatedCounters,
      operationalScanners: activeCount,
      status: isAllFailed
        ? 'SCANNER_FAILURE'
        : (activeCount < gate.scannerCount ? 'BUSY' : 'OPERATIONAL'),
      operationalControlState: isAllFailed
        ? 'ADMISSION_PAUSED'
        : (gate.operationalControlState === 'ADMISSION_PAUSED' ? 'RECOVERY' : gate.operationalControlState),
      warningLevel: isAllFailed
        ? 'CRITICAL'
        : (activeCount < gate.scannerCount ? 'HIGH' : 'NORMAL'),
    };

    get().updateGate(gateId, updates);
    const targetEngineGate = engine.state.venue.gates.find((g) => g.id === gateId);
    if (targetEngineGate) {
      Object.assign(targetEngineGate, updates);
    }
    get().syncFromEngine();
  },

  setGateLaneBalancingEnabled: (gateId: string, enabled: boolean) => {
    const { currentVenue, engine } = get();
    get().updateGate(gateId, { laneBalancingEnabled: enabled });
    const targetEngineGate = engine.state.venue.gates.find((g) => g.id === gateId);
    if (targetEngineGate) {
      targetEngineGate.laneBalancingEnabled = enabled;
    }
    get().syncFromEngine();
  },

  recoverCounter: (gateId: string, counterIndex: number) => {
    const { currentVenue, engine } = get();
    const gate = currentVenue.gates.find((g) => g.id === gateId);
    if (!gate || !gate.counters || counterIndex >= gate.counters.length) return;

    const updatedCounters = gate.counters.map((c, idx) =>
      idx === counterIndex ? { ...c, status: 'OPERATIONAL' as CounterStatus } : c
    );
    const activeCount = updatedCounters.filter((c) => c.status === 'OPERATIONAL').length;

    const updates: Partial<Gate> = {
      counters: updatedCounters,
      operationalScanners: activeCount,
      status: activeCount < gate.scannerCount ? 'BUSY' : 'OPERATIONAL',
      operationalControlState: 'NORMAL',
      warningLevel: activeCount < gate.scannerCount ? 'HIGH' : 'NORMAL',
    };

    get().updateGate(gateId, updates);
    const targetEngineGate = engine.state.venue.gates.find((g) => g.id === gateId);
    if (targetEngineGate) {
      Object.assign(targetEngineGate, updates);
    }
    get().syncFromEngine();
  },

  restoreAllCounters: (gateId: string) => {
    const { currentVenue, engine } = get();
    const gate = currentVenue.gates.find((g) => g.id === gateId);
    if (!gate || !gate.counters) return;

    const updatedCounters = gate.counters.map((c) => ({
      ...c,
      status: 'OPERATIONAL' as CounterStatus,
    }));

    const updates: Partial<Gate> = {
      counters: updatedCounters,
      operationalScanners: updatedCounters.length,
      status: 'OPERATIONAL',
      operationalControlState: 'NORMAL',
      warningLevel: 'NORMAL',
    };

    get().updateGate(gateId, updates);
    const targetEngineGate = engine.state.venue.gates.find((g) => g.id === gateId);
    if (targetEngineGate) {
      Object.assign(targetEngineGate, updates);
    }
    get().syncFromEngine();
  },

  setupMultiGateCongestionDemo: () => {
    const { currentVenue, engine } = get();
    engine.reset();

    const updatedGates = currentVenue.gates.map((g) => {
      if (g.id === 'gate-e2') {
        return {
          ...g,
          arrivalRatePerMin: 240,
          operationalScanners: 3,
          warningLevel: 'NORMAL' as const,
          counters: (g.counters || []).map((c) => ({ ...c, status: 'OPERATIONAL' as const, serviceRatePerSec: 1.0 })),
        };
      } else if (g.id === 'gate-e3') {
        return {
          ...g,
          arrivalRatePerMin: 60,
          operationalScanners: 3,
          warningLevel: 'NORMAL' as const,
          counters: (g.counters || []).map((c) => ({ ...c, status: 'OPERATIONAL' as const, serviceRatePerSec: 1.0 })),
        };
      } else if (g.gateType === 'REGULAR') {
        return {
          ...g,
          arrivalRatePerMin: 120,
          operationalScanners: 3,
          warningLevel: 'NORMAL' as const,
          counters: (g.counters || []).map((c) => ({ ...c, status: 'OPERATIONAL' as const, serviceRatePerSec: 1.0 })),
        };
      }
      return g;
    });

    const newVenue = { ...currentVenue, gates: updatedGates };
    engine.state.venue = JSON.parse(JSON.stringify(newVenue));

    engine.setGateSideConfig({
      selectedSide: 'ALL',
      selectedGateIds: [],
    });

    set({
      currentVenue: newVenue,
      selectedGateIds: [],
      focusedSide: 'ALL',
      selectedGateId: 'gate-e2',
      gateSideConfig: {
        selectedSide: 'ALL',
        selectedGateIds: [],
        inflowRatePerMin: 120,
        arrivalPattern: 'GRADUAL',
        processingRatePerSec: 1.0,
        initialQueue: 0,
        routingPolicy: 'SHORTEST_QUEUE',
        spillbackThreshold: 80,
        durationSecs: 300,
      },
    });

    engine.start();
    set({ isRunning: true, isPaused: false });
    get().syncFromEngine();
  },

  setDemonstrationProfile: (gateId, profile) => {
    const { engine } = get();
    engine.setDemonstrationProfile(gateId, profile);
    get().syncFromEngine();
  },

  startArrivals: (gateId) => {
    const { engine } = get();
    engine.startArrivals(gateId);
    get().syncFromEngine();
  },

  pauseArrivals: (gateId) => {
    const { engine } = get();
    engine.pauseArrivals(gateId);
    get().syncFromEngine();
  },

  resumeArrivals: (gateId) => {
    const { engine } = get();
    engine.resumeArrivals(gateId);
    get().syncFromEngine();
  },

  stopArrivals: (gateId) => {
    const { engine } = get();
    engine.stopArrivals(gateId);
    get().syncFromEngine();
  },

  addArrivalSurge: (gateId, count) => {
    const { engine } = get();
    engine.addArrivalSurge(gateId, count);
    get().syncFromEngine();
  },

  resetGateSimulation: (gateId) => {
    const { engine } = get();
    engine.resetGateSimulation(gateId);
    get().syncFromEngine();
  },

  setGateOverflowConfig: (gateId, updates) => {
    const { engine } = get();
    engine.setGateOverflowConfig(gateId, updates);
    get().syncFromEngine();
  },

  setOverflowDoorOverride: (gateId, override) => {
    const { engine } = get();
    engine.setOverflowDoorOverride(gateId, override);
    get().syncFromEngine();
  },

  activeScenarioId: 'chinnaswamy-hypothetical-surge',
  setActiveScenarioId: (id) => set({ activeScenarioId: id }),

  interventions: DEFAULT_INTERVENTIONS,
  toggleIntervention: (id) => {
    const { interventions, engine } = get();
    const updated = interventions.map((item) =>
      item.id === id ? { ...item, isActive: !item.isActive } : item
    );
    engine.setInterventions(updated);
    set({ interventions: updated });
  },

  setInterventionParam: (id, key, value) => {
    const { interventions, engine } = get();
    const updated = interventions.map((item) =>
      item.id === id ? { ...item, params: { ...item.params, [key]: value } } : item
    );
    engine.setInterventions(updated);
    set({ interventions: updated });
  },

  inflowConfig: initialEngine.state.inflowConfig,
  updateInflowConfig: (updates) => {
    const { engine } = get();
    engine.setInflowConfig(updates);
    set({ inflowConfig: { ...get().inflowConfig, ...updates } });
  },

  layers: {
    venueLayout: true,
    animatedCrowd: true,
    densityHeatmap: true,
    spatialComparison: false,
    flowArrows: false,
    queueVisuals: true,
    gateStatus: true,
    emergencyRoutes: true,
    incidentMarkers: true,
    riskZones: true,
    gridReference: true,
  },
  toggleLayer: (layer) => {
    set((state) => ({
      layers: { ...state.layers, [layer]: !state.layers[layer] },
    }));
  },

  detailLevel: 'DETAILED',
  setDetailLevel: (detailLevel) => set({ detailLevel }),

  events: [],
  recommendations: [],
  announcements: INITIAL_ANNOUNCEMENTS,
  incidents: [],
  metricsSummary: initialEngine.getSummary(),
  metricsHistory: [],

  startSimulation: () => {
    const { engine } = get();
    engine.start();
    set({ isRunning: true, isPaused: false });
  },

  pauseSimulation: () => {
    const { engine } = get();
    engine.pause();
    set({ isPaused: true });
  },

  resumeSimulation: () => {
    const { engine } = get();
    engine.resume();
    set({ isPaused: false });
  },

  resetSimulation: () => {
    const { engine } = get();
    engine.reset();
    set({
      isRunning: false,
      isPaused: false,
      simTimeSecs: 0,
      events: [],
      recommendations: [],
      metricsSummary: engine.getSummary(),
      currentVenue: JSON.parse(JSON.stringify(engine.state.venue)),
    });
  },

  stepForward: (dt = 0.5) => {
    const { engine } = get();
    engine.step(dt);
    get().syncFromEngine();
  },

  setSpeedMultiplier: (speed) => {
    const { engine } = get();
    engine.setSpeed(speed);
    set({ speedMultiplier: speed });
  },

  setRandomSeed: (seed) => {
    const { engine } = get();
    engine.setSeed(seed);
    set({ randomSeed: seed });
  },

  triggerActiveScenario: () => {
    const { engine, activeScenarioId } = get();
    engine.triggerScenario(activeScenarioId);
    get().syncFromEngine();
  },

  approveRecommendation: (recId) => {
    const { recommendations, interventions, toggleIntervention } = get();
    const updated = recommendations.map((r) => (r.id === recId ? { ...r, approved: true } : r));
    set({ recommendations: updated });

    // Enable route redirection intervention automatically upon approval
    const reroute = interventions.find((i) => i.category === 'REROUTE_APPROACH');
    if (reroute && !reroute.isActive) {
      toggleIntervention(reroute.id);
    }
  },

  broadcastAnnouncement: (annId) => {
    const { announcements } = get();
    const updated = announcements.map((a) => (a.id === annId ? { ...a, broadcasted: true } : a));
    set({ announcements: updated });
  },

  addAnnouncement: (ann) => {
    const newAnn: PublicAnnouncement = {
      id: `ann-${Date.now()}`,
      timestamp: get().simTimeSecs,
      broadcasted: true,
      ...ann,
    };
    set((state) => ({ announcements: [newAnn, ...state.announcements] }));
  },

  addHypotheticalIncident: (incident) => {
    const { engine, simTimeSecs } = get();
    const newInc: Incident = {
      id: `inc-${Date.now()}`,
      timestamp: simTimeSecs,
      status: 'REPORTED',
      ...incident,
    };
    engine.addIncident(newInc);
    get().syncFromEngine();
  },

  comparisons: [],
  activeComparisonId: null,
  setActiveComparisonId: (id) => set({ activeComparisonId: id }),
  runCounterfactualComparison: (scenarioId, interventionIds) => {
    const { currentVenue, randomSeed, inflowConfig, interventions } = get();

    // 1. Run Baseline (Without selected interventions)
    const baseEngine = new SimulationEngine(currentVenue, randomSeed);
    baseEngine.setInflowConfig(inflowConfig);
    baseEngine.setInterventions(interventions.map((i) => ({ ...i, isActive: false })));
    baseEngine.start();
    baseEngine.triggerScenario(scenarioId);

    // Simulate 3 minutes (180 secs) of scenario progression
    for (let t = 0; t < 180; t += 0.1) {
      baseEngine.step(0.1);
    }
    const baselineMetrics = baseEngine.getSummary();

    // 2. Run Intervention Plan (With specified interventions enabled)
    const planEngine = new SimulationEngine(currentVenue, randomSeed);
    planEngine.setInflowConfig(inflowConfig);
    const planInterventions = interventions.map((i) => ({
      ...i,
      isActive: interventionIds.includes(i.id),
    }));
    planEngine.setInterventions(planInterventions);
    planEngine.start();
    planEngine.triggerScenario(scenarioId);

    for (let t = 0; t < 180; t += 0.1) {
      planEngine.step(0.1);
    }
    const planMetrics = planEngine.getSummary();

    // 3. Zone-by-Zone Spatial Analysis & Transferred Risk Detection
    const scDef = SCENARIOS.find((s) => s.id === scenarioId);
    const appliedNames = planInterventions.filter((i) => i.isActive).map((i) => i.name);
    const { zoneComparisons, spatialSummary } = SpatialAnalyzer.analyze(
      currentVenue,
      baseEngine,
      planEngine,
      scDef?.name || 'Scenario',
      appliedNames
    );

    // Determine Trade-off analysis
    const queueDiff = baselineMetrics.peakQueueLength - planMetrics.peakQueueLength;
    let verdict = spatialSummary.spatialVerdict;
    let benefit = queueDiff > 0
      ? `Reduced peak perimeter queue by ${queueDiff} attendees.`
      : 'Maintained queue throughput within design parameters.';
    if (spatialSummary.largestRelief) {
      benefit += ` Max density reduction in ${spatialSummary.largestRelief.zoneName} (${spatialSummary.largestRelief.deltaDensity.toFixed(2)} p/m²).`;
    }

    let downstreamRisk = 'No significant transferred bottlenecks detected.';
    if (spatialSummary.riskTransferred) {
      if (spatialSummary.worstDensityIncrease) {
        downstreamRisk = `Crowd diverted into ${spatialSummary.worstDensityIncrease.zoneName} (+ ${spatialSummary.worstDensityIncrease.deltaDensity.toFixed(2)} p/m², final ${spatialSummary.worstDensityIncrease.finalDensity.toFixed(1)} p/m²). Requires secondary stewards.`;
      } else {
        downstreamRisk = 'Downstream concourse sectors experienced secondary crowd accumulation.';
      }
    } else if (planMetrics.externalHoldingOccupancy > 1000) {
      downstreamRisk = `Auxiliary holding zone occupancy rose to ${planMetrics.externalHoldingOccupancy} attendees.`;
    }

    const compId = `comp-${Date.now()}`;
    const comp: CounterfactualComparison = {
      id: compId,
      name: `Counterfactual: ${scDef?.name || 'Scenario'}`,
      scenarioId,
      seed: randomSeed,
      timestamp: new Date().toLocaleTimeString(),
      baseline: baselineMetrics,
      interventionPlan: planMetrics,
      interventionsApplied: appliedNames,
      tradeOffAnalysis: {
        benefit,
        downstreamRisk,
        verdict,
      },
      zoneComparisons,
      spatialSummary,
    };

    set((state) => ({
      comparisons: [comp, ...state.comparisons],
      activeComparisonId: compId,
    }));
  },

  syncFromEngine: () => {
    const { engine } = get();
    const st = engine.state;
    set({
      simTimeSecs: st.simTimeSecs,
      events: [...st.events],
      recommendations: [...st.recommendations],
      incidents: [...st.incidents],
      metricsSummary: engine.getSummary(),
      metricsHistory: [...st.metricsHistory],
      currentVenue: JSON.parse(JSON.stringify(st.venue)),
      gateSideEvents: [...engine.gateSideEvents],
      gateEntryHistory: [...engine.gateEntryHistory],
    });
  },
}));

