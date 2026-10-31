import React, { useEffect, useRef } from 'react';
import { useSimulationStore } from '../../state/useSimulationStore';
import { getScenarioGeometry } from '../../engine/Geometry';
import { SpatialGrid } from '../../engine/SpatialGrid';
import { updateAgentPhysics, calculateCrowdInteractions } from '../../engine/SocialForceEngine';
import { AgentData, Gate, Wall } from '../../types/simulation';
import { ScenarioEngine } from '../../scenarios/engine/ScenarioEngine';
import {
  FundamentalDiagramPoint,
  PreGeneratedAgentDescriptor
} from '../../scenarios/types/ScenarioTypes';
import { ThreeZoneMonitor } from '../../scenarios/engine/ThreeZoneMonitor';
import { SafetyController } from '../../scenarios/engine/SafetyController';
import {
  CHINNASWAMY_SECTORS
} from '../../scenarios/data/stadiumConfig';
import {
  STADIUM_21_GATES
} from '../../scenarios/data/stadium21GateConfig';
import {
  StadiumNetworkEngine
} from '../../scenarios/engine/StadiumNetworkEngine';
import {
  convertPointerToCanvasCoordinates,
  findNearestRadarGate,
  DEFAULT_GATE_CLICK_TOLERANCE_PX,
  RADAR_CANVAS_WIDTH,
  RADAR_CANVAS_HEIGHT,
  RADAR_CENTER_X,
  RADAR_CENTER_Y,
  RADAR_OUTER_RADIUS
} from '../../scenarios/utils/radarGateSelection';

export const SimulationCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Store Subscriptions
  const scenario = useSimulationStore((s) => s.scenario);
  const inflowRate = useSimulationStore((s) => s.inflowRate);
  const gateLatency = useSimulationStore((s) => s.gateLatency);
  const walkingSpeed = useSimulationStore((s) => s.walkingSpeed);
  const bafflesActive = useSimulationStore((s) => s.bafflesActive);
  const auxGateActive = useSimulationStore((s) => s.auxGateActive);
  const dividerActive = useSimulationStore((s) => s.dividerActive);
  const isPaused = useSimulationStore((s) => s.isPaused);
  const timeScale = useSimulationStore((s) => s.timeScale);
  const resetSignal = useSimulationStore((s) => s.resetSignal);
  const setTelemetry = useSimulationStore((s) => s.setTelemetry);

  // Macro/Micro View & Gate Selection Subscriptions
  const viewMode = useSimulationStore((s) => s.viewMode);
  const setViewMode = useSimulationStore((s) => s.setViewMode);
  const setSelectedGateNumber = useSimulationStore((s) => s.setSelectedGateNumber);
  const setSelectedGateId = useSimulationStore((s) => s.setSelectedGateId);
  const opposingFlowPercent = useSimulationStore((s) => s.opposingFlowPercent);
  const physicsValidationMode = useSimulationStore((s) => s.physicsValidationMode);

  // Phase 3 Store Subscriptions
  const syntheticEvent = useSimulationStore((s) => s.syntheticEvent);
  const activeSchedule = useSimulationStore((s) => s.activeSchedule);
  const isDemoMode = useSimulationStore((s) => s.isDemoMode);
  const demoTimeMultiplier = useSimulationStore((s) => s.demoTimeMultiplier);

  // Headless Scenario Engine Instance Reference
  const scenarioEngineRef = useRef<ScenarioEngine | null>(null);
  const stadiumNetworkRef = useRef<StadiumNetworkEngine>(
    new StadiumNetworkEngine({
      totalSpectators: syntheticEvent?.expected_attendance || 33250,
      durationMinutes: 60,
      arrivalDistribution: syntheticEvent?.arrival_distribution || 'gaussian_peak',
      randomSeed: syntheticEvent?.random_seed || 2026
    })
  );
  const threeZoneMonitorRef = useRef<ThreeZoneMonitor>(new ThreeZoneMonitor());
  const diagramPointsRef = useRef<FundamentalDiagramPoint[]>([]);

  // Hover Interaction State Refs
  const hoveredGateIdRef = useRef<string | null>(null);
  const isHoveringCardButtonRef = useRef<boolean>(false);
  const isHoveringBackButtonRef = useRef<boolean>(false);

  // Mutable Physics References across animation frames
  const agentsRef = useRef<AgentData[]>([]);
  const nextIdRef = useRef<number>(1);
  const spawnAccRef = useRef<number>(0);
  const throughputHistoryRef = useRef<number[]>([]);
  const spatialGridRef = useRef<SpatialGrid>(new SpatialGrid(32));
  const wallsRef = useRef<Wall[]>([]);
  const gatesRef = useRef<Gate[]>([]);
  const bafflesRef = useRef<Wall[]>([]);

  // Telemetry Throttle References
  const lastTelemetryDispatchRef = useRef<number>(0);
  const fpsWindowRef = useRef<number[]>([]);
  const lastTimeRef = useRef<number>(performance.now());
  const flashTimerRef = useRef<number>(0);

  const CANVAS_WIDTH = RADAR_CANVAS_WIDTH;
  const CANVAS_HEIGHT = RADAR_CANVAS_HEIGHT;
  const PPM = 20; // 20 pixels = 1 meter

  // Initialize or Reset Arena Geometry
  const initSimulation = () => {
    const hasGateBInScenario =
      scenario === 'stadium' &&
      (auxGateActive || (syntheticEvent !== null && syntheticEvent.gate_B_share > 0));

    const geo = getScenarioGeometry(
      scenario,
      CANVAS_WIDTH,
      CANVAS_HEIGHT,
      bafflesActive,
      hasGateBInScenario,
      dividerActive
    );
    wallsRef.current = geo.walls;
    gatesRef.current = geo.gates.map((g) => ({ ...g, cooldown: 0, totalPassed: 0 }));
    bafflesRef.current = geo.baffles;

    // Reset agents and internal monitors
    agentsRef.current = [];
    nextIdRef.current = 1;
    spawnAccRef.current = 0;
    throughputHistoryRef.current = [];
    threeZoneMonitorRef.current.reset();
    diagramPointsRef.current = [];

    // Re-initialize 21-Gate Stadium Network Engine
    stadiumNetworkRef.current = new StadiumNetworkEngine({
      totalSpectators: syntheticEvent?.expected_attendance || 33250,
      durationMinutes: 60,
      arrivalDistribution: syntheticEvent?.arrival_distribution || 'gaussian_peak',
      randomSeed: syntheticEvent?.random_seed || 2026
    });

    if (syntheticEvent && activeSchedule) {
      scenarioEngineRef.current = new ScenarioEngine(syntheticEvent, activeSchedule);
      scenarioEngineRef.current.setDynamicInflowRate(inflowRate);
      if (scenario === 'stadium') {
        const gateBTotalLanes = syntheticEvent.gates['gate-b']?.totalLanes ?? 4;
        scenarioEngineRef.current.setGateOperationalLanes('gate-b', auxGateActive ? gateBTotalLanes : 0);
        scenarioEngineRef.current.setGateLatency('gate-a', gateLatency);
      }
    } else {
      scenarioEngineRef.current = null;
      const initialCount = scenario === 'stadium' ? 45 : scenario === 'bridge' ? 50 : 40;
      seedInitialAgents(initialCount);
    }
  };

  const seedInitialAgents = (count: number) => {
    for (let i = 0; i < count; i++) {
      spawnNewAgent();
    }
  };

  const spawnNewAgent = () => {
    const id = nextIdRef.current++;
    const radius = 5.0 + Math.random() * 1.0;

    let x = 0;
    let y = 0;
    let targetX = 0;
    let targetY = 0;
    let isReverse = false;
    let direction: 'inbound' | 'outbound' = 'inbound';
    let color = '#10b981';

    // Check if agent is assigned to counterflow stream
    const isOutbound = opposingFlowPercent > 0 && id % 100 < opposingFlowPercent;
    if (scenarioEngineRef.current) {
      if (isOutbound) {
        scenarioEngineRef.current.recordOutboundInjected();
      } else {
        scenarioEngineRef.current.recordInboundInjected();
      }
    }

    if (scenario === 'stadium') {
      if (isOutbound) {
        direction = 'outbound';
        x = 220 + Math.random() * (CANVAS_WIDTH - 440);
        y = 140 + Math.random() * 60; // Spawns near gate holding area
        targetX = x;
        targetY = CANVAS_HEIGHT - 30; // Walking out towards concourse exit
        color = '#c084fc'; // Purple
      } else {
        // Inbound
        x = 80 + Math.random() * (CANVAS_WIDTH - 160);
        y = CANVAS_HEIGHT - 60 + Math.random() * 30;
        targetX = CANVAS_WIDTH / 2;
        targetY = 60;
        if (auxGateActive && (x > CANVAS_WIDTH * 0.55 || id % 2 === 0)) {
          targetX = CANVAS_WIDTH * 0.8;
          targetY = 60;
        }
      }
    } else if (scenario === 'bridge') {
      if (id % 2 === 0) {
        x = 60 + Math.random() * 40;
        y = CANVAS_HEIGHT * 0.35 + Math.random() * (CANVAS_HEIGHT * 0.12);
        targetX = CANVAS_WIDTH - 50;
        targetY = y;
      } else {
        x = CANVAS_WIDTH - 100 + Math.random() * 40;
        y = CANVAS_HEIGHT * 0.53 + Math.random() * (CANVAS_HEIGHT * 0.12);
        targetX = 50;
        targetY = y;
        isReverse = true;
        color = '#c084fc';
        direction = 'outbound';
      }
    } else if (scenario === 'reversal') {
      x = 80 + Math.random() * (CANVAS_WIDTH * 0.4);
      y = CANVAS_HEIGHT * 0.35 + Math.random() * (CANVAS_HEIGHT * 0.3);
      targetX = CANVAS_WIDTH - 80;
      targetY = CANVAS_HEIGHT * 0.5;
    }

    const agent: AgentData = {
      id,
      x,
      y,
      vx: (Math.random() - 0.5) * 2,
      vy: direction === 'outbound' ? 2 : (Math.random() - 0.5) * 2,
      radius,
      targetX,
      targetY,
      density: 1.0,
      stuckTime: 0,
      color,
      isReverse,
      desiredSpeed: walkingSpeed * (0.9 + Math.random() * 0.2),
      active: true,
      direction
    };

    agentsRef.current.push(agent);
  };

  /**
   * Instantiates a pre-generated agent descriptor from the immutable arrival schedule.
   */
  const spawnScheduledAgent = (desc: PreGeneratedAgentDescriptor) => {
    let x = desc.initialConcourseX;
    let y = desc.initialConcourseY;
    let targetX = CANVAS_WIDTH / 2;
    let targetY = 60;
    let isReverse = false;
    let direction: 'inbound' | 'outbound' = 'inbound';
    let color = desc.defaultGateTarget === 'gate-b' ? '#38bdf8' : '#10b981';

    // Counterflow Check
    const isOutbound = opposingFlowPercent > 0 && desc.agentIndex % 100 < opposingFlowPercent;
    if (scenarioEngineRef.current) {
      if (isOutbound) {
        scenarioEngineRef.current.recordOutboundInjected();
      } else {
        scenarioEngineRef.current.recordInboundInjected();
      }
    }

    if (scenario === 'stadium') {
      if (isOutbound) {
        direction = 'outbound';
        x = 220 + ((desc.agentIndex * 37) % (CANVAS_WIDTH - 440));
        y = 140 + ((desc.agentIndex * 19) % 60);
        targetX = x;
        targetY = CANVAS_HEIGHT - 30; // Egressing towards perimeter street
        color = '#c084fc'; // Purple
      } else {
        const isAdaptive = syntheticEvent?.routing_mode === 'adaptive';
        if (isAdaptive) {
          if (auxGateActive && (desc.initialConcourseX > CANVAS_WIDTH * 0.55 || desc.defaultGateTarget === 'gate-b')) {
            targetX = CANVAS_WIDTH * 0.8;
            targetY = 60;
          } else {
            targetX = CANVAS_WIDTH / 2;
            targetY = 60;
          }
        } else {
          // Strict fixed routing
          if (desc.defaultGateTarget === 'gate-b') {
            targetX = CANVAS_WIDTH * 0.8;
            targetY = 60;
          } else {
            targetX = CANVAS_WIDTH / 2;
            targetY = 60;
          }
        }
      }
    } else if (scenario === 'reversal') {
      x = 80 + (desc.initialConcourseX / CANVAS_WIDTH) * (CANVAS_WIDTH * 0.5);
      y = CANVAS_HEIGHT * 0.32 + ((desc.initialConcourseY - (CANVAS_HEIGHT - 65)) / 45) * (CANVAS_HEIGHT * 0.36);
      targetX = 50;
      targetY = CANVAS_HEIGHT * 0.5;
      isReverse = true;
    } else if (scenario === 'bridge') {
      if (desc.agentIndex % 2 === 0) {
        x = 60;
        y = CANVAS_HEIGHT * 0.35 + ((desc.initialConcourseY - (CANVAS_HEIGHT - 65)) / 45) * (CANVAS_HEIGHT * 0.12);
        targetX = CANVAS_WIDTH - 50;
        targetY = y;
      } else {
        x = CANVAS_WIDTH - 100;
        y = CANVAS_HEIGHT * 0.53 + ((desc.initialConcourseY - (CANVAS_HEIGHT - 65)) / 45) * (CANVAS_HEIGHT * 0.12);
        targetX = 50;
        targetY = y;
        isReverse = true;
        color = '#c084fc';
        direction = 'outbound';
      }
    }

    const agent: AgentData = {
      id: desc.agentIndex,
      x,
      y,
      vx: 0,
      vy: direction === 'outbound' ? 2 : 0,
      radius: desc.physicalRadiusPx,
      targetX,
      targetY,
      density: 1.0,
      stuckTime: 0,
      color,
      isReverse,
      desiredSpeed: desc.walkingSpeedMps,
      active: true,
      spawnTimeSimSec: desc.spawnTimeSimSec,
      targetGateId: desc.defaultGateTarget,
      direction
    };

    agentsRef.current.push(agent);
  };

  // Re-sync geometry when scenario, schedule or resetSignal changes
  useEffect(() => {
    initSimulation();
  }, [scenario, resetSignal, activeSchedule, syntheticEvent]);

  // Sync toggles with existing geometry without clearing crowd
  useEffect(() => {
    const hasGateBInScenario =
      scenario === 'stadium' &&
      (auxGateActive || (syntheticEvent !== null && syntheticEvent.gate_B_share > 0));

    const geo = getScenarioGeometry(
      scenario,
      CANVAS_WIDTH,
      CANVAS_HEIGHT,
      bafflesActive,
      hasGateBInScenario,
      dividerActive
    );
    wallsRef.current = geo.walls;
    bafflesRef.current = geo.baffles;

    // Keep existing gate stats while updating active status
    const newGates = geo.gates.map((g) => {
      const existing = gatesRef.current.find((eg) => eg.id === g.id);
      return existing
        ? { ...g, cooldown: existing.cooldown, totalPassed: existing.totalPassed }
        : { ...g, cooldown: 0, totalPassed: 0 };
    });
    gatesRef.current = newGates;

    if (scenarioEngineRef.current && syntheticEvent) {
      const gateBTotalLanes = syntheticEvent.gates['gate-b']?.totalLanes ?? 4;
      scenarioEngineRef.current.setGateOperationalLanes('gate-b', auxGateActive ? gateBTotalLanes : 0);
      scenarioEngineRef.current.setGateLatency('gate-a', gateLatency);
    }

    const isAdaptive = !syntheticEvent || syntheticEvent.routing_mode === 'adaptive';
    if (scenario === 'stadium' && isAdaptive) {
      for (const a of agentsRef.current) {
        if (a.direction === 'outbound') continue;
        if (auxGateActive && a.x > CANVAS_WIDTH * 0.5) {
          a.targetX = CANVAS_WIDTH * 0.8;
          a.targetY = 60;
        } else {
          a.targetX = CANVAS_WIDTH / 2;
          a.targetY = 60;
        }
      }
    }
  }, [bafflesActive, auxGateActive, dividerActive, gateLatency, syntheticEvent]);

  // Dynamically update demand pacing multiplier when inflowRate changes
  useEffect(() => {
    if (scenarioEngineRef.current) {
      scenarioEngineRef.current.setDynamicInflowRate(inflowRate);
    }
  }, [inflowRate]);

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
      const baseDt = Math.min(Math.max(rawDt, 0.001), 0.05);
      const effectiveTimeMultiplier = isDemoMode ? timeScale * demoTimeMultiplier : timeScale;
      const totalSimDt = baseDt * effectiveTimeMultiplier;

      // Track FPS
      if (rawDt > 0) {
        fpsWindowRef.current.push(1 / rawDt);
        if (fpsWindowRef.current.length > 25) fpsWindowRef.current.shift();
      }
      const currentFps = Math.round(
        fpsWindowRef.current.reduce((a, b) => a + b, 0) / (fpsWindowRef.current.length || 1)
      );

      flashTimerRef.current += totalSimDt;
      const isFlashTick = Math.sin(flashTimerRef.current * 14) > 0;

      let peakDensity = 0;
      let maxSpillbackPx = 0;
      const primaryGate = gatesRef.current[0];
      const simTimeSec = scenarioEngineRef.current?.getCurrentSimTimeSec() ?? (currentTime / 1000);

      if (!isPaused) {
        // Enforce Helbing social force numerical stability: dtSub <= 0.025s
        const subSteps = Math.max(1, Math.ceil(totalSimDt / 0.025));
        const dtSub = totalSimDt / subSteps;

        for (let step = 0; step < subSteps; step++) {
          // Advance 21-Gate Stadium Network Engine in lockstep with simulation time
          stadiumNetworkRef.current?.step(dtSub);

          if (viewMode === 'micro') {
            // 1. Inflow Spawning
            if (scenarioEngineRef.current) {
              const newlySpawned = scenarioEngineRef.current.step(dtSub);
              for (let s = 0; s < newlySpawned.length; s++) {
                spawnScheduledAgent(newlySpawned[s]);
              }
            } else {
              const sPop = syntheticEvent?.population_scaling_ratio || 13.333333;
              const simInflowPerMin = inflowRate / sPop;
              const agentsPerSec = simInflowPerMin / 60;
              spawnAccRef.current += agentsPerSec * dtSub;
              while (spawnAccRef.current >= 1.0) {
                spawnAccRef.current -= 1.0;
                if (agentsRef.current.length < 2500) {
                  spawnNewAgent();
                }
              }
            }

            // 2. Gate Turnstile Cooldowns (Manual fallback)
            if (!scenarioEngineRef.current) {
              for (const gate of gatesRef.current) {
                if (gate.cooldown > 0) {
                  gate.cooldown = Math.max(0, gate.cooldown - dtSub);
                }
              }
            }

            // 3. Social Force Crowd Interactions O(N)
            calculateCrowdInteractions(
              agentsRef.current,
              spatialGridRef.current,
              dtSub,
              isFlashTick
            );

            // 4. Update Individual Agent Physics & Gate Clearances
            const agents = agentsRef.current;
            const walls = wallsRef.current;
            const baffles = bafflesRef.current;
            const gates = gatesRef.current;

            for (let i = 0; i < agents.length; i++) {
              const a = agents[i];
              if (a.active === false) continue;

              if (a.density > peakDensity) {
                peakDensity = a.density;
              }

              if (primaryGate && a.stuckTime > 0.5 && a.direction !== 'outbound') {
                const distFromGate = Math.hypot(a.x - primaryGate.x, a.y - primaryGate.y);
                if (distFromGate > maxSpillbackPx) {
                  maxSpillbackPx = distFromGate;
                }
              }

              // Physics update
              updateAgentPhysics(a, dtSub, walkingSpeed, walls, baffles);

              // Outbound agents clear concourse at bottom exit
              if (a.direction === 'outbound' && a.y >= CANVAS_HEIGHT - 35) {
                if (scenarioEngineRef.current) {
                  scenarioEngineRef.current.recordOutboundExit();
                }
                a.active = false;
                continue;
              }

              // Inbound Gate Passage Check
              if (a.direction !== 'outbound') {
                for (let g = 0; g < gates.length; g++) {
                  const gate = gates[g];
                  const halfW = gate.width / 2 + 6;
                  const halfH = gate.height / 2 + 10;

                  if (Math.abs(a.x - gate.x) <= halfW && Math.abs(a.y - gate.y) <= halfH) {
                    if (scenarioEngineRef.current) {
                      const admitted = scenarioEngineRef.current.attemptGatePassage(gate.id);
                      if (admitted) {
                        gate.totalPassed = (gate.totalPassed || 0) + 1;
                        a.active = false;
                        throughputHistoryRef.current.push(currentTime);
                        break;
                      } else {
                        a.vx *= 0.15;
                        a.vy *= 0.15;
                        if (a.y < gate.y + 12) {
                          a.y = gate.y + 12;
                        }
                        a.stuckTime += dtSub;
                      }
                    } else {
                      if (gate.active && gate.cooldown <= 0) {
                        gate.cooldown = gateLatency;
                        gate.totalPassed = (gate.totalPassed || 0) + 1;
                        a.active = false;
                        throughputHistoryRef.current.push(currentTime);
                        break;
                      } else {
                        a.vx *= 0.15;
                        a.vy *= 0.15;
                        if (!gate.active && a.y < gate.y + 12) {
                          a.y = gate.y + 12;
                        }
                        a.stuckTime += dtSub;
                      }
                    }
                  }
                }
              }
            }

            // Prune inactive agents
            agentsRef.current = agentsRef.current.filter((a) => a.active !== false);
          }
        }

        // Prune rolling throughput
        if (viewMode === 'micro') {
          const oneMinuteAgo = currentTime - 60000;
          throughputHistoryRef.current = throughputHistoryRef.current.filter((t) => t >= oneMinuteAgo);
        }
      }

      // 5. Update Three-Zone Spatial Monitor & Counterflow Telemetry
      const threeZoneTelemetry = threeZoneMonitorRef.current.update(
        agentsRef.current,
        totalSimDt,
        simTimeSec,
        throughputHistoryRef.current.length
      );
      const counterflowTelemetry = threeZoneMonitorRef.current.getCounterflowTelemetry(opposingFlowPercent);

      // 6. Physics Validation Mode (J = rho * v)
      let physicsValidationTelemetry = undefined;
      if (physicsValidationMode) {
        const liveAgents = agentsRef.current;
        let avgSpeed = 0;
        for (let i = 0; i < liveAgents.length; i++) {
          avgSpeed += Math.hypot(liveAgents[i].vx, liveAgents[i].vy) / PPM;
        }
        avgSpeed = liveAgents.length > 0 ? avgSpeed / liveAgents.length : 1.3;
        const currentDensityRho = threeZoneTelemetry.systemMaxDensity;
        const currentJ = currentDensityRho * avgSpeed;

        if (currentTime - lastTelemetryDispatchRef.current >= 500) {
          diagramPointsRef.current.push({
            density: Math.round(currentDensityRho * 10) / 10,
            speed: Math.round(avgSpeed * 100) / 100,
            flow: Math.round(currentJ * 100) / 100,
            timestampSec: simTimeSec
          });
          if (diagramPointsRef.current.length > 40) diagramPointsRef.current.shift();
        }

        physicsValidationTelemetry = {
          isValidationModeActive: true,
          currentJFlowRate: Math.round(currentJ * 100) / 100,
          currentDensityRho: Math.round(currentDensityRho * 10) / 10,
          currentSpeedV: Math.round(avgSpeed * 100) / 100,
          theoreticalJ: Math.round(currentDensityRho * avgSpeed * 100) / 100,
          flowDecayObserved: currentDensityRho >= 4.0,
          diagramHistory: diagramPointsRef.current
        };
      }

      // 7. Safety Recommendations
      const safetyRecs = SafetyController.evaluateConditions(
        threeZoneTelemetry,
        counterflowTelemetry,
        auxGateActive,
        bafflesActive,
        dividerActive
      );

      // 8. Dispatch Telemetry at 4 Hz (every 250ms)
      if (currentTime - lastTelemetryDispatchRef.current >= 250) {
        lastTelemetryDispatchRef.current = currentTime;

        const sPop = syntheticEvent?.population_scaling_ratio || 13.333333;
        const effectiveSimRate = scenarioEngineRef.current ? (inflowRate / sPop) : inflowRate;

        // Synchronize 21-Gate Stadium Network Telemetry from fresh state to prevent stale closure
        const curState = useSimulationStore.getState();
        const activeGateNumber = curState.selectedGateNumber;
        const activeGateId = curState.selectedGateId;

        const networkSummary = stadiumNetworkRef.current?.getNetworkSummary();
        const focusedGateState = stadiumNetworkRef.current?.getGateState(activeGateNumber);
        const focusedGateDef = STADIUM_21_GATES.find(
          (g) => g.gateNumber === activeGateNumber || g.id === activeGateId
        );

        const baseTelemetry = {
          peakDensity: Math.round(peakDensity * 10) / 10,
          spillbackMeters: Math.round((maxSpillbackPx / PPM) * 10) / 10,
          throughputPerMin: throughputHistoryRef.current.length,
          liveAgents: agentsRef.current.length,
          fps: currentFps,
          isCritical: peakDensity >= 5.0,
          isDemoMode,
          demoTimeMultiplier: isDemoMode ? demoTimeMultiplier : 1,
          effectiveSimInflowRate: Math.round(effectiveSimRate * 10) / 10,
          threeZone: threeZoneTelemetry,
          counterflow: counterflowTelemetry,
          physicsValidation: physicsValidationTelemetry,
          safetyRecommendations: safetyRecs,
          networkSummary,
          focusedGateId: focusedGateDef?.id,
          focusedGateNumber: activeGateNumber,
          focusedGateState
        };

        if (scenarioEngineRef.current) {
          const accounting = scenarioEngineRef.current.getAccounting();
          setTelemetry({
            ...baseTelemetry,
            representedAdmitted: accounting.representedAdmitted,
            totalAdmittedSim: accounting.totalAdmitted,
            totalGeneratedSim: accounting.totalInjected,
            totalInboundInjected: accounting.totalInboundInjected,
            totalOutboundInjected: accounting.totalOutboundInjected,
            totalOutboundExited: accounting.totalOutboundExited,
            activeInbound: accounting.activeInbound,
            activeOutbound: accounting.activeOutbound,
            observedThroughputRep: scenarioEngineRef.current.getObservedThroughputRepPerMin(),
            simTimeSec: Math.round(scenarioEngineRef.current.getCurrentSimTimeSec() * 10) / 10
          });
        } else {
          setTelemetry(baseTelemetry);
        }
      }

      // 9. Draw Frame (Micro Concourse vs Macro Radar) with fresh state
      const liveState = useSimulationStore.getState();
      const currentSelectedGateNumber = liveState.selectedGateNumber;
      const currentSelectedGateId = liveState.selectedGateId;

      if (viewMode === 'macro') {
        drawMacroStadiumRadar(ctx, currentTime, currentSelectedGateNumber, currentSelectedGateId);
      } else {
        drawFrame(
          ctx,
          currentTime,
          isFlashTick,
          threeZoneTelemetry,
          currentSelectedGateNumber,
          currentSelectedGateId
        );
      }

      animId = requestAnimationFrame(renderLoop);
    };

    animId = requestAnimationFrame(renderLoop);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [
    isPaused,
    timeScale,
    isDemoMode,
    demoTimeMultiplier,
    inflowRate,
    gateLatency,
    walkingSpeed,
    scenario,
    auxGateActive,
    bafflesActive,
    dividerActive,
    viewMode,
    opposingFlowPercent,
    physicsValidationMode,
    setTelemetry,
    activeSchedule,
    syntheticEvent
  ]);

  /**
   * Draws the Microscopic Concourse Ingress Canvas with 3-Zone Overlays (for verified gates G1..G3)
   * OR the dedicated calibrated Macro Corridor Estimate schematic (for CAD pending gates G4..G21)
   */
  const drawFrame = (
    ctx: CanvasRenderingContext2D,
    currentTime: number,
    isFlashTick: boolean,
    zones: ReturnType<ThreeZoneMonitor['update']>,
    activeGateNumber: number,
    activeGateId: string
  ) => {
    ctx.fillStyle = '#080c14';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Identify focused gate definition and live state
    const focusedGate21 =
      STADIUM_21_GATES.find(
        (g) => g.gateNumber === activeGateNumber || g.id === activeGateId
      ) || STADIUM_21_GATES[0];
    const isVerifiedTwin = focusedGate21.approachGeometryStatus === 'verified';
    const focusedLive = stadiumNetworkRef.current?.getGateState(focusedGate21.id);
    const focusedSector = CHINNASWAMY_SECTORS[focusedGate21.sectorId];

    // =========================================================================
    // CASE A: UNMODELED / MACRO DEMAND ESTIMATE GATES (G4 .. G21)
    // No fake agents or fake concourse walls. Renders rich diagnostic twin.
    // =========================================================================
    if (!isVerifiedTwin) {
      // 1. Top Navigation & Return Button
      const retBtnX = 25;
      const retBtnY = 14;
      const retBtnW = 180;
      const retBtnH = 26;

      ctx.save();
      ctx.fillStyle = isHoveringBackButtonRef.current ? 'rgba(14, 116, 144, 0.9)' : 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 1.5;
      ctx.fillRect(retBtnX, retBtnY, retBtnW, retBtnH);
      ctx.strokeRect(retBtnX, retBtnY, retBtnW, retBtnH);

      ctx.textAlign = 'center';
      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('← BACK TO 21-GATE RADAR', retBtnX + retBtnW / 2, retBtnY + 17);

      // Top Title & Road Group
      ctx.textAlign = 'left';
      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(
        `GATE ${focusedGate21.gateNumber}: ${focusedGate21.displayName.toUpperCase()}`,
        225,
        24
      );
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(
        `ROAD: ${focusedGate21.entryRoadGroup.toUpperCase()} • SECTOR: ${focusedSector?.name.split(' (')[0].toUpperCase()} • CLASSIFICATION: ${focusedGate21.gateType.toUpperCase()}`,
        225,
        38
      );
      ctx.restore();

      // 2. Architecture / CAD Status Banner
      ctx.save();
      const banX = 25;
      const banY = 48;
      const banW = CANVAS_WIDTH - 50;
      const banH = 46;

      ctx.fillStyle = 'rgba(245, 158, 11, 0.08)';
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.5;
      ctx.fillRect(banX, banY, banW, banH);
      ctx.strokeRect(banX, banY, banW, banH);

      ctx.textAlign = 'left';
      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      ctx.fillStyle = '#fbbf24';
      ctx.fillText(
        `▲ [MACRO DEMAND ESTIMATE • CAD BLUEPRINT PENDING] — OFFICIAL E-ID: ${focusedGate21.externalReferenceId}`,
        banX + 14,
        banY + 18
      );
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText(
        `Architectural concourse blueprints and turnstile stanchion CAD coordinates for Gate ${focusedGate21.gateNumber} are pending site survey.`,
        banX + 14,
        banY + 32
      );
      ctx.fillText(
        `Queue spillback, NFC latency, and bottleneck dynamics are computed via the 21-Gate Stadium Network Engine.`,
        banX + 14,
        banY + 42
      );
      ctx.restore();

      // 3. Three Diagnostic Cards
      const cardY = 104;
      const cardW = 295;
      const cardH = 325;

      // Card 1: Approach Queue Dynamics
      const c1X = 25;
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      ctx.fillRect(c1X, cardY, cardW, cardH);
      ctx.strokeRect(c1X, cardY, cardW, cardH);

      ctx.textAlign = 'left';
      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('APPROACH QUEUE ACCUMULATION', c1X + 14, cardY + 22);

      const qVal = focusedLive?.currentQueue ?? 0;
      ctx.font = 'bold 32px "JetBrains Mono", monospace';
      ctx.fillStyle = qVal > 150 ? '#ef4444' : qVal > 50 ? '#f97316' : '#f8fafc';
      ctx.fillText(`${qVal}`, c1X + 14, cardY + 62);
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('Spectators Waiting Outside', c1X + 14, cardY + 78);

      const waitMin = focusedLive ? (focusedLive.estimatedWaitTimeSec / 60).toFixed(1) : '0.0';
      const spillMeters = focusedLive?.queueLengthMeters.toFixed(1) ?? '0.0';

      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText(`Estimated Wait:`, c1X + 14, cardY + 115);
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(`${waitMin} minutes`, c1X + 140, cardY + 115);

      ctx.fillStyle = '#cbd5e1';
      ctx.fillText(`Queue Spillback:`, c1X + 14, cardY + 138);
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(`${spillMeters} meters`, c1X + 140, cardY + 138);

      ctx.fillStyle = '#cbd5e1';
      ctx.fillText(`Pending Demand:`, c1X + 14, cardY + 161);
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(`${focusedLive?.remainingArrivals ?? 0} spectators`, c1X + 140, cardY + 161);

      // Queue Capacity Fill Meter
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(c1X + 14, cardY + 190, cardW - 28, 14);
      const qCap = 500;
      const fillRatio = Math.min(1.0, qVal / qCap);
      ctx.fillStyle = fillRatio > 0.8 ? '#ef4444' : fillRatio > 0.4 ? '#f59e0b' : '#10b981';
      ctx.fillRect(c1X + 14, cardY + 190, (cardW - 28) * fillRatio, 14);

      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(`Corridor Buffer: ${Math.round(fillRatio * 100)}% of nominal capacity`, c1X + 14, cardY + 220);

      ctx.fillText('Status Notice:', c1X + 14, cardY + 260);
      ctx.fillStyle = focusedGate21.publicEntryEligible ? '#64748b' : '#f59e0b';
      const qNotice = focusedGate21.publicEntryEligible
        ? 'Public entry enabled. Queue accumulates outside perimeter.'
        : `Reserved for ${focusedGate21.gateType.toUpperCase()}. Public ticketing disabled.`;
      ctx.fillText(qNotice, c1X + 14, cardY + 276);
      ctx.restore();

      // Card 2: Local Concourse Density & Level of Service (LOS)
      const c2X = c1X + cardW + 15;
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      ctx.fillRect(c2X, cardY, cardW, cardH);
      ctx.strokeRect(c2X, cardY, cardW, cardH);

      ctx.textAlign = 'left';
      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('LOCAL CONCOURSE DENSITY & LOS', c2X + 14, cardY + 22);

      const dVal = focusedLive?.localDensity ?? 0;
      ctx.font = 'bold 32px "JetBrains Mono", monospace';
      ctx.fillStyle = dVal >= 4.5 ? '#ef4444' : dVal >= 2.5 ? '#f59e0b' : '#10b981';
      ctx.fillText(`${dVal.toFixed(1)}`, c2X + 14, cardY + 62);
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('People / m² in Concourse Approach', c2X + 14, cardY + 78);

      let losText = 'LOS A — Free Flow';
      let losColor = '#10b981';
      if (dVal >= 4.5) {
        losText = 'LOS F — Crush Hazard Breakdown';
        losColor = '#ef4444';
      } else if (dVal >= 3.5) {
        losText = 'LOS E — Severe Queue Delay';
        losColor = '#f97316';
      } else if (dVal >= 2.5) {
        losText = 'LOS D — Impeded Dense Crowd';
        losColor = '#f59e0b';
      } else if (dVal >= 1.5) {
        losText = 'LOS C — Steady Continuous Flow';
        losColor = '#38bdf8';
      }

      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      ctx.fillStyle = losColor;
      ctx.fillText(losText, c2X + 14, cardY + 115);

      // Density Gauge Bar
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(c2X + 14, cardY + 135, cardW - 28, 14);
      const dFillRatio = Math.min(1.0, dVal / 6.0);
      ctx.fillStyle = losColor;
      ctx.fillRect(c2X + 14, cardY + 135, (cardW - 28) * dFillRatio, 14);

      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('0 p/m²', c2X + 14, cardY + 162);
      ctx.fillText('2.5 (Queue)', c2X + 105, cardY + 162);
      ctx.fillText('4.5+ (Hazard)', c2X + 205, cardY + 162);

      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText(`Congestion Level:`, c2X + 14, cardY + 195);
      ctx.fillStyle = losColor;
      ctx.fillText(`${(focusedLive?.congestionState ?? 'normal').toUpperCase()}`, c2X + 140, cardY + 195);

      ctx.fillStyle = '#94a3b8';
      ctx.fillText('Measurement Method:', c2X + 14, cardY + 235);
      ctx.fillStyle = '#64748b';
      ctx.fillText('Macro Queuing Accumulation Model.', c2X + 14, cardY + 252);
      ctx.fillText('Microscopic Social Force grid pending CAD blueprint.', c2X + 14, cardY + 266);
      ctx.fillText('Density derived from physical concourse dimensions.', c2X + 14, cardY + 280);
      ctx.restore();

      // Card 3: Screening & Turnstile Array
      const c3X = c2X + cardW + 15;
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      ctx.fillRect(c3X, cardY, cardW, cardH);
      ctx.strokeRect(c3X, cardY, cardW, cardH);

      ctx.textAlign = 'left';
      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('SCREENING & TURNSTILE ARRAY', c3X + 14, cardY + 22);

      const opLanes = focusedLive?.channels?.filter((c) => c.operational).length ?? focusedGate21.turnstileCount;
      ctx.font = 'bold 32px "JetBrains Mono", monospace';
      ctx.fillStyle = opLanes > 0 ? '#10b981' : '#ef4444';
      ctx.fillText(`${opLanes} / ${focusedGate21.turnstileCount}`, c3X + 14, cardY + 62);
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('Operational Turnstile Lanes', c3X + 14, cardY + 78);

      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText('NFC Scan Latency:', c3X + 14, cardY + 115);
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(`${focusedGate21.defaultLatencySec}s / spectator`, c3X + 140, cardY + 115);

      ctx.fillStyle = '#cbd5e1';
      ctx.fillText('Rolling Rate:', c3X + 14, cardY + 138);
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(`${focusedLive?.rollingThroughputPerMin ?? 0} p/min`, c3X + 140, cardY + 138);

      ctx.fillStyle = '#cbd5e1';
      ctx.fillText('Admitted Spectators:', c3X + 14, cardY + 161);
      ctx.fillStyle = '#10b981';
      ctx.fillText(`${focusedLive?.totalAdmitted ?? 0}`, c3X + 150, cardY + 161);

      // Channel Boxes
      ctx.fillText('Turnstile Channels:', c3X + 14, cardY + 195);
      const numChannels = focusedGate21.turnstileCount;
      const boxW = Math.min(36, Math.floor((cardW - 40) / numChannels));
      for (let ch = 0; ch < numChannels; ch++) {
        const bx = c3X + 14 + ch * (boxW + 4);
        const by = cardY + 208;
        const isOp = ch < opLanes;
        ctx.fillStyle = isOp ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)';
        ctx.strokeStyle = isOp ? '#10b981' : '#ef4444';
        ctx.lineWidth = 1;
        ctx.fillRect(bx, by, boxW, 22);
        ctx.strokeRect(bx, by, boxW, 22);

        ctx.font = 'bold 8px "JetBrains Mono", monospace';
        ctx.fillStyle = isOp ? '#34d399' : '#f87171';
        ctx.textAlign = 'center';
        ctx.fillText(`T${ch + 1}`, bx + boxW / 2, by + 14);
      }

      ctx.textAlign = 'left';
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('Stand Entitlement:', c3X + 14, cardY + 252);
      ctx.fillStyle = '#cbd5e1';
      const standsStr = focusedGate21.connectedStandIds.join(', ') || 'Reserved Access';
      ctx.fillText(standsStr, c3X + 14, cardY + 268);

      if (focusedGate21.mappingStatus === 'unresolved_placeholder') {
        ctx.fillStyle = '#f59e0b';
        ctx.fillText('⚠ Unresolved E-ID mapping (survey pending)', c3X + 14, cardY + 295);
      }
      ctx.restore();

      // 4. Bottom Return Action Callout
      ctx.save();
      const botY = 445;
      const botW = CANVAS_WIDTH - 50;
      const botH = 110;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.fillRect(25, botY, botW, botH);
      ctx.strokeRect(25, botY, botW, botH);

      const botBtnX = CANVAS_WIDTH / 2 - 140;
      const botBtnY = botY + 18;
      const botBtnW = 280;
      const botBtnH = 34;

      ctx.fillStyle = isHoveringBackButtonRef.current ? 'rgba(14, 116, 144, 0.95)' : 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 1.8;
      ctx.fillRect(botBtnX, botBtnY, botBtnW, botBtnH);
      ctx.strokeRect(botBtnX, botBtnY, botBtnW, botBtnH);

      ctx.textAlign = 'center';
      ctx.font = 'bold 12px "JetBrains Mono", monospace';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('← RETURN TO 21-GATE RADAR', CANVAS_WIDTH / 2, botBtnY + 22);

      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(
        'Tip: Gates 1, 2, and 3 feature fully verified microscopic Social Force concourse physical twins.',
        CANVAS_WIDTH / 2,
        botY + 76
      );
      ctx.fillText(
        'Select Gate 1, 2, or 3 from the 21-Gate Radar to view pedestrian agent vectors, baffles, and density heatmaps.',
        CANVAS_WIDTH / 2,
        botY + 92
      );
      ctx.restore();
      return;
    }

    // =========================================================================
    // CASE B: VERIFIED PHYSICAL CONCOURSE TWIN (GATES 1, 2, 3)
    // Full Social Force Engine, 3 Zones, Baffles, Turnstiles, Agent Vectors
    // =========================================================================

    // Top Header & Return Button
    ctx.save();
    const retBtnX = 25;
    const retBtnY = 14;
    const retBtnW = 175;
    const retBtnH = 26;

    ctx.fillStyle = isHoveringBackButtonRef.current ? 'rgba(14, 116, 144, 0.9)' : 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 1.5;
    ctx.fillRect(retBtnX, retBtnY, retBtnW, retBtnH);
    ctx.strokeRect(retBtnX, retBtnY, retBtnW, retBtnH);

    ctx.textAlign = 'center';
    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('← BACK TO RADAR', retBtnX + retBtnW / 2, retBtnY + 17);

    ctx.textAlign = 'left';
    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(
      `M. CHINNASWAMY • MICRO CONCOURSE TWIN — GATE ${activeGateNumber}: ${focusedGate21.displayName.toUpperCase()} [${focusedSector?.name.split(' (')[0].toUpperCase() || 'SECTOR'}]`,
      215,
      24
    );

    // Geometry Status Tag & Live Gate Queue
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.fillStyle = '#10b981';
    ctx.fillText('● [VERIFIED CONCOURSE TWIN • PHYSICAL MICRO DYNAMICS]', 215, 38);

    if (focusedLive) {
      ctx.fillStyle = '#94a3b8';
      const waitMin = (focusedLive.estimatedWaitTimeSec / 60).toFixed(1);
      ctx.fillText(
        `LIVE QUEUE: ${focusedLive.currentQueue} | WAIT: ${waitMin}m | DENSITY: ${focusedLive.localDensity.toFixed(1)} p/m² | ADMITTED: ${focusedLive.totalAdmitted}`,
        550,
        38
      );
    }
    ctx.restore();

    // 1m & 5m Tactical Grid
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

    // THREE-ZONE SPATIAL OVERLAYS
    if (scenario === 'stadium') {
      // Zone 1: Gate Approach Area (y: 60 - 180)
      const z1Density = zones.gateApproach.currentDensity;
      ctx.fillStyle = z1Density >= 5.0 ? 'rgba(244, 63, 94, 0.12)' : z1Density >= 4.5 ? 'rgba(245, 158, 11, 0.08)' : 'rgba(6, 182, 212, 0.04)';
      ctx.fillRect(180, 60, 680, 120);
      ctx.strokeStyle = z1Density >= 5.0 ? 'rgba(244, 63, 94, 0.8)' : 'rgba(6, 182, 212, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(180, 60, 680, 120);

      // Zone 2: Intermediate Holding Area (y: 180 - 360)
      const z2Density = zones.intermediateHolding.currentDensity;
      ctx.fillStyle = z2Density >= 5.0 ? 'rgba(244, 63, 94, 0.12)' : z2Density >= 4.5 ? 'rgba(245, 158, 11, 0.08)' : 'rgba(245, 158, 11, 0.03)';
      ctx.fillRect(140, 180, 740, 180);
      ctx.strokeStyle = z2Density >= 5.0 ? 'rgba(244, 63, 94, 0.8)' : 'rgba(245, 158, 11, 0.4)';
      ctx.strokeRect(140, 180, 740, 180);

      // Zone 3: Upstream Arrival Area (y: 360 - 540)
      const z3Density = zones.upstreamArrival.currentDensity;
      ctx.fillStyle = z3Density >= 5.0 ? 'rgba(244, 63, 94, 0.12)' : z3Density >= 4.5 ? 'rgba(245, 158, 11, 0.08)' : 'rgba(16, 185, 129, 0.03)';
      ctx.fillRect(80, 360, 800, 180);
      ctx.strokeStyle = z3Density >= 5.0 ? 'rgba(244, 63, 94, 0.8)' : 'rgba(16, 185, 129, 0.4)';
      ctx.strokeRect(80, 360, 800, 180);
      ctx.setLineDash([]);

      // Zone Labels with Live Density Badges
      ctx.font = 'bold 9px "JetBrains Mono", monospace';
      ctx.fillStyle = 'rgba(6, 182, 212, 0.9)';
      ctx.fillText(`ZONE 1: GATE APPROACH [${zones.gateApproach.currentDensity} p/m²]`, 190, 78);
      ctx.fillStyle = 'rgba(245, 158, 11, 0.9)';
      ctx.fillText(`ZONE 2: HOLDING AREA [${zones.intermediateHolding.currentDensity} p/m²]`, 150, 198);
      ctx.fillStyle = 'rgba(16, 185, 129, 0.9)';
      ctx.fillText(`ZONE 3: UPSTREAM ARRIVAL [${zones.upstreamArrival.currentDensity} p/m²]`, 90, 378);

      // Directional Counterflow Measurement Line at y = 300
      ctx.save();
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(140, 300);
      ctx.lineTo(880, 300);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillStyle = '#d8b4fe';
      ctx.fillText(`DIRECTIONAL FLOW LINE [INBOUND ↑ | OUTBOUND ↓] (${opposingFlowPercent}% COUNTERFLOW)`, 150, 295);
      ctx.restore();
    }

    // Inflow Hatch Zone
    if (scenario === 'stadium') {
      ctx.fillStyle = 'rgba(16, 185, 129, 0.05)';
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.3)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.fillRect(60, CANVAS_HEIGHT - 65, CANVAS_WIDTH - 120, 50);
      ctx.strokeRect(60, CANVAS_HEIGHT - 65, CANVAS_WIDTH - 120, 50);
      ctx.setLineDash([]);
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillStyle = 'rgba(52, 211, 153, 0.8)';
      ctx.fillText(
        `PERIMETER ENTRY HATCH [MG ROAD / METRO] • SECTOR EAST • ${inflowRate} P/MIN`,
        75,
        CANVAS_HEIGHT - 35
      );
    }

    // Baffles (Crash-Barrier Styling)
    for (const b of bafflesRef.current) {
      ctx.save();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 5;
      ctx.shadowColor = 'rgba(56, 189, 248, 0.6)';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(b.x1, b.y1);
      ctx.lineTo(b.x2, b.y2);
      ctx.stroke();
      ctx.fillStyle = '#bae6fd';
      ctx.beginPath();
      ctx.arc(b.x1, b.y1, 4.5, 0, Math.PI * 2);
      ctx.arc(b.x2, b.y2, 4.5, 0, Math.PI * 2);
      ctx.fill();
      if (b.label) {
        ctx.font = '9px "JetBrains Mono", monospace';
        ctx.fillStyle = '#7dd3fc';
        ctx.fillText(b.label, (b.x1 + b.x2) / 2 - 40, b.y1 - 6);
      }
      ctx.restore();
    }

    // Walls & Barriers
    for (const w of wallsRef.current) {
      ctx.save();
      if (w.type === 'divider') {
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 4;
        ctx.shadowColor = 'rgba(6, 182, 212, 0.5)';
        ctx.shadowBlur = 6;
      } else if (w.type === 'barrier') {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 5;
        ctx.shadowColor = 'rgba(239, 68, 68, 0.6)';
        ctx.shadowBlur = 8;
      } else {
        ctx.strokeStyle = w.color || '#475569';
        ctx.lineWidth = 4;
      }
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(w.x1, w.y1);
      ctx.lineTo(w.x2, w.y2);
      ctx.stroke();
      if (w.label) {
        ctx.font = '9px "JetBrains Mono", monospace';
        ctx.fillStyle = w.color || '#94a3b8';
        ctx.fillText(w.label, (w.x1 + w.x2) / 2 - 30, w.y1 - 6);
      }
      ctx.restore();
    }

    // Turnstiles & NFC Screening Gates
    for (const gate of gatesRef.current) {
      ctx.save();
      const gateState = scenarioEngineRef.current?.getGateState(gate.id);
      const isClosed = gateState ? gateState.operationalLanes <= 0 : !gate.active;
      const isAllBusy = gateState
        ? gateState.channels.every((c) => !c.operational || c.cooldownRemainingSec > 0)
        : gate.cooldown > 0;

      let statusColor = '#10b981';
      if (isClosed) statusColor = '#ef4444';
      else if (isAllBusy) statusColor = '#f59e0b';

      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = statusColor;
      ctx.lineWidth = 2;
      ctx.fillRect(gate.x - gate.width / 2, gate.y - gate.height / 2, gate.width, gate.height);
      ctx.strokeRect(gate.x - gate.width / 2, gate.y - gate.height / 2, gate.width, gate.height);

      if (isClosed) {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(gate.x - 7, gate.y - 7);
        ctx.lineTo(gate.x + 7, gate.y + 7);
        ctx.moveTo(gate.x + 7, gate.y - 7);
        ctx.lineTo(gate.x - 7, gate.y + 7);
        ctx.stroke();
      } else {
        const angle = (currentTime / 350) % (Math.PI * 2);
        ctx.strokeStyle = statusColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(gate.x - 7 * Math.cos(angle), gate.y - 7 * Math.sin(angle));
        ctx.lineTo(gate.x + 7 * Math.cos(angle), gate.y + 7 * Math.sin(angle));
        ctx.stroke();
      }

      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillStyle = '#f8fafc';
      let label = '';
      if (gateState) {
        if (gateState.operationalLanes <= 0) {
          label = `${gateState.name}: CLOSED (0/${gateState.totalLanes}L) [0]`;
        } else {
          label = `${gateState.name}: ${gateState.operationalLanes}/${gateState.totalLanes}L (${gateState.turnstileLatencySec}s) [${gate.totalPassed || 0}]`;
        }
      } else {
        label = `${gate.name || gate.id}: ${gate.cooldown > 0 ? `SCAN` : 'CLEAR'} [${gate.totalPassed || 0}]`;
      }
      ctx.fillText(label, gate.x - 75, gate.y - 16);
      ctx.restore();
    }

    // Pedestrian Agents
    const agents = agentsRef.current;
    const len = agents.length;
    for (let i = 0; i < len; i++) {
      const a = agents[i];
      if (a.active === false) continue;

      ctx.beginPath();
      ctx.arc(a.x, a.y, a.radius, 0, Math.PI * 2);
      ctx.fillStyle = a.color;
      ctx.fill();

      // Crush Risk Halo
      if (a.density >= 5.0 && isFlashTick) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.radius * 2.2, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(244, 63, 94, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      }

      // Directional Flow Indicator
      const speed = Math.hypot(a.vx, a.vy);
      if (speed > 1.0) {
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(a.x + (a.vx / speed) * (a.radius + 3), a.y + (a.vy / speed) * (a.radius + 3));
        ctx.strokeStyle = a.direction === 'outbound' ? '#f3e8ff' : '#0f172a';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    }

    // Scale Bar & Mode Tag
    ctx.save();
    const sbX = 25;
    const sbY = CANVAS_HEIGHT - 20;
    const sbLen = PPM * 10;
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sbX, sbY);
    ctx.lineTo(sbX + sbLen, sbY);
    ctx.moveTo(sbX, sbY - 4);
    ctx.lineTo(sbX, sbY + 4);
    ctx.moveTo(sbX + sbLen, sbY - 4);
    ctx.lineTo(sbX + sbLen, sbY + 4);
    ctx.stroke();
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText('10m SCALE (1:20)', sbX + 4, sbY - 6);

    if (physicsValidationMode) {
      ctx.fillStyle = '#f59e0b';
      ctx.fillText('⚡ PURE PHYSICS VALIDATION (OVERRIDES DISABLED)', sbX + 160, sbY - 6);
    }
    if (isDemoMode) {
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(`⚡ DEMO MODE (${demoTimeMultiplier}x TIME COMPRESSION • SUB-STEPPED dt <= 0.025s)`, sbX + (physicsValidationMode ? 480 : 160), sbY - 6);
    }
    ctx.restore();
  };

  /**
   * Draws the Macro 21-Gate Perimeter Stadium Radar for M. Chinnaswamy Stadium
   * Uses shared geometric single source of truth: RADAR_CENTER_X (480), RADAR_CENTER_Y (270), RADAR_OUTER_RADIUS (200)
   */
  const drawMacroStadiumRadar = (
    ctx: CanvasRenderingContext2D,
    currentTime: number,
    activeGateNumber: number,
    activeGateId: string
  ) => {
    ctx.fillStyle = '#060a12';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const centerX = RADAR_CENTER_X;
    const centerY = RADAR_CENTER_Y;
    const outerRadius = RADAR_OUTER_RADIUS;
    const concourseInnerRadius = 78;
    const innerPitchRadius = 48;

    const focusedGate =
      STADIUM_21_GATES.find(
        (g) => g.gateNumber === activeGateNumber || g.id === activeGateId
      ) || STADIUM_21_GATES[0];
    const focusedSector = CHINNASWAMY_SECTORS[focusedGate.sectorId] || CHINNASWAMY_SECTORS.east;
    const focusedLive = stadiumNetworkRef.current?.getGateState(focusedGate.id);
    const isVerifiedTwin = focusedGate.approachGeometryStatus === 'verified';

    // 1. Surrounding Peripheral Road Ingress Annotations (positioned cleanly outside radar)
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'bold 9px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';

    // North: Queen's Road
    ctx.fillText('── QUEEN\'S ROAD INGRESS ──', centerX, centerY - outerRadius - 28);
    // West: Link Road / KSLTA
    ctx.fillText('── LINK ROAD / KSLTA ──', centerX - outerRadius - 55, centerY);
    // East: Cubbon Road & MG Road
    ctx.fillText('── CUBBON ROAD ──', centerX + outerRadius + 55, centerY - 25);
    ctx.fillText('── MG ROAD / METRO ──', centerX + outerRadius + 55, centerY + 45);
    // South: Kasturba Road / Cubbon Park (cleanly above bottom inspection cards at y: 464)
    ctx.fillText('── KASTURBA ROAD / CUBBON PARK ──', centerX, centerY + outerRadius + 28);
    ctx.restore();

    // 2. Outer Stadium Perimeter Rings
    ctx.save();
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(centerX, centerY, outerRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, concourseInnerRadius, 0, Math.PI * 2);
    ctx.stroke();

    // 3. 4 Stadium Sectors with active sector glow
    const sectors = Object.values(CHINNASWAMY_SECTORS);
    for (const sec of sectors) {
      const startRad = (sec.angleStartDeg * Math.PI) / 180;
      const endRad = (sec.angleEndDeg * Math.PI) / 180;
      const isSectorActive = sec.id === focusedGate.sectorId;

      ctx.beginPath();
      ctx.arc(centerX, centerY, outerRadius, startRad, endRad);
      ctx.arc(centerX, centerY, concourseInnerRadius, endRad, startRad, true);
      ctx.closePath();
      ctx.fillStyle = `${sec.color}${isSectorActive ? '25' : '0f'}`;
      ctx.fill();
      ctx.strokeStyle = `${sec.color}${isSectorActive ? 'aa' : '35'}`;
      ctx.lineWidth = isSectorActive ? 2.5 : 1.2;
      ctx.stroke();

      // Sector Center Label
      const midRad =
        (((sec.angleStartDeg +
          (sec.angleEndDeg < sec.angleStartDeg ? sec.angleEndDeg + 360 : sec.angleEndDeg)) /
          2) *
          Math.PI) /
        180;
      const lblX = centerX + Math.cos(midRad) * 124;
      const lblY = centerY + Math.sin(midRad) * 124;

      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      ctx.fillStyle = isSectorActive ? '#f8fafc' : sec.color;
      ctx.textAlign = 'center';
      ctx.fillText(sec.name.split(' (')[0].toUpperCase(), lblX, lblY - 6);
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(`${sec.capacity.toLocaleString()} CAP`, lblX, lblY + 7);
    }
    ctx.restore();

    // 4. Cricket Pitch Center Field
    ctx.save();
    ctx.fillStyle = '#043224';
    ctx.strokeStyle = '#059669';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, innerPitchRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Crease pitch markings
    ctx.strokeStyle = 'rgba(52, 211, 153, 0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(centerX - 13, centerY - 24, 26, 48);

    ctx.font = 'bold 9px "JetBrains Mono", monospace';
    ctx.fillStyle = '#6ee7b7';
    ctx.textAlign = 'center';
    ctx.fillText('M. CHINNASWAMY', centerX, centerY - 6);
    ctx.font = '8px "JetBrains Mono", monospace';
    ctx.fillStyle = '#34d399';
    ctx.fillText('CENTRAL FIELD', centerX, centerY + 8);
    ctx.restore();

    // 5. 21 Perimeter Gates
    for (const gate of STADIUM_21_GATES) {
      const rad = (gate.angleDeg * Math.PI) / 180;
      const gx = centerX + Math.cos(rad) * outerRadius;
      const gy = centerY + Math.sin(rad) * outerRadius;

      const isFocused = gate.gateNumber === activeGateNumber || gate.id === activeGateId;
      const isHovered = hoveredGateIdRef.current === gate.id;
      const gateLiveState = stadiumNetworkRef.current?.getGateState(gate.id);
      const queueCount = gateLiveState?.currentQueue || 0;
      const congestion = gateLiveState?.congestionState || 'normal';
      const isUnresolved = gate.mappingStatus === 'unresolved_placeholder';

      // Gate Color by Classification and Congestion
      let gateColor = '#10b981';
      if (isUnresolved) {
        gateColor = '#f59e0b';
      } else if (gate.gateType === 'vip') {
        gateColor = '#fbbf24'; // Gold VIP
      } else if (gate.gateType === 'restricted') {
        gateColor = '#c084fc'; // Purple Members
      } else if (gate.gateType === 'emergency') {
        gateColor = '#ef4444'; // Red Emergency
      } else {
        if (congestion === 'critical') gateColor = '#ef4444';
        else if (congestion === 'high') gateColor = '#f97316';
        else if (congestion === 'moderate') gateColor = '#f59e0b';
        else gateColor = '#10b981';
      }

      ctx.save();
      // Special stanchion styling
      if (isUnresolved) {
        // Dashed Amber Ring for Unresolved Placeholders
        ctx.setLineDash([2, 2]);
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(gx, gy, 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (gate.gateType === 'vip') {
        // Double ring for VIP
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(gx, gy, 8, 0, Math.PI * 2);
        ctx.stroke();
      } else if (gate.gateType === 'restricted') {
        // Purple ring for KSCA
        ctx.strokeStyle = '#c084fc';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(gx, gy, 8, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Stanchion Dot Center
      ctx.beginPath();
      ctx.arc(gx, gy, isFocused ? 7 : isHovered ? 6 : 5, 0, Math.PI * 2);
      ctx.fillStyle = isFocused ? '#ffffff' : gateColor;
      ctx.fill();
      ctx.strokeStyle = isFocused ? '#38bdf8' : '#0f172a';
      ctx.lineWidth = isFocused ? 2 : 1;
      ctx.stroke();

      // Pulsing Ring & Crosshairs for Focused Gate
      if (isFocused) {
        const pulse = 11 + Math.sin(currentTime / 200) * 3;
        ctx.beginPath();
        ctx.arc(gx, gy, pulse, 0, Math.PI * 2);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.8;
        ctx.shadowColor = 'rgba(56, 189, 248, 0.7)';
        ctx.shadowBlur = 8;
        ctx.stroke();

        // Crosshair ticks
        ctx.beginPath();
        ctx.moveTo(gx - pulse - 4, gy); ctx.lineTo(gx - pulse, gy);
        ctx.moveTo(gx + pulse, gy); ctx.lineTo(gx + pulse + 4, gy);
        ctx.moveTo(gx, gy - pulse - 4); ctx.lineTo(gx, gy - pulse);
        ctx.moveTo(gx, gy + pulse); ctx.lineTo(gx, gy + pulse + 4);
        ctx.stroke();
      } else if (isHovered) {
        // Subtle hover ring
        ctx.beginPath();
        ctx.arc(gx, gy, 8.5, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
      ctx.restore();

      // Gate Tag (G1..G21 or G7*)
      const tagRad = rad;
      const tx = centerX + Math.cos(tagRad) * (outerRadius + 18);
      const ty = centerY + Math.sin(tagRad) * (outerRadius + 18);
      const labelText = isUnresolved ? `G${gate.gateNumber}*` : `G${gate.gateNumber}`;

      ctx.save();
      ctx.font = isFocused
        ? 'bold 11px "JetBrains Mono", monospace'
        : 'bold 9px "JetBrains Mono", monospace';
      ctx.fillStyle = isFocused
        ? '#38bdf8'
        : isUnresolved
        ? '#fbbf24'
        : gate.publicEntryEligible
        ? '#cbd5e1'
        : gateColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(labelText, tx, ty);
      ctx.restore();

      // Queue badge if queue > 0
      if (queueCount > 0) {
        const qx = centerX + Math.cos(tagRad) * (outerRadius + 32);
        const qy = centerY + Math.sin(tagRad) * (outerRadius + 32);
        ctx.save();
        ctx.font = 'bold 8px "JetBrains Mono", monospace';
        ctx.fillStyle =
          congestion === 'critical'
            ? '#ef4444'
            : congestion === 'high'
            ? '#f97316'
            : '#38bdf8';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`Q:${queueCount}`, qx, qy);
        ctx.restore();
      }
    }

    // 6. Top Header on Canvas
    ctx.save();
    ctx.textAlign = 'left';
    ctx.font = 'bold 12px "JetBrains Mono", monospace';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('M. CHINNASWAMY STADIUM — 21-GATE MACRO LOAD RADAR', 25, 32);
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(
      `TOTAL CAPACITY: 35,000 SPECTATORS • 4 SECTORS • FOCUSED: GATE ${focusedGate.gateNumber} (${focusedGate.displayName})`,
      25,
      48
    );

    // 7. Top Right Active Focus Callout
    const focBoxX = CANVAS_WIDTH - 290;
    const focBoxY = 15;
    const focBoxW = 265;
    const focBoxH = 44;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 1.5;
    ctx.fillRect(focBoxX, focBoxY, focBoxW, focBoxH);
    ctx.strokeRect(focBoxX, focBoxY, focBoxW, focBoxH);

    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(`ACTIVE FOCUS: ${focusedSector.name.split(' (')[0].toUpperCase()}`, focBoxX + 14, focBoxY + 18);
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('CLICK ANY GATE TO INSPECT • SWITCH VIEWS BELOW', focBoxX + 14, focBoxY + 32);
    ctx.restore();

    // 8. Focused Gate Detailed Inspection Card (bottom left)
    const cardX = 25;
    const cardY = 464;
    const cardW = 540;
    const cardH = 104;

    ctx.save();
    ctx.fillStyle = 'rgba(10, 16, 29, 0.95)';
    ctx.strokeStyle = focusedGate.publicEntryEligible ? '#0284c7' : '#f59e0b';
    ctx.lineWidth = 1.5;
    ctx.fillRect(cardX, cardY, cardW, cardH);
    ctx.strokeRect(cardX, cardY, cardW, cardH);

    // Line 1: Gate Title, Type, and Approach Road
    ctx.textAlign = 'left';
    ctx.font = 'bold 11px "JetBrains Mono", monospace';
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(
      `GATE ${focusedGate.gateNumber}: ${focusedGate.displayName.toUpperCase()}`,
      cardX + 12,
      cardY + 18
    );

    ctx.font = 'bold 9px "JetBrains Mono", monospace';
    ctx.fillStyle = focusedGate.publicEntryEligible ? '#38bdf8' : '#f59e0b';
    ctx.fillText(`[${focusedGate.gateType.toUpperCase()}]`, cardX + 380, cardY + 18);

    // Line 2: Mapping Status & Concourse Model Status
    ctx.font = '9px "JetBrains Mono", monospace';
    const isUnres = focusedGate.mappingStatus === 'unresolved_placeholder';
    ctx.fillStyle = isUnres ? '#fbbf24' : '#34d399';
    const mapStr = isUnres
      ? '▲ E-REF: UNRESOLVED (PENDING SURVEY)'
      : `● E-REF: ${focusedGate.externalReferenceId} (CONFIRMED)`;
    ctx.fillText(mapStr, cardX + 12, cardY + 35);

    ctx.fillStyle = isVerifiedTwin ? '#38bdf8' : '#f59e0b';
    const twinStr = isVerifiedTwin
      ? '● VERIFIED CONCOURSE TWIN'
      : '▲ MACRO DEMAND ESTIMATE';
    ctx.fillText(twinStr, cardX + 265, cardY + 35);

    // Line 3: Approach Road, Stands, and Turnstiles
    ctx.fillStyle = '#94a3b8';
    const standsStr = focusedGate.connectedStandIds.join(', ') || 'Reserved / None';
    ctx.fillText(
      `ROAD: ${focusedGate.entryRoadGroup} | STANDS: ${standsStr}`,
      cardX + 12,
      cardY + 52
    );

    // Line 4: Live Simulation Metrics
    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    const congColor =
      focusedLive?.congestionState === 'critical'
        ? '#ef4444'
        : focusedLive?.congestionState === 'high'
        ? '#f97316'
        : '#38bdf8';
    ctx.fillStyle = congColor;
    const waitMin = focusedLive ? (focusedLive.estimatedWaitTimeSec / 60).toFixed(1) : '0.0';
    ctx.fillText(
      `QUEUE: ${focusedLive?.currentQueue ?? 0} | WAIT: ${waitMin}m | DENSITY: ${focusedLive?.localDensity.toFixed(1) ?? '0.0'} p/m² | ADMITTED: ${focusedLive?.totalAdmitted ?? 0}`,
      cardX + 12,
      cardY + 70
    );

    // Status Callout Line
    ctx.font = '9px "JetBrains Mono", monospace';
    if (isUnres) {
      ctx.fillStyle = '#f59e0b';
      ctx.fillText('⚠ PENDING SURVEY: E-ID unconfirmed. Macro calibrated estimate.', cardX + 12, cardY + 87);
    } else if (!focusedGate.publicEntryEligible) {
      ctx.fillStyle = '#fbbf24';
      ctx.fillText(`🔒 RESERVED GATE: Public ticketing disabled (${focusedGate.gateType.toUpperCase()}).`, cardX + 12, cardY + 87);
    } else {
      ctx.fillStyle = '#64748b';
      ctx.fillText(`LANES: ${focusedGate.turnstileCount} (${focusedGate.defaultLatencySec}s NFC Latency) • NORMAL OPERATION`, cardX + 12, cardY + 87);
    }

    // Action Button on Card: Enter Micro Twin or View Corridor Estimate
    const btnX = cardX + 355;
    const btnY = cardY + 70;
    const btnW = 175;
    const btnH = 25;

    ctx.fillStyle = isHoveringCardButtonRef.current
      ? (isVerifiedTwin ? 'rgba(6, 182, 212, 0.95)' : 'rgba(71, 85, 105, 0.95)')
      : (isVerifiedTwin ? 'rgba(8, 145, 178, 0.8)' : 'rgba(30, 41, 59, 0.85)');
    ctx.strokeStyle = isVerifiedTwin ? '#22d3ee' : '#64748b';
    ctx.lineWidth = 1.2;
    ctx.fillRect(btnX, btnY, btnW, btnH);
    ctx.strokeRect(btnX, btnY, btnW, btnH);

    ctx.textAlign = 'center';
    ctx.font = 'bold 9px "JetBrains Mono", monospace';
    ctx.fillStyle = isVerifiedTwin ? '#ecfeff' : '#f1f5f9';
    const btnLabel = isVerifiedTwin ? 'ENTER CONCOURSE TWIN →' : 'VIEW CORRIDOR ESTIMATE →';
    ctx.fillText(btnLabel, btnX + btnW / 2, btnY + 16);
    ctx.restore();

    // 9. Radar Legend (bottom right)
    const legX = 580;
    const legY = 464;
    const legW = 355;
    const legH = 104;

    ctx.save();
    ctx.fillStyle = 'rgba(10, 16, 29, 0.95)';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.fillRect(legX, legY, legW, legH);
    ctx.strokeRect(legX, legY, legW, legH);

    ctx.textAlign = 'left';
    ctx.font = 'bold 9px "JetBrains Mono", monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('RADAR CLASSIFICATION & TELEMETRY LEGEND', legX + 10, legY + 16);

    // Row 1: Public states
    ctx.fillStyle = '#10b981';
    ctx.beginPath(); ctx.arc(legX + 16, legY + 34, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#cbd5e1'; ctx.fillText('Public Normal', legX + 24, legY + 37);

    ctx.fillStyle = '#f59e0b';
    ctx.beginPath(); ctx.arc(legX + 130, legY + 34, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#cbd5e1'; ctx.fillText('Moderate', legX + 138, legY + 37);

    ctx.fillStyle = '#ef4444';
    ctx.beginPath(); ctx.arc(legX + 230, legY + 34, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#cbd5e1'; ctx.fillText('High/Crit', legX + 238, legY + 37);

    // Row 2: Reserved states
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath(); ctx.arc(legX + 16, legY + 54, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#cbd5e1'; ctx.fillText('VIP (G4, G9)', legX + 24, legY + 57);

    ctx.fillStyle = '#c084fc';
    ctx.beginPath(); ctx.arc(legX + 130, legY + 54, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#cbd5e1'; ctx.fillText('KSCA (G13)', legX + 138, legY + 57);

    ctx.fillStyle = '#ef4444';
    ctx.beginPath(); ctx.arc(legX + 230, legY + 54, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#cbd5e1'; ctx.fillText('Emg (G20)', legX + 238, legY + 57);

    // Row 3: Special Indicators
    ctx.strokeStyle = '#f59e0b';
    ctx.setLineDash([2, 2]);
    ctx.beginPath(); ctx.arc(legX + 16, legY + 74, 4.5, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#cbd5e1'; ctx.fillText('Pending Survey (*)', legX + 24, legY + 77);

    ctx.strokeStyle = '#38bdf8';
    ctx.beginPath(); ctx.arc(legX + 165, legY + 74, 5, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#38bdf8'; ctx.fillText('◎ Focused Gate Reticle', legX + 175, legY + 77);

    // Row 4: Helper tip
    ctx.font = '8px "JetBrains Mono", monospace';
    ctx.fillStyle = '#64748b';
    ctx.fillText('Click any gate to inspect • Click card button to enter concourse', legX + 10, legY + 95);
    ctx.restore();
  };

  /**
   * Canvas click handler:
   * 1. In Macro mode: Clicking a gate selects it without leaving radar. Clicking card button switches to micro.
   * 2. In Micro mode: Clicking return buttons switches back to macro radar.
   */
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const canvasCoords = convertPointerToCanvasCoordinates(
      e.clientX,
      e.clientY,
      rect,
      CANVAS_WIDTH,
      CANVAS_HEIGHT
    );

    if (!canvasCoords) return;

    if (viewMode === 'macro') {
      // 1. Check if user clicked the action button on the inspection card
      // Card at (25, 464). Button at (380, 534), w: 175, h: 25
      const inCardBtn =
        canvasCoords.x >= 380 &&
        canvasCoords.x <= 555 &&
        canvasCoords.y >= 530 &&
        canvasCoords.y <= 562;

      if (inCardBtn) {
        setViewMode('micro');
        return;
      }

      // 2. Identify nearest gate within click tolerance
      const hit = findNearestRadarGate(
        canvasCoords.x,
        canvasCoords.y,
        DEFAULT_GATE_CLICK_TOLERANCE_PX,
        RADAR_CENTER_X,
        RADAR_CENTER_Y,
        RADAR_OUTER_RADIUS
      );

      // Select gate and synchronize state immediately without leaving macro radar
      if (hit) {
        setSelectedGateId(hit.gate.id);
        setSelectedGateNumber(hit.gate.gateNumber);
      }
      // Clicking empty radar space or between gates does nothing
    } else {
      // Micro mode: check if user clicked return button
      const inTopReturnBtn =
        canvasCoords.x >= 25 &&
        canvasCoords.x <= 205 &&
        canvasCoords.y >= 14 &&
        canvasCoords.y <= 42;

      const inBottomReturnBtn =
        canvasCoords.x >= 340 &&
        canvasCoords.x <= 620 &&
        canvasCoords.y >= 460 &&
        canvasCoords.y <= 505;

      if (inTopReturnBtn || inBottomReturnBtn) {
        setViewMode('macro');
      }
    }
  };

  /**
   * Canvas mouse move handler for hover feedback and pointer cursors
   */
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const canvasCoords = convertPointerToCanvasCoordinates(
      e.clientX,
      e.clientY,
      rect,
      CANVAS_WIDTH,
      CANVAS_HEIGHT
    );

    if (!canvasCoords) {
      if (containerRef.current) containerRef.current.style.cursor = 'default';
      hoveredGateIdRef.current = null;
      isHoveringCardButtonRef.current = false;
      isHoveringBackButtonRef.current = false;
      return;
    }

    if (viewMode === 'macro') {
      const inCardBtn =
        canvasCoords.x >= 380 &&
        canvasCoords.x <= 555 &&
        canvasCoords.y >= 530 &&
        canvasCoords.y <= 562;

      const hit = findNearestRadarGate(
        canvasCoords.x,
        canvasCoords.y,
        DEFAULT_GATE_CLICK_TOLERANCE_PX,
        RADAR_CENTER_X,
        RADAR_CENTER_Y,
        RADAR_OUTER_RADIUS
      );

      if (inCardBtn || hit) {
        if (containerRef.current) containerRef.current.style.cursor = 'pointer';
        hoveredGateIdRef.current = hit ? hit.gate.id : null;
        isHoveringCardButtonRef.current = inCardBtn;
      } else {
        if (containerRef.current) containerRef.current.style.cursor = 'default';
        hoveredGateIdRef.current = null;
        isHoveringCardButtonRef.current = false;
      }
    } else {
      const inTopReturnBtn =
        canvasCoords.x >= 25 &&
        canvasCoords.x <= 205 &&
        canvasCoords.y >= 14 &&
        canvasCoords.y <= 42;

      const inBottomReturnBtn =
        canvasCoords.x >= 340 &&
        canvasCoords.x <= 620 &&
        canvasCoords.y >= 460 &&
        canvasCoords.y <= 505;

      if (inTopReturnBtn || inBottomReturnBtn) {
        if (containerRef.current) containerRef.current.style.cursor = 'pointer';
        isHoveringBackButtonRef.current = true;
      } else {
        if (containerRef.current) containerRef.current.style.cursor = 'default';
        isHoveringBackButtonRef.current = false;
      }
    }
  };

  const handleCanvasMouseLeave = () => {
    if (containerRef.current) containerRef.current.style.cursor = 'default';
    hoveredGateIdRef.current = null;
    isHoveringCardButtonRef.current = false;
    isHoveringBackButtonRef.current = false;
  };

  return (
    <div
      ref={containerRef}
      onClick={handleCanvasClick}
      onMouseMove={handleCanvasMouseMove}
      onMouseLeave={handleCanvasMouseLeave}
      className="relative w-full h-full flex items-center justify-center bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shadow-2xl transition-all"
    >
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="w-full h-auto max-h-full object-contain aspect-[960/580]"
      />
    </div>
  );
};
