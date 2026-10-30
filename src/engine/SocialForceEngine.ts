import { Agent, Wall, Gate, Baffle, TelemetryState, ScenarioPreset } from './types';
import { SpatialGrid } from './SpatialGrid';

/**
 * Helbing Microscopic Social Force Physics Engine
 * Implements:
 * 1. Target driving force F_target = (v_desired - v_actual) / tau (tau = 0.5s)
 * 2. Exponential boundary & wall repulsion with closest-point vector projection
 * 3. Pairwise inter-agent elastic pushback for neighbor clearance
 * 4. Non-linear viscosity decay beyond 4.0 agents/m² (fluid freezing / shockwave)
 * 5. Dynamic Fruin Level-of-Service color coding (Green, Amber, Flashing Rose Red)
 */
export class SocialForceEngine {
  public agents: Agent[] = [];
  public walls: Wall[] = [];
  public gates: Gate[] = [];
  public baffles: Baffle[] = [];
  public spatialGrid: SpatialGrid;

  public pixelsPerMeter: number = 20; // 20 pixels = 1.0 meter
  public tau: number = 0.5;           // Target relaxation time (seconds)
  public nextAgentId: number = 1;

  // Gate & Spawn management
  public inflowRate: number = 180;    // Agents per minute
  public gateLatency: number = 2.0;   // Seconds per agent at turnstile
  public bafflesActive: boolean = false;
  public auxGateActive: boolean = false;
  public dividerActive: boolean = true;

  private spawnAccumulator: number = 0;
  private currentPreset: ScenarioPreset | null = null;

  // Rolling telemetry metrics
  private throughputHistory: number[] = []; // Timestamps of cleared agents
  private fpsWindow: number[] = [];
  private lastFpsCalcTime: number = 0;
  private currentFps: number = 60;
  private flashTimer: number = 0;

  constructor(width: number, height: number, pixelsPerMeter: number = 20) {
    this.pixelsPerMeter = pixelsPerMeter;
    this.spatialGrid = new SpatialGrid(width, height, 32);
  }

  /**
   * Load and initialize a scenario preset geometry
   */
  public loadScenario(preset: ScenarioPreset): void {
    this.currentPreset = preset;
    this.pixelsPerMeter = preset.pixelsPerMeter;
    this.walls = [...preset.walls];
    this.gates = preset.gates.map(g => ({ ...g }));
    this.baffles = preset.baffles.map(b => ({ ...b }));
    this.inflowRate = preset.defaultInflowRate;
    this.gateLatency = preset.defaultGateLatency;

    this.spatialGrid.resize(preset.width, preset.height, 32);
    this.resetSimulation();
  }

  /**
   * Reset all agents and simulation state
   */
  public resetSimulation(): void {
    this.agents = [];
    this.nextAgentId = 1;
    this.spawnAccumulator = 0;
    this.throughputHistory = [];
    this.fpsWindow = [];

    // Reset gate cooldowns
    for (const gate of this.gates) {
      gate.cooldown = 0;
      gate.totalPassed = 0;
    }

    if (this.currentPreset) {
      // Seed initial crowd in spawn zones
      this.seedInitialCrowd(this.currentPreset, 40);
    }
  }

  /**
   * Seed an initial gentle crowd spread
   */
  private seedInitialCrowd(preset: ScenarioPreset, count: number): void {
    if (!preset.spawnZones.length) return;

    for (let i = 0; i < count; i++) {
      const zone = preset.spawnZones[i % preset.spawnZones.length];
      const x = zone.x + Math.random() * zone.width;
      const y = zone.y + Math.random() * zone.height;

      // Assign target matching group
      const target = preset.targetZones.find(tz => (tz.group ?? 0) === (zone.group ?? 0)) || preset.targetZones[0];

      this.spawnAgent(x, y, target.x, target.y, zone.group ?? 0);
    }
  }

  /**
   * Spawn a single agent with realistic pedestrian attributes
   */
  public spawnAgent(
    x: number,
    y: number,
    targetX: number,
    targetY: number,
    group: number = 0
  ): Agent {
    // Pedestrian diameter ~0.45m - 0.55m -> radius ~4.5 - 5.5px at 20px/m
    const radius = (0.24 + Math.random() * 0.05) * this.pixelsPerMeter;
    // Walking speed: 1.2 to 1.5 m/s (~24 to 30 px/s)
    const desiredSpeedMps = 1.25 + (Math.random() * 0.35 - 0.1);
    const desiredSpeed = desiredSpeedMps * this.pixelsPerMeter;

    const agent: Agent = {
      id: this.nextAgentId++,
      x,
      y,
      vx: (Math.random() - 0.5) * 4,
      vy: (Math.random() - 0.5) * 4,
      radius,
      targetX,
      targetY,
      density: 1.0,
      color: '#10b981',
      stuckTime: 0,
      desiredSpeed,
      maxSpeed: desiredSpeed * 1.55,
      mass: 75 + (Math.random() * 10 - 5),
      group,
      flashPhase: 0,
      active: true
    };

    this.agents.push(agent);
    return agent;
  }

  /**
   * Step the physical simulation by dt seconds
   */
  public update(dt: number, currentTimeMs: number): TelemetryState {
    // Clamp dt to prevent explosion on background tab switch
    const clampedDt = Math.min(Math.max(dt, 0.001), 0.05);

    // Track FPS
    this.updateFps(currentTimeMs);

    // Update flashing ticker for critical crush alerts
    this.flashTimer += clampedDt;
    const isFlashActive = Math.sin(this.flashTimer * 12) > 0;

    // 1. Inflow Spawning
    this.handleInflow(clampedDt);

    // 2. Build Spatial Hash Grid
    this.spatialGrid.populate(this.agents);

    // 3. Update Gates Cooldowns
    this.updateGates(clampedDt);

    // 4. Calculate Density & Helbing Forces for Each Agent
    const activeWalls = this.getActiveWallsAndBaffles();
    const len = this.agents.length;

    let peakDensity = 0;
    let criticalZonesCount = 0;
    let totalVel = 0;
    let maxSpillback = 0;

    // Locate primary gate for spillback calculation
    const primaryGate = this.gates.find(g => g.id === 'gate-a') || this.gates[0];
    const gateRefX = primaryGate ? primaryGate.x : 0;
    const gateRefY = primaryGate ? primaryGate.y : 0;

    for (let i = 0; i < len; i++) {
      const agent = this.agents[i];
      if (!agent.active) continue;

      // Estimate local density in agents/m²
      const localDensity = this.spatialGrid.estimateDensity(agent, this.pixelsPerMeter);
      agent.density = localDensity;
      if (localDensity > peakDensity) {
        peakDensity = localDensity;
      }
      if (localDensity >= 5.0) {
        criticalZonesCount++;
      }

      // Dynamic color mapping based on Fruin Level of Service (LOS):
      // Green: < 2.5 / m² (Free-flow / comfortable)
      // Amber: 2.5 - 4.5 / m² (Elevated friction & queue buffering)
      // Coral/Orange-Red: 4.5 - 5.0 / m² (Pre-crush threshold)
      // Flashing Rose Red: >= 5.0 / m² (Critical crush risk & compressive shockwaves)
      if (localDensity < 2.5) {
        agent.color = '#10b981'; // Emerald 500
      } else if (localDensity < 4.5) {
        agent.color = '#f59e0b'; // Amber 500
      } else if (localDensity < 5.0) {
        agent.color = '#f97316'; // Orange 500
      } else {
        agent.color = isFlashActive ? '#f43f5e' : '#fda4af'; // Flashing Rose Red
      }

      // Check Gate Target Rerouting (if aux gate is active)
      this.routeAgentTarget(agent);

      // --- Force Accumulators ---
      let fx = 0;
      let fy = 0;

      // A. Driving Force towards target
      // F_target = (v_desired - v_actual) / tau (tau = 0.5s)
      const toTargetX = agent.targetX - agent.x;
      const toTargetY = agent.targetY - agent.y;
      const distToTarget = Math.hypot(toTargetX, toTargetY);

      if (distToTarget > 1.0) {
        const dirX = toTargetX / distToTarget;
        const dirY = toTargetY / distToTarget;
        const vDesiredX = agent.desiredSpeed * dirX;
        const vDesiredY = agent.desiredSpeed * dirY;

        fx += (vDesiredX - agent.vx) / this.tau;
        fy += (vDesiredY - agent.vy) / this.tau;
      }

      // B. Inter-agent Pairwise Social & Elastic Repulsion
      // Neighbor distance < (2 * radius + 8px)
      const interactionThresh = agent.radius * 2 + 12; // Social buffer
      this.spatialGrid.forEachNeighbor(agent, interactionThresh, (neighbor, _distSq, dist) => {
        const nx = (agent.x - neighbor.x) / dist;
        const ny = (agent.y - neighbor.y) / dist;
        const sumRadii = agent.radius + neighbor.radius;

        // Helbing exponential social force
        const A_social = 320; // Repulsive magnitude
        const B_social = 6.0; // Distance scale
        const fSocial = A_social * Math.exp((sumRadii - dist) / B_social);

        fx += fSocial * nx;
        fy += fSocial * ny;

        // Physical elastic contact force when bodies touch
        if (dist < sumRadii) {
          const overlap = sumRadii - dist;
          const k_body = 1200; // Elastic body stiffness
          const fElastic = k_body * overlap;

          fx += fElastic * nx;
          fy += fElastic * ny;

          // Tangential sliding friction
          const tx = -ny;
          const ty = nx;
          const relVel = (neighbor.vx - agent.vx) * tx + (neighbor.vy - agent.vy) * ty;
          const fFriction = 300 * overlap * relVel;

          fx += fFriction * tx;
          fy += fFriction * ty;
        }
      });

      // C. Boundary & Wall Repulsive Force
      // Exponential pushback using closest-point-on-segment vector math
      const wallThreshold = 24; // ~1.2m influence distance
      for (let w = 0; w < activeWalls.length; w++) {
        const wall = activeWalls[w];
        const segX = wall.x2 - wall.x1;
        const segY = wall.y2 - wall.y1;
        const segLenSq = segX * segX + segY * segY;
        if (segLenSq < 0.001) continue;

        // Vector projection of agent onto line segment
        const t = Math.max(0, Math.min(1, ((agent.x - wall.x1) * segX + (agent.y - wall.y1) * segY) / segLenSq));
        const closestX = wall.x1 + t * segX;
        const closestY = wall.y1 + t * segY;

        const diffX = agent.x - closestX;
        const diffY = agent.y - closestY;
        const distSq = diffX * diffX + diffY * diffY;
        const dist = Math.sqrt(distSq) || 0.001;

        const clearance = dist - agent.radius;

        if (clearance < wallThreshold) {
          const nx = diffX / dist;
          const ny = diffY / dist;

          // Exponential boundary repulsion
          const A_wall = 480;
          const B_wall = 5.5;
          const fWall = A_wall * Math.exp(-Math.max(0, clearance) / B_wall);

          fx += fWall * nx;
          fy += fWall * ny;

          // Strong physical contact barrier if penetration occurs
          if (clearance < 0) {
            const overlap = -clearance;
            const k_wall = 2400;
            fx += k_wall * overlap * nx;
            fy += k_wall * overlap * ny;
          }
        }
      }

      // --- Integrate Acceleration to Velocity ---
      agent.vx += fx * clampedDt;
      agent.vy += fy * clampedDt;

      // D. Viscosity Decay: Non-linear velocity drop as local density > 4.0 agents/m²
      // Simulates fluid freezing, turbulent shear, and shockwave propagation
      if (agent.density > 4.0) {
        const excess = agent.density - 4.0;
        // Severe non-linear drop
        const viscosityFactor = 1.0 / (1.0 + 0.65 * Math.pow(excess, 1.8));
        agent.vx *= Math.max(0.02, viscosityFactor);
        agent.vy *= Math.max(0.02, viscosityFactor);
      }

      // Speed clamp
      const currentSpeed = Math.hypot(agent.vx, agent.vy);
      if (currentSpeed > agent.maxSpeed) {
        const scale = agent.maxSpeed / currentSpeed;
        agent.vx *= scale;
        agent.vy *= scale;
      }

      // E. Position Integration
      agent.x += agent.vx * clampedDt;
      agent.y += agent.vy * clampedDt;

      // Stuck time evaluation: |v| < 0.20 m/s (~4px/s)
      const speedMps = currentSpeed / this.pixelsPerMeter;
      totalVel += speedMps;

      if (speedMps < 0.2) {
        agent.stuckTime += clampedDt;
        // Compute queue spillback from bottleneck gate
        if (primaryGate) {
          const distToGate = Math.hypot(agent.x - gateRefX, agent.y - gateRefY) / this.pixelsPerMeter;
          if (distToGate > maxSpillback) {
            maxSpillback = distToGate;
          }
        }
      } else {
        agent.stuckTime = Math.max(0, agent.stuckTime - clampedDt * 2);
      }

      // F. Gate Traversal & Despawn Logic
      this.checkGatePassing(agent, currentTimeMs);
    }

    // Filter out inactive agents (agents that exited)
    this.agents = this.agents.filter(a => a.active);

    // Compute rolling throughput per minute
    const oneMinuteAgo = currentTimeMs - 60000;
    this.throughputHistory = this.throughputHistory.filter(t => t >= oneMinuteAgo);
    const throughputPerMin = this.throughputHistory.length;

    const liveAgents = this.agents.length;
    const avgVelocity = liveAgents > 0 ? totalVel / liveAgents : 0;
    const isCritical = peakDensity >= 5.0;

    return {
      peakDensity: Math.round(peakDensity * 10) / 10,
      maxSpillback: Math.round(maxSpillback * 10) / 10,
      throughput: throughputPerMin,
      totalAgents: liveAgents,
      fps: this.currentFps,
      isCritical,
      activeCrushZones: criticalZonesCount,
      avgVelocity: Math.round(avgVelocity * 100) / 100
    };
  }

  /**
   * Route agents dynamically between Gate A and Gate B if aux gate is active
   */
  private routeAgentTarget(agent: Agent): void {
    if (!this.currentPreset) return;

    if (this.currentPreset.id === 'stadium') {
      const gateA = this.gates.find(g => g.id === 'gate-a');
      const gateB = this.gates.find(g => g.id === 'gate-b');

      if (this.auxGateActive && gateB && gateB.active) {
        // If agent is upper half or closer to Gate B, divert target to Gate B
        if (agent.y < 350 || (agent.id % 2 === 0 && agent.x < 750)) {
          agent.targetX = gateB.x;
          agent.targetY = gateB.y;
          return;
        }
      }

      // Default target Gate A
      if (gateA) {
        agent.targetX = gateA.x;
        agent.targetY = gateA.y;
      }
    }
  }

  /**
   * Gate cooldown & turnstile flow limiter
   */
  private updateGates(dt: number): void {
    for (const gate of this.gates) {
      if (gate.cooldown > 0) {
        gate.cooldown = Math.max(0, gate.cooldown - dt);
      }
    }
  }

  /**
   * Check if an agent successfully cleared a gate turnstile
   */
  private checkGatePassing(agent: Agent, currentTimeMs: number): void {
    for (const gate of this.gates) {
      if (!gate.active) continue;

      const halfW = gate.width / 2 + 4;
      const halfH = gate.height / 2 + 8;

      if (
        Math.abs(agent.x - gate.x) <= halfW &&
        Math.abs(agent.y - gate.y) <= halfH
      ) {
        // Turnstile check: if gate is ready, agent passes!
        if (gate.cooldown <= 0) {
          gate.cooldown = this.gateLatency;
          gate.totalPassed++;
          agent.active = false; // Successfully cleared ingress
          this.throughputHistory.push(currentTimeMs);
          return;
        } else {
          // Gate is busy: turnstile blockage holds back the agent
          agent.vx *= 0.1;
          agent.vy *= 0.1;
        }
      }
    }

    // Clean up out of bounds agents
    if (
      agent.x < -100 ||
      agent.x > (this.currentPreset?.width || 1200) + 100 ||
      agent.y < -100 ||
      agent.y > (this.currentPreset?.height || 700) + 100
    ) {
      agent.active = false;
    }
  }

  /**
   * Inflow generator based on inflowRate (agents per minute)
   */
  private handleInflow(dt: number): void {
    if (!this.currentPreset || !this.currentPreset.spawnZones.length) return;

    // inflowRate is agents per minute -> agents per second = inflowRate / 60
    const agentsPerSecond = this.inflowRate / 60;
    this.spawnAccumulator += agentsPerSecond * dt;

    while (this.spawnAccumulator >= 1.0) {
      this.spawnAccumulator -= 1.0;

      // Select spawn zone
      const zones = this.currentPreset.spawnZones;
      const zoneIndex = Math.floor(Math.random() * zones.length);
      const zone = zones[zoneIndex];

      const x = zone.x + Math.random() * zone.width;
      const y = zone.y + Math.random() * zone.height;

      // Target matching group
      const target =
        this.currentPreset.targetZones.find(tz => (tz.group ?? 0) === (zone.group ?? 0)) ||
        this.currentPreset.targetZones[0];

      this.spawnAgent(x, y, target.x, target.y, zone.group ?? 0);
    }
  }

  /**
   * Gather active physical obstacles including dynamic baffles and lane dividers
   */
  private getActiveWallsAndBaffles(): { x1: number; y1: number; x2: number; y2: number }[] {
    const list: { x1: number; y1: number; x2: number; y2: number }[] = [];

    // Permanent walls
    for (const w of this.walls) {
      // If divider wall is toggled off in bridge scenario, skip
      if (w.type === 'divider' && !this.dividerActive) {
        continue;
      }
      list.push({ x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2 });
    }

    // Active holding baffles
    if (this.bafflesActive) {
      for (const b of this.baffles) {
        list.push({ x1: b.x1, y1: b.y1, x2: b.x2, y2: b.y2 });
      }
    }

    return list;
  }

  /**
   * Trigger a sudden shock reversal: all agents reverse target to emergency exit
   */
  public triggerShockReversal(): void {
    if (!this.currentPreset) return;

    for (const agent of this.agents) {
      // Flip target backwards to rear exit
      agent.targetX = 80;
      agent.targetY = 350 + (Math.random() * 80 - 40);
      agent.desiredSpeed *= 1.4; // Panic sprint
      agent.group = 1;
    }
  }

  /**
   * FPS calculation
   */
  private updateFps(currentTimeMs: number): void {
    if (this.lastFpsCalcTime === 0) {
      this.lastFpsCalcTime = currentTimeMs;
      return;
    }

    const delta = currentTimeMs - this.lastFpsCalcTime;
    this.lastFpsCalcTime = currentTimeMs;

    if (delta > 0) {
      const instantaneousFps = 1000 / delta;
      this.fpsWindow.push(instantaneousFps);
      if (this.fpsWindow.length > 30) {
        this.fpsWindow.shift();
      }

      const sum = this.fpsWindow.reduce((a, b) => a + b, 0);
      this.currentFps = Math.round(sum / this.fpsWindow.length);
    }
  }
}
