import React from 'react';
import { useSimulationStore } from '../../state/useSimulationStore';
import {
  Play,
  Pause,
  RotateCcw,
  FastForward,
  Plus,
  Minus,
  Zap,
  ArrowLeft,
  ShieldCheck,
  Split,
  Bot,
  Sliders
} from 'lucide-react';
import { ActiveGateSector } from '../../types/simulation';

export const GateControls: React.FC = () => {
  const isPaused = useSimulationStore((s) => s.isPaused);
  const togglePause = useSimulationStore((s) => s.togglePause);
  const triggerReset = useSimulationStore((s) => s.triggerReset);
  const timeScale = useSimulationStore((s) => s.timeScale);
  const setTimeScale = useSimulationStore((s) => s.setTimeScale);

  const setViewMode = useSimulationStore((s) => s.setViewMode);
  const activeSector = useSimulationStore((s) => s.activeSector);
  const setActiveSector = useSimulationStore((s) => s.setActiveSector);

  const inflowRate = useSimulationStore((s) => s.inflowRate);
  const setInflowRate = useSimulationStore((s) => s.setInflowRate);
  const gateLatency = useSimulationStore((s) => s.gateLatency);
  const setGateLatency = useSimulationStore((s) => s.setGateLatency);
  const walkingSpeed = useSimulationStore((s) => s.walkingSpeed);
  const setWalkingSpeed = useSimulationStore((s) => s.setWalkingSpeed);

  const counterCountGate1 = useSimulationStore((s) => s.counterCountGate1);
  const counterCountGate2 = useSimulationStore((s) => s.counterCountGate2);
  const addCounter = useSimulationStore((s) => s.addCounter);
  const removeCounter = useSimulationStore((s) => s.removeCounter);

  const sQueueEnabled = useSimulationStore((s) => s.sQueueEnabled);
  const setSQueueEnabled = useSimulationStore((s) => s.setSQueueEnabled);
  const scannerSpeed = useSimulationStore((s) => s.scannerSpeed);
  const securityCheckSpeed = useSimulationStore((s) => s.securityCheckSpeed);

  const overflowRerouteActive = useSimulationStore((s) => s.overflowRerouteActive);
  const toggleOverflowReroute = useSimulationStore((s) => s.toggleOverflowReroute);
  const autonomousRerouteActive = useSimulationStore((s) => s.autonomousRerouteActive);
  const toggleAutonomousReroute = useSimulationStore((s) => s.toggleAutonomousReroute);
  const triggerBurstRush = useSimulationStore((s) => s.triggerBurstRush);

  const sectors: { id: ActiveGateSector; name: string; tag: string; color: string }[] = [
    { id: 'G1-G6_EAST', name: 'East Stand (Gates 1–6)', tag: 'MG Road Metro Feed', color: 'orange' },
    { id: 'G16-G21_NORTH', name: 'North Stand (Gates 16–21)', tag: "Queen's Road Arterial", color: 'sky' },
    { id: 'G7-G11_SOUTH', name: 'South Stand (Gates 7–11)', tag: 'Cubbon Road Promenade', color: 'purple' },
    { id: 'G12-G15_WEST', name: 'West Stand (Gates 12–15)', tag: 'VIP Pavilion & Club', color: 'amber' }
  ];

  return (
    <aside className="w-full h-full flex flex-col gap-3 p-3.5 bg-slate-900/90 border border-slate-800 rounded-xl overflow-y-auto select-none font-sans text-slate-200">
      {/* 1. Header with [ Back to Full Stadium ] Navigation Button */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div>
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
            <span>GATE INGRESS CONTROLS</span>
          </h2>
          <p className="text-[10px] text-slate-400 font-mono">
            Concourse Multi-Stage Turnstiles
          </p>
        </div>
        <button
          onClick={() => setViewMode('stadium')}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-800/80 text-[10px] font-mono font-bold transition active:scale-95 shadow-sm"
          title="Return to 360° Stadium Overview"
        >
          <ArrowLeft className="w-3 h-3 text-cyan-400" />
          <span>Full Stadium</span>
        </button>
      </div>

      {/* 2. Simulation Playback Station */}
      <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/70 border border-slate-800">
        <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider font-semibold">
          Engine Clock
        </span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={togglePause}
            className={`p-1.5 rounded-md text-xs font-bold transition flex items-center gap-1 ${
              isPaused
                ? 'bg-emerald-600 hover:bg-emerald-500 text-slate-950'
                : 'bg-amber-600 hover:bg-amber-500 text-slate-950'
            }`}
            title={isPaused ? 'Resume Simulation' : 'Pause Simulation'}
          >
            {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={triggerReset}
            className="p-1.5 rounded-md border border-slate-800 bg-slate-900 text-slate-300 hover:text-white hover:border-slate-700 transition"
            title="Reset Simulation Crowd"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setTimeScale(timeScale === 1.0 ? 2.0 : timeScale === 2.0 ? 0.5 : 1.0)}
            className="px-2 py-1 rounded-md border border-slate-800 bg-slate-950 text-[10px] font-mono text-cyan-400 hover:border-cyan-700 transition flex items-center gap-1"
            title="Toggle Engine Speed"
          >
            <FastForward className="w-3 h-3" />
            <span>{timeScale}x</span>
          </button>
        </div>
      </div>

      {/* 3. Sector Sub-Selector Tabs */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wider">
          Sector Concourse View
        </label>
        <div className="grid grid-cols-2 gap-1.5 font-mono text-xs">
          {sectors.map((sec) => (
            <button
              key={sec.id}
              onClick={() => setActiveSector(sec.id)}
              className={`p-2 rounded-lg border text-left flex flex-col gap-0.5 transition ${
                activeSector === sec.id
                  ? 'bg-amber-950/80 border-orange-500 text-orange-200 font-bold ring-1 ring-orange-500/70 shadow-md shadow-orange-950/60'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <span className="text-[10px] font-bold leading-tight">{sec.name}</span>
              <span className="text-[8px] text-slate-400">{sec.tag}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Parameter Sliders: Inflow Rate, Turnstile Latency, Walking Speed */}
      <div className="space-y-2.5 p-2.5 rounded-lg bg-slate-950/70 border border-slate-800">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-mono font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-cyan-400" />
            <span>Flow & Calibration Controls</span>
          </label>
          <span className="text-[9px] font-mono text-cyan-400 bg-cyan-950/80 px-1.5 py-0.5 rounded border border-cyan-800/80">
            UNIFIED
          </span>
        </div>

        {/* Inflow Rate */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-slate-300">Inflow Rate</span>
            <span className="font-mono text-xs text-cyan-400 font-bold px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">
              {inflowRate} p/min
            </span>
          </div>
          <input
            type="range"
            min="60"
            max="1200"
            step="20"
            value={inflowRate}
            onChange={(e) => setInflowRate(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>60</span>
            <span>360 (Nominal)</span>
            <span>1,200 (Surge)</span>
          </div>
        </div>

        {/* Turnstile / Frisking Latency */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-slate-300">Turnstile Scan Latency</span>
            <span className="font-mono text-xs text-amber-400 font-bold px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">
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
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>1.0s (NFC)</span>
            <span>4.0s (Nominal)</span>
            <span>12.0s (Outage)</span>
          </div>
        </div>

        {/* Desired Walking Speed */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-slate-300">Desired Walking Speed</span>
            <span className="font-mono text-xs text-emerald-400 font-bold px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">
              {walkingSpeed.toFixed(1)} m/s
            </span>
          </div>
          <input
            type="range"
            min="0.8"
            max="2.5"
            step="0.1"
            value={walkingSpeed}
            onChange={(e) => setWalkingSpeed(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>0.8 m/s (Dense)</span>
            <span>1.3 m/s (Nominal)</span>
            <span>2.5 m/s (Panic)</span>
          </div>
        </div>
      </div>

      {/* 4. Dynamic Screening Staffing (Booths & Latency) */}
      <div className="space-y-2.5 p-2.5 rounded-lg bg-slate-950/70 border border-slate-800">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-mono font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>Dynamic Screening Staffing</span>
          </label>
          <span className="text-[9px] font-mono text-emerald-400">STAGE 2 & 3</span>
        </div>

        {/* Gate 1 Booth Stepper */}
        <div className="flex items-center justify-between p-2 rounded-md bg-slate-900 border border-slate-800">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-amber-300">Gate 1 Booths</span>
            <span className="text-[9px] font-mono text-slate-400">
              Capacity: {Math.round((60 / securityCheckSpeed) * counterCountGate1)} p/min
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => removeCounter('gate-1')}
              disabled={counterCountGate1 <= 2}
              className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-amber-300 font-bold flex items-center justify-center border border-slate-700 active:scale-95 transition"
              title="Remove 1 Security Counter"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="font-mono text-xs font-extrabold text-amber-400 w-6 text-center">
              {counterCountGate1}
            </span>
            <button
              onClick={() => addCounter('gate-1')}
              disabled={counterCountGate1 >= 10}
              className="w-6 h-6 rounded bg-amber-600 hover:bg-amber-500 disabled:opacity-30 text-slate-950 font-bold flex items-center justify-center active:scale-95 transition shadow-sm"
              title="Add 1 Security Counter (+60 p/min)"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Gate 2 Booth Stepper */}
        <div className="flex items-center justify-between p-2 rounded-md bg-slate-900 border border-slate-800">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-cyan-300">Gate 2 Booths (Bypass)</span>
            <span className="text-[9px] font-mono text-slate-400">
              Capacity: {Math.round((60 / securityCheckSpeed) * counterCountGate2)} p/min
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => removeCounter('gate-2')}
              disabled={counterCountGate2 <= 1}
              className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-cyan-300 font-bold flex items-center justify-center border border-slate-700 active:scale-95 transition"
              title="Remove 1 Auxiliary Counter"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="font-mono text-xs font-extrabold text-cyan-400 w-6 text-center">
              {counterCountGate2}
            </span>
            <button
              onClick={() => addCounter('gate-2')}
              disabled={counterCountGate2 >= 8}
              className="w-6 h-6 rounded bg-cyan-600 hover:bg-cyan-500 disabled:opacity-30 text-slate-950 font-bold flex items-center justify-center active:scale-95 transition shadow-sm"
              title="Add 1 Auxiliary Counter (+60 p/min)"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Latency Metrics Readouts */}
        <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[10px]">
          <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
            <div className="text-slate-400">Automated NFC Tap</div>
            <div className="text-cyan-400 font-bold">{scannerSpeed.toFixed(1)}s / person</div>
          </div>
          <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
            <div className="text-slate-400">Frisking Latency</div>
            <div className="text-amber-400 font-bold">{securityCheckSpeed.toFixed(1)}s / person</div>
          </div>
        </div>
      </div>

      {/* 5. Queue Structure Toggles */}
      <div className="space-y-2 p-2.5 rounded-lg bg-slate-950/70 border border-slate-800">
        <label className="text-[10px] font-mono font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
          <Split className="w-3.5 h-3.5 text-cyan-400" />
          <span>Queue Structure Controls</span>
        </label>

        {/* Enforce S-Curve Switchback Queues */}
        <label className="flex items-center gap-2.5 p-2 rounded-md bg-slate-900 border border-slate-800 hover:border-slate-700 cursor-pointer transition">
          <input
            type="checkbox"
            checked={sQueueEnabled}
            onChange={(e) => setSQueueEnabled(e.target.checked)}
            className="w-4 h-4 rounded text-orange-500 accent-orange-500 cursor-pointer"
          />
          <div className="flex flex-col">
            <span className="text-[11px] font-bold text-slate-200">
              Enforce S-Curve Switchback Queues
            </span>
            <span className="text-[9px] text-slate-400 font-mono">
              3-tier zigzag rails throttle shockwaves
            </span>
          </div>
        </label>

        {/* Dynamic Load-Balancing Divert to Gate 2 */}
        <label className="flex items-center gap-2.5 p-2 rounded-md bg-slate-900 border border-slate-800 hover:border-slate-700 cursor-pointer transition">
          <input
            type="checkbox"
            checked={overflowRerouteActive}
            onChange={toggleOverflowReroute}
            className="w-4 h-4 rounded text-cyan-500 accent-cyan-500 cursor-pointer"
          />
          <div className="flex flex-col">
            <span className="text-[11px] font-bold text-slate-200">
              Dynamic Load-Balancing Divert to Gate 2
            </span>
            <span className="text-[9px] text-slate-400 font-mono">
              Redirects 50% inflow to auxiliary gates
            </span>
          </div>
        </label>

        {/* Autonomous AI Commander Status */}
        <label className="flex items-center gap-2.5 p-2 rounded-md bg-slate-900 border border-slate-800 hover:border-slate-700 cursor-pointer transition">
          <input
            type="checkbox"
            checked={autonomousRerouteActive}
            onChange={toggleAutonomousReroute}
            className="w-4 h-4 rounded text-emerald-500 accent-emerald-500 cursor-pointer"
          />
          <div className="flex flex-col">
            <span className="text-[11px] font-bold text-emerald-300 flex items-center gap-1">
              <Bot className="w-3 h-3 text-emerald-400" />
              <span>AI Autonomous Reroute</span>
            </span>
            <span className="text-[9px] text-emerald-400/80 font-mono">
              Auto-activates when local density &gt; 4.0 p/m²
            </span>
          </div>
        </label>
      </div>

      {/* 6. Surge Action Button: Simulate 500-Person Burst Rush */}
      <button
        onClick={() => triggerBurstRush(500)}
        className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-gradient-to-r from-amber-600 via-orange-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-slate-950 font-extrabold text-xs shadow-lg shadow-orange-950/60 transition active:scale-[0.98]"
        title="Triggers an immediate 500-person burst rush to stress-test automated load balancing"
      >
        <Zap className="w-4 h-4 text-slate-950 fill-current" />
        <span>Simulate 500-Person Burst Rush</span>
      </button>
    </aside>
  );
};
export default GateControls;

