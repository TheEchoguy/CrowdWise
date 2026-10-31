/**
 * CROWDWISE — Experiment D: Counter-Flow & Lane Formation Experiments
 * Evaluates bidirectional movement across 3 controlled conditions:
 * 1. Forward-only (100% / 0%)
 * 2. Asymmetric counter-flow (75% / 25%)
 * 3. Symmetric head-on counter-flow (50% / 50%)
 *
 * References:
 * - Feliciani & Nishinari (2016), Empirical Analysis of Lane Formation
 * - Schadschneider & Seyfried (2011)
 */

import { SocialForceEngineCore } from '../../engine/SocialForceModel';
import { SeededPRNG } from '../../engine/prng';
import { CounterFlowAnalyzer, EvaluatedAgentVector } from '../engine/CounterFlowAnalyzer';
import { CounterFlowExperimentResult } from '../types/PhysicsValidationTypes';

export interface CounterFlowTestSuite {
  forwardOnly: CounterFlowExperimentResult;
  seventyFiveTwentyFive: CounterFlowExperimentResult;
  fiftyFifty: CounterFlowExperimentResult;
  isCapacityReductionEmergent: boolean;
  isLaneFormationDetected: boolean;
}

/**
 * Runs a single counter-flow trial with a specified reverse ratio in [0, 0.5]
 */
function runSingleCounterFlowTrial(
  forwardRatio: number,
  reverseRatio: number,
  baselineThroughput: number = 150,
  seed: number = 42
): CounterFlowExperimentResult {
  const totalAgents = 60;
  const corridorWidth = 6.0; // 6m wide corridor (allows lateral lane formation)
  const corridorLength = 24.0; // 24m long corridor

  const engine = new SocialForceEngineCore(corridorLength + 4, corridorWidth + 4, totalAgents + 10, seed);
  engine.init(seed);

  const prng = new SeededPRNG(seed);

  // Corridor walls along y = 1.0 and y = 7.0
  engine.addWall('top_wall', 0, 1.0, corridorLength, 1.0);
  engine.addWall('bot_wall', 0, 7.0, corridorLength, 7.0);

  const numReverse = Math.round(totalAgents * reverseRatio);
  const numForward = totalAgents - numReverse;

  const agentVectors: EvaluatedAgentVector[] = [];

  // Spawn Forward Agents: start at x in [2, 7], walking to x = 22
  for (let i = 0; i < numForward; i++) {
    const x = prng.nextRangeFloat(2.0, 7.0);
    const y = prng.nextRangeFloat(1.8, 6.2);
    const slot = engine.spawnAgent(x, y, 22.0, y, 0); // popType 0 = entering
    agentVectors.push({
      id: slot,
      x,
      y,
      vx: 0,
      vy: 0,
      intent: 'INGRESS'
    });
  }

  // Spawn Reverse Agents: start at x in [17, 22], walking to x = 2
  for (let i = 0; i < numReverse; i++) {
    const x = prng.nextRangeFloat(17.0, 22.0);
    const y = prng.nextRangeFloat(1.8, 6.2);
    const slot = engine.spawnAgent(x, y, 2.0, y, 1); // popType 1 = exiting / reverse
    agentVectors.push({
      id: slot,
      x,
      y,
      vx: 0,
      vy: 0,
      intent: 'REJECTED'
    });
  }

  // Duration set to 22.0s to allow steady-state passage across 24m corridor
  const durationSec = 22.0;
  const totalSubsteps = Math.round(durationSec / engine.DT);

  const prevX = new Float32Array(totalAgents + 10);
  let forwardClearances = 0;
  let reverseClearances = 0;
  const fwdVelocities: number[] = [];
  const revVelocities: number[] = [];
  const densities: number[] = [];
  let contacts = 0;
  let deadlockTicks = 0;
  let blockedAgentsCount = 0;

  for (let step = 0; step < totalSubsteps; step++) {
    for (let i = 0; i < engine.count; i++) {
      prevX[i] = engine.x[i];
    }

    engine.stepSubstep();

    // Sample every 10 substeps (12 Hz)
    if (step > Math.round(1.0 / engine.DT) && step % 10 === 0) {
      let activeMovingCount = 0;
      let blockedInStep = 0;

      for (let i = 0; i < engine.count; i++) {
        if (engine.active[i] === 1) {
          const spd = Math.hypot(engine.vx[i], engine.vy[i]);
          if (spd > 0.08) activeMovingCount++;

          const isFwd = i < numForward;
          if (isFwd) {
            fwdVelocities.push(spd);
            // Crossing forward exit or midpoint
            if (engine.x[i] >= 21.0) {
              forwardClearances++;
              engine.despawnAgent(i);
            }
          } else {
            revVelocities.push(spd);
            // Crossing reverse exit or midpoint
            if (engine.x[i] <= 3.0) {
              reverseClearances++;
              engine.despawnAgent(i);
            }
          }

          // Count physical contacts with other active agents
          for (let j = i + 1; j < engine.count; j++) {
            if (engine.active[j] === 1) {
              const d = Math.hypot(engine.x[i] - engine.x[j], engine.y[i] - engine.y[j]);
              if (d < engine.radius[i] + engine.radius[j]) {
                contacts++;
              }
            }
          }

          // In counter-flow encounter zone [8, 16], check if agent is blocked
          if (engine.x[i] >= 8.0 && engine.x[i] <= 16.0 && spd < 0.1) {
            blockedInStep++;
          }

          // Sync agent vector data for lane formation calculation
          if (i < agentVectors.length) {
            agentVectors[i].x = engine.x[i];
            agentVectors[i].y = engine.y[i];
            agentVectors[i].vx = engine.vx[i];
            agentVectors[i].vy = engine.vy[i];
          }
        }
      }

      if (blockedInStep > blockedAgentsCount) {
        blockedAgentsCount = blockedInStep;
      }

      // Local density across central encounter area x in [8, 16] (area = 8m * 6m = 48 m²)
      let centralAgents = 0;
      for (let i = 0; i < engine.count; i++) {
        if (engine.active[i] === 1 && engine.x[i] >= 8.0 && engine.x[i] <= 16.0) {
          centralAgents++;
        }
      }
      densities.push(centralAgents / 48.0);

      // Deadlock condition: heavy congestion in encounter zone with zero forward progress
      if (centralAgents >= 12 && activeMovingCount < 3) {
        deadlockTicks++;
      }
    }
  }

  const deadlockSec = Math.round(deadlockTicks * (10 * engine.DT) * 10) / 10;
  const laneOrderPhi = CounterFlowAnalyzer.computeLaneFormationOrder(agentVectors, corridorWidth);
  const activeNow = engine.count - forwardClearances - reverseClearances;

  return CounterFlowAnalyzer.buildExperimentResult(
    forwardRatio,
    reverseRatio,
    totalAgents,
    Math.max(0, activeNow),
    blockedAgentsCount,
    forwardClearances,
    reverseClearances,
    durationSec,
    fwdVelocities,
    revVelocities,
    densities,
    laneOrderPhi,
    contacts,
    deadlockSec,
    baselineThroughput
  );
}

export function runCounterFlowExperiments(seed: number = 42): CounterFlowTestSuite {
  // 1. Forward-only (100% / 0%)
  const forwardOnly = runSingleCounterFlowTrial(1.0, 0.0, 150, seed);

  // Use forward-only throughput as the empirical baseline for reduction calculations
  const baselineThru = Math.max(1, forwardOnly.netThroughputPerMin);

  // 2. 75% Forward / 25% Reverse
  const seventyFiveTwentyFive = runSingleCounterFlowTrial(0.75, 0.25, baselineThru, seed);

  // 3. 50% Forward / 50% Reverse
  const fiftyFifty = runSingleCounterFlowTrial(0.50, 0.50, baselineThru, seed);

  // Emergent capacity reduction verification: 50/50 net throughput <= forward-only
  const isEmergent =
    fiftyFifty.netThroughputPerMin <= forwardOnly.netThroughputPerMin &&
    fiftyFifty.forwardThroughputPerMin > 0 &&
    fiftyFifty.reverseThroughputPerMin > 0;

  // Lane formation verification: order parameter Phi >= 0.5 in counter-flow conditions
  const isLaneFormed =
    seventyFiveTwentyFive.laneFormationOrderParameter >= 0.50 ||
    fiftyFifty.laneFormationOrderParameter >= 0.50;

  return {
    forwardOnly,
    seventyFiveTwentyFive,
    fiftyFifty,
    isCapacityReductionEmergent: isEmergent,
    isLaneFormationDetected: isLaneFormed
  };
}
