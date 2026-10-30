import React from 'react';
import { useSimulationStore } from '../../state/useSimulationStore';
import { RoadSectorId } from '../../types/simulation';
import { KSCA_STADIUM_SECTORS } from '../../engine/ChinnaswamyData';
import {
  Play,
  Pause,
  RotateCcw,
  Sliders,
  Globe,
  DoorOpen,
  Zap,
  Train,
  Plus,
  Minus,
  ShieldAlert,
  Bot
} from 'lucide-react';

export const LeftControls: React.FC = () => {
  // Store Subscriptions
  const currentView = useSimulationStore((s) => s.currentView);
  const setCurrentView = useSimulationStore((s) => s.setCurrentView);
  const selectedSector = (useSimulationStore((s) => s.selectedRoadSector) ||
    useSimulationStore((s) => s.selectedSector) ||
    'LINK_ROAD') as RoadSectorId;
  const setSelectedSector = useSimulationStore((s) => s.setSelectedSector);

  const inflowRate = useSimulationStore((s) => s.inflowRate);
  const setInflowRate = useSimulationStore((s) => s.setInflowRate);

  const baggageScanLatency = useSimulationStore((s) => s.baggageScanLatency);
  const setBaggageScanLatency = useSimulationStore((s) => s.setBaggageScanLatency);

  const turnstileScanLatency = useSimulationStore((s) => s.turnstileScanLatency);
  const setTurnstileScanLatency = useSimulationStore((s) => s.setTurnstileScanLatency);

  const walkingSpeed = useSimulationStore((s) => s.walkingSpeed);
  const setWalkingSpeed = useSimulationStore((s) => s.setWalkingSpeed);

  const counterFlowActive = useSimulationStore((s) => s.counterFlowActive);
  const toggleCounterFlow = useSimulationStore((s) => s.toggleCounterFlow);

  const sectorTurnstileOverrides = useSimulationStore((s) => s.sectorTurnstileOverrides);
  const setSectorTurnstileCount = useSimulationStore((s) => s.setSectorTurnstileCount);

  const autonomousRerouteActive = useSimulationStore((s) => s.autonomousRerouteActive);
  const toggleAutonomousReroute = useSimulationStore((s) => s.toggleAutonomousReroute);

  const isPaused = useSimulationStore((s) => s.isPaused);
  const togglePause = useSimulationStore((s) => s.togglePause);
  const timeScale = useSimulationStore((s) => s.timeScale);
  const setTimeScale = useSimulationStore((s) => s.setTimeScale);
  const triggerReset = useSimulationStore((s) => s.triggerReset);
  const triggerMetroPulse = useSimulationStore((s) => s.triggerMetroPulse);

  const sectors: { id: RoadSectorId; name: string; tag: string; isRestricted: boolean }[] = [
    { id: 'CUBBON_ROAD', name: 'Cubbon Road (North)', tag: 'Minsk Sq ──► BRV', isRestricted: false },
    { id: 'LINK_ROAD', name: 'Link Road (East)', tag: 'From MG Metro', isRestricted: false },
    { id: 'MG_ROAD', name: 'MG Road (South)', tag: 'Plaza & Metro Feed', isRestricted: false },
    { id: 'QUEENS_ROAD', name: "Queen's Rd (Restricted)", tag: 'VIP / Media Only', isRestricted: true }
  ];

  const activeSectorData = KSCA_STADIUM_SECTORS[selectedSector] || KSCA_STADIUM_SECTORS.LINK_ROAD;

  return (
    <div className="flex flex-col gap-3 p-3 bg-slate-900/90 border border-slate-800 rounded-xl backdrop-blur-md text-slate-200 h-full overflow-y-auto">
      {/* Title & Engine Playback Bar */}
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
            <span>{timeScale}x</span>
          </button>
        </div>
      </div>

      {/* 1. Top View Switcher Tabs */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wider">
          Simulation View Mode
        </label>
        <div className="grid grid-cols-2 gap-1.5 font-mono text-xs">
          <button
            onClick={() => setCurrentView('MACRO_STADIUM')}
            className={`p-2 rounded-lg border text-left flex items-center gap-2 transition ${
              currentView === 'MACRO_STADIUM'
                ? 'bg-cyan-950/80 border-cyan-500 text-cyan-300 font-bold ring-1 ring-cyan-500/70 shadow-md shadow-cyan-950/60'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <Globe className="w-4 h-4 text-cyan-400 shrink-0" />
            <div className="flex flex-col">
              <span className="text-[10px] font-bold leading-tight">Full Stadium</span>
              <span className="text-[8px] text-slate-400">360° Satellite</span>
            </div>
          </button>

          <button
            onClick={() => setCurrentView('SECTOR_CONCOURSE')}
            className={`p-2 rounded-lg border text-left flex items-center gap-2 transition ${
              currentView === 'SECTOR_CONCOURSE'
                ? 'bg-amber-950/80 border-orange-500 text-orange-200 font-bold ring-1 ring-orange-500/70 shadow-md shadow-orange-950/60'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <DoorOpen className="w-4 h-4 text-amber-400 shrink-0" />
            <div className="flex flex-col">
              <span className="text-[10px] font-bold leading-tight">Sector Concourse</span>
              <span className="text-[8px] text-slate-400">1:1 Scale CAD</span>
            </div>
          </button>
        </div>
      </div>

      {/* 2. Sector Sub-Selector (Active in Concourse View) */}
      <div className="space-y-1.5 p-2 rounded-lg bg-slate-950/70 border border-slate-800">
        <label className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
          <span>Perimeter Road Sector</span>
          <span className="text-cyan-400 font-bold text-[9px]">KSCA MAP</span>
        </label>
        <div className="grid grid-cols-2 gap-1.5 font-mono text-xs">
          {sectors.map((sec) => (
            <button
              key={sec.id}
              onClick={() => {
                setSelectedSector(sec.id);
                setCurrentView('SECTOR_CONCOURSE');
              }}
              className={`p-1.5 rounded-lg border text-left flex flex-col gap-0.5 transition ${
                selectedSector === sec.id
                  ? sec.isRestricted
                    ? 'bg-red-950/80 border-red-500 text-red-200 font-bold ring-1 ring-red-500/70'
                    : 'bg-amber-950/80 border-orange-500 text-orange-200 font-bold ring-1 ring-orange-500/70'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold leading-tight">{sec.name}</span>
                {sec.isRestricted && <ShieldAlert className="w-3 h-3 text-red-400 shrink-0" />}
              </div>
              <span className="text-[8px] text-slate-500">{sec.tag}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 3. Ingress Rate & Latency Sliders */}
      <div className="space-y-2.5 p-2.5 rounded-lg bg-slate-950/70 border border-slate-800">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-mono font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-cyan-400" />
            <span>Ingress & Latency Sliders</span>
          </label>
          <span className="text-[9px] font-mono text-cyan-400 bg-cyan-950/80 px-1.5 py-0.5 rounded border border-cyan-800/80">
            CALIBRATED
          </span>
        </div>

        {/* Inflow Rate */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-slate-300">Total Inflow Rate</span>
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

        {/* Outer Gate Frisking Latency */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-slate-300">Outer Baggage Frisking</span>
            <span className="font-mono text-xs text-amber-400 font-bold px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">
              {baggageScanLatency.toFixed(1)}s / person
            </span>
          </div>
          <input
            type="range"
            min="1.0"
            max="8.0"
            step="0.5"
            value={baggageScanLatency}
            onChange={(e) => setBaggageScanLatency(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>1.0s (Express)</span>
            <span>3.5s (Nominal)</span>
            <span>8.0s (Strict)</span>
          </div>
        </div>

        {/* Inner Turnstile Fast-Scan Latency */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-slate-300">Inner Turnstile Fast-Scan</span>
            <span className="font-mono text-xs text-emerald-400 font-bold px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">
              {turnstileScanLatency.toFixed(1)}s / person
            </span>
          </div>
          <input
            type="range"
            min="0.2"
            max="4.0"
            step="0.2"
            value={turnstileScanLatency}
            onChange={(e) => setTurnstileScanLatency(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>0.2s (NFC Tap)</span>
            <span>1.0s (QR Barcode)</span>
            <span>4.0s (Manual)</span>
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
            <span>1.3 m/s (Fruin)</span>
            <span>2.5 m/s (Rush)</span>
          </div>
        </div>
      </div>

      {/* 4. Dynamic Turnstile Staffing Stepper */}
      <div className="space-y-2 p-2.5 rounded-lg bg-slate-950/70 border border-slate-800">
        <label className="text-[10px] font-mono font-semibold text-slate-300 uppercase tracking-wider flex items-center justify-between">
          <span>Active Sector Turnstiles</span>
          <span className="text-amber-400 font-bold text-[9px]">{activeSectorData.name}</span>
        </label>
        <div className="space-y-1.5">
          {activeSectorData.innerGates.map((ig) => {
            const currentCount = sectorTurnstileOverrides[ig.id] || ig.turnstileCount;
            return (
              <div
                key={ig.id}
                className="flex items-center justify-between p-1.5 rounded bg-slate-900 border border-slate-800 text-[11px] font-mono"
              >
                <div className="flex flex-col">
                  <span className="font-bold text-slate-200">
                    {ig.id} ({ig.stand})
                  </span>
                  <span className="text-[9px] text-slate-400">
                    {currentCount * 60} p/min capacity
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setSectorTurnstileCount(ig.id, currentCount - 1)}
                    disabled={currentCount <= 1}
                    className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-amber-300 font-bold flex items-center justify-center border border-slate-700 active:scale-95 transition"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="text-xs font-bold text-amber-400 w-4 text-center">
                    {currentCount}
                  </span>
                  <button
                    onClick={() => setSectorTurnstileCount(ig.id, currentCount + 1)}
                    disabled={currentCount >= 10}
                    className="w-5 h-5 rounded bg-amber-600 hover:bg-amber-500 disabled:opacity-30 text-slate-950 font-bold flex items-center justify-center active:scale-95 transition shadow-sm"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Hurdle & Scenario Triggers */}
      <div className="space-y-2 p-2.5 rounded-lg bg-slate-950/70 border border-slate-800">
        <label className="text-[10px] font-mono font-semibold text-slate-300 uppercase tracking-wider">
          Hurdle & Scenario Triggers
        </label>

        {/* Counter-Flow Rejection Trigger */}
        <button
          onClick={toggleCounterFlow}
          className={`w-full py-2 px-3 rounded-lg border text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition active:scale-95 shadow-sm ${
            counterFlowActive
              ? 'bg-rose-950 text-rose-300 border-rose-500 shadow-rose-950/60 ring-1 ring-rose-500/70'
              : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700'
          }`}
        >
          <Zap className="w-3.5 h-3.5 text-rose-400" />
          <span>{counterFlowActive ? '8% Counter-Flow (ACTIVE)' : 'Simulate 8% Ticket Rejection'}</span>
        </button>

        {/* Metro Train Arrival Pulse */}
        <button
          onClick={triggerMetroPulse}
          className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-slate-950 font-extrabold text-xs font-mono flex items-center justify-center gap-1.5 shadow-md transition active:scale-95"
        >
          <Train className="w-3.5 h-3.5" />
          <span>Simulate Metro Pulse (+500 Agents)</span>
        </button>

        {/* AI Autonomous Smart Rerouting */}
        <label className="flex items-center gap-2 p-2 rounded bg-slate-900 border border-slate-800 cursor-pointer text-xs font-mono">
          <input
            type="checkbox"
            checked={autonomousRerouteActive}
            onChange={toggleAutonomousReroute}
            className="w-3.5 h-3.5 accent-cyan-500 rounded cursor-pointer"
          />
          <div className="flex items-center gap-1 text-slate-300 font-semibold">
            <Bot className="w-3.5 h-3.5 text-cyan-400" />
            <span>Autonomous AI Smart Rerouting</span>
          </div>
        </label>
      </div>
    </div>
  );
};

export { GateControls } from './GateControls';
export default LeftControls;
