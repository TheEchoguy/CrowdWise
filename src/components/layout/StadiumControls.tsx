import React from 'react';
import { useSimulationStore } from '../../state/useSimulationStore';
import {
  Play,
  Pause,
  RotateCcw,
  FastForward,
  Train,
  AlertTriangle,
  Bot,
  Flame,
  ArrowRight,
  Sliders,
  ShieldCheck,
  Plus,
  Minus,
  DoorOpen,
  Zap
} from 'lucide-react';
import { MatchPhase } from '../../types/simulation';

export const StadiumControls: React.FC = () => {
  const isPaused = useSimulationStore((s) => s.isPaused);
  const togglePause = useSimulationStore((s) => s.togglePause);
  const triggerReset = useSimulationStore((s) => s.triggerReset);
  const timeScale = useSimulationStore((s) => s.timeScale);
  const setTimeScale = useSimulationStore((s) => s.setTimeScale);

  const setViewMode = useSimulationStore((s) => s.setViewMode);
  const setActiveSector = useSimulationStore((s) => s.setActiveSector);

  const matchPhase = useSimulationStore((s) => s.matchPhase);
  const setMatchPhase = useSimulationStore((s) => s.setMatchPhase);

  const sectorInflow = useSimulationStore((s) => s.sectorInflow);
  const setSectorInflow = useSimulationStore((s) => s.setSectorInflow);

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
  const overflowRerouteActive = useSimulationStore((s) => s.overflowRerouteActive);
  const toggleOverflowReroute = useSimulationStore((s) => s.toggleOverflowReroute);
  const securityCheckSpeed = useSimulationStore((s) => s.securityCheckSpeed);

  const triggerMetroPulse = useSimulationStore((s) => s.triggerMetroPulse);
  const scannerFailureActive = useSimulationStore((s) => s.scannerFailureActive);
  const toggleScannerFailure = useSimulationStore((s) => s.toggleScannerFailure);
  const autonomousRerouteActive = useSimulationStore((s) => s.autonomousRerouteActive);
  const toggleAutonomousReroute = useSimulationStore((s) => s.toggleAutonomousReroute);

  const matchPhases: { id: MatchPhase; label: string; desc: string; iconType: 'green' | 'metro' | 'rush' | 'egress' }[] = [
    { id: 'PRE_GATES', label: 'Gates Open', desc: 'Pre-Match Steady Inflow', iconType: 'green' },
    { id: 'METRO_PEAK', label: 'Metro Peak', desc: 'MG Road Train Surge', iconType: 'metro' },
    { id: 'ANTHEM_RUSH', label: 'Anthem Rush', desc: 'T-15min Venue Rush', iconType: 'rush' },
    { id: 'EGRESS', label: 'Match Egress', desc: 'Post-Match Mass Egress', iconType: 'egress' }
  ];

  return (
    <aside className="w-full h-full flex flex-col gap-3 p-3.5 bg-slate-900/90 border border-slate-800 rounded-xl overflow-y-auto select-none font-sans text-slate-200">
      {/* 1. Header with 35k Venue Tag */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div>
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
            <span>STADIUM COMMAND CONTROLS</span>
          </h2>
          <p className="text-[10px] text-slate-400 font-mono">
            M. Chinnaswamy Stadium Perimeter Ingress
          </p>
        </div>
        <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-300">
          35K VENUE
        </span>
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

      {/* 3. Switch to Sector Gate View Shortcut */}
      <button
        onClick={() => {
          setViewMode('gate');
          setActiveSector('G1-G6_EAST');
        }}
        className="w-full flex items-center justify-between p-2 rounded-lg bg-gradient-to-r from-orange-950/60 to-amber-950/40 border border-orange-700/60 hover:border-orange-500 text-orange-200 transition group shadow-sm"
      >
        <div className="flex items-center gap-2">
          <DoorOpen className="w-4 h-4 text-orange-400" />
          <div className="text-left">
            <div className="text-[11px] font-bold text-orange-300">
              Switch to East Stand Gates 1–6 Concourse
            </div>
            <div className="text-[9px] text-orange-400/80 font-mono">
              Inspect S-Queue, Fast NFC Tap & Security Staffing
            </div>
          </div>
        </div>
        <ArrowRight className="w-3.5 h-3.5 text-orange-400 group-hover:translate-x-0.5 transition" />
      </button>

      {/* 4. Match Inflow Phase Selector */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
          <span>Match Inflow Phase</span>
          <span className="text-cyan-400 font-bold">{matchPhase}</span>
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          {matchPhases.map((phase) => (
            <button
              key={phase.id}
              onClick={() => setMatchPhase(phase.id)}
              className={`p-2 rounded-lg border text-left flex flex-col gap-0.5 transition ${
                matchPhase === phase.id
                  ? 'bg-cyan-950/80 border-cyan-500 text-cyan-200 font-bold shadow-md shadow-cyan-950/50 ring-1 ring-cyan-500/60'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-1.5">
                {phase.iconType === 'green' && <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0" />}
                {phase.iconType === 'metro' && <Train className="w-3.5 h-3.5 text-rose-400 shrink-0" />}
                {phase.iconType === 'rush' && <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                {phase.iconType === 'egress' && <DoorOpen className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}
                <span className="text-[11px] leading-tight font-bold">{phase.label}</span>
              </div>
              <span className="text-[8px] text-slate-400 font-mono">{phase.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 5. Stand Inflow Sliders (Perimeter Sectors) */}
      <div className="space-y-2.5 p-2.5 rounded-lg bg-slate-950/70 border border-slate-800">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-mono font-semibold text-slate-300 uppercase tracking-wider">
            Sector Inflow Sliders
          </label>
          <span className="text-[9px] font-mono text-cyan-400">p/min</span>
        </div>

        {/* East Stand (Gates 1-6) */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-[10px]">
            <span className="font-semibold text-orange-300 flex items-center gap-1">
              <span>East Stand (Gates 1–6 Metro Feed)</span>
            </span>
            <span className="font-mono text-orange-400 font-bold px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800">
              {sectorInflow['G1-G6_EAST'] ?? 300} p/min
            </span>
          </div>
          <input
            type="range"
            min="100"
            max="1200"
            step="25"
            value={sectorInflow['G1-G6_EAST'] ?? 300}
            onChange={(e) => setSectorInflow('G1-G6_EAST', Number(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
          />
        </div>

        {/* North Stand (Gates 16-21) */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-[10px]">
            <span className="font-semibold text-sky-300">North Stand (Gates 16–21 Queen's Rd)</span>
            <span className="font-mono text-sky-400 font-bold px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800">
              {sectorInflow['G16-G21_NORTH'] ?? 200} p/min
            </span>
          </div>
          <input
            type="range"
            min="80"
            max="800"
            step="20"
            value={sectorInflow['G16-G21_NORTH'] ?? 200}
            onChange={(e) => setSectorInflow('G16-G21_NORTH', Number(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
          />
        </div>

        {/* South Stand (Gates 7-11) */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-[10px]">
            <span className="font-semibold text-purple-300">South Stand (Gates 7–11 Cubbon Rd)</span>
            <span className="font-mono text-purple-400 font-bold px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800">
              {sectorInflow['G7-G11_SOUTH'] ?? 180} p/min
            </span>
          </div>
          <input
            type="range"
            min="60"
            max="600"
            step="15"
            value={sectorInflow['G7-G11_SOUTH'] ?? 180}
            onChange={(e) => setSectorInflow('G7-G11_SOUTH', Number(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
          />
        </div>

        {/* West Stand (Gates 12-15) */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-[10px]">
            <span className="font-semibold text-amber-300">West Stand (Gates 12–15 Pavilion)</span>
            <span className="font-mono text-amber-400 font-bold px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800">
              {sectorInflow['G12-G15_WEST'] ?? 100} p/min
            </span>
          </div>
          <input
            type="range"
            min="40"
            max="400"
            step="10"
            value={sectorInflow['G12-G15_WEST'] ?? 100}
            onChange={(e) => setSectorInflow('G12-G15_WEST', Number(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
          />
        </div>
      </div>

      {/* 5b. Flow & Calibration Sliders */}
      <div className="space-y-2.5 p-2.5 rounded-lg bg-slate-950/70 border border-slate-800">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-mono font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-cyan-400" />
            <span>Master Flow & Physics Controls</span>
          </label>
          <span className="text-[9px] font-mono text-cyan-400 bg-cyan-950/80 px-1.5 py-0.5 rounded border border-cyan-800/80">
            GLOBAL
          </span>
        </div>

        {/* Global Inflow Rate Slider */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-slate-300">Total Stadium Inflow</span>
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

        {/* Turnstile Scan Latency */}
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

      {/* 5c. Dynamic Security Staffing & Turnstile Control */}
      <div className="space-y-2 p-2.5 rounded-lg bg-slate-950/70 border border-slate-800">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-mono font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>Dynamic Security Staffing</span>
          </label>
          <span className="text-[9px] font-mono text-emerald-400">STAFFING</span>
        </div>

        {/* Gate 1 Booths Stepper */}
        <div className="flex items-center justify-between p-2 rounded-md bg-slate-900 border border-slate-800">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-amber-300">Gate 1 Security Booths</span>
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

        {/* Gate 2 Booths Stepper */}
        <div className="flex items-center justify-between p-2 rounded-md bg-slate-900 border border-slate-800">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-cyan-300">Gate 2 Auxiliary Booths</span>
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

        {/* Queue Structure Controls */}
        <div className="pt-1.5 space-y-1.5 border-t border-slate-800/80">
          <label className="flex items-center gap-2 cursor-pointer text-xs">
            <input
              type="checkbox"
              checked={sQueueEnabled}
              onChange={(e) => setSQueueEnabled(e.target.checked)}
              className="w-3.5 h-3.5 accent-orange-500 rounded cursor-pointer"
            />
            <span className="text-[10px] text-slate-300 font-semibold">Enforce S-Curve Snake Queue</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-xs">
            <input
              type="checkbox"
              checked={overflowRerouteActive}
              onChange={toggleOverflowReroute}
              className="w-3.5 h-3.5 accent-cyan-500 rounded cursor-pointer"
            />
            <span className="text-[10px] text-slate-300 font-semibold">Dynamic Load Balancing (Divert to Gate 2)</span>
          </label>
        </div>
      </div>

      {/* 6. Incident Injection Triggers */}
      <div className="space-y-2">
        <label className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
          <Flame className="w-3 h-3 text-rose-500" />
          <span>Incident Injection Triggers</span>
        </label>

        {/* Simulate MG Road Purple Line Metro Burst */}
        <button
          onClick={triggerMetroPulse}
          className="w-full flex items-center justify-between p-2 rounded-lg bg-rose-950/60 border border-rose-800/80 hover:border-rose-600 text-rose-200 transition active:scale-[0.98] shadow-sm"
          title="Simulate 6-Coach Metro Train Arrival with 600 passengers"
        >
          <div className="flex items-center gap-2">
            <Train className="w-4 h-4 text-rose-400 shrink-0" />
            <div className="text-left">
              <div className="text-[11px] font-bold">Simulate MG Road Metro Burst</div>
              <div className="text-[9px] text-rose-400/80 font-mono">+600 fans arriving at Gate 1 & 2</div>
            </div>
          </div>
          <span className="text-[10px] font-bold text-rose-400 font-mono">+600</span>
        </button>

        {/* Simulate Gate 1 Scanner Outage */}
        <button
          onClick={toggleScannerFailure}
          className={`w-full flex items-center justify-between p-2 rounded-lg border transition active:scale-[0.98] ${
            scannerFailureActive
              ? 'bg-red-950 border-red-500 text-red-200 shadow-md ring-1 ring-red-500/70'
              : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 text-slate-300'
          }`}
          title="Toggle Gate 1 Automated Scanner Technical Failure"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className={`w-4 h-4 ${scannerFailureActive ? 'text-red-400' : 'text-slate-400'}`} />
            <div className="text-left">
              <div className="text-[11px] font-bold">
                {scannerFailureActive ? 'Scanner Outage ACTIVE' : 'Simulate Gate 1 Scanner Outage'}
              </div>
              <div className="text-[9px] font-mono text-slate-400">
                {scannerFailureActive ? 'Turnstile speed crippled to 8.0s' : 'Spikes queue wait times'}
              </div>
            </div>
          </div>
          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${scannerFailureActive ? 'bg-red-900 text-red-200 font-bold' : 'bg-slate-800 text-slate-400'}`}>
            {scannerFailureActive ? 'ACTIVE' : 'TEST'}
          </span>
        </button>
      </div>

      {/* 7. Mitigation Checkbox: Autonomous Multi-Gate Balancing */}
      <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-900/60 flex items-center justify-between">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={autonomousRerouteActive}
            onChange={toggleAutonomousReroute}
            className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
          />
          <div className="flex flex-col">
            <span className="text-[11px] font-bold text-emerald-300 flex items-center gap-1">
              <Bot className="w-3.5 h-3.5 text-emerald-400" />
              <span>Autonomous Multi-Gate Balancing</span>
            </span>
            <span className="text-[9px] text-emerald-400/80 font-mono">
              AI Incident Commander Dynamic Load Diversion
            </span>
          </div>
        </label>
        <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-800">
          ARMED
        </span>
      </div>
    </aside>
  );
};
export default StadiumControls;
