import React from 'react';
import { useSimulationStore } from '../../state/useSimulationStore';
import { ScenarioType } from '../../engine/types';
import { Play, Pause, RotateCcw, AlertTriangle } from 'lucide-react';

export const Header: React.FC = () => {
  const scenario = useSimulationStore((s) => s.scenario);
  const setScenario = useSimulationStore((s) => s.setScenario);
  const isPlaying = useSimulationStore((s) => s.isPlaying);
  const togglePlay = useSimulationStore((s) => s.togglePlay);
  const resetSimulation = useSimulationStore((s) => s.resetSimulation);
  const isCritical = useSimulationStore((s) => s.telemetry.isCritical);

  const scenarios: { id: ScenarioType; label: string; icon: string }[] = [
    { id: 'stadium', label: 'Stadium Ingress (Gate A)', icon: '🏟️' },
    { id: 'bridge', label: 'Transit Footbridge', icon: '🌉' },
    { id: 'reversal', label: 'Shock Reversal', icon: '🚨' }
  ];

  return (
    <header className="flex flex-col md:flex-row items-center justify-between gap-3 px-5 py-3 bg-slate-900/90 border-b border-slate-800 backdrop-blur-md">
      {/* Brand & Theme Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center font-black text-slate-950 text-xl shadow-lg shadow-cyan-900/40">
          CW
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-extrabold tracking-wider text-slate-100">
              CROWDWISE
            </h1>
            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800">
              Theme 03: Digital Twin & Synthetic Data
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Microscopic Pedestrian Vector Dynamics & Safety Simulation Lab
          </p>
        </div>
      </div>

      {/* Critical Crush Warning Banner if active */}
      {isCritical && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-950/80 border border-rose-500/80 text-rose-300 text-xs font-mono font-bold animate-pulse">
          <AlertTriangle className="w-4 h-4 text-rose-400" />
          <span>CRITICAL CRUSH HAZARD DETECTED (&ge; 5.0 p/m²)</span>
        </div>
      )}

      {/* Scenario Presets Tabs & Playback Controls */}
      <div className="flex items-center gap-3">
        {/* Scenario Selector */}
        <div className="flex p-1 bg-slate-950/80 border border-slate-800 rounded-lg text-xs font-medium">
          {scenarios.map((sc) => (
            <button
              key={sc.id}
              onClick={() => setScenario(sc.id)}
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition ${
                scenario === sc.id
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>{sc.icon}</span>
              <span>{sc.label}</span>
            </button>
          ))}
        </div>

        {/* Play/Pause & Reset */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={togglePlay}
            className={`p-2 rounded-lg border flex items-center justify-center transition ${
              isPlaying
                ? 'bg-amber-950/60 border-amber-500 text-amber-300 hover:bg-amber-900/60'
                : 'bg-emerald-950/60 border-emerald-500 text-emerald-300 hover:bg-emerald-900/60'
            }`}
            title={isPlaying ? 'Pause Simulation' : 'Resume Simulation'}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>

          <button
            onClick={resetSimulation}
            className="p-2 rounded-lg border border-slate-800 bg-slate-800/60 text-slate-300 hover:bg-slate-700/60 transition"
            title="Reset Simulation"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
