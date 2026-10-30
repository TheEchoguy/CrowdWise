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
  sQueueEnabled: boolean = true
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
  const desiredSpeedPx = (agent.desiredSpeed || baseSpeed) * pixelsPerMeter;
  let tau = 0.5; // Relaxation time (seconds)

  let fx = 0;
  let fy = 0;

  // Determine target coordinates: waypoint steering or final destination
  let targetX = agent.targetX;
  let targetY = agent.targetY;

  if (agent.isClearedConcourse) {
    // Patrons cleared through security disperse smoothly into the inner stadium concourse
    targetX = agent.concourseDispersalTarget?.x ?? agent.x;
    targetY = agent.concourseDispersalTarget?.y ?? -20;
    tau = 0.3;
  } else if (agent.waypoints && agent.waypoints.length > 0 && agent.currentWaypointIndex < agent.waypoints.length) {
    let wp = agent.waypoints[agent.currentWaypointIndex];

    // Never let an agent target a coordinate behind them during forward ingress
    while (
      agent.currentWaypointIndex < agent.waypoints.length - 1 &&
      agent.stage === 1 &&
      wp.y > agent.y + 12
    ) {
      agent.currentWaypointIndex++;
      wp = agent.waypoints[agent.currentWaypointIndex];
    }

    targetX = wp.x;
    targetY = wp.y;
    tau = 0.35; // High target-drive fidelity for S-curve lane navigation

    // Active Waypoint Traversal: 18px waypoint radius with instant progression
    const distToWp = Math.hypot(agent.x - wp.x, agent.y - wp.y);
    if (distToWp < 18.0) {
      agent.currentWaypointIndex++;
      if (agent.currentWaypointIndex < agent.waypoints.length) {
        const nextWp = agent.waypoints[agent.currentWaypointIndex];
        targetX = nextWp.x;
        targetY = nextWp.y;
      } else {
        targetX = agent.targetX;
        targetY = agent.targetY;
      }
    }
  }

  // Immediate Forward Drive on Spawn & Automated De-clogging Impulse
  const isInsideBooth = agent.stage === 3 && agent.assignedCounterId !== null;
  if (!isInsideBooth && !agent.isCleared && !agent.isClearedConcourse) {
    // Immediate forward drive if near bottom spawn area
    if (agent.y > 460 && agent.vy > -10) {
      agent.vy = -18 - Math.random() * 4;
    }

    // Automated De-clogging Impulse: if speed^2 < 4 for > 40 frames (~0.65s) outside booth
    const speedSq = agent.vx * agent.vx + agent.vy * agent.vy;
    if (speedSq < 4.0) {
      agent.stuckTime += dt;
      if (agent.stuckTime > 0.65) {
        agent.vy = -28;
        agent.vx += (Math.random() - 0.5) * 12;
        agent.stuckTime = 0;
      }
    } else {
      agent.stuckTime = Math.max(0, agent.stuckTime - dt * 2.0);
    }
  }

  // 1. Target Attraction / Corridor Flow Field Driving Force
  const dx = targetX - agent.x;
  const dy = targetY - agent.y;
  const distToTarget = Math.hypot(dx, dy);

  let vDesiredX = 0;
  let vDesiredY = 0;

  // Lane-Aware Guided Dynamics: When inside S-queue corridor, enforce lane dominant flow vector
  const isGate1Agent = agent.assignedGateId === 'gate-1' || agent.assignedGateId === 'gate1';
  const inSCorridorBounds =
    sQueueEnabled &&
    isGate1Agent &&
    !agent.isClearedConcourse &&
    agent.x >= 220 &&
    agent.x <= 510 &&
    agent.y >= 125 &&
    agent.y <= 295;

  if (inSCorridorBounds) {
    // Zero out vertical target pull into horizontal barrier walls
    if (agent.y >= 250 && agent.y <= 290 && agent.x < 465) {
      // Lane 1 (Bottom): WEST to EAST (+X)
      vDesiredX = desiredSpeedPx;
      vDesiredY = (270 - agent.y) * 1.8; // Centering along Lane 1 centerline
    } else if (agent.x >= 465 && agent.y >= 205 && agent.y <= 275) {
      // U-Turn 1: Turn smoothly around right bend up into Lane 2
      vDesiredX = (485 - agent.x) * 1.5;
      vDesiredY = -desiredSpeedPx;
    } else if (agent.y >= 190 && agent.y <= 230 && agent.x > 265) {
      // Lane 2 (Middle): EAST to WEST (-X)
      vDesiredX = -desiredSpeedPx;
      vDesiredY = (210 - agent.y) * 1.8; // Centering along Lane 2 centerline
    } else if (agent.x <= 265 && agent.y >= 145 && agent.y <= 215) {
      // U-Turn 2: Turn smoothly around left bend up into Lane 3
      vDesiredX = (245 - agent.x) * 1.5;
      vDesiredY = -desiredSpeedPx;
    } else if (agent.y >= 130 && agent.y <= 170) {
      // Lane 3 (Top): WEST to EAST (+X) leading directly to Fast-Scan bar
      vDesiredX = desiredSpeedPx;
      vDesiredY = (150 - agent.y) * 1.8; // Centering along Lane 3 centerline
    } else if (distToTarget > 1.0) {
      vDesiredX = desiredSpeedPx * (dx / distToTarget);
      vDesiredY = desiredSpeedPx * (dy / distToTarget);
    }
  } else if (distToTarget > 1.0) {
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

  // 6. Max Speed Clamp & Unconditional Forward Flow Field (Inflow Suction)
  if (agent.y > 80 && !isInsideBooth && !agent.isCleared && !agent.isClearedConcourse) {
    // Clamp minimum forward velocity component so agents never stop when heading towards target
    if (agent.vy > -12 && targetY < agent.y) {
      agent.vy = -18;
    }

    if (agent.y > 280) {
      const minForwardVy = -baseSpeed * 22; // ~ -28.6 px/s
      agent.vy = Math.min(agent.vy, minForwardVy);
    }

    // Queue Ingress Corridor Suction Field in funnel entrance
    if (agent.y <= 360 && agent.y >= 250 && Math.abs(agent.x - 260) < 80) {
      const suctionX = (260 - agent.x) * 1.8;
      agent.vx += suctionX * dt;
      agent.vy -= 15 * dt;
    }
  }

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

    // Dynamic Color Mapping based on Fruin Level of Service (LOS)
    if (localDensity < 2.5) {
      agent.color = '#10b981'; // Green
    } else if (localDensity < 4.5) {
      agent.color = '#f59e0b'; // Amber
    } else if (localDensity < 5.0) {
      agent.color = '#f97316'; // Orange-Coral
    } else {
      // Flashing / Glowing Rose Red
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

        // Reduce inter-agent backward repulsion: when force vector points opposite
        // to agent's desired forward direction, scale down by 0.15x
        const forceDotTarget = nx * targetDirX + ny * targetDirY;
        const pushScale = forceDotTarget < 0 ? 0.15 : 1.0;

        // Exponential social pushback
        const A_social = 280;
        const B_social = 6.0;
        const fSocial = A_social * Math.exp((contactDist - dist) / B_social) * pushScale;

        agent.vx += fSocial * nx * dt;
        agent.vy += fSocial * ny * dt;

        // Physical elastic contact force when bodies touch
        if (dist < contactDist) {
          const overlap = contactDist - dist;
          const k_body = 1200;
          const fElastic = k_body * overlap * pushScale;

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
