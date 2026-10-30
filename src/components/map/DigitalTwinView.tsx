import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Split,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Layers,
  UserCheck,
  Flame,
  DoorOpen,
  AlertTriangle,
  Compass,
  Grid,
  Info,
  Sliders,
  X,
  ExternalLink,
  Play,
  Pause,
  Activity,
  Users,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  RefreshCw,
} from 'lucide-react';
import { StadiumSide, GateRoutingPolicy, ArrivalPatternType } from '../../types';
import { useSimulationStore, SIDE_GATES } from '../../store/simulationStore';
import { CanvasRenderer } from '../../engine/renderer/CanvasRenderer';
import { distance } from '../../engine/geometry';
import { Gate, Zone } from '../../types';

export const DigitalTwinView: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);

  const {
    currentVenue,
    engine,
    layers,
    toggleLayer,
    detailLevel,
    setDetailLevel,
    selectedGateId,
    selectedZoneId,
    setSelectedGateId,
    setSelectedZoneId,
    updateGate,
    updateZone,
    incidents,
    comparisons,
    activeComparisonId,
    focusedSide,
    setFocusedSide,
    selectedGateIds,
    setSelectedGateIds,
    gateSideConfig,
    updateGateSideConfig,
    applyInitialQueue,
    resetGateSideSim,
    gateSideEvents,
    gateEntryHistory,
    isRunning,
    isPaused,
    startSimulation,
    pauseSimulation,
    resumeSimulation,
    resetSimulation,
    speedMultiplier,
    setSpeedMultiplier,
    simTimeSecs,
  } = useSimulationStore();

  const [activeSideTab, setActiveSideTab] = useState<'CONTROLS' | 'METRICS' | 'LOGS'>('CONTROLS');
  const [initialQueueInput, setInitialQueueInput] = useState<number>(0);

  const activeComparison =
    comparisons.find((c) => c.id === activeComparisonId) ||
    (comparisons.length > 0 ? comparisons[0] : null);

  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Initialize CanvasRenderer
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const renderer = new CanvasRenderer(canvas);
    rendererRef.current = renderer;

    const handleResize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (rect) {
        renderer.resize(rect.width, rect.height);
        if (focusedSide !== 'ALL' && selectedGateIds.length > 0) {
          renderer.fitToGateArea(selectedGateIds, currentVenue, rect.width, rect.height);
        } else {
          renderer.fitToView(currentVenue, rect.width, rect.height);
        }
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [currentVenue.id]);

  // Auto-focus camera when side or gates change
  useEffect(() => {
    if (!rendererRef.current || !canvasRef.current) return;
    const rect = canvasRef.current.parentElement?.getBoundingClientRect();
    if (!rect) return;

    if (focusedSide !== 'ALL' && selectedGateIds.length > 0) {
      rendererRef.current.fitToGateArea(selectedGateIds, currentVenue, rect.width, rect.height);
    } else {
      rendererRef.current.fitToView(currentVenue, rect.width, rect.height);
    }
  }, [focusedSide, selectedGateIds, currentVenue.id]);

  // Render loop
  useEffect(() => {
    let animId: number;

    const renderLoop = () => {
      if (rendererRef.current && canvasRef.current) {
        rendererRef.current.render(
          engine.state.venue,
          engine.state.agents,
          layers,
          detailLevel,
          selectedGateId,
          selectedZoneId,
          engine.state.incidents,
          layers.spatialComparison ? activeComparison?.zoneComparisons : null,
          selectedGateIds
        );
      }
      animId = requestAnimationFrame(renderLoop);
    };

    animId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animId);
  }, [layers, detailLevel, selectedGateId, selectedZoneId, activeComparison, selectedGateIds, focusedSide]);

  // Canvas Mouse Controls (Pan, Zoom, Select)
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !rendererRef.current) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    rendererRef.current.transform.x += dx;
    rendererRef.current.transform.y += dy;
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    setIsDragging(false);

    // If mouse didn't move much, treat as a click selection
    const moveDist = Math.abs(e.clientX - dragStart.x) + Math.abs(e.clientY - dragStart.y);
    if (moveDist < 5 && rendererRef.current && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const clickScreenX = e.clientX - rect.left;
      const clickScreenY = e.clientY - rect.top;
      const worldPos = rendererRef.current.screenToWorld(clickScreenX, clickScreenY);

      // Check Gate hit
      let clickedGate: Gate | null = null;
      for (const g of currentVenue.gates) {
        if (distance(worldPos, g.position) < 5.0) {
          clickedGate = g;
          break;
        }
      }

      if (clickedGate) {
        setSelectedGateId(clickedGate.id);
        setSelectedZoneId(null);
        return;
      }

      // Check Zone hit
      const clickedZone = engine.findZoneForPoint(worldPos);
      if (clickedZone) {
        setSelectedZoneId(clickedZone.id);
        setSelectedGateId(null);
        return;
      }

      // Clear selection if clicked empty space
      setSelectedGateId(null);
      setSelectedZoneId(null);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!rendererRef.current) return;
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    const renderer = rendererRef.current;
    renderer.transform.scale = Math.max(0.8, Math.min(15, renderer.transform.scale * zoomFactor));
  };

  const handleZoomIn = () => {
    if (rendererRef.current) {
      rendererRef.current.transform.scale = Math.min(15, rendererRef.current.transform.scale * 1.25);
    }
  };

  const handleZoomOut = () => {
    if (rendererRef.current) {
      rendererRef.current.transform.scale = Math.max(0.8, rendererRef.current.transform.scale * 0.8);
    }
  };

  const handleFitToView = () => {
    if (rendererRef.current && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      rendererRef.current.fitToView(currentVenue, rect.width, rect.height);
    }
  };

  const handleResetView = () => {
    if (rendererRef.current) {
      rendererRef.current.transform = { x: 40, y: 30, scale: 3.2 };
    }
  };

  const selectedGate = currentVenue.gates.find((g) => g.id === selectedGateId);
  const selectedZone = currentVenue.zones.find((z) => z.id === selectedZoneId);

  const totalVenueAdmitted = currentVenue.gates.reduce(
    (sum, g) => sum + (g.admittedCount || g.totalProcessedCount || 0),
    0
  );
  const totalVenueQueuing = currentVenue.gates.reduce((sum, g) => sum + g.currentQueue, 0);

  const focusedGates = currentVenue.gates.filter((g) => selectedGateIds.includes(g.id));
  const primaryGate = focusedGates[0] || selectedGate;
  const totalFocusedQueue = focusedGates.reduce((acc, g) => acc + g.currentQueue, 0);
  const maxFocusedQueue = Math.max(0, ...focusedGates.map((g) => g.maxQueueRecorded || g.currentQueue));
  const totalFocusedActiveScanners = focusedGates.reduce((acc, g) => acc + g.operationalScanners, 0);
  const totalFocusedMaxScanners = focusedGates.reduce((acc, g) => acc + g.scannerCount, 0);
  const ratePerSec = gateSideConfig.processingRatePerSec;
  const totalProcessingCapPerMin = Math.round(ratePerSec * totalFocusedActiveScanners * 60);
  const netRatePerMin = gateSideConfig.inflowRatePerMin - totalProcessingCapPerMin;
  const estWaitMins = totalProcessingCapPerMin > 0 ? (totalFocusedQueue / totalProcessingCapPerMin) : 0;
  const totalSpillback = focusedGates.reduce((acc, g) => acc + (g.spillbackCount || 0), 0);
  const totalArrivals = focusedGates.reduce((acc, g) => acc + (g.totalArrivalsCount || 0), 0);
  const totalProcessed = focusedGates.reduce((acc, g) => acc + (g.admittedCount || g.totalProcessedCount || 0), 0);

  // Overall metrics across focused gates
  const gateWithHighestQueue = [...focusedGates].sort((a, b) => b.currentQueue - a.currentQueue)[0] || primaryGate;
  const gateWithHighestEntries = [...focusedGates].sort(
    (a, b) => (b.admittedCount || b.totalProcessedCount || 0) - (a.admittedCount || a.totalProcessedCount || 0)
  )[0] || primaryGate;
  const gateWithLongestWait = [...focusedGates].sort((a, b) => b.queueWaitTimeSecs - a.queueWaitTimeSecs)[0] || primaryGate;

  const activeAgents = engine.state.agents;
  const totalApproaching = activeAgents.filter((a) => a.state === 'APPROACHING').length;
  const totalQueuingAgents = activeAgents.filter((a) => a.state === 'QUEUING').length;
  const totalProcessingAgents = activeAgents.filter((a) => a.state === 'PROCESSING').length;
  const totalWaitingOutside = totalApproaching + totalQueuingAgents;

  return (
    <div className="relative w-full h-[calc(100vh-4rem)] bg-navy-950 overflow-hidden flex flex-col">
      {/* Stadium Side & Focused Gate-Side Simulation Selector Bar */}
      <div className="bg-navy-900 border-b border-navy-700 px-4 py-2 flex flex-wrap items-center justify-between gap-2.5 text-xs shrink-0 z-20 shadow-md">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider shrink-0 flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            Simulation Focus:
          </span>

          <div className="flex items-center gap-1 bg-navy-950 p-1 rounded-xl border border-navy-800">
            <button
              onClick={() => {
                setFocusedSide('ALL');
                if (rendererRef.current && canvasRef.current) {
                  const rect = canvasRef.current.parentElement?.getBoundingClientRect();
                  if (rect) rendererRef.current.fitToView(currentVenue, rect.width, rect.height);
                }
              }}
              className={`px-3 py-1 rounded-lg font-bold transition flex items-center gap-1.5 ${
                focusedSide === 'ALL'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Maximize2 className="w-3 h-3" />
              <span>Full Stadium (21 Gates)</span>
            </button>

            <button
              onClick={() => setFocusedSide('NORTH')}
              className={`px-3 py-1 rounded-lg font-bold transition ${
                focusedSide === 'NORTH'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              North (Gates 1-5)
            </button>

            <button
              onClick={() => setFocusedSide('WEST')}
              className={`px-3 py-1 rounded-lg font-bold transition ${
                focusedSide === 'WEST'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              West (Gates 6-10)
            </button>

            <button
              onClick={() => setFocusedSide('SOUTH')}
              className={`px-3 py-1 rounded-lg font-bold transition ${
                focusedSide === 'SOUTH'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              South (Gates 11-16)
            </button>

            <button
              onClick={() => setFocusedSide('EAST')}
              className={`px-3 py-1 rounded-lg font-bold transition ${
                focusedSide === 'EAST'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              East (Gates 17-21)
            </button>
          </div>
        </div>

        {/* Focused Gate Controls & Return to Full Stadium Button */}
        <div className="flex items-center gap-2">
          {focusedSide !== 'ALL' && (
            <button
              onClick={() => {
                setFocusedSide('ALL');
                if (rendererRef.current && canvasRef.current) {
                  const rect = canvasRef.current.parentElement?.getBoundingClientRect();
                  if (rect) rendererRef.current.fitToView(currentVenue, rect.width, rect.height);
                }
              }}
              className="px-3 py-1.5 rounded-xl bg-navy-800 hover:bg-navy-700 border border-cyan-500/50 text-cyan-300 font-bold transition flex items-center gap-1.5 shadow"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Return to Full Stadium</span>
            </button>
          )}

          {/* Live Admitted Total Counter Pill */}
          <div className="flex items-center gap-2 bg-navy-950 px-3 py-1 rounded-xl border border-emerald-500/40 text-xs shadow-inner">
            <span className="flex items-center gap-1 font-bold text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Admitted:</span>
              <span className="font-mono text-white text-sm">
                {totalVenueAdmitted.toLocaleString()}
              </span>
            </span>
            <span className="text-slate-600">|</span>
            <span className="flex items-center gap-1 text-slate-300">
              <span>Outside Queue:</span>
              <span className="font-mono font-bold text-amber-400">
                {totalVenueQueuing.toLocaleString()}
              </span>
            </span>
          </div>

          {/* Clock Display */}
          <div className="flex items-center gap-1.5 bg-navy-950 px-2.5 py-1 rounded-xl border border-navy-800 font-mono text-[11px]">
            <Clock className="w-3 h-3 text-cyan-400" />
            <span className="text-slate-400">Time:</span>
            <span className="font-bold text-cyan-300">
              {Math.floor(simTimeSecs / 60).toString().padStart(2, '0')}:{(simTimeSecs % 60).toString().padStart(2, '0')}
            </span>
          </div>

          {/* Play/Pause Button */}
          <button
            onClick={() =>
              isRunning && !isPaused ? pauseSimulation() : isRunning ? resumeSimulation() : startSimulation()
            }
            className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 shadow ${
              isRunning && !isPaused
                ? 'bg-amber-600 hover:bg-amber-500 text-white'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            {isRunning && !isPaused ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            <span>{isRunning && !isPaused ? 'Pause' : isRunning ? 'Resume' : 'Run'}</span>
          </button>
        </div>
      </div>

      <div className="relative flex-1 w-full h-full overflow-hidden flex">
        {/* Canvas Viewport */}
        <div className="relative flex-1 h-full">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
          className="w-full h-full cursor-grab active:cursor-grabbing block"
        />

        {/* Floating Map Toolbar (Top Left) */}
        <div className="absolute top-4 left-4 flex items-center gap-2 z-10">
          <div className="bg-navy-850/90 backdrop-blur-md border border-navy-600 rounded-xl p-1 flex items-center gap-1 shadow-xl">
            <button
              onClick={handleZoomIn}
              title="Zoom In"
              className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-navy-700 transition"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={handleZoomOut}
              title="Zoom Out"
              className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-navy-700 transition"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={handleFitToView}
              title="Fit to View"
              className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-navy-700 transition"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleResetView}
              title="Reset View"
              className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-navy-700 transition"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {/* Spatial Comparison Quick Toggle */}
          <button
            onClick={() => toggleLayer('spatialComparison')}
            title={
              activeComparison
                ? 'Toggle Zone-by-Zone Congestion Comparison Overlay'
                : 'Run a Counterfactual Test in Scenario Lab first to view spatial comparison'
            }
            className={`backdrop-blur-md border rounded-xl px-3 py-2 text-xs font-semibold flex items-center gap-2 shadow-xl transition ${
              layers.spatialComparison
                ? 'bg-violet-600/90 text-white border-violet-400 ring-2 ring-violet-500/40'
                : 'bg-navy-850/90 text-slate-300 hover:text-white border-navy-600 hover:border-navy-500'
            }`}
          >
            <Split className="w-4 h-4 text-violet-400" />
            <span>Spatial Diff {layers.spatialComparison ? '(ON)' : ''}</span>
            {activeComparison && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </button>

          {/* Layer Menu Button */}
          <div className="relative">
            <button
              onClick={() => setShowLayerMenu(!showLayerMenu)}
              className="bg-navy-850/90 backdrop-blur-md border border-navy-600 rounded-xl px-3 py-2 text-xs font-semibold text-slate-200 hover:text-white flex items-center gap-2 shadow-xl hover:border-navy-500 transition"
            >
              <Layers className="w-4 h-4 text-cyan-400" />
              <span>Layers</span>
            </button>

            {showLayerMenu && (
              <div className="absolute top-12 left-0 w-64 bg-navy-850/95 backdrop-blur-lg border border-navy-600 rounded-xl p-3 shadow-2xl z-30 space-y-2">
                <div className="flex justify-between items-center border-b border-navy-700 pb-1.5">
                  <span className="text-xs font-bold text-slate-200">Map Visualization Layers</span>
                  <button
                    onClick={() => setShowLayerMenu(false)}
                    className="text-slate-400 hover:text-white text-xs"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-1 text-xs">
                  {[
                    { key: 'venueLayout', label: 'Venue Layout' },
                    { key: 'animatedCrowd', label: 'Animated Crowd (People)' },
                    { key: 'densityHeatmap', label: 'Density Heatmap' },
                    { key: 'spatialComparison', label: 'Spatial Delta & New Hotspots' },
                    { key: 'flowArrows', label: 'Movement Flow Arrows' },
                    { key: 'queueVisuals', label: 'Entrance Queues' },
                    { key: 'gateStatus', label: 'Gate Status Badges' },
                    { key: 'emergencyRoutes', label: 'Emergency Routes' },
                    { key: 'incidentMarkers', label: 'Incident Markers' },
                    { key: 'riskZones', label: 'Risk Zones Shading' },
                    { key: 'gridReference', label: 'Grid Reference & Scale' },
                  ].map(({ key, label }) => (
                    <label
                      key={key}
                      className="flex items-center justify-between p-1.5 rounded hover:bg-navy-800 cursor-pointer"
                    >
                      <span className="text-slate-300">{label}</span>
                      <input
                        type="checkbox"
                        checked={layers[key as keyof typeof layers]}
                        onChange={() => toggleLayer(key as keyof typeof layers)}
                        className="rounded border-navy-600 text-cyan-500 focus:ring-cyan-500 bg-navy-950"
                      />
                    </label>
                  ))}
                </div>

                <div className="border-t border-navy-700 pt-2">
                  <span className="text-[11px] font-bold text-slate-400 block mb-1">Pedestrian Detail Level</span>
                  <div className="grid grid-cols-3 gap-1">
                    {(['DETAILED', 'SIMPLIFIED', 'DENSITY_ONLY'] as const).map((lvl) => (
                      <button
                        key={lvl}
                        onClick={() => setDetailLevel(lvl)}
                        className={`text-[10px] py-1 rounded font-medium transition ${
                          detailLevel === lvl
                            ? 'bg-cyan-600 text-white font-bold'
                            : 'bg-navy-900 text-slate-400 hover:text-white'
                        }`}
                      >
                        {lvl === 'DETAILED' ? 'Detailed' : lvl === 'SIMPLIFIED' ? 'Dots' : 'Heatmap'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Legend Overlay */}
        <div className="absolute bottom-4 left-4 bg-navy-850/85 backdrop-blur-md border border-navy-700 rounded-xl p-2.5 shadow-xl text-xs flex items-center gap-4 text-slate-300">
          <span className="font-bold text-[11px] text-slate-400 uppercase tracking-wider">Density:</span>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-[11px]">&lt; 1.5 p/m² (Normal)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <span className="text-[11px]">1.5 - 2.2 (Watch)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span className="text-[11px]">2.2 - 3.0 (Congested)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[11px]">&gt; 3.0 p/m² (Critical)</span>
          </div>
        </div>
      </div>

      {/* Right Properties & Gate-Side Simulation Control Dashboard */}
      <div className="w-88 md:w-[420px] bg-navy-850 border-l border-navy-600 h-full overflow-y-auto p-4 flex flex-col justify-between shrink-0 select-none z-10 space-y-4">
        <div>
          {/* FOCUSED GATE-SIDE SIMULATION PANEL */}
          {focusedSide !== 'ALL' || selectedGateIds.length > 0 ? (
            <div className="space-y-4 text-xs">
              {/* Header Card */}
              <div className="p-3.5 bg-navy-900 border border-cyan-500/30 rounded-xl space-y-2 shadow-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <DoorOpen className="w-4 h-4 text-cyan-400" />
                      <h3 className="font-extrabold text-slate-100 text-base">
                        {focusedSide !== 'CUSTOM' ? `${focusedSide} SIDE SIMULATION` : 'CUSTOM GATE GROUP'}
                      </h3>
                    </div>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      {focusedGates.length} Gate{focusedGates.length > 1 ? 's' : ''} Selected ({focusedGates.map((g) => g.name).join(', ')})
                    </span>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      focusedGates.some((g) => g.warningLevel === 'CRITICAL')
                        ? 'bg-red-950 text-red-300 border-red-700 animate-pulse'
                        : focusedGates.some((g) => g.warningLevel === 'HIGH')
                          ? 'bg-amber-950 text-amber-300 border-amber-700'
                          : 'bg-emerald-950 text-emerald-300 border-emerald-700'
                    }`}
                  >
                    {focusedGates.every((g) => g.status === 'OPERATIONAL') ? 'OPERATIONAL' : 'ACTIVE SIMULATION'}
                  </span>
                </div>

                {/* Gate Selection Pills */}
                <div className="flex flex-wrap gap-1 pt-1 border-t border-navy-800">
                  {SIDE_GATES[focusedSide !== 'CUSTOM' ? focusedSide : 'NORTH'].map((gid) => {
                    const isChecked = selectedGateIds.includes(gid);
                    const gateName = currentVenue.gates.find((g) => g.id === gid)?.name || gid;
                    return (
                      <button
                        key={gid}
                        onClick={() => {
                          const next = isChecked
                            ? selectedGateIds.filter((id) => id !== gid)
                            : [...selectedGateIds, gid];
                          setSelectedGateIds(next);
                        }}
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition ${
                          isChecked
                            ? 'bg-cyan-600 text-white border-cyan-400'
                            : 'bg-navy-950 text-slate-400 border-navy-700 hover:text-slate-200'
                        }`}
                      >
                        {gateName}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sub-Tabs: Controls, Live Metrics, Event Log */}
              <div className="flex items-center gap-1 bg-navy-950 p-1 rounded-xl border border-navy-700">
                <button
                  onClick={() => setActiveSideTab('CONTROLS')}
                  className={`flex-1 py-1.5 rounded-lg font-bold text-center transition ${
                    activeSideTab === 'CONTROLS'
                      ? 'bg-cyan-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Inflow &amp; Capacity
                </button>
                <button
                  onClick={() => setActiveSideTab('METRICS')}
                  className={`flex-1 py-1.5 rounded-lg font-bold text-center transition ${
                    activeSideTab === 'METRICS'
                      ? 'bg-cyan-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Live Metrics
                </button>
                <button
                  onClick={() => setActiveSideTab('LOGS')}
                  className={`flex-1 py-1.5 rounded-lg font-bold text-center transition ${
                    activeSideTab === 'LOGS'
                      ? 'bg-cyan-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Event Log ({gateSideEvents.length})
                </button>
              </div>

              {/* TAB 1: INFLOW & CAPACITY CONTROLS */}
              {activeSideTab === 'CONTROLS' && (
                <div className="space-y-3.5">
                  {/* Inflow Rate Control Card */}
                  <div className="p-3 bg-navy-900 border border-navy-700 rounded-xl space-y-2.5">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-200 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-cyan-400" />
                        Pedestrian Inflow Rate
                      </span>
                      <span className="font-mono font-bold text-cyan-300 text-sm">
                        {gateSideConfig.inflowRatePerMin}{' '}
                        <span className="text-[10px] font-normal text-slate-400">ppl/min</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="10"
                        max="600"
                        step="10"
                        value={gateSideConfig.inflowRatePerMin}
                        onChange={(e) => updateGateSideConfig({ inflowRatePerMin: Number(e.target.value) })}
                        className="flex-1 accent-cyan-500 cursor-pointer"
                      />
                      <input
                        type="number"
                        min="10"
                        max="1000"
                        value={gateSideConfig.inflowRatePerMin}
                        onChange={(e) => updateGateSideConfig({ inflowRatePerMin: Number(e.target.value) })}
                        className="w-16 bg-navy-950 border border-navy-700 rounded px-1.5 py-0.5 text-cyan-300 font-mono text-center"
                      />
                    </div>

                    {/* Quick Inflow Presets */}
                    <div className="grid grid-cols-4 gap-1 text-[10px]">
                      {[
                        { label: '60/min', val: 60 },
                        { label: '100/min', val: 100 },
                        { label: '200/min', val: 200 },
                        { label: '350/min', val: 350 },
                      ].map((preset) => (
                        <button
                          key={preset.val}
                          onClick={() => updateGateSideConfig({ inflowRatePerMin: preset.val })}
                          className={`py-1 rounded border transition font-medium ${
                            gateSideConfig.inflowRatePerMin === preset.val
                              ? 'bg-cyan-950 text-cyan-300 border-cyan-700 font-bold'
                              : 'bg-navy-950 text-slate-400 border-navy-800 hover:text-white'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>

                    {/* Arrival Pattern Selector */}
                    <div className="pt-2 border-t border-navy-800">
                      <label className="text-[11px] text-slate-400 block mb-1">Arrival Wave Pattern:</label>
                      <select
                        value={gateSideConfig.arrivalPattern}
                        onChange={(e) =>
                          updateGateSideConfig({ arrivalPattern: e.target.value as ArrivalPatternType })
                        }
                        className="w-full bg-navy-950 border border-navy-700 rounded-lg px-2 py-1 text-slate-200 text-xs focus:outline-none"
                      >
                        <option value="GRADUAL">Gradual Consistent Inflow</option>
                        <option value="PEAK_SURGE">Peak Surge Curve</option>
                        <option value="BURST">Periodic Burst Waves</option>
                        <option value="TRANSPORT_PULSE">Metro Transit Pulses</option>
                      </select>
                    </div>
                  </div>

                  {/* Processing Capacity Control Card */}
                  <div className="p-3 bg-navy-900 border border-navy-700 rounded-xl space-y-2.5">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-200 flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 text-emerald-400" />
                        Ticket-Processing Capacity
                      </span>
                      <span className="font-mono font-bold text-emerald-400 text-sm">
                        {totalProcessingCapPerMin}{' '}
                        <span className="text-[10px] font-normal text-slate-400">ppl/min</span>
                      </span>
                    </div>

                    {/* Theoretical Formula Box */}
                    <div className="bg-navy-950 p-2 rounded-lg border border-navy-800 text-[11px] space-y-1">
                      <div className="flex justify-between text-slate-400">
                        <span>Speed per Counter:</span>
                        <strong className="text-cyan-300 font-mono">
                          {ratePerSec.toFixed(1)} person/sec ({Math.round(ratePerSec * 60)} ppl/min)
                        </strong>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Active Counters:</span>
                        <strong className="text-slate-200 font-mono">
                          {totalFocusedActiveScanners} / {totalFocusedMaxScanners} lanes
                        </strong>
                      </div>
                      <div className="pt-1 border-t border-navy-800 text-[10px] text-slate-400">
                        Formula: {ratePerSec.toFixed(1)} p/s × {totalFocusedActiveScanners} counters × 60 ={' '}
                        <strong className="text-emerald-300 font-mono">{totalProcessingCapPerMin} ppl/min</strong>
                      </div>
                    </div>

                    {/* Counter Speed Slider */}
                    <div>
                      <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                        <span>Processing Speed per Counter:</span>
                        <span className="font-mono text-cyan-300">{ratePerSec.toFixed(1)} person/sec</span>
                      </div>
                      <input
                        type="range"
                        min="0.2"
                        max="3.0"
                        step="0.1"
                        value={gateSideConfig.processingRatePerSec}
                        onChange={(e) => updateGateSideConfig({ processingRatePerSec: Number(e.target.value) })}
                        className="w-full accent-cyan-500 cursor-pointer"
                      />
                    </div>

                    {/* Active Scanners Slider */}
                    <div>
                      <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                        <span>Active Counters in Gate Group:</span>
                        <span className="font-mono text-slate-200">
                          {totalFocusedActiveScanners} operational
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max={totalFocusedMaxScanners}
                        value={totalFocusedActiveScanners}
                        onChange={(e) =>
                          updateGateSideConfig({ operationalScannersOverride: Number(e.target.value) })
                        }
                        className="w-full accent-emerald-500 cursor-pointer"
                      />
                    </div>

                    {/* Quick Tactical Fault Actions */}
                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                      <button
                        onClick={() => {
                          const target = focusedGates[0];
                          if (target) {
                            const newCount = Math.max(0, target.operationalScanners - 1);
                            updateGate(target.id, {
                              operationalScanners: newCount,
                              status: newCount === 0 ? 'SCANNER_FAILURE' : 'BUSY',
                            });
                            engine.logGateSideEvent('COUNTER_FAILURE', `Scanner counter offline at ${target.name} (Active: ${newCount})`);
                          }
                        }}
                        className="py-1 px-2 rounded-lg bg-amber-950/80 hover:bg-amber-900 border border-amber-700/60 text-amber-200 font-semibold text-[11px] transition text-center"
                      >
                        Fail 1 Counter
                      </button>

                      <button
                        onClick={() => {
                          focusedGates.forEach((g) => {
                            updateGate(g.id, {
                              operationalScanners: g.scannerCount,
                              status: 'OPERATIONAL',
                            });
                          });
                          engine.logGateSideEvent('COUNTER_RESTORED', 'All scanner counters restored to full operation');
                        }}
                        className="py-1 px-2 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700/60 text-emerald-200 font-semibold text-[11px] transition text-center"
                      >
                        Restore Counters
                      </button>

                      <button
                        onClick={() => {
                          const target = focusedGates[0];
                          if (target) {
                            const isClosed = target.direction === 'CLOSED';
                            updateGate(target.id, {
                              direction: isClosed ? 'ENTRY' : 'CLOSED',
                              status: isClosed ? 'OPERATIONAL' : 'TEMPORARILY_CLOSED',
                            });
                            engine.logGateSideEvent(
                              isClosed ? 'GATE_OPENED' : 'GATE_CLOSED',
                              `${target.name} ${isClosed ? 'reopened for admission' : 'closed by operator'}`
                            );
                          }
                        }}
                        className="py-1 px-2 rounded-lg bg-red-950/80 hover:bg-red-900 border border-red-700/60 text-red-200 font-semibold text-[11px] transition text-center"
                      >
                        {primaryGate?.direction === 'CLOSED' ? 'Reopen Gate' : 'Close Gate'}
                      </button>

                      <button
                        onClick={() => resetGateSideSim()}
                        className="py-1 px-2 rounded-lg bg-navy-800 hover:bg-navy-700 border border-navy-700 text-slate-300 font-semibold text-[11px] transition text-center flex items-center justify-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Reset Queues</span>
                      </button>
                    </div>
                  </div>

                  {/* Initial Queue Input Card */}
                  <div className="p-3 bg-navy-900 border border-navy-700 rounded-xl space-y-2">
                    <span className="font-bold text-slate-200 block">Initial Waiting Queue</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max="2000"
                        step="10"
                        value={initialQueueInput}
                        onChange={(e) => setInitialQueueInput(Number(e.target.value))}
                        className="w-24 bg-navy-950 border border-navy-700 rounded-lg px-2 py-1 text-slate-200 font-mono text-xs focus:outline-none"
                      />
                      <button
                        onClick={() => applyInitialQueue(initialQueueInput)}
                        className="flex-1 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 font-bold text-white text-xs transition"
                      >
                        Apply Initial Queue
                      </button>
                    </div>
                  </div>

                  {/* Routing Policy (when multiple gates selected) */}
                  {focusedGates.length > 1 && (
                    <div className="p-3 bg-navy-900 border border-navy-700 rounded-xl space-y-2">
                      <span className="font-bold text-slate-200 block">Multi-Gate Inflow Routing Policy</span>
                      <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                        {[
                          { id: 'SHORTEST_QUEUE', label: 'Shortest Queue' },
                          { id: 'LEAST_WAIT_TIME', label: 'Lowest Wait Time' },
                          { id: 'ROUTE_AWARE', label: 'Route & Concourse Aware' },
                          { id: 'FIXED_ALLOCATION', label: 'Fixed Split' },
                        ].map((policy) => (
                          <button
                            key={policy.id}
                            onClick={() =>
                              updateGateSideConfig({ routingPolicy: policy.id as GateRoutingPolicy })
                            }
                            className={`p-1.5 rounded-lg border text-left transition ${
                              gateSideConfig.routingPolicy === policy.id
                                ? 'bg-cyan-950 text-cyan-300 border-cyan-600 font-bold'
                                : 'bg-navy-950 text-slate-400 border-navy-800 hover:text-white'
                            }`}
                          >
                            {policy.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: LIVE ENTRY ANALYTICS & GATE-WISE COUNTERS */}
              {activeSideTab === 'METRICS' && (
                <div className="space-y-3.5">
                  {/* Scope Admitted Summary Banner */}
                  <div className="p-3.5 bg-gradient-to-r from-emerald-950/70 via-navy-900 to-cyan-950/70 border border-emerald-500/50 rounded-2xl shadow-lg space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Successful Gate Entries
                        </span>
                        <h4 className="text-xl font-extrabold text-white font-mono mt-0.5">
                          {totalProcessed.toLocaleString()}{' '}
                          <span className="text-xs font-normal text-emerald-300">people admitted</span>
                        </h4>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block">All 21 Venue Gates</span>
                        <span className="font-mono font-bold text-slate-200 text-xs">
                          {totalVenueAdmitted.toLocaleString()} admitted
                        </span>
                      </div>
                    </div>

                    {/* Mass-Balance Formula Banner */}
                    <div className="pt-2 border-t border-navy-800/80 text-[10px] text-slate-300 space-y-1">
                      <div className="flex justify-between text-slate-400 font-mono">
                        <span>Generated: <strong className="text-slate-100">{totalArrivals}</strong></span>
                        <span>= Wait: <strong className="text-amber-300">{totalWaitingOutside}</strong> + Proc: <strong className="text-cyan-300">{totalProcessingAgents}</strong> + In: <strong className="text-emerald-300">{totalProcessed}</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5 text-emerald-300">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>100% Mass Conserved: Admitted pedestrians removed from outside view.</span>
                      </div>
                    </div>
                  </div>

                  {/* Overall Gate-Wise Entry Performance Summary Card */}
                  <div className="p-3 bg-navy-900 border border-navy-700 rounded-xl space-y-2 text-xs">
                    <span className="font-bold text-slate-200 block text-[11px] uppercase tracking-wider">
                      Overall Gate Performance Summary
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-navy-950 p-2 rounded-lg border border-navy-800">
                        <span className="text-[10px] text-slate-400 block">Total Processing Cap</span>
                        <span className="font-mono font-bold text-emerald-400 text-sm">
                          {totalProcessingCapPerMin} ppl/min
                        </span>
                      </div>
                      <div className="bg-navy-950 p-2 rounded-lg border border-navy-800">
                        <span className="text-[10px] text-slate-400 block">Current Waiting Outside</span>
                        <span className="font-mono font-bold text-amber-400 text-sm">
                          {totalFocusedQueue} people
                        </span>
                      </div>
                      <div className="bg-navy-950 p-2 rounded-lg border border-navy-800">
                        <span className="text-[10px] text-slate-400 block">Highest Queue Gate</span>
                        <span className="font-mono font-bold text-slate-200 truncate block">
                          {gateWithHighestQueue?.name || 'None'} ({gateWithHighestQueue?.currentQueue || 0} ppl)
                        </span>
                      </div>
                      <div className="bg-navy-950 p-2 rounded-lg border border-navy-800">
                        <span className="text-[10px] text-slate-400 block">Highest Entry Gate</span>
                        <span className="font-mono font-bold text-cyan-300 truncate block">
                          {gateWithHighestEntries?.name || 'None'} ({(gateWithHighestEntries?.admittedCount || gateWithHighestEntries?.totalProcessedCount || 0).toLocaleString()})
                        </span>
                      </div>
                    </div>
                    {gateWithLongestWait && (
                      <div className="text-[10px] text-slate-400 flex justify-between pt-1 border-t border-navy-800">
                        <span>Longest Current Wait:</span>
                        <strong className="text-amber-400 font-mono">
                          {gateWithLongestWait.name} (~{Math.round(gateWithLongestWait.queueWaitTimeSecs / 60)} mins)
                        </strong>
                      </div>
                    )}
                  </div>

                  {/* Cumulative Admissions Over Simulation Time SVG Chart */}
                  <div className="p-3 bg-navy-900 border border-navy-700 rounded-xl space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 text-cyan-400" />
                        Cumulative Admissions Over Time
                      </span>
                      <span className="font-mono text-[10px] text-slate-400">
                        {gateEntryHistory.length} data points
                      </span>
                    </div>

                    {gateEntryHistory.length > 1 ? (
                      <div className="bg-navy-950 p-2 rounded-lg border border-navy-800">
                        <svg viewBox="0 0 340 120" className="w-full h-28 overflow-visible">
                          {/* Grid horizontal lines */}
                          <line x1="30" y1="15" x2="330" y2="15" stroke="#1E293B" strokeWidth="0.8" strokeDasharray="2,2" />
                          <line x1="30" y1="55" x2="330" y2="55" stroke="#1E293B" strokeWidth="0.8" strokeDasharray="2,2" />
                          <line x1="30" y1="95" x2="330" y2="95" stroke="#334155" strokeWidth="1" />

                          {/* Y-axis labels */}
                          {(() => {
                            const maxY = Math.max(10, ...gateEntryHistory.map((h) => h.totalAdmitted));
                            const midY = Math.round(maxY / 2);
                            const minTime = gateEntryHistory[0].timestamp;
                            const maxTime = gateEntryHistory[gateEntryHistory.length - 1].timestamp;
                            const timeSpan = Math.max(1, maxTime - minTime);

                            const GATE_COLORS = ['#22D3EE', '#3B82F6', '#10B981', '#F59E0B', '#A855F7', '#EC4899'];

                            return (
                              <g>
                                <text x="24" y="18" fill="#64748B" fontSize="8" textAnchor="end" fontFamily="monospace">
                                  {maxY}
                                </text>
                                <text x="24" y="58" fill="#64748B" fontSize="8" textAnchor="end" fontFamily="monospace">
                                  {midY}
                                </text>
                                <text x="24" y="98" fill="#64748B" fontSize="8" textAnchor="end" fontFamily="monospace">
                                  0
                                </text>

                                {/* Time labels */}
                                <text x="30" y="112" fill="#64748B" fontSize="8" fontFamily="monospace">
                                  {gateEntryHistory[0].timeFormatted}
                                </text>
                                <text x="330" y="112" fill="#64748B" fontSize="8" textAnchor="end" fontFamily="monospace">
                                  {gateEntryHistory[gateEntryHistory.length - 1].timeFormatted}
                                </text>

                                {/* Draw lines for each focused gate */}
                                {focusedGates.map((gate, gIdx) => {
                                  const color = GATE_COLORS[gIdx % GATE_COLORS.length];
                                  const points = gateEntryHistory.map((h) => {
                                    const count = h.gateEntries[gate.id] || 0;
                                    const px = 30 + ((h.timestamp - minTime) / timeSpan) * 300;
                                    const py = 95 - (count / maxY) * 80;
                                    return `${px.toFixed(1)},${py.toFixed(1)}`;
                                  }).join(' ');

                                  return (
                                    <polyline
                                      key={gate.id}
                                      points={points}
                                      fill="none"
                                      stroke={color}
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                  );
                                })}
                              </g>
                            );
                          })()}
                        </svg>

                        {/* Chart Legend */}
                        <div className="flex flex-wrap gap-2 pt-2 border-t border-navy-800 text-[10px]">
                          {focusedGates.map((gate, gIdx) => {
                            const GATE_COLORS = ['#22D3EE', '#3B82F6', '#10B981', '#F59E0B', '#A855F7', '#EC4899'];
                            const color = GATE_COLORS[gIdx % GATE_COLORS.length];
                            const count = gate.admittedCount || gate.totalProcessedCount || 0;
                            return (
                              <div key={gate.id} className="flex items-center gap-1">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                                <span className="text-slate-300 font-medium">{gate.name}:</span>
                                <span className="font-mono font-bold text-white">{count}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-navy-950 rounded-lg border border-navy-800 text-center text-slate-500 text-xs italic">
                        Accumulating real-time admission telemetry as simulation advances...
                      </div>
                    )}
                  </div>

                  {/* Per-Gate Live Entry Counters List */}
                  <div className="space-y-2">
                    <span className="font-bold text-slate-200 block text-xs flex items-center justify-between">
                      <span>Gate-Wise Live Entry Counters ({focusedGates.length})</span>
                      <span className="text-[10px] text-slate-400 font-normal">Real-time turnstile telemetry</span>
                    </span>

                    {focusedGates.map((g) => {
                      const admitted = g.admittedCount || g.totalProcessedCount || 0;
                      const scannerRate = g.scannerProcessingRatePerSec !== undefined ? g.scannerProcessingRatePerSec : (g.scannerProcessingRatePerMin ? g.scannerProcessingRatePerMin / 60 : 1.0);
                      const effCap = g.effectiveCapacityPerMin || Math.round(g.operationalScanners * scannerRate * 60);
                      const actualProc = g.actualProcessingRatePerMin !== undefined ? g.actualProcessingRatePerMin : (g.currentQueue > 0 ? effCap : 0);
                      const arrivalRate = g.currentArrivalRatePerMin || 0;
                      const util = g.counterUtilizationPercent || (g.scannerCount > 0 ? Math.round((g.operationalScanners / g.scannerCount) * 100) : 0);

                      return (
                        <div
                          key={g.id}
                          className="p-3 bg-navy-900 border border-navy-700 hover:border-cyan-500/40 rounded-xl space-y-2 text-xs transition"
                        >
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-1.5">
                              <DoorOpen className="w-3.5 h-3.5 text-cyan-400" />
                              <strong className="text-slate-100 text-sm">{g.name}</strong>
                            </div>
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                                g.direction === 'CLOSED' || g.status === 'TEMPORARILY_CLOSED'
                                  ? 'bg-red-950 text-red-300 border-red-800'
                                  : g.status === 'SCANNER_FAILURE'
                                    ? 'bg-amber-950 text-amber-300 border-amber-800'
                                    : 'bg-emerald-950 text-emerald-300 border-emerald-800'
                              }`}
                            >
                              {g.status}
                            </span>
                          </div>

                          {/* Primary Metric: Successful Entry Count */}
                          <div className="p-2 bg-navy-950 rounded-lg border border-navy-800 flex justify-between items-center">
                            <div>
                              <span className="text-[10px] text-slate-400 block">Total People Admitted</span>
                              <span className="font-mono text-base font-extrabold text-emerald-400">
                                {admitted.toLocaleString()}{' '}
                                <span className="text-[10px] font-normal text-slate-300">entered</span>
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] text-slate-400 block">Current Queue</span>
                              <span className="font-mono text-base font-bold text-amber-300">
                                {g.currentQueue}{' '}
                                <span className="text-[10px] font-normal text-slate-400">waiting</span>
                              </span>
                            </div>
                          </div>

                          {/* Operational Specs Grid */}
                          <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-300">
                            <div className="flex justify-between bg-navy-950/60 px-2 py-1 rounded border border-navy-800/60">
                              <span className="text-slate-400">Est. Wait:</span>
                              <span className="font-mono font-bold text-amber-300">~{Math.round(g.queueWaitTimeSecs / 60)}m</span>
                            </div>
                            <div className="flex justify-between bg-navy-950/60 px-2 py-1 rounded border border-navy-800/60">
                              <span className="text-slate-400">Arrival Rate:</span>
                              <span className="font-mono text-cyan-300">{arrivalRate} ppl/m</span>
                            </div>
                            <div className="flex justify-between bg-navy-950/60 px-2 py-1 rounded border border-navy-800/60">
                              <span className="text-slate-400">Actual Process:</span>
                              <span className="font-mono text-emerald-300">{actualProc} ppl/m</span>
                            </div>
                            <div className="flex justify-between bg-navy-950/60 px-2 py-1 rounded border border-navy-800/60">
                              <span className="text-slate-400">Active Lanes:</span>
                              <span className="font-mono text-slate-200">{g.operationalScanners}/{g.scannerCount}</span>
                            </div>
                            <div className="flex justify-between bg-navy-950/60 px-2 py-1 rounded border border-navy-800/60">
                              <span className="text-slate-400">Effective Cap:</span>
                              <span className="font-mono text-slate-200">{effCap} ppl/m</span>
                            </div>
                            <div className="flex justify-between bg-navy-950/60 px-2 py-1 rounded border border-navy-800/60">
                              <span className="text-slate-400">Lane Util:</span>
                              <span className="font-mono text-cyan-300">{util}%</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 3: REAL-TIME EVENT LOG */}
              {activeSideTab === 'LOGS' && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[11px] text-slate-400 border-b border-navy-800 pb-1">
                    <span>Gate Simulation Events ({gateSideEvents.length})</span>
                    <span className="font-mono">Clock: mm:ss</span>
                  </div>

                  <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
                    {gateSideEvents.length > 0 ? (
                      gateSideEvents.map((evt) => (
                        <div
                          key={evt.id}
                          className="p-2 rounded-lg bg-navy-900/90 border border-navy-800 text-[11px] space-y-0.5"
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-mono text-cyan-400 font-bold">{evt.timeFormatted}</span>
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                evt.type === 'COUNTER_FAILURE' || evt.type === 'GATE_CLOSED' || evt.type === 'SPILLBACK'
                                  ? 'bg-red-950 text-red-300 border border-red-800'
                                  : evt.type === 'COUNTER_RESTORED' || evt.type === 'GATE_OPENED'
                                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                    : 'bg-navy-950 text-slate-300 border border-navy-700'
                              }`}
                            >
                              {evt.type}
                            </span>
                          </div>
                          <p className="text-slate-300 leading-relaxed">{evt.message}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-slate-500 italic text-center py-6">
                        No events logged yet. Adjust inflow or counters to trigger events.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* STANDARD VENUE & ZONE INSPECTOR */
            <div>
              <div className="flex items-center justify-between border-b border-navy-700 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-cyan-400" />
                  <h3 className="font-bold text-slate-100 text-sm">Twin Object Inspector</h3>
                </div>
                {(selectedGate || selectedZone) && (
                  <button
                    onClick={() => {
                      setSelectedGateId(null);
                      setSelectedZoneId(null);
                    }}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    Clear
                  </button>
                )}
              </div>
        
          {/* 1. GATE INSPECTION PANEL */}
          {selectedGate ? (
            <div className="space-y-4">
              <div className="p-3 bg-navy-900 border border-navy-700 rounded-xl">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-bold text-cyan-300 text-base">{selectedGate.name}</h4>
                    <span className="text-[11px] text-slate-400">ID: {selectedGate.id}</span>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      selectedGate.status === 'OPERATIONAL'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                        : selectedGate.status === 'SCANNER_FAILURE' || selectedGate.status === 'HIGH_CONGESTION'
                          ? 'bg-amber-950 text-amber-300 border border-amber-700'
                          : 'bg-red-950 text-red-300 border border-red-700'
                    }`}
                  >
                    {selectedGate.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs mt-3">
                  <div className="bg-navy-950 p-2 rounded-lg border border-navy-800">
                    <span className="text-slate-400 text-[10px] block">Current Queue</span>
                    <span className="font-mono text-base font-bold text-slate-100">
                      {selectedGate.currentQueue} <span className="text-xs font-normal">people</span>
                    </span>
                  </div>
                  <div className="bg-navy-950 p-2 rounded-lg border border-navy-800">
                    <span className="text-slate-400 text-[10px] block">Est. Wait Time</span>
                    <span className="font-mono text-base font-bold text-amber-400">
                      ~{Math.round(selectedGate.queueWaitTimeSecs / 60)}{' '}
                      <span className="text-xs font-normal">mins</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Editable Gate Parameters */}
              <div className="space-y-3 bg-navy-900/60 p-3 rounded-xl border border-navy-700 text-xs">
                <span className="font-bold text-slate-300 block mb-1">Operational Parameters</span>

                <div>
                  <label className="text-slate-400 block mb-1">
                    Scanner Lanes ({selectedGate.operationalScanners}/{selectedGate.scannerCount} operational)
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={selectedGate.scannerCount}
                    onChange={(e) =>
                      updateGate(selectedGate.id, {
                        scannerCount: Number(e.target.value),
                        operationalScanners: Math.min(selectedGate.operationalScanners, Number(e.target.value)),
                      })
                    }
                    className="w-full accent-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">
                    Service Rate ({selectedGate.scannerProcessingRatePerMin} people/scanner/min)
                  </label>
                  <input
                    type="range"
                    min="5"
                    max="25"
                    value={selectedGate.scannerProcessingRatePerMin}
                    onChange={(e) =>
                      updateGate(selectedGate.id, { scannerProcessingRatePerMin: Number(e.target.value) })
                    }
                    className="w-full accent-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Gate Width ({selectedGate.width}m)</label>
                  <input
                    type="range"
                    min="3"
                    max="15"
                    step="0.5"
                    value={selectedGate.width}
                    onChange={(e) => updateGate(selectedGate.id, { width: Number(e.target.value) })}
                    className="w-full accent-cyan-500"
                  />
                </div>

                {/* Tactical Actions */}
                <div className="pt-2 border-t border-navy-700 flex flex-col gap-1.5">
                  <button
                    onClick={() =>
                      updateGate(selectedGate.id, {
                        operationalScanners: 1,
                        status: 'SCANNER_FAILURE',
                        warningLevel: 'HIGH',
                      })
                    }
                    className="w-full py-1.5 rounded-lg bg-amber-950/80 hover:bg-amber-900 border border-amber-700/60 text-amber-200 text-xs font-semibold transition"
                  >
                    Simulate Scanner Glitch
                  </button>

                  <button
                    onClick={() =>
                      updateGate(selectedGate.id, {
                        status: selectedGate.status === 'TEMPORARILY_CLOSED' ? 'OPERATIONAL' : 'TEMPORARILY_CLOSED',
                        direction: selectedGate.direction === 'CLOSED' ? 'ENTRY' : 'CLOSED',
                      })
                    }
                    className="w-full py-1.5 rounded-lg bg-red-950/80 hover:bg-red-900 border border-red-700/60 text-red-200 text-xs font-semibold transition"
                  >
                    {selectedGate.status === 'TEMPORARILY_CLOSED' ? 'Reopen Entrance' : 'Close Gate Completely'}
                  </button>
                </div>
              </div>
            </div>
          ) : selectedZone ? (
            /* 2. ZONE INSPECTION PANEL */
            <div className="space-y-4">
              <div className="p-3 bg-navy-900 border border-navy-700 rounded-xl">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-bold text-cyan-300 text-base">{selectedZone.name}</h4>
                    <span className="text-[11px] text-slate-400">Category: {selectedZone.category}</span>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      selectedZone.riskLevel === 'CRITICAL'
                        ? 'bg-red-950 text-red-300 border border-red-700'
                        : selectedZone.riskLevel === 'HIGH_CONGESTION'
                          ? 'bg-amber-950 text-amber-300 border border-amber-700'
                          : 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                    }`}
                  >
                    {selectedZone.riskLevel}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs mt-3">
                  <div className="bg-navy-950 p-2 rounded-lg border border-navy-800">
                    <span className="text-slate-400 text-[10px] block">Current Density</span>
                    <span className="font-mono text-base font-bold text-cyan-400">
                      {selectedZone.currentDensity}{' '}
                      <span className="text-[10px] font-normal text-slate-400">p/m²</span>
                    </span>
                  </div>
                  <div className="bg-navy-950 p-2 rounded-lg border border-navy-800">
                    <span className="text-slate-400 text-[10px] block">Population</span>
                    <span className="font-mono text-base font-bold text-slate-200">
                      {selectedZone.currentPopulation}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 bg-navy-900/60 p-3 rounded-xl border border-navy-700 text-xs">
                <div className="flex justify-between py-1 border-b border-navy-800">
                  <span className="text-slate-400">Usable Area:</span>
                  <span className="font-mono text-slate-200">{selectedZone.usableAreaSqM} m²</span>
                </div>
                <div className="flex justify-between py-1 border-b border-navy-800">
                  <span className="text-slate-400">Max Recommended:</span>
                  <span className="font-mono text-slate-200">{selectedZone.maxRecommendedDensity} p/m²</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Avg Movement Speed:</span>
                  <span className="font-mono text-slate-200">{selectedZone.avgMovementSpeed} m/s</span>
                </div>
              </div>

              {/* Counterfactual Spatial Comparison Data */}
              {activeComparison && (() => {
                const zoneComp = activeComparison.zoneComparisons.find((c) => c.zoneId === selectedZone.id);
                if (!zoneComp) return null;
                return (
                  <div className="p-3 bg-navy-900/90 border border-violet-700/60 rounded-xl space-y-2.5 text-xs">
                    <div className="flex items-center justify-between border-b border-navy-800 pb-1.5">
                      <span className="font-bold text-violet-300 flex items-center gap-1.5">
                        <Split className="w-3.5 h-3.5" />
                        Counterfactual Delta
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          zoneComp.status === 'NEW_HOTSPOT'
                            ? 'bg-red-950 text-red-300 border-red-700'
                            : zoneComp.status === 'WORSENED'
                              ? 'bg-amber-950 text-amber-300 border-amber-700'
                              : zoneComp.status === 'RELIEVED'
                                ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                                : 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}
                      >
                        {zoneComp.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 text-center">
                      <div className="bg-navy-950 p-1.5 rounded border border-navy-800">
                        <span className="text-[10px] text-slate-400 block">Baseline</span>
                        <span className="font-mono font-bold text-slate-200">{zoneComp.baselineDensity.toFixed(1)}</span>
                      </div>
                      <div className="bg-navy-950 p-1.5 rounded border border-navy-800">
                        <span className="text-[10px] text-slate-400 block">Plan</span>
                        <span className="font-mono font-bold text-cyan-300">{zoneComp.interventionDensity.toFixed(1)}</span>
                      </div>
                      <div className="bg-navy-950 p-1.5 rounded border border-navy-800">
                        <span className="text-[10px] text-slate-400 block">Delta (Δρ)</span>
                        <span
                          className={`font-mono font-bold ${
                            zoneComp.deltaDensity > 0 ? 'text-amber-400' : zoneComp.deltaDensity < 0 ? 'text-emerald-400' : 'text-slate-400'
                          }`}
                        >
                          {zoneComp.deltaDensity > 0 ? '+' : ''}{zoneComp.deltaDensity.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-300 leading-relaxed bg-navy-950/70 p-2 rounded border border-navy-800/80">
                      {zoneComp.description}
                    </p>
                  </div>
                );
              })()}
            </div>
          ) : (
            /* 3. VENUE OVERVIEW & CHINNASWAMY SOURCE ATTRIBUTION */
            <div className="space-y-4">
              <div className="p-3 bg-navy-900/80 border border-navy-700 rounded-xl space-y-2 text-xs">
                <h4 className="font-bold text-slate-200 text-sm">{currentVenue.name}</h4>
                <p className="text-slate-400 leading-relaxed">{currentVenue.description}</p>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-navy-800">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Reference Seating</span>
                    <span className="font-mono font-bold text-slate-200 text-sm">
                      {currentVenue.seatingCapacity.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Planning Capacity</span>
                    <span className="font-mono font-bold text-cyan-400 text-sm">
                      {currentVenue.planningCapacity.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Source Attribution Card */}
              {currentVenue.sourceAttribution && (
                <div className="p-3 bg-navy-950 border border-navy-700 rounded-xl text-xs space-y-2">
                  <div className="flex items-center gap-1.5 text-cyan-400 font-semibold text-[11px]">
                    <Info className="w-3.5 h-3.5" />
                    <span>Demonstration Profile Sources &amp; Context</span>
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    {currentVenue.sourceAttribution.text}
                  </p>
                  <div className="pt-2 border-t border-navy-800 space-y-1">
                    {currentVenue.sourceAttribution.links.map((link, idx) => (
                      <a
                        key={idx}
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 underline"
                      >
                        <ExternalLink className="w-3 h-3" />
                        {link.label}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-3 bg-navy-900/40 border border-navy-700 rounded-xl text-xs text-slate-400">
                <span className="font-bold text-slate-300 block mb-1">Click Map To Inspect</span>
                <p>Click on any of the 21 gates or stadium concourse zones to configure live parameters.</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>

    {/* Footer Guidance */}
    <div className="pt-3 border-t border-navy-700 text-[11px] text-slate-400 flex items-center justify-between">
      <span>Active Agents: {engine.state.agents.length}</span>
      <span>Simulation Speed: {engine.state.speedMultiplier}x</span>
    </div>
  </div>
</div>
</div>
  );
};

