import React from 'react';
import { useSimulationStore } from '../../state/useSimulationStore';
import { ScenarioType } from '../../types/simulation';
import {
  Play,
  Pause,
  RotateCcw,
  FastForward,
  Sliders,
  Zap,
  Waves,
  Train,
  AlertOctagon,
  Bot,
  Plus,
  Minus,
  Shield
} from 'lucide-react';

export const LeftControls: React.FC = () => {
  const scenario = useSimulationStore((s) => s.scenario);
  const setScenario = useSimulationStore((s) => s.setScenario);

  const stadiumViewMode = useSimulationStore((s) => s.stadiumViewMode);
  const setStadiumViewMode = useSimulationStore((s) => s.setStadiumViewMode);

  const activeGateSector = useSimulationStore((s) => s.activeGateSector);
  const setActiveGateSector = useSimulationStore((s) => s.setActiveGateSector);

  const overflowRerouteActive = useSimulationStore((s) => s.overflowRerouteActive);
  const toggleOverflowReroute = useSimulationStore((s) => s.toggleOverflowReroute);

  const scannerFailureActive = useSimulationStore((s) => s.scannerFailureActive);
  const toggleScannerFailure = useSimulationStore((s) => s.toggleScannerFailure);

  const autonomousRerouteActive = useSimulationStore((s) => s.autonomousRerouteActive);
  const toggleAutonomousReroute = useSimulationStore((s) => s.toggleAutonomousReroute);

  const counterCountGate1 = useSimulationStore((s) => s.counterCountGate1);
  const counterCountGate2 = useSimulationStore((s) => s.counterCountGate2);
  const addCounter = useSimulationStore((s) => s.addCounter);
  const removeCounter = useSimulationStore((s) => s.removeCounter);
  const sQueueEnabled = useSimulationStore((s) => s.sQueueEnabled);
  const setSQueueEnabled = useSimulationStore((s) => s.setSQueueEnabled);
  const scannerSpeed = useSimulationStore((s) => s.scannerSpeed);
  const securityCheckSpeed = useSimulationStore((s) => s.securityCheckSpeed);

  const triggerMetroPulse = useSimulationStore((s) => s.triggerMetroPulse);

  const inflowRate = useSimulationStore((s) => s.inflowRate);
  const setInflowRate = useSimulationStore((s) => s.setInflowRate);

  const gateLatency = useSimulationStore((s) => s.gateLatency);
  const setGateLatency = useSimulationStore((s) => s.setGateLatency);

  const walkingSpeed = useSimulationStore((s) => s.walkingSpeed);
  const setWalkingSpeed = useSimulationStore((s) => s.setWalkingSpeed);

  const bafflesActive = useSimulationStore((s) => s.bafflesActive);
  const toggleBaffles = useSimulationStore((s) => s.toggleBaffles);

  const auxGateActive = useSimulationStore((s) => s.auxGateActive);

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
    { id: 'stadium', label: 'Chinnaswamy', icon: '🏟️' },
    { id: 'bridge', label: 'Footbridge', icon: '🌉' },
    { id: 'reversal', label: 'Shock Reversal', icon: '🚨' }
  ];

  return (
    <div className="flex flex-col gap-3 p-3 bg-slate-900/90 border border-slate-800 rounded-xl backdrop-blur-md text-slate-200 h-full overflow-y-auto">
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
            <FastForward className="w-3.5 h-3.5" />
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
                  ? 'bg-amber-950/70 border-orange-500 text-orange-400 font-bold shadow-md shadow-orange-950/60 ring-1 ring-orange-500/80'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <span className="text-base">{sc.icon}</span>
              <span className="text-[10px] leading-tight text-center">{sc.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 2. Chinnaswamy Stadium Sector Selector Deck */}
      {scenario === 'stadium' && (
        <div className="space-y-2 p-2.5 rounded-lg bg-slate-950/70 border border-slate-800">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
              Chinnaswamy Digital Twin
            </label>
            <span className="text-[9px] font-mono text-cyan-400 bg-cyan-950/70 px-1.5 py-0.5 rounded border border-cyan-800/60">
              35K CAPACITY
            </span>
          </div>

          {/* Full Stadium Macro Radar Toggle */}
          <button
            onClick={() => setStadiumViewMode('MACRO_VIEW')}
            className={`w-full p-2 rounded-lg border text-left flex items-center justify-between transition ${
              stadiumViewMode === 'MACRO_VIEW'
                ? 'bg-cyan-950/80 border-cyan-500 text-cyan-300 ring-1 ring-cyan-500/60 font-bold shadow-sm'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-base">🌐</span>
              <div className="flex flex-col">
                <span className="text-[11px] font-bold">Full Stadium Macro Radar</span>
                <span className="text-[9px] text-slate-400 font-mono">21 Perimeter Gates & Pitch Heatmap</span>
              </div>
            </div>
            {stadiumViewMode === 'MACRO_VIEW' && (
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            )}
          </button>

          {/* Individual Stand Concourse Selectors */}
          <div className="space-y-1">
            <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider">
              Micro Concourse Ingress Gates:
            </span>
            <div className="grid grid-cols-2 gap-1.5 font-mono text-xs">
              {/* East Stand (G1-6) */}
              <button
                onClick={() => {
                  setStadiumViewMode('MICRO_VIEW_EAST');
                  setActiveGateSector('G1-G6_EAST');
                }}
                className={`p-1.5 rounded border text-left flex flex-col gap-0.5 transition ${
                  stadiumViewMode !== 'MACRO_VIEW' && activeGateSector === 'G1-G6_EAST'
                    ? 'bg-orange-950/80 border-orange-500 text-orange-300 ring-1 ring-orange-500/60 font-bold'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <span className="text-[10px] font-bold">East Stand (G1–6)</span>
                <span className="text-[8px] text-slate-500">MG Metro (12.5k)</span>
              </button>

              {/* North Stand (G16-21) */}
              <button
                onClick={() => {
                  setStadiumViewMode('MICRO_VIEW_EAST');
                  setActiveGateSector('G16-G21_NORTH');
                }}
                className={`p-1.5 rounded border text-left flex flex-col gap-0.5 transition ${
                  stadiumViewMode !== 'MACRO_VIEW' && activeGateSector === 'G16-G21_NORTH'
                    ? 'bg-sky-950/80 border-sky-500 text-sky-300 ring-1 ring-sky-500/60 font-bold'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <span className="text-[10px] font-bold">North Stand (G16–21)</span>
                <span className="text-[8px] text-slate-500">Queen's Rd (8.5k)</span>
              </button>

              {/* South Stand (G7-11) */}
              <button
                onClick={() => {
                  setStadiumViewMode('MICRO_VIEW_EAST');
                  setActiveGateSector('G7-G11_SOUTH');
                }}
                className={`p-1.5 rounded border text-left flex flex-col gap-0.5 transition ${
                  stadiumViewMode !== 'MACRO_VIEW' && activeGateSector === 'G7-G11_SOUTH'
                    ? 'bg-purple-950/80 border-purple-500 text-purple-300 ring-1 ring-purple-500/60 font-bold'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <span className="text-[10px] font-bold">South Stand (G7–11)</span>
                <span className="text-[8px] text-slate-500">Cubbon Rd (7.5k)</span>
              </button>

              {/* West Stand (G12-15) */}
              <button
                onClick={() => {
                  setStadiumViewMode('MICRO_VIEW_EAST');
                  setActiveGateSector('G12-G15_WEST');
                }}
                className={`p-1.5 rounded border text-left flex flex-col gap-0.5 transition ${
                  stadiumViewMode !== 'MACRO_VIEW' && activeGateSector === 'G12-G15_WEST'
                    ? 'bg-amber-950/80 border-amber-500 text-amber-300 ring-1 ring-amber-500/60 font-bold'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <span className="text-[10px] font-bold">West Stand (G12–15)</span>
                <span className="text-[8px] text-slate-500">VIP Club (6.5k)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Parameter Sliders bound directly to Zustand store */}
      <div className="space-y-2.5 pt-1 border-t border-slate-800">
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
            <span className="font-semibold text-slate-300">Turnstile Scan Latency</span>
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

      {/* 4. Operational Counterfactuals & Stadium Interventions */}
      <div className="space-y-2 pt-2 border-t border-slate-800">
        <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          Mitigation & Incident Response
        </label>

        {/* Chinnaswamy Stadium Mitigations & Incident Controls */}
        {scenario === 'stadium' && (
          <div className="space-y-2">
            {/* Autonomous Smart Rerouting (AI Incident Commander) Toggle */}
            <label className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-950 border border-cyan-800/80 cursor-pointer hover:border-cyan-600 text-xs shadow-md">
              <input
                type="checkbox"
                checked={autonomousRerouteActive}
                onChange={toggleAutonomousReroute}
                className="w-4 h-4 rounded text-cyan-500 bg-slate-900 border-slate-700 focus:ring-0"
              />
              <div className="flex-1">
                <div className="font-bold text-cyan-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Bot className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Autonomous Smart Rerouting</span>
                  </span>
                  <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-700">
                    AI COMMANDER
                  </span>
                </div>
                <div className="text-[10px] text-slate-400">
                  Auto-balances Gate 1 & 2 queues when density exceeds 4.0 p/m²
                </div>
              </div>
            </label>

            {/* Dynamic Security Staffing Panel */}
            <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Dynamic Security Staffing</span>
                </span>
                <span className="text-[9px] font-mono text-cyan-400 bg-cyan-950 px-1.5 py-0.2 rounded border border-cyan-800">
                  REAL-TIME
                </span>
              </div>

              {/* Gate 1 Security Booths */}
              <div className="space-y-1">
                <div className="flex items-center justify-between p-1.5 rounded bg-slate-900 border border-amber-500/40 text-xs font-mono">
                  <div className="flex flex-col">
                    <span className="font-bold text-amber-300">Gate 1 Security Booths</span>
                    <span className="text-[9px] text-slate-400">
                      {Math.round((60 / securityCheckSpeed) * counterCountGate1)} p/min capacity
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => removeCounter('gate-1')}
                      disabled={counterCountGate1 <= 2}
                      className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-amber-300 border border-slate-700 active:scale-95 transition"
                      title="Remove Booth"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-5 text-center font-bold text-slate-100 text-sm">
                      {counterCountGate1}
                    </span>
                    <button
                      onClick={() => addCounter('gate-1')}
                      disabled={counterCountGate1 >= 10}
                      className="p-1 rounded bg-amber-600 hover:bg-amber-500 disabled:opacity-30 text-slate-950 font-bold active:scale-95 transition"
                      title="Add Booth (+60 p/min)"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                {/* Real-time slider for Gate 1 counters */}
                <input
                  type="range"
                  min="2"
                  max="10"
                  step="1"
                  value={counterCountGate1}
                  onChange={(e) => {
                    const diff = Number(e.target.value) - counterCountGate1;
                    if (diff > 0) {
                      for (let i = 0; i < diff; i++) addCounter('gate-1');
                    } else if (diff < 0) {
                      for (let i = 0; i < Math.abs(diff); i++) removeCounter('gate-1');
                    }
                  }}
                  className="w-full h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-amber-500"
                />
              </div>

              {/* Latency Specifications */}
              <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
                <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
                  <span className="text-slate-400 block text-[8px] uppercase">Fast Scan Latency</span>
                  <span className="text-cyan-300 font-bold">{scannerSpeed.toFixed(1)}s (NFC Auto-Tap)</span>
                </div>
                <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
                  <span className="text-slate-400 block text-[8px] uppercase">Counter Frisking</span>
                  <span className="text-amber-300 font-bold">{securityCheckSpeed.toFixed(1)}s / person</span>
                </div>
              </div>

              {/* Toggle: Enforce S-Curve Snake Queue */}
              <label className="flex items-center gap-2 p-1.5 rounded bg-slate-900 border border-slate-800 cursor-pointer hover:border-slate-700 text-xs">
                <input
                  type="checkbox"
                  checked={sQueueEnabled}
                  onChange={(e) => setSQueueEnabled(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-cyan-500 bg-slate-950 border-slate-700 focus:ring-0"
                />
                <div className="flex-1 text-[11px]">
                  <span className="font-semibold text-slate-200">Enforce S-Curve Snake Queue</span>
                  <span className="text-[9px] text-slate-400 block">3-tier switchback single/double file flow</span>
                </div>
              </label>

              {/* Gate 2 Counter Stepper */}
              <div className="flex items-center justify-between p-1.5 rounded bg-slate-900 border border-cyan-500/40 text-xs font-mono">
                <div className="flex flex-col">
                  <span className="font-bold text-cyan-300">Gate 2 Security Booths</span>
                  <span className="text-[9px] text-slate-400">
                    {auxGateActive || overflowRerouteActive ? `${Math.round((60 / securityCheckSpeed) * counterCountGate2)} p/min capacity` : 'Standby / Inactive'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => removeCounter('gate-2')}
                    disabled={counterCountGate2 <= 1}
                    className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-cyan-300 border border-slate-700"
                    title="Remove Booth"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-5 text-center font-bold text-slate-100 text-sm">
                    {counterCountGate2}
                  </span>
                  <button
                    onClick={() => addCounter('gate-2')}
                    disabled={counterCountGate2 >= 8}
                    className="p-1 rounded bg-cyan-600 hover:bg-cyan-500 disabled:opacity-30 text-slate-950 font-bold"
                    title="Add Booth (+60 p/min)"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>

            {/* Simulate Metro Pulse (+400 Fans) Button */}
            <button
              onClick={triggerMetroPulse}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-gradient-to-r from-rose-600 via-amber-600 to-orange-600 hover:from-rose-500 hover:to-orange-500 text-slate-950 font-extrabold text-xs shadow-md shadow-rose-950/60 transition active:scale-[0.98]"
            >
              <Train className="w-4 h-4 text-slate-950" />
              <span>Simulate Metro Pulse (+400)</span>
            </button>

            {/* Standard Surge Wave (+45) */}
            <button
              onClick={() => triggerSurgeWave(45)}
              className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition"
            >
              <Waves className="w-3.5 h-3.5 text-cyan-400" />
              <span>Inject Ingress Wave (+45)</span>
            </button>

            {/* Gate 4-6 Overflow Reroute */}
            <label className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 text-xs">
              <input
                type="checkbox"
                checked={overflowRerouteActive}
                onChange={toggleOverflowReroute}
                className="w-4 h-4 rounded text-teal-500 bg-slate-900 border-slate-700 focus:ring-0"
              />
              <div className="flex-1">
                <div className="font-semibold text-teal-300">Gate 4–6 Overflow Reroute</div>
                <div className="text-[10px] text-slate-400">Opens auxiliary bypass, relieves Gates 1–3</div>
              </div>
            </label>

            {/* Turnstile Scanner Failure (Gate 1-2) */}
            <label className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 text-xs">
              <input
                type="checkbox"
                checked={scannerFailureActive}
                onChange={toggleScannerFailure}
                className="w-4 h-4 rounded text-rose-500 bg-slate-900 border-slate-700 focus:ring-0"
              />
              <div className="flex-1">
                <div className="font-semibold text-rose-300">Turnstile Scanner Failure (Gate 1–2)</div>
                <div className="text-[10px] text-slate-400">Simulates scanner outage (3.5x delay)</div>
              </div>
            </label>

            {/* 40m Upstream Zigzag Baffles */}
            <label className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 text-xs">
              <input
                type="checkbox"
                checked={bafflesActive}
                onChange={toggleBaffles}
                className="w-4 h-4 rounded text-orange-500 bg-slate-900 border-slate-700 focus:ring-0"
              />
              <div className="flex-1">
                <div className="font-semibold text-slate-200">40m Upstream Zigzag Baffles</div>
                <div className="text-[10px] text-slate-400">Enforces ordered switchback corridor</div>
              </div>
            </label>

            {/* Quick Full Mitigation Preset Button */}
            <button
              onClick={applyMitigationPreset}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-indigo-950/70 border border-indigo-700/80 hover:bg-indigo-900/80 text-indigo-300 font-bold text-xs transition"
            >
              <Zap className="w-3.5 h-3.5 text-indigo-400" />
              <span>
                {bafflesActive && (auxGateActive || overflowRerouteActive)
                  ? 'Disable All Mitigations'
                  : 'Deploy Full Venue Safety Plan'}
              </span>
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
              <div className="font-semibold text-slate-200">Central Lane Divider Barrier</div>
              <div className="text-[10px] text-slate-400">Enforces two distinct laminar streams</div>
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

export { GateControls } from './GateControls';
export default LeftControls;
