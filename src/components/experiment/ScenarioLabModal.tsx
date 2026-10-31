import React, { useState } from 'react';
import { useSimulationStore } from '../../state/useSimulationStore';
import {
  PRESET_SCENARIOS,
  ScenarioType,
  ScenarioConfig
} from '../../engine/SyntheticDemandGenerator';
import { InterventionType, ExperimentRecord } from '../../engine/ControlledExperimentRunner';
import {
  FlaskConical,
  X,
  Play,
  RotateCcw,
  ShieldCheck,
  AlertTriangle,
  Flame,
  Zap,
  CheckCircle2,
  AlertOctagon,
  HelpCircle,
  TrendingDown,
  TrendingUp,
  ArrowRight,
  Shuffle
} from 'lucide-react';

export const ScenarioLabModal: React.FC = () => {
  const isScenarioLabOpen = useSimulationStore((s) => s.isScenarioLabOpen);
  const toggleScenarioLab = useSimulationStore((s) => s.toggleScenarioLab);
  const runControlledExperiment = useSimulationStore((s) => s.runControlledExperiment);
  const activeExperimentRecord = useSimulationStore((s) => s.activeExperimentRecord);
  const setActiveExperimentRecord = useSimulationStore((s) => s.setActiveExperimentRecord);
  const experimentHistory = useSimulationStore((s) => s.experimentHistory);
  const selectedOuterGateId = useSimulationStore((s) => s.selectedOuterGateId);

  // Local configuration states
  const [selectedScenarioType, setSelectedScenarioType] = useState<ScenarioType>('NORMAL_INGRESS');
  const [inflowRate, setInflowRate] = useState<number>(360);
  const [durationSeconds, setDurationSeconds] = useState<number>(60);
  const [seed, setSeed] = useState<number>(42);
  const [targetGate, setTargetGate] = useState<string>(selectedOuterGateId || 'E22');
  const [activeTab, setActiveTab] = useState<'EXPERIMENT' | 'HISTORY'>('EXPERIMENT');
  const [isRunning, setIsRunning] = useState<boolean>(false);

  // Intervention toggles
  const [interventions, setInterventions] = useState<Record<InterventionType, boolean>>({
    METERING: true,
    REROUTING: true,
    DIRECTIONAL_SEPARATION: true,
    QUEUE_MANAGEMENT: true,
    TURNSTILE_LOAD_BALANCING: true
  });

  if (!isScenarioLabOpen) return null;

  const currentPreset = PRESET_SCENARIOS[selectedScenarioType] || PRESET_SCENARIOS.NORMAL_INGRESS;

  const scenarioCards: {
    type: ScenarioType;
    label: string;
    badge: string;
    desc: string;
    icon: React.ReactNode;
    color: string;
  }[] = [
    {
      type: 'NORMAL_INGRESS',
      label: 'Scenario A: Normal Ingress',
      badge: 'Laminar Flow',
      desc: '360 p/m nominal inflow distributed evenly across all open gates.',
      icon: <ShieldCheck className="w-4 h-4 text-emerald-400" />,
      color: 'border-emerald-700/60 bg-emerald-950/30'
    },
    {
      type: 'METRO_SURGE',
      label: 'Scenario B: Metro Surge',
      badge: 'Arrival Pulse',
      desc: '+600 p/m sudden wave from MG Road & Cubbon Park Metro stations.',
      icon: <Flame className="w-4 h-4 text-amber-400" />,
      color: 'border-amber-700/60 bg-amber-950/30'
    },
    {
      type: 'OUTER_GATE_FAILURE',
      label: 'Scenario C: Outer Gate Failure',
      badge: 'Perimeter Choke',
      desc: 'Turnstile choke at E22 forces lateral spillback and dynamic reroute.',
      icon: <AlertTriangle className="w-4 h-4 text-rose-400" />,
      color: 'border-rose-700/60 bg-rose-950/30'
    },
    {
      type: 'TURNSTILE_FAILURE',
      label: 'Scenario D: Turnstile Bank Failure',
      badge: 'Throat Gridlock',
      desc: 'Inner bank G7 loses 2 mechanical scanners; capacity drops to 60 p/m.',
      icon: <AlertOctagon className="w-4 h-4 text-orange-400" />,
      color: 'border-orange-700/60 bg-orange-950/30'
    },
    {
      type: 'COUNTER_FLOW_SHOCK',
      label: 'Scenario E: Counter-Flow Shock',
      badge: 'Head-On Conflict',
      desc: 'Opposing spectator movement induces severe flow turbulence (cos θ < -0.4).',
      icon: <Shuffle className="w-4 h-4 text-cyan-400" />,
      color: 'border-cyan-700/60 bg-cyan-950/30'
    },
    {
      type: 'TICKET_REJECTION_SHOCKWAVE',
      label: 'Scenario F: Ticket Rejection Shockwave',
      badge: '15% Reverse Wave',
      desc: '15% ticket invalidation / duplicate scans triggering upstream counter-wave.',
      icon: <Zap className="w-4 h-4 text-purple-400" />,
      color: 'border-purple-700/60 bg-purple-950/30'
    },
    {
      type: 'COMBINED_EMERGENCY',
      label: 'Scenario G: Combined Emergency',
      badge: 'Multi-Hazard Stress',
      desc: 'Synchronized metro pulse + scanner failure + ticket rejection wave.',
      icon: <Flame className="w-4 h-4 text-red-500" />,
      color: 'border-red-700/80 bg-red-950/40'
    }
  ];

  const handleSelectScenario = (type: ScenarioType) => {
    setSelectedScenarioType(type);
    const preset = PRESET_SCENARIOS[type];
    setInflowRate(preset.baseInflowRate);
    setDurationSeconds(preset.durationSeconds || 60);
    setSeed(preset.seed || 42);
    if (preset.selectedOuterGates && preset.selectedOuterGates.length > 0) {
      setTargetGate(preset.selectedOuterGates[0]);
    }
  };

  const handleToggleIntervention = (key: InterventionType) => {
    setInterventions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleRunExperiment = async () => {
    setIsRunning(true);
    // Yield to render progress
    await new Promise((r) => setTimeout(r, 60));

    const activeList = (Object.keys(interventions) as InterventionType[]).filter(
      (k) => interventions[k]
    );

    const customConfig: ScenarioConfig = {
      ...currentPreset,
      baseInflowRate: inflowRate,
      durationSeconds: durationSeconds,
      seed: seed,
      selectedOuterGates: [targetGate]
    };

    runControlledExperiment(customConfig, activeList, targetGate);
    setIsRunning(false);
  };

  const record: ExperimentRecord | null = activeExperimentRecord;

  // Helper for Fruin LOS color
  const getFruinColor = (density: number) => {
    if (density < 1.0) return 'text-emerald-400 bg-emerald-950/60 border-emerald-800';
    if (density < 1.5) return 'text-emerald-300 bg-emerald-950/50 border-emerald-700';
    if (density < 2.2) return 'text-amber-300 bg-amber-950/60 border-amber-800';
    if (density < 3.0) return 'text-orange-400 bg-orange-950/60 border-orange-800';
    return 'text-rose-400 bg-rose-950/80 border-rose-600 animate-pulse font-bold';
  };

  const getVerdictBadge = (verdict: string) => {
    switch (verdict) {
      case 'IMPROVED':
        return {
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
          title: 'SAFETY PERMIT GRANTED — STADIUM RISK MITIGATED',
          desc: 'Primary bottleneck resolved without creating hazardous upstream or lateral displacement.',
          style: 'border-emerald-600 bg-emerald-950/60 text-emerald-300'
        };
      case 'DISPLACED':
        return {
          icon: <AlertTriangle className="w-5 h-5 text-amber-400" />,
          title: 'CONDITIONAL / HAZARD DISPLACED TO UPSTREAM ROAD',
          desc: 'Turnstile throat congestion reduced, but dangerous crush risk shifted to public roadway.',
          style: 'border-amber-600 bg-amber-950/60 text-amber-300'
        };
      case 'DEGRADED':
        return {
          icon: <AlertOctagon className="w-5 h-5 text-rose-500" />,
          title: 'SAFETY PERMIT REVOKED — ADVERSE CROWD SURGE DETECTED',
          desc: 'Intervention measures degraded crowd dynamics and elevated critical crush metrics.',
          style: 'border-rose-600 bg-rose-950/80 text-rose-300'
        };
      default:
        return {
          icon: <HelpCircle className="w-5 h-5 text-cyan-400" />,
          title: 'INCONCLUSIVE — CONTINUED MONITORING MANDATED',
          desc: 'Observed variations fall within transient ±0.4 p/m² margin. Insufficient evidence.',
          style: 'border-cyan-600 bg-cyan-950/60 text-cyan-300'
        };
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-7xl max-h-[94vh] flex flex-col bg-slate-900 border border-slate-700/90 rounded-2xl shadow-2xl shadow-cyan-950/40 overflow-hidden text-slate-100">
        
        {/* 1. Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950/80 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-950/80 border border-purple-600/80 flex items-center justify-center shadow-lg shadow-purple-900/40">
              <FlaskConical className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold tracking-wide text-slate-100">
                  PREDICTIVE CROWD SAFETY & CONTROLLED SCENARIO LAB
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-full bg-purple-950 text-purple-400 border border-purple-800">
                  STAGE 6 & 7 VERIFIED
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Matched Deterministic Paired Simulation: Run A (Baseline) vs. Run B (Intervention) · Seed-Locked Reproducibility
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* View Mode Navigation Tabs */}
            <div className="flex rounded-lg p-0.5 bg-slate-900 border border-slate-800 text-xs">
              <button
                onClick={() => setActiveTab('EXPERIMENT')}
                className={`px-3 py-1 rounded-md font-semibold transition ${
                  activeTab === 'EXPERIMENT'
                    ? 'bg-purple-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Scenario Experiment
              </button>
              <button
                onClick={() => setActiveTab('HISTORY')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-semibold transition ${
                  activeTab === 'HISTORY'
                    ? 'bg-purple-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>Audit History</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-purple-300">
                  {experimentHistory.length}
                </span>
              </button>
            </div>

            <button
              onClick={toggleScenarioLab}
              className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-100 transition"
              title="Close Scenario Lab"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 2. Main Content Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6">
          {activeTab === 'EXPERIMENT' ? (
            <>
              {/* Row 1: Synthetic Scenarios Selector */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-purple-400">
                      Step 1: Select Synthetic Scenario (Scenarios A – G)
                    </span>
                    <span className="text-[11px] text-slate-400">
                      — Deterministic crowd shock & stress profiles
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    Seed: <strong className="text-purple-300">S = {seed}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {scenarioCards.map((scen) => {
                    const isSelected = selectedScenarioType === scen.type;
                    return (
                      <button
                        key={scen.type}
                        onClick={() => handleSelectScenario(scen.type)}
                        className={`text-left p-3 rounded-xl border transition flex flex-col justify-between ${
                          isSelected
                            ? 'border-purple-500 bg-purple-950/40 ring-1 ring-purple-500 shadow-md shadow-purple-950/50'
                            : `${scen.color} hover:border-slate-600 opacity-80 hover:opacity-100`
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="p-1 rounded-md bg-slate-900 border border-slate-700">
                              {scen.icon}
                            </span>
                            <span className="px-1.5 py-0.5 text-[9px] font-bold font-mono rounded bg-slate-900/90 text-slate-300 border border-slate-700">
                              {scen.badge}
                            </span>
                          </div>
                          <div className="text-xs font-bold text-slate-200 leading-snug">
                            {scen.label}
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                            {scen.desc}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Row 2: Scenario Parameters & Active Interventions */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Left 6 Cols: Parameter Calibrator */}
                <div className="lg:col-span-6 p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      Step 2: Calibrate Initial Conditions
                    </span>
                    <button
                      onClick={() => setSeed(Math.floor(Math.random() * 9000) + 1000)}
                      className="flex items-center gap-1 text-[11px] text-purple-400 hover:text-purple-300"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Randomize Seed</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-xs">
                    {/* Inflow Rate */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-slate-400">
                        <span>Base Inflow Rate</span>
                        <span className="font-mono text-purple-400 font-bold">{inflowRate} p/min</span>
                      </div>
                      <input
                        type="range"
                        min="120"
                        max="1200"
                        step="30"
                        value={inflowRate}
                        onChange={(e) => setInflowRate(Number(e.target.value))}
                        className="w-full accent-purple-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                      />
                    </div>

                    {/* Duration */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-slate-400">
                        <span>Duration</span>
                        <span className="font-mono text-purple-400 font-bold">{durationSeconds}s</span>
                      </div>
                      <input
                        type="range"
                        min="30"
                        max="180"
                        step="15"
                        value={durationSeconds}
                        onChange={(e) => setDurationSeconds(Number(e.target.value))}
                        className="w-full accent-purple-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                      />
                    </div>

                    {/* Target Gate */}
                    <div className="space-y-1.5">
                      <label className="text-slate-400">Target Outer Perimeter Gate</label>
                      <select
                        value={targetGate}
                        onChange={(e) => setTargetGate(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-slate-200 focus:outline-none focus:border-purple-500"
                      >
                        <option value="E22">E22 — Cubbon Road (G7/G8 C-Stand)</option>
                        <option value="E23">E23 — Cubbon Road (Auxiliary)</option>
                        <option value="E18">E18 — Cubbon Road East (G9/G10)</option>
                        <option value="E19">E19 — Cubbon Road East</option>
                        <option value="E11">E11 — Link Road / MG Metro (G15)</option>
                        <option value="E12">E12 — Link Road (G14/G15)</option>
                        <option value="E16">E16 — Link Road North (G13)</option>
                      </select>
                    </div>

                    {/* Seed input */}
                    <div className="space-y-1.5">
                      <label className="text-slate-400">Locked Random Seed (S)</label>
                      <input
                        type="number"
                        value={seed}
                        onChange={(e) => setSeed(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-purple-300 focus:outline-none focus:border-purple-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Right 6 Cols: Active Interventions Toggles */}
                <div className="lg:col-span-6 p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                        Step 3: Applied Safety Interventions (Run B)
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Run A = Zero interventions (Baseline)
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {/* Metering */}
                      <label
                        className={`flex items-center gap-2.5 p-2 rounded-lg border cursor-pointer transition ${
                          interventions.METERING
                            ? 'border-purple-500/80 bg-purple-950/40 text-purple-200'
                            : 'border-slate-800 bg-slate-900/50 text-slate-400'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={interventions.METERING}
                          onChange={() => handleToggleIntervention('METERING')}
                          className="accent-purple-500 w-4 h-4"
                        />
                        <div>
                          <div className="font-semibold text-xs">Dynamic Metering</div>
                          <div className="text-[10px] text-slate-400">-35% throttle buffer</div>
                        </div>
                      </label>

                      {/* Rerouting */}
                      <label
                        className={`flex items-center gap-2.5 p-2 rounded-lg border cursor-pointer transition ${
                          interventions.REROUTING
                            ? 'border-purple-500/80 bg-purple-950/40 text-purple-200'
                            : 'border-slate-800 bg-slate-900/50 text-slate-400'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={interventions.REROUTING}
                          onChange={() => handleToggleIntervention('REROUTING')}
                          className="accent-purple-500 w-4 h-4"
                        />
                        <div>
                          <div className="font-semibold text-xs">Intelligent Rerouting</div>
                          <div className="text-[10px] text-slate-400">Auxiliary Gate bypass</div>
                        </div>
                      </label>

                      {/* Directional Separation */}
                      <label
                        className={`flex items-center gap-2.5 p-2 rounded-lg border cursor-pointer transition ${
                          interventions.DIRECTIONAL_SEPARATION
                            ? 'border-purple-500/80 bg-purple-950/40 text-purple-200'
                            : 'border-slate-800 bg-slate-900/50 text-slate-400'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={interventions.DIRECTIONAL_SEPARATION}
                          onChange={() => handleToggleIntervention('DIRECTIONAL_SEPARATION')}
                          className="accent-purple-500 w-4 h-4"
                        />
                        <div>
                          <div className="font-semibold text-xs">Directional Divider</div>
                          <div className="text-[10px] text-slate-400">Anti-collision barrier</div>
                        </div>
                      </label>

                      {/* Queue S-Lanes */}
                      <label
                        className={`flex items-center gap-2.5 p-2 rounded-lg border cursor-pointer transition ${
                          interventions.QUEUE_MANAGEMENT
                            ? 'border-purple-500/80 bg-purple-950/40 text-purple-200'
                            : 'border-slate-800 bg-slate-900/50 text-slate-400'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={interventions.QUEUE_MANAGEMENT}
                          onChange={() => handleToggleIntervention('QUEUE_MANAGEMENT')}
                          className="accent-purple-500 w-4 h-4"
                        />
                        <div>
                          <div className="font-semibold text-xs">S-Curve Queuing</div>
                          <div className="text-[10px] text-slate-400">Switchback stabilizers</div>
                        </div>
                      </label>

                      {/* Turnstile Balancing */}
                      <label
                        className={`sm:col-span-2 flex items-center gap-2.5 p-2 rounded-lg border cursor-pointer transition ${
                          interventions.TURNSTILE_LOAD_BALANCING
                            ? 'border-purple-500/80 bg-purple-950/40 text-purple-200'
                            : 'border-slate-800 bg-slate-900/50 text-slate-400'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={interventions.TURNSTILE_LOAD_BALANCING}
                          onChange={() => handleToggleIntervention('TURNSTILE_LOAD_BALANCING')}
                          className="accent-purple-500 w-4 h-4"
                        />
                        <div>
                          <div className="font-semibold text-xs">Turnstile Load Balancing</div>
                          <div className="text-[10px] text-slate-400">Auto-routes to all operational inner counters</div>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Run Master Action */}
                  <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">
                      Executes paired Run A & Run B under identical seed S = {seed}
                    </span>
                    <button
                      onClick={handleRunExperiment}
                      disabled={isRunning}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-950/50 transition disabled:opacity-50"
                    >
                      <Play className="w-4 h-4 fill-white" />
                      <span>{isRunning ? 'Running Experiment...' : 'Run Matched Controlled Experiment'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Row 3: Matched Comparative Experiment Results */}
              {record && (
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-purple-400">
                        Step 4: Matched Comparative Audit (Run A Baseline vs. Run B Intervention)
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                        Exp ID: {record.experimentId}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400 font-mono">
                      Completed at {new Date(record.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  {/* Safety Verdict Banner */}
                  {(() => {
                    const verdictCard = getVerdictBadge(record.safetyVerdict.verdict);
                    return (
                      <div className={`p-4 rounded-xl border ${verdictCard.style} flex items-start gap-3.5 shadow-lg`}>
                        <div className="shrink-0 mt-0.5">{verdictCard.icon}</div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h3 className="font-bold text-sm tracking-wide">
                              {verdictCard.title}
                            </h3>
                            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-900/80 border border-current">
                              {record.safetyVerdict.verdict} · {record.safetyVerdict.confidencePercent}% CONFIDENCE
                            </span>
                          </div>
                          <p className="text-xs mt-1 text-slate-300">
                            {verdictCard.desc}
                          </p>
                          <div className="mt-2.5 pt-2 border-t border-slate-700/60 flex flex-wrap gap-4 text-xs font-mono text-slate-300">
                            <span>Permit Action: <strong className="text-white">{record.safetyVerdict.permitOfficerSummary}</strong></span>
                            <span>Audit Finding: <strong className="text-white">{record.displacementResults.explanation}</strong></span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Side-by-Side KPI Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {/* Total Admitted */}
                    <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
                      <div className="text-[11px] text-slate-400 uppercase font-semibold">Total Admitted</div>
                      <div className="flex items-baseline justify-between mt-1.5">
                        <div className="font-mono text-slate-400 text-xs">
                          Base: <strong className="text-slate-200">{record.baselineResults.totalAdmitted}</strong>
                        </div>
                        <ArrowRight className="w-3 h-3 text-slate-600" />
                        <div className="font-mono text-purple-300 font-bold text-base">
                          {record.interventionResults.totalAdmitted}
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1 font-mono flex items-center gap-1">
                        {record.interventionResults.totalAdmitted >= record.baselineResults.totalAdmitted ? (
                          <span className="text-emerald-400 flex items-center">
                            <TrendingUp className="w-3 h-3 mr-0.5" />
                            +{record.interventionResults.totalAdmitted - record.baselineResults.totalAdmitted} spectators
                          </span>
                        ) : (
                          <span className="text-rose-400 flex items-center">
                            <TrendingDown className="w-3 h-3 mr-0.5" />
                            {record.interventionResults.totalAdmitted - record.baselineResults.totalAdmitted} spectators
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Average Wait Time */}
                    <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
                      <div className="text-[11px] text-slate-400 uppercase font-semibold">Avg Wait Time</div>
                      <div className="flex items-baseline justify-between mt-1.5">
                        <div className="font-mono text-slate-400 text-xs">
                          Base: <strong className="text-slate-200">{record.baselineResults.averageWaitTimeSec.toFixed(1)}s</strong>
                        </div>
                        <ArrowRight className="w-3 h-3 text-slate-600" />
                        <div className="font-mono text-purple-300 font-bold text-base">
                          {record.interventionResults.averageWaitTimeSec.toFixed(1)}s
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1 font-mono">
                        Δ: {(record.interventionResults.averageWaitTimeSec - record.baselineResults.averageWaitTimeSec).toFixed(1)}s
                      </div>
                    </div>

                    {/* Peak Throughput */}
                    <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
                      <div className="text-[11px] text-slate-400 uppercase font-semibold">Peak Flow Rate</div>
                      <div className="flex items-baseline justify-between mt-1.5">
                        <div className="font-mono text-slate-400 text-xs">
                          Base: <strong className="text-slate-200">{record.baselineResults.peakThroughputPerMin} p/m</strong>
                        </div>
                        <ArrowRight className="w-3 h-3 text-slate-600" />
                        <div className="font-mono text-purple-300 font-bold text-base">
                          {record.interventionResults.peakThroughputPerMin} p/m
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1 font-mono">
                        Δ: {record.interventionResults.peakThroughputPerMin - record.baselineResults.peakThroughputPerMin} p/min
                      </div>
                    </div>

                    {/* Overall Peak Density */}
                    <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
                      <div className="text-[11px] text-slate-400 uppercase font-semibold">Peak Density Overall</div>
                      <div className="flex items-baseline justify-between mt-1.5">
                        <div className="font-mono text-slate-400 text-xs">
                          Base: <strong className="text-slate-200">{record.baselineResults.peakDensityOverall} p/m²</strong>
                        </div>
                        <ArrowRight className="w-3 h-3 text-slate-600" />
                        <div className="font-mono text-purple-300 font-bold text-base">
                          {record.interventionResults.peakDensityOverall} p/m²
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1 font-mono">
                        Δ: {(record.interventionResults.peakDensityOverall - record.baselineResults.peakDensityOverall).toFixed(1)} p/m²
                      </div>
                    </div>
                  </div>

                  {/* Three-Zone Spatial Monitor Deltas */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* Zone A: Turnstile Throats */}
                    <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-300">
                          Zone A: Turnstile Admission Throats
                        </span>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${getFruinColor(record.interventionResults.zoneA.density)}`}>
                          {record.interventionResults.zoneA.density} p/m²
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        80 m² gantry choke point. Baseline: {record.baselineResults.zoneA.density} p/m²
                      </div>
                      <div className="pt-2 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-xs font-mono">
                        <div>
                          <div className="text-[10px] text-slate-500">Δ DENSITY</div>
                          <div className={record.displacementResults.zoneADelta.absoluteDensityDelta < 0 ? 'text-emerald-400 font-bold' : 'text-slate-300'}>
                            {record.displacementResults.zoneADelta.absoluteDensityDelta > 0 ? '+' : ''}{record.displacementResults.zoneADelta.absoluteDensityDelta.toFixed(1)} p/m²
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-500">HAZARD DURATION</div>
                          <div className="text-slate-300">
                            {record.interventionResults.zoneA.criticalHazardDurationSec}s
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Zone B: Holding Concourse */}
                    <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-300">
                          Zone B: Holding Concourse & Queues
                        </span>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${getFruinColor(record.interventionResults.zoneB.density)}`}>
                          {record.interventionResults.zoneB.density} p/m²
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        250 m² holding area. Baseline: {record.baselineResults.zoneB.density} p/m²
                      </div>
                      <div className="pt-2 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-xs font-mono">
                        <div>
                          <div className="text-[10px] text-slate-500">Δ DENSITY</div>
                          <div className="text-slate-300">
                            {record.displacementResults.zoneBDelta.absoluteDensityDelta > 0 ? '+' : ''}{record.displacementResults.zoneBDelta.absoluteDensityDelta.toFixed(1)} p/m²
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-500">HAZARD DURATION</div>
                          <div className="text-slate-300">
                            {record.interventionResults.zoneB.criticalHazardDurationSec}s
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Zone C: Public Roadway & Sidewalk */}
                    <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-300">
                          Zone C: Public Roadway & Sidewalk
                        </span>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${getFruinColor(record.interventionResults.zoneC.density)}`}>
                          {record.interventionResults.zoneC.density} p/m²
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        120 m² approach roadway. Baseline: {record.baselineResults.zoneC.density} p/m²
                      </div>
                      <div className="pt-2 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-xs font-mono">
                        <div>
                          <div className="text-[10px] text-slate-500">Δ DENSITY</div>
                          <div className={record.displacementResults.zoneCDelta.absoluteDensityDelta > 0.4 ? 'text-amber-400 font-bold' : 'text-slate-300'}>
                            {record.displacementResults.zoneCDelta.absoluteDensityDelta > 0 ? '+' : ''}{record.displacementResults.zoneCDelta.absoluteDensityDelta.toFixed(1)} p/m²
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-500">HAZARD DURATION</div>
                          <div className="text-slate-300">
                            {record.interventionResults.zoneC.criticalHazardDurationSec}s
                          </div>
                        </div>
                      </div>
                      {record.displacementResults.isDisplacementDetected && (
                        <div className="p-2 rounded bg-amber-950/60 border border-amber-700/80 text-[10px] text-amber-300 font-semibold">
                          ⚠️ UPSTREAM SPILLBACK: Throttling created queue displacement onto public road!
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Findings Breakdown */}
                  <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Explainable Findings & Audit Trail
                    </span>
                    <ul className="space-y-1.5 text-xs text-slate-300">
                      {record.safetyVerdict.supportingFindings.map((finding: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-purple-400 mt-0.5 font-bold">›</span>
                          <span>{finding}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Audit History Tab */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-200">Experiment Audit History</h3>
                  <p className="text-xs text-slate-400">
                    Chronological audit log of all paired Baseline vs. Intervention simulation trials
                  </p>
                </div>
              </div>

              {experimentHistory.length === 0 ? (
                <div className="p-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl">
                  No experiments recorded in this session. Run your first experiment above.
                </div>
              ) : (
                <div className="space-y-3">
                  {experimentHistory.map((hRecord) => (
                    <div
                      key={hRecord.experimentId}
                      className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-200">{hRecord.scenarioName}</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-purple-300">
                            Seed: {hRecord.seed}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                            {new Date(hRecord.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">
                          Gate: {hRecord.selectedGates.outerGates.join(', ')} · Duration: {hRecord.simulationDurationSeconds}s · Admitted: {hRecord.interventionResults.totalAdmitted} (vs {hRecord.baselineResults.totalAdmitted})
                        </p>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-[10px] font-mono font-bold text-slate-300">
                            VERDICT:
                          </span>
                          <span className="font-mono text-purple-300 font-semibold">
                            {hRecord.safetyVerdict.verdict}
                          </span>
                          <span className="text-slate-500">|</span>
                          <span className="text-slate-400 text-[11px]">
                            {hRecord.displacementResults.explanation}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setActiveExperimentRecord(hRecord);
                          setActiveTab('EXPERIMENT');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-purple-950/80 hover:bg-purple-900 border border-purple-600/60 text-purple-200 text-xs font-bold transition shrink-0"
                      >
                        Reopen Audit
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 3. Footer Bar */}
        <div className="px-6 py-3 bg-slate-950/90 border-t border-slate-800 shrink-0 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Helbing Social Force Engine Active</span>
            <span className="text-slate-600">·</span>
            <span>M. Chinnaswamy Stadium (35,000 Capacity Twin)</span>
          </div>
          <button
            onClick={toggleScenarioLab}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition"
          >
            Close Lab
          </button>
        </div>

      </div>
    </div>
  );
};
