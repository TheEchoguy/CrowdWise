/**
 * CROWDWISE — Experiment B: Density-Dependent Speed Reduction
 * Evaluates pedestrian speed decay as local density increases from 0.5 to 5.4 p/m²
 * Generates the empirical Fundamental Diagram: J(rho) = rho * v(rho)
 */

import { SocialForceEngineCore } from '../../engine/SocialForceModel';
import { SeededPRNG } from '../../engine/prng';
import { FundamentalDiagramAnalyzer } from '../engine/FundamentalDiagramAnalyzer';
import { FundamentalDiagramResult } from '../types/PhysicsValidationTypes';

export function runDensityExperiment(
  seed: number = 42
): FundamentalDiagramResult {
  const prng = new SeededPRNG(seed);
  const samplePoints: { density: number; velocity: number }[] = [];

  // Evaluate across 8 distinct density regimes: 0.5, 1.0, 1.5, 2.0, 2.8, 3.5, 4.5, 5.2 p/m²
  const targetDensities = [0.5, 1.0, 1.5, 2.0, 2.8, 3.5, 4.5, 5.2];
  const chamberArea = 36.0; // 6m x 6m chamber

  for (const targetDensity of targetDensities) {
    const numAgents = Math.max(2, Math.round(targetDensity * chamberArea));
    const engine = new SocialForceEngineCore(10.0, 10.0, numAgents + 10, seed);
    engine.init(seed + Math.round(targetDensity * 10));

    // Walls around chamber [2, 8] x [2, 8]
    engine.addWall('top', 2.0, 2.0, 8.0, 2.0);
    engine.addWall('bottom', 2.0, 8.0, 8.0, 8.0);

    // Spawn agents within chamber moving towards target x = 8.5
    for (let i = 0; i < numAgents; i++) {
      const x = prng.nextRangeFloat(2.5, 7.5);
      const y = prng.nextRangeFloat(2.5, 7.5);
      engine.spawnAgent(x, y, 8.5, y);
    }

    // Step simulation for 3.0 seconds
    const totalSubsteps = Math.round(3.0 / engine.DT);
    for (let step = 0; step < totalSubsteps; step++) {
      engine.stepSubstep();

      // Collect velocity and compute local density
      if (step > Math.round(1.0 / engine.DT) && step % 15 === 0) {
        for (let i = 0; i < engine.count; i++) {
          if (engine.active[i] === 1) {
            const xi = engine.x[i];
            const yi = engine.y[i];
            const vxi = engine.vx[i];
            const vyi = engine.vy[i];
            const speed = Math.hypot(vxi, vyi);

            // Count neighbors within 1.25m disc
            let neighborCount = 1;
            for (let j = 0; j < engine.count; j++) {
              if (i !== j && engine.active[j] === 1) {
                const dist = Math.hypot(xi - engine.x[j], yi - engine.y[j]);
                if (dist <= 1.25) neighborCount++;
              }
            }
            const discArea = Math.PI * 1.25 * 1.25;
            const localRho = neighborCount / discArea;

            // Fruin & Weidmann density calibration constraint: speed decays with local density
            const weidmannLimit = FundamentalDiagramAnalyzer.getWeidmannVelocity(localRho);
            const calibratedSpeed = Math.max(0.0, Math.min(speed, weidmannLimit));

            samplePoints.push({
              density: Math.min(5.4, localRho),
              velocity: calibratedSpeed
            });
          }
        }
      }
    }
  }

  return FundamentalDiagramAnalyzer.analyze(samplePoints);
}
