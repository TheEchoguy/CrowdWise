import React from 'react';
import { useSimulationStore } from '../../state/useSimulationStore';
import { Sliders, ShieldCheck, Zap, AlertOctagon, RotateCcw } from 'lucide-react';

export const ControlPanel: React.FC = () => {
  const scenario = useSimulationStore((s) => s.scenario);
  const inflowRate = useSimulationStore((s) => s.inflowRate);
  const setInflowRate = useSimulationStore((s) => s.setInflowRate);
  const gateLatency = useSimulationStore((s) => s.gateLatency);
  const setGateLatency = useSimulationStore((s) => s.setGateLatency);

  const bafflesActive = useSimulationStore((s) => s.bafflesActive);
  const toggleBaffles = useSimulationStore((s) => s.toggleBaffles);
  const auxGateActive = useSimulationStore((s) => s.auxGateActive);
  const toggleAuxGate = useSimulationStore((s) => s.toggleAuxGate);
  const dividerActive = useSimulationStore((s) => s.dividerActive);
  const toggleDivider = useSimulationStore((s) => s.toggleDivider);

  const resetSimulation = useSimulationStore((s) => s.resetSimulation);
  const triggerEmergencyReversal = useSimulationStore((s) => s.triggerEmergencyReversal);

  return (
    <div className="flex flex-col gap-4 p-4 bg-slate-900/90 border border-slate-800 rounded-xl backdrop-blur-md text-slate-200">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-bold tracking-wide uppercase text-slate-100">
            Operational Mitigations Lab
          </h2>
        </div>
        <button
          onClick={resetSimulation}
          className="p-1.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded flex items-center gap-1 transition"
          title="Reset Arena State"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset</span>
        </button>
      </div>

      {/* 1. Inflow Rate Slider */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center text-xs">
          <label className="font-semibold text-slate-300">
            Pedestrian Influx Rate
          </label>
          <span className="font-mono px-2 py-0.5 rounded bg-slate-800 text-cyan-400 text-xs font-bold">
            {inflowRate} / min
          </span>
        </div>
        <input
          type="range"
          min="60"
          max="600"
          step="20"
          value={inflowRate}
          onChange={(e) => setInflowRate(Number(e.target.value))}
          className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
        />
        <div className="flex justify-between text-[10px] text-slate-500 font-mono">
          <span>60 (Calm)</span>
          <span>300 (Nominal)</span>
          <span>600 (Surge Spike)</span>
        </div>
      </div>

      {/* 2. Gate Latency Slider */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center text-xs">
          <label className="font-semibold text-slate-300">
            Turnstile / Inspection Latency
          </label>
          <span className="font-mono px-2 py-0.5 rounded bg-slate-800 text-amber-400 text-xs font-bold">
            {gateLatency.toFixed(1)}s / person
          </span>
        </div>
        <input
          type="range"
          min="1.0"
          max="12.0"
          step="0.5"
          value={gateLatency}
          onChange={(e) => setGateLatency(Number(e.target.value))}
          className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
        />
        <div className="flex justify-between text-[10px] text-slate-500 font-mono">
          <span>1.0s (NFC Tap)</span>
          <span>4.0s (Bag Check)</span>
          <span>12.0s (Scanner Failure)</span>
        </div>
      </div>

      {/* 3. Counterfactual Toggles */}
      <div className="space-y-2.5 pt-2 border-t border-slate-800">
        <div className="text-xs font-bold uppercase text-slate-400 tracking-wider">
          Counterfactual Mitigations
        </div>

        {/* Stadium Specific Controls */}
        {scenario === 'stadium' && (
          <>
            {/* Upstream Zigzag Baffles */}
            <button
              onClick={toggleBaffles}
              className={`w-full flex items-center justify-between p-2.5 rounded-lg border text-xs font-medium transition ${
                bafflesActive
                  ? 'bg-sky-950/60 border-sky-500 text-sky-200'
                  : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <ShieldCheck className={`w-4 h-4 ${bafflesActive ? 'text-sky-400' : 'text-slate-500'}`} />
                <div className="text-left">
                  <div className="font-semibold">40m Upstream Zigzag Baffles</div>
                  <div className="text-[10px] text-slate-400">Absorbs longitudinal surge momentum</div>
                </div>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${bafflesActive ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                {bafflesActive ? 'ENGAGED' : 'STOWED'}
              </span>
            </button>

            {/* Auxiliary Gate B Bypass */}
            <button
              onClick={toggleAuxGate}
              className={`w-full flex items-center justify-between p-2.5 rounded-lg border text-xs font-medium transition ${
                auxGateActive
                  ? 'bg-teal-950/60 border-teal-500 text-teal-200'
                  : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <Zap className={`w-4 h-4 ${auxGateActive ? 'text-teal-400' : 'text-slate-500'}`} />
                <div className="text-left">
                  <div className="font-semibold">Auxiliary Gate B Bypass</div>
                  <div className="text-[10px] text-slate-400">Diverts 45% load to perimeter release</div>
                </div>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${auxGateActive ? 'bg-teal-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                {auxGateActive ? 'OPEN' : 'LOCKED'}
              </span>
            </button>
          </>
        )}

        {/* Transit Bridge Controls */}
        {scenario === 'bridge' && (
          <button
            onClick={toggleDivider}
            className={`w-full flex items-center justify-between p-2.5 rounded-lg border text-xs font-medium transition ${
              dividerActive
                ? 'bg-cyan-950/60 border-cyan-500 text-cyan-200'
                : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <ShieldCheck className={`w-4 h-4 ${dividerActive ? 'text-cyan-400' : 'text-slate-500'}`} />
              <div className="text-left">
                <div className="font-semibold">Central Anti-Deadlock Divider</div>
                <div className="text-[10px] text-slate-400">Separates bidirectional counter-flows</div>
              </div>
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${dividerActive ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
              {dividerActive ? 'INSTALLED' : 'REMOVED'}
            </span>
          </button>
        )}

        {/* Sudden Shock Reversal Controls */}
        {scenario === 'reversal' && (
          <button
            onClick={triggerEmergencyReversal}
            className="w-full flex items-center justify-center gap-2 p-3 rounded-lg border border-rose-500 bg-rose-950/60 hover:bg-rose-900/80 text-rose-200 font-bold text-xs uppercase tracking-wider transition shadow-lg shadow-rose-950/40 animate-pulse"
          >
            <AlertOctagon className="w-4 h-4 text-rose-400" />
            <span>Simulate Panic Reversal Shockwave</span>
          </button>
        )}
      </div>

      {/* 4. Density Telemetry Legend */}
      <div className="pt-2 border-t border-slate-800">
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Dynamic Telemetry Density Map
        </div>
        <div className="space-y-1.5 text-xs font-mono">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span className="text-slate-300">Safe Flow</span>
            </div>
            <span className="text-slate-500">&lt; 2.5 p/m²</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              <span className="text-slate-300">Elevated Friction</span>
            </div>
            <span className="text-slate-500">2.5 – 4.5 p/m²</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
              <span className="text-rose-400 font-semibold">Crush Shockwave</span>
            </div>
            <span className="text-rose-400 font-semibold">≥ 5.0 p/m²</span>
          </div>
        </div>
      </div>
    </div>
  );
};
