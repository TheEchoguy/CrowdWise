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
 */
export function updateAgentPhysics(
  agent: AgentData,
  dt: number,
  baseSpeed: number, // in m/s (e.g. 1.3 m/s)
  walls: Wall[],
  baffles: Wall[]
): void {
  if (agent.active === false) return;

  const pixelsPerMeter = 20;
  const desiredSpeedPx = (agent.desiredSpeed || baseSpeed) * pixelsPerMeter;
  const tau = 0.5; // Relaxation time (seconds)

  let fx = 0;
  let fy = 0;

  // 1. Target Attraction Force
  const dx = agent.targetX - agent.x;
  const dy = agent.targetY - agent.y;
  const distToTarget = Math.hypot(dx, dy);

  if (distToTarget > 1.0) {
    const dirX = dx / distToTarget;
    const dirY = dy / distToTarget;
    const vDesiredX = desiredSpeedPx * dirX;
    const vDesiredY = desiredSpeedPx * dirY;

    fx += (vDesiredX - agent.vx) / tau;
    fy += (vDesiredY - agent.vy) / tau;
  }

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
        const k_wall = 2200;
        fx += k_wall * overlap * nx;
        fy += k_wall * overlap * ny;
      }
    }
  }

  // 3. Integrate Acceleration to Velocity
  agent.vx += fx * dt;
  agent.vy += fy * dt;

  // 4. Non-Linear Viscosity Decay beyond 4.0 agents/m² (Fluid freezing & shockwave)
  if (agent.density > 4.0) {
    const excess = agent.density - 4.0;
    const viscosityDecay = 1.0 / (1.0 + 0.65 * Math.pow(excess, 1.8));
    agent.vx *= Math.max(0.03, viscosityDecay);
    agent.vy *= Math.max(0.03, viscosityDecay);
  }

  // 5. Max Speed Clamp
  const currentSpeed = Math.hypot(agent.vx, agent.vy);
  const maxAllowedSpeed = desiredSpeedPx * 1.55;
  if (currentSpeed > maxAllowedSpeed) {
    const scale = maxAllowedSpeed / currentSpeed;
    agent.vx *= scale;
    agent.vy *= scale;
  }

  // 6. Position Integration
  agent.x += agent.vx * dt;
  agent.y += agent.vy * dt;

  // 7. Stuck Time Tracking (|v| < 0.2 m/s -> 4 px/s)
  if (currentSpeed < 4.0) {
    agent.stuckTime += dt;
  } else {
    agent.stuckTime = Math.max(0, agent.stuckTime - dt * 1.5);
  }
}

/**
 * Calculates inter-agent social repulsion and dynamic color assignment using SpatialGrid
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
  // Re-populate spatial grid
  grid.clear();
  const len = agents.length;
  for (let i = 0; i < len; i++) {
    if (agents[i].active !== false) {
      grid.insert(agents[i]);
    }
  }

  // Calculate pairwise forces and local densities
  const observationRadiusPx = 25; // 1.25 meters observation disc
  const discAreaM2 = Math.PI * 1.25 * 1.25; // ~4.909 m²

  for (let i = 0; i < len; i++) {
    const agent = agents[i];
    if (agent.active === false) continue;

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

        // Exponential social pushback
        const A_social = 280;
        const B_social = 6.0;
        const fSocial = A_social * Math.exp((contactDist - dist) / B_social);

        agent.vx += fSocial * nx * dt;
        agent.vy += fSocial * ny * dt;

        // Physical elastic contact force when bodies compress
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
        }
      }
    }
  }
}
