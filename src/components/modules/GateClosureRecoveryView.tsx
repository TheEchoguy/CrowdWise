import React, { useState } from 'react';
import {
  DoorClosed,
  DoorOpen,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Activity,
  Layers,
  Users,
  Shuffle,
  RefreshCw,
  Play,
  Pause,
  Sliders,
  FileText,
  AlertCircle,
  TrendingDown,
  TrendingUp,
  ArrowRight,
  Flame,
  Radio,
  FileSpreadsheet,
} from 'lucide-react';
import { useSimulationStore } from '../../store/simulationStore';
import {
  GateClosureReason,
  GateClosureScenarioType,
  GateClosureState,
  AlternativeGateEvaluation,
  Gate,
} from '../../types';

export const GateClosureRecoveryView: React.FC = () => {
  const {
    currentVenue,
    engine,
    isRunning,
    isPaused,
    startSimulation,
    pauseSimulation,
    resumeSimulation,
    simTimeSecs,
    gateSideEvents,
    syncFromEngine,
  } = useSimulationStore();

  const [selectedGateId, setSelectedGateId] = useState<string>('gate-e2');
  const [closureReason, setClosureReason] = useState<GateClosureReason>('SECURITY');
  const [selectedScenario, setSelectedScenario] = useState<GateClosureScenarioType>('FULL_CLOSURE_SECURITY');
  const [releaseRate, setReleaseRate] = useState<number>(60);
  const [reroutedSummary, setReroutedSummary] = useState<string | null>(null);

  const gate: Gate | undefined = currentVenue.gates.find((g) => g.id === selectedGateId) || currentVenue.gates[0];
  const incident = gate ? engine.getGateClosureIncident(gate.id) : undefined;
  const alternatives = gate ? engine.evaluateAlternativeGates(gate.id) : [];

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleTriggerClosure = () => {
    if (!gate) return;
    if (!isRunning) startSimulation();
    engine.initiateGateClosure(gate.id, closureReason, selectedScenario);
    syncFromEngine();
  };

  const handleExecuteReroute = () => {
    if (!gate) return;
    const count = engine.executeAuthorizedReroute(gate.id);
    const bestAlt = alternatives.find((a) => a.isAuthorized && a.recommendationScore > 40);
    setReroutedSummary(`Successfully guided ${count} spectators to ${bestAlt ? bestAlt.gateName : 'alternative gates'}.`);
    syncFromEngine();
  };

  const handleUpdateChecklist = (check: Record<string, boolean>) => {
    if (!gate) return;
    engine.updateGateRecoveryChecklist(gate.id, check);
    syncFromEngine();
  };

  const handleReopen = () => {
    if (!gate) return;
    const success = engine.reopenGateAfterRecovery(gate.id);
    if (success) {
      setReroutedSummary(null);
    }
    syncFromEngine();
  };

  const handleRunDemoScenario = () => {
    if (!gate) return;
    engine.resetGateSimulation(gate.id);
    engine.setGateArrivalRate(gate.id, 240);
    engine.seedInitialApproachCrowd(gate.id, 60);
    if (!isRunning) startSimulation();

    // Trigger closure mid-demonstration
    setTimeout(() => {
      setClosureReason('OBSTRUCTION');
      setSelectedScenario('FULL_CLOSURE_OBSTRUCTION');
      engine.initiateGateClosure(gate.id, 'OBSTRUCTION', 'FULL_CLOSURE_OBSTRUCTION');
      syncFromEngine();
    }, 1200);
  };

  const accounting = gate ? engine.getGateAccountingAudit(gate.id) : null;
  const isReadyForRecovery = gate ? engine.checkGateRecoveryReady(gate.id) : false;
  const gateState: GateClosureState = incident?.state || (gate?.status === 'TEMPORARILY_CLOSED' ? 'CLOSED' : 'OPERATIONAL');

  // Authoritative events
  const relevantEvents = gateSideEvents
    .filter((e) => !gate || e.message.toLowerCase().includes(gate.id.toLowerCase()) || e.message.toLowerCase().includes(gate.name.toLowerCase()))
    .slice(0, 15);

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1600px] mx-auto select-none">
      {/* 1. Header & Live Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-navy-700 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-slate-100 flex items-center gap-2">
              <DoorClosed className="w-5 h-5 text-rose-400" />
              Module 1: Gate Closure &amp; Recovery Management
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-950 border border-rose-500/50 text-rose-300">
              HURDLE #1
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Simulate unexpected mid-event gate closures, regulate arrivals, evaluate authorized alternative routing, enforce hazard boundaries, and verify cause-based recovery.
          </p>
        </div>

        {/* Demo Preset & Playback */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleRunDemoScenario}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-rose-900 to-red-800 hover:from-rose-800 hover:to-red-700 border border-rose-500 text-white text-xs font-bold transition shadow-md shadow-rose-950/40"
            title="Repeatable demonstration: Busy gate closes mid-event under heavy inflow, controls crowd, and recovers safely."
          >
            <Flame className="w-3.5 h-3.5 text-rose-300" />
            <span>⚡ Run Mid-Event Closure Demo</span>
          </button>

          <div className="flex items-center gap-1 bg-navy-850 px-2 py-1 rounded-xl border border-navy-700 text-xs">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-mono text-cyan-200 font-semibold">{formatTime(simTimeSecs)}</span>
            {isRunning && !isPaused ? (
              <button onClick={pauseSimulation} className="p-1 rounded text-amber-300 hover:bg-navy-700" title="Pause">
                <Pause className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button onClick={isRunning ? resumeSimulation : startSimulation} className="p-1 rounded text-emerald-400 hover:bg-navy-700" title="Play">
                <Play className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Top Interactive Gate & Scenario Control Bar */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Gate Selection */}
        <div className="md:col-span-3 bg-navy-850 border border-navy-700 rounded-xl p-3.5 space-y-2">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wide flex items-center justify-between">
            <span>Target Entry Gate</span>
            <span className="text-cyan-400 font-mono text-[10px]">{gate?.stadiumSide} Stand</span>
          </label>
          <select
            value={selectedGateId}
            onChange={(e) => setSelectedGateId(e.target.value)}
            className="w-full bg-navy-950 border border-navy-600 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-200 focus:outline-none focus:border-cyan-500"
          >
            {currentVenue.gates
              .filter((g) => g.gateType === 'REGULAR')
              .map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.id.toUpperCase()})
                </option>
              ))}
          </select>
          <div className="flex items-center justify-between text-[11px] pt-1 border-t border-navy-800 text-slate-400">
            <span>Operational State:</span>
            <strong className={
              gateState === 'CLOSED'
                ? 'text-rose-400'
                : gateState === 'DEGRADED' || gateState === 'CLOSURE_INITIATED'
                ? 'text-amber-300'
                : 'text-emerald-400'
            }>
              {gateState}
            </strong>
          </div>
        </div>

        {/* Closure Reason & Scenarios */}
        <div className="md:col-span-6 bg-navy-850 border border-navy-700 rounded-xl p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">
              Incident Cause &amp; Closure Scenario
            </label>
            <span className="text-[10px] text-slate-400 font-mono">Live In-Flight Trigger</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <select
              value={closureReason}
              onChange={(e) => setClosureReason(e.target.value as GateClosureReason)}
              className="bg-navy-950 border border-navy-600 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="SECURITY">Security Concern (Perimeter Alert)</option>
              <option value="OBSTRUCTION">Physical Obstruction in Corridor</option>
              <option value="STRUCTURAL">Structural / Environmental Hazard</option>
              <option value="CONGESTION">Dangerous Crowd Overfill (Spillback)</option>
              <option value="SCANNER_FAILURE">Scanner Scanner Failure</option>
            </select>

            <select
              value={selectedScenario}
              onChange={(e) => setSelectedScenario(e.target.value as GateClosureScenarioType)}
              className="bg-navy-950 border border-navy-600 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="FULL_CLOSURE_SECURITY">Full Closure (Security Protocol)</option>
              <option value="FULL_CLOSURE_OBSTRUCTION">Full Closure (Obstruction Clearing)</option>
              <option value="FULL_CLOSURE_STRUCTURAL">Full Closure (Hazard Isolation)</option>
              <option value="FULL_CLOSURE_CONGESTION">Full Closure (Congestion Metering)</option>
              <option value="FAIL_1_COUNTER">Degraded: Counter 1 Failure</option>
              <option value="FAIL_2_COUNTERS">Degraded: Counters 1 &amp; 2 Offline</option>
              <option value="FAIL_3_COUNTERS">Full Scanner Outage (3 Counters)</option>
            </select>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] text-slate-400">
              Triggers realistic incident response while simulation runs without resetting attendee mass.
            </span>
            <button
              onClick={handleTriggerClosure}
              className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-sm"
            >
              Apply Closure
            </button>
          </div>
        </div>

        {/* Inflow & Arrival Release Control */}
        <div className="md:col-span-3 bg-navy-850 border border-navy-700 rounded-xl p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">
              Arrival Inflow Regulation
            </label>
            <span className="text-cyan-300 font-mono font-bold text-xs">{releaseRate} p/min</span>
          </div>

          <input
            type="range"
            min="0"
            max="300"
            step="15"
            value={releaseRate}
            onChange={(e) => {
              const r = Number(e.target.value);
              setReleaseRate(r);
              if (gate) engine.setGateArrivalRate(gate.id, r);
            }}
            className="w-full accent-cyan-500"
          />

          <div className="flex items-center justify-between pt-1">
            {gate?.isArrivalsPaused ? (
              <button
                onClick={() => {
                  if (gate) engine.resumeArrivals(gate.id);
                  syncFromEngine();
                }}
                className="w-full py-1 rounded bg-emerald-950 border border-emerald-600 text-emerald-300 text-xs font-bold hover:bg-emerald-900 transition"
              >
                Resume Arrivals
              </button>
            ) : (
              <button
                onClick={() => {
                  if (gate) engine.pauseArrivals(gate.id);
                  syncFromEngine();
                }}
                className="w-full py-1 rounded bg-amber-950 border border-amber-600 text-amber-300 text-xs font-bold hover:bg-amber-900 transition"
              >
                Pause Arrivals
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. Real-Time Crowd State & Mass Breakdown Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-xs">
        <div className="bg-navy-850 p-3 rounded-xl border border-navy-700">
          <span className="text-slate-400 block text-[10px] uppercase font-bold">1. Approaching</span>
          <span className="text-lg font-mono font-bold text-slate-100">{accounting?.approaching || 0}</span>
          <span className="text-[10px] text-slate-400 block">En route corridor</span>
        </div>
        <div className="bg-navy-850 p-3 rounded-xl border border-navy-700">
          <span className="text-slate-400 block text-[10px] uppercase font-bold">2. In Holding Area</span>
          <span className="text-lg font-mono font-bold text-amber-300">{gate?.inHoldingCount || 0}</span>
          <span className="text-[10px] text-slate-400 block">Held safely upstream</span>
        </div>
        <div className="bg-navy-850 p-3 rounded-xl border border-navy-700">
          <span className="text-slate-400 block text-[10px] uppercase font-bold">3. In Queues (1-3)</span>
          <span className="text-lg font-mono font-bold text-cyan-300">
            {(gate?.counter1QueueCount || 0) + (gate?.counter2QueueCount || 0) + (gate?.counter3QueueCount || 0)}
          </span>
          <span className="text-[10px] text-slate-400 block">Lanes 1/2/3</span>
        </div>
        <div className="bg-navy-850 p-3 rounded-xl border border-navy-700">
          <span className="text-slate-400 block text-[10px] uppercase font-bold">4. Scanning Now</span>
          <span className="text-lg font-mono font-bold text-cyan-400">{gate?.processingCount || 0}</span>
          <span className="text-[10px] text-slate-400 block">At active turnstiles</span>
        </div>
        <div className="bg-navy-850 p-3 rounded-xl border border-navy-700">
          <span className="text-slate-400 block text-[10px] uppercase font-bold">5. Overflow Door</span>
          <span className="text-lg font-mono font-bold text-emerald-300">{gate?.overflowDoor?.queueCount || 0}</span>
          <span className="text-[10px] text-slate-400 block">
            {incident?.overflowDoorAllowed ? 'Allowed' : 'DISABLED (HAZARD)'}
          </span>
        </div>
        <div className="bg-navy-850 p-3 rounded-xl border border-navy-700">
          <span className="text-slate-400 block text-[10px] uppercase font-bold">6. Admitted</span>
          <span className="text-lg font-mono font-bold text-emerald-400">{gate?.admittedCount || 0}</span>
          <span className="text-[10px] text-emerald-400/80 block">✓ Mass Conserved</span>
        </div>
      </div>

      {/* 4. Main Two-Column Analysis: Left (Alternative Routing & Overflow), Right (Recovery & Events) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 Cols): Alternative Gate Routing & Hazard Boundary Integration */}
        <div className="lg:col-span-7 space-y-5">
          {/* Authorized Alternative Routing Table */}
          <div className="bg-navy-850 border border-navy-700 rounded-2xl p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Shuffle className="w-4 h-4 text-cyan-400" />
                  Authorized Alternative Gate Routing Evaluation
                </h3>
                <p className="text-[11px] text-slate-400">
                  Evaluates candidate alternative regular gates based on ticket compatibility, route accessibility, queue length, and capacity.
                </p>
              </div>
              <button
                onClick={handleExecuteReroute}
                disabled={gateState !== 'CLOSED' && gateState !== 'DEGRADED'}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                  gateState === 'CLOSED' || gateState === 'DEGRADED'
                    ? 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-md'
                    : 'bg-navy-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                <span>Execute Safe Rerouting</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {reroutedSummary && (
              <div className="p-2.5 rounded-lg bg-cyan-950/80 border border-cyan-500/50 text-xs text-cyan-200 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>{reroutedSummary}</span>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-navy-700 text-[10px] text-slate-400 uppercase font-mono">
                    <th className="py-2">Alternative Gate</th>
                    <th className="py-2">Auth / Access</th>
                    <th className="py-2">Distance</th>
                    <th className="py-2">Queue</th>
                    <th className="py-2">Capacity</th>
                    <th className="py-2">Est. Wait</th>
                    <th className="py-2 text-right">Rec. Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-800/80 font-mono">
                  {alternatives.slice(0, 5).map((alt) => (
                    <tr key={alt.gateId} className={alt.isAuthorized ? 'hover:bg-navy-800/50' : 'opacity-60 bg-red-950/20'}>
                      <td className="py-2 font-bold text-white font-sans">
                        {alt.gateName}
                        {alt.rejectionReason && (
                          <span className="block text-[10px] text-rose-400 font-normal">
                            ⚠ {alt.rejectionReason}
                          </span>
                        )}
                      </td>
                      <td className="py-2">
                        {alt.isAuthorized ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-300 font-bold">
                            AUTHORIZED
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-950 text-rose-300 font-bold">
                            PROHIBITED
                          </span>
                        )}
                      </td>
                      <td className="py-2 text-slate-300">{alt.walkingDistanceM}m</td>
                      <td className="py-2 text-slate-200">{alt.currentQueue}</td>
                      <td className="py-2 text-slate-300">{alt.operationalCapacity} p/m</td>
                      <td className="py-2 text-cyan-300">{alt.estimatedWaitSecs}s</td>
                      <td className="py-2 text-right">
                        <span className={`font-bold ${alt.recommendationScore >= 70 ? 'text-emerald-400' : alt.recommendationScore >= 40 ? 'text-amber-300' : 'text-slate-500'}`}>
                          {alt.recommendationScore}/100
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 4th Overflow Door Safety Policy Card */}
          <div className="bg-navy-850 border border-navy-700 rounded-2xl p-4 shadow-xl space-y-2">
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Overflow Door Safety &amp; Bypass Restrictions
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              {incident?.reason === 'SECURITY' || incident?.reason === 'STRUCTURAL' ? (
                <span className="text-rose-300 font-medium">
                  <strong>CRITICAL HAZARD RULE:</strong> When a complete closure is initiated due to a security alert or structural hazard, the 4th Overflow Door is forced CLOSED. The overflow door cannot bypass an active hazard boundary.
                </span>
              ) : incident?.reason === 'SCANNER_FAILURE' ? (
                <span className="text-emerald-300 font-medium">
                  <strong>SCANNER CONTINGENCY RULE:</strong> Scanners are offline, but entrance corridor remains physically safe. Overflow door operates independently in AUTO mode to relieve queue build-up without bypassing security.
                </span>
              ) : (
                <span className="text-slate-300 font-medium">
                  Overflow door is configured in AUTO mode under standard operational safety rules.
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Right Column (5 Cols): Recovery Verification & Authoritative Event Feed */}
        <div className="lg:col-span-5 space-y-5">
          {/* Recovery Condition Checklist */}
          <div className="bg-navy-850 border border-navy-700 rounded-2xl p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                Cause-Appropriate Recovery Checklist
              </h3>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                isReadyForRecovery ? 'bg-emerald-950 text-emerald-300 border border-emerald-500' : 'bg-navy-950 text-amber-300'
              }`}>
                {isReadyForRecovery ? 'RECOVERY READY' : 'CONDITIONS PENDING'}
              </span>
            </div>

            <p className="text-[11px] text-slate-400">
              The gate does not reopen automatically when a timer expires. Explicit cause-specific clearance is mandatory before reopening.
            </p>

            <div className="space-y-2 text-xs">
              <label className="flex items-center justify-between p-2 rounded-lg bg-navy-950 border border-navy-700/80 cursor-pointer">
                <span className="text-slate-200">1. Scanner Diagnostics Verified</span>
                <input
                  type="checkbox"
                  checked={incident?.recoveryChecklist.scannersVerified ?? true}
                  onChange={(e) => handleUpdateChecklist({ scannersVerified: e.target.checked })}
                  className="rounded accent-cyan-500"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded-lg bg-navy-950 border border-navy-700/80 cursor-pointer">
                <span className="text-slate-200">2. Physical Obstruction Cleared</span>
                <input
                  type="checkbox"
                  checked={incident?.recoveryChecklist.obstructionCleared ?? true}
                  onChange={(e) => handleUpdateChecklist({ obstructionCleared: e.target.checked })}
                  className="rounded accent-cyan-500"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded-lg bg-navy-950 border border-navy-700/80 cursor-pointer">
                <span className="text-slate-200">3. Security Clearance Authorized</span>
                <input
                  type="checkbox"
                  checked={incident?.recoveryChecklist.securityAuthorized ?? true}
                  onChange={(e) => handleUpdateChecklist({ securityAuthorized: e.target.checked })}
                  className="rounded accent-cyan-500"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded-lg bg-navy-950 border border-navy-700/80 cursor-pointer">
                <span className="text-slate-200">4. Structural Safety Approval</span>
                <input
                  type="checkbox"
                  checked={incident?.recoveryChecklist.structureApproved ?? true}
                  onChange={(e) => handleUpdateChecklist({ structureApproved: e.target.checked })}
                  className="rounded accent-cyan-500"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded-lg bg-navy-950 border border-navy-700/80 cursor-pointer">
                <span className="text-slate-200">5. Crowd Density Safe (&lt; 40/lane)</span>
                <input
                  type="checkbox"
                  checked={incident?.recoveryChecklist.congestionReduced ?? true}
                  onChange={(e) => handleUpdateChecklist({ congestionReduced: e.target.checked })}
                  className="rounded accent-cyan-500"
                />
              </label>
            </div>

            <button
              onClick={handleReopen}
              disabled={!isReadyForRecovery || gateState === 'OPERATIONAL'}
              className={`w-full py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md ${
                isReadyForRecovery && gateState !== 'OPERATIONAL'
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/40'
                  : 'bg-navy-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <DoorOpen className="w-4 h-4" />
              <span>Reopen Gate &amp; Resume Arrivals</span>
            </button>
          </div>

          {/* Authoritative Simulation Event Feed */}
          <div className="bg-navy-850 border border-navy-700 rounded-2xl p-4 shadow-xl space-y-2">
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-cyan-400" />
              Live Simulation Event Log
            </h4>
            <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
              {relevantEvents.length === 0 ? (
                <div className="p-3 text-center text-xs text-slate-500 bg-navy-950 rounded-lg">
                  No gate closure events recorded yet. Simulation operating normally.
                </div>
              ) : (
                relevantEvents.map((evt) => (
                  <div key={evt.id} className="p-2 rounded bg-navy-950 border border-navy-800 text-[11px] space-y-0.5">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span>{evt.timeFormatted}</span>
                      <span className={evt.type === 'GATE_CLOSED' ? 'text-rose-400 font-bold' : evt.type === 'GATE_OPENED' ? 'text-emerald-400 font-bold' : 'text-cyan-400'}>
                        {evt.type}
                      </span>
                    </div>
                    <p className="text-slate-200">{evt.message}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
