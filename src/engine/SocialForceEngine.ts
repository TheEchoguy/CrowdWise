import { AgentData, Wall } from '../types/simulation';
import { SpatialGrid } from './SpatialGrid';

/**
 * Calculates the closest point on a finite line segment (x1, y1) -> (x2, y2)
 * to an arbitrary point (px, py) for normal pushback calculations.
 */
export function closestPointOnSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): { x: number; y: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;

  if (lenSq < 0.0001) {
    return { x: x1, y: y1 };
  }

  // Vector projection parameter clamped to [0, 1]
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));

  return {
    x: x1 + t * dx,
    y: y1 + t * dy
  };
}

/**
 * Updates individual agent vector physics:
 * - Driving force towards target F_target = (v_desired - v_actual) / tau (tau = 0.5s)
 * - Boundary & obstacle repulsion with exponential pushback
 * - Non-linear velocity decay as local density exceeds 4.0 agents/m²
 * - Subtle jitter/sway vector under high friction (>4.5 p/m²) simulating crowd turbulence
 */
export function updateAgentPhysics(
  agent: AgentData,
  dt: number,
  baseSpeed: number, // in m/s (e.g. 1.3 m/s)
  walls: Wall[],
  baffles: Wall[],
  _sQueueEnabled: boolean = true
): void {
  if (agent.active === false) return;

  // Patrons cleared through security disperse smoothly upward and fade out without obstacle resistance
  if (agent.isCleared || agent.isClearedConcourse) {
    agent.vy = Math.min(-32, agent.vy || -32);
    agent.vx = (agent.vx || 0) * 0.95;
    agent.x += agent.vx * dt;
    agent.y += agent.vy * dt;
    return;
  }

  const pixelsPerMeter = 20;
  // Empirical Fruin Flow Validation [Fruin 1971, Weidmann 1993]
  // v(rho) = v0 * max(0.01, 1 - rho / 5.2). As local density reaches 5.2 p/m², forward speed drops to near-zero.
  const rhoMax = 5.2;
  const fruinDecay = agent.density ? Math.max(0.01, 1.0 - (agent.density / rhoMax)) : 1.0;
  const desiredSpeedPx = (agent.desiredSpeed || baseSpeed) * pixelsPerMeter * fruinDecay;
  let tau = 0.5; // Relaxation time (seconds)

  let fx = 0;
  let fy = 0;

  // Determine target coordinates: waypoint steering or final destination
  let targetX = agent.targetX;
  let targetY = agent.targetY;

  // Counter-Flow Shockwave: If rejected at inner gate, reverse path toward street
  if (agent.isRejected) {
    targetY = 510;
    tau = 0.4;
  } else if (agent.isCleared || agent.isClearedConcourse) {
    targetX = agent.concourseDispersalTarget?.x ?? agent.x;
    targetY = agent.concourseDispersalTarget?.y ?? -20;
    tau = 0.3;
  } else if (agent.waypoints && agent.waypoints.length > 0) {
    if (agent.currentWaypointIndex < agent.waypoints.length) {
      const wp = agent.waypoints[agent.currentWaypointIndex];
      targetX = wp.x;
      targetY = wp.y;
      agent.targetX = wp.x;
      agent.targetY = wp.y;
      tau = 0.35;

      // Active Waypoint Traversal: 22px waypoint radius with progression
      const distToWp = Math.hypot(agent.x - wp.x, agent.y - wp.y);
      if (distToWp < 22.0) {
        agent.currentWaypointIndex++;
        if (agent.currentWaypointIndex < agent.waypoints.length) {
          const nextWp = agent.waypoints[agent.currentWaypointIndex];
          targetX = nextWp.x;
          targetY = nextWp.y;
          agent.targetX = nextWp.x;
          agent.targetY = nextWp.y;
        }
      }
    } else {
      // Reached final destination (inner turnstiles or grandstand): persist final waypoint forward
      const lastWp = agent.waypoints[agent.waypoints.length - 1];
      targetX = lastWp.x;
      targetY = lastWp.y;
      agent.targetX = lastWp.x;
      agent.targetY = lastWp.y;
      tau = 0.35;
    }
  }

  // 1. Target Attraction Driving Force: f_0 = (v0 * e_target - v) / tau [Helbing et al. 2000, Eq. (1)]
  const dx = targetX - agent.x;
  const dy = targetY - agent.y;
  const distToTarget = Math.hypot(dx, dy);

  let vDesiredX = 0;
  let vDesiredY = 0;

  if (distToTarget > 1.0) {
    vDesiredX = desiredSpeedPx * (dx / distToTarget);
    vDesiredY = desiredSpeedPx * (dy / distToTarget);
  }

  fx += (vDesiredX - agent.vx) / tau;
  fy += (vDesiredY - agent.vy) / tau;

  // 2. Obstacle Repulsion (Walls and Active Baffles)
  const obstacles = [...walls, ...baffles];
  const wallInfluenceRadius = 24; // 1.2 meters

  for (let i = 0; i < obstacles.length; i++) {
    const obs = obstacles[i];
    const closest = closestPointOnSegment(agent.x, agent.y, obs.x1, obs.y1, obs.x2, obs.y2);

    const diffX = agent.x - closest.x;
    const diffY = agent.y - closest.y;
    const dist = Math.hypot(diffX, diffY) || 0.001;
    const clearance = dist - agent.radius;

    if (clearance < wallInfluenceRadius) {
      const nx = diffX / dist;
      const ny = diffY / dist;

      // Exponential boundary repulsion
      const A_wall = 460;
      const B_wall = 6.0;
      const fWall = A_wall * Math.exp(-Math.max(0, clearance) / B_wall);

      fx += fWall * nx;
      fy += fWall * ny;

      // Hard elastic collision barrier if penetrating boundary
      if (clearance < 0) {
        const overlap = -clearance;
        const k_wall = 4000;
        fx += k_wall * overlap * nx;
        fy += k_wall * overlap * ny;

        // Physical Barrier Enforcement: Hard projection back outside segment by (radius + 2px)
        agent.x = closest.x + nx * (agent.radius + 2.0);
        agent.y = closest.y + ny * (agent.radius + 2.0);

        // Cancel velocity pushing into the barrier
        const vDotN = agent.vx * nx + agent.vy * ny;
        if (vDotN < 0) {
          agent.vx -= vDotN * nx;
          agent.vy -= vDotN * ny;
        }
      }
    }
  }

  // 3. Integrate Acceleration to Velocity
  agent.vx += fx * dt;
  agent.vy += fy * dt;

  // 4. Subtle Jitter / Sway Vector for agents experiencing > 4.5 p/m² (Crowd Turbulence / Quake)
  if (agent.density > 4.5 && distToTarget > 1.0) {
    const lateralX = -(vDesiredY || dy) / (distToTarget || 1);
    const lateralY = (vDesiredX || dx) / (distToTarget || 1);
    const excess = agent.density - 4.5;
    const timeTick = performance.now() * 0.006;
    const swayAmp = (Math.sin(agent.id * 9.17 + timeTick) * 2.2 + (Math.random() - 0.5) * 1.8) * excess * 12;
    agent.vx += lateralX * swayAmp * dt;
    agent.vy += lateralY * swayAmp * dt;
  }

  // 5. Non-Linear Viscosity Decay beyond 4.0 agents/m² (Fluid freezing & shockwave)
  if (agent.density > 4.0) {
    const excess = agent.density - 4.0;
    const viscosityDecay = 1.0 / (1.0 + 0.65 * Math.pow(excess, 1.8));
    agent.vx *= Math.max(0.03, viscosityDecay);
    agent.vy *= Math.max(0.03, viscosityDecay);
  }

  // 6. Max Speed Clamp: 1.5 * v0 for numerical stability [Helbing, Farkas, Vicsek 2000]
  const currentSpeed = Math.hypot(agent.vx, agent.vy);
  const maxAllowedSpeed = desiredSpeedPx * 1.55;
  if (currentSpeed > maxAllowedSpeed) {
    const scale = maxAllowedSpeed / currentSpeed;
    agent.vx *= scale;
    agent.vy *= scale;
  }

  // 7. Position Integration
  agent.x += agent.vx * dt;
  agent.y += agent.vy * dt;

  // Post-Integration Hard Barrier Projection Pass (prevents high-density glitch-through)
  for (let i = 0; i < obstacles.length; i++) {
    const obs = obstacles[i];
    const cl = closestPointOnSegment(agent.x, agent.y, obs.x1, obs.y1, obs.x2, obs.y2);
    const cdx = agent.x - cl.x;
    const cdy = agent.y - cl.y;
    const d = Math.hypot(cdx, cdy) || 0.001;
    if (d < agent.radius) {
      const cnx = cdx / d;
      const cny = cdy / d;
      agent.x = cl.x + cnx * (agent.radius + 2.0);
      agent.y = cl.y + cny * (agent.radius + 2.0);
      const vDotN = agent.vx * cnx + agent.vy * cny;
      if (vDotN < 0) {
        agent.vx -= vDotN * cnx;
        agent.vy -= vDotN * cny;
      }
    }
  }

  // 8. Stuck Time & Compressive Pressure Relaxation (|v| < 0.1 m/s -> 2 px/s)
  if (currentSpeed < 2.0) {
    agent.stuckTime += dt;
  } else {
    agent.stuckTime = Math.max(0, agent.stuckTime - dt * 1.5);
    // Relax compressive pressure when flowing
    agent.compressivePressure = Math.max(0, (agent.compressivePressure || 0) - dt * 60);
  }
}

/**
 * Calculates inter-agent social repulsion, compressive shockwave back-propagation,
 * and dynamic color assignment using SpatialGrid
 * - Green: < 2.5 p/m² (Safe Flow)
 * - Amber: 2.5 - 4.5 p/m² (Elevated Friction)
 * - Glowing Rose Red: ≥ 5.0 p/m² (Crush Risk Threshold)
 */
export function calculateCrowdInteractions(
  agents: AgentData[],
  grid: SpatialGrid,
  dt: number,
  isFlashTick: boolean = false
): void {
  // Re-populate spatial grid (cleared patrons do not exert crowd friction)
  grid.clear();
  const len = agents.length;
  for (let i = 0; i < len; i++) {
    if (agents[i].active !== false && !agents[i].isCleared && !agents[i].isClearedConcourse) {
      grid.insert(agents[i]);
    }
  }

  // Calculate pairwise forces, local densities, and compressive back-propagation
  const observationRadiusPx = 25; // 1.25 meters observation disc
  const discAreaM2 = Math.PI * 1.25 * 1.25; // ~4.909 m²

  for (let i = 0; i < len; i++) {
    const agent = agents[i];
    if (agent.active === false || agent.isCleared || agent.isClearedConcourse) continue;

    const neighbors = grid.getNeighbors(agent, observationRadiusPx);
    const localDensity = (neighbors.length + 1) / discAreaM2;
    agent.density = localDensity;

    // Dynamic Color Mapping based on Fruin Level of Service (LOS) & Evaluation Criteria
    if (localDensity < 1.5) {
      agent.color = '#38bdf8'; // Cyan/Blue: Free Flow (<1.5 p/m²)
    } else if (localDensity < 2.8) {
      agent.color = '#10b981'; // Green: Laminar Ingress (1.5 - 2.8 p/m²)
    } else if (localDensity < 4.5) {
      agent.color = '#f59e0b'; // Amber: Viscous Delay (2.8 - 4.5 p/m²)
    } else {
      // Radiant Pulsing Red: Compressive Shockwave Hazard (≥4.5 p/m²)
      agent.color = isFlashTick ? '#f43f5e' : '#fda4af';
    }

    // Determine agent forward target direction (along active waypoint or final target)
    let toTargetX = agent.targetX - agent.x;
    let toTargetY = agent.targetY - agent.y;
    if (agent.waypoints && agent.waypoints.length > 0 && agent.currentWaypointIndex < agent.waypoints.length) {
      const activeWp = agent.waypoints[agent.currentWaypointIndex];
      toTargetX = activeWp.x - agent.x;
      toTargetY = activeWp.y - agent.y;
    }
    const distToTarget = Math.hypot(toTargetX, toTargetY) || 1;
    const targetDirX = toTargetX / distToTarget;
    const targetDirY = toTargetY / distToTarget;

    // Is agent trapped / stalled at closed or slow gate? (< 0.1 m/s = 2 px/s)
    const agentSpeed = Math.hypot(agent.vx, agent.vy);
    const isTrapped = agentSpeed < 2.0;

    // Pairwise Helbing repulsive force & elastic contact
    const neighborLen = neighbors.length;
    for (let n = 0; n < neighborLen; n++) {
      const other = neighbors[n];
      const dx = agent.x - other.x;
      const dy = agent.y - other.y;
      const dist = Math.hypot(dx, dy) || 0.001;
      const contactDist = agent.radius + other.radius;
      const interactionThresh = contactDist + 8; // Social comfort zone

      if (dist < interactionThresh) {
        const nx = dx / dist;
        const ny = dy / dist;

        // Exponential social repulsion force [Helbing, Farkas, Vicsek 2000, Eq. (2)]
        const A_social = 280;
        const B_social = 6.0;
        const fSocial = A_social * Math.exp((contactDist - dist) / B_social);

        agent.vx += fSocial * nx * dt;
        agent.vy += fSocial * ny * dt;

        // Counter-Flow Shockwave Physics (People Pushing Backward)
        // When an oncoming agent collides head-on with forward-moving pedestrians (v1 · v2 < -0.5),
        // exponentially amplify lateral evasion friction and velocity reduction, dropping throughput by 35-50%
        const spd1 = Math.hypot(agent.vx, agent.vy) || 0.001;
        const spd2 = Math.hypot(other.vx, other.vy) || 0.001;
        const headOnDot = (agent.vx * other.vx + agent.vy * other.vy) / (spd1 * spd2);
        const isCounterFlowConflict =
          headOnDot < -0.4 ||
          Boolean(agent.isReverse) !== Boolean(other.isReverse) ||
          Boolean(agent.isRejected) !== Boolean(other.isRejected);

        if (isCounterFlowConflict) {
          const evasionFactor = Math.exp(Math.min(2.0, Math.abs(headOnDot)) * 1.5);
          const latX = -ny;
          const latY = nx;
          const latPush = 380 * evasionFactor * dt;
          agent.vx += latX * latPush;
          agent.vy += latY * latPush;

          // Strong velocity dissipation & shear deceleration
          agent.vx *= 0.88;
          agent.vy *= 0.88;
        }

        // Physical elastic contact force when bodies touch [Helbing et al. 2000, Eq. (3)]
        if (dist < contactDist) {
          const overlap = contactDist - dist;
          const k_body = 1200;
          const fElastic = k_body * overlap;

          agent.vx += fElastic * nx * dt;
          agent.vy += fElastic * ny * dt;

          // Tangential sliding friction
          const tx = -ny;
          const ty = nx;
          const relVel = (other.vx - agent.vx) * tx + (other.vy - agent.vy) * ty;
          const fFriction = 240 * overlap * relVel;

          agent.vx += fFriction * tx * dt;
          agent.vy += fFriction * ty * dt;

          // PHASE 2: Compressive Shockwave Back-Propagation
          // When an agent is trapped (<0.1 m/s) and a rear agent pushes into them along approach angle:
          const behindDot = (agent.x - other.x) * targetDirX + (agent.y - other.y) * targetDirY;
          if (isTrapped && behindDot > 0) {
            // Accumulate compressive pressure
            agent.compressivePressure = (agent.compressivePressure || 0) + overlap * 30;

            // Amplify repulsive force directed backwards along incoming approach angle
            const shockwaveAmplification = 2.2 + Math.min(3.0, (agent.compressivePressure || 0) / 80);
            other.vx -= targetDirX * fElastic * shockwaveAmplification * dt;
            other.vy -= targetDirY * fElastic * shockwaveAmplification * dt;
          }
        }
      }
    }
  }
}
