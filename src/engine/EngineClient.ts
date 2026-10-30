/**
 * Engine Client - Main thread interface to Social Force Model Web Worker
 * Transparently manages double-buffered position streams, snapshot/restore,
 * and high-performance benchmarking.
 */

import { EngineSnapshot } from './SocialForceModel';

export interface RenderableAgentState {
  count: number;
  time: number;
  stepMs: number;
  positions: Float32Array; // Interleaved: [x, y, vx, vy, radius, pop, group, zone]
  densityGrid?: Float32Array;
  gridWidth: number;
  gridHeight: number;
}

export interface BenchmarkResult {
  agents: number;
  msPerStep: number;
  fps: number;
}

export class EngineClient {
  private worker: Worker | null = null;
  private isBusy: boolean = false;
  private onStateUpdate?: (state: RenderableAgentState) => void;
  private snapshotResolver?: (snapshot: EngineSnapshot) => void;
  private restoreResolver?: () => void;
  private benchmarkResolver?: (results: BenchmarkResult[]) => void;

  constructor() {
    this.createWorker();
  }

  private createWorker(): void {
    try {
      this.worker = new Worker(new URL('./engine.worker.ts', import.meta.url), {
        type: 'module'
      });

      this.worker.onmessage = (event) => {
        const data = event.data;
        switch (data.type) {
          case 'STEP_DONE': {
            this.isBusy = false;
            if (this.onStateUpdate) {
              this.onStateUpdate({
                count: data.count,
                time: data.time,
                stepMs: data.stepMs,
                positions: new Float32Array(data.positions),
                densityGrid: data.densityGrid ? new Float32Array(data.densityGrid) : undefined,
                gridWidth: data.gridWidth,
                gridHeight: data.gridHeight
              });
            }
            break;
          }

          case 'SNAPSHOT_DONE': {
            if (this.snapshotResolver) {
              this.snapshotResolver(data.snapshot);
              this.snapshotResolver = undefined;
            }
            break;
          }

          case 'RESTORE_DONE': {
            if (this.restoreResolver) {
              this.restoreResolver();
              this.restoreResolver = undefined;
            }
            break;
          }

          case 'BENCHMARK_DONE': {
            if (this.benchmarkResolver) {
              this.benchmarkResolver(data.results);
              this.benchmarkResolver = undefined;
            }
            break;
          }
        }
      };
    } catch (err) {
      console.warn('Worker initialization failed, fallback active:', err);
    }
  }

  public init(
    arenaWidth: number = 48.0,
    arenaHeight: number = 30.0,
    maxAgents: number = 20000,
    seed: number = 42
  ): void {
    if (!this.worker) this.createWorker();
    this.worker?.postMessage({
      type: 'INIT',
      arenaWidth,
      arenaHeight,
      maxAgents,
      seed
    });
  }

  public onUpdate(callback: (state: RenderableAgentState) => void): void {
    this.onStateUpdate = callback;
  }

  public step(substeps: number = 2): void {
    if (this.isBusy || !this.worker) return;
    this.isBusy = true;
    this.worker.postMessage({ type: 'STEP', substeps });
  }

  public setGateState(id: string, isOpen: boolean, width?: number, latency?: number): void {
    this.worker?.postMessage({
      type: 'SET_GATE_STATE',
      id,
      isOpen,
      width,
      latency
    });
  }

  public setInflow(sector: string, rate: number): void {
    this.worker?.postMessage({
      type: 'SET_INFLOW',
      sector,
      rate
    });
  }

  public spawnAgent(
    x: number,
    y: number,
    targetX: number,
    targetY: number,
    popType: number = 0,
    groupId: number = 0,
    zoneId: number = 0
  ): void {
    this.worker?.postMessage({
      type: 'SPAWN_AGENT',
      x,
      y,
      targetX,
      targetY,
      popType,
      groupId,
      zoneId
    });
  }

  public async snapshot(): Promise<EngineSnapshot> {
    return new Promise((resolve) => {
      this.snapshotResolver = resolve;
      this.worker?.postMessage({ type: 'SNAPSHOT' });
    });
  }

  public async restore(snapshot: EngineSnapshot): Promise<void> {
    return new Promise((resolve) => {
      this.restoreResolver = resolve;
      this.worker?.postMessage({ type: 'RESTORE', snapshot });
    });
  }

  public async runBenchmark(
    agentCounts: number[] = [1000, 5000, 10000],
    stepsPerCount: number = 100
  ): Promise<BenchmarkResult[]> {
    return new Promise((resolve) => {
      this.benchmarkResolver = resolve;
      this.worker?.postMessage({
        type: 'BENCHMARK',
        agentCounts,
        stepsPerCount
      });
    });
  }

  public terminate(): void {
    this.worker?.terminate();
    this.worker = null;
    this.isBusy = false;
  }
}

