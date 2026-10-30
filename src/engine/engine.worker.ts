/**
 * CrowdWise Simulation Engine Web Worker
 * Runs the pure microscopic Social Force Model on a dedicated background thread.
 * Uses transferable double-buffered Float32Array to eliminate garbage collection.
 */

import { SocialForceEngineCore, EngineSnapshot } from './SocialForceModel';

export interface WorkerInitMessage {
  type: 'INIT';
  arenaWidth: number;
  arenaHeight: number;
  maxAgents: number;
  seed: number;
}

export interface WorkerStepMessage {
  type: 'STEP';
  substeps?: number;
}

export interface WorkerSetGateMessage {
  type: 'SET_GATE_STATE';
  id: string;
  isOpen: boolean;
  width?: number;
  latency?: number;
}

export interface WorkerSetInflowMessage {
  type: 'SET_INFLOW';
  sector: string;
  rate: number; // persons per min
}

export interface WorkerSpawnAgentMessage {
  type: 'SPAWN_AGENT';
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  popType?: number;
  groupId?: number;
  zoneId?: number;
}

export interface WorkerBenchmarkMessage {
  type: 'BENCHMARK';
  agentCounts: number[];
  stepsPerCount: number;
}

export interface WorkerSnapshotMessage {
  type: 'SNAPSHOT';
}

export interface WorkerRestoreMessage {
  type: 'RESTORE';
  snapshot: EngineSnapshot;
}

export type WorkerInMessage =
  | WorkerInitMessage
  | WorkerStepMessage
  | WorkerSetGateMessage
  | WorkerSetInflowMessage
  | WorkerSpawnAgentMessage
  | WorkerBenchmarkMessage
  | WorkerSnapshotMessage
  | WorkerRestoreMessage;

let engine: SocialForceEngineCore | null = null;
let doubleBufferIdx = 0;
let transferBuffers: [Float32Array, Float32Array] | null = null;
const FLOATS_PER_AGENT = 8; // x, y, vx, vy, radius, pop, group, zone

// 2D Density Grid (1.0m resolution)
let densityGridWidth = 48;
let densityGridHeight = 30;
let densityGrid: Float32Array | null = null;

function initEngine(width: number, height: number, maxAgents: number, seed: number) {
  engine = new SocialForceEngineCore(width, height, maxAgents, seed);
  transferBuffers = [
    new Float32Array(maxAgents * FLOATS_PER_AGENT),
    new Float32Array(maxAgents * FLOATS_PER_AGENT)
  ];
  densityGridWidth = Math.ceil(width);
  densityGridHeight = Math.ceil(height);
  densityGrid = new Float32Array(densityGridWidth * densityGridHeight);
}

// Compute 2D Gaussian density grid (0.8m smoothing radius)
function computeDensityGrid(): void {
  if (!engine || !densityGrid) return;
  densityGrid.fill(0);

  const count = engine.count;
  const invCell = 1.0; // 1m cells
  const gw = densityGridWidth;
  const gh = densityGridHeight;

  for (let i = 0; i < count; i++) {
    if (engine.active[i] === 0) continue;
    const gx = Math.floor(engine.x[i] * invCell);
    const gy = Math.floor(engine.y[i] * invCell);
    if (gx >= 0 && gx < gw && gy >= 0 && gy < gh) {
      densityGrid[gy * gw + gx] += 1.0; // counts per 1m^2
    }
  }
}

self.onmessage = (event: MessageEvent<WorkerInMessage>) => {
  const msg = event.data;

  switch (msg.type) {
    case 'INIT': {
      initEngine(msg.arenaWidth, msg.arenaHeight, msg.maxAgents, msg.seed);
      self.postMessage({ type: 'INIT_DONE', maxAgents: msg.maxAgents });
      break;
    }

    case 'STEP': {
      if (!engine || !transferBuffers) return;

      const t0 = performance.now();
      const substeps = msg.substeps || 2;
      for (let s = 0; s < substeps; s++) {
        engine.stepSubstep();
      }
      const stepMs = performance.now() - t0;

      // Pack active agents into current transfer buffer
      const buffer = transferBuffers[doubleBufferIdx];
      doubleBufferIdx = 1 - doubleBufferIdx;

      let packedCount = 0;
      const count = engine.count;
      for (let i = 0; i < count; i++) {
        if (engine.active[i] === 0) continue;
        const offset = packedCount * FLOATS_PER_AGENT;
        buffer[offset + 0] = engine.x[i];
        buffer[offset + 1] = engine.y[i];
        buffer[offset + 2] = engine.vx[i];
        buffer[offset + 3] = engine.vy[i];
        buffer[offset + 4] = engine.radius[i];
        buffer[offset + 5] = engine.pop[i];
        buffer[offset + 6] = engine.group[i];
        buffer[offset + 7] = engine.zone[i];
        packedCount++;
      }

      computeDensityGrid();

      // Transfer packed view
      const packedSlice = buffer.subarray(0, packedCount * FLOATS_PER_AGENT);
      const copy = new Float32Array(packedSlice);

      (self as any).postMessage(
        {
          type: 'STEP_DONE',
          count: packedCount,
          time: engine.simTime,
          stepMs,
          positions: copy.buffer,
          densityGrid: densityGrid ? new Float32Array(densityGrid).buffer : null,
          gridWidth: densityGridWidth,
          gridHeight: densityGridHeight
        },
        [copy.buffer]
      );
      break;
    }

    case 'SET_GATE_STATE': {
      if (engine) {
        engine.setGateState(msg.id, msg.isOpen, msg.width, msg.latency);
      }
      break;
    }

    case 'SET_INFLOW': {
      if (engine) {
        engine.setInflow(msg.sector, msg.rate);
      }
      break;
    }

    case 'SPAWN_AGENT': {
      if (engine) {
        engine.spawnAgent(
          msg.x,
          msg.y,
          msg.targetX,
          msg.targetY,
          msg.popType,
          msg.groupId,
          msg.zoneId
        );
      }
      break;
    }

    case 'SNAPSHOT': {
      if (engine) {
        const snap = engine.snapshot();
        self.postMessage({ type: 'SNAPSHOT_DONE', snapshot: snap });
      }
      break;
    }

    case 'RESTORE': {
      if (engine && msg.snapshot) {
        engine.restore(msg.snapshot);
        self.postMessage({ type: 'RESTORE_DONE' });
      }
      break;
    }

    case 'BENCHMARK': {
      if (!engine) {
        initEngine(60, 40, 15000, 42);
      }
      if (!engine) return;

      const results: { agents: number; msPerStep: number; fps: number }[] = [];
      const testCounts = msg.agentCounts || [1000, 5000, 10000];
      const steps = msg.stepsPerCount || 100;

      for (const targetCount of testCounts) {
        engine.init(42);
        // Fill arena with targetCount agents
        for (let a = 0; a < targetCount; a++) {
          const x = 5.0 + (a % 50) * 0.8;
          const y = 5.0 + Math.floor(a / 50) * 0.8;
          engine.spawnAgent(x, y, 30.0, 35.0);
        }

        // Warm up
        for (let w = 0; w < 10; w++) engine.stepSubstep();

        // Benchmark
        const start = performance.now();
        for (let s = 0; s < steps; s++) {
          engine.stepSubstep();
        }
        const totalMs = performance.now() - start;
        const msPerStep = totalMs / steps;
        const fps = 1000.0 / (msPerStep * 2); // 2 substeps per frame

        results.push({
          agents: targetCount,
          msPerStep: Number(msPerStep.toFixed(3)),
          fps: Math.round(fps)
        });
      }

      self.postMessage({ type: 'BENCHMARK_DONE', results });
      break;
    }
  }
};
