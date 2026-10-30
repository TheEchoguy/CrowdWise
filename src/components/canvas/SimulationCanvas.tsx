import React, { useEffect, useRef } from 'react';
import { useSimulationStore } from '../../state/useSimulationStore';
import { getScenarioGeometry } from '../../engine/Geometry';
import { SpatialGrid } from '../../engine/SpatialGrid';
import { updateAgentPhysics, calculateCrowdInteractions } from '../../engine/SocialForceEngine';
import { AgentData, Gate, Wall } from '../../types/simulation';

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
      dividerActive
    );
    wallsRef.current = geo.walls;
    gatesRef.current = geo.gates.map((g) => ({ ...g, cooldown: 0, totalPassed: 0 }));
    bafflesRef.current = geo.baffles;

    // Reset agents and seed initial crowd
    agentsRef.current = [];
    nextIdRef.current = 1;
    spawnAccRef.current = 0;
    throughputHistoryRef.current = [];

    const initialCount = scenario === 'stadium' ? 45 : scenario === 'bridge' ? 50 : 40;
    seedInitialAgents(initialCount);
  };

  const seedInitialAgents = (count: number) => {
    for (let i = 0; i < count; i++) {
      spawnNewAgent();
    }
  };

  const spawnNewAgent = () => {
    const id = nextIdRef.current++;
    const radius = 5.0 + Math.random() * 1.0; // ~0.5m pedestrian diameter

    let x = 0;
    let y = 0;
    let targetX = 0;
    let targetY = 0;
    let isReverse = false;

    if (scenario === 'stadium') {
      // Approach from lower concourse
      x = 80 + Math.random() * (CANVAS_WIDTH - 160);
      y = CANVAS_HEIGHT - 60 + Math.random() * 30;

      // Primary Gate A target
      targetX = CANVAS_WIDTH / 2;
      targetY = 60;

      // If Gate B is active and agent is on right side, divert target
      if (auxGateActive && (x > CANVAS_WIDTH * 0.55 || id % 2 === 0)) {
        targetX = CANVAS_WIDTH * 0.8;
        targetY = 60;
      }
    } else if (scenario === 'bridge') {
      // Bidirectional flow: East-bound or West-bound
      if (id % 2 === 0) {
        // West to East
        x = 60 + Math.random() * 40;
        y = CANVAS_HEIGHT * 0.35 + Math.random() * (CANVAS_HEIGHT * 0.12);
        targetX = CANVAS_WIDTH - 50;
        targetY = y;
      } else {
        // East to West
        x = CANVAS_WIDTH - 100 + Math.random() * 40;
        y = CANVAS_HEIGHT * 0.53 + Math.random() * (CANVAS_HEIGHT * 0.12);
        targetX = 50;
        targetY = y;
        isReverse = true;
      }
    } else if (scenario === 'reversal') {
      // Reversal: starts in funnel, emergency flips target backwards
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
      vy: (Math.random() - 0.5) * 2,
      radius,
      targetX,
      targetY,
      density: 1.0,
      stuckTime: 0,
      color: '#10b981',
      isReverse,
      desiredSpeed: walkingSpeed * (0.9 + Math.random() * 0.2),
      active: true
    };

    agentsRef.current.push(agent);
  };

  // Re-sync geometry when scenario or resetSignal changes
  useEffect(() => {
    initSimulation();
  }, [scenario, resetSignal]);

  // Sync toggles with existing geometry without clearing crowd
  useEffect(() => {
    const geo = getScenarioGeometry(
      scenario,
      CANVAS_WIDTH,
      CANVAS_HEIGHT,
      bafflesActive,
      auxGateActive,
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

    // Divert agents dynamically if aux gate was toggled
    if (scenario === 'stadium') {
      for (const a of agentsRef.current) {
        if (auxGateActive && a.x > CANVAS_WIDTH * 0.5) {
          a.targetX = CANVAS_WIDTH * 0.8;
          a.targetY = 60;
        } else {
          a.targetX = CANVAS_WIDTH / 2;
          a.targetY = 60;
        }
      }
    }
  }, [bafflesActive, auxGateActive, dividerActive]);

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
      const primaryGate = gatesRef.current[0];

      if (!isPaused) {
        // 1. Inflow Spawning
        const agentsPerSec = inflowRate / 60;
        spawnAccRef.current += agentsPerSec * dt;
        while (spawnAccRef.current >= 1.0) {
          spawnAccRef.current -= 1.0;
          if (agentsRef.current.length < 2500) {
            spawnNewAgent();
          }
        }

        // 2. Gate Turnstile Cooldowns
        for (const gate of gatesRef.current) {
          if (gate.cooldown > 0) {
            gate.cooldown = Math.max(0, gate.cooldown - dt);
          }
        }

        // 3. Social Force Crowd Interactions O(N)
        calculateCrowdInteractions(
          agentsRef.current,
          spatialGridRef.current,
          dt,
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

          // Track peak density
          if (a.density > peakDensity) {
            peakDensity = a.density;
          }

          // Track queue spillback from primary bottleneck
          if (primaryGate && a.stuckTime > 0.5) {
            const distFromGate = Math.hypot(a.x - primaryGate.x, a.y - primaryGate.y);
            if (distFromGate > maxSpillbackPx) {
              maxSpillbackPx = distFromGate;
            }
          }

          // Update physics
          updateAgentPhysics(a, dt, walkingSpeed, walls, baffles);

          // Gate Passage Check
          for (let g = 0; g < gates.length; g++) {
            const gate = gates[g];
            if (!gate.active) continue;

            const halfW = gate.width / 2 + 6;
            const halfH = gate.height / 2 + 10;

            if (Math.abs(a.x - gate.x) <= halfW && Math.abs(a.y - gate.y) <= halfH) {
              if (gate.cooldown <= 0) {
                // Agent clears gate!
                gate.cooldown = gateLatency;
                gate.totalPassed = (gate.totalPassed || 0) + 1;
                a.active = false;
                throughputHistoryRef.current.push(currentTime);
                break;
              } else {
                // Stalled at turnstile
                a.vx *= 0.15;
                a.vy *= 0.15;
              }
            }
          }
        }

        // Prune inactive agents
        agentsRef.current = agentsRef.current.filter((a) => a.active !== false);

        // Calculate rolling throughput per minute
        const oneMinuteAgo = currentTime - 60000;
        throughputHistoryRef.current = throughputHistoryRef.current.filter((t) => t >= oneMinuteAgo);
      }

      // 5. Dispatch Telemetry at 4 Hz (every 250ms)
      if (currentTime - lastTelemetryDispatchRef.current >= 250) {
        lastTelemetryDispatchRef.current = currentTime;
        setTelemetry({
          peakDensity: Math.round(peakDensity * 10) / 10,
          spillbackMeters: Math.round((maxSpillbackPx / PPM) * 10) / 10,
          throughputPerMin: throughputHistoryRef.current.length,
          liveAgents: agentsRef.current.length,
          fps: currentFps,
          isCritical: peakDensity >= 5.0
        });
      }

      // 6. Draw Full Frame
      drawFrame(ctx, currentTime, isFlashTick);

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
    setTelemetry
  ]);

  /**
   * Sub-pixel Canvas Rendering Pipeline
   */
  const drawFrame = (ctx: CanvasRenderingContext2D, currentTime: number, isFlashTick: boolean) => {
    // Background Dark Slate
    ctx.fillStyle = '#080c14';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

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

    // Draw Inflow Hatch Area (Stadium lower concourse)
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
      ctx.fillText(`PEDESTRIAN INFLOW ZONE [${inflowRate} / MIN]`, 75, CANVAS_HEIGHT - 35);
    }

    // Draw Baffles (Crash-Barrier Styling)
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

      // End stanchions
      ctx.fillStyle = '#bae6fd';
      ctx.beginPath();
      ctx.arc(b.x1, b.y1, 4.5, 0, Math.PI * 2);
      ctx.arc(b.x2, b.y2, 4.5, 0, Math.PI * 2);
      ctx.fill();

      // Tag
      if (b.label) {
        ctx.font = '9px "JetBrains Mono", monospace';
        ctx.fillStyle = '#7dd3fc';
        ctx.fillText(b.label, (b.x1 + b.x2) / 2 - 40, b.y1 - 6);
      }
      ctx.restore();
    }

    // Draw Walls & Obstacles
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

    // Draw Gates & Turnstiles
    for (const gate of gatesRef.current) {
      ctx.save();
      const isReady = gate.cooldown <= 0;
      const statusColor = isReady ? '#10b981' : '#f59e0b';

      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = statusColor;
      ctx.lineWidth = 2;
      ctx.fillRect(gate.x - gate.width / 2, gate.y - gate.height / 2, gate.width, gate.height);
      ctx.strokeRect(gate.x - gate.width / 2, gate.y - gate.height / 2, gate.width, gate.height);

      // Rotating turnstile arm
      const angle = (currentTime / 350) % (Math.PI * 2);
      ctx.strokeStyle = statusColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(gate.x - 7 * Math.cos(angle), gate.y - 7 * Math.sin(angle));
      ctx.lineTo(gate.x + 7 * Math.cos(angle), gate.y + 7 * Math.sin(angle));
      ctx.stroke();

      // Gate Label
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillStyle = '#f8fafc';
      const label = `${gate.name || gate.id}: ${
        gate.cooldown > 0 ? `SCAN (${gate.cooldown.toFixed(1)}s)` : 'CLEAR'
      } [${gate.totalPassed || 0}]`;
      ctx.fillText(label, gate.x - 65, gate.y - 16);
      ctx.restore();
    }

    // Draw Agents
    const agents = agentsRef.current;
    const len = agents.length;
    for (let i = 0; i < len; i++) {
      const a = agents[i];
      if (a.active === false) continue;

      ctx.beginPath();
      ctx.arc(a.x, a.y, a.radius, 0, Math.PI * 2);
      ctx.fillStyle = a.color;
      ctx.fill();

      // Critical crush zone halo
      if (a.density >= 5.0 && isFlashTick) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.radius * 2.2, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(244, 63, 94, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      }

      // Velocity directional indicator
      const speed = Math.hypot(a.vx, a.vy);
      if (speed > 1.0) {
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(a.x + (a.vx / speed) * (a.radius + 3), a.y + (a.vy / speed) * (a.radius + 3));
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    }

    // 10m Scale Bar at Bottom-Left
    ctx.save();
    const sbX = 25;
    const sbY = CANVAS_HEIGHT - 20;
    const sbLen = PPM * 10; // 200px = 10m

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
    ctx.restore();
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full flex items-center justify-center bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shadow-2xl"
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
