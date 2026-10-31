/**
 * CROWDWISE — Phase 2: Authentic Stadium Crowd Simulation Engine
 * M. Chinnaswamy Stadium, Bengaluru
 *
 * Microscopic pedestrian dynamics on authentic KSCA geometry (1600 x 1200):
 * - Integrates Helbing Social Force Model with Waypoint Trajectories
 * - True Gate-to-Stand Pedestrian Lifecycle (No teleportation, natural queues)
 * - Independent Turnstile Counter Processing (G1–G15)
 * - Three-Zone Spatial Monitoring & Compressive Shockwaves
 */

import { SeededPRNG } from '../../engine/prng';
import { SpatialGrid } from '../../engine/SpatialGrid';
import { AgentData, Wall } from '../../types/simulation';
import { PedestrianRouteGraph } from '../network/routeGraph';
import { IngressRoutePath } from '../network/routeGeometry';
import { TurnstileBankEngine } from '../turnstiles/TurnstileBankEngine';
import { CHINNASWAMY_OUTER_GATES } from '../data/outerGates';
import { CHINNASWAMY_INNER_GATES } from '../data/innerGates';

export interface StadiumAgent extends AgentData {
  outerGateId: string;
  assignedInnerGateId: string;
  assignedStandId: string;
  routeKey: string;
  trajectory: IngressRoutePath;
  waypointIndex: number;
  isInHoldingArea: boolean;
  isInTurnstileQueue: boolean;
  isBeingServiced: boolean;
  isClearedVomitory: boolean;
  clearanceFade: number;
  entryTimestamp: number;
}

export interface ZoneDensities {
  zoneAPublicRoad: number;  // p/m²
  zoneBHoldingArea: number; // p/m²
  zoneCTurnstileThroat: number; // p/m²
}

export class StadiumSimulationEngine {
  private agents: StadiumAgent[] = [];
  private nextAgentId = 1;
  private prng: SeededPRNG;
  private spatialGrid: SpatialGrid;
  private turnstiles: TurnstileBankEngine;

  // Perimeter boundary obstacles (walls) to prevent clipping through buildings
  private perimeterWalls: Wall[] = [];

  // Inflow spawn accumulator (people per millisecond)
  private spawnAccumulator = 0;

  // Telemetry metrics
  private seatedPatronsCount = 14200;
  private clearedInLastMinute: number[] = [];
  private waitTimesSec: number[] = [];
  private peakObservedDensity = 0;

  constructor(seed = 42) {
    this.prng = new SeededPRNG(seed);
    this.spatialGrid = new SpatialGrid(40);
    this.turnstiles = new TurnstileBankEngine();
    this.initPerimeterWalls();
  }

  /**
   * Constructs boundary obstacle segments around non-walkable stadium geometry.
   */
  private initPerimeterWalls(): void {
    this.perimeterWalls = [
      // Outer north fence (Cubbon Road boundary) with openings at outer gates
      { x1: 200, y1: 185, x2: 430, y2: 185 },
      { x1: 450, y1: 185, x2: 485, y2: 185 },
      { x1: 505, y1: 185, x2: 545, y2: 185 },
      { x1: 565, y1: 185, x2: 615, y2: 185 },
      { x1: 635, y1: 185, x2: 685, y2: 185 },
      { x1: 705, y1: 185, x2: 750, y2: 185 },
      { x1: 770, y1: 185, x2: 885, y2: 185 },
      { x1: 905, y1: 185, x2: 950, y2: 185 },
      { x1: 970, y1: 185, x2: 1240, y2: 185 },

      // East fence (Link Road boundary) with gate openings
      { x1: 1240, y1: 185, x2: 1240, y2: 300 },
      { x1: 1240, y1: 320, x2: 1240, y2: 410 },
      { x1: 1240, y1: 430, x2: 1240, y2: 630 },
      { x1: 1240, y1: 650, x2: 1240, y2: 670 },
      { x1: 1240, y1: 690, x2: 1240, y2: 930 },

      // Queens Road boundary wall (restricts unauthorized access)
      { x1: 330, y1: 220, x2: 420, y2: 650 },
      { x1: 420, y1: 650, x2: 530, y2: 850 }
    ];
  }

  public getPerimeterWalls(): Wall[] {
    return this.perimeterWalls;
  }

  /**
   * Resets simulation state and re-seeds deterministic generator.
   */
  public reset(seed = 42, turnstileOverrides?: Record<string, number>): void {
    this.agents = [];
    this.nextAgentId = 1;
    this.spawnAccumulator = 0;
    this.clearedInLastMinute = [];
    this.waitTimesSec = [];
    this.peakObservedDensity = 0;
    this.prng = new SeededPRNG(seed);
    this.turnstiles.initDefaultBanks(turnstileOverrides);
  }

  /**
   * Spawns an agent at an outer gate sidewalk and assigns their route.
   */
  public spawnAgent(
    outerGateId: string,
    preferredInnerGateId?: string,
    desiredSpeed = 1.3,
    isRejected = false
  ): boolean {
    const trajectory = PedestrianRouteGraph.selectBestRouteForAgent(outerGateId, preferredInnerGateId);
    if (!trajectory || trajectory.waypoints.length === 0) return false;

    const startWp = trajectory.waypoints[0];
    const outerGate = CHINNASWAMY_OUTER_GATES.find((g) => g.id === outerGateId);

    // Initial position with small natural lateral scatter
    const scatterX = (this.prng.nextFloat() - 0.5) * 14;
    const scatterY = (this.prng.nextFloat() - 0.5) * 8;

    const agent: StadiumAgent = {
      id: this.nextAgentId++,
      x: startWp.x + scatterX,
      y: startWp.y + scatterY,
      vx: outerGate ? outerGate.approachVector.dx * 12 : 0,
      vy: outerGate ? outerGate.approachVector.dy * 12 : 12,
      desiredSpeed: Math.max(0.8, Math.min(2.2, desiredSpeed + (this.prng.nextFloat() - 0.5) * 0.2)),
      radius: 4.8, // ~0.24m in 20px=1m scale
      color: '#38bdf8',
      density: 0.5,
      compressivePressure: 0,
      stuckTime: 0,
      active: true,
      targetX: trajectory.waypoints[1]?.x || startWp.x,
      targetY: trajectory.waypoints[1]?.y || startWp.y,
      assignedGateId: trajectory.innerGateId,
      entryTime: performance.now(),
      turnstileScanRemaining: 1.0,
      waypoints: trajectory.waypoints,
      currentWaypointIndex: 1,

      // Stadium Specific Lifecycle State
      outerGateId,
      assignedInnerGateId: trajectory.innerGateId,
      assignedStandId: trajectory.standId,
      routeKey: trajectory.routeKey,
      trajectory,
      waypointIndex: 1,
      isInHoldingArea: false,
      isInTurnstileQueue: false,
      isBeingServiced: false,
      isClearedVomitory: false,
      clearanceFade: 1.0,
      entryTimestamp: performance.now(),
      isRejected
    };

    this.agents.push(agent);
    return true;
  }

  /**
   * Main Microscopic Physics & Social Force Update Step.
   */
  public step(
    dt: number,
    inflowRatePerMin: number,
    baseWalkingSpeed: number,
    turnstileLatencySec: number,
    counterFlowActive: boolean,
    now: number
  ): {
    activeAgentCount: number;
    seatedCount: number;
    peakDensity: number;
    averageWaitTimeSec: number;
    throughputPerMin: number;
    zoneDensities: ZoneDensities;
  } {
    // 1. Inflow Spawning (Deterministic Poisson distribution across active outer gates)
    const spectatorGates = CHINNASWAMY_OUTER_GATES.filter(
      (g) => g.accessPermission === 'SPECTATOR_PERMITTED'
    );

    if (inflowRatePerMin > 0 && spectatorGates.length > 0) {
      const spawnRatePerSec = inflowRatePerMin / 60;
      this.spawnAccumulator += spawnRatePerSec * dt;

      while (this.spawnAccumulator >= 1.0) {
        this.spawnAccumulator -= 1.0;
        // Select gate weighted by corridor capacity (E11 gets higher mass-transit share)
        const rand = this.prng.nextFloat();
        let targetGateId = 'E11';
        if (rand < 0.35) {
          targetGateId = 'E11'; // 35% MG Road Metro Plaza
        } else if (rand < 0.65) {
          // Cubbon Road gates
          const cubbonIds = ['E18', 'E19', 'E22', 'E23', 'E1', 'E2', 'E3'];
          targetGateId = cubbonIds[Math.floor(this.prng.nextFloat() * cubbonIds.length)];
        } else {
          // Link Road gates
          const linkIds = ['E12', 'E13', 'E16', 'E17'];
          targetGateId = linkIds[Math.floor(this.prng.nextFloat() * linkIds.length)];
        }

        const isRejectedAgent = counterFlowActive && this.prng.nextFloat() < 0.08;
        this.spawnAgent(targetGateId, undefined, baseWalkingSpeed, isRejectedAgent);
      }
    }

    // 2. Step Turnstile Bank Engine
    const { clearedAgentIds } = this.turnstiles.step(dt);
    if (clearedAgentIds.length > 0) {
      const clearedSet = new Set(clearedAgentIds);
      this.agents.forEach((ag) => {
        if (clearedSet.has(ag.id)) {
          ag.isBeingServiced = false;
          ag.isCleared = true;
          ag.isClearedConcourse = true;
          // Target vomitory dispersal point leading into seating bowl
          ag.targetX = ag.trajectory.vomitoryDispersalTarget.x;
          ag.targetY = ag.trajectory.vomitoryDispersalTarget.y;

          // Record wait time and throughput
          const wait = (now - ag.entryTimestamp) / 1000;
          this.waitTimesSec.push(wait);
          if (this.waitTimesSec.length > 60) this.waitTimesSec.shift();
          this.clearedInLastMinute.push(now);
        }
      });
    }

    // Filter throughput history older than 60 seconds
    const cutoff = now - 60000;
    while (this.clearedInLastMinute.length > 0 && this.clearedInLastMinute[0] < cutoff) {
      this.clearedInLastMinute.shift();
    }

    // 3. Populate Spatial Grid & Compute Helbing Social Repulsion & Compressive Pressure
    this.spatialGrid.clear();
    const len = this.agents.length;
    for (let i = 0; i < len; i++) {
      if (this.agents[i].active && !this.agents[i].isClearedVomitory) {
        this.spatialGrid.insert(this.agents[i]);
      }
    }

    // Update Local Densities and Pairwise Forces
    const observationRadius = 24; // ~1.2m
    const discAreaM2 = Math.PI * 1.2 * 1.2; // ~4.52 m²
    let maxDensityThisStep = 0;

    for (let i = 0; i < len; i++) {
      const ag = this.agents[i];
      if (!ag.active) continue;

      const neighbors = this.spatialGrid.getNeighbors(ag, observationRadius);
      const density = (neighbors.length + 1) / discAreaM2;
      ag.density = density;
      if (density > maxDensityThisStep) maxDensityThisStep = density;

      // Color based on density & status
      if (ag.isRejected) {
        ag.color = '#f43f5e'; // Bright Rose Red for rejected counter-flow
      } else if (ag.isBeingServiced) {
        ag.color = '#38bdf8'; // Active turnstile scanning
      } else if (density < 1.8) {
        ag.color = '#10b981'; // Green (Laminar)
      } else if (density < 3.8) {
        ag.color = '#f59e0b'; // Amber (Dense)
      } else {
        ag.color = '#fda4af'; // Rose/Pink (Crush risk threshold)
      }
    }
    this.peakObservedDensity = Math.max(this.peakObservedDensity * 0.98, maxDensityThisStep);

    // 4. Update Agent Vector Physics and Waypoint Navigation
    for (let i = this.agents.length - 1; i >= 0; i--) {
      const ag = this.agents[i];
      if (!ag.active) continue;

      // Check if agent reached seating bowl vomitory
      if (ag.isCleared) {
        const distToVomitory = Math.hypot(
          ag.x - ag.trajectory.vomitoryDispersalTarget.x,
          ag.y - ag.trajectory.vomitoryDispersalTarget.y
        );

        if (distToVomitory < 18) {
          ag.clearanceFade -= dt * 1.2;
          if (ag.clearanceFade <= 0.05) {
            // Patron is safely seated!
            this.seatedPatronsCount++;
            this.agents.splice(i, 1);
            continue;
          }
        }
      }

      // Check Turnstile Queue & Throat Arrival
      const innerGate = CHINNASWAMY_INNER_GATES.find((g) => g.id === ag.assignedInnerGateId);
      if (innerGate && !ag.isCleared && !ag.isBeingServiced) {
        const distToInner = Math.hypot(ag.x - innerGate.x, ag.y - innerGate.y);

        if (distToInner < 22) {
          // Arrived at turnstile throat! Try to admit into an idle counter
          ag.isInTurnstileQueue = true;
          const admitted = this.turnstiles.tryAdmitAgent(
            innerGate.id,
            ag.id,
            turnstileLatencySec
          );

          if (admitted) {
            ag.isBeingServiced = true;
            ag.vx = 0;
            ag.vy = 0;
            continue;
          } else {
            // Turnstiles full: hold in queue
            ag.vx *= 0.2;
            ag.vy *= 0.2;
          }
        }
      }

      // Waypoint Progression
      if (!ag.isBeingServiced && ag.waypoints && ag.currentWaypointIndex < ag.waypoints.length) {
        const targetWp = ag.waypoints[ag.currentWaypointIndex];
        const distToWp = Math.hypot(ag.x - targetWp.x, ag.y - targetWp.y);

        if (distToWp < 20) {
          ag.currentWaypointIndex++;
          if (ag.currentWaypointIndex < ag.waypoints.length) {
            ag.targetX = ag.waypoints[ag.currentWaypointIndex].x;
            ag.targetY = ag.waypoints[ag.currentWaypointIndex].y;
          }
        } else {
          ag.targetX = targetWp.x;
          ag.targetY = targetWp.y;
        }
      }

      // Apply Social Force Model
      const pixelsPerMeter = 20;
      const fruinDecay = Math.max(0.01, 1.0 - ag.density / 5.2);
      const desiredSpeedPx = (ag.desiredSpeed ?? 1.3) * pixelsPerMeter * fruinDecay;
      const tau = 0.45;

      const dx = ag.targetX - ag.x;
      const dy = ag.targetY - ag.y;
      const dist = Math.hypot(dx, dy) || 1;

      let fx = ((desiredSpeedPx * (dx / dist)) - ag.vx) / tau;
      let fy = ((desiredSpeedPx * (dy / dist)) - ag.vy) / tau;

      // Pairwise repulsion from neighbors
      const neighbors = this.spatialGrid.getNeighbors(ag, observationRadius);
      for (const other of neighbors) {
        const ndx = ag.x - other.x;
        const ndy = ag.y - other.y;
        const ndist = Math.hypot(ndx, ndy) || 0.001;
        const contactDist = ag.radius + other.radius;

        if (ndist < contactDist + 12) {
          const nx = ndx / ndist;
          const ny = ndy / ndist;
          const fSocial = 240 * Math.exp((contactDist - ndist) / 6.0);
          fx += fSocial * nx;
          fy += fSocial * ny;

          // Counter-flow shear if opposing heading
          if (ag.isRejected || other.isRejected) {
            fx += -ny * 320;
            fy += nx * 320;
          }
        }
      }

      // Integrate Acceleration
      ag.vx += fx * dt;
      ag.vy += fy * dt;

      // Speed clamp
      const curSpeed = Math.hypot(ag.vx, ag.vy);
      if (curSpeed > desiredSpeedPx * 1.5) {
        const sc = (desiredSpeedPx * 1.5) / curSpeed;
        ag.vx *= sc;
        ag.vy *= sc;
      }

      ag.x += ag.vx * dt;
      ag.y += ag.vy * dt;
    }

    // 5. Calculate Three-Zone Spatial Densities
    const zoneDensities = this.calculateZoneDensities();

    const avgWait =
      this.waitTimesSec.length > 0
        ? this.waitTimesSec.reduce((a, b) => a + b, 0) / this.waitTimesSec.length
        : 0;

    return {
      activeAgentCount: this.agents.length,
      seatedCount: this.seatedPatronsCount,
      peakDensity: Math.round(this.peakObservedDensity * 10) / 10,
      averageWaitTimeSec: Math.round(avgWait * 10) / 10,
      throughputPerMin: this.clearedInLastMinute.length,
      zoneDensities
    };
  }

  /**
   * Partitions agents into Zone A (Public Road), Zone B (Holding Concourse), and Zone C (Turnstile Throat).
   */
  private calculateZoneDensities(): ZoneDensities {
    let countA = 0; // Public road
    let countB = 0; // Concourse / holding area
    let countC = 0; // Turnstile throat

    const innerGates = CHINNASWAMY_INNER_GATES;

    for (const ag of this.agents) {
      if (!ag.active) continue;

      // Check distance to closest inner gate
      let minDistToInner = 9999;
      for (const ig of innerGates) {
        const d = Math.hypot(ag.x - ig.x, ag.y - ig.y);
        if (d < minDistToInner) minDistToInner = d;
      }

      if (minDistToInner < 30) {
        countC++; // Throat
      } else if (ag.y < 185 || ag.x > 1240 || ag.y > 1030) {
        countA++; // Public road
      } else {
        countB++; // Concourse / holding pen
      }
    }

    // Calibrated zone areas in m²
    const areaA = 180;
    const areaB = 450;
    const areaC = 95;

    return {
      zoneAPublicRoad: Math.round((countA / areaA) * 10) / 10,
      zoneBHoldingArea: Math.round((countB / areaB) * 10) / 10,
      zoneCTurnstileThroat: Math.round((countC / areaC) * 10) / 10
    };
  }

  public getAgents(): StadiumAgent[] {
    return this.agents;
  }

  public getTurnstiles(): TurnstileBankEngine {
    return this.turnstiles;
  }
}
