/**
 * CROWDWISE — Counter-Flow and Lane Formation Analyzer
 * Evaluates bidirectional pedestrian flow, directional opposition, and natural lane formation
 *
 * References:
 * - Feliciani, C., & Nishinari, K. (2016). Empirical Analysis of Lane Formation in Bidirectional Pedestrian Flow.
 * - Schadschneider & Seyfried (2011). Empirical Data for Pedestrian Counterflow through Bottlenecks.
 */

import {
  DirectionalInteractionVector,
  CounterFlowExperimentResult,
  MovementIntent
} from '../types/PhysicsValidationTypes';

export interface EvaluatedAgentVector {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  intent: MovementIntent;
  routeId?: string;
}

export class CounterFlowAnalyzer {
  /**
   * Computes directional cosine between two pedestrian velocity vectors:
   * cos(theta) = (vi . vj) / (|vi| * |vj|)
   */
  public static computeCosineTheta(
    v1x: number,
    v1y: number,
    v2x: number,
    v2y: number
  ): number {
    const mag1 = Math.hypot(v1x, v1y);
    const mag2 = Math.hypot(v2x, v2y);
    if (mag1 < 1e-4 || mag2 < 1e-4) return 1.0; // Stationary considered neutral
    const dot = v1x * v2x + v1y * v2y;
    return Math.max(-1.0, Math.min(1.0, dot / (mag1 * mag2)));
  }

  /**
   * Classifies vector relationship into Same-Direction, Perpendicular, or Opposing
   */
  public static classifyInteraction(cosineTheta: number): 'SAME_DIRECTION' | 'PERPENDICULAR' | 'OPPOSING' {
    if (cosineTheta > 0.4) return 'SAME_DIRECTION';
    if (cosineTheta < -0.4) return 'OPPOSING';
    return 'PERPENDICULAR';
  }

  /**
   * Evaluates pairwise interaction vector between agent i and agent j
   */
  public static evaluatePairInteraction(
    ai: EvaluatedAgentVector,
    aj: EvaluatedAgentVector
  ): DirectionalInteractionVector {
    const cosTheta = this.computeCosineTheta(ai.vx, ai.vy, aj.vx, aj.vy);
    const interactionType = this.classifyInteraction(cosTheta);

    // Relative closing velocity along line of centers
    const dx = aj.x - ai.x;
    const dy = aj.y - ai.y;
    const dist = Math.hypot(dx, dy) || 1e-4;
    const nx = dx / dist;
    const ny = dy / dist;

    const relClosingVel = (ai.vx - aj.vx) * nx + (ai.vy - aj.vy) * ny;

    // Lateral displacement (perpendicular to agent i's motion)
    const spdi = Math.hypot(ai.vx, ai.vy) || 1e-4;
    const lateralX = -ai.vy / spdi;
    const lateralY = ai.vx / spdi;
    const lateralDisplacement = Math.abs(dx * lateralX + dy * lateralY);

    return {
      cosineTheta: Math.round(cosTheta * 1000) / 1000,
      interactionType,
      relativeClosingVelocity: Math.round(relClosingVel * 1000) / 1000,
      lateralDisplacement: Math.round(lateralDisplacement * 1000) / 1000
    };
  }

  /**
   * Computes the Lane Formation Order Parameter Phi in [0, 1]
   * (Feliciani & Nishinari 2016)
   * Phi = 1: Perfect lateral segregation (all forward agents grouped to one side, reverse to other)
   * Phi = 0: Disordered, intermixed collision state
   */
  public static computeLaneFormationOrder(
    agents: EvaluatedAgentVector[],
    corridorWidthMeters: number
  ): number {
    const active = agents.filter((a) => Math.hypot(a.vx, a.vy) > 0.05);
    if (active.length < 4 || corridorWidthMeters <= 0) return 0.5;

    let alignedCount = 0;
    let comparisons = 0;

    // Pairwise lateral proximity check
    for (let i = 0; i < active.length; i++) {
      const ai = active[i];
      const headingI = Math.sign(ai.vx || 1);

      for (let j = i + 1; j < active.length; j++) {
        const aj = active[j];
        const headingJ = Math.sign(aj.vx || 1);

        const latDist = Math.abs(ai.y - aj.y);
        // If sharing lateral space (< 1.2m lateral distance)
        if (latDist < 1.2) {
          comparisons++;
          // Aligned if moving in same direction when sharing lateral lane
          if (headingI === headingJ) {
            alignedCount++;
          }
        }
      }
    }

    if (comparisons === 0) return 0.5;
    const phi = alignedCount / comparisons;
    return Math.round(phi * 100) / 100;
  }

  /**
   * Summarizes results of a counter-flow experiment run with discrete forward/reverse counts
   */
  public static buildExperimentResult(
    forwardRatio: number,
    reverseRatio: number,
    totalPatrons: number,
    activeAgents: number,
    blockedAgents: number,
    forwardClearances: number,
    reverseClearances: number,
    durationSec: number,
    forwardVelocities: number[],
    reverseVelocities: number[],
    densities: number[],
    laneOrderPhi: number,
    contacts: number,
    deadlockDurationSec: number,
    baselineThroughputPerMin: number
  ): CounterFlowExperimentResult {
    const durationMin = Math.max(0.1, durationSec / 60);
    const forwardThroughput = Math.round(forwardClearances / durationMin);
    const reverseThroughput = Math.round(reverseClearances / durationMin);
    const netThroughput = forwardThroughput + reverseThroughput;

    const meanFwdVel =
      forwardVelocities.length > 0
        ? Math.round((forwardVelocities.reduce((a, b) => a + b, 0) / forwardVelocities.length) * 100) / 100
        : 0;

    const meanRevVel =
      reverseVelocities.length > 0
        ? Math.round((reverseVelocities.reduce((a, b) => a + b, 0) / reverseVelocities.length) * 100) / 100
        : 0;

    const meanDensity =
      densities.length > 0
        ? Math.round((densities.reduce((a, b) => a + b, 0) / densities.length) * 100) / 100
        : 0;

    // Emergent capacity reduction calculated directly from measured throughput vs forward-only baseline
    const safeBaseline = Math.max(1, baselineThroughputPerMin);
    const reductionPercent =
      netThroughput < safeBaseline
        ? Math.round(((safeBaseline - netThroughput) / safeBaseline) * 100)
        : 0;

    const laneStatus: 'STRONG_SEGREGATION' | 'PARTIAL_LANE_FORMATION' | 'UNORGANIZED_COLLISION' =
      laneOrderPhi >= 0.65
        ? 'STRONG_SEGREGATION'
        : laneOrderPhi >= 0.50
        ? 'PARTIAL_LANE_FORMATION'
        : 'UNORGANIZED_COLLISION';

    return {
      forwardRatio,
      reverseRatio,
      totalPedestrians: totalPatrons,
      activeAgents,
      blockedAgents,
      forwardThroughputPerMin: forwardThroughput,
      reverseThroughputPerMin: reverseThroughput,
      netThroughputPerMin: netThroughput,
      meanForwardVelocity: meanFwdVel,
      meanReverseVelocity: meanRevVel,
      meanLocalDensity: meanDensity,
      laneFormationOrderParameter: laneOrderPhi,
      laneFormationStatus: laneStatus,
      collisionContactCount: contacts,
      deadlockDurationSec,
      capacityReductionPercent: reductionPercent
    };
  }
}
