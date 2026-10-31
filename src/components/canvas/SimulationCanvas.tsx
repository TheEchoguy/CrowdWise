/**
 * CROWDWISE — Phase 2: Authentic Stadium Crowd Simulation Viewport
 * M. Chinnaswamy Stadium, Bengaluru
 *
 * Microscopic pedestrian dynamics rendered directly on authentic KSCA vector geometry (1600 x 1200):
 * - Reuses exact Phase 1 vector geometry (13 stands, 23 outer gates, 15 inner banks, roads, holding corrals)
 * - Three Visualization Modes: FULL STADIUM, SECTOR VIEW, and GATE VIEW
 * - Helbing Social Force Model with Waypoint Progression & Turnstile Service
 * - Natural Queue Buildup, Counter-Flow Shockwaves & 3-Zone Monitoring
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useSimulationStore } from '../../state/useSimulationStore';
import { StadiumStandLayer } from '../../stadium/components/StadiumStandLayer';
import { StadiumRoadLayer } from '../../stadium/components/StadiumRoadLayer';
import { PedestrianRouteLayer } from '../../stadium/components/PedestrianRouteLayer';
import { StadiumInfrastructureLayer } from '../../stadium/components/StadiumInfrastructureLayer';
import { OuterGateMarker, InnerGateMarker } from '../../stadium/components/StadiumGateMarker';
import { StadiumSimulationEngine, StadiumAgent } from '../../stadium/simulation/StadiumSimulationEngine';
import { CHINNASWAMY_OUTER_GATES } from '../../stadium/data/outerGates';
import { CHINNASWAMY_INNER_GATES } from '../../stadium/data/innerGates';
import { SECTION_VIEWPORTS } from '../../stadium/data/stadiumMetadata';
import { getGateViewBox } from '../../stadium/utils/coordinateTransform';
import { StadiumSection } from '../../stadium/types/stadium';
import { DisplacementDetector } from '../../engine/DisplacementDetector';
import { SafetyVerdictEngine } from '../../engine/SafetyVerdictEngine';
import { CrowdInteractionAnalyzer } from '../../engine/CrowdInteractionAnalyzer';
import { SafetyController } from '../../engine/SafetyController';
import { ThreeZoneMonitor } from '../../engine/ThreeZoneMonitor';
import { SpatialGrid } from '../../engine/SpatialGrid';
import { MicroscopicGateCanvas } from './MicroscopicGateCanvas';
import { StadiumDensityHeatmap, DensityHotspot, FlowVector } from '../../stadium/visualization/DensityHeatmap';
import { getConnectedInnerGates, getConnectedOuterGates } from '../../stadium/network/gateConnectivity';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Layers,
  Users,
  Compass,
  Activity
} from 'lucide-react';

const getFruinDensityColor = (density: number): string => {
  if (density >= 3.0) return '#ef4444'; // Red: > 3.0 p/m² Severe Compression
  if (density >= 2.2) return '#f97316'; // Orange: 2.2 - 3.0 p/m² Constrained
  if (density >= 1.5) return '#eab308'; // Yellow: 1.5 - 2.2 p/m² Laminar Warning
  return '#10b981'; // Green: < 1.5 p/m² Free Flow
};

export const SimulationCanvas: React.FC = () => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Store Subscriptions
  const simulationDisplayMode = useSimulationStore((s) => s.simulationDisplayMode);
  const setSimulationDisplayMode = useSimulationStore((s) => s.setSimulationDisplayMode);
  const heatmapVisualizationMode = useSimulationStore((s) => s.heatmapVisualizationMode);
  const setHeatmapVisualizationMode = useSimulationStore((s) => s.setHeatmapVisualizationMode);
  const selectedSector = useSimulationStore((s) => s.selectedSector);
  const selectedOuterGateId = useSimulationStore((s) => s.selectedOuterGateId);
  const setSelectedOuterGateId = useSimulationStore((s) => s.setSelectedOuterGateId);
  const selectedInnerGateId = useSimulationStore((s) => s.selectedInnerGateId);
  const setSelectedInnerGateId = useSimulationStore((s) => s.setSelectedInnerGateId);

  const inflowRate = useSimulationStore((s) => s.inflowRate);
  const walkingSpeed = useSimulationStore((s) => s.walkingSpeed);
  const turnstileScanLatency = useSimulationStore((s) => s.turnstileScanLatency);
  const counterFlowActive = useSimulationStore((s) => s.counterFlowActive);
  const sectorTurnstileOverrides = useSimulationStore((s) => s.sectorTurnstileOverrides);
  const isPaused = useSimulationStore((s) => s.isPaused);
  const timeScale = useSimulationStore((s) => s.timeScale);
  const resetSignal = useSimulationStore((s) => s.resetSignal);
  const surgeSignal = useSimulationStore((s) => s.surgeSignal);
  const surgeCount = useSimulationStore((s) => s.surgeCount);
  const metroPulseSignal = useSimulationStore((s) => s.metroPulseSignal);
  const activeExperiment = useSimulationStore((s) => s.activeExperiment);

  // Telemetry & Verdict Setters
  const setTelemetry = useSimulationStore((s) => s.setTelemetry);
  const setComparativeAudit = useSimulationStore((s) => s.setComparativeAudit);
  const setVerdict = useSimulationStore((s) => s.setVerdict);
  const setInteractionAnalysis = useSimulationStore((s) => s.setInteractionAnalysis);
  const setControllerDecisions = useSimulationStore((s) => s.setControllerDecisions);

  // Simulation Engine References
  const engineRef = useRef<StadiumSimulationEngine>(new StadiumSimulationEngine(42));
  const [agentsState, setAgentsState] = useState<StadiumAgent[]>([]);

  // Phase 2.1 Spatial Density Heatmap References & State
  const heatmapRef = useRef<StadiumDensityHeatmap>(new StadiumDensityHeatmap());
  const heatmapCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hotspots, setHotspots] = useState<DensityHotspot[]>([]);
  const [flowVectors, setFlowVectors] = useState<FlowVector[]>([]);

  // Safety Analytics References
  const spatialGridRef = useRef<SpatialGrid>(new SpatialGrid(40));
  const threeZoneMonitorRef = useRef<ThreeZoneMonitor>(new ThreeZoneMonitor());
  const interactionAnalyzerRef = useRef<CrowdInteractionAnalyzer>(new CrowdInteractionAnalyzer());
  const safetyControllerRef = useRef<SafetyController>(new SafetyController());
  const baselineSnapshotRef = useRef<{ a: any; b: any; c: any } | null>(null);
  const lastWorkflowDispatchRef = useRef<number>(0);
  const startTimeRef = useRef<number>(performance.now());

  // ViewBox Pan & Zoom State
  const defaultView = SECTION_VIEWPORTS.ALL;
  const [viewBox, setViewBox] = useState({
    x: defaultView.x,
    y: defaultView.y,
    width: defaultView.width,
    height: defaultView.height
  });

  const [isPanning, setIsPanning] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Map sector key to StadiumSection
  const resolveStadiumSection = (sec: string): StadiumSection => {
    if (sec === 'CUBBON_ROAD' || sec === 'NORTH') return 'NORTH_CUBBON';
    if (sec === 'LINK_ROAD' || sec === 'EAST') return 'EAST_LINK';
    if (sec === 'MG_ROAD' || sec === 'SOUTH') return 'SOUTH_MG';
    if (sec === 'QUEENS_ROAD' || sec === 'WEST') return 'WEST_QUEENS';
    return 'ALL';
  };

  // Update ViewBox whenever mode, sector or gate selection changes
  useEffect(() => {
    if (simulationDisplayMode === 'FULL_STADIUM') {
      const v = SECTION_VIEWPORTS.ALL;
      setViewBox({ x: v.x, y: v.y, width: v.width, height: v.height });
    } else if (simulationDisplayMode === 'SECTOR_VIEW') {
      const sec = resolveStadiumSection(String(selectedSector));
      const v = SECTION_VIEWPORTS[sec] || SECTION_VIEWPORTS.ALL;
      setViewBox({ x: v.x, y: v.y, width: v.width, height: v.height });
    } else if (simulationDisplayMode === 'GATE_VIEW') {
      const gateId = selectedOuterGateId || 'E11';
      const v = getGateViewBox(gateId);
      setViewBox({ x: v.x, y: v.y, width: v.width, height: v.height });
    }
  }, [simulationDisplayMode, selectedSector, selectedOuterGateId]);

  // Reset Engine on resetSignal
  useEffect(() => {
    engineRef.current.reset(42 + resetSignal, sectorTurnstileOverrides);
    startTimeRef.current = performance.now();
    baselineSnapshotRef.current = null;
    threeZoneMonitorRef.current.reset();
    interactionAnalyzerRef.current.reset();
    safetyControllerRef.current.reset();

    // Pre-seed 35 flowing patrons across active corridors
    const permittedGates = ['E11', 'E13', 'E16', 'E17', 'E18', 'E19', 'E22', 'E23'];
    for (let i = 0; i < 35; i++) {
      const gid = permittedGates[i % permittedGates.length];
      engineRef.current.spawnAgent(gid, undefined, walkingSpeed);
    }
  }, [resetSignal, sectorTurnstileOverrides, walkingSpeed]);

  // Handle Metro Surge Wave Trigger
  useEffect(() => {
    if (metroPulseSignal > 0) {
      // Spawn rapid burst wave at Gate E11 (MG Road Metro)
      for (let i = 0; i < 40; i++) {
        engineRef.current.spawnAgent('E11', 'G15', walkingSpeed + 0.3);
      }
    }
  }, [metroPulseSignal, walkingSpeed]);

  // Handle Burst Rush Trigger
  useEffect(() => {
    if (surgeSignal > 0) {
      const gates = ['E11', 'E13', 'E22', 'E19'];
      const count = Math.min(60, surgeCount || 40);
      for (let i = 0; i < count; i++) {
        const gid = gates[i % gates.length];
        engineRef.current.spawnAgent(gid, undefined, walkingSpeed + 0.4);
      }
    }
  }, [surgeSignal, surgeCount, walkingSpeed]);

  // Wheel Zoom Handler
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (!svgRef.current) return;

    const rect = svgRef.current.getBoundingClientRect();
    const cursorRatioX = (e.clientX - rect.left) / rect.width;
    const cursorRatioY = (e.clientY - rect.top) / rect.height;

    const zoomFactor = e.deltaY < 0 ? 0.88 : 1.14;

    setViewBox((prev) => {
      const newWidth = Math.max(300, Math.min(2400, prev.width * zoomFactor));
      const newHeight = Math.max(220, Math.min(1800, prev.height * zoomFactor));
      const deltaX = prev.width - newWidth;
      const deltaY = prev.height - newHeight;

      return {
        x: prev.x + deltaX * cursorRatioX,
        y: prev.y + deltaY * cursorRatioY,
        width: newWidth,
        height: newHeight
      };
    });
  }, []);

  // Pan Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsPanning(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = viewBox.width / rect.width;
    const scaleY = viewBox.height / rect.height;

    const dx = (e.clientX - dragStart.x) * scaleX;
    const dy = (e.clientY - dragStart.y) * scaleY;

    setViewBox((prev) => ({
      ...prev,
      x: prev.x - dx,
      y: prev.y - dy
    }));

    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => setIsPanning(false);

  // Main 60 FPS Microscopic Simulation Loop
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = (now: number) => {
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = isPaused ? 0 : Math.min(0.05, rawDt) * timeScale;

      if (dt > 0) {
        // Step microscopic physics engine
        const stepResults = engineRef.current.step(
          dt,
          inflowRate,
          walkingSpeed,
          turnstileScanLatency,
          counterFlowActive,
          now
        );

        const currentAgents = engineRef.current.getAgents();
        setAgentsState([...currentAgents]);

        // Phase 2.1 Spatial Density Heatmap Calculation & Rasterization
        heatmapRef.current.update(currentAgents);
        if (heatmapCanvasRef.current) {
          const ctx = heatmapCanvasRef.current.getContext('2d');
          if (ctx) {
            heatmapRef.current.renderToCanvas(ctx, 1600, 1200, 0.85);
          }
        }
        setHotspots(heatmapRef.current.getHotspots());
        setFlowVectors(heatmapRef.current.getFlowVectors(4));

        // Safety Analysis Calculations
        const elapsedSec = (now - startTimeRef.current) / 1000;
        const recentThroughput = stepResults.throughputPerMin;

        // Stage 4: Counter-flow and collision analysis
        const interactions = interactionAnalyzerRef.current.analyze(
          currentAgents,
          spatialGridRef.current,
          dt,
          recentThroughput
        );

        // Stage 3 & 5: Three-Zone Spatial Monitor & Explainable Safety Controller
        const threeZoneSnapshot = threeZoneMonitorRef.current.sampleZones(
          currentAgents,
          dt,
          recentThroughput,
          360
        );

        const decisions = safetyControllerRef.current.evaluate(
          threeZoneSnapshot,
          interactions,
          elapsedSec,
          selectedSector as any
        );

        // Matched Baseline
        if (!baselineSnapshotRef.current || (activeExperiment === 'NORMAL' && elapsedSec <= 15)) {
          baselineSnapshotRef.current = {
            a: { ...threeZoneSnapshot.zoneA },
            b: { ...threeZoneSnapshot.zoneB },
            c: { ...threeZoneSnapshot.zoneC }
          };
        }

        // Stage 6 & 7: Displacement Detector & Safety Verdict
        const comparativeAudit = DisplacementDetector.compare(
          baselineSnapshotRef.current.a,
          baselineSnapshotRef.current.b,
          baselineSnapshotRef.current.c,
          threeZoneSnapshot.zoneA,
          threeZoneSnapshot.zoneB,
          threeZoneSnapshot.zoneC,
          elapsedSec
        );
        const finalVerdict = SafetyVerdictEngine.evaluate(comparativeAudit);

        // Throttle dispatch to Zustand store (every 120ms)
        if (now - lastWorkflowDispatchRef.current >= 120) {
          lastWorkflowDispatchRef.current = now;

          setTelemetry({
            liveAgents: stepResults.activeAgentCount,
            peakDensity: stepResults.peakDensity,
            throughputPerMin: recentThroughput,
            counterFlowPenaltyPercent: interactions.emergentThroughputPenaltyPercent,
            zoneADensity: threeZoneSnapshot.zoneA.density,
            zoneBDensity: threeZoneSnapshot.zoneB.density,
            zoneCDensity: threeZoneSnapshot.zoneC.density,
            displacedZone: threeZoneSnapshot.displacedZone as any,
            displacedCrushAdvisory: threeZoneSnapshot.displacedCrushAdvisory
          });

          setComparativeAudit(comparativeAudit);
          setVerdict(finalVerdict);
          setInteractionAnalysis(interactions);
          setControllerDecisions(decisions);
        }
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [
    isPaused,
    timeScale,
    inflowRate,
    walkingSpeed,
    turnstileScanLatency,
    counterFlowActive,
    selectedSector,
    activeExperiment,
    setTelemetry,
    setComparativeAudit,
    setVerdict,
    setInteractionAnalysis,
    setControllerDecisions
  ]);

  // Selected Gate objects
  const activeOuterGate = CHINNASWAMY_OUTER_GATES.find((g) => g.id === selectedOuterGateId) || null;
  const activeInnerGate = CHINNASWAMY_INNER_GATES.find((g) => g.id === selectedInnerGateId) || null;

  // Dedicated Microscopic Gate Viewport
  if (simulationDisplayMode === 'GATE_VIEW') {
    return <MicroscopicGateCanvas />;
  }

  return (
    <div className="w-full h-full relative overflow-hidden bg-[#070b12] rounded-xl border border-slate-800 shadow-2xl flex flex-col select-none">
      {/* ─── 1. SIMULATION VIEWPORT MODE BAR ────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/90 border-b border-slate-800 z-10 shrink-0">
        <div className="flex items-center gap-2">
          {/* View Mode Switcher Pills */}
          <div className="flex items-center rounded-lg bg-slate-950 border border-slate-800 p-0.5">
            <button
              onClick={() => setSimulationDisplayMode('FULL_STADIUM')}
              className={`px-2.5 py-1 text-[11px] font-bold rounded transition ${
                simulationDisplayMode === 'FULL_STADIUM'
                  ? 'bg-cyan-950 text-cyan-300 border border-cyan-700'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Full Stadium 360°
            </button>
            <button
              onClick={() => setSimulationDisplayMode('SECTOR_VIEW')}
              className={`px-2.5 py-1 text-[11px] font-bold rounded transition ${
                simulationDisplayMode === 'SECTOR_VIEW'
                  ? 'bg-cyan-950 text-cyan-300 border border-cyan-700'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Sector View
            </button>
            <button
              onClick={() => setSimulationDisplayMode('GATE_VIEW')}
              className={`px-2.5 py-1 text-[11px] font-bold rounded transition ${
                (simulationDisplayMode as string) === 'GATE_VIEW'
                  ? 'bg-cyan-950 text-cyan-300 border border-cyan-700'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Gate Corridor ({selectedOuterGateId || 'E11'})
            </button>
          </div>

          {/* Visualization Layer Switcher (Density Points, Agents, Hybrid, Routes Only) */}
          <div className="flex items-center rounded-lg bg-slate-950 border border-slate-800 p-0.5 ml-1">
            <button
              onClick={() => setHeatmapVisualizationMode('DENSITY_POINTS')}
              className={`px-2 py-0.5 text-[10px] font-bold rounded flex items-center gap-1 transition ${
                heatmapVisualizationMode === 'DENSITY_POINTS'
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-700 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Crisp Density Point-Cloud (Fruin Bands)"
            >
              <Activity className="w-3 h-3 text-emerald-400" />
              <span>Density Points</span>
            </button>
            <button
              onClick={() => setHeatmapVisualizationMode('AGENTS')}
              className={`px-2 py-0.5 text-[10px] font-bold rounded flex items-center gap-1 transition ${
                heatmapVisualizationMode === 'AGENTS'
                  ? 'bg-cyan-950 text-cyan-300 border border-cyan-700'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Individual Pedestrian Agents"
            >
              <Users className="w-3 h-3 text-cyan-400" />
              <span>Agents</span>
            </button>
            <button
              onClick={() => setHeatmapVisualizationMode('HYBRID')}
              className={`px-2 py-0.5 text-[10px] font-bold rounded flex items-center gap-1 transition ${
                heatmapVisualizationMode === 'HYBRID'
                  ? 'bg-amber-950 text-amber-300 border border-amber-700'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Density Heatmap + Representative Agents"
            >
              <Layers className="w-3 h-3 text-amber-400" />
              <span>Hybrid</span>
            </button>
            <button
              onClick={() => setHeatmapVisualizationMode('ROUTES_ONLY')}
              className={`px-2 py-0.5 text-[10px] font-bold rounded flex items-center gap-1 transition ${
                heatmapVisualizationMode === 'ROUTES_ONLY'
                  ? 'bg-purple-950 text-purple-300 border border-purple-700'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Routes and Geometry Only"
            >
              <Compass className="w-3 h-3 text-purple-400" />
              <span>Routes Only</span>
            </button>
          </div>
        </div>

        {/* View Zoom & Reset Buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              setViewBox((prev) => ({
                x: prev.x + prev.width * 0.1,
                y: prev.y + prev.height * 0.1,
                width: prev.width * 0.8,
                height: prev.height * 0.8
              }));
            }}
            className="p-1 hover:bg-slate-800 text-slate-300 hover:text-white rounded"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              setViewBox((prev) => ({
                x: prev.x - prev.width * 0.1,
                y: prev.y - prev.height * 0.1,
                width: Math.min(2400, prev.width * 1.25),
                height: Math.min(1800, prev.height * 1.25)
              }));
            }}
            className="p-1 hover:bg-slate-800 text-slate-300 hover:text-white rounded"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              const v = SECTION_VIEWPORTS.ALL;
              setViewBox({ x: v.x, y: v.y, width: v.width, height: v.height });
              setSimulationDisplayMode('FULL_STADIUM');
            }}
            className="p-1 hover:bg-slate-800 text-slate-300 hover:text-white rounded"
            title="Reset View"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ─── 2. INTERACTIVE SVG VECTOR SIMULATION CANVAS ─────────────────── */}
      <div className="flex-1 min-h-0 relative">
        <svg
          ref={svgRef}
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
          className="w-full h-full cursor-grab active:cursor-grabbing select-none"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Subtle CAD Background Grid */}
          <defs>
            <pattern id="simGrid" width="80" height="80" patternUnits="userSpaceOnUse">
              <path d="M 80 0 L 0 0 0 80" fill="none" stroke="#1e293b" strokeWidth="0.5" strokeOpacity="0.4" />
            </pattern>
            {/* Heatmap Glow Filter */}
            <filter id="heatGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="8" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <rect x="-1000" y="-1000" width="3600" height="3200" fill="url(#simGrid)" />

          {/* ─── 1. ARTERIAL ROADS ────────────────────────────────────── */}
          <StadiumRoadLayer />

          {/* ─── 2. LANDMARKS & HOLDING PENS ──────────────────────────── */}
          <StadiumInfrastructureLayer
            showLandmarks={true}
            showEmergency={true}
            showAmbulances={true}
            showHoldingAreas={true}
            showWatchtowers={true}
          />

          {/* ─── 3. STADIUM BOWL & ALL 13 STAND SECTORS ───────────────── */}
          <StadiumStandLayer
            selectedStandId={activeInnerGate?.standId || null}
            onSelectStand={(s) => {
              if (s.associatedInnerGates[0]) {
                setSelectedInnerGateId(s.associatedInnerGates[0]);
              }
            }}
          />

          {/* ─── 4. PEDESTRIAN INGRESS PATHWAYS ───────────────────────── */}
          <PedestrianRouteLayer
            selectedOuterGateId={selectedOuterGateId}
            selectedInnerGateId={selectedInnerGateId}
            selectedGateId={selectedOuterGateId || selectedInnerGateId || null}
          />

          {/* ─── 5. INNER CONCOURSE TURNSTILE BANKS (G1–G15) ──────────── */}
          <g id="layer-inner-turnstiles">
            {CHINNASWAMY_INNER_GATES.map((ig) => {
              const isSelected = selectedInnerGateId === ig.id;
              const isLinked = selectedOuterGateId
                ? getConnectedInnerGates(selectedOuterGateId).includes(ig.id)
                : false;

              return (
                <InnerGateMarker
                  key={ig.id}
                  gate={ig}
                  isSelected={isSelected}
                  isLinkedToSelectedOuter={isLinked}
                  onSelect={(gate) => {
                    setSelectedInnerGateId(gate.id);
                    setSelectedOuterGateId(null);
                  }}
                />
              );
            })}
          </g>

          {/* ─── 6. OUTER PERIMETER GATES (E1–E23) ────────────────────── */}
          <g id="layer-outer-gates">
            {CHINNASWAMY_OUTER_GATES.map((og) => {
              const isSelected = selectedOuterGateId === og.id;
              const isLinked = selectedInnerGateId
                ? getConnectedOuterGates(selectedInnerGateId).includes(og.id)
                : false;

              return (
                <OuterGateMarker
                  key={og.id}
                  gate={og}
                  isSelected={isSelected}
                  isLinkedToSelectedInner={isLinked}
                  onSelect={(gate) => {
                    setSelectedOuterGateId(gate.id);
                    setSelectedInnerGateId(null);
                  }}
                />
              );
            })}
          </g>

          {/* ─── 6.5 CONTINUOUS SPATIAL DENSITY HEATMAP LAYER ───────── */}
          {(heatmapVisualizationMode === 'HEATMAP' || heatmapVisualizationMode === 'HYBRID') && (
            <foreignObject x="0" y="0" width="1600" height="1200" pointerEvents="none" className="overflow-visible">
              <canvas
                ref={heatmapCanvasRef}
                width={1600}
                height={1200}
                className="w-full h-full pointer-events-none"
                style={{
                  opacity: heatmapVisualizationMode === 'HYBRID' ? 0.65 : 0.88,
                  mixBlendMode: 'screen'
                }}
              />
            </foreignObject>
          )}

          {/* ─── 6.6 DIRECTIONAL FLOW VECTORS LAYER ───────────────────── */}
          {(heatmapVisualizationMode === 'HEATMAP' || heatmapVisualizationMode === 'HYBRID') && (
            <g id="layer-flow-vectors" pointerEvents="none">
              {flowVectors.map((fv, idx) => {
                const len = Math.min(22, 6 + fv.magnitude * 5);
                const endX = fv.x + Math.cos(fv.angleRad) * len;
                const endY = fv.y + Math.sin(fv.angleRad) * len;
                return (
                  <g key={`fv-${idx}`} opacity={0.65}>
                    <line
                      x1={fv.x}
                      y1={fv.y}
                      x2={endX}
                      y2={endY}
                      stroke="#38bdf8"
                      strokeWidth={1.8}
                      strokeLinecap="round"
                    />
                    <circle cx={endX} cy={endY} r={1.5} fill="#38bdf8" />
                  </g>
                );
              })}
            </g>
          )}

          {/* ─── 6.7 CONGESTION HOTSPOT PULSE RINGS ───────────────────── */}
          {hotspots.map((hs, idx) => (
            <g key={`hs-${idx}`} pointerEvents="none">
              <circle
                cx={hs.x}
                cy={hs.y}
                r={hs.radius}
                fill={hs.level === 'CRITICAL' ? 'rgba(239, 68, 68, 0.25)' : hs.level === 'HIGH' ? 'rgba(249, 115, 22, 0.2)' : 'rgba(234, 179, 8, 0.15)'}
                stroke={hs.level === 'CRITICAL' ? '#ef4444' : hs.level === 'HIGH' ? '#f97316' : '#eab308'}
                strokeWidth={1.5}
                className="animate-pulse"
              />
              <circle
                cx={hs.x}
                cy={hs.y}
                r={hs.radius * 1.5}
                fill="none"
                stroke={hs.level === 'CRITICAL' ? '#ef4444' : hs.level === 'HIGH' ? '#f97316' : '#eab308'}
                strokeWidth={1}
                strokeDasharray="3 3"
                className="animate-ping"
                opacity={0.5}
              />
            </g>
          ))}

          {/* ─── 7. ANIMATED PEDESTRIAN AGENTS (MICROSCOPIC SFM & POINT-CLOUD) ──── */}
          {heatmapVisualizationMode !== 'ROUTES_ONLY' && (
            <g id="layer-pedestrian-agents" opacity={heatmapVisualizationMode === 'HEATMAP' ? 0.35 : 1.0}>
              {agentsState.map((ag) => {
                const spd = Math.hypot(ag.vx, ag.vy);
                const isDensityPoints = heatmapVisualizationMode === 'DENSITY_POINTS';
                const fillColor = isDensityPoints ? getFruinDensityColor(ag.density) : ag.color;
                const r = isDensityPoints
                  ? (simulationDisplayMode === 'SECTOR_VIEW' ? 2.5 : 1.8)
                  : (ag.isBeingServiced ? 5.5 : ag.radius);

                const headingTailX = spd > 1 ? ag.x - (ag.vx / spd) * 5 : ag.x;
                const headingTailY = spd > 1 ? ag.y - (ag.vy / spd) * 5 : ag.y;

                return (
                  <g key={ag.id} opacity={ag.clearanceFade ?? 1.0}>
                    {/* Directional Velocity Tail */}
                    {spd > 1 && (
                      <line
                        x1={ag.x}
                        y1={ag.y}
                        x2={headingTailX}
                        y2={headingTailY}
                        stroke={fillColor}
                        strokeWidth={isDensityPoints ? 1.0 : 1.5}
                        strokeOpacity={isDensityPoints ? 0.45 : 0.6}
                        strokeLinecap="round"
                      />
                    )}

                    {/* Agent Disc Body */}
                    <circle
                      cx={ag.x}
                      cy={ag.y}
                      r={r}
                      fill={fillColor}
                      stroke={ag.isRejected ? '#ffffff' : isDensityPoints ? '#022c22' : '#020617'}
                      strokeWidth={isDensityPoints ? 0.5 : ag.isRejected ? 1.4 : 0.8}
                    />

                    {/* High Density Compressive Hazard Ring */}
                    {ag.density >= 3.0 && (
                      <circle
                        cx={ag.x}
                        cy={ag.y}
                        r={r + (isDensityPoints ? 2.5 : 3.5)}
                        fill="none"
                        stroke="#ef4444"
                        strokeWidth={0.8}
                        strokeOpacity={0.75}
                        className="animate-ping"
                      />
                    )}
                  </g>
                );
              })}
            </g>
          )}
        </svg>

        {/* ─── 3. CORNER FLOATING HUD (GATE STATS & QUEUE LENGTH) ────── */}
        {activeOuterGate && (
          <div className="absolute bottom-3 left-3 p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 backdrop-blur-md shadow-xl text-xs flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded bg-red-600 flex items-center justify-center font-black text-white text-xs shadow-md">
                {activeOuterGate.id}
              </span>
              <div>
                <span className="font-extrabold text-white block">{activeOuterGate.label}</span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {activeOuterGate.road.replace('_', ' ')}
                </span>
              </div>
            </div>

            <div className="h-6 w-px bg-slate-800" />

            <div>
              <span className="text-[9px] text-slate-400 font-mono block">CONNECTED INNER</span>
              <span className="font-bold text-cyan-400 font-mono">
                {activeOuterGate.connectedInnerGates.join(', ')}
              </span>
            </div>

            {activeOuterGate.accessPermission === 'RESTRICTED_VIP_MEDIA' && (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800">
                RESTRICTED
              </span>
            )}
          </div>
        )}
        {/* ─── 4. FRUIN LOS DENSITY LEGEND BAR ───────────────────────── */}
        <div className="absolute bottom-3 right-3 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 backdrop-blur-md shadow-xl text-xs hidden sm:flex items-center gap-3 pointer-events-none">
          <span className="text-[10px] text-slate-400 font-mono font-bold tracking-wider">FRUIN DENSITY</span>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-[10px] text-emerald-400">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />
              &lt;1.5 (Free)
            </span>
            <span className="flex items-center gap-1 text-[10px] text-yellow-400">
              <span className="w-2.5 h-2.5 rounded-sm bg-yellow-500 inline-block" />
              1.5–2.2 (Laminar)
            </span>
            <span className="flex items-center gap-1 text-[10px] text-orange-400">
              <span className="w-2.5 h-2.5 rounded-sm bg-orange-500 inline-block" />
              2.2–3.0 (Constrained)
            </span>
            <span className="flex items-center gap-1 text-[10px] text-red-400">
              <span className="w-2.5 h-2.5 rounded-sm bg-red-500 inline-block" />
              &gt;3.0 (Hazard)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
