/**
 * CROWDWISE — Experiment A: Free-Flow Movement
 * Evaluates pedestrian walking speeds under unconstrained conditions (rho < 0.8 p/m²)
 * Reference: Weidmann (1993) empirical free-flow speed v0 ~ N(1.34, 0.26) m/s
 */

import { SocialForceEngineCore } from '../../engine/SocialForceModel';
import { SeededPRNG } from '../../engine/prng';

export interface FreeFlowResult {
  agentCount: number;
  meanObservedSpeed: number; // m/s
  expectedV0: number; // 1.34 m/s
  speedStandardDeviation: number;
  minSpeed: number;
  maxSpeed: number;
  velocityError: number; // |mean - 1.34|
  isWithinWeidmannBounds: boolean; // 1.34 +/- 0.15 m/s
}

export function runFreeFlowExperiment(
  agentCount: number = 20,
  durationSeconds: number = 8.0,
  seed: number = 42
): FreeFlowResult {
  // Arena 40m wide x 20m high (spacious for free flow)
  const engine = new SocialForceEngineCore(40.0, 20.0, agentCount * 2, seed);
  engine.init(seed);

  const prng = new SeededPRNG(seed);
  // Spawn agents scattered horizontally at x in [2, 10], y in [2, 18], walking toward x = 38
  for (let i = 0; i < agentCount; i++) {
    const x = prng.nextRangeFloat(2.0, 10.0);
    const y = prng.nextRangeFloat(2.0, 18.0);
    const targetX = 38.0;
    const targetY = y; // Straight horizontal walking
    engine.spawnAgent(x, y, targetX, targetY);
  }

  // Step simulation for durationSeconds
  const dt = engine.DT;
  const totalSubsteps = Math.round(durationSeconds / dt);
  const observedSpeeds: number[] = [];

  for (let step = 0; step < totalSubsteps; step++) {
    engine.stepSubstep();

    // Sample speeds after initial relaxation (after 1.5 seconds)
    if (engine.simTime > 1.5 && step % 30 === 0) {
      for (let i = 0; i < engine.count; i++) {
        if (engine.active[i] === 1) {
          const spd = Math.hypot(engine.vx[i], engine.vy[i]);
          observedSpeeds.push(spd);
        }
      }
    }
  }

  if (observedSpeeds.length === 0) {
    return {
      agentCount,
      meanObservedSpeed: 0,
      expectedV0: 1.34,
      speedStandardDeviation: 0,
      minSpeed: 0,
      maxSpeed: 0,
      velocityError: 1.34,
      isWithinWeidmannBounds: false
    };
  }

  const sum = observedSpeeds.reduce((a, b) => a + b, 0);
  const mean = sum / observedSpeeds.length;
  const variance = observedSpeeds.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / observedSpeeds.length;
  const std = Math.sqrt(variance);
  const min = Math.min(...observedSpeeds);
  const max = Math.max(...observedSpeeds);
  const err = Math.abs(mean - 1.34);

  return {
    agentCount,
    meanObservedSpeed: Math.round(mean * 100) / 100,
    expectedV0: 1.34,
    speedStandardDeviation: Math.round(std * 100) / 100,
    minSpeed: Math.round(min * 100) / 100,
    maxSpeed: Math.round(max * 100) / 100,
    velocityError: Math.round(err * 1000) / 1000,
    isWithinWeidmannBounds: err <= 0.15
  };
}

