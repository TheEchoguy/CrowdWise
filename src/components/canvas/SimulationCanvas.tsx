import React, { useEffect, useRef } from 'react';
import { useSimulationStore } from '../../state/useSimulationStore';
import {
  KSCA_STADIUM_SECTORS,
  KSCA_OUTER_GATES,
  KSCA_INNER_GATES,
  StadiumSectorData,
  OuterGate,
  InnerGate
} from '../../engine/ChinnaswamyData';
import { SpatialGrid } from '../../engine/SpatialGrid';
import { updateAgentPhysics, calculateCrowdInteractions } from '../../engine/SocialForceEngine';
import { AgentData, Wall, RoadSectorId } from '../../types/simulation';
import { getSectorWaypoints } from '../../engine/Geometry';
import { Train, Globe, DoorOpen, Clock, Zap, AlertTriangle, ShieldAlert } from 'lucide-react';

export const SimulationCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Store Subscriptions
  const currentView = useSimulationStore((s) => s.currentView);
  const setCurrentView = useSimulationStore((s) => s.setCurrentView);
  const selectedSector = (useSimulationStore((s) => s.selectedRoadSector) ||
    useSimulationStore((s) => s.selectedSector) ||
    'LINK_ROAD') as RoadSectorId;
  const setSelectedSector = useSimulationStore((s) => s.setSelectedSector);

  const inflowRate = useSimulationStore((s) => s.inflowRate);
  const baggageScanLatency = useSimulationStore((s) => s.baggageScanLatency);
  const turnstileScanLatency = useSimulationStore((s) => s.turnstileScanLatency);
  const walkingSpeed = useSimulationStore((s) => s.walkingSpeed);
  const counterFlowActive = useSimulationStore((s) => s.counterFlowActive);
  const sectorTurnstileOverrides = useSimulationStore((s) => s.sectorTurnstileOverrides);
  const isPaused = useSimulationStore((s) => s.isPaused);
  const timeScale = useSimulationStore((s) => s.timeScale);
  const resetSignal = useSimulationStore((s) => s.resetSignal);
  const surgeSignal = useSimulationStore((s) => s.surgeSignal);
  const metroPulseSignal = useSimulationStore((s) => s.metroPulseSignal);
  const setTelemetry = useSimulationStore((s) => s.setTelemetry);
  const incrementSeatedCount = useSimulationStore((s) => s.incrementSeatedCount);
  const stadiumSeatedCount = useSimulationStore((s) => s.stadiumSeatedCount);

  // Agent State & Physics References
  const agentsRef = useRef<AgentData[]>([]);
  const nextIdRef = useRef<number>(1);
  const spawnAccRef = useRef<number>(0);
  const spatialGridRef = useRef<SpatialGrid>(new SpatialGrid(32));
  const throughputHistoryRef = useRef<number[]>([]);
  const waitTimesRef = useRef<number[]>([]);
  const lastTimeRef = useRef<number>(performance.now());
  const flashTimerRef = useRef<number>(0);
  const displacedCrushRef = useRef<boolean>(false);

  const CANVAS_WIDTH = 960;
  const CANVAS_HEIGHT = 540;

  // Active sector definition
  const activeSectorData: StadiumSectorData =
    KSCA_STADIUM_SECTORS[selectedSector] || KSCA_STADIUM_SECTORS.LINK_ROAD;

  // Reset or Seed Simulation
  const resetSimulation = () => {
    agentsRef.current = [];
    nextIdRef.current = 1;
    spawnAccRef.current = 0;
    throughputHistoryRef.current = [];
    waitTimesRef.current = [];
    displacedCrushRef.current = false;

    // Seed initial patrons
    const initialCount = currentView === 'MACRO_STADIUM' ? 90 : 45;
    for (let i = 0; i < initialCount; i++) {
      spawnAgent(Math.random() * 0.9);
    }
  };

  useEffect(() => {
    resetSimulation();
  }, [resetSignal, currentView, selectedSector]);

  // Handle Metro Pulse Surge
  useEffect(() => {
    if (metroPulseSignal === 0) return;
    const pulseCount = 80;
    for (let i = 0; i < pulseCount; i++) {
      spawnAgent(0.95);
    }
  }, [metroPulseSignal, surgeSignal]);

  // Spawn an agent with KSCA ground truth routing
  const spawnAgent = (progressAdvance: number = 0) => {
    const id = nextIdRef.current++;
    const isVipMedia = Math.random() < 0.08;

    if (currentView === 'MACRO_STADIUM') {
      // Macro View: Spawn distributed across the 4 perimeter roads
      const roadRand = Math.random();
      const road: RoadSectorId =
        roadRand < 0.45 ? 'MG_ROAD' : roadRand < 0.7 ? 'LINK_ROAD' : roadRand < 0.92 ? 'CUBBON_ROAD' : 'QUEENS_ROAD';

      let sx = 485;
      let sy = 510;
      let tx = 485;
      let ty = 260;
      let targetGate = 'G1';

      if (road === 'MG_ROAD') {
        sx = 520 + Math.random() * 180;
        sy = 480 + Math.random() * 35;
        targetGate = Math.random() < 0.5 ? 'G14' : 'G13';
        const ig = KSCA_INNER_GATES[targetGate] || KSCA_INNER_GATES.G14;
        tx = ig.x;
        ty = ig.y;
      } else if (road === 'CUBBON_ROAD') {
        sx = 340 + Math.random() * 320;
        sy = 40 + Math.random() * 25;
        targetGate = Math.random() < 0.5 ? 'G7' : 'G8';
        const ig = KSCA_INNER_GATES[targetGate] || KSCA_INNER_GATES.G7;
        tx = ig.x;
        ty = ig.y;
      } else if (road === 'LINK_ROAD') {
        sx = 730 + Math.random() * 20;
        sy = 160 + Math.random() * 260;
        targetGate = Math.random() < 0.5 ? 'G11' : 'G12';
        const ig = KSCA_INNER_GATES[targetGate] || KSCA_INNER_GATES.G11;
        tx = ig.x;
        ty = ig.y;
      } else {
        // Queens Road: VIP or diverted regular fan
        sx = 200 + Math.random() * 80;
        sy = 220 + Math.random() * 140;
        if (isVipMedia) {
          targetGate = 'G4';
          tx = 340;
          ty = 260;
        } else {
          // Divert toward Cubbon Road
          tx = 360;
          ty = 65;
        }
      }

      // Linear interpolation if spawning mid-journey
      const currX = sx + (tx - sx) * progressAdvance;
      const currY = sy + (ty - sy) * progressAdvance;

      agentsRef.current.push({
        id,
        x: currX,
        y: currY,
        vx: 0,
        vy: 0,
        radius: 3.2,
        targetX: tx,
        targetY: ty,
        density: 1.0,
        stuckTime: 0,
        color: '#38bdf8',
        desiredSpeed: walkingSpeed * (0.9 + Math.random() * 0.2),
        compressivePressure: 0,
        currentWaypointIndex: 0,
        assignedGateId: targetGate,
        sectorRoad: road,
        targetInnerGate: targetGate,
        isVipMedia,
        entryTime: performance.now(),
        clearanceAlpha: 1.0
      });
    } else {
      // Sector Concourse View: Spawn along active sector's arrival street
      const secData = activeSectorData;
      const randomInnerGate =
        secData.innerGates[Math.floor(Math.random() * secData.innerGates.length)] || secData.innerGates[0];

      const startY = 490 + Math.random() * 30;
      const startX = randomInnerGate.x + (Math.random() - 0.5) * 80;

      const waypoints = getSectorWaypoints(selectedSector, randomInnerGate.id, startY);
      const isRejectionCandidate = counterFlowActive && Math.random() < 0.08;

      agentsRef.current.push({
        id,
        x: startX,
        y: startY,
        vx: 0,
        vy: -walkingSpeed * 18,
        radius: 3.5,
        targetX: waypoints[0]?.x ?? randomInnerGate.x,
        targetY: waypoints[0]?.y ?? randomInnerGate.y,
        density: 1.0,
        stuckTime: 0,
        color: '#38bdf8',
        desiredSpeed: walkingSpeed * (0.9 + Math.random() * 0.2),
        compressivePressure: 0,
        waypoints,
        currentWaypointIndex: 0,
        assignedGateId: randomInnerGate.id,
        sectorRoad: selectedSector,
        targetInnerGate: randomInnerGate.id,
        isRejected: isRejectionCandidate,
        isVipMedia,
        entryTime: performance.now(),
        clearanceAlpha: 1.0,
        friskingRemaining: baggageScanLatency,
        turnstileScanRemaining: turnstileScanLatency
      });
    }
  };

  // Main Simulation & Rendering Loop
  useEffect(() => {
    let animId: number;

    const render = (time: number) => {
      const rawDt = (time - lastTimeRef.current) / 1000;
      lastTimeRef.current = time;
      const dt = isPaused ? 0 : Math.min(0.05, Math.max(0.005, rawDt)) * timeScale;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      flashTimerRef.current += dt;
      const isFlashTick = Math.sin(flashTimerRef.current * 8) > 0;

      // 1. Spawning Inflow
      if (!isPaused && dt > 0) {
        const spawnsPerSec = inflowRate / 60;
        spawnAccRef.current += spawnsPerSec * dt;
        while (spawnAccRef.current >= 1.0) {
          spawnAgent(0);
          spawnAccRef.current -= 1.0;
        }
      }

      // 2. Physics & Crowd Interactions
      const emptyWalls: Wall[] = [];
      const agents = agentsRef.current;
      const spatialGrid = spatialGridRef.current;

      calculateCrowdInteractions(agents, spatialGrid, dt, isFlashTick);

      let streetBacklogCount = 0;
      let concourseCrowdCount = 0;
      let clearedThisFrame = 0;

      for (let i = agents.length - 1; i >= 0; i--) {
        const ag = agents[i];

        if (ag.y >= 440) streetBacklogCount++;
        else concourseCrowdCount++;

        // Update physics movement
        updateAgentPhysics(ag, dt, walkingSpeed, emptyWalls, [], false);

        // Turnstile Processing & Clearance in Concourse Mode
        if (currentView === 'SECTOR_CONCOURSE') {
          // If agent reached turnstiles (y <= 175)
          if (ag.y <= 175 && !ag.isCleared) {
            if (ag.isRejected) {
              // Trigger reverse flow shockwave toward street
              ag.isReverse = true;
              ag.color = '#f43f5e';
            } else {
              ag.turnstileScanRemaining = (ag.turnstileScanRemaining ?? turnstileScanLatency) - dt;
              if (ag.turnstileScanRemaining <= 0) {
                ag.isCleared = true;
                clearedThisFrame++;
                const waitSec = (time - (ag.entryTime || time)) / 1000;
                waitTimesRef.current.push(waitSec);
                if (waitTimesRef.current.length > 40) waitTimesRef.current.shift();
                throughputHistoryRef.current.push(time);
              }
            }
          }

          // Smooth fade-out into seating bowl after vomitories (y <= 75)
          if (ag.isCleared && ag.y <= 75) {
            ag.clearanceAlpha = (ag.clearanceAlpha ?? 1.0) - dt * 1.5;
            if (ag.clearanceAlpha <= 0.05) {
              incrementSeatedCount(1);
              agents.splice(i, 1);
              continue;
            }
          }
        }

        // Remove out-of-bounds agents
        if (ag.y < -30 || ag.y > CANVAS_HEIGHT + 40 || ag.x < -30 || ag.x > CANVAS_WIDTH + 30) {
          agents.splice(i, 1);
        }
      }

      // Displaced Plaza Crush Tracking:
      // If outer gates throttle flow, shifting density onto the public road > 5.0 p/m²
      const streetDensity = streetBacklogCount / 38; // approx area density
      displacedCrushRef.current = streetDensity > 4.8;

      // 3. Telemetry Dispatch
      const now = performance.now();
      const recentThroughput = throughputHistoryRef.current.filter((t) => now - t <= 5000).length * 12;
      const peakDens = agents.reduce((max, a) => Math.max(max, a.density || 0), 0);

      setTelemetry({
        liveAgents: agents.length,
        peakDensity: peakDens,
        throughputPerMin: recentThroughput,
        counterFlowPenaltyPercent: counterFlowActive ? -38 : 0,
        displacedCrushAdvisory: displacedCrushRef.current
          ? 'WARNING: Displaced Crush Detected. Throttling Inner Gates moved queue compression onto the public roadway.'
          : null
      });

      // 4. Canvas Drawing Pipeline
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      if (currentView === 'MACRO_STADIUM') {
        drawMacroStadiumSatelliteView(ctx, time, agents, isFlashTick);
      } else {
        drawSectorConcourseCADView(ctx, time, agents, isFlashTick);
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [
    currentView,
    selectedSector,
    inflowRate,
    baggageScanLatency,
    turnstileScanLatency,
    walkingSpeed,
    counterFlowActive,
    isPaused,
    timeScale
  ]);

  /**
   * MODE A: 360° Macro Stadium Satellite CAD View
   * Renders perimeter roads, cricket pitch, seating bowl, 2-tier gate halos & live crowd plumes
   */
  const drawMacroStadiumSatelliteView = (
    ctx: CanvasRenderingContext2D,
    _time: number,
    agents: AgentData[],
    isFlashTick: boolean
  ) => {
    const cx = 485;
    const cy = 260;

    // Background tactical grid
    ctx.fillStyle = '#060b13';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.strokeStyle = 'rgba(30, 41, 59, 0.2)';
    ctx.lineWidth = 1;
    for (let x = 0; x < CANVAS_WIDTH; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y < CANVAS_HEIGHT; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_WIDTH, y);
      ctx.stroke();
    }

    // 1. Cubbon Road (North Arterial with bus stops)
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(80, 32, CANVAS_WIDTH - 120, 52);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.strokeRect(80, 32, CANVAS_WIDTH - 120, 52);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.setLineDash([12, 10]);
    ctx.beginPath();
    ctx.moveTo(80, 58);
    ctx.lineTo(CANVAS_WIDTH - 40, 58);
    ctx.stroke();
    ctx.setLineDash([]);

    // Cubbon Road Label
    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'center';
    ctx.fillText('CUBBON ROAD (MINSK SQUARE ──► BRV JUNCTION)', cx, 48);

    // Metro Station Badge
    ctx.fillStyle = 'rgba(14, 165, 233, 0.2)';
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(100, 40, 110, 24, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 8px "JetBrains Mono", monospace';
    ctx.fillText('🚆 METRO STATION', 155, 55);

    // 2. Link Road & St. Marks Road (East Arterial)
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(715, 32, 55, CANVAS_HEIGHT - 64);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.strokeRect(715, 32, 55, CANVAS_HEIGHT - 64);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.moveTo(742, 32);
    ctx.lineTo(742, CANVAS_HEIGHT - 32);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.save();
    ctx.translate(752, 280);
    ctx.rotate(Math.PI / 2);
    ctx.font = 'bold 9px "JetBrains Mono", monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('LINK ROAD & ST. MARKS ROAD', 0, 0);
    ctx.restore();

    // 3. MG Road & Anil Kumble Circle (South Arterial)
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(380, 480, CANVAS_WIDTH - 380, 50);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.strokeRect(380, 480, CANVAS_WIDTH - 380, 50);

    // MG Road Metro Plaza Ingress Corridor
    const plazaGrad = ctx.createLinearGradient(480, 480, 640, 380);
    plazaGrad.addColorStop(0, 'rgba(249, 115, 22, 0.2)');
    plazaGrad.addColorStop(1, 'rgba(249, 115, 22, 0.02)');
    ctx.fillStyle = plazaGrad;
    ctx.beginPath();
    ctx.moveTo(480, 480);
    ctx.lineTo(715, 480);
    ctx.lineTo(650, 380);
    ctx.lineTo(520, 390);
    ctx.closePath();
    ctx.fill();

    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    ctx.fillStyle = '#f97316';
    ctx.fillText('MG ROAD METRO PLAZA (MASS INGRESS)', 600, 440);
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('MG ROAD & ANIL KUMBLE CIRCLE', 560, 510);

    // 4. Queens Road (West Arterial - RESTRICTED)
    ctx.save();
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(170, 84);
    ctx.lineTo(410, 500);
    ctx.stroke();
    ctx.setLineDash([]);

    // Warning Banner: Queens Road Closed
    ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(175, 270, 185, 30, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isFlashTick ? '#fca5a5' : '#ef4444';
    ctx.font = 'bold 8px "JetBrains Mono", monospace';
    ctx.fillText('⚠️ NO SPECTATOR ENTRY', 268, 284);
    ctx.fillStyle = '#f87171';
    ctx.font = '7px "JetBrains Mono", monospace';
    ctx.fillText('POLICE / MEDIA / VIP ONLY', 268, 294);
    ctx.restore();

    // Mahatma Gandhi Park
    ctx.fillStyle = 'rgba(6, 78, 59, 0.35)';
    ctx.strokeStyle = '#047857';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(230, 150);
    ctx.lineTo(340, 140);
    ctx.lineTo(320, 240);
    ctx.lineTo(210, 210);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 8px "JetBrains Mono", monospace';
    ctx.fillText('MAHATMA GANDHI', 270, 185);
    ctx.fillText('PARK', 270, 196);

    // 5. Cricket Stadium CAD Structure: Grass Outfield & Seating Bowl
    const rx = 185;
    const ry = 155;

    // Outer Seating Bowl Ring with Sector Colors
    const stands = [
      { name: 'C & D STAND (NORTH)', angleStart: -140, angleEnd: -40, color: '#0284c7' },
      { name: 'E STAND (EAST)', angleStart: -40, angleEnd: 45, color: '#f97316' },
      { name: 'H UPPER & P TERRACE (SOUTH)', angleStart: 45, angleEnd: 140, color: '#c084fc' },
      { name: 'A & B STAND (WEST)', angleStart: 140, angleEnd: 220, color: '#10b981' }
    ];

    for (const st of stands) {
      const a1 = (st.angleStart * Math.PI) / 180;
      const a2 = (st.angleEnd * Math.PI) / 180;
      ctx.strokeStyle = st.color;
      ctx.lineWidth = 26;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, a1, a2);
      ctx.stroke();
    }

    // Concentric Grass Turf Stripes
    const pitchRx = 135;
    const pitchRy = 115;
    for (let s = 6; s >= 1; s--) {
      const f = s / 6;
      ctx.fillStyle = s % 2 === 0 ? '#15803d' : '#166534';
      ctx.beginPath();
      ctx.ellipse(cx, cy, pitchRx * f, pitchRy * f, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Boundary Rope
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, pitchRx, pitchRy, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Central Cricket Pitch & Crease
    ctx.fillStyle = '#fde68a';
    ctx.fillRect(cx - 7, cy - 22, 14, 44);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 7, cy - 18);
    ctx.lineTo(cx + 7, cy - 18);
    ctx.moveTo(cx - 7, cy + 18);
    ctx.lineTo(cx + 7, cy + 18);
    ctx.stroke();

    // 6. Thermal Density Halos & Gate Plumes
    (Object.values(KSCA_OUTER_GATES) as OuterGate[]).forEach((og) => {
      // Find nearby agents to determine live density
      const nearby = agents.filter((a) => Math.hypot(a.x - og.x, a.y - og.y) < 35);
      const density = nearby.length / 3.0;

      let haloColor = 'rgba(56, 189, 248, 0.4)'; // Cyan
      if (density >= 4.5) haloColor = 'rgba(244, 63, 94, 0.7)'; // Red
      else if (density >= 2.8) haloColor = 'rgba(245, 158, 11, 0.6)'; // Amber
      else if (density >= 1.5) haloColor = 'rgba(16, 185, 129, 0.5)'; // Green

      const grad = ctx.createRadialGradient(og.x, og.y, 2, og.x, og.y, 28);
      grad.addColorStop(0, haloColor);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(og.x, og.y, 28, 0, Math.PI * 2);
      ctx.fill();

      // Outer Gate Badge
      ctx.fillStyle = og.allowedSpectators ? '#ea580c' : '#dc2626';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(og.x, og.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 7px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(og.id, og.x, og.y);
    });

    // 7. Inner Stand Gate Badges (G1 to G14)
    (Object.values(KSCA_INNER_GATES) as InnerGate[]).forEach((ig) => {
      ctx.fillStyle = '#0284c7';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(ig.x, ig.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 7px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ig.id, ig.x, ig.y);
    });

    // 8. Draw Live Pedestrian Agents
    for (let i = 0; i < agents.length; i++) {
      const a = agents[i];
      ctx.fillStyle = a.color;
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  /**
   * MODE B: Road Sector Quarter-Circle Micro Concourse CAD View
   * Renders the 1:1 scale architectural engineering CAD concourse for the active sector
   */
  const drawSectorConcourseCADView = (
    ctx: CanvasRenderingContext2D,
    _time: number,
    agents: AgentData[],
    isFlashTick: boolean
  ) => {
    const secData = activeSectorData;

    // Tactical blueprint background
    ctx.fillStyle = '#060b13';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Architectural Radial Sector Concourse Arcs
    const cx = CANVAS_WIDTH / 2;
    const cy = -800; // Curvature origin far above canvas

    // 1. Top Grandstand Seating Bowl Bleed (y <= 70)
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(cx, cy, 875, 1.1, 2.04);
    ctx.lineTo(CANVAS_WIDTH, 0);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fill();

    // Grandstand Seating Rows in RCB Scarlet & Gold
    for (let r = 810; r <= 865; r += 14) {
      ctx.strokeStyle = r % 28 === 0 ? 'rgba(185, 28, 28, 0.8)' : 'rgba(217, 119, 6, 0.8)';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 1.12, 2.02);
      ctx.stroke();
    }

    // Seating Bowl Title
    ctx.font = 'bold 11px "JetBrains Mono", monospace';
    ctx.fillStyle = '#fde047';
    ctx.textAlign = 'center';
    ctx.fillText(`${secData.name.toUpperCase()} SEATING BOWL (35,000 VENUE CAPACITY)`, cx, 28);

    // 2. Vomitory Stairwells to Seating Stands (y = 75)
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    secData.innerGates.forEach((ig, idx) => {
      const vx = ig.x;
      const vy = 75;

      // Vomitory portal box
      ctx.fillStyle = 'rgba(14, 165, 233, 0.2)';
      ctx.fillRect(vx - 28, vy - 12, 56, 24);
      ctx.strokeRect(vx - 28, vy - 12, 56, 24);

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 8px "JetBrains Mono", monospace';
      ctx.fillText(`VOMITORY ${idx + 1}`, vx, vy - 1);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '7px "JetBrains Mono", monospace';
      ctx.fillText(ig.stand, vx, vy + 8);
    });

    // 3. Inner Turnstile Gantry Facility (y = 160)
    const turnstileY = 160;
    const compoundWidth = secData.innerGates.length * 80 + 40;
    const compoundLeft = cx - compoundWidth / 2;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 2;
    ctx.roundRect(compoundLeft, turnstileY - 24, compoundWidth, 48, 8);
    ctx.fill();
    ctx.stroke();

    // Facility Label
    ctx.font = 'bold 9px "JetBrains Mono", monospace';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(`${secData.name.toUpperCase()} INGRESS FACILITY`, cx, turnstileY - 12);

    // Render Turnstile Booths for this sector
    secData.innerGates.forEach((ig) => {
      const bx = ig.x;
      const by = turnstileY + 6;
      const overrideCount = sectorTurnstileOverrides[ig.id] || ig.turnstileCount;

      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#0ea5e9';
      ctx.lineWidth = 1.5;
      ctx.fillRect(bx - 32, by - 12, 64, 24);
      ctx.strokeRect(bx - 32, by - 12, 64, 24);

      ctx.font = 'bold 8px "JetBrains Mono", monospace';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(`${ig.id}: ${overrideCount} Turnstiles`, bx, by - 1);
      ctx.font = '7px "JetBrains Mono", monospace';
      ctx.fillStyle = '#34d399';
      ctx.fillText(`${overrideCount * 60} p/min`, bx, by + 8);
    });

    // Automated NFC Fast Scan Bar (y = 210)
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#06b6d4';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(compoundLeft - 20, 210);
    ctx.lineTo(compoundLeft + compoundWidth + 20, 210);
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.font = 'bold 8px "JetBrains Mono", monospace';
    ctx.fillStyle = '#22d3ee';
    ctx.fillText('AUTOMATED NFC SCAN LINE (0.2s TAP)', cx, 222);

    // Dynamic Reroute Alert Banner
    if (counterFlowActive) {
      ctx.fillStyle = isFlashTick ? 'rgba(244, 63, 94, 0.25)' : 'rgba(244, 63, 94, 0.15)';
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 1.5;
      ctx.roundRect(cx - 160, 245, 320, 24, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#fda4af';
      ctx.font = 'bold 8px "JetBrains Mono", monospace';
      ctx.fillText('⚠️ 8% TICKET REJECTION COUNTER-FLOW SHOCKWAVE ACTIVE', cx, 260);
    }

    // 4. Intermediate Concourse Holding Plaza (y = 280 to 440)
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.25)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(100, 360);
    ctx.lineTo(CANVAS_WIDTH - 100, 360);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.font = 'bold 8px "JetBrains Mono", monospace';
    ctx.fillStyle = '#64748b';
    ctx.fillText('18-METER INTERMEDIATE HOLDING CONCOURSE', cx, 355);

    // 5. Outer Street Sidewalk & Outer Security Frisking (y = 470 to 520)
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(40, 470, CANVAS_WIDTH - 80, 56);
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 3;
    ctx.strokeRect(40, 470, CANVAS_WIDTH - 80, 56);

    // Roadway Name & Direction
    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    ctx.fillStyle = secData.isSpectatorPermitted ? '#f97316' : '#ef4444';
    ctx.fillText(secData.roadLabel.toUpperCase(), cx, 514);

    // Outer Gate Badges along sidewalk
    const numOuter = secData.outerGates.length;
    const outerSpacing = (CANVAS_WIDTH - 240) / Math.max(1, numOuter - 1);
    secData.outerGates.forEach((gid, i) => {
      const gx = 120 + i * outerSpacing;
      const gy = 470;

      ctx.fillStyle = secData.isSpectatorPermitted ? '#ea580c' : '#dc2626';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(gx, gy, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 7px "JetBrains Mono", monospace';
      ctx.fillText(gid, gx, gy);
    });

    // 6. Draw Pedestrian Agents with alpha clearance
    for (let i = 0; i < agents.length; i++) {
      const a = agents[i];
      ctx.save();
      ctx.globalAlpha = a.clearanceAlpha ?? 1.0;
      ctx.fillStyle = a.color;
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  };

  // Interactive Click Navigation between Macro & Sector Views
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    if (currentView === 'MACRO_STADIUM') {
      // Check which sector was clicked:
      if (clickY <= 100) {
        setSelectedSector('CUBBON_ROAD');
        setCurrentView('SECTOR_CONCOURSE');
      } else if (clickX >= 680) {
        setSelectedSector('LINK_ROAD');
        setCurrentView('SECTOR_CONCOURSE');
      } else if (clickY >= 420) {
        setSelectedSector('MG_ROAD');
        setCurrentView('SECTOR_CONCOURSE');
      } else if (clickX <= 380 && clickY >= 120) {
        setSelectedSector('QUEENS_ROAD');
        setCurrentView('SECTOR_CONCOURSE');
      }
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col bg-slate-950 rounded-xl overflow-hidden border border-slate-800">
      {/* Top Floating View Switcher & Metro Pulse */}
      <div className="absolute top-2.5 left-3 z-10 flex items-center gap-1.5 p-1 rounded-lg bg-slate-900/95 border border-slate-700/80 backdrop-blur-md shadow-xl text-xs font-mono">
        <button
          onClick={() => setCurrentView('MACRO_STADIUM')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold transition ${
            currentView === 'MACRO_STADIUM'
              ? 'bg-cyan-950 text-cyan-300 border border-cyan-500 shadow-sm ring-1 ring-cyan-500/60'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Full Stadium 360° Satellite CAD Radar"
        >
          <Globe className="w-3.5 h-3.5 text-cyan-400" />
          <span>Full Stadium 360° Radar</span>
        </button>

        <div className="h-4 w-[1px] bg-slate-700 mx-0.5" />

        <button
          onClick={() => setCurrentView('SECTOR_CONCOURSE')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold transition ${
            currentView === 'SECTOR_CONCOURSE'
              ? 'bg-amber-950 text-amber-300 border border-orange-500 shadow-sm ring-1 ring-orange-500/60'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="1:1 Architectural Sector Concourse"
        >
          <DoorOpen className="w-3.5 h-3.5 text-amber-400" />
          <span>Sector Concourse View</span>
        </button>

        <div className="h-4 w-[1px] bg-slate-700 mx-0.5" />

        {/* Quick Metro Pulse Spawner */}
        <button
          onClick={() => useSimulationStore.getState().triggerMetroPulse()}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-rose-300 border border-rose-800/60 shadow-md transition active:scale-95"
          title="Simulate Metro Purple Line Arrival (+500 Agents)"
        >
          <Train className="w-3.5 h-3.5 text-rose-400" />
          <span>Metro (+500)</span>
        </button>
      </div>

      {/* Floating Concourse Mini-HUD */}
      <div className="absolute top-2.5 right-3 z-10 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-700/80 backdrop-blur-md shadow-xl text-xs font-mono">
        <div className="flex flex-col">
          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
            {currentView === 'MACRO_STADIUM' ? 'FULL STADIUM 360° RADAR' : activeSectorData.name}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-cyan-400 font-bold flex items-center gap-1">
              <Zap className="w-3 h-3 text-cyan-400" />
              <span>{inflowRate} p/min</span>
            </span>
            <span className="text-slate-500">•</span>
            <span className="text-amber-400 font-bold flex items-center gap-1">
              <Clock className="w-3 h-3 text-amber-400" />
              <span>
                {waitTimesRef.current.length > 0
                  ? (
                      waitTimesRef.current.reduce((a, b) => a + b, 0) /
                      waitTimesRef.current.length
                    ).toFixed(1)
                  : '14.2'}
                s avg wait
              </span>
            </span>
            <span className="text-slate-500">•</span>
            <span className="text-emerald-400 font-bold">
              {stadiumSeatedCount.toLocaleString()} seated
            </span>
          </div>
        </div>
      </div>

      {/* Displaced Crush Advisory Banner */}
      {displacedCrushRef.current && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-950/95 border border-rose-600 shadow-2xl text-xs font-mono text-rose-200 animate-pulse">
          <AlertTriangle className="w-4 h-4 text-rose-400" />
          <span>WARNING: Displaced Crush Detected. Throttling Inner Gates moved queue compression onto the public roadway.</span>
        </div>
      )}

      {/* Queens Road Restriction Advisory */}
      {currentView === 'SECTOR_CONCOURSE' && selectedSector === 'QUEENS_ROAD' && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-4 py-1.5 rounded-lg bg-red-950/90 border border-red-600 text-[11px] font-mono text-red-200 shadow-xl">
          <ShieldAlert className="w-4 h-4 text-red-400" />
          <span>NO SPECTATOR ENTRY - POLICE / MEDIA / VIP ONLY (ROAD CLOSED - DIVERSION IN EFFECT)</span>
        </div>
      )}

      {/* Canvas Viewport */}
      <div className="flex-1 min-h-0 w-full h-full relative">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          onClick={handleCanvasClick}
          className={`w-full h-full object-contain block ${
            currentView === 'MACRO_STADIUM' ? 'cursor-pointer' : ''
          }`}
        />
      </div>
    </div>
  );
};

export default SimulationCanvas;
