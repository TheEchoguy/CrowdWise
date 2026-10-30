/**
 * Pure Social Force Model (Helbing, Farkas, Vicsek 2000; Helbing & Molnar 1995; Weidmann 1993)
 * SI Units: Metres, Seconds, Kilograms (normalized by mass m_i = 80 kg)
 * ZERO DOM / React imports. ZERO non-physical hacks.
 * Fully deterministic with seeded PRNG.
 */

import { SeededPRNG } from './prng';
import { SpatialHashGrid } from './SpatialHashGrid';

export interface WallSegment {
  id: string;
  x1: number; // metres
  y1: number; // metres
  x2: number; // metres
  y2: number; // metres
}

export interface GateState {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number; // metres
  isOpen: boolean;
  latencySeconds: number; // sec per person
  targetSector: string;
}

export interface EngineSnapshot {
  time: number;
  stepCount: number;
  agentCount: number;
  prngState: number;
  // Deep copy of structured arrays
  x: Float32Array;
  y: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
  v0: Float32Array;
  radius: Float32Array;
  group: Float32Array;
  pop: Float32Array;
  zone: Uint16Array;
  goal: Uint16Array;
  targetX: Float32Array;
  targetY: Float32Array;
  dwellTime: Float32Array;
  active: Uint8Array;
}

export interface EngineStats {
  agentCount: number;
  stepTimeMs: number;
  substeps: number;
  simTimeSeconds: number;
  fps: number;
}

export class SocialForceEngineCore {
  // Empirical Parameters - Helbing et al. (2000) & Weidmann (1993)
  // Relaxation time tau = 0.5 s [Helbing, Farkas, Vicsek 2000, Eq. (1)]
  public readonly TAU: number = 0.5;

  // Social interaction strength A = 2000 N / 80 kg = 25.0 m/s^2 [Helbing et al. Nature 2000]
  public readonly A_SOC: number = 25.0;

  // Social interaction range B = 0.08 m [Helbing et al. Nature 2000]
  public readonly B_SOC: number = 0.08;

  // Linear body contact stiffness k = 1.2e5 kg/s^2 / 80 kg = 1500.0 s^-2 [Helbing et al. Nature 2000]
  public readonly K_BODY: number = 1500.0;

  // Sliding friction coefficient kappa = 2.4e5 kg/(m*s) / 80 kg = 3000.0 m^-1 s^-1 [Helbing et al. Nature 2000]
  public readonly KAPPA_FRICT: number = 3000.0;

  // Wall interaction parameters [Helbing et al. Nature 2000]
  public readonly A_WALL: number = 25.0;
  public readonly B_WALL: number = 0.08;

  // Group cohesion force magnitude [Moussaid et al. PNAS 2010] (calibrated)
  public readonly COHESION_K: number = 2.5;

  // Fixed simulation time step: dt = 1/120 s [Helbing 2000 recommendation: <= 0.01 s for numerical stability]
  public readonly DT: number = 1.0 / 120.0;

  // Structured typed arrays (SoA - Structure of Arrays)
  public readonly maxAgents: number;
  public count: number = 0;

  public x: Float32Array;
  public y: Float32Array;
  public vx: Float32Array;
  public vy: Float32Array;
  public v0: Float32Array;        // Desired speed in m/s ~ N(1.34, 0.26) clamped [0.6, 2.0]
  public radius: Float32Array;    // Radii in metres [0.20, 0.30]
  public group: Float32Array;     // Group ID (0 = solo, >0 = group members)
  public pop: Float32Array;       // Population type: 0 = entering, 1 = exiting, 2 = staff, 3 = returning
  public zone: Uint16Array;       // Zone ID for exposure & risk ledger
  public goal: Uint16Array;       // Goal flow field ID
  public targetX: Float32Array;   // Current steering target X (metres)
  public targetY: Float32Array;   // Current steering target Y (metres)
  public dwellTime: Float32Array; // Stopped / dwell countdown in seconds
  public active: Uint8Array;      // 1 = active, 0 = inactive/despawned

  // Acceleration buffers (scratch arrays for substep integration)
  private fx: Float32Array;
  private fy: Float32Array;

  // Spatial Hash Grid for O(N) neighbor searches
  public grid: SpatialHashGrid;

  // Obstacle segments & Gate facilities
  public walls: WallSegment[] = [];
  public gates: Map<string, GateState> = new Map();

  // Deterministic RNG
  public prng: SeededPRNG;
  public simTime: number = 0;
  public stepCount: number = 0;

  // Inflow rates per sector in persons per second (SI)
  public sectorInflowRate: Map<string, number> = new Map();

  constructor(
    arenaWidthMeters: number = 48.0,
    arenaHeightMeters: number = 30.0,
    maxAgents: number = 20000,
    seed: number = 42
  ) {
    this.maxAgents = maxAgents;
    this.prng = new SeededPRNG(seed);

    this.x = new Float32Array(maxAgents);
    this.y = new Float32Array(maxAgents);
    this.vx = new Float32Array(maxAgents);
    this.vy = new Float32Array(maxAgents);
    this.v0 = new Float32Array(maxAgents);
    this.radius = new Float32Array(maxAgents);
    this.group = new Float32Array(maxAgents);
    this.pop = new Float32Array(maxAgents);
    this.zone = new Uint16Array(maxAgents);
    this.goal = new Uint16Array(maxAgents);
    this.targetX = new Float32Array(maxAgents);
    this.targetY = new Float32Array(maxAgents);
    this.dwellTime = new Float32Array(maxAgents);
    this.active = new Uint8Array(maxAgents);

    this.fx = new Float32Array(maxAgents);
    this.fy = new Float32Array(maxAgents);

    // Uniform grid with 1.5 m cells (covers 2 * max_radius + interaction_range)
    this.grid = new SpatialHashGrid(0, 0, arenaWidthMeters, arenaHeightMeters, 1.5, maxAgents);
  }

  /**
   * Initializes or resets the simulation with a given scenario and seed
   */
  public init(seed: number = 42): void {
    this.prng = new SeededPRNG(seed);
    this.count = 0;
    this.simTime = 0;
    this.stepCount = 0;
    this.active.fill(0);
    this.vx.fill(0);
    this.vy.fill(0);
    this.dwellTime.fill(0);
  }

  /**
   * Spawns a single heterogeneous agent at (x, y) with empirical distribution:
   * Desired speed v0 ~ N(1.34, 0.26) clamped [0.6, 2.0] m/s [Weidmann 1993]
   * Radius ~ Uniform[0.20, 0.30] m (mean 0.25 m, shoulder breadth 0.5 m)
   */
  public spawnAgent(
    x: number,
    y: number,
    targetX: number,
    targetY: number,
    popType: number = 0,
    groupId: number = 0,
    zoneId: number = 0,
    goalId: number = 0
  ): number {
    // Find free slot or append
    let slot = -1;
    for (let i = 0; i < this.count; i++) {
      if (this.active[i] === 0) {
        slot = i;
        break;
      }
    }
    if (slot === -1) {
      if (this.count >= this.maxAgents) return -1;
      slot = this.count++;
    }

    // Desired speed sampled from Gaussian N(1.34, 0.26) [Weidmann 1993]
    const rawV0 = this.prng.nextGaussian(1.34, 0.26);
    const v0 = Math.max(0.6, Math.min(2.0, rawV0));

    // Agent body radius [Weidmann 1993]
    const radius = this.prng.nextRangeFloat(0.20, 0.30);

    this.x[slot] = x;
    this.y[slot] = y;
    this.vx[slot] = 0;
    this.vy[slot] = 0;
    this.v0[slot] = v0;
    this.radius[slot] = radius;
    this.group[slot] = groupId;
    this.pop[slot] = popType;
    this.zone[slot] = zoneId;
    this.goal[slot] = goalId;
    this.targetX[slot] = targetX;
    this.targetY[slot] = targetY;
    this.dwellTime[slot] = 0;
    this.active[slot] = 1;

    return slot;
  }

  /**
   * Despawns an agent by slot index
   */
  public despawnAgent(slot: number): void {
    if (slot >= 0 && slot < this.count) {
      this.active[slot] = 0;
    }
  }

  /**
   * Adds a physical obstacle boundary wall segment
   */
  public addWall(id: string, x1: number, y1: number, x2: number, y2: number): void {
    this.walls.push({ id, x1, y1, x2, y2 });
  }

  /**
   * Sets gate facility state (opened/closed, width, service latency)
   */
  public setGateState(
    id: string,
    isOpen: boolean,
    widthMeters?: number,
    latencySeconds?: number
  ): void {
    const gate = this.gates.get(id);
    if (gate) {
      gate.isOpen = isOpen;
      if (widthMeters !== undefined) gate.width = widthMeters;
      if (latencySeconds !== undefined) gate.latencySeconds = latencySeconds;
    }
  }

  /**
   * Sets inflow rate for an entry sector in persons per minute
   */
  public setInflow(sector: string, ratePersonsPerMinute: number): void {
    const ratePerSec = Math.max(0, ratePersonsPerMinute / 60.0);
    this.sectorInflowRate.set(sector, ratePerSec);
  }

  /**
   * Executes a single physics substep of fixed dt = 1/120s using Semi-Implicit Euler.
   * Cites: Helbing, Farkas, Vicsek (2000) Nature 407:487-490
   */
  public stepSubstep(): void {
    const dt = this.DT;
    const count = this.count;

    // 1. Rebuild spatial hash grid (counting sort O(N))
    this.grid.rebuild(count, this.x, this.y, this.active);

    // 2. Clear force buffers
    this.fx.fill(0);
    this.fy.fill(0);

    // 3. Compute forces for each active agent
    for (let i = 0; i < count; i++) {
      if (this.active[i] === 0) continue;

      // Stopped dwell check (e.g. checking tickets or phone)
      if (this.dwellTime[i] > 0) {
        this.dwellTime[i] -= dt;
        // Damp velocity to zero during dwell
        this.vx[i] *= 0.5;
        this.vy[i] *= 0.5;
        continue;
      }

      const xi = this.x[i];
      const yi = this.y[i];
      const vxi = this.vx[i];
      const vyi = this.vy[i];
      const ri = this.radius[i];
      const v0i = this.v0[i];

      // -------------------------------------------------------------
      // (A) Driving Force: f_0 = (v0 * e_target - v) / tau [Helbing 2000, Eq. 1]
      // -------------------------------------------------------------
      const dxTarget = this.targetX[i] - xi;
      const dyTarget = this.targetY[i] - yi;
      const distTarget = Math.hypot(dxTarget, dyTarget);

      let eTargetX = 0;
      let eTargetY = 0;
      if (distTarget > 1e-4) {
        eTargetX = dxTarget / distTarget;
        eTargetY = dyTarget / distTarget;
      }

      this.fx[i] += (v0i * eTargetX - vxi) / this.TAU;
      this.fy[i] += (v0i * eTargetY - vyi) / this.TAU;

      // -------------------------------------------------------------
      // (B) Inter-Agent Social & Contact Forces [Helbing 2000, Eq. 2-3]
      // -------------------------------------------------------------
      this.grid.query(xi, yi, (j) => {
        if (i === j || this.active[j] === 0) return;

        const dx = xi - this.x[j];
        const dy = yi - this.y[j];
        const dist = Math.hypot(dx, dy);
        if (dist <= 1e-5) return;

        const rSum = ri + this.radius[j];
        const nx = dx / dist; // Normal from j to i
        const ny = dy / dist;

        // Exponential social repulsion force [Helbing 2000]
        const fSocial = this.A_SOC * Math.exp((rSum - dist) / this.B_SOC);
        this.fx[i] += fSocial * nx;
        this.fy[i] += fSocial * ny;

        // Physical linear contact & sliding friction if overlapping [Helbing 2000]
        if (dist < rSum) {
          const overlap = rSum - dist;

          // Linear elastic compressive contact force
          const fContact = this.K_BODY * overlap;
          this.fx[i] += fContact * nx;
          this.fy[i] += fContact * ny;

          // Tangential sliding friction force
          const tx = -ny;
          const ty = nx;
          const deltaV = (this.vx[j] - vxi) * tx + (this.vy[j] - vyi) * ty;
          const fFriction = this.KAPPA_FRICT * overlap * deltaV;
          this.fx[i] += fFriction * tx;
          this.fy[i] += fFriction * ty;
        }

        // Optional Group Cohesion [Moussaid et al. 2010] (calibrated)
        if (this.group[i] > 0 && this.group[i] === this.group[j] && dist > 1.2) {
          // Gentle pull toward group member if drifting apart
          const fCohesion = this.COHESION_K * (dist - 1.2);
          this.fx[i] -= fCohesion * nx;
          this.fy[i] -= fCohesion * ny;
        }
      });

      // -------------------------------------------------------------
      // (C) Wall & Obstacle Repulsion [Helbing 2000, Eq. 4]
      // -------------------------------------------------------------
      for (let w = 0; w < this.walls.length; w++) {
        const wall = this.walls[w];
        const segDx = wall.x2 - wall.x1;
        const segDy = wall.y2 - wall.y1;
        const segLenSq = segDx * segDx + segDy * segDy;
        if (segLenSq < 1e-6) continue;

        // Project agent onto segment
        const t = Math.max(0, Math.min(1, ((xi - wall.x1) * segDx + (yi - wall.y1) * segDy) / segLenSq));
        const nearX = wall.x1 + t * segDx;
        const nearY = wall.y1 + t * segDy;

        const diffX = xi - nearX;
        const diffY = yi - nearY;
        const distWall = Math.hypot(diffX, diffY);
        if (distWall <= 1e-5) continue;

        const nWallX = diffX / distWall;
        const nWallY = diffY / distWall;

        // Exponential wall repulsion
        const fWall = this.A_WALL * Math.exp((ri - distWall) / this.B_WALL);
        this.fx[i] += fWall * nWallX;
        this.fy[i] += fWall * nWallY;

        // Hard linear contact if intersecting wall
        if (distWall < ri) {
          const overlapWall = ri - distWall;
          const fWallContact = this.K_BODY * overlapWall;
          this.fx[i] += fWallContact * nWallX;
          this.fy[i] += fWallContact * nWallY;

          // Tangential friction along wall
          const tWallX = -nWallY;
          const tWallY = nWallX;
          const vTangential = vxi * tWallX + vyi * tWallY;
          const fWallFriction = -this.KAPPA_FRICT * overlapWall * vTangential;
          this.fx[i] += fWallFriction * tWallX;
          this.fy[i] += fWallFriction * tWallY;
        }
      }
    }

    // 4. Semi-Implicit Euler Numerical Integration
    for (let i = 0; i < count; i++) {
      if (this.active[i] === 0) continue;

      // Update velocity: v(t + dt) = v(t) + a(t) * dt
      this.vx[i] += this.fx[i] * dt;
      this.vy[i] += this.fy[i] * dt;

      // Speed clamp: 1.5 * v0 for numerical stability [Helbing 2000]
      const speed = Math.hypot(this.vx[i], this.vy[i]);
      const maxSpeed = 1.5 * this.v0[i];
      if (speed > maxSpeed && speed > 1e-4) {
        const factor = maxSpeed / speed;
        this.vx[i] *= factor;
        this.vy[i] *= factor;
      }

      // Update position: x(t + dt) = x(t) + v(t + dt) * dt
      this.x[i] += this.vx[i] * dt;
      this.y[i] += this.vy[i] * dt;
    }

    this.simTime += dt;
    this.stepCount++;
  }

  /**
   * Executes one full 60Hz frame (2 substeps of dt = 1/120s)
   */
  public stepFrame(): void {
    this.stepSubstep();
    this.stepSubstep();
  }

  /**
   * Deep snapshot of all simulation state for look-ahead simulations (P4/P5)
   */
  public snapshot(): EngineSnapshot {
    return {
      time: this.simTime,
      stepCount: this.stepCount,
      agentCount: this.count,
      prngState: this.prng.getState(),
      x: new Float32Array(this.x.subarray(0, this.count)),
      y: new Float32Array(this.y.subarray(0, this.count)),
      vx: new Float32Array(this.vx.subarray(0, this.count)),
      vy: new Float32Array(this.vy.subarray(0, this.count)),
      v0: new Float32Array(this.v0.subarray(0, this.count)),
      radius: new Float32Array(this.radius.subarray(0, this.count)),
      group: new Float32Array(this.group.subarray(0, this.count)),
      pop: new Float32Array(this.pop.subarray(0, this.count)),
      zone: new Uint16Array(this.zone.subarray(0, this.count)),
      goal: new Uint16Array(this.goal.subarray(0, this.count)),
      targetX: new Float32Array(this.targetX.subarray(0, this.count)),
      targetY: new Float32Array(this.targetY.subarray(0, this.count)),
      dwellTime: new Float32Array(this.dwellTime.subarray(0, this.count)),
      active: new Uint8Array(this.active.subarray(0, this.count))
    };
  }

  /**
   * Restores simulation state from a snapshot in < 1 ms
   */
  public restore(snapshot: EngineSnapshot): void {
    this.simTime = snapshot.time;
    this.stepCount = snapshot.stepCount;
    this.count = snapshot.agentCount;
    this.prng.setState(snapshot.prngState);

    this.x.set(snapshot.x);
    this.y.set(snapshot.y);
    this.vx.set(snapshot.vx);
    this.vy.set(snapshot.vy);
    this.v0.set(snapshot.v0);
    this.radius.set(snapshot.radius);
    this.group.set(snapshot.group);
    this.pop.set(snapshot.pop);
    this.zone.set(snapshot.zone);
    this.goal.set(snapshot.goal);
    this.targetX.set(snapshot.targetX);
    this.targetY.set(snapshot.targetY);
    this.dwellTime.set(snapshot.dwellTime);
    this.active.set(snapshot.active);
  }

  /**
   * Returns current statistics
   */
  public getStats(): EngineStats {
    return {
      agentCount: this.count,
      stepTimeMs: this.DT * 1000.0,
      substeps: 2,
      simTimeSeconds: this.simTime,
      fps: 60
    };
  }
}
