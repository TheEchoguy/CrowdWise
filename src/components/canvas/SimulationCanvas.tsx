import React, { useEffect, useRef } from 'react';
import { useSimulationStore } from '../../state/useSimulationStore';
import { SocialForceEngine } from '../../engine/SocialForceEngine';
import { SCENARIO_PRESETS } from '../../engine/Geometry';

interface SimulationCanvasProps {
  className?: string;
}

export const SimulationCanvas: React.FC<SimulationCanvasProps> = ({ className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<SocialForceEngine | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());
  const lastStoreDispatchRef = useRef<number>(0);

  // Store subscriptions
  const scenario = useSimulationStore((s) => s.scenario);
  const inflowRate = useSimulationStore((s) => s.inflowRate);
  const gateLatency = useSimulationStore((s) => s.gateLatency);
  const bafflesActive = useSimulationStore((s) => s.bafflesActive);
  const auxGateActive = useSimulationStore((s) => s.auxGateActive);
  const dividerActive = useSimulationStore((s) => s.dividerActive);
  const isPlaying = useSimulationStore((s) => s.isPlaying);
  const resetKey = useSimulationStore((s) => s.resetKey);
  const reversalTriggerKey = useSimulationStore((s) => s.reversalTriggerKey);
  const updateTelemetry = useSimulationStore((s) => s.updateTelemetry);

  // Initialize or reconfigure engine when scenario changes
  useEffect(() => {
    const preset = SCENARIO_PRESETS[scenario] || SCENARIO_PRESETS.stadium;
    if (!engineRef.current) {
      engineRef.current = new SocialForceEngine(preset.width, preset.height, preset.pixelsPerMeter);
    }

    const engine = engineRef.current;
    engine.loadScenario(preset);
    engine.inflowRate = inflowRate;
    engine.gateLatency = gateLatency;
    engine.bafflesActive = bafflesActive;
    engine.auxGateActive = auxGateActive;
    engine.dividerActive = dividerActive;

    // Synchronize Gate B active status in gates array
    const gateB = engine.gates.find((g) => g.id === 'gate-b');
    if (gateB) {
      gateB.active = auxGateActive;
    }
  }, [scenario, resetKey]);

  // Sync parameter updates to existing engine instance
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.inflowRate = inflowRate;
    }
  }, [inflowRate]);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.gateLatency = gateLatency;
    }
  }, [gateLatency]);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.bafflesActive = bafflesActive;
    }
  }, [bafflesActive]);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.auxGateActive = auxGateActive;
      const gateB = engineRef.current.gates.find((g) => g.id === 'gate-b');
      if (gateB) {
        gateB.active = auxGateActive;
      }
    }
  }, [auxGateActive]);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.dividerActive = dividerActive;
    }
  }, [dividerActive]);

  // Emergency shock reversal trigger
  useEffect(() => {
    if (reversalTriggerKey > 0 && engineRef.current) {
      engineRef.current.triggerShockReversal();
    }
  }, [reversalTriggerKey]);

  // Main Animation & Physics Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let isSubscribed = true;

    const renderLoop = (currentTime: number) => {
      if (!isSubscribed) return;

      const dt = (currentTime - lastTimeRef.current) / 1000;
      lastTimeRef.current = currentTime;

      const engine = engineRef.current;
      const preset = SCENARIO_PRESETS[scenario] || SCENARIO_PRESETS.stadium;

      if (engine && ctx) {
        // Step physics if playing
        let telemetry = {
          peakDensity: 0,
          maxSpillback: 0,
          throughput: 0,
          totalAgents: engine.agents.length,
          fps: 60,
          isCritical: false,
          activeCrushZones: 0,
          avgVelocity: 0
        };

        if (isPlaying) {
          telemetry = engine.update(dt, currentTime);
        }

        // Throttle React state dispatch to ~16 Hz (every 60ms) to maximize canvas FPS
        if (currentTime - lastStoreDispatchRef.current > 60) {
          lastStoreDispatchRef.current = currentTime;
          updateTelemetry({
            peakDensity: telemetry.peakDensity,
            spillbackMeters: telemetry.maxSpillback,
            throughputPerMin: telemetry.throughput,
            liveAgents: telemetry.totalAgents,
            isCritical: telemetry.isCritical,
            fps: telemetry.fps,
            activeCrushZones: telemetry.activeCrushZones,
            avgVelocity: telemetry.avgVelocity
          });
        }

        // Draw Simulation Frame
        drawSimulation(ctx, engine, preset, currentTime);
      }

      animFrameIdRef.current = requestAnimationFrame(renderLoop);
    };

    animFrameIdRef.current = requestAnimationFrame(renderLoop);

    return () => {
      isSubscribed = false;
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [scenario, isPlaying, updateTelemetry]);

  /**
   * High-precision Sub-Pixel Canvas Renderer
   */
  const drawSimulation = (
    ctx: CanvasRenderingContext2D,
    engine: SocialForceEngine,
    preset: typeof SCENARIO_PRESETS.stadium,
    currentTime: number
  ) => {
    const width = preset.width;
    const height = preset.height;
    const ppm = preset.pixelsPerMeter;

    // 1. Dark Digital-Twin Background
    ctx.fillStyle = '#070b14';
    ctx.fillRect(0, 0, width, height);

    // 2. Spatial 1-Meter & 5-Meter Engineering Grid
    ctx.lineWidth = 1;
    // 1m grid
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.45)';
    ctx.beginPath();
    for (let x = 0; x <= width; x += ppm) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = 0; y <= height; y += ppm) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();

    // 5m grid accents
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.6)';
    ctx.beginPath();
    for (let x = 0; x <= width; x += ppm * 5) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = 0; y <= height; y += ppm * 5) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();

    // 3. Draw Spawn Inflow Zones
    for (const zone of preset.spawnZones) {
      ctx.fillStyle = 'rgba(16, 185, 129, 0.06)';
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.fillRect(zone.x, zone.y, zone.width, zone.height);
      ctx.strokeRect(zone.x, zone.y, zone.width, zone.height);
      ctx.setLineDash([]);

      // Label
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillStyle = 'rgba(52, 211, 153, 0.8)';
      ctx.fillText(`INFLOW INGESTION [${engine.inflowRate}/min]`, zone.x + 6, zone.y + 14);
    }

    // 4. Draw Holding Baffles / Upstream Crush-Break Chicanes
    for (const baffle of engine.baffles) {
      const isActive = engine.bafflesActive;
      ctx.save();
      if (isActive) {
        // High visibility hydraulic crash-barrier styling
        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = baffle.thickness || 5;
        ctx.shadowColor = 'rgba(56, 189, 248, 0.5)';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(baffle.x1, baffle.y1);
        ctx.lineTo(baffle.x2, baffle.y2);
        ctx.stroke();

        // Stanchion posts at ends
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(baffle.x1, baffle.y1, 4, 0, Math.PI * 2);
        ctx.arc(baffle.x2, baffle.y2, 4, 0, Math.PI * 2);
        ctx.fill();

        // Label
        if (baffle.label) {
          ctx.font = '9px "JetBrains Mono", monospace';
          ctx.fillStyle = '#bae6fd';
          const midX = (baffle.x1 + baffle.x2) / 2 + 6;
          const midY = (baffle.y1 + baffle.y2) / 2;
          ctx.fillText(baffle.label, midX, midY);
        }
      } else {
        // Inactive ghosted line
        ctx.strokeStyle = 'rgba(100, 116, 139, 0.25)';
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 5]);
        ctx.beginPath();
        ctx.moveTo(baffle.x1, baffle.y1);
        ctx.lineTo(baffle.x2, baffle.y2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.restore();
    }

    // 5. Draw Walls & Physical Barriers
    for (const wall of engine.walls) {
      if (wall.type === 'divider') {
        const isDividerActive = engine.dividerActive;
        ctx.save();
        if (isDividerActive) {
          ctx.strokeStyle = '#06b6d4';
          ctx.lineWidth = 4;
          ctx.shadowColor = 'rgba(6, 182, 212, 0.4)';
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.moveTo(wall.x1, wall.y1);
          ctx.lineTo(wall.x2, wall.y2);
          ctx.stroke();

          ctx.font = '10px "JetBrains Mono", monospace';
          ctx.fillStyle = '#67e8f9';
          ctx.fillText('CENTRAL SEPARATION DIVIDER (ACTIVE)', (wall.x1 + wall.x2) / 2 - 110, wall.y1 - 6);
        } else {
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.15)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 6]);
          ctx.beginPath();
          ctx.moveTo(wall.x1, wall.y1);
          ctx.lineTo(wall.x2, wall.y2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        ctx.restore();
        continue;
      }

      // Structural Walls
      ctx.save();
      ctx.strokeStyle = wall.color || '#475569';
      ctx.lineWidth = wall.thickness || 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(wall.x1, wall.y1);
      ctx.lineTo(wall.x2, wall.y2);
      ctx.stroke();
      ctx.restore();
    }

    // 6. Draw Gates & Turnstiles
    for (const gate of engine.gates) {
      ctx.save();
      const isGateReady = gate.active && gate.cooldown <= 0;
      const gateColor = !gate.active ? '#475569' : isGateReady ? '#10b981' : '#f59e0b';

      // Gate boundary aperture
      ctx.fillStyle = gate.active ? 'rgba(15, 23, 42, 0.85)' : 'rgba(30, 41, 59, 0.4)';
      ctx.strokeStyle = gateColor;
      ctx.lineWidth = 2;
      ctx.fillRect(gate.x - gate.width / 2, gate.y - gate.height / 2, gate.width, gate.height);
      ctx.strokeRect(gate.x - gate.width / 2, gate.y - gate.height / 2, gate.width, gate.height);

      // Turnstile rotor lines
      if (gate.active) {
        ctx.strokeStyle = gateColor;
        ctx.lineWidth = 1.5;
        const angle = (currentTime / 400) % (Math.PI * 2);
        const cx = gate.x;
        const cy = gate.y;
        ctx.beginPath();
        ctx.moveTo(cx - 8 * Math.cos(angle), cy - 8 * Math.sin(angle));
        ctx.lineTo(cx + 8 * Math.cos(angle), cy + 8 * Math.sin(angle));
        ctx.stroke();
      }

      // Gate status pill
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillStyle = gate.active ? '#f8fafc' : '#64748b';
      const statusText = !gate.active
        ? `${gate.name}: CLOSED`
        : gate.cooldown > 0
        ? `${gate.name}: SCANNING (${gate.cooldown.toFixed(1)}s)`
        : `${gate.name}: OPEN [${gate.totalPassed}]`;

      ctx.fillText(statusText, gate.x - 60, gate.y - gate.height / 2 - 8);
      ctx.restore();
    }

    // 7. Render Microscopic Pedestrian Agents
    const agents = engine.agents;
    const agentCount = agents.length;

    for (let i = 0; i < agentCount; i++) {
      const a = agents[i];
      if (!a.active) continue;

      // Draw agent body
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.radius, 0, Math.PI * 2);
      ctx.fillStyle = a.color;
      ctx.fill();

      // If in critical crush zone (density >= 5.0), render outer pulsating halo
      if (a.density >= 5.0) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.radius * 2.2, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(244, 63, 94, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      }

      // Draw directional vector tip (nose)
      const speed = Math.hypot(a.vx, a.vy);
      if (speed > 1.0) {
        const nx = a.vx / speed;
        const ny = a.vy / speed;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(a.x + nx * (a.radius + 3), a.y + ny * (a.radius + 3));
        ctx.strokeStyle = '#020617';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    }

    // 8. Scale Indicator & Digital Twin HUD
    ctx.save();
    // 10m Scale Bar at bottom left
    const scaleBarX = 25;
    const scaleBarY = height - 25;
    const scaleBarLen = ppm * 10; // 10 meters in pixels

    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(scaleBarX, scaleBarY);
    ctx.lineTo(scaleBarX + scaleBarLen, scaleBarY);
    // Left and right caps
    ctx.moveTo(scaleBarX, scaleBarY - 4);
    ctx.lineTo(scaleBarX, scaleBarY + 4);
    ctx.moveTo(scaleBarX + scaleBarLen, scaleBarY - 4);
    ctx.lineTo(scaleBarX + scaleBarLen, scaleBarY + 4);
    ctx.stroke();

    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText('10 METERS (SCALE 1:20)', scaleBarX + 4, scaleBarY - 6);

    // Coordinate telemetry tag
    ctx.fillStyle = 'rgba(148, 163, 184, 0.7)';
    ctx.fillText(`ARENA VIEWPORT: ${width / ppm}m × ${height / ppm}m | TICK: ${Math.round(currentTime)}ms`, scaleBarX + scaleBarLen + 20, scaleBarY);
    ctx.restore();
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full flex items-center justify-center bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shadow-2xl ${className}`}
    >
      <canvas
        ref={canvasRef}
        width={1000}
        height={600}
        className="w-full h-auto max-h-full object-contain aspect-[1000/600]"
      />
    </div>
  );
};
