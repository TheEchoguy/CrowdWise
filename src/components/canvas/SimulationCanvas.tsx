import React, { useEffect, useRef } from 'react';
import { useSimulationStore } from '../../state/useSimulationStore';
import {
  getScenarioGeometry,
  getSCurveWaypoints,
  getGate2Waypoints,
  getSouthWaypoints,
  getNorthWaypoints,
  getWestWaypoints
} from '../../engine/Geometry';
import { SpatialGrid } from '../../engine/SpatialGrid';
import { updateAgentPhysics, calculateCrowdInteractions } from '../../engine/SocialForceEngine';
import { AgentData, Gate, Wall, ActiveRerouteAlert, GateCompound } from '../../types/simulation';
import { CHINNASWAMY_CONFIG } from '../../engine/ChinnaswamyData';
import { Train, Plus, Minus } from 'lucide-react';

export const SimulationCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Store Subscriptions
  const scenario = useSimulationStore((s) => s.scenario);
  const viewMode = useSimulationStore((s) => s.viewMode);
  const setViewMode = useSimulationStore((s) => s.setViewMode);
  const stadiumViewMode = useSimulationStore((s) => s.stadiumViewMode);
  const setStadiumViewMode = useSimulationStore((s) => s.setStadiumViewMode);
  const activeSector = useSimulationStore((s) => s.activeSector);
  const setActiveSector = useSimulationStore((s) => s.setActiveSector);
  const activeGateSector = useSimulationStore((s) => s.activeGateSector);
  const setActiveGateSector = useSimulationStore((s) => s.setActiveGateSector);
  const overflowRerouteActive = useSimulationStore((s) => s.overflowRerouteActive);
  const scannerFailureActive = useSimulationStore((s) => s.scannerFailureActive);
  const autonomousRerouteActive = useSimulationStore((s) => s.autonomousRerouteActive);
  const metroPulseSignal = useSimulationStore((s) => s.metroPulseSignal);
  const triggerMetroPulse = useSimulationStore((s) => s.triggerMetroPulse);
  const incrementSeatedCount = useSimulationStore((s) => s.incrementSeatedCount);
  const setAuxGateActive = useSimulationStore((s) => s.setAuxGateActive);

  // Dynamic Multi-Counter & S-Queue Store Parameters
  const counterCountGate1 = useSimulationStore((s) => s.counterCountGate1);
  const counterCountGate2 = useSimulationStore((s) => s.counterCountGate2);
  const addCounter = useSimulationStore((s) => s.addCounter);
  const removeCounter = useSimulationStore((s) => s.removeCounter);
  const sQueueEnabled = useSimulationStore((s) => s.sQueueEnabled);
  const scannerSpeed = useSimulationStore((s) => s.scannerSpeed);
  const securityCheckSpeed = useSimulationStore((s) => s.securityCheckSpeed);

  const inflowRate = useSimulationStore((s) => s.inflowRate);
  const gateLatency = useSimulationStore((s) => s.gateLatency);
  const walkingSpeed = useSimulationStore((s) => s.walkingSpeed);
  const bafflesActive = useSimulationStore((s) => s.bafflesActive);
  const auxGateActive = useSimulationStore((s) => s.auxGateActive);
  const dividerActive = useSimulationStore((s) => s.dividerActive);
  const isPaused = useSimulationStore((s) => s.isPaused);
  const timeScale = useSimulationStore((s) => s.timeScale);
  const resetSignal = useSimulationStore((s) => s.resetSignal);
  const surgeSignal = useSimulationStore((s) => s.surgeSignal);
  const surgeCount = useSimulationStore((s) => s.surgeCount);
  const setTelemetry = useSimulationStore((s) => s.setTelemetry);

  // Mutable Physics References across animation frames
  const agentsRef = useRef<AgentData[]>([]);
  const nextIdRef = useRef<number>(1);
  const spawnAccRef = useRef<number>(0);
  const throughputHistoryRef = useRef<number[]>([]);
  const fastScanHistoryRef = useRef<number[]>([]);
  const securityCheckHistoryRef = useRef<number[]>([]);
  const waitTimesRef = useRef<number[]>([]);

  const spatialGridRef = useRef<SpatialGrid>(new SpatialGrid(32));
  const wallsRef = useRef<Wall[]>([]);
  const gatesRef = useRef<Gate[]>([]);
  const bafflesRef = useRef<Wall[]>([]);
  const compoundsRef = useRef<GateCompound[]>([]);

  // Telemetry Throttle References & Moving Window
  const lastTelemetryDispatchRef = useRef<number>(0);
  const densityHistoryRef = useRef<{ time: number; density: number }[]>([]);
  const fpsWindowRef = useRef<number[]>([]);
  const lastTimeRef = useRef<number>(performance.now());
  const flashTimerRef = useRef<number>(0);
  const rerouteAlertRef = useRef<ActiveRerouteAlert | null>(null);

  const CANVAS_WIDTH = 960;
  const CANVAS_HEIGHT = 580;
  const PPM = 20; // 20 pixels = 1 meter

  // Initialize or Reset Arena Geometry
  const initSimulation = () => {
    const geo = getScenarioGeometry(
      scenario,
      CANVAS_WIDTH,
      CANVAS_HEIGHT,
      bafflesActive,
      auxGateActive,
      dividerActive,
      stadiumViewMode,
      overflowRerouteActive,
      counterCountGate1,
      counterCountGate2,
      sQueueEnabled,
      activeGateSector
    );
    wallsRef.current = geo.walls;
    gatesRef.current = geo.gates.map((g) => ({ ...g, cooldown: 0, totalPassed: 0 }));
    bafflesRef.current = geo.baffles;
    compoundsRef.current = geo.compounds || [];

    // Reset agents and seed initial crowd
    agentsRef.current = [];
    nextIdRef.current = 1;
    spawnAccRef.current = 0;
    throughputHistoryRef.current = [];
    fastScanHistoryRef.current = [];
    securityCheckHistoryRef.current = [];
    waitTimesRef.current = [];
    densityHistoryRef.current = [];
    rerouteAlertRef.current = null;

    const initialCount =
      scenario === 'stadium'
        ? stadiumViewMode === 'MACRO_VIEW'
          ? 80
          : 50
        : scenario === 'bridge'
        ? 50
        : 40;
    seedInitialAgents(initialCount);
  };

  const seedInitialAgents = (count: number) => {
    for (let i = 0; i < count; i++) {
      spawnNewAgent();
    }
  };

  const spawnNewAgent = (overrideSpeedMultiplier = 1.0) => {
    const id = nextIdRef.current++;
    const radius = 5.0 + Math.random() * 1.0; // ~0.5m pedestrian diameter

    let x = 0;
    let y = 0;
    let targetX = 0;
    let targetY = 0;
    let isReverse = false;
    let color = '#10b981';
    let assignedSector: 'EAST' | 'WEST' | 'NORTH' | 'SOUTH' = 'EAST';
    let assignedGateId = 'gate-1';
    let waypoints: { x: number; y: number }[] | undefined = undefined;
    let currentWaypointIndex = 0;
    let stage: 1 | 2 | 3 = 1;

    const gate1X = 365;
    const gate1Left = 205;
    const gate1Right = 525;
    const gate2X = CANVAS_WIDTH * 0.77;
    const scanBarY = 80;

    if (scenario === 'stadium') {
      if (stadiumViewMode === 'MACRO_VIEW') {
        const sectors: ('EAST' | 'WEST' | 'NORTH' | 'SOUTH')[] = ['EAST', 'EAST', 'NORTH', 'SOUTH', 'WEST'];
        assignedSector = sectors[Math.floor(Math.random() * sectors.length)];

        const cx = CANVAS_WIDTH / 2;
        const cy = CANVAS_HEIGHT / 2;

        if (assignedSector === 'EAST') {
          x = CANVAS_WIDTH - 30 - Math.random() * 40;
          y = cy + (Math.random() - 0.5) * 120;
          color = '#f97316';
        } else if (assignedSector === 'SOUTH') {
          x = cx + (Math.random() - 0.5) * 160;
          y = CANVAS_HEIGHT - 30 - Math.random() * 30;
          color = '#a855f7';
        } else if (assignedSector === 'NORTH') {
          x = cx + (Math.random() - 0.5) * 160;
          y = 30 + Math.random() * 30;
          color = '#38bdf8';
        } else {
          x = 30 + Math.random() * 40;
          y = cy + (Math.random() - 0.5) * 100;
          color = '#10b981';
        }

        const sectorGates = gatesRef.current.filter((g) => g.sector === assignedSector);
        if (sectorGates.length > 0) {
          const chosenGate = sectorGates[Math.floor(Math.random() * sectorGates.length)];
          targetX = chosenGate.x;
          targetY = chosenGate.y;
          assignedGateId = chosenGate.id;
        } else {
          targetX = cx;
          targetY = cy;
        }
      } else {
        // Micro View Concourse: 8 Discrete Distributed Feeder Slots (eliminates spawn-line freezing)
        const boulevardLeft = CANVAS_WIDTH * 0.12;
        const boulevardRight = CANVAS_WIDTH * 0.88;
        const numSlots = 8;
        const slotWidth = (boulevardRight - boulevardLeft) / numSlots;
        const slotIdx = (id * 3 + Math.floor(Math.random() * 2)) % numSlots;
        const slotCenterX = boulevardLeft + slotWidth * (slotIdx + 0.5);
        x = slotCenterX + (Math.random() - 0.5) * (slotWidth * 0.55);
        y = CANVAS_HEIGHT - 35 - (slotIdx % 3) * 16 + (Math.random() - 0.5) * 8;

        if (activeGateSector === 'G7-G11_SOUTH') {
          assignedGateId = 'gate-south';
          color = '#a855f7';
          stage = 1;
          const southLanes = [360, 440, 520, 600];
          targetX = southLanes[id % southLanes.length];
          waypoints = getSouthWaypoints(targetX, scanBarY, y);
          currentWaypointIndex = 0;
          targetY = waypoints[0]?.y ?? 330;
        } else if (activeGateSector === 'G16-G21_NORTH') {
          assignedGateId = 'gate-north';
          color = '#38bdf8';
          stage = 1;
          const northLanes = [350, 415, 480, 545, 610];
          targetX = northLanes[id % northLanes.length];
          waypoints = getNorthWaypoints(targetX, scanBarY, y);
          currentWaypointIndex = 0;
          targetY = waypoints[0]?.y ?? 340;
        } else if (activeGateSector === 'G12-G15_WEST') {
          assignedGateId = 'gate-west';
          color = '#eab308';
          stage = 1;
          const vipLanes = [410, 480, 550];
          targetX = vipLanes[id % vipLanes.length];
          waypoints = getWestWaypoints(targetX, scanBarY, y);
          currentWaypointIndex = 0;
          targetY = waypoints[0]?.y ?? 300;
        } else {
          // G1-G6_EAST (default East Stand)
          const isBypassOpen = auxGateActive || overflowRerouteActive;
          const isRerouteNeeded = autonomousRerouteActive && rerouteAlertRef.current !== null;

          // Dynamic Routing Assignment:
          if ((isBypassOpen && x > CANVAS_WIDTH * 0.54) || (isRerouteNeeded && id % 2 === 0)) {
            // Gate 2 (Auxiliary Bypass Compound)
            assignedGateId = 'gate-2';
            waypoints = getGate2Waypoints(gate2X, scanBarY, y);
            targetX = waypoints[0]?.x ?? gate2X;
            targetY = waypoints[0]?.y ?? (scanBarY + 12);
            color = '#06b6d4'; // Cyan diverted flow
            currentWaypointIndex = 0;
            stage = 1;
          } else {
            // Gate 1 (Wide 320px Compound with 3-Tier S-Queue)
            assignedGateId = 'gate-1';
            color = '#f97316'; // Amber main ingress
            stage = 1;

            if (sQueueEnabled || bafflesActive) {
              waypoints = getSCurveWaypoints(gate1X, gate1Left, gate1Right, scanBarY, y);
              currentWaypointIndex = 0;
              // Any agent assigned to Gate 1 MUST target this hopper entrance first
              targetX = waypoints[0].x;
              targetY = waypoints[0].y;
            } else {
              targetX = gate1X;
              targetY = scanBarY + 12;
            }
          }
        }
      }
    } else if (scenario === 'bridge') {
      if (id % 2 === 0) {
        x = 60 + Math.random() * 40;
        y = CANVAS_HEIGHT * 0.36 + Math.random() * (CANVAS_HEIGHT * 0.12);
        targetX = CANVAS_WIDTH - 45;
        targetY = y;
        isReverse = false;
        color = '#f59e0b';
      } else {
        x = CANVAS_WIDTH - 100 + Math.random() * 40;
        y = CANVAS_HEIGHT * 0.52 + Math.random() * (CANVAS_HEIGHT * 0.12);
        targetX = 45;
        targetY = y;
        isReverse = true;
        color = '#06b6d4';
      }
    } else if (scenario === 'reversal') {
      x = 80 + Math.random() * (CANVAS_WIDTH * 0.4);
      y = CANVAS_HEIGHT * 0.35 + Math.random() * (CANVAS_HEIGHT * 0.3);
      targetX = CANVAS_WIDTH - 80;
      targetY = CANVAS_HEIGHT * 0.5;
    }

    const initVy =
      scenario === 'stadium' && stadiumViewMode === 'MICRO_VIEW_EAST'
        ? -22 - Math.random() * 6
        : (Math.random() - 0.5) * 2;

    const agent: AgentData = {
      id,
      x,
      y,
      vx: (Math.random() - 0.5) * 2,
      vy: initVy,
      radius,
      targetX,
      targetY,
      density: 1.0,
      stuckTime: 0,
      color,
      isReverse,
      desiredSpeed: walkingSpeed * (0.9 + Math.random() * 0.2) * overrideSpeedMultiplier,
      compressivePressure: 0,
      active: true,
      assignedSector,
      assignedGateId,
      waypoints,
      currentWaypointIndex,
      stage,
      assignedCounterId: null,
      nfcTapRemaining: scannerSpeed,
      entryTime: performance.now(),
      isClearedConcourse: false
    };

    agentsRef.current.push(agent);
  };

  /**
   * Spawns an immediate dense synthetic surge wave cluster of agents
   */
  const triggerSurgeWave = (count: number) => {
    const isMetroPulse = count >= 200;
    const isMicro = scenario === 'stadium' && stadiumViewMode === 'MICRO_VIEW_EAST';

    const cols = isMetroPulse ? 25 : 15;
    const rows = Math.ceil(count / cols);

    const gate1X = 365;
    const gate1Left = 205;
    const gate1Right = 525;
    const gate2X = CANVAS_WIDTH * 0.77;
    const scanBarY = 80;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (r * cols + c >= count) break;
        const id = nextIdRef.current++;
        const radius = 5.0 + Math.random() * 0.8;

        let x = 0;
        let y = 0;
        let targetX = gate1X;
        let targetY = scanBarY + 12;
        let vx = (Math.random() - 0.5) * 2;
        let vy = -18 - Math.random() * 8;
        let isReverse = false;
        let assignedGateId = 'gate-1';
        let waypoints: { x: number; y: number }[] | undefined = undefined;
        let currentWaypointIndex = 0;

        if (isMicro) {
          const boulevardLeft = CANVAS_WIDTH * 0.12 + 15;
          const boulevardRight = CANVAS_WIDTH * 0.88 - 15;
          const colFrac = c / cols;
          x = boulevardLeft + colFrac * (boulevardRight - boulevardLeft);
          const curveOffset = Math.sin(colFrac * Math.PI) * 20;
          y = CANVAS_HEIGHT - 35 - r * 12 - curveOffset;

          const isBypassActive = auxGateActive || overflowRerouteActive;
          const divertToGate2 =
            (autonomousRerouteActive && (c % 2 === 0 || x > CANVAS_WIDTH * 0.52)) ||
            (isBypassActive && x > CANVAS_WIDTH * 0.54);

          if (divertToGate2) {
            assignedGateId = 'gate-2';
            targetX = gate2X;
            targetY = scanBarY + 12;
            waypoints = getGate2Waypoints(gate2X, scanBarY, y);
            currentWaypointIndex = 0;
          } else {
            assignedGateId = 'gate-1';
            targetX = gate1X;
            targetY = scanBarY + 12;
            if (sQueueEnabled || bafflesActive) {
              waypoints = getSCurveWaypoints(gate1X, gate1Left, gate1Right, scanBarY, y);
              currentWaypointIndex = 0;
            }
          }
        } else {
          x = CANVAS_WIDTH - 40 - r * 12;
          y = CANVAS_HEIGHT / 2 + (c - cols / 2) * 10;
          targetX = CANVAS_WIDTH * 0.85;
          targetY = CANVAS_HEIGHT / 2;
          vx = -20 - Math.random() * 6;
          vy = (Math.random() - 0.5) * 4;
        }

        const agent: AgentData = {
          id,
          x,
          y,
          vx,
          vy,
          radius,
          targetX,
          targetY,
          density: 4.5,
          stuckTime: 0,
          color: assignedGateId === 'gate-2' ? '#06b6d4' : isMetroPulse ? '#ef4444' : '#f97316',
          isReverse,
          desiredSpeed: walkingSpeed * 1.5,
          compressivePressure: isMetroPulse ? 28 : 16,
          active: true,
          assignedSector: 'EAST',
          assignedGateId,
          waypoints,
          currentWaypointIndex,
          stage: 1,
          assignedCounterId: null,
          nfcTapRemaining: scannerSpeed,
          entryTime: performance.now(),
          isClearedConcourse: false
        };
        agentsRef.current.push(agent);
      }
    }
  };

  // Re-sync geometry when scenario, stadiumViewMode or resetSignal changes
  useEffect(() => {
    initSimulation();
  }, [scenario, stadiumViewMode, resetSignal]);

  // Listen to surge signal from store
  useEffect(() => {
    if (surgeSignal > 0) {
      triggerSurgeWave(surgeCount || 45);
    }
  }, [surgeSignal]);

  // Listen to metro pulse signal from store
  useEffect(() => {
    if (metroPulseSignal > 0) {
      triggerSurgeWave(400);
    }
  }, [metroPulseSignal]);

  // Sync toggles with existing geometry without clearing crowd
  useEffect(() => {
    const geo = getScenarioGeometry(
      scenario,
      CANVAS_WIDTH,
      CANVAS_HEIGHT,
      bafflesActive,
      auxGateActive,
      dividerActive,
      stadiumViewMode,
      overflowRerouteActive,
      counterCountGate1,
      counterCountGate2,
      sQueueEnabled,
      activeGateSector
    );
    wallsRef.current = geo.walls;
    bafflesRef.current = geo.baffles;

    // Preserve existing counter progress while updating layout
    const oldCompounds = compoundsRef.current;
    compoundsRef.current = (geo.compounds || []).map((nc) => {
      const oc = oldCompounds.find((c) => c.id === nc.id);
      if (!oc) return nc;
      return {
        ...nc,
        counters: nc.counters.map((c) => {
          const oldC = oc.counters.find((x) => x.id === c.id);
          return oldC
            ? {
                ...c,
                totalProcessed: oldC.totalProcessed,
                isOccupied: oldC.isOccupied,
                status: oldC.status,
                processingRemaining: oldC.processingRemaining,
                occupantAgentId: oldC.occupantAgentId
              }
            : c;
        })
      };
    });

    // Keep existing gate stats while updating active status
    const newGates = geo.gates.map((g) => {
      const existing = gatesRef.current.find((eg) => eg.id === g.id);
      return existing
        ? { ...g, cooldown: existing.cooldown, totalPassed: existing.totalPassed, active: g.active }
        : { ...g, cooldown: 0, totalPassed: 0 };
    });
    gatesRef.current = newGates;

    // Update agent waypoints when S-Queue or bypass is toggled
    if (scenario === 'stadium' && stadiumViewMode === 'MICRO_VIEW_EAST') {
      const gate1X = 365;
      const gate1Left = 205;
      const gate1Right = 525;
      const gate2X = CANVAS_WIDTH * 0.77;
      const scanBarY = 80;

      for (const a of agentsRef.current) {
        if (a.isClearedConcourse) continue;
        if (a.assignedGateId === 'gate-1') {
          if (sQueueEnabled || bafflesActive) {
            a.waypoints = getSCurveWaypoints(gate1X, gate1Left, gate1Right, scanBarY, a.y);
            a.currentWaypointIndex = 0;
          } else {
            a.waypoints = undefined;
            a.targetX = gate1X;
            a.targetY = scanBarY + 12;
          }
        } else if (a.assignedGateId === 'gate-2') {
          a.waypoints = getGate2Waypoints(gate2X, scanBarY, a.y);
          a.currentWaypointIndex = 0;
          a.targetX = gate2X;
          a.targetY = scanBarY + 12;
        }
      }
    }
  }, [
    bafflesActive,
    auxGateActive,
    dividerActive,
    overflowRerouteActive,
    stadiumViewMode,
    counterCountGate1,
    counterCountGate2,
    sQueueEnabled
  ]);

  // Main 60 FPS RequestAnimationFrame Physics Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let animId: number;

    const renderLoop = (currentTime: number) => {
      const rawDt = (currentTime - lastTimeRef.current) / 1000;
      lastTimeRef.current = currentTime;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05) * timeScale;

      // Track FPS
      if (rawDt > 0) {
        fpsWindowRef.current.push(1 / rawDt);
        if (fpsWindowRef.current.length > 25) fpsWindowRef.current.shift();
      }
      const currentFps = Math.round(
        fpsWindowRef.current.reduce((a, b) => a + b, 0) / (fpsWindowRef.current.length || 1)
      );

      // Flash timer for >= 5.0 p/m² critical zones
      flashTimerRef.current += dt;
      const isFlashTick = Math.sin(flashTimerRef.current * 14) > 0;

      let peakDensity = 0;
      let maxSpillbackPx = 0;
      const primaryGate = gatesRef.current.find((g) => g.id === 'gate-1') || gatesRef.current[0];

      // Gate-by-gate analysis accumulators
      let gate1QueueCount = 0;
      let gate1DensitySum = 0;
      let gate2QueueCount = 0;
      let gate2DensitySum = 0;

      if (!isPaused) {
        // 1. Inflow Spawning
        const agentsPerSec = inflowRate / 60;
        spawnAccRef.current += agentsPerSec * dt;
        while (spawnAccRef.current >= 1.0) {
          spawnAccRef.current -= 1.0;
          if (agentsRef.current.length < 2800) {
            spawnNewAgent();
          }
        }

        // 2. Stage 3 Parallel Security Screening Counters Tick
        const isMicroStadium = scenario === 'stadium' && stadiumViewMode === 'MICRO_VIEW_EAST';
        if (isMicroStadium) {
          for (const compound of compoundsRef.current) {
            if (!compound.active) continue;
            for (const counter of compound.counters) {
              if (counter.isOccupied && counter.status === 'PROCESSING') {
                counter.processingRemaining = Math.max(0, counter.processingRemaining - dt);
                if (counter.processingRemaining <= 0) {
                  // Screening complete! Patrons push into inner venue concourse and are immediately despawned
                  const occupant = agentsRef.current.find((ag) => ag.id === counter.occupantAgentId);
                  if (occupant) {
                    occupant.isCleared = true;
                    occupant.active = false; // Immediately filtered out of the active loop
                    if (occupant.entryTime) {
                      const waitTimeSec = (currentTime - occupant.entryTime) / 1000;
                      waitTimesRef.current.push(waitTimeSec);
                      if (waitTimesRef.current.length > 50) waitTimesRef.current.shift();
                    }
                  }
                  counter.totalProcessed++;
                  counter.isOccupied = false;
                  counter.occupantAgentId = null;
                  counter.status = 'IDLE';

                  throughputHistoryRef.current.push(currentTime);
                  securityCheckHistoryRef.current.push(currentTime);
                  incrementSeatedCount(1);

                  const parentGate = gatesRef.current.find((g) => g.id === compound.id);
                  if (parentGate) {
                    parentGate.totalPassed = (parentGate.totalPassed || 0) + 1;
                  }
                }
              }
            }
          }
        } else {
          // Standard turnstile cooldown tick for macro/bridge/reversal
          for (const gate of gatesRef.current) {
            if (gate.cooldown > 0) {
              gate.cooldown = Math.max(0, gate.cooldown - dt);
            }
          }
        }

        // 3. Social Force Crowd Interactions O(N)
        calculateCrowdInteractions(
          agentsRef.current,
          spatialGridRef.current,
          dt,
          isFlashTick
        );

        // 4. Update Individual Agent Physics & Ingress Clearance
        const agents = agentsRef.current;
        const walls = wallsRef.current;
        const baffles = bafflesRef.current;
        const gates = gatesRef.current;

        for (let i = 0; i < agents.length; i++) {
          const a = agents[i];
          if (a.active === false) continue;

          // Despawn patrons who have cleared security screening and dispersed into concourse
          if (a.isCleared || a.isClearedConcourse) {
            // Smoothly decrement clearance alpha for fade-out
            a.clearanceAlpha = Math.max(0, (a.clearanceAlpha ?? 1.0) - dt * 2.2);
            a.y += (a.vy || -34) * dt;
            a.x += (a.vx || 0) * dt;

            // Despawn once faded out (alpha <= 0.05) or reached concourse line (y <= 32)
            if ((a.clearanceAlpha !== undefined && a.clearanceAlpha <= 0.05) || a.y <= 32) {
              a.active = false;
              continue;
            }
          }

          // Track peak density
          if (a.density > peakDensity) {
            peakDensity = a.density;
          }

          // Accumulate gate metrics
          const isGate1 = a.assignedGateId === 'gate-1' || a.assignedGateId === 'gate1';
          const isGate2 = a.assignedGateId === 'gate-2' || a.assignedGateId === 'gate2';

          if (isGate1) {
            gate1DensitySum += a.density;
            if (a.y < CANVAS_HEIGHT - 50 && !a.isClearedConcourse) {
              gate1QueueCount++;
            }
          } else if (isGate2) {
            gate2DensitySum += a.density;
            if (a.y < CANVAS_HEIGHT - 50 && !a.isClearedConcourse) {
              gate2QueueCount++;
            }
          }

          // Track queue spillback from Gate 1
          if (primaryGate && a.assignedGateId === 'gate-1' && a.stuckTime > 0.4) {
            const distFromGate = Math.hypot(a.x - primaryGate.x, a.y - primaryGate.y);
            if (distFromGate > maxSpillbackPx) {
              maxSpillbackPx = distFromGate;
            }
          }

          // Multi-Stage Compound Clearance Logic (Stage 1 -> Stage 2 -> Stage 3)
          if (isMicroStadium && !a.isClearedConcourse) {
            const compound = compoundsRef.current.find((c) => c.id === a.assignedGateId);
            if (compound && compound.active) {
              // Stage 1: S-Curve Switchback Queuing Lanes (Single/Double-File Snake Movement)
              if (!a.stage || a.stage === 1) {
                if (a.waypoints && a.waypoints.length > 0) {
                  if (a.currentWaypointIndex >= a.waypoints.length) {
                    a.stage = 2;
                    a.waypoints = undefined;
                  }
                } else if (a.y <= compound.scanBarY + 16) {
                  a.stage = 2;
                }
              }

              // Stage 2: Automated High-Speed NFC/Barcode Tap (0.2s latency)
              if (a.stage === 2) {
                a.targetX = compound.x + ((a.id % 7) - 3) * (compound.width / 9);
                a.targetY = compound.scanBarY;
                if (Math.abs(a.y - compound.scanBarY) <= 10) {
                  a.nfcTapRemaining = (a.nfcTapRemaining ?? scannerSpeed) - dt;
                  a.vx *= 0.25;
                  a.vy *= 0.25;
                  if (a.nfcTapRemaining <= 0) {
                    fastScanHistoryRef.current.push(currentTime);
                    a.stage = 3; // Tap verified! Advance to Security Screening Counters
                  }
                }
              }

              // Stage 3: Security Screening Counters (Parallel Frisking)
              if (a.stage === 3) {
                if (a.assignedCounterId) {
                  const counter = compound.counters.find((c) => c.id === a.assignedCounterId);
                  if (counter) {
                    a.targetX = counter.x;
                    a.targetY = counter.y;
                    if (Math.hypot(a.x - counter.x, a.y - counter.y) <= 8) {
                      a.x = counter.x;
                      a.y = counter.y;
                      a.vx = 0;
                      a.vy = 0;
                    }
                  } else {
                    a.assignedCounterId = null;
                  }
                } else {
                  // Check for nearest IDLE counter
                  const idleCounters = compound.counters.filter((c) => !c.isOccupied && c.status === 'IDLE');
                  if (idleCounters.length > 0) {
                    idleCounters.sort((c1, c2) => Math.abs(c1.x - a.x) - Math.abs(c2.x - a.x));
                    const chosen = idleCounters[0];
                    chosen.isOccupied = true;
                    chosen.occupantAgentId = a.id;
                    chosen.status = 'PROCESSING';
                    const effectiveCounterDelay =
                      scannerFailureActive && compound.id === 'gate-1' ? securityCheckSpeed * 3.5 : securityCheckSpeed;
                    chosen.processingRemaining = effectiveCounterDelay;
                    a.assignedCounterId = chosen.id;
                    a.targetX = chosen.x;
                    a.targetY = chosen.y;
                  } else {
                    // All counters PROCESSING: form orderly micro-queues directly in front of each counter lane
                    const laneIndex = a.id % compound.counters.length;
                    const assignedLane = compound.counters[laneIndex];
                    if (assignedLane) {
                      a.targetX = assignedLane.x;
                      a.targetY = compound.scanBarY - 8;
                      a.vx *= 0.25;
                      a.vy *= 0.25;
                    }
                  }
                }
              }
            }
          } else if (!a.isClearedConcourse) {
            // Standard gate passage for macro/bridge/reversal
            for (let g = 0; g < gates.length; g++) {
              const gate = gates[g];
              if (!gate.active) continue;

              const halfW = gate.width / 2 + 8;
              const halfH = gate.height / 2 + 10;

              if (Math.abs(a.x - gate.x) <= halfW && Math.abs(a.y - gate.y) <= halfH) {
                if (gate.cooldown <= 0) {
                  const effectiveLatency =
                    scannerFailureActive && (gate.id === 'gate-1' || gate.id === 'gate-2')
                      ? gateLatency * 3.5
                      : gateLatency;

                  gate.cooldown = effectiveLatency;
                  gate.totalPassed = (gate.totalPassed || 0) + 1;
                  a.active = false;
                  throughputHistoryRef.current.push(currentTime);
                  incrementSeatedCount(1);
                  break;
                } else {
                  a.vx *= 0.15;
                  a.vy *= 0.15;
                }
              }
            }
          }

          // Update physics (Waypoint Steering & Corridor Collision)
          updateAgentPhysics(a, dt, walkingSpeed, walls, baffles, sQueueEnabled);
        }

        // Prune inactive agents
        agentsRef.current = agentsRef.current.filter((a) => a.active !== false);

        // Calculate rolling throughputs per minute
        const oneMinuteAgo = currentTime - 60000;
        throughputHistoryRef.current = throughputHistoryRef.current.filter((t) => t >= oneMinuteAgo);
        fastScanHistoryRef.current = fastScanHistoryRef.current.filter((t) => t >= oneMinuteAgo);
        securityCheckHistoryRef.current = securityCheckHistoryRef.current.filter((t) => t >= oneMinuteAgo);
      }

      // Compute average queue densities
      const avgGate1Density = gate1QueueCount > 0 ? gate1DensitySum / gate1QueueCount : peakDensity;
      const avgGate2Density = gate2QueueCount > 0 ? gate2DensitySum / gate2QueueCount : 0.8;

      // 5. Dynamic Capacity Calculation & AI Incident Commander
      // Each security counter screens 1 patron / securityCheckSpeed
      const nominalBoothsPpm = Math.round((60 / securityCheckSpeed) * counterCountGate1);
      const gate1Capacity = scannerFailureActive ? Math.round(nominalBoothsPpm / 3.5) : nominalBoothsPpm;
      const isGate2Open = auxGateActive || overflowRerouteActive;
      const gate2Capacity = isGate2Open ? Math.round((60 / securityCheckSpeed) * counterCountGate2) : 0;
      const totalCapacity = gate1Capacity + gate2Capacity;
      const excessRate = Math.max(0, inflowRate - totalCapacity);

      if (scenario === 'stadium' && stadiumViewMode === 'MICRO_VIEW_EAST') {
        const gate2X = CANVAS_WIDTH * 0.77;
        const scanBarY = 80;

        // Congestion detection & Dynamic Diversion Execution
        const isCongested = peakDensity >= 4.0 || avgGate1Density >= 4.0 || overflowRerouteActive;
        const shouldReroute = (autonomousRerouteActive && isCongested) || overflowRerouteActive || isCongested;

        if (shouldReroute && avgGate2Density < 3.8) {
          if (!isGate2Open) {
            setAuxGateActive(true); // Automatically open Gate 2 bypass!
          }

          rerouteAlertRef.current = {
            sourceGate: 'GATE 1 (EAST MAIN)',
            targetGate: 'GATE 2 (EAST AUXILIARY)',
            diversionPercentage: 50,
            message: `CONGESTION ALERT: Gate 1 over capacity (>4.0 p/m²). Diverting 50% of approaching plaza crowd to Gate 2.`
          };

          // Find all agents in Gate 1's approach plaza who have NOT yet entered Lane 1 (y > 300)
          // Immediately reassign 50% to Gate 2 with clean feeder bypass waypoints
          for (let i = 0; i < agentsRef.current.length; i++) {
            const a = agentsRef.current[i];
            const isG1 = a.assignedGateId === 'gate-1' || a.assignedGateId === 'gate1';
            if (isG1 && a.y > 300 && a.id % 2 === 0 && !a.isClearedConcourse) {
              a.assignedGateId = 'gate-2';
              a.color = '#06b6d4'; // Cyan diverted flow
              a.waypoints = getGate2Waypoints(gate2X, scanBarY, a.y);
              a.currentWaypointIndex = 0;
              a.stage = 1;
              a.assignedCounterId = null;
              a.targetX = a.waypoints[0].x;
              a.targetY = a.waypoints[0].y;
              // Immediate East-North-East turn for clean visual peeling
              a.vx = Math.abs(a.vx) + 24;
              a.vy = -Math.abs(a.vy) - 12;
            }
          }
        } else if (peakDensity < 3.0 && gate1QueueCount < 15 && !overflowRerouteActive) {
          rerouteAlertRef.current = null;
        }
      } else {
        rerouteAlertRef.current = null;
      }

      // Track Density History over 2s moving window for Time to Turbulence
      densityHistoryRef.current.push({ time: currentTime, density: peakDensity });
      const twoSecondsAgo = currentTime - 2000;
      densityHistoryRef.current = densityHistoryRef.current.filter((d) => d.time >= twoSecondsAgo);

      let timeToTurbulence: number | null = null;
      let densityTrend: 'rising' | 'stable' | 'clearing' = 'stable';

      if (densityHistoryRef.current.length >= 2) {
        const oldest = densityHistoryRef.current[0];
        const newest = densityHistoryRef.current[densityHistoryRef.current.length - 1];
        const deltaDensity = newest.density - oldest.density;
        const deltaTimeSec = Math.max(0.2, (newest.time - oldest.time) / 1000);
        const rateOfChange = deltaDensity / deltaTimeSec;

        if (rateOfChange > 0.15) {
          densityTrend = 'rising';
        } else if (rateOfChange < -0.15) {
          densityTrend = 'clearing';
        } else {
          densityTrend = 'stable';
        }

        if (newest.density >= 5.0) {
          timeToTurbulence = 0.0;
        } else if (rateOfChange > 0.35 && newest.density >= 2.8) {
          const neededToHit5 = 5.0 - newest.density;
          const calculatedSec = neededToHit5 / rateOfChange;
          timeToTurbulence = Math.min(25.0, Math.max(0.5, Math.round(calculatedSec * 10) / 10));
        }
      }

      // Throttle Telemetry Store Updates (10 Hz)
      if (currentTime - lastTelemetryDispatchRef.current > 100) {
        lastTelemetryDispatchRef.current = currentTime;
        const spillbackMeters = Math.round((maxSpillbackPx / PPM) * 10) / 10;
        const liveAgents = agentsRef.current.length;
        const throughputPerMin = throughputHistoryRef.current.length;
        const fastScanThroughput = fastScanHistoryRef.current.length;
        const securityCheckThroughput = securityCheckHistoryRef.current.length;
        const isCritical = peakDensity >= 5.0;

        const avgWait =
          waitTimesRef.current.length > 0
            ? Math.round((waitTimesRef.current.reduce((a, b) => a + b, 0) / waitTimesRef.current.length) * 10) / 10
            : 18.0;

        const timeToGridlock =
          excessRate > 0 && spillbackMeters > 5
            ? Math.max(3.0, Math.round(((20 - Math.min(19, spillbackMeters)) / (excessRate / 60 * 0.15)) * 10) / 10)
            : null;

        const activeCountersCount = counterCountGate1 + (isGate2Open ? counterCountGate2 : 0);

        setTelemetry({
          peakDensity: Math.round(peakDensity * 10) / 10,
          spillbackMeters,
          throughputPerMin,
          liveAgents,
          fps: currentFps || 60,
          isCritical,
          timeToTurbulence,
          densityTrend,
          activeCountersCount,
          averageWaitTimeSec: avgWait,
          fastScanThroughput: fastScanThroughput || (inflowRate > 0 ? Math.min(inflowRate, 360) : 0),
          securityCheckThroughput: securityCheckThroughput || throughputPerMin,
          gateMetrics: {
            'gate-1': {
              queueCount: gate1QueueCount,
              density: Math.round(avgGate1Density * 10) / 10,
              inflowRate: rerouteAlertRef.current ? Math.round(inflowRate * 0.5) : inflowRate,
              capacity: gate1Capacity,
              activeCounters: counterCountGate1,
              status: avgGate1Density >= 5.0 ? 'CRITICAL' : avgGate1Density >= 4.0 ? 'WARNING' : 'NORMAL'
            },
            'gate-2': {
              queueCount: gate2QueueCount,
              density: Math.round(avgGate2Density * 10) / 10,
              inflowRate: rerouteAlertRef.current ? Math.round(inflowRate * 0.5) : (isGate2Open ? 60 : 0),
              capacity: gate2Capacity,
              activeCounters: isGate2Open ? counterCountGate2 : 0,
              status: avgGate2Density >= 5.0 ? 'CRITICAL' : avgGate2Density >= 4.0 ? 'WARNING' : 'NORMAL'
            }
          },
          activeRerouteAlert: rerouteAlertRef.current,
          burstRateAnalysis: {
            excessPeoplePerMin: excessRate,
            timeToGridlockSeconds: timeToGridlock
          }
        });
      }

      // Draw Screen Frame
      drawFrame(ctx, currentTime, isFlashTick, maxSpillbackPx);

      animId = requestAnimationFrame(renderLoop);
    };

    animId = requestAnimationFrame(renderLoop);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [
    isPaused,
    timeScale,
    inflowRate,
    gateLatency,
    walkingSpeed,
    scenario,
    auxGateActive,
    overflowRerouteActive,
    scannerFailureActive,
    autonomousRerouteActive,
    stadiumViewMode,
    surgeSignal,
    metroPulseSignal,
    counterCountGate1,
    counterCountGate2,
    sQueueEnabled,
    scannerSpeed,
    securityCheckSpeed,
    setTelemetry
  ]);

  /**
   * Sub-pixel Vector Canvas Rendering Pipeline
   */
  const drawFrame = (
    ctx: CanvasRenderingContext2D,
    currentTime: number,
    isFlashTick: boolean,
    maxSpillbackPx: number
  ) => {
    // Background Dark Slate
    ctx.fillStyle = '#080c14';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    if (scenario === 'stadium' && stadiumViewMode === 'MACRO_VIEW') {
      drawMacroStadiumRadar(ctx, currentTime, isFlashTick);
    } else {
      drawConcourseView(ctx, currentTime, isFlashTick, maxSpillbackPx);
    }
  };

  /**
   * Draws the Authentic 2.5D Gameday Digital Twin Stadium Radar (MACRO_VIEW)
   * Inspired by authentic gameday digital twin models (Ohio Stadium / Premier Venue Twins)
   */
  const drawMacroStadiumRadar = (ctx: CanvasRenderingContext2D, currentTime: number, isFlashTick: boolean) => {
    const cx = CANVAS_WIDTH / 2;
    const cy = CANVAS_HEIGHT / 2;
    const rx = CANVAS_WIDTH * 0.43;
    const ry = CANVAS_HEIGHT * 0.39;

    // 1. Gameday Atmospheric Sky & Surrounding Grounds
    ctx.fillStyle = '#050811';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Subtle tactical radar coordinate rings
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, 70, 0, Math.PI * 2);
    ctx.arc(cx, cy, 140, 0, Math.PI * 2);
    ctx.arc(cx, cy, 210, 0, Math.PI * 2);
    ctx.stroke();

    // 2. Crowd Ingress Streams from Transit Hubs (MG Road Metro, Queens Rd, Cubbon Rd)
    drawMacroIngressStreams(ctx, cx, cy, rx, ry, currentTime);

    // 3. Tiered 2.5D Grandstand Architecture (Upper Deck, Club Level, Lower Bowl)
    drawTieredGrandstands(ctx, cx, cy, rx, ry, currentTime);

    // 4. Floodlight Towers with Radiating Gameday Beam Cones
    drawStadiumFloodlights(ctx, cx, cy, rx, ry);

    // 5. Authentic Cricket Ground Field (Lawn Mowing Stripes & Pitch)
    drawCricketOutfieldAndPitch(ctx, cx, cy);

    // 6. Perimeter Gates with Dynamic Gameday Heatmap Plumes
    drawPerimeterGatesAndHeatHalos(ctx, currentTime, isFlashTick);

    // 7. Architectural Stand HUD Badges
    drawArchitecturalStandBadges(ctx, cx, cy, rx, ry);

    // 8. Draw Patrons across the Macro Stadium
    const agents = agentsRef.current;
    for (let i = 0; i < agents.length; i++) {
      const a = agents[i];
      if (!a.active) continue;

      ctx.beginPath();
      ctx.arc(a.x, a.y, 3.2, 0, Math.PI * 2);
      ctx.fillStyle = a.color;
      ctx.fill();
    }
  };

  /**
   * Renders Tiered 2.5D Concentric Grandstands with Depth Shading & Seating Texture
   */
  const drawTieredGrandstands = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    currentTime: number
  ) => {
    ctx.save();

    // Exterior Stadium Façade Shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 4, rx + 14, ry + 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Tier 3: Upper Deck (Outer Tier)
    const upperGrad = ctx.createRadialGradient(cx, cy, ry * 0.7, cx, cy, ry + 12);
    upperGrad.addColorStop(0, '#1e293b');
    upperGrad.addColorStop(0.7, '#111827');
    upperGrad.addColorStop(1, '#0b0f19');
    ctx.fillStyle = upperGrad;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx + 10, ry + 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Radial Stairway / Aisle Lines across the Upper Deck
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1.2;
    for (let deg = 0; deg < 360; deg += 15) {
      const rad = (deg * Math.PI) / 180;
      ctx.beginPath();
      ctx.moveTo(cx + (rx - 25) * Math.cos(rad), cy + (ry - 25) * Math.sin(rad));
      ctx.lineTo(cx + (rx + 8) * Math.cos(rad), cy + (ry + 8) * Math.sin(rad));
      ctx.stroke();
    }

    // Tier 2: Club Level / Suite Concourses with 360-Degree LED Ribbon Board
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 5;
    ctx.shadowColor = 'rgba(2, 132, 199, 0.8)';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx - 18, ry - 18, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Animated LED Ribbon Ticker Dots
    const ledOffset = (currentTime * 0.04) % (Math.PI * 2);
    ctx.fillStyle = '#38bdf8';
    for (let i = 0; i < 24; i++) {
      const angle = ledOffset + (i * Math.PI * 2) / 24;
      const lx = cx + (rx - 18) * Math.cos(angle);
      const ly = cy + (ry - 18) * Math.sin(angle);
      ctx.beginPath();
      ctx.arc(lx, ly, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Tier 1: Lower Bowl with Sector Seating Colors
    const stands: { startDeg: number; endDeg: number; color: string; label: string }[] = [
      { startDeg: -45, endDeg: 45, color: 'rgba(249, 115, 22, 0.35)', label: 'EAST' },
      { startDeg: 48, endDeg: 132, color: 'rgba(168, 85, 247, 0.35)', label: 'SOUTH' },
      { startDeg: 135, endDeg: 225, color: 'rgba(16, 185, 129, 0.35)', label: 'WEST' },
      { startDeg: 228, endDeg: 325, color: 'rgba(56, 189, 248, 0.35)', label: 'NORTH' }
    ];

    for (const stand of stands) {
      ctx.strokeStyle = stand.color;
      ctx.lineWidth = 22;
      ctx.beginPath();
      ctx.ellipse(
        cx,
        cy,
        rx - 38,
        ry - 38,
        0,
        (stand.startDeg * Math.PI) / 180,
        (stand.endDeg * Math.PI) / 180
      );
      ctx.stroke();
    }

    ctx.restore();
  };

  /**
   * Renders Realistic Cricket Ground Field with Concentric Lawn Mowing Stripes & Pitch Strip
   */
  const drawCricketOutfieldAndPitch = (ctx: CanvasRenderingContext2D, cx: number, cy: number) => {
    ctx.save();
    const pitchRx = CANVAS_WIDTH * 0.28;
    const pitchRy = CANVAS_HEIGHT * 0.25;

    // Outfield Base Oval with Alternating Concentric Lawn Mowing Stripes
    const stripeCount = 6;
    for (let s = stripeCount; s >= 1; s--) {
      const factor = s / stripeCount;
      const sRx = pitchRx * factor;
      const sRy = pitchRy * factor;
      ctx.fillStyle = s % 2 === 0 ? '#15803d' : '#16a34a';
      ctx.beginPath();
      ctx.ellipse(cx, cy, sRx, sRy, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Crisp White Boundary Rope with Inner Grass Drop Shadow
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.ellipse(cx, cy, pitchRx, pitchRy, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 30-Yard Fielding Circle (Dashed White Line)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 1.4;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.ellipse(cx, cy, pitchRx * 0.55, pitchRy * 0.55, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Central Cricket Pitch (Beige Clay Strip)
    const pw = 22;
    const ph = 50;
    ctx.fillStyle = '#d4b996';
    ctx.fillRect(cx - pw / 2, cy - ph / 2, pw, ph);

    // Popping Creases & Bowling Creases
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.2;
    // North Crease
    ctx.strokeRect(cx - pw / 2, cy - ph / 2 + 6, pw, 0.1);
    // South Crease
    ctx.strokeRect(cx - pw / 2, cy + ph / 2 - 6, pw, 0.1);

    // Stumps & Bails
    ctx.fillStyle = '#f8fafc';
    for (let offset = -4; offset <= 4; offset += 4) {
      ctx.beginPath();
      ctx.arc(cx + offset, cy - ph / 2 + 5, 1.2, 0, Math.PI * 2);
      ctx.arc(cx + offset, cy + ph / 2 - 5, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  };

  /**
   * Renders 4 Diagonal Floodlight Towers with Radiant Gameday Light Beams
   */
  const drawStadiumFloodlights = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    rx: number,
    ry: number
  ) => {
    ctx.save();
    const towerCorners = [
      { x: cx - rx * 0.95, y: cy - ry * 0.92 }, // NW Tower
      { x: cx + rx * 0.95, y: cy - ry * 0.92 }, // NE Tower
      { x: cx - rx * 0.95, y: cy + ry * 0.92 }, // SW Tower
      { x: cx + rx * 0.95, y: cy + ry * 0.92 }  // SE Tower
    ];

    for (const tower of towerCorners) {
      // Conical Gameday Light Beam Ray onto Field
      const lightGrad = ctx.createRadialGradient(tower.x, tower.y, 4, cx, cy, rx * 0.7);
      lightGrad.addColorStop(0, 'rgba(224, 242, 254, 0.35)');
      lightGrad.addColorStop(0.3, 'rgba(186, 230, 253, 0.12)');
      lightGrad.addColorStop(1, 'rgba(186, 230, 253, 0)');

      ctx.fillStyle = lightGrad;
      ctx.beginPath();
      ctx.moveTo(tower.x, tower.y);
      ctx.lineTo(cx + (tower.x > cx ? 40 : -40), cy - 60);
      ctx.lineTo(cx + (tower.x > cx ? 60 : -60), cy + 60);
      ctx.closePath();
      ctx.fill();

      // Steel Floodlight Tower Head & Bulb Array
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.5;
      ctx.fillRect(tower.x - 7, tower.y - 7, 14, 14);
      ctx.strokeRect(tower.x - 7, tower.y - 7, 14, 14);

      // High-Intensity Halogen Lamp Glow
      ctx.fillStyle = '#f8fafc';
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(tower.x, tower.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  };

  /**
   * Renders Perimeter Gates with Gameday Dynamic Heatmap Plumes (Like the Ohio Stadium Reference)
   */
  const drawPerimeterGatesAndHeatHalos = (
    ctx: CanvasRenderingContext2D,
    currentTime: number,
    isFlashTick: boolean
  ) => {
    const agents = agentsRef.current;

    for (const gate of gatesRef.current) {
      ctx.save();
      const sectorDef = CHINNASWAMY_CONFIG.sectors[gate.sector || 'EAST'];
      const gateColor = sectorDef ? sectorDef.accentColor : '#0ea5e9';

      // Estimate crowd clustering around gate
      let localCrowdCount = 0;
      for (let i = 0; i < agents.length; i++) {
        if (Math.hypot(agents[i].x - gate.x, agents[i].y - gate.y) < 36) {
          localCrowdCount++;
        }
      }
      const localDensity = Math.max(0.6, localCrowdCount * 0.7);

      // Dynamic Radial Heatmap Plume Radiating from Gate
      const isCriticalCrowd = localDensity >= 4.5;
      const isSurging = localDensity >= 2.5 && localDensity < 4.5;

      const plumeRadius = isCriticalCrowd
        ? 26 + Math.sin(currentTime * 0.008 + gate.x) * 6
        : isSurging
        ? 20
        : 14;

      const plumeGrad = ctx.createRadialGradient(gate.x, gate.y, 2, gate.x, gate.y, plumeRadius);
      if (isCriticalCrowd) {
        plumeGrad.addColorStop(0, isFlashTick ? 'rgba(244, 63, 94, 0.85)' : 'rgba(239, 68, 68, 0.65)');
        plumeGrad.addColorStop(0.6, 'rgba(249, 115, 22, 0.35)');
        plumeGrad.addColorStop(1, 'rgba(244, 63, 94, 0)');
      } else if (isSurging) {
        plumeGrad.addColorStop(0, 'rgba(245, 158, 11, 0.75)');
        plumeGrad.addColorStop(0.6, 'rgba(234, 179, 8, 0.3)');
        plumeGrad.addColorStop(1, 'rgba(245, 158, 11, 0)');
      } else {
        plumeGrad.addColorStop(0, 'rgba(6, 182, 212, 0.55)');
        plumeGrad.addColorStop(1, 'rgba(6, 182, 212, 0)');
      }

      ctx.fillStyle = plumeGrad;
      ctx.beginPath();
      ctx.arc(gate.x, gate.y, plumeRadius, 0, Math.PI * 2);
      ctx.fill();

      // Gate Gantry Box
      ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
      ctx.strokeStyle = isCriticalCrowd ? '#f43f5e' : gateColor;
      ctx.lineWidth = isCriticalCrowd ? 2.5 : 1.8;
      ctx.fillRect(gate.x - 11, gate.y - 9, 22, 18);
      ctx.strokeRect(gate.x - 11, gate.y - 9, 22, 18);

      // Gate Identifier Text
      ctx.font = 'bold 9px "JetBrains Mono", monospace';
      ctx.fillStyle = '#f8fafc';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`G${gate.gateNumber || ''}`, gate.x, gate.y);
      ctx.restore();
    }
  };

  /**
   * Renders Crowd Ingress Streams from Transit Hubs (MG Road Metro, Queens Rd, Cubbon Rd)
   */
  const drawMacroIngressStreams = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    currentTime: number
  ) => {
    ctx.save();
    const offset = Math.floor((currentTime * 0.04) % 24);

    // 1. East Stream: MG Road Metro Purple Line Feed (to Gates 1-6)
    ctx.strokeStyle = 'rgba(249, 115, 22, 0.35)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(CANVAS_WIDTH - 20, cy);
    ctx.lineTo(cx + rx + 6, cy);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.font = 'bold 9px "JetBrains Mono", monospace';
    ctx.fillStyle = '#f97316';
    for (let x = CANVAS_WIDTH - 60 - offset; x > cx + rx + 10; x -= 32) {
      ctx.fillText('◄', x, cy - 6);
    }

    // 2. South Stream: Cubbon Road Promenade Feed (to Gates 7-11)
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.35)';
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(cx, CANVAS_HEIGHT - 15);
    ctx.lineTo(cx, cy + ry + 6);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#c084fc';
    for (let y = CANVAS_HEIGHT - 35 - offset; y > cy + ry + 10; y -= 32) {
      ctx.fillText('▲', cx + 4, y);
    }

    // 3. North Stream: Queen’s Road Arterial Feed (to Gates 16-21)
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(cx, 15);
    ctx.lineTo(cx, cy - ry - 6);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#38bdf8';
    for (let y = 35 + offset; y < cy - ry - 10; y += 32) {
      ctx.fillText('▼', cx + 4, y);
    }

    ctx.restore();
  };

  /**
   * Renders Architectural Stand Labels with Illuminated HUD Badges
   */
  const drawArchitecturalStandBadges = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    rx: number,
    ry: number
  ) => {
    ctx.save();
    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // East Stand: MG Road Metro Feed
    drawStandHUDTag(ctx, cx + rx + 20, cy - ry - 8, 'EAST STAND (MG ROAD METRO FEED)', '#f97316');

    // North Stand: Queen's Road Arterial
    drawStandHUDTag(ctx, cx, 22, 'NORTH STAND (QUEEN’S ROAD ARTERIAL)', '#38bdf8');

    // South Stand: Cubbon Road Promenade
    drawStandHUDTag(ctx, cx, CANVAS_HEIGHT - 18, 'SOUTH STAND (CUBBON ROAD PROMENADE)', '#c084fc');

    // West Stand: Pavilion & Club House
    drawStandHUDTag(ctx, cx - rx - 10, cy - ry - 8, 'WEST STAND (PAVILION / VIP)', '#10b981');

    ctx.restore();
  };

  /**
   * Helper to draw glowing HUD Stand Badge
   */
  const drawStandHUDTag = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    text: string,
    color: string
  ) => {
    ctx.font = 'bold 9px "JetBrains Mono", monospace';
    const textW = ctx.measureText(text).width;
    ctx.fillStyle = 'rgba(10, 15, 26, 0.9)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.4;
    ctx.fillRect(x - textW / 2 - 8, y - 9, textW + 16, 18);
    ctx.strokeRect(x - textW / 2 - 8, y - 9, textW + 16, 18);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  };

  /**
   * Draws Detailed Concourse View as Modern Tactical Radar
   */
  const drawConcourseView = (
    ctx: CanvasRenderingContext2D,
    currentTime: number,
    isFlashTick: boolean,
    maxSpillbackPx: number
  ) => {
    // Tactical 1m & 5m Grid
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.4)';
    ctx.beginPath();
    for (let x = 0; x <= CANVAS_WIDTH; x += PPM) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_HEIGHT);
    }
    for (let y = 0; y <= CANVAS_HEIGHT; y += PPM) {
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_WIDTH, y);
    }
    ctx.stroke();

    ctx.strokeStyle = 'rgba(51, 65, 85, 0.6)';
    ctx.beginPath();
    for (let x = 0; x <= CANVAS_WIDTH; x += PPM * 5) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_HEIGHT);
    }
    for (let y = 0; y <= CANVAS_HEIGHT; y += PPM * 5) {
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_WIDTH, y);
    }
    ctx.stroke();

    // MG Road Inflow Boulevard Plaza (Chinnaswamy East Ingress)
    if (scenario === 'stadium') {
      const bLeft = CANVAS_WIDTH * 0.12;
      const bWidth = CANVAS_WIDTH * 0.76;

      ctx.fillStyle = 'rgba(249, 115, 22, 0.04)';
      ctx.strokeStyle = 'rgba(249, 115, 22, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.fillRect(bLeft, CANVAS_HEIGHT - 50, bWidth, 42);
      ctx.strokeRect(bLeft, CANVAS_HEIGHT - 50, bWidth, 42);
      ctx.setLineDash([]);

      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      ctx.fillStyle = '#f97316';
      ctx.fillText(
        `MG ROAD METRO PLAZA [PURPLE LINE INFLUX: ${inflowRate} P/MIN]`,
        bLeft + 15,
        CANVAS_HEIGHT - 25
      );

      // Spillback Distance Ruler along MG Road
      drawSpillbackRuler(ctx, bLeft - 18, maxSpillbackPx);
    }

    // Dynamic Digital Signage Banner (when rerouting alert is active)
    if (rerouteAlertRef.current) {
      ctx.save();
      const bannerX = CANVAS_WIDTH / 2 - 250;
      const bannerY = 16;
      const bannerW = 500;
      const bannerH = 34;

      ctx.fillStyle = 'rgba(8, 12, 20, 0.95)';
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 2;
      ctx.shadowColor = 'rgba(6, 182, 212, 0.8)';
      ctx.shadowBlur = 14;
      ctx.fillRect(bannerX, bannerY, bannerW, bannerH);
      ctx.strokeRect(bannerX, bannerY, bannerW, bannerH);

      const arrowPulse = currentTime % 800 > 400 ? '──► ──►' : '►► ►►';
      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      ctx.fillStyle = '#22d3ee';
      ctx.textAlign = 'center';
      ctx.fillText(
        `🚨 SMART DIVERSION SIGNAGE: GATE 1 OVERLOADED ${arrowPulse} DIVERTING 50% TO GATE 2`,
        CANVAS_WIDTH / 2,
        bannerY + 21
      );
      ctx.restore();
    }

    // 1. Draw Physical Barriers & Outer Railings
    for (const w of wallsRef.current) {
      if (w.type === 'baffle') continue;

      ctx.save();
      if (w.type === 'divider') {
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = w.thickness || 6;
        ctx.shadowColor = 'rgba(6, 182, 212, 0.6)';
        ctx.shadowBlur = 8;
      } else if (w.type === 'barrier') {
        ctx.strokeStyle = w.color || '#ef4444';
        ctx.lineWidth = w.thickness || 5;
        ctx.shadowColor = 'rgba(6, 182, 212, 0.4)';
        ctx.shadowBlur = 6;
      } else {
        ctx.strokeStyle = w.color || '#475569';
        ctx.lineWidth = w.thickness || 4;
      }
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(w.x1, w.y1);
      ctx.lineTo(w.x2, w.y2);
      ctx.stroke();

      if (w.label) {
        ctx.font = 'bold 8px "JetBrains Mono", monospace';
        ctx.fillStyle = w.color || '#94a3b8';
        ctx.fillText(w.label, (w.x1 + w.x2) / 2 - 40, w.y1 - 6);
      }
      ctx.restore();
    }

    // 2. Draw S-Queue Railings & Snake Direction Arrows
    drawSQueueStructure(ctx, currentTime);

    // 3. Draw Gate Compounds (Stage 2 Fast-Scan Bar + Stage 3 Security Booths)
    const isMicroStadium = scenario === 'stadium' && stadiumViewMode === 'MICRO_VIEW_EAST';
    if (isMicroStadium && compoundsRef.current.length > 0) {
      drawModernSecurityCompound(ctx, currentTime);
    } else {
      drawStandardGates(ctx, currentTime);
    }

    // 4. Draw Agents with Heat Halos and Waypoint Navigation Trails
    const agents = agentsRef.current;
    const len = agents.length;

    for (let i = 0; i < len; i++) {
      const a = agents[i];
      if (a.active === false) continue;

      const speed = Math.hypot(a.vx, a.vy);

      // Thermal Heat Halos around bottlenecks
      if (a.density >= 4.0 && !a.isClearedConcourse) {
        ctx.save();
        const haloGrad = ctx.createRadialGradient(a.x, a.y, 2, a.x, a.y, a.density >= 5.0 ? 18 : 12);
        haloGrad.addColorStop(
          0,
          a.density >= 5.0 ? 'rgba(244, 63, 94, 0.45)' : 'rgba(249, 115, 22, 0.35)'
        );
        haloGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = haloGrad;
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.density >= 5.0 ? 18 : 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Draw vector trails
      if ((speed > 1.2 || a.density >= 2.5) && !a.isClearedConcourse) {
        ctx.save();
        const normVx = a.vx / (speed || 1);
        const normVy = a.vy / (speed || 1);
        const trailLength = Math.min(14, speed * 0.7);

        ctx.strokeStyle =
          a.density >= 5.0
            ? 'rgba(244, 63, 94, 0.4)'
            : a.assignedGateId === 'gate-2'
            ? 'rgba(6, 182, 212, 0.35)'
            : 'rgba(249, 115, 22, 0.3)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(a.x - normVx * trailLength, a.y - normVy * trailLength);
        ctx.stroke();
        ctx.restore();
      }

      let displayColor = a.color;
      if (a.isCleared || a.isClearedConcourse) {
        displayColor = '#10b981'; // Patrons cleared into concourse glow emerald
      } else if (a.density >= 5.0 && isFlashTick) {
        displayColor = '#f43f5e';
      }

      ctx.save();
      if ((a.isCleared || a.isClearedConcourse) && a.clearanceAlpha !== undefined) {
        ctx.globalAlpha = Math.max(0, Math.min(1, a.clearanceAlpha));
      }

      ctx.beginPath();
      ctx.arc(a.x, a.y, a.radius, 0, Math.PI * 2);
      ctx.fillStyle = displayColor;
      ctx.fill();

      if (a.density >= 5.0 && !a.isCleared && !a.isClearedConcourse) {
        ctx.strokeStyle = isFlashTick ? '#f43f5e' : '#fda4af';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      ctx.restore();
    }
  };

  /**
   * Draws Clean High-Tech S-Queue Railings, Architectural Lane Floors, Wide Hopper Funnel & Directional Arrows
   */
  const drawSQueueStructure = (ctx: CanvasRenderingContext2D, currentTime: number) => {
    if (!sQueueEnabled && !bafflesActive) return;
    if (scenario !== 'stadium' || stadiumViewMode !== 'MICRO_VIEW_EAST') return;

    // 1. High-Contrast Architectural Lane Floors (Subtle Slate/Navy Fill)
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.35)';
    ctx.lineWidth = 1;

    // Lane 1 Floor Track
    ctx.fillRect(230, 250, 260, 40);
    ctx.strokeRect(230, 250, 260, 40);
    // U-Turn 1 Bend Floor
    ctx.fillRect(445, 195, 45, 65);
    // Lane 2 Floor Track
    ctx.fillRect(230, 190, 260, 40);
    ctx.strokeRect(230, 190, 260, 40);
    // U-Turn 2 Bend Floor
    ctx.fillRect(230, 135, 45, 65);
    // Lane 3 Floor Track
    ctx.fillRect(230, 130, 260, 40);
    ctx.strokeRect(230, 130, 260, 40);
    ctx.restore();

    for (const b of bafflesRef.current) {
      ctx.save();
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = b.thickness || 5;
      ctx.shadowColor = 'rgba(6, 182, 212, 0.8)';
      ctx.shadowBlur = 10;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(b.x1, b.y1);
      ctx.lineTo(b.x2, b.y2);
      ctx.stroke();

      ctx.fillStyle = '#67e8f9';
      ctx.beginPath();
      ctx.arc(b.x1, b.y1, 4, 0, Math.PI * 2);
      ctx.arc(b.x2, b.y2, 4, 0, Math.PI * 2);
      ctx.fill();

      if (b.label) {
        ctx.font = 'bold 8px "JetBrains Mono", monospace';
        ctx.fillStyle = '#38bdf8';
        ctx.fillText(b.label, (b.x1 + b.x2) / 2 - 35, b.y1 - 6);
      }
      ctx.restore();
    }

    // 2. Draw Wide Entrance Mouth Hopper in Glowing Cyan/Amber (140px opening at y=350)
    ctx.save();
    const hopperPulse = (Math.sin(currentTime * 0.005) + 1) * 0.5;
    ctx.strokeStyle = `rgba(6, 182, 212, ${0.75 + hopperPulse * 0.25})`;
    ctx.lineWidth = 3.5;
    ctx.shadowColor = 'rgba(6, 182, 212, 0.9)';
    ctx.shadowBlur = 12;

    // Glowing angled hopper guide walls (140px mouth down to 60px neck)
    ctx.beginPath();
    ctx.moveTo(190, 350);
    ctx.lineTo(230, 280);
    ctx.moveTo(330, 350);
    ctx.lineTo(290, 280);
    ctx.stroke();

    // Dashed mouth line across entrance at y=350
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(190, 350);
    ctx.lineTo(330, 350);
    ctx.stroke();
    ctx.setLineDash([]);

    // Hopper Entry Label Badge
    ctx.font = 'bold 8px "JetBrains Mono", monospace';
    ctx.fillStyle = '#67e8f9';
    ctx.textAlign = 'center';
    ctx.fillText('▼ S-QUEUE HOPPER ENTRANCE (WIDTH 140px)', 260, 364);
    ctx.fillText('ENTRY FUNNEL (60px NECK)', 260, 275);
    ctx.restore();

    // 3. Directional Animated Chevrons & Arrows (>>>) along S-Lane Corridors
    ctx.save();
    ctx.font = 'bold 9px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(6, 182, 212, 0.85)';
    const offset = Math.floor((currentTime * 0.05) % 36);

    // Lane 1 (Bottom, y in [250, 290]): West to East (+X)
    for (let x = 280 + offset; x < 480; x += 36) {
      ctx.fillText('>>>', x, 274);
    }
    ctx.font = 'bold 7px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(6, 182, 212, 0.55)';
    ctx.fillText('LANE 1 (WEST TO EAST >>>)', 370, 262);

    // Lane 2 (Middle, y in [190, 230]): East to West (-X)
    ctx.font = 'bold 9px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(6, 182, 212, 0.85)';
    for (let x = 470 - offset; x > 255; x -= 36) {
      ctx.fillText('<<<', x, 214);
    }
    ctx.font = 'bold 7px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(6, 182, 212, 0.55)';
    ctx.fillText('(<<< WESTBOUND) LANE 2', 360, 202);

    // Lane 3 (Top, y in [130, 170]): West to East (+X) leading to Fast-Scan
    ctx.font = 'bold 9px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(6, 182, 212, 0.85)';
    for (let x = 255 + offset; x < 460; x += 36) {
      ctx.fillText('>>>', x, 154);
    }
    ctx.font = 'bold 7px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(6, 182, 212, 0.55)';
    ctx.fillText('LANE 3 (TO FAST-SCAN >>>)', 360, 142);
    ctx.restore();

    // 4. Overhead Digital Signboard at the Fork
    const isBypassActive = auxGateActive || overflowRerouteActive;
    if (isBypassActive || rerouteAlertRef.current) {
      ctx.save();
      const forkSignX = 425;
      const forkSignY = 308;
      const signW = 390;
      const signH = 26;

      ctx.fillStyle = 'rgba(10, 15, 26, 0.94)';
      ctx.strokeStyle = '#0ea5e9';
      ctx.lineWidth = 1.8;
      ctx.shadowColor = 'rgba(14, 165, 233, 0.8)';
      ctx.shadowBlur = 10;
      ctx.fillRect(forkSignX - signW / 2, forkSignY - signH / 2, signW, signH);
      ctx.strokeRect(forkSignX - signW / 2, forkSignY - signH / 2, signW, signH);

      // Signboard Content: [ ⬅ GATE 1 MAIN (CONGESTED) ]  |  [ GATE 2 AUX (CLEAR) ➡ ]
      ctx.font = 'bold 9px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';

      // Left branch: Gate 1 Main (Congested) in Amber/Rose
      ctx.fillStyle = '#f59e0b';
      ctx.fillText('⬅ GATE 1 MAIN (CONGESTED)', forkSignX - 100, forkSignY + 3);

      // Separator
      ctx.fillStyle = '#475569';
      ctx.fillText('│', forkSignX, forkSignY + 3);

      // Right branch: Gate 2 Aux (Clear) in Cyan/Emerald
      ctx.fillStyle = '#22d3ee';
      ctx.fillText('GATE 2 AUX (CLEAR) ➡', forkSignX + 95, forkSignY + 3);

      ctx.restore();
    }
  };

  /**
   * Renders Modern Tactical Security Compound (Gantry, Fast-Scan Bar & Modular Booths)
   */
  const drawModernSecurityCompound = (ctx: CanvasRenderingContext2D, currentTime: number) => {
    for (const compound of compoundsRef.current) {
      ctx.save();
      const isActive = compound.active;
      const isGate1 = compound.id === 'gate-1';
      const isScannerStalled = scannerFailureActive && isGate1;
      const themeColor = !isActive ? '#ef4444' : isGate1 ? '#f59e0b' : '#06b6d4';
      const halfW = compound.width / 2;

      // Compound Staging Bay Background Enclosure
      ctx.fillStyle = isActive ? 'rgba(15, 23, 42, 0.85)' : 'rgba(30, 20, 25, 0.85)';
      ctx.strokeStyle = themeColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(compound.x - halfW, 28, compound.width, 68);
      ctx.fillRect(compound.x - halfW, 28, compound.width, 68);

      // Facility Title & Nominal Capacity Header
      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      ctx.fillStyle = themeColor;
      ctx.textAlign = 'center';
      const capPpm = isActive ? Math.round((60 / securityCheckSpeed) * compound.counters.length) : 0;
      ctx.fillText(
        `${compound.name} [${compound.counters.length} BOOTHS — ${capPpm} P/MIN]`,
        compound.x,
        22
      );

      if (isActive) {
        // Fast-Scan Bar: Glowing cyan scan line with animated pulse (0.2s tap-in)
        const barY = compound.scanBarY;
        const scanPulseX = compound.x - halfW + 15 + ((currentTime * 0.15) % (compound.width - 30));

        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = 'rgba(34, 211, 238, 0.9)';
        ctx.shadowBlur = 10;
        ctx.setLineDash([6, 3]);
        ctx.beginPath();
        ctx.moveTo(compound.x - halfW + 6, barY);
        ctx.lineTo(compound.x + halfW - 6, barY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;

        // Animated laser sweep pulse on scan line
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(scanPulseX, barY, 3.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = 'bold 8px "JetBrains Mono", monospace';
        ctx.fillStyle = '#38bdf8';
        ctx.fillText(`⚡ AUTOMATED NFC SCAN LINE (${scannerSpeed.toFixed(1)}s AUTO-TAP)`, compound.x, barY + 11);

        // Modular Security Booths across the Gantry
        for (const counter of compound.counters) {
          const cbx = counter.x - counter.width / 2;
          const cby = counter.y - counter.height / 2;

          let statusBg = 'rgba(16, 185, 129, 0.15)';
          let statusBorder = '#10b981'; // Emerald when IDLE
          let statusText = 'IDLE';

          if (isScannerStalled) {
            statusBg = 'rgba(244, 63, 94, 0.35)';
            statusBorder = '#f43f5e';
            statusText = 'ERR';
          } else if (counter.isOccupied) {
            statusBg = 'rgba(245, 158, 11, 0.35)'; // Amber when BUSY
            statusBorder = '#f59e0b';
            statusText = counter.processingRemaining > 0 ? `BUSY ${counter.processingRemaining.toFixed(1)}s` : 'BUSY';
          }

          // Modular Booth Box
          ctx.fillStyle = statusBg;
          ctx.strokeStyle = statusBorder;
          ctx.lineWidth = 1.8;
          ctx.fillRect(cbx, cby, counter.width, counter.height);
          ctx.strokeRect(cbx, cby, counter.width, counter.height);

          // Counter ID & Live Processed Count above each booth
          ctx.font = 'bold 7px "JetBrains Mono", monospace';
          ctx.fillStyle = '#f8fafc';
          ctx.textAlign = 'center';
          ctx.fillText(`#${counter.id}`, counter.x, cby + 7);

          // Status Badge
          ctx.font = 'bold 6px "JetBrains Mono", monospace';
          ctx.fillStyle = statusBorder;
          ctx.fillText(statusText, counter.x, cby + 14);

          // Live Progress Bar inside booth for active occupant
          if (counter.isOccupied && counter.processingRemaining > 0) {
            const totalDelay = isScannerStalled ? securityCheckSpeed * 3.5 : securityCheckSpeed;
            const progress = Math.max(0, Math.min(1, 1 - counter.processingRemaining / totalDelay));
            ctx.fillStyle = statusBorder;
            ctx.fillRect(cbx + 2, cby + counter.height - 3, (counter.width - 4) * progress, 2);
          }

          // Processed Count below booth
          ctx.font = '7px "JetBrains Mono", monospace';
          ctx.fillStyle = '#94a3b8';
          ctx.fillText(`P:${counter.totalProcessed}`, counter.x, cby + counter.height + 8);
        }

        // Inner Stadium Clear Concourse Label
        ctx.font = 'bold 8px "JetBrains Mono", monospace';
        ctx.fillStyle = '#10b981';
        ctx.fillText('▲ INNER STADIUM CONCOURSE (CLEARED PATRONS DISPERSING)', compound.x, 38);
      } else {
        ctx.font = 'bold 11px "JetBrains Mono", monospace';
        ctx.fillStyle = '#ef4444';
        ctx.textAlign = 'center';
        ctx.fillText('FACILITY STANDBY / INACTIVE', compound.x, 65);
      }

      ctx.restore();
    }
  };

  /**
   * Standard Turnstile Gates (for Footbridge, Reversal, and Macro View)
   */
  const drawStandardGates = (ctx: CanvasRenderingContext2D, currentTime: number) => {
    for (const gate of gatesRef.current) {
      ctx.save();
      const isActive = gate.active;
      const isReady = isActive && gate.cooldown <= 0;
      const statusBorderColor = !isActive ? '#ef4444' : isReady ? '#10b981' : '#f59e0b';

      ctx.fillStyle = isActive ? 'rgba(15, 23, 42, 0.95)' : 'rgba(30, 20, 25, 0.8)';
      ctx.strokeStyle = statusBorderColor;
      ctx.lineWidth = 2.5;
      ctx.fillRect(gate.x - gate.width / 2, gate.y - gate.height / 2, gate.width, gate.height);
      ctx.strokeRect(gate.x - gate.width / 2, gate.y - gate.height / 2, gate.width, gate.height);

      if (isActive) {
        const angle = (currentTime / 350) % (Math.PI * 2);
        ctx.strokeStyle = statusBorderColor;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(gate.x - 7 * Math.cos(angle), gate.y - 7 * Math.sin(angle));
        ctx.lineTo(gate.x + 7 * Math.cos(angle), gate.y + 7 * Math.sin(angle));
        ctx.stroke();
      }

      const gateTitle = gate.name || gate.id;
      const statusText = !isActive
        ? 'CLOSED'
        : gate.cooldown > 0
        ? `SCAN (${gate.cooldown.toFixed(1)}s)`
        : 'ACTIVE';
      const statusColor = !isActive ? '#f43f5e' : gate.cooldown > 0 ? '#f59e0b' : '#10b981';

      ctx.font = 'bold 9px "JetBrains Mono", monospace';
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(gateTitle, gate.x - 60, gate.y - gate.height / 2 - 14);

      ctx.font = 'bold 8px "JetBrains Mono", monospace';
      ctx.fillStyle = statusColor;
      ctx.fillText(`[${statusText}] Passed: ${gate.totalPassed || 0}`, gate.x - 60, gate.y - gate.height / 2 - 3);

      ctx.restore();
    }
  };

  /**
   * Draws a Queue Spillback Measurement Ruler along the MG Road Ingress Avenue
   */
  const drawSpillbackRuler = (ctx: CanvasRenderingContext2D, rulerX: number, spillbackPx: number) => {
    const startY = 75;
    const currentY = Math.min(CANVAS_HEIGHT - 30, startY + spillbackPx);
    const spillMeters = Math.round((spillbackPx / PPM) * 10) / 10;

    ctx.save();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(rulerX, startY);
    ctx.lineTo(rulerX, CANVAS_HEIGHT - 30);
    ctx.stroke();

    const marks = [
      { m: 10, label: '10m' },
      { m: 15, label: '15m (Staffing Alert)' },
      { m: 20, label: '20m (Permit Limit)' },
      { m: 35, label: '35m (MG Road Hazard)' }
    ];

    marks.forEach((mark) => {
      const my = startY + mark.m * PPM;
      if (my < CANVAS_HEIGHT - 30) {
        ctx.strokeStyle = mark.m >= 20 ? 'rgba(239, 68, 68, 0.5)' : mark.m >= 15 ? 'rgba(245, 158, 11, 0.5)' : 'rgba(148, 163, 184, 0.5)';
        ctx.beginPath();
        ctx.moveTo(rulerX - 4, my);
        ctx.lineTo(rulerX + 4, my);
        ctx.stroke();

        ctx.font = '8px "JetBrains Mono", monospace';
        ctx.fillStyle = mark.m >= 20 ? '#f87171' : mark.m >= 15 ? '#fcd34d' : '#94a3b8';
        ctx.fillText(mark.label, rulerX - 95, my + 3);
      }
    });

    if (spillbackPx > 10) {
      const isHazard = spillMeters >= 20;
      ctx.strokeStyle = isHazard ? '#ef4444' : '#06b6d4';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(rulerX, startY);
      ctx.lineTo(rulerX, currentY);
      ctx.stroke();

      ctx.fillStyle = isHazard ? '#7f1d1d' : '#0e7490';
      ctx.fillRect(rulerX - 35, currentY - 8, 70, 16);
      ctx.strokeStyle = isHazard ? '#ef4444' : '#22d3ee';
      ctx.strokeRect(rulerX - 35, currentY - 8, 70, 16);

      ctx.font = 'bold 9px "JetBrains Mono", monospace';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(`${spillMeters}m`, rulerX, currentY + 4);
    }
    ctx.restore();
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (stadiumViewMode !== 'MACRO_VIEW' || scenario !== 'stadium') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;

    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    // Check if clicked near any gate bead in macro radar
    for (const gate of gatesRef.current) {
      const dist = Math.hypot(clickX - gate.x, clickY - gate.y);
      if (dist <= 26) {
        if (gate.sector === 'SOUTH') {
          setActiveSector('G7-G11_SOUTH');
          setActiveGateSector('G7-G11_SOUTH');
        } else if (gate.sector === 'NORTH') {
          setActiveSector('G16-G21_NORTH');
          setActiveGateSector('G16-G21_NORTH');
        } else if (gate.sector === 'WEST') {
          setActiveSector('G12-G15_WEST');
          setActiveGateSector('G12-G15_WEST');
        } else {
          setActiveSector('G1-G6_EAST');
          setActiveGateSector('G1-G6_EAST');
        }
        setViewMode('gate');
        setStadiumViewMode('MICRO_VIEW_EAST');
        break;
      }
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col bg-slate-950 rounded-xl overflow-hidden border border-slate-800">
      {/* Floating Concourse Mini-HUD */}
      {scenario === 'stadium' && (
        <div className="absolute top-2.5 right-3 z-10 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-700/80 backdrop-blur-md shadow-xl text-xs font-mono">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
              {viewMode === 'stadium' || stadiumViewMode === 'MACRO_VIEW'
                ? 'FULL STADIUM 360° RADAR'
                : (activeSector || activeGateSector) === 'G7-G11_SOUTH'
                ? 'SOUTH CONCOURSE (G7–11)'
                : (activeSector || activeGateSector) === 'G16-G21_NORTH'
                ? 'NORTH CONCOURSE (G16–21)'
                : (activeSector || activeGateSector) === 'G12-G15_WEST'
                ? 'WEST PAVILION (G12–15)'
                : 'EAST CONCOURSE (G1–6)'}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-cyan-400 font-bold">
                ⚡ {Math.round(throughputHistoryRef.current.length * 60)} p/min
              </span>
              <span className="text-slate-500">•</span>
              <span className="text-amber-400 font-bold">
                ⏱️ {waitTimesRef.current.length > 0 ? (waitTimesRef.current.reduce((a, b) => a + b, 0) / waitTimesRef.current.length).toFixed(1) : '18.4'}s avg wait
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Top Viewport Navigation Bar: Floating Pill Switcher */}
      {scenario === 'stadium' && (
        <div className="absolute top-2.5 left-3 z-10 flex items-center gap-1.5 p-1 rounded-lg bg-slate-900/95 border border-slate-700/80 backdrop-blur-md shadow-xl text-xs font-mono">
          <button
            onClick={() => {
              setViewMode('stadium');
              setStadiumViewMode('MACRO_VIEW');
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold transition ${
              viewMode === 'stadium' || stadiumViewMode === 'MACRO_VIEW'
                ? 'bg-cyan-950 text-cyan-300 border border-cyan-500 shadow-sm ring-1 ring-cyan-500/60'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="View Full Top-Down Stadium Radar & 21 Gates"
          >
            <span className="text-sm">🏟</span>
            <span>Full Stadium 360° Radar</span>
          </button>

          <div className="h-4 w-[1px] bg-slate-700 mx-0.5" />

          <button
            onClick={() => {
              setViewMode('gate');
              setStadiumViewMode('MICRO_VIEW_EAST');
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold transition ${
              viewMode === 'gate' || stadiumViewMode === 'MICRO_VIEW_EAST'
                ? 'bg-amber-950 text-amber-300 border border-orange-500 shadow-sm ring-1 ring-orange-500/60'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Inspect Sector Gate Ingress, S-Queue, Fast NFC Scan, and Security Counters"
          >
            <span className="text-sm">🚪</span>
            <span>Sector Gate Micro-Ingress</span>
          </button>

          <div className="h-4 w-[1px] bg-slate-700 mx-0.5" />

          {/* Quick Metro Pulse Spawner */}
          <button
            onClick={triggerMetroPulse}
            className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-rose-300 border border-rose-800/60 shadow-md transition active:scale-95"
            title="Simulate 6-Coach Metro Train Arrival (+400 Fans)"
          >
            <Train className="w-3.5 h-3.5 text-rose-400" />
            <span>Metro (+400)</span>
          </button>
        </div>
      )}

      {/* Dynamic Multi-Stage Security Counter Controls Overlay on Canvas */}
      {scenario === 'stadium' && (viewMode === 'gate' || stadiumViewMode === 'MICRO_VIEW_EAST') && (
        <div className="absolute top-12 left-3 z-10 flex flex-wrap items-center gap-2">
          {/* Gate 1 Counter Stepper */}
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-900/90 border border-amber-500/70 backdrop-blur-md shadow-lg text-[11px] font-mono">
            <span className="font-bold text-amber-400">Gate 1:</span>
            <span className="text-slate-200 font-bold">{counterCountGate1} Booths</span>
            <span className="text-[10px] text-slate-400 font-semibold">({Math.round((60 / securityCheckSpeed) * counterCountGate1)} p/m)</span>
            <div className="flex items-center gap-1 ml-0.5">
              <button
                onClick={() => removeCounter('gate-1')}
                disabled={counterCountGate1 <= 2}
                className="w-4 h-4 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-amber-300 font-bold flex items-center justify-center border border-slate-700 active:scale-95 transition"
                title="Remove 1 Security Counter"
              >
                <Minus className="w-2.5 h-2.5" />
              </button>
              <button
                onClick={() => addCounter('gate-1')}
                disabled={counterCountGate1 >= 10}
                className="w-4 h-4 rounded bg-amber-600 hover:bg-amber-500 disabled:opacity-30 text-slate-950 font-bold flex items-center justify-center active:scale-95 transition shadow-sm"
                title="Add 1 Security Counter (+60 p/min)"
              >
                <Plus className="w-2.5 h-2.5" />
              </button>
            </div>
          </div>

          {/* Gate 2 Counter Stepper */}
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-900/90 border border-cyan-500/70 backdrop-blur-md shadow-lg text-[11px] font-mono">
            <span className="font-bold text-cyan-400">Gate 2:</span>
            <span className="text-slate-200 font-bold">{counterCountGate2} Booths</span>
            <span className="text-[10px] text-slate-400 font-semibold">
              {auxGateActive || overflowRerouteActive ? `(${Math.round((60 / securityCheckSpeed) * counterCountGate2)} p/m)` : '(STANDBY)'}
            </span>
            <div className="flex items-center gap-1 ml-0.5">
              <button
                onClick={() => removeCounter('gate-2')}
                disabled={counterCountGate2 <= 1}
                className="w-4 h-4 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-cyan-300 font-bold flex items-center justify-center border border-slate-700 active:scale-95 transition"
                title="Remove 1 Security Counter"
              >
                <Minus className="w-2.5 h-2.5" />
              </button>
              <button
                onClick={() => addCounter('gate-2')}
                disabled={counterCountGate2 >= 8}
                className="w-4 h-4 rounded bg-cyan-600 hover:bg-cyan-500 disabled:opacity-30 text-slate-950 font-bold flex items-center justify-center active:scale-95 transition shadow-sm"
                title="Add 1 Security Counter (+60 p/min)"
              >
                <Plus className="w-2.5 h-2.5" />
              </button>
            </div>
          </div>
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
            stadiumViewMode === 'MACRO_VIEW' ? 'cursor-pointer' : ''
          }`}
        />
      </div>
    </div>
  );
};