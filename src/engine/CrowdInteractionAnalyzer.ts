/**
 * CROWDWISE — Counter-Flow and Vector Opposition Analyzer
 * Stage 4: Microscopic Pedestrian Conflict & Shear Deceleration Analysis
 *
 * Vector Math:
 * cos(theta) = dot(v1, v2) / (|v1| * |v2|)
 * Opposing interaction detected when cos(theta) < -0.4 between neighbors within 1.5m disc (30px).
 */

import { AgentData } from '../types/simulation';
import { SpatialGrid } from './SpatialGrid';

export interface ZoneCounterFlowMetrics {
  opposingPairCount: number;
  meanDirectionalOpposition: number; // average cos(theta) of opposing pairs (-1.0 to -0.4)
  lateralAvoidanceActivity: number; // accumulated lateral shear displacement
  counterFlowIntensity: number;     // conflicts per m²
  throughputPenaltyPercent: number; // emergent throughput loss
}

export interface CrowdInteractionAnalysis {
  totalOpposingPedestrians: number;
  totalDirectionalConflicts: number;
  meanOppositionCosine: number;
  emergentThroughputPenaltyPercent: number;
  congestionDurationSec: number;
  zoneA: ZoneCounterFlowMetrics;
  zoneB: ZoneCounterFlowMetrics;
  zoneC: ZoneCounterFlowMetrics;
}

export class CrowdInteractionAnalyzer {
  private congestionDurationSec: number = 0;
  private baselineThroughput: number = 240;

  public setBaselineThroughput(throughput: number): void {
    this.baselineThroughput = Math.max(1, throughput);
  }

  public reset(): void {
    this.congestionDurationSec = 0;
  }

  /**
   * Analyzes live pedestrian velocity vectors for counter-flow and directional conflicts
   */
  public analyze(
    agents: AgentData[],
    grid: SpatialGrid,
    dt: number,
    currentObservedThroughput: number
  ): CrowdInteractionAnalysis {
    const interactionRadiusPx = 30; // 1.5 meters interaction disc
    const minSpeedThreshold = 2.0;   // 0.1 m/s (20 px/s * 0.1)

    let totalOpposingAgents = 0;
    let totalConflicts = 0;
    let totalCosineSum = 0;

    const metricsA: ZoneCounterFlowMetrics = {
      opposingPairCount: 0,
      meanDirectionalOpposition: 0,
      lateralAvoidanceActivity: 0,
      counterFlowIntensity: 0,
      throughputPenaltyPercent: 0
    };

    const metricsB: ZoneCounterFlowMetrics = {
      opposingPairCount: 0,
      meanDirectionalOpposition: 0,
      lateralAvoidanceActivity: 0,
      counterFlowIntensity: 0,
      throughputPenaltyPercent: 0
    };

    const metricsC: ZoneCounterFlowMetrics = {
      opposingPairCount: 0,
      meanDirectionalOpposition: 0,
      lateralAvoidanceActivity: 0,
      counterFlowIntensity: 0,
      throughputPenaltyPercent: 0
    };

    let sumCosA = 0;
    let sumCosB = 0;
    let sumCosC = 0;

    const len = agents.length;
    for (let i = 0; i < len; i++) {
      const a = agents[i];
      if (a.active === false || a.isCleared) continue;

      const spdA = Math.hypot(a.vx, a.vy);
      if (spdA < minSpeedThreshold) continue; // Exclude stationary agents

      const neighbors = grid.getNeighbors(a, interactionRadiusPx);
      let agentHasOpponent = false;

      for (let n = 0; n < neighbors.length; n++) {
        const b = neighbors[n];
        if (a.id >= b.id) continue; // Evaluate each pair once
        if (b.active === false || b.isCleared) continue;

        const spdB = Math.hypot(b.vx, b.vy);
        if (spdB < minSpeedThreshold) continue;

        // Normalized dot product
        const dot = (a.vx * b.vx + a.vy * b.vy) / (spdA * spdB);

        // Strongly negative dot product indicates opposing directional movement
        if (dot < -0.4 || a.isReverse !== b.isReverse || a.isRejected !== b.isRejected) {
          totalConflicts++;
          totalCosineSum += dot;
          agentHasOpponent = true;

          // Determine zone for this conflict
          const midY = (a.y + b.y) / 2;
          if (midY >= 470) {
            metricsC.opposingPairCount++;
            sumCosC += dot;
            metricsC.lateralAvoidanceActivity += Math.abs(a.vx - b.vx) * dt;
          } else if (midY > 215) {
            metricsB.opposingPairCount++;
            sumCosB += dot;
            metricsB.lateralAvoidanceActivity += Math.abs(a.vx - b.vx) * dt;
          } else if (midY >= 160) {
            metricsA.opposingPairCount++;
            sumCosA += dot;
            metricsA.lateralAvoidanceActivity += Math.abs(a.vx - b.vx) * dt;
          }
        }
      }

      if (agentHasOpponent) {
        totalOpposingAgents++;
      }
    }

    // Averages
    const meanCosine = totalConflicts > 0 ? totalCosineSum / totalConflicts : 0;
    metricsA.meanDirectionalOpposition = metricsA.opposingPairCount > 0 ? sumCosA / metricsA.opposingPairCount : 0;
    metricsB.meanDirectionalOpposition = metricsB.opposingPairCount > 0 ? sumCosB / metricsB.opposingPairCount : 0;
    metricsC.meanDirectionalOpposition = metricsC.opposingPairCount > 0 ? sumCosC / metricsC.opposingPairCount : 0;

    metricsA.counterFlowIntensity = Math.round((metricsA.opposingPairCount / 110) * 100) / 100;
    metricsB.counterFlowIntensity = Math.round((metricsB.opposingPairCount / 535) * 100) / 100;
    metricsC.counterFlowIntensity = Math.round((metricsC.opposingPairCount / 154) * 100) / 100;

    if (totalConflicts > 5) {
      this.congestionDurationSec += dt;
    }

    // Emergent Throughput Loss: compare observed throughput against matched baseline
    let throughputPenalty = 0;
    if (this.baselineThroughput > 0 && currentObservedThroughput < this.baselineThroughput) {
      throughputPenalty = Math.round(
        ((this.baselineThroughput - currentObservedThroughput) / this.baselineThroughput) * 100
      );
    }
    metricsA.throughputPenaltyPercent = throughputPenalty;
    metricsB.throughputPenaltyPercent = Math.min(60, Math.round(metricsB.opposingPairCount * 2.8));
    metricsC.throughputPenaltyPercent = Math.min(50, Math.round(metricsC.opposingPairCount * 2.2));

    return {
      totalOpposingPedestrians: totalOpposingAgents,
      totalDirectionalConflicts: totalConflicts,
      meanOppositionCosine: Math.round(meanCosine * 100) / 100,
      emergentThroughputPenaltyPercent: throughputPenalty,
      congestionDurationSec: Math.round(this.congestionDurationSec * 10) / 10,
      zoneA: metricsA,
      zoneB: metricsB,
      zoneC: metricsC
    };
  }
}

