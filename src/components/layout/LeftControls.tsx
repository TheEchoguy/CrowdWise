import React from 'react';
import { useSimulationStore } from '../../state/useSimulationStore';
import { ScenarioId } from '../../scenarios/types/ScenarioTypes';
import {
  Play,
  Pause,
  RotateCcw,
  FastForward,
  Sliders,
  Zap,
  Compass,
  ArrowUpDown,
  SearchCheck,
  Activity
} from 'lucide-react';

export const LeftControls: React.FC = () => {
  const scenario = useSimulationStore((s) => s.scenario);
  const activeScenarioId = useSimulationStore((s) => s.activeScenarioId);
  const loadScenario = useSimulationStore((s) => s.loadScenario);

  const viewMode = useSimulationStore((s) => s.viewMode);
  const setViewMode = useSimulationStore((s) => s.setViewMode);

  const inflowRate = useSimulationStore((s) => s.inflowRate);
  const setInflowRate = useSimulationStore((s) => s.setInflowRate);

  const gateLatency = useSimulationStore((s) => s.gateLatency);
  const setGateLatency = useSimulationStore((s) => s.setGateLatency);

  const walkingSpeed = useSimulationStore((s) => s.walkingSpeed);
  const setWalkingSpeed = useSimulationStore((s) => s.setWalkingSpeed);

  const bafflesActive = useSimulationStore((s) => s.bafflesActive);
  const toggleBaffles = useSimulationStore((s) => s.toggleBaffles);

  const auxGateActive = useSimulationStore((s) => s.auxGateActive);
  const toggleAuxGate = useSimulationStore((s) => s.toggleAuxGate);

  const dividerActive = useSimulationStore((s) => s.dividerActive);
  const toggleDivider = useSimulationStore((s) => s.toggleDivider);

  const isPaused = useSimulationStore((s) => s.isPaused);
  const togglePause = useSimulationStore((s) => s.togglePause);

  const timeScale = useSimulationStore((s) => s.timeScale);
  const setTimeScale = useSimulationStore((s) => s.setTimeScale);

  const triggerReset = useSimulationStore((s) => s.triggerReset);
  const applyMitigationPreset = useSimulationStore((s) => s.applyMitigationPreset);

  const opposingFlowPercent = useSimulationStore((s) => s.opposingFlowPercent);
  const setOpposingFlowPercent = useSimulationStore((s) => s.setOpposingFlowPercent);

  const physicsValidationMode = useSimulationStore((s) => s.physicsValidationMode);
  const togglePhysicsValidationMode = useSimulationStore((s) => s.togglePhysicsValidationMode);

  const syntheticEvent = useSimulationStore((s) => s.syntheticEvent);
  const isDemoMode = useSimulationStore((s) => s.isDemoMode);
  const toggleDemoMode = useSimulationStore((s) => s.toggleDemoMode);

  const sPop = syntheticEvent?.population_scaling_ratio || 13.333333;
  const simInflowRate = Math.round(inflowRate / sPop);

  const runDisplacementAudit = useSimulationStore((s) => s.runDisplacementAudit);

  // Six Canonical Scenarios from scenarioDefinitions
  const scenarioList: { id: ScenarioId; shortName: string; icon: string; tag: string }[] = [
    { id: 'stadium_normal', shortName: '1. Normal Ingress', icon: '🏟️', tag: '60% Cap' },
    { id: 'ticket_surge', shortName: '2. Metro Surge', icon: '⚡', tag: '95% Peak' },
    { id: 'gate_failure', shortName: '3. Gate 2 Outage', icon: '⚠️', tag: '10 p/min' },
    { id: 'uneven_distribution', shortName: '4. Load Imbalance', icon: '⚖️', tag: '75/25 Split' },
    { id: 'emergency_reversal', shortName: '5. Shock Reversal', icon: '🚨', tag: 'Counterflow' },
    { id: 'safety_intervention', shortName: '6. Safety Lab (Ablation)', icon: '🛡️', tag: 'Paired' }
  ];

  return (
    <div className="flex flex-col gap-3.5 p-3.5 bg-slate-900/90 border border-slate-800 rounded-xl backdrop-blur-md text-slate-200 h-full overflow-y-auto">
      {/* Title & Playback Bar */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex items-center gap-1.5">
          <Sliders className="w-4 h-4 text-cyan-400" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-100">
            Control Station
          </h2>
        </div>

        {/* Play, Pause, Reset, Speed */}
        <div className="flex items-center gap-1">
          <button
            onClick={togglePause}
            className={`p-1.5 rounded-md border text-xs transition ${
              isPaused
                ? 'bg-emerald-950/70 border-emerald-500 text-emerald-300'
                : 'bg-amber-950/70 border-amber-500 text-amber-300'
            }`}
            title={isPaused ? 'Resume Simulation' : 'Pause Simulation'}
          >
            {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={triggerReset}
            className="p-1.5 rounded-md border border-slate-800 bg-slate-950 text-slate-300 hover:text-slate-100 transition"
            title="Reset Simulation"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setTimeScale(timeScale === 1.0 ? 2.0 : timeScale === 2.0 ? 0.5 : 1.0)}
            className="px-2 py-1 rounded-md border border-slate-800 bg-slate-950 text-[10px] font-mono text-cyan-400 hover:border-cyan-700 transition flex items-center gap-1"
            title="Toggle Simulation Speed"
          >
            <FastForward className="w-3 h-3" />
            <span>{timeScale}x</span>
          </button>

          <button
            onClick={toggleDemoMode}
            className={`px-2 py-1 rounded-md border text-[10px] font-mono transition flex items-center gap-1 ${
              isDemoMode
                ? 'bg-amber-950/80 border-amber-400 text-amber-300 font-bold shadow-sm shadow-amber-950'
                : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700 hover:text-slate-200'
            }`}
            title="Toggle Demonstration Mode (20x time compression, 60m simulated event in 3m)"
          >
            <Zap className={`w-3 h-3 ${isDemoMode ? 'text-amber-400' : 'text-slate-500'}`} />
            <span>{isDemoMode ? '20x DEMO' : 'DEMO'}</span>
          </button>
        </div>
      </div>

      {/* View Switcher: Micro Concourse Ingress vs 21-Gate Macro Stadium Radar */}
      <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800">
        <button
          onClick={() => setViewMode('micro')}
          className={`flex-1 py-1.5 text-[11px] font-bold rounded-md transition flex items-center justify-center gap-1.5 ${
            viewMode === 'micro'
              ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-950/50'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-3 h-3" />
          <span>Micro Concourse</span>
        </button>
        <button
          onClick={() => setViewMode('macro')}
          className={`flex-1 py-1.5 text-[11px] font-bold rounded-md transition flex items-center justify-center gap-1.5 ${
            viewMode === 'macro'
              ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-950/50'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Compass className="w-3 h-3" />
          <span>21-Gate Radar</span>
        </button>
      </div>

      {/* 1. Six Canonical Operational Scenarios */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Operational Scenarios (35k Cap)
          </label>
          <span className="text-[9px] font-mono text-cyan-400 bg-cyan-950/80 px-1.5 py-0.5 rounded border border-cyan-800">
            CHINNASWAMY
          </span>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {scenarioList.map((sc) => {
            const isSelected = activeScenarioId === sc.id;
            return (
              <button
                key={sc.id}
                onClick={() => {
                  loadScenario(sc.id);
                  setViewMode('micro');
                }}
                className={`p-2 rounded-lg border text-left text-xs transition flex flex-col justify-between gap-1 ${
                  isSelected
                    ? 'bg-cyan-950/80 border-cyan-400 text-cyan-200 font-bold shadow-md shadow-cyan-950/60 ring-1 ring-cyan-400/50'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs">{sc.icon}</span>
                  <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-slate-900 border border-slate-800 text-slate-400">
                    {sc.tag}
                  </span>
                </div>
                <span className="text-[10px] leading-tight font-semibold">{sc.shortName}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Surprise Hurdle Feature B: Counterflow Experiment Controls */}
      <div className="space-y-2 pt-2 border-t border-slate-800">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            <ArrowUpDown className="w-3.5 h-3.5 text-purple-400" />
            <span className="font-semibold text-slate-200">Bidirectional Counterflow</span>
          </div>
          <span className="font-mono text-xs text-purple-400 font-bold px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800">
            {opposingFlowPercent}% Outbound
          </span>
        </div>

        <div className="grid grid-cols-4 gap-1">
          {[0, 10, 25, 40].map((pct) => (
            <button
              key={pct}
              onClick={() => setOpposingFlowPercent(pct)}
              className={`py-1 text-[10px] font-mono font-bold rounded border transition ${
                opposingFlowPercent === pct
                  ? 'bg-purple-950 border-purple-500 text-purple-200 shadow-sm shadow-purple-950'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              {pct}%
            </button>
          ))}
        </div>
      </div>

      {/* 3. Surprise Hurdle Feature C: Displacement Audit Action */}
      <div className="pt-2 border-t border-slate-800 space-y-1.5">
        <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
          <SearchCheck className="w-3.5 h-3.5 text-indigo-400" />
          <span>Intervention Displacement Audit</span>
        </label>
        <button
          onClick={runDisplacementAudit}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-gradient-to-r from-indigo-950/80 to-blue-950/80 border border-indigo-600/80 hover:border-indigo-400 text-indigo-200 font-bold text-xs shadow-md transition"
        >
          <Zap className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
          <span>Run Paired Displacement Audit</span>
        </button>
      </div>

      {/* 4. Sliders */}
      <div className="space-y-3 pt-2 border-t border-slate-800">
        {/* Inflow Rate */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-slate-300">Concourse Inflow Rate (Represented)</span>
            <span className="font-mono text-xs text-cyan-400 font-bold px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800">
              {inflowRate} rep/m ({simInflowRate} sim/m)
            </span>
          </div>
          <input
            type="range"
            min="300"
            max="3600"
            step="50"
            value={inflowRate}
            onChange={(e) => setInflowRate(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
          />
          <div className="flex justify-between text-[9px] text-slate-500 font-mono">
            <span>300 rep/m</span>
            <span>Scale: 1 sim ≈ {sPop.toFixed(1)} rep</span>
            <span>3600 rep/m</span>
          </div>
        </div>

        {/* Gate Latency */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-slate-300">Turnstile Latency (Gate 2)</span>
            <span className="font-mono text-xs text-amber-400 font-bold px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800">
              {gateLatency.toFixed(1)}s / patron
            </span>
          </div>
          <input
            type="range"
            min="0.5"
            max="12.0"
            step="0.5"
            value={gateLatency}
            onChange={(e) => setGateLatency(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
          />
        </div>

        {/* Walking Speed */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-slate-300">Desired Speed</span>
            <span className="font-mono text-xs text-emerald-400 font-bold px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800">
              {walkingSpeed.toFixed(1)} m/s
            </span>
          </div>
          <input
            type="range"
            min="0.6"
            max="2.5"
            step="0.1"
            value={walkingSpeed}
            onChange={(e) => setWalkingSpeed(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
        </div>
      </div>

      {/* 5. Operational Overrides */}
      <div className="space-y-2 pt-2 border-t border-slate-800">
        <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          Safety Interventions
        </label>

        {scenario === 'stadium' && (
          <div className="space-y-2">
            <label className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 text-xs">
              <input
                type="checkbox"
                checked={bafflesActive}
                onChange={toggleBaffles}
                className="w-4 h-4 rounded text-sky-500 bg-slate-900 border-slate-700 focus:ring-0"
              />
              <div className="flex-1">
                <div className="font-semibold text-slate-200">40m Zigzag Chicane Baffles</div>
                <div className="text-[10px] text-slate-400">Damps longitudinal shockwaves</div>
              </div>
            </label>

            <label className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 text-xs">
              <input
                type="checkbox"
                checked={auxGateActive}
                onChange={toggleAuxGate}
                className="w-4 h-4 rounded text-teal-500 bg-slate-900 border-slate-700 focus:ring-0"
              />
              <div className="flex-1">
                <div className="font-semibold text-slate-200">Gate 3 Auxiliary Bypass</div>
                <div className="text-[10px] text-slate-400">Diverts 45% load to perimeter</div>
              </div>
            </label>

            <button
              onClick={applyMitigationPreset}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-indigo-950/70 border border-indigo-700/80 hover:bg-indigo-900/80 text-indigo-300 font-bold text-xs transition"
            >
              <Zap className="w-3.5 h-3.5 text-indigo-400" />
              <span>{bafflesActive && auxGateActive ? 'Revert to Baseline' : 'Apply Full Safety Preset'}</span>
            </button>
          </div>
        )}

        {scenario === 'bridge' && (
          <label className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 text-xs">
            <input
              type="checkbox"
              checked={dividerActive}
              onChange={toggleDivider}
              className="w-4 h-4 rounded text-cyan-500 bg-slate-900 border-slate-700 focus:ring-0"
            />
            <div className="flex-1">
              <div className="font-semibold text-slate-200">Central Lane Divider</div>
              <div className="text-[10px] text-slate-400">Eliminates counterflow shear</div>
            </div>
          </label>
        )}
      </div>

      {/* 6. Feature D: Pure Physics Validation Mode Toggle */}
      <div className="pt-2 border-t border-slate-800">
        <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 text-xs">
          <input
            type="checkbox"
            checked={physicsValidationMode}
            onChange={togglePhysicsValidationMode}
            className="w-4 h-4 rounded text-amber-500 bg-slate-900 border-slate-700 focus:ring-0"
          />
          <div className="flex-1">
            <div className="font-semibold text-amber-300">Physics Reality Check Mode</div>
            <div className="text-[9px] text-slate-400">Disables speed overrides; logs J = ρ × v</div>
          </div>
        </label>
      </div>
    </div>
  );
};
