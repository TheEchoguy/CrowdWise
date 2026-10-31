import React, { useState } from 'react';
import {
  ArrowLeft,
  Play,
  Pause,
  RotateCcw,
  StepForward,
  ShieldCheck,
  AlertTriangle,
  Flame,
  CheckCircle2,
  Clock,
  Layers,
  Activity,
  Users,
  Box,
  Eye,
  Camera,
  RefreshCw,
  Shuffle,
  ChevronRight,
  TrendingUp,
  Sliders,
  AlertCircle,
  DoorOpen,
  DoorClosed,
  Zap,
  SlidersHorizontal,
  FileText,
  UserCheck,
} from 'lucide-react';
import { useSimulationStore } from '../../store/simulationStore';
import { Gate3DCanvas, CameraPresetType } from './Gate3DCanvas';
import { Gate, ScannerCounter, DemonstrationProfileType, OverflowDoorConfig } from '../../types';

export const GateDetailView: React.FC = () => {
  const {
    currentVenue,
    selectedGateId,
    setSelectedGateId,
    setActiveTab,
    isRunning,
    isPaused,
    startSimulation,
    pauseSimulation,
    resumeSimulation,
    resetSimulation,
    speedMultiplier,
    setSpeedMultiplier,
    simTimeSecs,
    engine,
    updateGate,
    toggleCounter,
    setGateArrivalRate,
    recoverCounter,
    restoreAllCounters,
    setGateLaneBalancingEnabled,
    gateSideEvents,
    setDemonstrationProfile,
    startArrivals,
    pauseArrivals,
    resumeArrivals,
    stopArrivals,
    addArrivalSurge,
    resetGateSimulation,
    setGateOverflowConfig,
    setOverflowDoorOverride,
  } = useSimulationStore();

  const [cameraPreset, setCameraPreset] = useState<CameraPresetType>('isometric');
  const [panelTab, setPanelTab] = useState<'OVERFLOW' | 'THRESHOLDS' | 'FAILURES' | 'LOGS'>('OVERFLOW');

  // Fallback to gate-e2 or gate-n2 if none selected
  const effectiveGateId =
    selectedGateId ||
    currentVenue.gates.find((g) => g.id === 'gate-e2' || g.id === 'gate-n2')?.id ||
    currentVenue.gates[0]?.id ||
    'gate-e2';

  const gate: Gate | undefined = currentVenue.gates.find((g) => g.id === effectiveGateId);

  // Group all 12 gates for quick switcher
  const regularGates = currentVenue.gates.filter((g) => g.gateType === 'REGULAR');
  const specialGates = currentVenue.gates.filter((g) => g.gateType !== 'REGULAR');

  if (!gate) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-navy-900 text-slate-300">
        <div className="text-center space-y-4">
          <p className="text-lg font-bold">Gate not found</p>
          <button
            onClick={() => setActiveTab('digital-twin')}
            className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold"
          >
            ← Back to Digital Twin
          </button>
        </div>
      </div>
    );
  }

  // Format Sim Time mm:ss
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Get authoritative detailed metrics from simulation engine
  const detailed = engine.getGateDetailedMetrics(gate.id);
  const laneMetrics = detailed?.laneMetrics || gate.laneMetrics || [];
  const accounting = detailed?.accounting;
  const overflow = gate.overflowDoor;

  // Gate summary metrics
  const assignedCount = gate.assignedSpectatorCount || 4000;
  const arrivedCount = gate.totalArrivalsCount || 0;
  const admittedCount = gate.admittedCount || gate.totalProcessedCount || 0;
  const queueCount = gate.currentQueue || 0;
  const processingCount = gate.processingCount || 0;
  const holdingCount = gate.inHoldingCount || 0;
  const arrivalRate = gate.arrivalRatePerMin || 120;
  const regularCapacity = (gate.operationalScanners || 0) * 60;
  const overflowCapacity = overflow?.status === 'OPEN' ? Math.round((overflow.serviceRatePerSec || 1.0) * 60) : 0;
  const totalCombinedCapacity = regularCapacity + overflowCapacity;

  // Real-time queue counts for the 3 regular lanes
  const q0 = gate.counter1QueueCount ?? (gate.counters?.[0]?.queueCount || 0);
  const q1 = gate.counter2QueueCount ?? (gate.counters?.[1]?.queueCount || 0);
  const q2 = gate.counter3QueueCount ?? (gate.counters?.[2]?.queueCount || 0);

  // 17 Detailed Metrics for Diagnostics
  const configuredInflowRate = arrivalRate;
  const actualRollingInflowRate = gate.currentArrivalRatePerMin ?? arrivalRate;
  const remainingQuota = accounting ? accounting.remaining : Math.max(0, assignedCount - arrivedCount);
  const approachingCount = accounting ? accounting.approaching : (gate.approachingCount || 0);
  const regularAdmittedCount = (gate.counters || []).reduce((sum, c) => sum + (c.totalProcessedCount || 0), 0);
  const overflowAdmittedCount = overflow?.totalProcessedCount || 0;
  const overflowQueueCount = overflow?.queueCount || 0;
  const overflowServiceRateMin = Math.round((overflow?.serviceRatePerSec || 1.0) * 60);
  const sustainedTimer = overflow?.sustainedExtremeTimer || 0;
  const minSustained = overflow?.minSustainedExtremeSecs || 5.0;
  const extremeThresh = overflow?.extremeCongestionThreshold || 80;

  const l1Satisfied = q0 >= extremeThresh;
  const l2Satisfied = q1 >= extremeThresh;
  const l3Satisfied = q2 >= extremeThresh;
  const all3Satisfied = l1Satisfied && l2Satisfied && l3Satisfied;

  // Plain language explanation for overflow door activation status
  const getDoorStatusExplanation = () => {
    if (overflow?.manualOverride === 'FORCE_OPEN') {
      return 'OPEN — Forced open via manual command override';
    }
    if (overflow?.manualOverride === 'FORCE_CLOSED') {
      return 'CLOSED — Forced closed via manual command override';
    }
    if (overflow?.status === 'OPEN') {
      return 'OPEN — All 3 regular lanes exceeded threshold for sustained duration; overflow route actively discharging crowd';
    }
    if (overflow?.status === 'OPENING') {
      return `OPENING — Threshold satisfied; barrier retracting (${Math.round((overflow.doorProgress || 0) * 100)}%)`;
    }
    if (overflow?.status === 'CLOSING') {
      return `CLOSING — Regular queues recovered below threshold (${overflow.recoveryThreshold}); barrier resetting`;
    }
    if (all3Satisfied) {
      return `CLOSED — All 3 lanes at/above ${extremeThresh}; persistence timer running (${sustainedTimer.toFixed(1)} / ${minSustained.toFixed(1)}s)`;
    }
    const pending: string[] = [];
    if (!l1Satisfied) pending.push(`Lane 1 (${q0}/${extremeThresh})`);
    if (!l2Satisfied) pending.push(`Lane 2 (${q1}/${extremeThresh})`);
    if (!l3Satisfied) pending.push(`Lane 3 (${q2}/${extremeThresh})`);
    return `CLOSED — Waiting for ${pending.join(', ')} to reach threshold`;
  };

  const getLiveStatusBadge = () => {
    if (remainingQuota <= 0 && arrivedCount > 0) {
      return {
        label: 'DEMAND LIMIT REACHED',
        className: 'bg-purple-950/90 border-purple-500 text-purple-300 shadow-purple-950/50',
        dotClass: 'bg-purple-400',
      };
    }
    if (overflow?.status === 'OPEN') {
      return {
        label: 'OVERFLOW DOOR OPEN',
        className: 'bg-emerald-950/90 border-emerald-500 text-emerald-300 shadow-emerald-950/50 animate-pulse',
        dotClass: 'bg-emerald-400 animate-ping',
      };
    }
    if (all3Satisfied) {
      return {
        label: 'EXTREME CONGESTION DETECTED',
        className: 'bg-rose-950/90 border-rose-500 text-rose-200 shadow-rose-950/50 animate-pulse',
        dotClass: 'bg-rose-500 animate-ping',
      };
    }
    if (arrivalRate >= 600 || gate.demonstrationProfile === 'SURGE') {
      return {
        label: 'EXTREME SURGE ACTIVE',
        className: 'bg-red-950/90 border-red-500 text-red-300 shadow-red-950/50',
        dotClass: 'bg-red-400',
      };
    }
    if (arrivalRate >= 240 || gate.demonstrationProfile === 'HEAVY') {
      return {
        label: 'HEAVY ARRIVAL',
        className: 'bg-amber-950/90 border-amber-500 text-amber-300 shadow-amber-950/50',
        dotClass: 'bg-amber-400',
      };
    }
    return {
      label: 'NORMAL ARRIVAL',
      className: 'bg-cyan-950/90 border-cyan-500 text-cyan-300 shadow-cyan-950/50',
      dotClass: 'bg-cyan-400',
    };
  };

  const liveBadge = getLiveStatusBadge();

  // Inflow rate adjustment
  const handleInflowAdjust = (delta: number) => {
    const newRate = Math.max(0, Math.min(900, arrivalRate + delta));
    setGateArrivalRate(gate.id, newRate);
  };

  // Inline Counter Failure / Recovery
  const handleFailCounter = (cIdx: number) => {
    const counter = gate.counters?.[cIdx];
    if (counter) {
      toggleCounter(gate.id, counter.id);
    }
  };

  const handleRecoverCounter = (cIdx: number) => {
    recoverCounter(gate.id, cIdx);
  };

  const handleFailAll = () => {
    if (!gate.counters) return;
    gate.counters.forEach((c) => {
      if (c.status === 'OPERATIONAL') {
        toggleCounter(gate.id, c.id);
      }
    });
  };

  const handleRestoreAll = () => {
    restoreAllCounters(gate.id);
  };

  // Relevant gate events
  const gateEvents = gateSideEvents
    .filter(
      (e) =>
        e.message.toLowerCase().includes(gate.id.toLowerCase()) ||
        e.message.toLowerCase().includes(gate.name.toLowerCase()) ||
        (e as any).gateId === gate.id
    )
    .slice(-20)
    .reverse();

  return (
    <div className="flex flex-col h-full w-full bg-navy-950 text-slate-100 overflow-hidden select-none">
      {/* 1. TOP HEADER & NAVIGATION BAR */}
      <header className="h-16 px-4 py-2 border-b border-navy-700 bg-navy-900/90 backdrop-blur flex items-center justify-between shrink-0 z-20 gap-3">
        {/* Left: Back button, Gate Title & Badges */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => setActiveTab('digital-twin')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-navy-800 hover:bg-navy-700 border border-navy-600 text-cyan-300 hover:text-cyan-200 text-xs font-semibold transition shrink-0 shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>← Back to Stadium</span>
          </button>

          <div className="h-6 w-px bg-navy-700 shrink-0" />

          <div className="flex items-center gap-2 truncate">
            <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-cyan-950 border border-cyan-500/50 text-cyan-300">
              {gate.id.toUpperCase()}
            </span>
            <div className="truncate">
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-white tracking-wide truncate">
                  {gate.name} — 3D Architecture & Congestion-Responsive Overflow System
                </h1>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-extrabold border shrink-0 transition-all ${liveBadge.className}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${liveBadge.dotClass}`} />
                  {liveBadge.label}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-slate-400">
                <span>Side: <strong className="text-slate-200">{gate.stadiumSide} STAND</strong></span>
                <span>•</span>
                <span>Type: <strong className="text-slate-200">{gate.gateType}</strong></span>
                <span>•</span>
                <span>4th Door: <strong className={overflow?.status === 'OPEN' ? 'text-emerald-400 font-bold' : overflow?.status === 'OPENING' || overflow?.status === 'CLOSING' ? 'text-amber-400' : 'text-slate-400'}>{overflow?.status || 'STANDBY'}</strong></span>
              </div>
            </div>
          </div>
        </div>

        {/* Center: Quick Gate Switcher Pills */}
        <div className="hidden lg:flex items-center gap-1 bg-navy-950/80 p-1 rounded-lg border border-navy-700 overflow-x-auto max-w-[420px]">
          {regularGates.map((g) => {
            const isSelected = g.id === gate.id;
            const shortName = g.id.replace('gate-', '').toUpperCase();
            return (
              <button
                key={g.id}
                onClick={() => setSelectedGateId(g.id)}
                className={`px-2 py-1 rounded text-xs font-mono font-bold transition shrink-0 ${
                  isSelected
                    ? 'bg-cyan-600 text-white shadow-md shadow-cyan-900/40 border border-cyan-400'
                    : 'bg-navy-900/90 text-slate-400 hover:text-slate-200 hover:bg-navy-800'
                }`}
                title={g.name}
              >
                {shortName}
              </button>
            );
          })}
          {specialGates.map((g) => {
            const isSelected = g.id === gate.id;
            const shortName = g.id.replace('gate-', '').toUpperCase();
            return (
              <button
                key={g.id}
                onClick={() => setSelectedGateId(g.id)}
                className={`px-2 py-1 rounded text-xs font-mono font-bold transition shrink-0 ${
                  isSelected
                    ? 'bg-purple-600 text-white border border-purple-400'
                    : 'bg-navy-900/90 text-purple-300 hover:text-purple-100 hover:bg-navy-800'
                }`}
                title={`${g.name} (${g.gateType})`}
              >
                {shortName}
              </button>
            );
          })}
        </div>

        {/* Right: Camera Presets & Simulation Controls */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Camera Preset Pills */}
          <div className="flex items-center gap-1 bg-navy-950/80 p-1 rounded-lg border border-navy-700 text-xs">
            <Camera className="w-3.5 h-3.5 text-cyan-400 ml-1" />
            {(['isometric', 'top-down', 'approach', 'concourse'] as CameraPresetType[]).map((preset) => (
              <button
                key={preset}
                onClick={() => setCameraPreset(preset)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium capitalize transition ${
                  cameraPreset === preset
                    ? 'bg-cyan-600 text-white font-bold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-navy-800'
                }`}
              >
                {preset === 'top-down' ? 'Top-Down' : preset}
              </button>
            ))}
          </div>

          {/* Simulation Clock & Playback */}
          <div className="flex items-center gap-1 bg-navy-950 px-2 py-1 rounded-lg border border-navy-700 text-xs">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-mono text-cyan-200 font-semibold">{formatTime(simTimeSecs)}</span>

            <div className="h-4 w-px bg-navy-700 mx-1" />

            {isRunning && !isPaused ? (
              <button
                onClick={pauseSimulation}
                className="p-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 transition"
                title="Pause"
              >
                <Pause className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={() => (isRunning ? resumeSimulation() : startSimulation())}
                className="p-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 transition"
                title="Play"
              >
                <Play className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              onClick={() => {
                if (!isRunning) startSimulation();
                engine.step(0.1);
                useSimulationStore.getState().syncFromEngine();
              }}
              className="p-1 rounded bg-navy-800 hover:bg-navy-700 text-slate-300 transition"
              title="Step Forward"
            >
              <StepForward className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={resetSimulation}
              className="p-1 rounded bg-navy-800 hover:bg-navy-700 text-slate-300 transition"
              title="Reset Simulation"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* 2. DEMONSTRATION PROFILES TOOLBAR */}
      <div className="h-11 px-4 border-b border-navy-800 bg-navy-950/95 flex items-center justify-between shrink-0 text-xs gap-2 overflow-x-auto">
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            Profiles:
          </span>
          <button
            onClick={() => setDemonstrationProfile(gate.id, 'NORMAL')}
            className="px-2.5 py-1 rounded bg-navy-800 hover:bg-navy-700 border border-navy-600 text-slate-200 text-xs font-semibold transition shrink-0"
            title="Manageable arrival (120 p/m). Door remains closed."
          >
            P1: Normal (120 p/m)
          </button>
          <button
            onClick={() => setDemonstrationProfile(gate.id, 'HEAVY')}
            className="px-2.5 py-1 rounded bg-navy-800 hover:bg-navy-700 border border-navy-600 text-amber-300 text-xs font-semibold transition shrink-0"
            title="Heavy arrival (240 p/m). All 3 lanes gradually crowd."
          >
            P2: Heavy (240 p/m)
          </button>
          <button
            onClick={() => setDemonstrationProfile(gate.id, 'SURGE')}
            className="px-2.5 py-1 rounded bg-gradient-to-r from-red-900 to-rose-700 hover:from-red-800 hover:to-rose-600 border border-rose-500 text-white text-xs font-bold transition shadow-sm shrink-0 flex items-center gap-1"
            title="Extreme surge (720 p/m sustained + 120 staged cohort). All 3 lanes accumulate 80+ spectators and trigger automatic Overflow Door activation after 5.0s!"
          >
            <Flame className="w-3.5 h-3.5 text-rose-300" />
            <span>⚡ P3: Extreme Surge (Auto-Door)</span>
          </button>
          <button
            onClick={() => setDemonstrationProfile(gate.id, 'FAIL_1')}
            className="px-2.5 py-1 rounded bg-navy-800 hover:bg-navy-700 border border-navy-600 text-slate-200 text-xs font-semibold transition shrink-0"
            title="Counter 1 offline during heavy flow. Demonstrates lane balancing."
          >
            P4: Fail C1
          </button>
          <button
            onClick={() => setDemonstrationProfile(gate.id, 'FAIL_2')}
            className="px-2.5 py-1 rounded bg-navy-800 hover:bg-navy-700 border border-navy-600 text-amber-300 text-xs font-semibold transition shrink-0"
            title="Counters 1 & 2 offline. Heavy congestion triggers overflow door."
          >
            P5: Fail C1 & C2
          </button>
          <button
            onClick={() => setDemonstrationProfile(gate.id, 'FAIL_ALL')}
            className="px-2.5 py-1 rounded bg-rose-950/80 hover:bg-rose-900 border border-rose-700 text-rose-200 text-xs font-semibold transition shrink-0"
            title="All 3 counters offline. Regular admission halts; overflow route handles crowd."
          >
            P6: Full Outage
          </button>
        </div>

        {/* Inflow Action Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] text-slate-400 uppercase font-bold">Flow:</span>
          {gate.isArrivalsPaused ? (
            <button
              onClick={() => resumeArrivals(gate.id)}
              className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-600/60 text-emerald-300 text-[11px] font-semibold hover:bg-emerald-900 transition"
            >
              Resume Arrivals
            </button>
          ) : (
            <button
              onClick={() => pauseArrivals(gate.id)}
              className="px-2 py-0.5 rounded bg-amber-950 border border-amber-600/60 text-amber-300 text-[11px] font-semibold hover:bg-amber-900 transition"
            >
              Pause Arrivals
            </button>
          )}
          <button
            onClick={() => stopArrivals(gate.id)}
            className="px-2 py-0.5 rounded bg-navy-800 border border-navy-700 text-slate-300 text-[11px] font-semibold hover:bg-navy-700 transition"
          >
            Stop
          </button>
          <button
            onClick={() => addArrivalSurge(gate.id, 60)}
            className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-600/60 text-cyan-300 text-[11px] font-semibold hover:bg-cyan-900 transition"
          >
            +60 Surge
          </button>
          <button
            onClick={() => addArrivalSurge(gate.id, 150)}
            className="px-2 py-0.5 rounded bg-rose-950 border border-rose-600/60 text-rose-300 text-[11px] font-semibold hover:bg-rose-900 transition"
          >
            +150 Surge
          </button>
          <button
            onClick={() => resetGateSimulation(gate.id)}
            className="p-1 rounded bg-navy-800 hover:bg-navy-700 text-slate-300 transition"
            title="Reset this Gate's Simulation"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 3. MAIN WORKSPACE: 3D VIEWPORT + DOCKED TELEMETRY & CONTROLS */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* LEFT / CENTER: Full 3D Interactive Simulation Canvas */}
        <div className="flex-1 relative h-full">
          <Gate3DCanvas
            gateId={gate.id}
            cameraPreset={cameraPreset}
            onPresetChange={setCameraPreset}
          />

          {/* Floating Camera & Interaction Hint Pill (Bottom Left) */}
          <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2 bg-navy-900/85 backdrop-blur border border-navy-700/80 px-3 py-1.5 rounded-lg text-[11px] text-slate-300 shadow-xl pointer-events-none">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <strong>Orbit:</strong> Left-Click Drag
            </span>
            <span className="text-navy-600">•</span>
            <span><strong>Pan:</strong> Right-Click Drag</span>
            <span className="text-navy-600">•</span>
            <span><strong>Zoom:</strong> Scroll Wheel</span>
          </div>

          {/* Floating Inflow & Lane Balancing Bar (Top Left) */}
          <div className="absolute top-4 left-4 z-10 bg-navy-900/90 backdrop-blur border border-navy-700 rounded-xl p-3 shadow-2xl max-w-sm space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">Arrival Inflow Rate:</span>
              <span className="font-mono font-bold text-cyan-300 text-sm">
                {gate.isArrivalsPaused ? 'PAUSED' : `${arrivalRate} p/min`}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => handleInflowAdjust(-30)}
                className="px-2 py-1 rounded bg-navy-800 hover:bg-navy-700 border border-navy-600 text-xs font-semibold text-slate-200 transition"
              >
                -30
              </button>
              <button
                onClick={() => handleInflowAdjust(+30)}
                className="px-2 py-1 rounded bg-navy-800 hover:bg-navy-700 border border-navy-600 text-xs font-semibold text-slate-200 transition"
              >
                +30
              </button>
              <button
                onClick={() => setGateArrivalRate(gate.id, 120)}
                className={`px-2 py-1 rounded text-xs font-semibold border transition ${
                  arrivalRate === 120 ? 'bg-cyan-600 border-cyan-400 text-white' : 'bg-navy-800 border-navy-600 text-slate-300'
                }`}
              >
                120
              </button>
              <button
                onClick={() => setGateArrivalRate(gate.id, 240)}
                className={`px-2 py-1 rounded text-xs font-semibold border transition ${
                  arrivalRate === 240 ? 'bg-amber-600 border-amber-400 text-white' : 'bg-navy-800 border-navy-600 text-amber-300'
                }`}
              >
                240
              </button>
              <button
                onClick={() => setGateArrivalRate(gate.id, 450)}
                className={`px-2 py-1 rounded text-xs font-semibold border transition ${
                  arrivalRate === 450 ? 'bg-rose-600 border-rose-400 text-white' : 'bg-navy-800 border-navy-600 text-rose-300'
                }`}
              >
                450
              </button>
              <button
                onClick={() => setGateArrivalRate(gate.id, 720)}
                className={`px-2 py-1 rounded text-xs font-bold border transition ${
                  arrivalRate === 720 ? 'bg-red-600 border-red-400 text-white' : 'bg-navy-800 border-red-600/70 text-red-300'
                }`}
                title="720 p/min Sustained Inflow (Extreme Surge)"
              >
                720
              </button>
              <button
                onClick={() => setGateArrivalRate(gate.id, 900)}
                className={`px-2 py-1 rounded text-xs font-bold border transition ${
                  arrivalRate === 900 ? 'bg-purple-600 border-purple-400 text-white' : 'bg-navy-800 border-purple-600/70 text-purple-300'
                }`}
                title="900 p/min Maximum Capacity Test"
              >
                900
              </button>
            </div>

            {/* Lane Balancing Switch */}
            <div className="pt-1 border-t border-navy-800 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Shuffle className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-xs font-semibold text-slate-200">Intelligent 4-Route Steering</span>
              </div>
              <button
                onClick={() => setGateLaneBalancingEnabled(gate.id, !gate.laneBalancingEnabled)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  gate.laneBalancingEnabled !== false ? 'bg-cyan-600' : 'bg-navy-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    gate.laneBalancingEnabled !== false ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT DOCKED TELEMETRY & CONGESTION OVERFLOW PANEL */}
        <aside className="w-[430px] border-l border-navy-700 bg-navy-900/95 backdrop-blur flex flex-col shrink-0 overflow-hidden shadow-2xl z-10">
          {/* Panel Header & Navigation Tabs */}
          <div className="p-3 border-b border-navy-700 bg-navy-850 shrink-0 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-cyan-400" />
                Live Telemetry & Overflow Control
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 border border-emerald-600/50 text-emerald-400 font-semibold">
                MASS CONSERVED
              </span>
            </div>

            {/* Navigation sub-tabs */}
            <div className="flex rounded-lg bg-navy-950 p-1 border border-navy-700 text-xs">
              <button
                onClick={() => setPanelTab('OVERFLOW')}
                className={`flex-1 py-1 rounded font-semibold transition ${
                  panelTab === 'OVERFLOW' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                4-Lane & Overflow
              </button>
              <button
                onClick={() => setPanelTab('THRESHOLDS')}
                className={`flex-1 py-1 rounded font-semibold transition ${
                  panelTab === 'THRESHOLDS' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Threshold Tuning
              </button>
              <button
                onClick={() => setPanelTab('FAILURES')}
                className={`flex-1 py-1 rounded font-semibold transition ${
                  panelTab === 'FAILURES' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Stress Testing
              </button>
              <button
                onClick={() => setPanelTab('LOGS')}
                className={`flex-1 py-1 rounded font-semibold transition ${
                  panelTab === 'LOGS' ? 'bg-navy-800 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Live Event Log
              </button>
            </div>
          </div>

          {/* Scrollable Panel Content */}
          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {/* GATE AGGREGATE STATS CARDS */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-navy-950/80 p-2.5 rounded-lg border border-navy-700">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Total Arrived</span>
                <span className="text-base font-mono font-bold text-slate-100">{arrivedCount}</span>
                <span className="text-[10px] text-slate-400 block">Assigned Quota: {assignedCount}</span>
              </div>
              <div className="bg-navy-950/80 p-2.5 rounded-lg border border-navy-700">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Waiting Across Queues</span>
                <span className={`text-base font-mono font-bold ${queueCount > 80 ? 'text-rose-400' : queueCount > 40 ? 'text-amber-300' : 'text-cyan-300'}`}>
                  {queueCount}
                </span>
                <span className="text-[10px] text-slate-400 block">Holding Area: {holdingCount}</span>
              </div>
              <div className="bg-navy-950/80 p-2.5 rounded-lg border border-navy-700">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Scanning Now</span>
                <span className="text-base font-mono font-bold text-cyan-400">{processingCount}</span>
                <span className="text-[10px] text-slate-400 block">Combined Cap: {totalCombinedCapacity} p/m</span>
              </div>
              <div className="bg-navy-950/80 p-2.5 rounded-lg border border-navy-700">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Admitted to Stadium</span>
                <span className="text-base font-mono font-bold text-emerald-400">{admittedCount}</span>
                <span className="text-[10px] text-emerald-400/80 block">Remaining: {Math.max(0, assignedCount - arrivedCount)}</span>
              </div>
            </div>

            {/* TAB CONTENT: 4-LANE & OVERFLOW SYSTEM */}
            {panelTab === 'OVERFLOW' && (
              <div className="space-y-3.5">
                {/* 0. LIVE OVERFLOW ACTIVATION DIAGNOSTICS & VERIFICATION */}
                <div className="p-3 rounded-xl bg-navy-950 border border-navy-700 space-y-3 shadow-lg">
                  <div className="flex items-center justify-between pb-2 border-b border-navy-800">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-cyan-400" />
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                        Overflow Activation Diagnostics
                      </h4>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold border ${liveBadge.className}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${liveBadge.dotClass}`} />
                      {liveBadge.label}
                    </span>
                  </div>

                  {/* Real-Time Plain-Language Activation Criteria Check */}
                  <div className="p-2.5 rounded-lg bg-navy-900/90 border border-navy-800 space-y-1.5 text-xs font-mono">
                    <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wide mb-1 font-sans">
                      Threshold Verification Status:
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Lane 1:</span>
                      <span className="font-bold">
                        <span className={l1Satisfied ? 'text-emerald-400' : 'text-slate-300'}>{q0}</span>
                        <span className="text-slate-500"> / {extremeThresh} — </span>
                        <span className={l1Satisfied ? 'text-emerald-400 font-bold' : 'text-rose-400'}>
                          {l1Satisfied ? 'SATISFIED' : 'NOT SATISFIED'}
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Lane 2:</span>
                      <span className="font-bold">
                        <span className={l2Satisfied ? 'text-emerald-400' : 'text-slate-300'}>{q1}</span>
                        <span className="text-slate-500"> / {extremeThresh} — </span>
                        <span className={l2Satisfied ? 'text-emerald-400 font-bold' : 'text-rose-400'}>
                          {l2Satisfied ? 'SATISFIED' : 'NOT SATISFIED'}
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Lane 3:</span>
                      <span className="font-bold">
                        <span className={l3Satisfied ? 'text-emerald-400' : 'text-slate-300'}>{q2}</span>
                        <span className="text-slate-500"> / {extremeThresh} — </span>
                        <span className={l3Satisfied ? 'text-emerald-400 font-bold' : 'text-rose-400'}>
                          {l3Satisfied ? 'SATISFIED' : 'NOT SATISFIED'}
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-navy-800/80">
                      <span className="text-slate-300">Persistence:</span>
                      <span className="font-bold">
                        <span className={sustainedTimer >= minSustained ? 'text-emerald-400' : 'text-amber-400'}>
                          {sustainedTimer.toFixed(1)}
                        </span>
                        <span className="text-slate-500"> / {minSustained.toFixed(1)} seconds</span>
                      </span>
                    </div>
                    <div className="pt-1.5 border-t border-navy-800 text-[11px] font-sans">
                      <span className="text-slate-400 font-medium">Door State: </span>
                      <strong className={
                        overflow?.status === 'OPEN'
                          ? 'text-emerald-400'
                          : overflow?.status === 'OPENING' || overflow?.status === 'CLOSING'
                          ? 'text-amber-400'
                          : 'text-slate-300'
                      }>
                        {getDoorStatusExplanation()}
                      </strong>
                    </div>
                  </div>

                  {/* 17 Full Telemetry Metrics Grid */}
                  <div className="space-y-1">
                    <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wide font-sans">
                      Live Telemetry Stream (17 Authoritative Metrics):
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                      <div className="bg-navy-900/70 p-1.5 rounded border border-navy-800/80">
                        <span className="text-[10px] text-slate-400 block">1. Configured Rate</span>
                        <span className="font-mono font-bold text-cyan-300">{configuredInflowRate} p/min</span>
                      </div>
                      <div className="bg-navy-900/70 p-1.5 rounded border border-navy-800/80">
                        <span className="text-[10px] text-slate-400 block">2. Actual Rolling Rate</span>
                        <span className="font-mono font-bold text-cyan-300">{actualRollingInflowRate} p/min</span>
                      </div>
                      <div className="bg-navy-900/70 p-1.5 rounded border border-navy-800/80">
                        <span className="text-[10px] text-slate-400 block">3. Total Generated</span>
                        <span className="font-mono font-bold text-white">{arrivedCount}</span>
                      </div>
                      <div className="bg-navy-900/70 p-1.5 rounded border border-navy-800/80">
                        <span className="text-[10px] text-slate-400 block">4. Remaining Quota</span>
                        <span className="font-mono font-bold text-slate-300">{remainingQuota}</span>
                      </div>
                      <div className="bg-navy-900/70 p-1.5 rounded border border-navy-800/80">
                        <span className="text-[10px] text-slate-400 block">5. Approaching Gate</span>
                        <span className="font-mono font-bold text-amber-300">{approachingCount}</span>
                      </div>
                      <div className="bg-navy-900/70 p-1.5 rounded border border-navy-800/80">
                        <span className="text-[10px] text-slate-400 block">6. External Holding</span>
                        <span className="font-mono font-bold text-amber-300">{holdingCount}</span>
                      </div>
                      <div className="bg-navy-900/70 p-1.5 rounded border border-navy-800/80">
                        <span className="text-[10px] text-slate-400 block">7. Lane 1 Queue</span>
                        <span className={`font-mono font-bold ${l1Satisfied ? 'text-rose-400' : 'text-slate-200'}`}>{q0}</span>
                      </div>
                      <div className="bg-navy-900/70 p-1.5 rounded border border-navy-800/80">
                        <span className="text-[10px] text-slate-400 block">8. Lane 2 Queue</span>
                        <span className={`font-mono font-bold ${l2Satisfied ? 'text-rose-400' : 'text-slate-200'}`}>{q1}</span>
                      </div>
                      <div className="bg-navy-900/70 p-1.5 rounded border border-navy-800/80">
                        <span className="text-[10px] text-slate-400 block">9. Lane 3 Queue</span>
                        <span className={`font-mono font-bold ${l3Satisfied ? 'text-rose-400' : 'text-slate-200'}`}>{q2}</span>
                      </div>
                      <div className="bg-navy-900/70 p-1.5 rounded border border-navy-800/80">
                        <span className="text-[10px] text-slate-400 block">10. Scanning in Counters</span>
                        <span className="font-mono font-bold text-cyan-300">{processingCount}</span>
                      </div>
                      <div className="bg-navy-900/70 p-1.5 rounded border border-navy-800/80">
                        <span className="text-[10px] text-slate-400 block">11. Regular Admitted</span>
                        <span className="font-mono font-bold text-emerald-400">{regularAdmittedCount}</span>
                      </div>
                      <div className="bg-navy-900/70 p-1.5 rounded border border-navy-800/80">
                        <span className="text-[10px] text-slate-400 block">12. Overflow Queue</span>
                        <span className="font-mono font-bold text-emerald-300">{overflowQueueCount}</span>
                      </div>
                      <div className="bg-navy-900/70 p-1.5 rounded border border-navy-800/80">
                        <span className="text-[10px] text-slate-400 block">13. Overflow Admitted</span>
                        <span className="font-mono font-bold text-emerald-400">{overflowAdmittedCount}</span>
                      </div>
                      <div className="bg-navy-900/70 p-1.5 rounded border border-navy-800/80">
                        <span className="text-[10px] text-slate-400 block">14. Total Admitted</span>
                        <span className="font-mono font-bold text-emerald-400">{admittedCount}</span>
                      </div>
                      <div className="bg-navy-900/70 p-1.5 rounded border border-navy-800/80">
                        <span className="text-[10px] text-slate-400 block">15. Overflow Service Rate</span>
                        <span className="font-mono font-bold text-slate-200">{overflowServiceRateMin} p/m</span>
                      </div>
                      <div className="bg-navy-900/70 p-1.5 rounded border border-navy-800/80">
                        <span className="text-[10px] text-slate-400 block">16. Combined Capacity</span>
                        <span className="font-mono font-bold text-slate-200">{totalCombinedCapacity} p/m</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 1. OVERFLOW DOOR LIVE STATUS CARD */}
                {overflow && (
                  <div className={`p-3 rounded-xl border transition ${
                    overflow.status === 'OPEN'
                      ? 'bg-emerald-950/40 border-emerald-500/60 shadow-lg shadow-emerald-950/40'
                      : overflow.status === 'OPENING' || overflow.status === 'CLOSING'
                      ? 'bg-amber-950/40 border-amber-500/60 shadow-lg shadow-amber-950/40'
                      : 'bg-navy-950 border-navy-700'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {overflow.status === 'OPEN' ? (
                          <DoorOpen className="w-5 h-5 text-emerald-400 animate-pulse" />
                        ) : (
                          <DoorClosed className="w-5 h-5 text-rose-400" />
                        )}
                        <div>
                          <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                            4th Overflow Entry Door
                          </h4>
                          <span className="text-[10px] text-slate-400">Positioned beside Lane 3</span>
                        </div>
                      </div>

                      <span className={`px-2.5 py-0.5 rounded text-xs font-mono font-bold ${
                        overflow.status === 'OPEN'
                          ? 'bg-emerald-950 border border-emerald-500 text-emerald-300'
                          : overflow.status === 'OPENING' || overflow.status === 'CLOSING'
                          ? 'bg-amber-950 border border-amber-500 text-amber-300'
                          : 'bg-rose-950 border border-rose-600/50 text-rose-300'
                      }`}>
                        {overflow.status}
                      </span>
                    </div>

                    {/* Door Physical Opening Progress Bar */}
                    <div className="space-y-1 mb-2.5">
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>Physical Barrier Aperture</span>
                        <span className="font-mono text-slate-200">{Math.round((overflow.doorProgress || 0) * 100)}% OPEN</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-navy-800 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            overflow.status === 'OPEN' ? 'bg-emerald-400' : 'bg-cyan-500'
                          }`}
                          style={{ width: `${Math.round((overflow.doorProgress || 0) * 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Activation Reason */}
                    {overflow.activationReason && (
                      <div className="p-2 rounded bg-navy-900/80 border border-navy-700/80 text-[11px] mb-2.5 text-cyan-200 flex items-start gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                        <span><strong>Trigger Reason:</strong> {overflow.activationReason}</span>
                      </div>
                    )}

                    {/* Overflow Key Metrics Grid */}
                    <div className="grid grid-cols-3 gap-2 text-xs py-2 border-y border-navy-800/80">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Queue Length</span>
                        <span className="font-mono font-bold text-white">{overflow.queueCount}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Service Rate</span>
                        <span className="font-mono text-emerald-300">
                          {overflow.serviceRatePerSec || 1.0} p/s (60 p/m)
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Admitted</span>
                        <span className="font-mono font-bold text-emerald-400">{overflow.totalProcessedCount || 0}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Est. Wait</span>
                        <span className="font-mono font-bold text-cyan-300">
                          {overflow.status === 'OPEN' ? `${overflow.estimatedWaitSecs}s` : 'STANDBY'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Time Open</span>
                        <span className="font-mono text-slate-300">{Math.round(overflow.timeSpentOpenSecs || 0)}s</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Authorization</span>
                        <span className="font-mono text-emerald-300">AUTHORIZED</span>
                      </div>
                    </div>

                    {/* Live Condition Timers */}
                    <div className="pt-2 space-y-1.5 text-[11px]">
                      <div className="flex justify-between items-center text-slate-300">
                        <span>Extreme Queue Sustained (Lanes 1-3 &gt;= {overflow.extremeCongestionThreshold}):</span>
                        <span className="font-mono font-bold text-amber-300">
                          {(overflow.sustainedExtremeTimer || 0).toFixed(1)}s / {(overflow.minSustainedExtremeSecs || 5.0).toFixed(1)}s
                        </span>
                      </div>
                      {overflow.status === 'OPEN' && (
                        <div className="flex justify-between items-center text-slate-300">
                          <span>Recovery Timer (Lanes 1-3 &lt; {overflow.recoveryThreshold}):</span>
                          <span className="font-mono font-bold text-emerald-300">
                            {(overflow.recoveryTimer || 0).toFixed(1)}s / {(overflow.minRecoveryDurationSecs || 5.0).toFixed(1)}s
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Manual Override Controls */}
                    <div className="pt-2.5 mt-2 border-t border-navy-800/80 flex items-center justify-between text-xs">
                      <span className="text-slate-400 text-[11px]">Override Mode:</span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setOverflowDoorOverride(gate.id, 'AUTO')}
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold transition ${
                            overflow.manualOverride === 'AUTO' || !overflow.manualOverride
                              ? 'bg-cyan-600 text-white'
                              : 'bg-navy-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          Auto (Congestion)
                        </button>
                        <button
                          onClick={() => setOverflowDoorOverride(gate.id, 'FORCE_OPEN')}
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold transition ${
                            overflow.manualOverride === 'FORCE_OPEN'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-navy-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          Force Open
                        </button>
                        <button
                          onClick={() => setOverflowDoorOverride(gate.id, 'FORCE_CLOSED')}
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold transition ${
                            overflow.manualOverride === 'FORCE_CLOSED'
                              ? 'bg-rose-600 text-white'
                              : 'bg-navy-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          Force Close
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. FOUR-LANE COMPARISON TABLE */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-cyan-400" />
                      Four-Route Comparison Table
                    </h3>
                    <span className="text-[10px] text-slate-400">3 Counters + 1 Overflow Door</span>
                  </div>

                  <div className="space-y-2">
                    {laneMetrics.map((lMetric) => {
                      const isOverflowRow = lMetric.laneIndex === 3;
                      const isOp = lMetric.counterStatus === 'OPERATIONAL' || lMetric.counterStatus === 'OPEN';

                      return (
                        <div
                          key={lMetric.counterId}
                          className={`rounded-lg border p-2.5 transition ${
                            isOverflowRow
                              ? isOp
                                ? 'bg-emerald-950/30 border-emerald-600/60'
                                : 'bg-navy-950 border-navy-700/80'
                              : isOp
                              ? 'bg-navy-950/90 border-navy-700 hover:border-cyan-500/50'
                              : 'bg-red-950/30 border-red-800/60'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`w-2.5 h-2.5 rounded-full ${
                                  isOverflowRow
                                    ? isOp
                                      ? 'bg-emerald-400 animate-pulse'
                                      : 'bg-slate-500'
                                    : isOp
                                    ? 'bg-cyan-400'
                                    : 'bg-rose-500'
                                }`}
                              />
                              <span className="font-bold text-xs text-white">
                                {isOverflowRow ? 'Door 4 — Overflow Route' : `Lane ${lMetric.laneNumber} — Counter ${lMetric.laneNumber}`}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <span
                                className={`px-2 py-0.2 rounded text-[10px] font-mono font-bold ${
                                  isOp
                                    ? 'bg-emerald-950 border border-emerald-500/40 text-emerald-400'
                                    : 'bg-red-950 border border-red-500/50 text-red-400'
                                }`}
                              >
                                {lMetric.counterStatus}
                              </span>
                              <span
                                className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                  lMetric.congestionStatus === 'OVERFLOW'
                                    ? 'bg-red-950 text-red-400'
                                    : lMetric.congestionStatus === 'CONGESTED'
                                    ? 'bg-amber-950 text-amber-400'
                                    : 'bg-cyan-950 text-cyan-400'
                                }`}
                              >
                                {lMetric.congestionStatus}
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2 text-xs py-1 border-y border-navy-800/80 my-1">
                            <div>
                              <span className="text-[10px] text-slate-400 block">Queue</span>
                              <span className="font-mono font-bold text-slate-100">{lMetric.totalLaneCount}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block">Service Rate</span>
                              <span className="font-mono text-slate-300">
                                {lMetric.serviceRatePerSec} p/s ({lMetric.serviceRatePerMin}/m)
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block">Est. Wait</span>
                              <span className="font-mono font-bold text-cyan-300">
                                {isOp ? `${lMetric.estimatedWaitSecs}s` : 'OFFLINE'}
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block">Admitted</span>
                              <span className="font-mono text-emerald-300">{lMetric.totalAdmitted}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block">Utilization</span>
                              <span className="font-mono text-slate-300">{lMetric.counterUtilization}%</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block">Switches In/Out</span>
                              <span className="font-mono text-slate-300">
                                +{lMetric.laneSwitchesIn} / -{lMetric.laneSwitchesOut}
                              </span>
                            </div>
                          </div>

                          {/* Action Button */}
                          <div className="flex justify-end pt-1">
                            {!isOverflowRow ? (
                              isOp ? (
                                <button
                                  onClick={() => handleFailCounter(lMetric.laneIndex)}
                                  className="px-2 py-0.5 rounded bg-rose-950/80 hover:bg-rose-900 border border-rose-700/60 text-rose-300 text-xs font-semibold transition"
                                >
                                  Fail Counter {lMetric.laneNumber}
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleRecoverCounter(lMetric.laneIndex)}
                                  className="px-2 py-0.5 rounded bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-600/60 text-emerald-300 text-xs font-semibold transition"
                                >
                                  Restore Counter {lMetric.laneNumber}
                                </button>
                              )
                            ) : (
                              <button
                                onClick={() =>
                                  setOverflowDoorOverride(
                                    gate.id,
                                    overflow?.status === 'OPEN' ? 'FORCE_CLOSED' : 'FORCE_OPEN'
                                  )
                                }
                                className={`px-2 py-0.5 rounded text-xs font-semibold border transition ${
                                  overflow?.status === 'OPEN'
                                    ? 'bg-rose-950/80 hover:bg-rose-900 border-rose-700 text-rose-300'
                                    : 'bg-emerald-950/80 hover:bg-emerald-900 border-emerald-600 text-emerald-300'
                                }`}
                              >
                                {overflow?.status === 'OPEN' ? 'Force Close Door' : 'Force Open Door'}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: THRESHOLD TUNING */}
            {panelTab === 'THRESHOLDS' && overflow && (
              <div className="space-y-3.5 bg-navy-950 p-3 rounded-xl border border-navy-700 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-navy-800">
                  <h4 className="font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
                    Overflow Activation Thresholds
                  </h4>
                  <span className="text-[10px] text-cyan-400 font-mono">LIVE TUNING</span>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-slate-300 mb-1">
                      <span>High Congestion Threshold (Queuers/Lane):</span>
                      <span className="font-mono font-bold text-cyan-300">{overflow.highCongestionThreshold}</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      step="5"
                      value={overflow.highCongestionThreshold}
                      onChange={(e) =>
                        setGateOverflowConfig(gate.id, { highCongestionThreshold: Number(e.target.value) })
                      }
                      className="w-full accent-cyan-500"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-slate-300 mb-1">
                      <span>Extreme Congestion Threshold (Queuers in All 3):</span>
                      <span className="font-mono font-bold text-rose-300">{overflow.extremeCongestionThreshold}</span>
                    </div>
                    <input
                      type="range"
                      min="20"
                      max="120"
                      step="5"
                      value={overflow.extremeCongestionThreshold}
                      onChange={(e) =>
                        setGateOverflowConfig(gate.id, { extremeCongestionThreshold: Number(e.target.value) })
                      }
                      className="w-full accent-rose-500"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-slate-300 mb-1">
                      <span>Min Sustained Extreme Duration (Seconds):</span>
                      <span className="font-mono font-bold text-amber-300">{overflow.minSustainedExtremeSecs}s</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="15"
                      step="1"
                      value={overflow.minSustainedExtremeSecs}
                      onChange={(e) =>
                        setGateOverflowConfig(gate.id, { minSustainedExtremeSecs: Number(e.target.value) })
                      }
                      className="w-full accent-amber-500"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-slate-300 mb-1">
                      <span>Recovery Threshold (All 3 Queues &lt; X):</span>
                      <span className="font-mono font-bold text-emerald-300">{overflow.recoveryThreshold}</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="60"
                      step="5"
                      value={overflow.recoveryThreshold}
                      onChange={(e) =>
                        setGateOverflowConfig(gate.id, { recoveryThreshold: Number(e.target.value) })
                      }
                      className="w-full accent-emerald-500"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-slate-300 mb-1">
                      <span>Recovery Duration (Seconds below threshold):</span>
                      <span className="font-mono font-bold text-emerald-300">{overflow.minRecoveryDurationSecs}s</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="15"
                      step="1"
                      value={overflow.minRecoveryDurationSecs}
                      onChange={(e) =>
                        setGateOverflowConfig(gate.id, { minRecoveryDurationSecs: Number(e.target.value) })
                      }
                      className="w-full accent-emerald-500"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-slate-300 mb-1">
                      <span>Overflow Route Service Rate (People/Min):</span>
                      <span className="font-mono font-bold text-cyan-300">
                        {Math.round((overflow.serviceRatePerSec || 1.0) * 60)} p/m
                      </span>
                    </div>
                    <input
                      type="range"
                      min="30"
                      max="120"
                      step="10"
                      value={Math.round((overflow.serviceRatePerSec || 1.0) * 60)}
                      onChange={(e) => {
                        const rateMin = Number(e.target.value);
                        setGateOverflowConfig(gate.id, {
                          serviceRatePerMin: rateMin,
                          serviceRatePerSec: rateMin / 60,
                        });
                      }}
                      className="w-full accent-cyan-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: STRESS TESTING */}
            {panelTab === 'FAILURES' && (
              <div className="space-y-3">
                <div className="bg-navy-950 p-3 rounded-lg border border-navy-700 space-y-2">
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    Simulated Scanner Malfunctions
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Disable regular counters to induce queue surges and observe real-time lane rebalancing and automatic overflow door opening.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {(gate.counters || []).map((c, idx) => (
                    <button
                      key={c.id}
                      onClick={() => handleFailCounter(idx)}
                      className={`p-2.5 rounded-lg border text-xs font-semibold text-center transition ${
                        c.status === 'FAILED'
                          ? 'bg-rose-900/60 border-rose-500 text-rose-200 shadow-md shadow-rose-950/50'
                          : 'bg-navy-950 hover:bg-rose-950/40 border-navy-700 hover:border-rose-600 text-slate-300'
                      }`}
                    >
                      <div className="text-[10px] text-slate-400 uppercase">Counter {idx + 1}</div>
                      <div className="font-bold">{c.status === 'FAILED' ? 'Offline' : 'Fail C' + (idx + 1)}</div>
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button
                    onClick={handleFailAll}
                    className="py-2 px-3 rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-700 text-rose-200 text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md"
                  >
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    Fail All Counters
                  </button>
                  <button
                    onClick={handleRestoreAll}
                    className="py-2 px-3 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-600 text-emerald-200 text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Restore All Counters
                  </button>
                </div>
              </div>
            )}

            {/* TAB CONTENT: LIVE EVENT LOG */}
            {panelTab === 'LOGS' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-cyan-400" />
                    Authoritative Simulation Events
                  </h4>
                  <span className="text-[10px] text-slate-400">Live feed</span>
                </div>

                <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
                  {gateEvents.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500 bg-navy-950 rounded-lg border border-navy-800">
                      No events logged yet. Simulation running normally.
                    </div>
                  ) : (
                    gateEvents.map((evt) => (
                      <div
                        key={evt.id}
                        className="p-2 rounded bg-navy-950 border border-navy-800/80 text-[11px] space-y-0.5"
                      >
                        <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                          <span>{evt.timeFormatted || formatTime(evt.timestamp)}</span>
                          <span
                            className={
                              evt.type.includes('FAILURE') || evt.type.includes('CLOSED')
                                ? 'text-rose-400 font-bold'
                                : evt.type.includes('RESTORE') || evt.type.includes('OPENED')
                                ? 'text-emerald-400 font-bold'
                                : 'text-cyan-400'
                            }
                          >
                            {evt.type}
                          </span>
                        </div>
                        <p className="text-slate-200 leading-snug">{evt.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* MASS CONSERVATION AUDIT CARD */}
            {accounting && (
              <div className="p-2.5 rounded-lg bg-navy-950 border border-navy-800 text-[11px] space-y-1">
                <div className="flex items-center justify-between font-semibold text-slate-300">
                  <span>Spectator Accounting Audit</span>
                  <span className="text-emerald-400 font-mono">✓ 100% Conserved</span>
                </div>
                <div className="text-[10px] text-slate-400 flex justify-between">
                  <span>Assigned: {accounting.assigned}</span>
                  <span>Arrived: {accounting.arrived}</span>
                  <span>Remaining: {accounting.remaining}</span>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};
