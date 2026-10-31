/**
 * CROWDWISE — Predictive Congestion & Queue Projection Engine
 * Phase 4: Safety Intelligence & Operational Decision Support
 * M. Chinnaswamy Stadium, Bengaluru
 *
 * Implements deterministic near-future queue and spatial density forecasting:
 * Q(t + Δt) = max(0, Q(t) + (λ - μ) × (Δt / 60))
 * Supplemented with spatial density propagation, turnstile saturation time,
 * public road spillback estimation, and Poisson process uncertainty bounds.
 */

export type PredictionHorizonSec = 30 | 60 | 120 | 300;
export type CongestionWarningLevel = 'NORMAL' | 'WATCH' | 'CONGESTED' | 'CRITICAL';

export interface PredictiveGateStateInput {
  gateId: string;
  currentQueue: number;
  arrivalRatePerMin: number;       // λ
  effectiveCapacityPerMin: number; // μ
  currentThroatDensity: number;    // p/m²
  currentApproachDensity: number;  // p/m²
  currentSpillbackMeters: number;  // meters onto public road
  holdingAreaCapacity: number;     // max buffer before overflow
  throatAreaM2?: number;           // default 80 m²
  holdingAreaM2?: number;          // default 250 m²
  approachAreaM2?: number;         // default 120 m²
  counterFlowActive?: boolean;
}

export interface GateForecastResult {
  horizonSeconds: PredictionHorizonSec;
  predictedQueue: number;
  queueDelta: number;
  uncertaintyMargin: number;       // ± σ
  predictedQueueLower: number;
  predictedQueueUpper: number;
  turnstileUtilizationPercent: number;
  timeToSaturationSec: number | null; // null if stable or emptying
  predictedThroatDensity: number;
  predictedHoldingDensity: number;
  predictedRoadSpillbackMeters: number;
  warningLevel: CongestionWarningLevel;
  isHoldingOverflowPredicted: boolean;
  isPublicRoadSpillbackPredicted: boolean;
  summaryText: string;
}

export interface StadiumWideForecast {
  timestamp: string;
  horizonSeconds: PredictionHorizonSec;
  totalWaitingCurrent: number;
  totalWaitingPredicted: number;
  netQueueGrowthRatePerMin: number;
  overallWarningLevel: CongestionWarningLevel;
  criticalGates: string[];
  watchGates: string[];
  gateForecasts: Record<string, GateForecastResult>;
  forecastAssumptions: string[];
}

export class PredictiveCongestionEngine {
  /**
   * Projects queue population and spatial density for an individual gate.
   */
  public static forecastGate(
    input: PredictiveGateStateInput,
    horizon: PredictionHorizonSec = 60
  ): GateForecastResult {
    const throatArea = input.throatAreaM2 || 80;
    const holdingArea = input.holdingAreaM2 || 250;
    const holdingCap = input.holdingAreaCapacity || 500;

    const lambda = Math.max(0, input.arrivalRatePerMin);
    const mu = Math.max(1, input.effectiveCapacityPerMin);
    const horizonMin = horizon / 60;

    // Net growth rate (people/min)
    const netRate = lambda - mu;

    // Linear projection with zero-floor: Q(t + Δt) = max(0, Q(t) + (λ - μ) × Δt)
    const projectedQueue = Math.max(0, Math.round(input.currentQueue + netRate * horizonMin));
    const queueDelta = projectedQueue - input.currentQueue;

    // Poisson uncertainty bound: σ ≈ 1.28 × √(λ × Δt_min) (80% confidence interval)
    const sigma = Math.max(1, Math.round(1.28 * Math.sqrt(Math.max(1, lambda * horizonMin))));
    const predictedQueueLower = Math.max(0, projectedQueue - sigma);
    const predictedQueueUpper = projectedQueue + sigma;

    // Turnstile Utilization: (λ / μ) × 100%
    const utilization = Math.min(200, Math.round((lambda / mu) * 100));

    // Time to Saturation: seconds until holding area buffer is breached
    let timeToSaturation: number | null = null;
    if (netRate > 0) {
      const remainingHoldingSpace = Math.max(0, holdingCap - input.currentQueue);
      timeToSaturation = Math.round((remainingHoldingSpace / netRate) * 60);
    }

    // Spatial Density Projections:
    // Throat density scales directly with queued spectators waiting in throat area
    const throatQueuers = Math.min(projectedQueue, Math.round(throatArea * 2.5));
    const predictedThroatDensity = Math.round(
      Math.min(6.0, Math.max(0.2, (throatQueuers / throatArea) + 0.3)) * 10
    ) / 10;

    // Holding concourse density scales with excess queue in Zone B
    const concourseQueuers = Math.max(0, projectedQueue - throatQueuers);
    const predictedHoldingDensity = Math.round(
      Math.min(5.5, Math.max(0.1, (concourseQueuers / holdingArea) + 0.2)) * 10
    ) / 10;

    // Public road spillback: begins when concourse exceeds holding capacity
    let predictedRoadSpillback = input.currentSpillbackMeters;
    const isOverflow = projectedQueue > holdingCap;
    if (isOverflow) {
      const overflowCount = projectedQueue - holdingCap;
      predictedRoadSpillback = Math.round((overflowCount * 0.08) * 10) / 10; // ~0.08m queue depth per spectator
    } else if (netRate < 0 && input.currentSpillbackMeters > 0) {
      predictedRoadSpillback = Math.max(0, Math.round((input.currentSpillbackMeters - (Math.abs(netRate) * horizonMin * 0.05)) * 10) / 10);
    }

    const isRoadSpillback = predictedRoadSpillback > 2.0;

    // Warning Level Classification:
    let warningLevel: CongestionWarningLevel = 'NORMAL';
    if (
      predictedThroatDensity >= 3.0 ||
      predictedHoldingDensity >= 3.0 ||
      predictedRoadSpillback >= 10.0 ||
      projectedQueue >= 200
    ) {
      warningLevel = 'CRITICAL';
    } else if (
      predictedThroatDensity >= 2.2 ||
      predictedHoldingDensity >= 2.2 ||
      netRate >= 25 ||
      utilization >= 115 ||
      isOverflow
    ) {
      warningLevel = 'CONGESTED';
    } else if (
      predictedThroatDensity >= 1.5 ||
      predictedHoldingDensity >= 1.5 ||
      utilization >= 85 ||
      netRate > 5
    ) {
      warningLevel = 'WATCH';
    }

    // Explanatory summary text
    let summaryText = `Steady laminar flow. Net rate: ${netRate > 0 ? '+' : ''}${netRate} p/min.`;
    if (warningLevel === 'CRITICAL') {
      summaryText = `CRITICAL SURGE: Projected +${queueDelta} queuers in ${horizon}s. Risk of compression exceeding 3.0 p/m².`;
    } else if (warningLevel === 'CONGESTED') {
      summaryText = `CONGESTION WATCH: Arrival demand exceeds processing capacity by ${netRate} p/min (utilization: ${utilization}%).`;
    } else if (warningLevel === 'WATCH') {
      summaryText = `Approaching capacity limit. Utilization at ${utilization}%.`;
    }

    return {
      horizonSeconds: horizon,
      predictedQueue: projectedQueue,
      queueDelta,
      uncertaintyMargin: sigma,
      predictedQueueLower,
      predictedQueueUpper,
      turnstileUtilizationPercent: utilization,
      timeToSaturationSec: timeToSaturation,
      predictedThroatDensity,
      predictedHoldingDensity,
      predictedRoadSpillbackMeters: predictedRoadSpillback,
      warningLevel,
      isHoldingOverflowPredicted: isOverflow,
      isPublicRoadSpillbackPredicted: isRoadSpillback,
      summaryText
    };
  }

  /**
   * Aggregates predictive safety forecasts across all outer and inner gates in the stadium.
   */
  public static forecastStadium(
    gates: PredictiveGateStateInput[],
    horizon: PredictionHorizonSec = 60
  ): StadiumWideForecast {
    let totalCurrent = 0;
    let totalPredicted = 0;
    let netGrowthSum = 0;
    const criticalGates: string[] = [];
    const watchGates: string[] = [];
    const gateForecasts: Record<string, GateForecastResult> = {};

    gates.forEach((g) => {
      totalCurrent += g.currentQueue;
      const forecast = this.forecastGate(g, horizon);
      gateForecasts[g.gateId] = forecast;
      totalPredicted += forecast.predictedQueue;
      netGrowthSum += (g.arrivalRatePerMin - g.effectiveCapacityPerMin);

      if (forecast.warningLevel === 'CRITICAL') {
        criticalGates.push(g.gateId);
      } else if (forecast.warningLevel === 'CONGESTED' || forecast.warningLevel === 'WATCH') {
        watchGates.push(g.gateId);
      }
    });

    let overallWarningLevel: CongestionWarningLevel = 'NORMAL';
    if (criticalGates.length > 0 || (totalPredicted - totalCurrent) > 150) {
      overallWarningLevel = 'CRITICAL';
    } else if (watchGates.length >= 2 || (totalPredicted - totalCurrent) > 50) {
      overallWarningLevel = 'CONGESTED';
    } else if (watchGates.length > 0) {
      overallWarningLevel = 'WATCH';
    }

    return {
      timestamp: new Date().toISOString(),
      horizonSeconds: horizon,
      totalWaitingCurrent: totalCurrent,
      totalWaitingPredicted: totalPredicted,
      netQueueGrowthRatePerMin: Math.round(netGrowthSum),
      overallWarningLevel,
      criticalGates,
      watchGates,
      gateForecasts,
      forecastAssumptions: [
        `Deterministic queue conservation model: Q(t+Δt) = max(0, Q(t) + (λ - μ) × Δt)`,
        `Arrival rate λ and service rate μ held constant over ${horizon}s forecasting window`,
        `Poisson process uncertainty interval ±σ based on square-root arrival variance`,
        `Concourse overflow threshold calibrated to KSCA structural holding buffers`
      ]
    };
  }
}

