import React, { useState, useEffect } from 'react';
import { useSimulationStore } from '../../state/useSimulationStore';
import { RoadSectorId } from '../../types/simulation';
import { KSCA_STADIUM_SECTORS } from '../../engine/ChinnaswamyData';
import { ExperimentType } from '../../engine/SyntheticDemandGenerator';
import { GATE_CONNECTIVITY_CATALOG, INNER_GATE_STAND_CATALOG } from '../../stadium/network/gateConnectivity';
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
  Bot,
  ShieldCheck,
  Flame,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Compass,
  MapPin,
  FlaskConical,
  Activity
} from 'lucide-react';

export const LeftControls: React.FC = () => {
  // Store Subscriptions
  const setCurrentView = useSimulationStore((s) => s.setCurrentView);
  const simulationDisplayMode = useSimulationStore((s) => s.simulationDisplayMode);
  const setSimulationDisplayMode = useSimulationStore((s) => s.setSimulationDisplayMode);
  const selectedOuterGateId = useSimulationStore((s) => s.selectedOuterGateId);
  const setSelectedOuterGateId = useSimulationStore((s) => s.setSelectedOuterGateId);

  const selectedSector = (useSimulationStore((s) => s.selectedRoadSector) ||
    useSimulationStore((s) => s.selectedSector) ||
    'LINK_ROAD') as RoadSectorId;
  const setSelectedSector = useSimulationStore((s) => s.setSelectedSector);

  // Master Safety Workflow Store Subscriptions
  const activeExperiment = useSimulationStore((s) => s.activeExperiment);
  const setExperiment = useSimulationStore((s) => s.setExperiment);
  const triggerIntervention = useSimulationStore((s) => s.triggerIntervention);
  const bafflesActive = useSimulationStore((s) => s.bafflesActive);
  const auxGateActive = useSimulationStore((s) => s.auxGateActive);
  const overflowRerouteActive = useSimulationStore((s) => s.overflowRerouteActive);
  const dividerActive = useSimulationStore((s) => s.dividerActive);
  const sQueueEnabled = useSimulationStore((s) => s.sQueueEnabled);
  const setSQueueEnabled = useSimulationStore((s) => s.setSQueueEnabled);
  const autonomousRerouteActive = useSimulationStore((s) => s.autonomousRerouteActive);
  const toggleAutonomousReroute = useSimulationStore((s) => s.toggleAutonomousReroute);

  // Phase 2.1 & 2.2 Microscopic Gate Controls
  const ticketScanLatency = useSimulationStore((s) => s.ticketScanLatency);
  const setTicketScanLatency = useSimulationStore((s) => s.setTicketScanLatency);
  const personCheckLatency = useSimulationStore((s) => s.personCheckLatency);
  const setPersonCheckLatency = useSimulationStore((s) => s.setPersonCheckLatency);
  const personMismatchRate = useSimulationStore((s) => s.personMismatchRate);
  const setPersonMismatchRate = useSimulationStore((s) => s.setPersonMismatchRate);
  const ticketRejectionRate = useSimulationStore((s) => s.ticketRejectionRate);
  const setTicketRejectionRate = useSimulationStore((s) => s.setTicketRejectionRate);
  const auxiliaryBypassEnabled = useSimulationStore((s) => s.auxiliaryBypassEnabled);
  const toggleAuxiliaryBypass = useSimulationStore((s) => s.toggleAuxiliaryBypass);

  // Sliders & Calibration
  const inflowRate = useSimulationStore((s) => s.inflowRate);
  const setInflowRate = useSimulationStore((s) => s.setInflowRate);
  const turnstileScanLatency = useSimulationStore((s) => s.turnstileScanLatency);
  const setTurnstileScanLatency = useSimulationStore((s) => s.setTurnstileScanLatency);
  const walkingSpeed = useSimulationStore((s) => s.walkingSpeed);
  const setWalkingSpeed = useSimulationStore((s) => s.setWalkingSpeed);

  // Scenarios & Actions
  const counterFlowActive = useSimulationStore((s) => s.counterFlowActive);
  const toggleCounterFlow = useSimulationStore((s) => s.toggleCounterFlow);
  const sectorTurnstileOverrides = useSimulationStore((s) => s.sectorTurnstileOverrides);
  const setSectorTurnstileOverrides = useSimulationStore((s) => s.setSectorTurnstileOverrides);

  const isPaused = useSimulationStore((s) => s.isPaused);
  const togglePause = useSimulationStore((s) => s.togglePause);
  const timeScale = useSimulationStore((s) => s.timeScale);
  const setTimeScale = useSimulationStore((s) => s.setTimeScale);
  const triggerReset = useSimulationStore((s) => s.triggerReset);
  const triggerMetroPulse = useSimulationStore((s) => s.triggerMetroPulse);
  const toggleScenarioLab = useSimulationStore((s) => s.toggleScenarioLab);
  const toggleSafetyIntelligence = useSimulationStore((s) => s.toggleSafetyIntelligence);

  const sectors: { id: RoadSectorId; name: string; tag: string; isRestricted: boolean }[] = [
    { id: 'CUBBON_ROAD', name: 'Cubbon Road (North)', tag: 'Minsk Sq ──► BRV', isRestricted: false },
    { id: 'LINK_ROAD', name: 'Link Road (East)', tag: 'From MG Metro', isRestricted: false },
    { id: 'MG_ROAD', name: 'MG Road (South)', tag: 'Plaza & Metro Feed', isRestricted: false },
    { id: 'QUEENS_ROAD', name: "Queen's Rd (Restricted)", tag: 'VIP / Media Only', isRestricted: true }
  ];

  const experiments: {
    id: ExperimentType;
    label: string;
    sub: string;
    icon: React.ReactNode;
    color: string;
  }[] = [
    {
      id: 'NORMAL',
      label: 'Normal Ingress',
      sub: '360 p/m · Stable Flow',
      icon: <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />,
      color: 'border-emerald-600 bg-emerald-950/40 text-emerald-200'
    },
    {
      id: 'SURGE',
      label: 'Metro Surge',
      sub: '850 p/m · Ingress Spike',
      icon: <Flame className="w-3.5 h-3.5 text-amber-400" />,
      color: 'border-amber-600 bg-amber-950/40 text-amber-200'
    },
    {
      id: 'GATE_FAILURE',
      label: 'Gate Failure',
      sub: 'Turnstile Choke / Reroute',
      icon: <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />,
      color: 'border-rose-600 bg-rose-950/40 text-rose-200'
    },
    {
      id: 'COUNTER_FLOW',
      label: 'Counter-Flow Shock',
      sub: '8% Ticket Rejection Stream',
      icon: <Zap className="w-3.5 h-3.5 text-cyan-400" />,
      color: 'border-cyan-600 bg-cyan-950/40 text-cyan-200'
    }
  ];

  const activeSectorData = KSCA_STADIUM_SECTORS[selectedSector] || KSCA_STADIUM_SECTORS.LINK_ROAD;
  const isRerouteActive = overflowRerouteActive || auxGateActive;

  // Active Gate details for Gate View
  const currentOuterGateId = selectedOuterGateId || 'E11';
  const currentOuterGateSpec = GATE_CONNECTIVITY_CATALOG[currentOuterGateId] || GATE_CONNECTIVITY_CATALOG.E11;

  // Inner gates to display (either from selected outer gate if in GATE_VIEW, or from active sector)
  const displayInnerGates =
    simulationDisplayMode === 'GATE_VIEW'
      ? currentOuterGateSpec.connectedInnerGates.map((gid) => {
          const standSpec = INNER_GATE_STAND_CATALOG[gid];
          return {
            id: gid,
            stand: standSpec ? standSpec.standName : 'Concourse Stand',
            turnstileCount: standSpec ? standSpec.turnstileCount : 4,
            baseCapacityPerMin: standSpec ? standSpec.nominalThroughputPerMin : 240
          };
        })
      : activeSectorData.innerGates;

  const outerGatesByRoad: { road: string; label: string; gates: string[] }[] = [
    {
      road: 'CUBBON_ROAD',
      label: 'Cubbon Road (North)',
      gates: ['E18', 'E19', 'E20', 'E21', 'E22', 'E23', 'E1', 'E2', 'E3', 'E4']
    },
    {
      road: 'LINK_ROAD',
      label: 'Link Road / St. Marks (East)',
      gates: ['E12', 'E13', 'E14', 'E15', 'E16', 'E17']
    },
    {
      road: 'MG_ROAD',
      label: 'MG Road Plaza (South)',
      gates: ['E11']
    },
    {
      road: 'QUEENS_ROAD',
      label: "Queen's Road (Restricted VIP/Media)",
      gates: ['E5', 'E6', 'E7', 'E8', 'E9', 'E10']
    }
  ];

  // Staging state for Active Sector/Gate Turnstiles
  const [stagedTurnstiles, setStagedTurnstiles] = useState<Record<string, number>>({});
  const [appliedFeedback, setAppliedFeedback] = useState<boolean>(false);

  // Sync staged turnstile counts when sector/gate changes
  useEffect(() => {
    const initial: Record<string, number> = {};
    displayInnerGates.forEach((ig) => {
      initial[ig.id] = sectorTurnstileOverrides[ig.id] ?? ig.turnstileCount;
    });
    setStagedTurnstiles(initial);
    setAppliedFeedback(false);
  }, [selectedSector, activeSectorData, sectorTurnstileOverrides, simulationDisplayMode, currentOuterGateId]);

  const handleStepCount = (gateId: string, delta: number) => {
    const current = stagedTurnstiles[gateId] ?? sectorTurnstileOverrides[gateId] ?? 3;
    const next = Math.max(1, Math.min(10, current + delta));
    setStagedTurnstiles((prev) => ({
      ...prev,
      [gateId]: next
    }));
    setAppliedFeedback(false);
    if (simulationDisplayMode === 'GATE_VIEW') {
      useSimulationStore.getState().setSectorTurnstileCount(gateId, next);
    }
  };

  const hasPendingChanges = displayInnerGates.some((ig) => {
    const staged = stagedTurnstiles[ig.id];
    const applied = sectorTurnstileOverrides[ig.id] ?? ig.turnstileCount;
    return staged !== undefined && staged !== applied;
  });

  const handleApplyTurnstiles = () => {
    setSectorTurnstileOverrides(stagedTurnstiles);
    setAppliedFeedback(true);
    setTimeout(() => {
      setAppliedFeedback(false);
    }, 2500);
  };

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

      {/* 1. STAGE ONE — SYNTHETIC CROWD EXPERIMENTS */}
      <div className="space-y-1.5 p-2 rounded-lg bg-slate-950/80 border border-indigo-900/50">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-mono font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
            <span>Synthetic Experiments</span>
          </label>
          <span className="text-[8px] font-mono text-indigo-400 bg-indigo-950/80 px-1.5 py-0.5 rounded border border-indigo-800/80">
            STAGE 1
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1.5 font-mono text-xs">
          {experiments.map((exp) => {
            const isSelected = activeExperiment === exp.id;
            return (
              <button
                key={exp.id}
                onClick={() => setExperiment(exp.id)}
                className={`p-1.5 rounded-lg border text-left flex flex-col gap-0.5 transition active:scale-[0.98] ${
                  isSelected
                    ? `${exp.color} ring-1 ring-offset-0 font-bold shadow-sm`
                    : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  {exp.icon}
                  <span className="text-[10px] font-bold leading-tight">{exp.label}</span>
                </div>
                <span className="text-[8px] text-slate-500 pl-5">{exp.sub}</span>
              </button>
            );
          })}
        </div>

        <button
          onClick={toggleScenarioLab}
          className="w-full mt-2 py-1.5 px-2 rounded-lg bg-gradient-to-r from-purple-950/80 to-indigo-950/80 border border-purple-600/70 hover:from-purple-900/80 hover:to-indigo-900/80 text-purple-300 text-[10px] font-mono font-bold flex items-center justify-center gap-1.5 shadow-sm transition"
        >
          <FlaskConical className="w-3.5 h-3.5 text-purple-400" />
          <span>Launch Scenario Lab (Scenarios A–G)</span>
        </button>

        <button
          onClick={toggleSafetyIntelligence}
          className="w-full mt-1.5 py-1.5 px-2 rounded-lg bg-gradient-to-r from-indigo-950/80 to-cyan-950/80 border border-indigo-600/70 hover:from-indigo-900/80 hover:to-cyan-900/80 text-cyan-300 text-[10px] font-mono font-bold flex items-center justify-center gap-1.5 shadow-sm transition"
        >
          <Activity className="w-3.5 h-3.5 text-cyan-400" />
          <span>Launch Safety Intelligence Dashboard</span>
        </button>
      </div>

      {/* 2. Top View Switcher Tabs (Full Stadium 360°, Sector View, Gate View) */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
          <span>Simulation View Mode</span>
          <span className="text-[9px] font-mono text-cyan-400 bg-cyan-950/60 px-1.5 py-0.2 rounded border border-cyan-800/60">
            PHASE 2
          </span>
        </label>
        <div className="grid grid-cols-3 gap-1 font-mono text-xs">
          {/* Full Stadium 360 */}
          <button
            onClick={() => {
              setSimulationDisplayMode('FULL_STADIUM');
              setCurrentView('MACRO_STADIUM');
            }}
            className={`p-1.5 rounded-lg border text-center flex flex-col items-center justify-center gap-0.5 transition ${
              simulationDisplayMode === 'FULL_STADIUM'
                ? 'bg-cyan-950/80 border-cyan-500 text-cyan-300 font-bold ring-1 ring-cyan-500/70 shadow-md shadow-cyan-950/60'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
            }`}
          >
            <Globe className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[10px] font-bold leading-tight">360° Stadium</span>
            <span className="text-[8px] text-slate-500">Full Venue</span>
          </button>

          {/* Sector Concourse */}
          <button
            onClick={() => {
              setSimulationDisplayMode('SECTOR_VIEW');
              setCurrentView('SECTOR_CONCOURSE');
            }}
            className={`p-1.5 rounded-lg border text-center flex flex-col items-center justify-center gap-0.5 transition ${
              simulationDisplayMode === 'SECTOR_VIEW'
                ? 'bg-amber-950/80 border-orange-500 text-orange-200 font-bold ring-1 ring-orange-500/70 shadow-md shadow-orange-950/60'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
            }`}
          >
            <Compass className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[10px] font-bold leading-tight">Sector View</span>
            <span className="text-[8px] text-slate-500">4 Roads</span>
          </button>

          {/* Gate Corridor */}
          <button
            onClick={() => {
              setSimulationDisplayMode('GATE_VIEW');
              setCurrentView('SECTOR_CONCOURSE');
              if (!selectedOuterGateId) setSelectedOuterGateId('E11');
            }}
            className={`p-1.5 rounded-lg border text-center flex flex-col items-center justify-center gap-0.5 transition ${
              simulationDisplayMode === 'GATE_VIEW'
                ? 'bg-emerald-950/80 border-emerald-500 text-emerald-200 font-bold ring-1 ring-emerald-500/70 shadow-md shadow-emerald-950/60'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
            }`}
          >
            <DoorOpen className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[10px] font-bold leading-tight">Gate View</span>
            <span className="text-[8px] text-slate-500">E1–E23 Zoom</span>
          </button>
        </div>
      </div>

      {/* 3A. In Sector View: Perimeter Road Sector Selector */}
      {simulationDisplayMode === 'SECTOR_VIEW' && (
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
      )}

      {/* 3B. In Gate View: Gate Corridor Picker & Connected Stand Info */}
      {simulationDisplayMode === 'GATE_VIEW' && (
        <div className="space-y-2 p-2 rounded-lg bg-slate-950/80 border border-emerald-900/60 font-mono">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
              <DoorOpen className="w-3.5 h-3.5 text-emerald-400" />
              <span>Outer Gate Corridor Focus</span>
            </label>
            <span className="text-[9px] text-emerald-400 font-bold bg-emerald-950 px-1.5 py-0.2 rounded border border-emerald-800">
              {currentOuterGateId}
            </span>
          </div>

          {/* Quick Gate Select Dropdown */}
          <div className="space-y-1">
            <span className="text-[9px] text-slate-400">Select Outer Perimeter Gate (E1–E23):</span>
            <select
              value={currentOuterGateId}
              onChange={(e) => setSelectedOuterGateId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              {outerGatesByRoad.map((group) => (
                <optgroup key={group.road} label={group.label} className="bg-slate-950 text-slate-300">
                  {group.gates.map((gid) => {
                    const gSpec = GATE_CONNECTIVITY_CATALOG[gid];
                    return (
                      <option key={gid} value={gid}>
                        {gid} — {gSpec?.road.replace('_', ' ')} {gSpec?.accessPermission === 'RESTRICTED_VIP_MEDIA' ? '(VIP Restricted)' : `(→ ${gSpec?.connectedInnerGates.join(', ')})`}
                      </option>
                    );
                  })}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Gate Detail Card */}
          <div className="p-2 rounded bg-slate-900/90 border border-slate-800 text-[10px] space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-cyan-400" />
                <span>Approach Road:</span>
              </span>
              <span className="font-bold text-slate-200">{currentOuterGateSpec?.road.replace('_', ' ')}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400">Connected Inner Turnstiles:</span>
              <span className="font-bold text-amber-300">
                {currentOuterGateSpec?.connectedInnerGates.join(', ')}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400">Destination Stands:</span>
              <span className="font-bold text-emerald-300 truncate max-w-[150px]">
                {currentOuterGateSpec?.connectedInnerGates
                  .map((gid) => INNER_GATE_STAND_CATALOG[gid]?.standName || gid)
                  .join(' / ')}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400">Holding Pen Capacity:</span>
              <span className="font-mono text-cyan-400">
                {currentOuterGateSpec?.holdingCapacity || 500} persons
              </span>
            </div>

            <div className="flex items-center justify-between pt-0.5 border-t border-slate-800">
              <span className="text-slate-400">Access Status:</span>
              <span
                className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                  currentOuterGateSpec?.accessPermission === 'RESTRICTED_VIP_MEDIA'
                    ? 'bg-rose-950 text-rose-300 border border-rose-800'
                    : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                }`}
              >
                {currentOuterGateSpec?.accessPermission === 'RESTRICTED_VIP_MEDIA'
                  ? 'RESTRICTED (VIP / Media)'
                  : 'PUBLIC SPECTATORS ALLOWED'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 4. STAGE FIVE — EXPLAINABLE SAFETY CONTROLLER */}
      <div className="space-y-2 p-2.5 rounded-lg bg-slate-950/80 border border-indigo-900/60">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-mono font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
            <Bot className="w-3.5 h-3.5 text-cyan-400" />
            <span>Safety Controller</span>
          </label>
          <span className="text-[8px] font-mono text-indigo-400 bg-indigo-950/80 px-1.5 py-0.5 rounded border border-indigo-800/80">
            STAGE 5
          </span>
        </div>

        {/* AI Autonomous Commander Mode Switch */}
        <label className="flex items-center justify-between p-2 rounded bg-slate-900 border border-slate-800 cursor-pointer text-xs font-mono">
          <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
            <Bot className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[11px]">AI Incident Commander</span>
          </div>
          <input
            type="checkbox"
            checked={autonomousRerouteActive}
            onChange={toggleAutonomousReroute}
            className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
          />
        </label>

        {/* 4 Modular Intervention Triggers */}
        <div className="grid grid-cols-2 gap-1.5 font-mono text-[10px]">
          {/* A. METERING */}
          <button
            onClick={() => triggerIntervention('METERING')}
            className={`p-2 rounded border text-left flex flex-col gap-0.5 transition ${
              bafflesActive
                ? 'bg-amber-950/80 border-amber-500 text-amber-200 font-bold ring-1 ring-amber-500/60'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold">Metering</span>
              <span className={`text-[8px] px-1 rounded ${bafflesActive ? 'bg-amber-900 text-amber-200' : 'bg-slate-800'}`}>
                {bafflesActive ? 'ON' : 'OFF'}
              </span>
            </div>
            <span className="text-[8px] text-slate-500">Upstream Baffles</span>
          </button>

          {/* B. REROUTING */}
          <button
            onClick={() => triggerIntervention('REROUTING')}
            className={`p-2 rounded border text-left flex flex-col gap-0.5 transition ${
              isRerouteActive
                ? 'bg-cyan-950/80 border-cyan-500 text-cyan-200 font-bold ring-1 ring-cyan-500/60'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold">Rerouting</span>
              <span className={`text-[8px] px-1 rounded ${isRerouteActive ? 'bg-cyan-900 text-cyan-200' : 'bg-slate-800'}`}>
                {isRerouteActive ? 'ON' : 'OFF'}
              </span>
            </div>
            <span className="text-[8px] text-slate-500">Aux Gate Bypass</span>
          </button>

          {/* C. DIRECTIONAL SEPARATION */}
          <button
            onClick={() => triggerIntervention('DIRECTIONAL_SEPARATION')}
            className={`p-2 rounded border text-left flex flex-col gap-0.5 transition ${
              dividerActive
                ? 'bg-emerald-950/80 border-emerald-500 text-emerald-200 font-bold ring-1 ring-emerald-500/60'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold">Separation</span>
              <span className={`text-[8px] px-1 rounded ${dividerActive ? 'bg-emerald-900 text-emerald-200' : 'bg-slate-800'}`}>
                {dividerActive ? 'ON' : 'OFF'}
              </span>
            </div>
            <span className="text-[8px] text-slate-500">Anti-Collision Barrier</span>
          </button>

          {/* D. QUEUE MANAGEMENT */}
          <button
            onClick={() => triggerIntervention('QUEUE_MANAGEMENT')}
            className={`p-2 rounded border text-left flex flex-col gap-0.5 transition ${
              sQueueEnabled
                ? 'bg-purple-950/80 border-purple-500 text-purple-200 font-bold ring-1 ring-purple-500/60'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold">Queue S-Lanes</span>
              <span className={`text-[8px] px-1 rounded ${sQueueEnabled ? 'bg-purple-900 text-purple-200' : 'bg-slate-800'}`}>
                {sQueueEnabled ? 'ON' : 'OFF'}
              </span>
            </div>
            <span className="text-[8px] text-slate-500">Switchback Baffles</span>
          </button>
        </div>
      </div>

      {/* 5. Ingress Rate & Latency Sliders */}
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

        {/* Stage 2: Person Check Latency */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-slate-300">Stage 2: Person Check</span>
            <span className="font-mono text-xs text-amber-400 font-bold px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">
              {personCheckLatency.toFixed(1)}s / check
            </span>
          </div>
          <input
            type="range"
            min="0.5"
            max="3.0"
            step="0.1"
            value={personCheckLatency}
            onChange={(e) => setPersonCheckLatency(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>0.5s (Rapid ID)</span>
            <span>1.0s (Nominal)</span>
            <span>3.0s (Manual)</span>
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

        {/* Gate View Specific Calibration Sliders */}
        {simulationDisplayMode === 'GATE_VIEW' && (
          <>
            {/* Ticket Validation Scan Latency */}
            <div className="space-y-1 pt-1 border-t border-slate-850">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-cyan-300">Ticket Scan Latency</span>
                <span className="font-mono text-xs text-cyan-400 font-bold px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">
                  {ticketScanLatency.toFixed(1)}s / scan
                </span>
              </div>
              <input
                type="range"
                min="0.2"
                max="2.0"
                step="0.1"
                value={ticketScanLatency}
                onChange={(e) => setTicketScanLatency(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>0.2s (Fast NFC)</span>
                <span>0.4s (Nominal)</span>
                <span>2.0s (Choke)</span>
              </div>
            </div>

            {/* Stage 2: Person Check Latency */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-amber-300">Stage 2: Person Check Latency</span>
                <span className="font-mono text-xs text-amber-400 font-bold px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">
                  {personCheckLatency.toFixed(1)}s / person
                </span>
              </div>
              <input
                type="range"
                min="0.5"
                max="3.0"
                step="0.1"
                value={personCheckLatency}
                onChange={(e) => setPersonCheckLatency(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>0.5s (Express)</span>
                <span>1.0s (Nominal)</span>
                <span>3.0s (Strict)</span>
              </div>
            </div>

            {/* Synthetic Attendee ID Mismatch Rate */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-purple-300">Attendee ID Mismatch Rate</span>
                <span className="font-mono text-xs text-purple-400 font-bold px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">
                  {(personMismatchRate * 100).toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                min="0.0"
                max="0.15"
                step="0.01"
                value={personMismatchRate}
                onChange={(e) => setPersonMismatchRate(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>0% (Matched)</span>
                <span>3% (Nominal)</span>
                <span>15% (Strict Audit)</span>
              </div>
            </div>

            {/* Synthetic Ticket Rejection Rate */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-rose-300">Ticket Rejection Rate</span>
                <span className="font-mono text-xs text-rose-400 font-bold px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">
                  {(ticketRejectionRate * 100).toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                min="0.0"
                max="0.25"
                step="0.01"
                value={ticketRejectionRate}
                onChange={(e) => setTicketRejectionRate(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>0% (All Valid)</span>
                <span>5% (Nominal)</span>
                <span>25% (High Fraud)</span>
              </div>
            </div>

            {/* Gate Configuration Toggles */}
            <div className="grid grid-cols-2 gap-1.5 pt-1">
              <button
                onClick={() => setSQueueEnabled(!sQueueEnabled)}
                className={`p-1.5 rounded border text-[10px] font-mono font-bold flex flex-col gap-0.5 transition ${
                  sQueueEnabled
                    ? 'bg-purple-950 border-purple-500 text-purple-200'
                    : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
              >
                <span>S-Curve Lanes</span>
                <span className="text-[8px] text-slate-500">{sQueueEnabled ? 'SWITCHBACK ON' : 'DIRECT FLOW'}</span>
              </button>

              <button
                onClick={toggleAuxiliaryBypass}
                className={`p-1.5 rounded border text-[10px] font-mono font-bold flex flex-col gap-0.5 transition ${
                  auxiliaryBypassEnabled
                    ? 'bg-emerald-950 border-emerald-500 text-emerald-200'
                    : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
              >
                <span>Aux Bypass</span>
                <span className="text-[8px] text-slate-500">{auxiliaryBypassEnabled ? 'BYPASS OPEN' : 'CLOSED'}</span>
              </button>
            </div>
          </>
        )}

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

      {/* 6. Dynamic Turnstile Staffing Stepper with Apply Button */}
      <div className="space-y-2 p-2.5 rounded-lg bg-slate-950/70 border border-slate-800">
        <label className="text-[10px] font-mono font-semibold text-slate-300 uppercase tracking-wider flex items-center justify-between">
          <span>
            {simulationDisplayMode === 'GATE_VIEW'
              ? `Gate ${currentOuterGateId} Turnstiles`
              : 'Active Sector Turnstiles'}
          </span>
          <span className="text-amber-400 font-bold text-[9px]">
            {simulationDisplayMode === 'GATE_VIEW'
              ? currentOuterGateSpec?.road.replace('_', ' ')
              : activeSectorData.name}
          </span>
        </label>

        <div className="space-y-1.5">
          {displayInnerGates.map((ig) => {
            const currentCount =
              stagedTurnstiles[ig.id] ?? sectorTurnstileOverrides[ig.id] ?? ig.turnstileCount;
            const appliedCount = sectorTurnstileOverrides[ig.id] ?? ig.turnstileCount;
            const isModified = currentCount !== appliedCount;

            return (
              <div
                key={ig.id}
                className={`flex items-center justify-between p-1.5 rounded border text-[11px] font-mono transition ${
                  isModified
                    ? 'bg-amber-950/40 border-amber-600/70 ring-1 ring-amber-500/50'
                    : 'bg-slate-900 border-slate-800'
                }`}
              >
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-200">
                      {ig.id} ({ig.stand})
                    </span>
                    {isModified && (
                      <span className="text-[8px] px-1 py-0.2 rounded bg-amber-900/80 text-amber-300 font-bold">
                        PENDING
                      </span>
                    )}
                  </div>
                  <span className="text-[9px] text-slate-400">
                    {currentCount * 60} p/min capacity
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleStepCount(ig.id, -1)}
                    disabled={currentCount <= 1}
                    className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-amber-300 font-bold flex items-center justify-center border border-slate-700 active:scale-95 transition"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className={`text-xs font-bold w-4 text-center ${isModified ? 'text-amber-300 animate-pulse' : 'text-amber-400'}`}>
                    {currentCount}
                  </span>
                  <button
                    onClick={() => handleStepCount(ig.id, 1)}
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

        {/* Apply Turnstile Staffing Button */}
        <button
          onClick={handleApplyTurnstiles}
          disabled={!hasPendingChanges && !appliedFeedback}
          className={`w-full py-2 px-3 rounded-lg font-mono font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition active:scale-[0.98] ${
            appliedFeedback
              ? 'bg-emerald-600 hover:bg-emerald-500 text-slate-950 shadow-emerald-950/60'
              : hasPendingChanges
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 animate-pulse ring-2 ring-amber-400/60'
              : 'bg-slate-900 border border-slate-800 text-slate-500 cursor-not-allowed opacity-60'
          }`}
          title={hasPendingChanges ? 'Click to apply pending turnstile staffing changes to simulation' : 'Turnstiles up to date'}
        >
          {appliedFeedback ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>✓ Turnstiles Applied</span>
            </>
          ) : hasPendingChanges ? (
            <>
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Apply Turnstile Staffing</span>
            </>
          ) : (
            <>
              <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
              <span>Turnstiles Up-to-Date</span>
            </>
          )}
        </button>
      </div>

      {/* 7. Stress & Shock Triggers */}
      <div className="space-y-2 p-2.5 rounded-lg bg-slate-950/70 border border-slate-800">
        <label className="text-[10px] font-mono font-semibold text-slate-300 uppercase tracking-wider">
          Stress & Shock Triggers
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
      </div>
    </div>
  );
};

export { GateControls } from './GateControls';
export default LeftControls;
