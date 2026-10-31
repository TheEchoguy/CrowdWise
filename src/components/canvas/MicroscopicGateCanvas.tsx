/**
 * CROWDWISE — Phase 2.3: Microscopic Gate Concourse Simulation Viewport
 * M. Chinnaswamy Stadium, Bengaluru
 *
 * Strict Gate View Isolation & Live Operational Turnstile Integration:
 * - Dedicated Microscopic Gate Pathway:
 *   Selected Outer Gate -> Security Perimeter -> Approach Corridor -> S-Queues
 *   -> Stage 1: NFC/QR Ticket Scan -> Stage 2: Person Check (ID Match)
 *   -> Connected Inner Turnstile Banks -> Vomitory Stairwells -> Destination Stand
 * - Dynamic Isolation: displays ONLY the selected outer gate and its connected inner turnstile banks.
 * - Live Turnstile Counters: every counter is an independent operational server (IDLE/BUSY/FAILED)
 *   with unique ID, service countdown, queue lane, and real-time scaling synchronised with LeftControls.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useSimulationStore } from '../../state/useSimulationStore';
import { MicroGateEngine } from '../../stadium/gate/MicroGateEngine';
import { MicroGateAgent } from '../../stadium/types/gateSimulation';
import {
  GATE_CONNECTIVITY_CATALOG,
  INNER_GATE_STAND_CATALOG,
  getDestinationStandsForOuterGate
} from '../../stadium/network/gateConnectivity';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ArrowLeft,
  Zap,
  DoorOpen,
  Plus,
  Minus
} from 'lucide-react';

export const MicroscopicGateCanvas: React.FC = () => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Store Subscriptions
  const selectedOuterGateId = useSimulationStore((s) => s.selectedOuterGateId) || 'E11';
  const selectedInnerGateId = useSimulationStore((s) => s.selectedInnerGateId);
  const setSelectedInnerGateId = useSimulationStore((s) => s.setSelectedInnerGateId);
  const setSimulationDisplayMode = useSimulationStore((s) => s.setSimulationDisplayMode);
  const setCurrentView = useSimulationStore((s) => s.setCurrentView);

  const inflowRate = useSimulationStore((s) => s.inflowRate);
  const ticketScanLatency = useSimulationStore((s) => s.ticketScanLatency);
  const securityScreeningLatency = useSimulationStore((s) => s.securityScreeningLatency);
  const turnstileScanLatency = useSimulationStore((s) => s.turnstileScanLatency);
  const ticketRejectionRate = useSimulationStore((s) => s.ticketRejectionRate);
  const sQueueEnabled = useSimulationStore((s) => s.sQueueEnabled);
  const auxiliaryBypassEnabled = useSimulationStore((s) => s.auxiliaryBypassEnabled);
  const isPaused = useSimulationStore((s) => s.isPaused);
  const timeScale = useSimulationStore((s) => s.timeScale);
  const resetSignal = useSimulationStore((s) => s.resetSignal);
  const metroPulseSignal = useSimulationStore((s) => s.metroPulseSignal);
  const setMicroGateMetrics = useSimulationStore((s) => s.setMicroGateMetrics);
  const addGateLog = useSimulationStore((s) => s.addGateLog);

  const sectorTurnstileOverrides = useSimulationStore((s) => s.sectorTurnstileOverrides);
  const addTurnstileCounter = useSimulationStore((s) => s.addTurnstileCounter);
  const removeTurnstileCounter = useSimulationStore((s) => s.removeTurnstileCounter);
  const microGateMetrics = useSimulationStore((s) => s.microGateMetrics);

  // Engine Reference (instantiated for selected outer gate)
  const engineRef = useRef<MicroGateEngine>(
    new MicroGateEngine(selectedOuterGateId, 42, (evt) => addGateLog(evt.level, evt.message, evt.gateId))
  );

  // Live Frame State
  const [agents, setAgents] = useState<MicroGateAgent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<MicroGateAgent | null>(null);
  const [hoveredStation, setHoveredStation] = useState<string | null>(null);

  // ViewBox Pan & Zoom
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, width: 960, height: 580 });
  const [isPanning, setIsPanning] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Gate Connectivity Spec
  const gateSpec = GATE_CONNECTIVITY_CATALOG[selectedOuterGateId] || GATE_CONNECTIVITY_CATALOG.E11;
  const connectedInnerGates = gateSpec.connectedInnerGates || ['G15'];
  const activeInnerGate = selectedInnerGateId || connectedInnerGates[0];
  const destinationStands = getDestinationStandsForOuterGate(selectedOuterGateId);

  // Sync engine when outer gate selection changes
  useEffect(() => {
    engineRef.current.selectOuterGate(selectedOuterGateId);
    if (!connectedInnerGates.includes(activeInnerGate)) {
      setSelectedInnerGateId(connectedInnerGates[0]);
    }
    // Also sync turnstiles from overrides
    engineRef.current.syncTurnstilesFromOverrides(sectorTurnstileOverrides);
  }, [selectedOuterGateId, connectedInnerGates, activeInnerGate, setSelectedInnerGateId]);

  // Synchronize turnstile counts from external store changes (e.g. LeftControls)
  useEffect(() => {
    engineRef.current.syncTurnstilesFromOverrides(sectorTurnstileOverrides);
  }, [sectorTurnstileOverrides]);

  // Sync simulation operational parameters
  useEffect(() => {
    const e = engineRef.current;
    e.setArrivalRate(inflowRate);
    e.setTicketScanLatency(ticketScanLatency);
    e.setSecurityScreeningLatency(securityScreeningLatency);
    e.setTurnstileLatency(turnstileScanLatency);
    e.setRejectionRate(ticketRejectionRate);
    e.setSQueueActive(sQueueEnabled);
    e.setAuxiliaryBypassActive(auxiliaryBypassEnabled);
  }, [
    inflowRate,
    ticketScanLatency,
    securityScreeningLatency,
    turnstileScanLatency,
    ticketRejectionRate,
    sQueueEnabled,
    auxiliaryBypassEnabled
  ]);

  // Reset trigger
  useEffect(() => {
    engineRef.current.reset(42 + resetSignal);
    engineRef.current.syncTurnstilesFromOverrides(sectorTurnstileOverrides);
  }, [resetSignal]);

  // Metro Arrival Burst Trigger
  useEffect(() => {
    if (metroPulseSignal > 0) {
      engineRef.current.triggerArrivalBurst(40);
    }
  }, [metroPulseSignal]);

  // Animation Loop
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();
    let dispatchTimer = 0;

    const loop = (now: number) => {
      const dt = Math.min(0.066, (now - lastTime) / 1000) * timeScale;
      lastTime = now;

      if (!isPaused && dt > 0) {
        const metrics = engineRef.current.step(dt, now / 1000);
        setAgents([...engineRef.current.getAgents()]);

        dispatchTimer += dt;
        if (dispatchTimer >= 0.1) {
          dispatchTimer = 0;
          setMicroGateMetrics(metrics);
        }
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isPaused, timeScale, setMicroGateMetrics]);

  // Pan & Zoom Handlers
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 0.9 : 1.1;
    setViewBox((prev) => {
      const nw = Math.max(480, Math.min(1440, prev.width * factor));
      const nh = Math.max(290, Math.min(870, prev.height * factor));
      const dx = (prev.width - nw) / 2;
      const dy = (prev.height - nh) / 2;
      return {
        x: Math.max(-100, Math.min(600, prev.x + dx)),
        y: Math.max(-50, Math.min(400, prev.y + dy)),
        width: nw,
        height: nh
      };
    });
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsPanning(true);
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return;
    const dx = (e.clientX - dragStart.x) * (viewBox.width / 960);
    const dy = (e.clientY - dragStart.y) * (viewBox.height / 580);
    setViewBox((prev) => ({
      ...prev,
      x: prev.x - dx,
      y: prev.y - dy
    }));
    setDragStart({ x: e.clientX, y: e.clientY });
  }, [isPanning, dragStart, viewBox.width, viewBox.height]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const handleResetZoom = () => {
    setViewBox({ x: 0, y: 0, width: 960, height: 580 });
  };

  // Helper for agent state color mapping
  const getAgentColor = (state: string) => {
    switch (state) {
      case 'ARRIVING': return '#38bdf8'; // Sky blue
      case 'WAITING_IN_QUEUE': return '#f97316'; // Amber / Orange
      case 'TICKET_SCANNING': return '#06b6d4'; // Cyan
      case 'TICKET_VALIDATED': return '#22d3ee'; // Light Cyan
      case 'PERSON_CHECKING': return '#eab308'; // Amber / Yellow
      case 'PERSON_VERIFIED': return '#6366f1'; // Indigo
      case 'WAITING_FOR_TURNSTILE':
      case 'TURNSTILE_WAITING': return '#a855f7'; // Purple
      case 'TURNSTILE_PROCESSING': return '#3b82f6'; // Electric Blue
      case 'ADMITTED':
      case 'VOMITORY_DISPERSAL': return '#10b981'; // Emerald
      case 'DESTINATION_STAND': return '#22c55e'; // Bright Green
      case 'REJECTED':
      case 'DIVERTED': return '#f43f5e'; // Rose / Red
      default: return '#38bdf8';
    }
  };

  const queueLanes = engineRef.current.getQueueLanes();
  const scanStations = engineRef.current.getScanStations();
  const personCheckStations = engineRef.current.getPersonCheckStations();
  const turnstiles = engineRef.current.getTurnstileCounters();
  const vomitories = engineRef.current.getVomitories();

  const handleAddTurnstile = (gid: string) => {
    addTurnstileCounter(gid);
    engineRef.current.addTurnstile(gid);
  };

  const handleRemoveTurnstile = (gid: string) => {
    const removed = engineRef.current.removeTurnstile(gid);
    if (removed) {
      removeTurnstileCounter(gid);
    }
  };

  return (
    <div className="relative w-full h-full bg-[#080c14] border border-slate-800 rounded-xl overflow-hidden select-none flex flex-col font-mono">
      {/* ─── TOP TACTICAL CONTROL BAR ────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/90 border-b border-slate-800 z-20 shrink-0">
        {/* Navigation Breadcrumb & Isolated Gate Information */}
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => {
              setSimulationDisplayMode('FULL_STADIUM');
              setCurrentView('MACRO_STADIUM');
            }}
            className="flex items-center gap-1 text-slate-400 hover:text-cyan-400 transition bg-slate-950 px-2 py-1 rounded border border-slate-800 hover:border-cyan-700"
            title="Return to 360° Full Stadium Satellite View"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="font-bold">Full Stadium</span>
          </button>

          <span className="text-slate-600">/</span>

          {/* Selected Outer Gate Badge */}
          <div className="flex items-center gap-1.5 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-700/80 text-cyan-300 font-bold">
            <DoorOpen className="w-3.5 h-3.5 text-cyan-400" />
            <span>Outer Gate {selectedOuterGateId}</span>
            <span className="text-[10px] text-cyan-400/80 font-normal">
              ({gateSpec.road.replace('_', ' ')})
            </span>
          </div>

          <span className="text-slate-600">──►</span>

          {/* Connected Inner Gates Switcher with Synchronised Turnstile Controls */}
          <div className="flex items-center gap-1.5">
            {connectedInnerGates.map((gid) => {
              const stand = INNER_GATE_STAND_CATALOG[gid]?.standName || gid;
              const isSelected = activeInnerGate === gid;
              const bankCount = turnstiles.filter((t) => t.gateId === gid).length;
              return (
                <div
                  key={gid}
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded border text-[11px] font-mono transition ${
                    isSelected
                      ? 'bg-amber-950/80 border-amber-500 text-amber-200 ring-1 ring-amber-500/60'
                      : 'bg-slate-950/80 border-slate-800 text-slate-400'
                  }`}
                >
                  <button
                    onClick={() => setSelectedInnerGateId(gid)}
                    className="font-bold hover:text-slate-200 mr-1"
                    title={`Select inner turnstile bank ${gid}`}
                  >
                    {gid} ({stand})
                  </button>
                  <span className="text-[10px] text-cyan-400 font-bold px-1 rounded bg-slate-900 border border-slate-800">
                    {bankCount}T
                  </span>
                  <button
                    onClick={() => handleRemoveTurnstile(gid)}
                    className="w-4 h-4 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold flex items-center justify-center transition active:scale-95"
                    title={`Remove idle turnstile counter from ${gid}`}
                  >
                    <Minus className="w-2.5 h-2.5" />
                  </button>
                  <button
                    onClick={() => handleAddTurnstile(gid)}
                    className="w-4 h-4 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold flex items-center justify-center transition active:scale-95"
                    title={`Add new turnstile counter to ${gid}`}
                  >
                    <Plus className="w-2.5 h-2.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Operational Throughput & Capacity Indicators */}
        <div className="flex items-center gap-2">
          {microGateMetrics && (
            <div className="hidden md:flex items-center gap-2 text-[10px]">
              <span className="px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-700/80 text-emerald-300 font-bold">
                C_eff: {microGateMetrics.effectiveCapacityPerMin} p/m
              </span>
              <span className="px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-700/80 text-cyan-300 font-bold">
                Flow: {microGateMetrics.currentThroughputPerMin} p/m
              </span>
              <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300">
                Admitted: {microGateMetrics.spectatorsAdmitted}
              </span>
            </div>
          )}

          {/* Burst Button */}
          <button
            onClick={() => engineRef.current.triggerArrivalBurst(25)}
            className="px-2 py-1 rounded bg-gradient-to-r from-amber-600 to-orange-600 text-slate-950 text-[10px] font-bold flex items-center gap-1 hover:brightness-110 shadow-sm"
            title="Simulate sudden wave of arriving spectators"
          >
            <Zap className="w-3 h-3" />
            <span>+25 Burst</span>
          </button>

          <div className="h-4 w-px bg-slate-800 mx-0.5" />

          {/* Viewport Zoom & Pan Actions */}
          <button
            onClick={() =>
              setViewBox((v) => ({
                ...v,
                width: Math.max(480, v.width * 0.85),
                height: Math.max(290, v.height * 0.85)
              }))
            }
            className="p-1 rounded bg-slate-950 border border-slate-800 text-slate-300 hover:text-cyan-400"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() =>
              setViewBox((v) => ({
                ...v,
                width: Math.min(1440, v.width * 1.15),
                height: Math.min(870, v.height * 1.15)
              }))
            }
            className="p-1 rounded bg-slate-950 border border-slate-800 text-slate-300 hover:text-cyan-400"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleResetZoom}
            className="p-1 rounded bg-slate-950 border border-slate-800 text-slate-300 hover:text-cyan-400"
            title="Reset View"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ─── INTERACTIVE SVG CANAS ────────────────────────────────────────── */}
      <div className="relative flex-1 min-h-0 w-full overflow-hidden cursor-crosshair">
        <svg
          ref={svgRef}
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
          className="w-full h-full"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <defs>
            {/* Engineering Background Grid */}
            <pattern id="microGrid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" strokeWidth="0.5" strokeOpacity="0.4" />
            </pattern>

            {/* Cyan Flow Indicator Marker */}
            <marker id="flowArrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#06b6d4" fillOpacity="0.8" />
            </marker>

            {/* Amber Reroute Marker */}
            <marker id="rerouteArrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#f59e0b" fillOpacity="0.8" />
            </marker>

            {/* Laser Scan Bar Gradient */}
            <linearGradient id="scanBarGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.1" />
              <stop offset="50%" stopColor="#22d3ee" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.1" />
            </linearGradient>
          </defs>

          {/* Background Grid */}
          <rect x="-200" y="-100" width="1400" height="800" fill="#080c14" />
          <rect x="-200" y="-100" width="1400" height="800" fill="url(#microGrid)" />

          {/* ─── 1. TOP SEATING BOWL & DYNAMIC VOMITORIES ───────────────────── */}
          {/* Seating Bowl Grandstand Curve */}
          <path
            d="M 120 40 Q 480 -20 840 40"
            fill="none"
            stroke="#334155"
            strokeWidth="32"
            strokeOpacity="0.7"
          />
          <text x="480" y="32" fill="#94a3b8" fontSize="12" fontWeight="bold" textAnchor="middle" letterSpacing="2">
            SEATING BOWL GRANDSTANDS
          </text>

          {/* Dynamic Vomitory Stairwells Aligned with Connected Inner Gates ONLY */}
          <g id="vomitories">
            {vomitories.map((v) => (
              <g key={v.gateId}>
                <path d={`M ${v.x} 120 L ${v.x} 50`} stroke="#38bdf8" strokeWidth="20" strokeDasharray="3 3" strokeOpacity="0.4" />
                <path d={`M ${v.x} 115 L ${v.x} 55`} stroke="#38bdf8" strokeWidth="2" markerEnd="url(#flowArrow)" />
                <rect x={v.x - 70} y="62" width="140" height="26" rx="3" fill="#0f172a" stroke="#0284c7" strokeWidth="1" />
                <text x={v.x} y="74" fill="#38bdf8" fontSize="9" fontWeight="bold" textAnchor="middle">
                  Vomitory {v.gateId}
                </text>
                <text x={v.x} y="85" fill="#e2e8f0" fontSize="8" fontWeight="bold" textAnchor="middle">
                  {v.standName}
                </text>
              </g>
            ))}
          </g>

          {/* Concourse Dispersal Corridor Label */}
          <rect x="360" y="98" width="240" height="20" rx="3" fill="#0f172a" stroke="#1e293b" />
          <text x="480" y="112" fill="#94a3b8" fontSize="8.5" textAnchor="middle">
            Concourse Dispersal Corridor
          </text>

          {/* ─── 2. DYNAMIC INNER TURNSTILE BANKS (ISOLATED) ───────────────── */}
          {/* Facility Boxes for connected inner gates */}
          {connectedInnerGates.map((gid, bankIdx) => {
            const bankWidth = 500 / connectedInnerGates.length;
            const bankStartX = 180 + bankIdx * bankWidth;
            const standSpec = INNER_GATE_STAND_CATALOG[gid];
            const standName = standSpec ? standSpec.standName : gid;
            const bankTurnstiles = turnstiles.filter((t) => t.gateId === gid);

            return (
              <g key={gid}>
                <rect
                  x={bankStartX + 4}
                  y="125"
                  width={bankWidth - 8}
                  height="48"
                  rx="4"
                  fill="#0f172a"
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                  strokeOpacity="0.8"
                />
                <text x={bankStartX + 10} y="138" fill="#38bdf8" fontSize="8.5" fontWeight="bold">
                  INNER GATE {gid} [{standName}]
                </text>
                <text x={bankStartX + bankWidth - 14} y="138" fill="#94a3b8" fontSize="7.5" textAnchor="end">
                  {bankTurnstiles.length * 60} p/m Capacity
                </text>
              </g>
            );
          })}

          {/* Individual Operational Turnstile Counters */}
          {turnstiles.map((counter) => {
            const isFailed = counter.status === 'FAILED';
            const isBusy = counter.status === 'BUSY';
            const isSelectedInner = activeInnerGate === counter.gateId;
            return (
              <g
                key={counter.counterId}
                className="cursor-pointer"
                onClick={() => engineRef.current.toggleTurnstileFailure(counter.counterId)}
                onMouseEnter={() => setHoveredStation(counter.counterId)}
                onMouseLeave={() => setHoveredStation(null)}
              >
                {/* Physical Turnstile Lane Queue Guide Line */}
                <line
                  x1={counter.x}
                  y1="168"
                  x2={counter.x}
                  y2="185"
                  stroke={isSelectedInner ? '#38bdf8' : '#334155'}
                  strokeWidth="1"
                  strokeDasharray="2 2"
                />

                {/* Turnstile Booth Outline */}
                <rect
                  x={counter.x - 17}
                  y={counter.y - 12}
                  width="34"
                  height="26"
                  rx="3"
                  fill={isFailed ? '#450a0a' : isBusy ? '#451a03' : '#064e3b'}
                  stroke={isFailed ? '#ef4444' : isBusy ? '#f59e0b' : '#10b981'}
                  strokeWidth={hoveredStation === counter.counterId ? '2' : '1'}
                />

                {/* Booth Unique ID */}
                <text x={counter.x} y={counter.y - 2} fill="#f1f5f9" fontSize="7.5" fontWeight="bold" textAnchor="middle">
                  {counter.counterId}
                </text>

                {/* Status Indicator / Live Countdown */}
                <text
                  x={counter.x}
                  y={counter.y + 8}
                  fill={isFailed ? '#fca5a5' : isBusy ? '#fde68a' : '#6ee7b7'}
                  fontSize="7"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {isFailed ? 'FAIL' : isBusy ? `${counter.serviceRemainingSec.toFixed(1)}s` : 'IDLE'}
                </text>

                {/* Processed Count Badge */}
                <rect
                  x={counter.x - 13}
                  y={counter.y + 16}
                  width="26"
                  height="9"
                  rx="2"
                  fill="#0f172a"
                  stroke="#1e293b"
                />
                <text x={counter.x} y={counter.y + 23} fill="#94a3b8" fontSize="6.5" textAnchor="middle">
                  ✓ {counter.processedCount}
                </text>
              </g>
            );
          })}

          {/* ─── 3. STAGE 2: PERSON IDENTITY CHECKPOINTS (ID MATCH) ───────── */}
          <g id="personCheckStations">
            <rect x="170" y="185" width="520" height="26" rx="3" fill="#1e1b4b" stroke="#6366f1" strokeOpacity="0.4" />
            <text x="180" y="198" fill="#a5b4fc" fontSize="8" fontWeight="bold">
              STAGE 2: PERSON IDENTITY CHECKPOINTS (Attendee vs Ticket-Holder ID Verification)
            </text>

            {personCheckStations.map((station) => {
              const isChecking = station.status === 'CHECKING';
              const isFailed = station.status === 'FAILED';
              return (
                <g key={station.id}>
                  <rect
                    x={station.x - 26}
                    y={station.y - 8}
                    width="52"
                    height="18"
                    rx="3"
                    fill={isFailed ? '#450a0a' : isChecking ? '#312e81' : '#1e1b4b'}
                    stroke={isFailed ? '#ef4444' : isChecking ? '#fbbf24' : '#818cf8'}
                    strokeWidth="1.2"
                  />
                  <text
                    x={station.x}
                    y={station.y + 4}
                    fill={isFailed ? '#fca5a5' : isChecking ? '#fde68a' : '#c7d2fe'}
                    fontSize="7"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {isFailed ? 'OFFLINE' : isChecking ? 'CHECKING' : 'ID VERIFY'}
                  </text>
                </g>
              );
            })}
          </g>

          {/* ─── 4. STAGE 1: TICKET VALIDATION ZONE (Automated NFC / QR Scan) ── */}
          <g id="ticketScanLine">
            {/* Glowing Laser Scan Bar */}
            <rect x="160" y="235" width="540" height="8" rx="2" fill="url(#scanBarGrad)" />
            <line x1="160" y1="239" x2="700" y2="239" stroke="#06b6d4" strokeWidth="2" strokeOpacity="0.8" />
            <text x="430" y="232" fill="#22d3ee" fontSize="8" fontWeight="bold" textAnchor="middle">
              STAGE 1: AUTOMATED NFC / QR SCAN LINE ({ticketScanLatency.toFixed(1)}s Tap Latency)
            </text>

            {scanStations.map((station, idx) => {
              const isFailed = station.status === 'FAILED';
              const isScanning = station.status === 'SCANNING';
              return (
                <g
                  key={station.id}
                  className="cursor-pointer"
                  onClick={() => engineRef.current.toggleScannerFailure(idx)}
                >
                  <circle
                    cx={station.x}
                    cy={station.y}
                    r="8"
                    fill={isFailed ? '#7f1d1d' : isScanning ? '#0891b2' : '#0f766e'}
                    stroke={isFailed ? '#ef4444' : isScanning ? '#22d3ee' : '#14b8a6'}
                    strokeWidth="1.5"
                  />
                  <text x={station.x} y={station.y + 16} fill="#94a3b8" fontSize="7" textAnchor="middle">
                    {isFailed ? 'MALF' : station.id}
                  </text>
                </g>
              );
            })}
          </g>

          {/* ─── 5. HOLDING CONCOURSE & SWITCHBACK S-QUEUES ─────────────────── */}
          {/* Dynamic Ingress Pathway Banner */}
          <rect x="180" y="255" width="500" height="18" rx="3" fill="#0f172a" stroke="#0284c7" strokeWidth="1" />
          <path d="M 195 264 L 665 264" stroke="#0284c7" strokeWidth="1" strokeDasharray="4 4" markerEnd="url(#flowArrow)" />
          <text x="430" y="267" fill="#38bdf8" fontSize="8" fontWeight="bold" textAnchor="middle">
            Pathway: Outer Gate {selectedOuterGateId} ──► Concourse [{connectedInnerGates.join(', ')}] ──► Destination: [
            {destinationStands.join(', ')}]
          </text>

          {/* 20m Permit Limit & Staffing Lines */}
          <line x1="150" y1="285" x2="710" y2="285" stroke="#475569" strokeWidth="1" strokeDasharray="3 3" />
          <text x="140" y="288" fill="#64748b" fontSize="7" textAnchor="end">
            20m Permit Limit
          </text>

          <line x1="150" y1="380" x2="710" y2="380" stroke="#475569" strokeWidth="1" strokeDasharray="3 3" />
          <text x="140" y="383" fill="#64748b" fontSize="7" textAnchor="end">
            15m Staffing Alert
          </text>

          {/* Queue Lane Switchback Barriers */}
          {queueLanes.map((lane) => (
            <g key={lane.laneIndex} id={`lane-${lane.laneIndex}`}>
              {/* Waypoint Track Line */}
              <polyline
                points={lane.waypoints.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke={lane.isCongested ? '#f97316' : '#1e293b'}
                strokeWidth={lane.isCongested ? '22' : '18'}
                strokeOpacity="0.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* S-Curve Physical Barrier Posts */}
              {lane.waypoints.slice(0, -1).map((p, pIdx) => (
                <circle key={pIdx} cx={p.x} cy={p.y} r="2" fill="#475569" />
              ))}

              {/* Lane Entrance Badge */}
              <rect x={lane.startX - 18} y={lane.startY - 4} width="36" height="12" rx="2" fill="#0f172a" stroke="#334155" />
              <text x={lane.startX} y={lane.startY + 5} fill="#94a3b8" fontSize="7" textAnchor="middle">
                Lane {lane.laneIndex + 1}
              </text>
            </g>
          ))}

          {/* ─── 6. LATERAL RECOVERY & DIVERSION CORRIDOR (Rejected Patrons) ─ */}
          <g id="recoveryCorridor">
            {/* Barrier dividing holding pen from recovery exit */}
            <line x1="720" y1="230" x2="720" y2="520" stroke="#e11d48" strokeWidth="2" strokeDasharray="4 2" />
            <rect
              x="730"
              y="240"
              width="160"
              height="270"
              rx="4"
              fill="#881337"
              fillOpacity="0.15"
              stroke="#f43f5e"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            <text x="810" y="258" fill="#fda4af" fontSize="9" fontWeight="bold" textAnchor="middle">
              RECOVERY & EXIT CORRIDOR
            </text>
            <text x="810" y="272" fill="#f43f5e" fontSize="7" textAnchor="middle">
              Rejected Tickets (No Queue Interference)
            </text>
            <path d="M 810 290 L 810 490" stroke="#f43f5e" strokeWidth="2" strokeDasharray="4 4" markerEnd="url(#rerouteArrow)" />
          </g>

          {/* ─── 7. BOTTOM OUTER SECURITY PERIMETER & DEDICATED OUTER GATE ── */}
          {/* Security Fence Wall */}
          <line x1="80" y1="485" x2="720" y2="485" stroke="#475569" strokeWidth="4" />
          <text x="100" y="475" fill="#94a3b8" fontSize="9" fontWeight="bold">
            Outer Security Perimeter Boundary
          </text>

          {/* STRICT GATE VIEW ISOLATION: Display ONLY the selected outer gate */}
          <g id={`outerGatePortal-${selectedOuterGateId}`}>
            {/* Approach flow arrows from public approach road */}
            <path d="M 400 525 L 400 488" stroke="#38bdf8" strokeWidth="3" markerEnd="url(#flowArrow)" />

            {/* Outer Gate Portal Structure */}
            <rect
              x="330"
              y="472"
              width="140"
              height="26"
              rx="4"
              fill="#0369a1"
              stroke="#38bdf8"
              strokeWidth="2"
            />
            <text x="400" y="488" fill="#f0f9ff" fontSize="10" fontWeight="bold" textAnchor="middle">
              OUTER GATE {selectedOuterGateId}
            </text>
            <text x="400" y="508" fill="#38bdf8" fontSize="8" textAnchor="middle">
              Entry Portal
            </text>
          </g>

          {/* Public Approach Roadway (Displays approach road belonging to this gate) */}
          <rect x="60" y="525" width="840" height="40" fill="#0b1120" stroke="#1e293b" />
          <line x1="70" y1="545" x2="890" y2="545" stroke="#334155" strokeWidth="1" strokeDasharray="8 6" />
          <text x="480" y="550" fill="#94a3b8" fontSize="11" fontWeight="bold" textAnchor="middle" letterSpacing="3">
            {gateSpec.road.replace('_', ' ')} (PUBLIC APPROACH)
          </text>

          {/* ─── 8. LIVE PEDESTRIAN AGENTS ─────────────────────────────────── */}
          {agents.map((ag) => {
            const isSelected = selectedAgent?.id === ag.id;
            const color = getAgentColor(ag.state);
            return (
              <g
                key={ag.id}
                className="cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedAgent(ag);
                }}
              >
                {/* Agent Body */}
                <circle
                  cx={ag.x}
                  cy={ag.y}
                  r={isSelected ? 6.5 : ag.radius}
                  fill={color}
                  stroke={isSelected ? '#ffffff' : '#080c14'}
                  strokeWidth={isSelected ? 2 : 1}
                />

                {/* Velocity Direction Vector if moving */}
                {Math.hypot(ag.vx, ag.vy) > 1 && (
                  <line
                    x1={ag.x}
                    y1={ag.y}
                    x2={ag.x + ag.vx * 0.15}
                    y2={ag.y + ag.vy * 0.15}
                    stroke={color}
                    strokeWidth="1.2"
                  />
                )}
              </g>
            );
          })}
        </svg>

        {/* ─── SELECTED AGENT CREDENTIAL INSPECTOR POPUP ───────────────────── */}
        {selectedAgent && (
          <div className="absolute top-3 right-3 p-3 bg-slate-900/95 border border-cyan-500 rounded-lg shadow-xl text-xs space-y-1.5 w-64 z-30 font-mono backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1">
              <span className="font-bold text-cyan-300">Patron #{selectedAgent.id}</span>
              <button
                onClick={() => setSelectedAgent(null)}
                className="text-slate-400 hover:text-slate-200 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Current State:</span>
              <span
                className="font-bold px-1.5 py-0.2 rounded"
                style={{ backgroundColor: `${getAgentColor(selectedAgent.state)}20`, color: getAgentColor(selectedAgent.state) }}
              >
                {selectedAgent.state}
              </span>
            </div>

            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Attendee Name:</span>
              <span className="font-bold text-slate-100">{selectedAgent.attendeeName}</span>
            </div>

            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Ticket Holder:</span>
              <span className="text-slate-300">{selectedAgent.ticketHolderName}</span>
            </div>

            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Person Verification:</span>
              <span
                className={`font-bold ${
                  selectedAgent.personCheckStatus === 'VERIFIED'
                    ? 'text-emerald-400'
                    : selectedAgent.personCheckStatus === 'MISMATCH'
                    ? 'text-rose-400'
                    : 'text-amber-400'
                }`}
              >
                {selectedAgent.personCheckStatus || 'PENDING'}
              </span>
            </div>

            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Synthetic Ticket:</span>
              <span className="font-bold text-slate-200">{selectedAgent.ticket.ticketId}</span>
            </div>

            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Ticket Validation:</span>
              <span
                className={`font-bold ${
                  selectedAgent.ticket.status === 'VALID' ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {selectedAgent.ticket.status}
              </span>
            </div>

            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Target Inner Gate:</span>
              <span className="font-bold text-cyan-400">{selectedAgent.targetInnerGateId}</span>
            </div>

            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Destination Stand:</span>
              <span className="font-bold text-amber-300">{selectedAgent.targetStandName}</span>
            </div>

            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Assigned Counter:</span>
              <span className="font-bold text-slate-200">
                {selectedAgent.assignedTurnstileCounterId || 'Unassigned'}
              </span>
            </div>

            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Wait Duration:</span>
              <span className="font-bold text-slate-300">{selectedAgent.totalWaitTimeSec.toFixed(1)}s</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
