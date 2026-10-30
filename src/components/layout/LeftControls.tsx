import React from 'react';
import { useSimulationStore } from '../../state/useSimulationStore';
import { ScenarioType } from '../../types/simulation';
import { Play, Pause, RotateCcw, FastForward, Sliders, Zap, Waves, AlertOctagon } from 'lucide-react';

export const LeftControls: React.FC = () => {
  const scenario = useSimulationStore((s) => s.scenario);
  const setScenario = useSimulationStore((s) => s.setScenario);

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
  const triggerSurgeWave = useSimulationStore((s) => s.triggerSurgeWave);
  const applyMitigationPreset = useSimulationStore((s) => s.applyMitigationPreset);

  const scenarios: { id: ScenarioType; label: string; icon: string }[] = [
    { id: 'stadium', label: 'Stadium Ingress', icon: '🏟️' },
    { id: 'bridge', label: 'Footbridge', icon: '🌉' },
    { id: 'reversal', label: 'Shock Reversal', icon: '🚨' }
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
        </div>
      </div>

      {/* 1. Spatial Scenario Selector */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          Spatial Configuration
        </label>
        <div className="grid grid-cols-3 gap-1.5">
          {scenarios.map((sc) => (
            <button
              key={sc.id}
              onClick={() => setScenario(sc.id)}
              className={`p-2 rounded-lg border text-left text-xs transition flex flex-col items-center justify-center gap-1 ${
                scenario === sc.id
                  ? 'bg-cyan-500 border-cyan-400 text-slate-950 font-bold shadow-md shadow-cyan-950/60'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <span className="text-base">{sc.icon}</span>
              <span className="text-[10px] leading-tight text-center">{sc.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Phase 2: Synthetic Surge Wave Trigger */}
      <div className="p-2.5 rounded-lg border border-cyan-900/60 bg-cyan-950/20 flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs font-semibold text-cyan-300 uppercase">
          <span className="flex items-center gap-1.5">
            <Waves className="w-3.5 h-3.5 text-cyan-400" />
            <span>Synthetic Surge Wave</span>
          </span>
          <span className="text-[9px] font-mono text-cyan-400 bg-cyan-950 px-1.5 py-0.5 rounded border border-cyan-800">
            PHASE 2
          </span>
        </div>
        <p className="text-[10px] text-slate-400 leading-tight">
          Injects a parabolic density wave cluster into the ingress avenue to stress-test crush onset.
        </p>
        <button
          onClick={() => triggerSurgeWave(45)}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-extrabold text-xs shadow-md shadow-cyan-950/60 transition"
        >
          <Waves className="w-4 h-4" />
          <span>Inject Surge Wave (+45)</span>
        </button>
      </div>

      {/* 2. Parameter Sliders */}
      <div className="space-y-3 pt-2 border-t border-slate-800">
        {/* Inflow Rate */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-slate-300">Inflow Rate</span>
            <span className="font-mono text-xs text-cyan-400 font-bold px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800">
              {inflowRate} p/min
            </span>
          </div>
          <input
            type="range"
            min="30"
            max="600"
            step="15"
            value={inflowRate}
            onChange={(e) => setInflowRate(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>60</span>
            <span>240 (Nominal)</span>
            <span>600 (Surge)</span>
          </div>
        </div>

        {/* Gate Latency */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-slate-300">Gate Turnstile Latency</span>
            <span className="font-mono text-xs text-amber-400 font-bold px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800">
              {gateLatency.toFixed(1)}s / person
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
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>1.0s (NFC)</span>
            <span>4.0s (Bag Check)</span>
            <span>12.0s (Outage)</span>
          </div>
        </div>

        {/* Walking Speed */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-slate-300">Desired Walking Speed</span>
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

      {/* 3. Operational Counterfactual Checkboxes */}
      <div className="space-y-2 pt-2 border-t border-slate-800">
        <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          Mitigation Overrides
        </label>

        {/* Stadium Mitigations */}
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
                <div className="font-semibold text-slate-200">40m Zigzag Baffles</div>
                <div className="text-[10px] text-slate-400">Breaks longitudinal shockwaves</div>
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
                <div className="font-semibold text-slate-200">Auxiliary Gate B Bypass</div>
                <div className="text-[10px] text-slate-400">Diverts 45% load to perimeter</div>
              </div>
            </label>

            {/* Quick Mitigation Preset Button */}
            <button
              onClick={applyMitigationPreset}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-indigo-950/70 border border-indigo-700/80 hover:bg-indigo-900/80 text-indigo-300 font-bold text-xs transition"
            >
              <Zap className="w-3.5 h-3.5 text-indigo-400" />
              <span>{bafflesActive && auxGateActive ? 'Disable All Mitigations' : 'Apply Full Safety Preset'}</span>
            </button>
          </div>
        )}

        {/* Footbridge Mitigations */}
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
              <div className="text-[10px] text-slate-400">Separates opposing laminar streams</div>
            </div>
          </label>
        )}

        {/* Reversal Mitigations */}
        {scenario === 'reversal' && (
          <div className="space-y-2">
            <label className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 text-xs">
              <input
                type="checkbox"
                checked={bafflesActive}
                onChange={toggleBaffles}
                className="w-4 h-4 rounded text-rose-500 bg-slate-900 border-slate-700 focus:ring-0"
              />
              <div className="flex-1">
                <div className="font-semibold text-slate-200">Reverse Egress Buffers</div>
                <div className="text-[10px] text-slate-400">Staggers reverse shock collapse</div>
              </div>
            </label>

            <button
              onClick={() => triggerSurgeWave(50)}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-rose-950/60 border border-rose-600 text-rose-300 font-bold text-xs transition animate-pulse"
            >
              <AlertOctagon className="w-3.5 h-3.5" />
              <span>Trigger Emergency Reversal Surge</span>
            </button>
          </div>
        )}
      </div>

      {/* Density Color Legend */}
      <div className="pt-2 border-t border-slate-800 text-[11px] font-mono space-y-1">
        <div className="text-[10px] uppercase font-bold text-slate-400">Fruin Density Scale</div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            &lt; 2.5 p/m²
          </span>
          <span className="text-slate-500">Free Flow</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-amber-400">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            2.5 - 4.5 p/m²
          </span>
          <span className="text-slate-500">Friction Queue</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-rose-400 font-bold animate-pulse">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            ≥ 5.0 p/m²
          </span>
          <span className="text-rose-400 font-bold">Crush Hazard</span>
        </div>
      </div>
    </div>
  );
};
