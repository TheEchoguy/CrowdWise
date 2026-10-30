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
} from '../types';
import { SimulationEngine } from '../engine/SimulationEngine';
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
  | 'settings';

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
  runCounterfactualComparison: (scenarioId: string, interventionIds: string[]) => void;

  // Periodic UI Syncer
  syncFromEngine: () => void;
}

const initialVenue = CHINNASWAMY_STADIUM_PROFILE;
const initialEngine = new SimulationEngine(initialVenue, 1337);

export const useSimulationStore = create<SimulationStoreState>((set, get) => ({
  activeTab: 'command-centre',
  setActiveTab: (tab) => set({ activeTab: tab }),
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
  setSelectedGateId: (id) => set({ selectedGateId: id }),
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

    // Determine Trade-off analysis
    const queueDiff = baselineMetrics.peakQueueLength - planMetrics.peakQueueLength;
    const densityDiff = baselineMetrics.maxZoneDensity - planMetrics.maxZoneDensity;

    let verdict: CounterfactualComparison['tradeOffAnalysis']['verdict'] = 'IMPROVED';
    let benefit = `Reduced peak perimeter queue by ${Math.max(0, queueDiff)} attendees.`;
    let downstreamRisk = 'Requires steward monitoring at perimeter approach junctions.';

    if (planMetrics.externalHoldingOccupancy > 1500) {
      verdict = 'TRANSFERRED_RISK';
      downstreamRisk = 'External holding zone occupancy increased by ' + planMetrics.externalHoldingOccupancy + ' attendees.';
    }

    const comp: CounterfactualComparison = {
      id: `comp-${Date.now()}`,
      name: `Counterfactual: ${SCENARIOS.find((s) => s.id === scenarioId)?.name || 'Scenario'}`,
      scenarioId,
      seed: randomSeed,
      timestamp: new Date().toLocaleTimeString(),
      baseline: baselineMetrics,
      interventionPlan: planMetrics,
      interventionsApplied: planInterventions.filter((i) => i.isActive).map((i) => i.name),
      tradeOffAnalysis: {
        benefit,
        downstreamRisk,
        verdict,
      },
    };

    set((state) => ({ comparisons: [comp, ...state.comparisons] }));
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
    });
  },
}));

