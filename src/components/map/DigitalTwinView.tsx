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
} from 'lucide-react';
import { useSimulationStore } from '../../store/simulationStore';
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
  } = useSimulationStore();

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
        renderer.fitToView(currentVenue, rect.width, rect.height);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [currentVenue.id]);

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
          layers.spatialComparison ? activeComparison?.zoneComparisons : null
        );
      }
      animId = requestAnimationFrame(renderLoop);
    };

    animId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animId);
  }, [layers, detailLevel, selectedGateId, selectedZoneId, activeComparison]);

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

  return (
    <div className="relative w-full h-[calc(100vh-4rem)] bg-navy-950 overflow-hidden flex">
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

      {/* Right Properties & Inspection Drawer */}
      <div className="w-84 md:w-96 bg-navy-850 border-l border-navy-600 h-full overflow-y-auto p-4 flex flex-col justify-between shrink-0 select-none z-10">
        <div>
          {/* Header */}
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

        {/* Footer Guidance */}
        <div className="pt-3 border-t border-navy-700 text-[11px] text-slate-400 flex items-center justify-between">
          <span>Active Agents: {engine.state.agents.length}</span>
          <span>Simulation Speed: {engine.state.speedMultiplier}x</span>
        </div>
      </div>
    </div>
  );
};

