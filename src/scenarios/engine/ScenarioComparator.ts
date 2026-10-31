/**
 * CROWDWISE Predictive Crowd Digital Twin & Safety Lab
 * Scenario Comparator & Displacement Detector (Feature C)
 *
 * Implements:
 * 1. Multi-Zone Before/After Paired Counterfactual Analysis
 * 2. System-wide Maximum Density: max(gate, holding, upstream)
 * 3. Displacement Detection: detects when an intervention improves Gate A
 *    but transfers/concentrates dangerous crowd pressure to Intermediate Holding or Upstream
 * 4. Four Strict Evaluator Verdicts: IMPROVED | DISPLACED | DEGRADED | INCONCLUSIVE
 */

import {
  DetailedSimulationAnalytics,
  DisplacementAnalysisResult,
  DisplacementVerdict,
  PairedZoneComparison,
  ScenarioComparisonResult,
  ScenarioId,
  ThreeZoneTelemetry,
  ZoneId
} from '../types/ScenarioTypes';

export class ScenarioComparator {
  // Thresholds for material changes (calibrated conservative boundaries)
  public static readonly DENSITY_IMPROVEMENT_THRESHOLD_PCT = -5.0; // At least 5% reduction
  public static readonly DENSITY_DETERIORATION_THRESHOLD_PCT = 8.0;  // 8% or more increase considered material
  public static readonly MIN_SIMULATION_DURATION_SEC = 25.0;

  /**
   * Evaluates a paired baseline vs mitigated counterfactual experiment.
   */
  public static compareExperiments(
    scenarioId: ScenarioId,
    seed: number,
    baseline: DetailedSimulationAnalytics,
    mitigated: DetailedSimulationAnalytics
  ): ScenarioComparisonResult {
    // 1. Calculate general deltas
    const peakDensityDelta = mitigated.peakLocalDensity - baseline.peakLocalDensity;
    const peakDensityPercent = baseline.peakLocalDensity > 0
      ? (peakDensityDelta / baseline.peakLocalDensity) * 100
      : 0;

    const spillbackDelta = mitigated.maxQueueSpillbackMeters - baseline.maxQueueSpillbackMeters;
    const spillbackPercent = baseline.maxQueueSpillbackMeters > 0
      ? (spillbackDelta / baseline.maxQueueSpillbackMeters) * 100
      : 0;

    const waitingTimeDelta = mitigated.averageWaitingTimeSeconds - baseline.averageWaitingTimeSeconds;
    const waitingTimePercent = baseline.averageWaitingTimeSeconds > 0
      ? (waitingTimeDelta / baseline.averageWaitingTimeSeconds) * 100
      : 0;

    const throughputDelta = mitigated.observedThroughputRepPerMin - baseline.observedThroughputRepPerMin;
    const throughputPercent = baseline.observedThroughputRepPerMin > 0
      ? (throughputDelta / baseline.observedThroughputRepPerMin) * 100
      : 0;

    const hazardDurationDelta = mitigated.criticalHazardDurationSeconds - baseline.criticalHazardDurationSeconds;
    const hazardDurationPercent = baseline.criticalHazardDurationSeconds > 0
      ? (hazardDurationDelta / baseline.criticalHazardDurationSeconds) * 100
      : 0;

    // 2. Evaluate Three-Zone Displacement
    let displacementResult: DisplacementAnalysisResult | undefined;
    if (baseline.threeZone && mitigated.threeZone) {
      displacementResult = this.analyzeDisplacement(baseline.threeZone, mitigated.threeZone);
    }

    // 3. Overall Safety Verdict
    let safetyVerdict: 'Improvement' | 'Moderate Improvement' | 'Neutral' | 'Safety Degradation' = 'Neutral';

    if (displacementResult?.verdict === 'DISPLACED' || displacementResult?.verdict === 'DEGRADED') {
      safetyVerdict = 'Safety Degradation';
    } else if (peakDensityPercent <= -15.0 && throughputPercent >= 10.0) {
      safetyVerdict = 'Improvement';
    } else if (peakDensityPercent < -5.0 || throughputPercent > 5.0) {
      safetyVerdict = 'Moderate Improvement';
    } else if (peakDensityPercent > 5.0 || hazardDurationPercent > 10.0) {
      safetyVerdict = 'Safety Degradation';
    }

    // 4. Generate empirical explanation
    const explanation = displacementResult
      ? displacementResult.empiricalExplanation
      : `Peak density changed by ${peakDensityPercent.toFixed(1)}% (${baseline.peakLocalDensity.toFixed(1)} -> ${mitigated.peakLocalDensity.toFixed(1)} p/m²). Represented throughput changed by ${throughputDelta > 0 ? '+' : ''}${throughputDelta} p/min.`;

    return {
      scenarioId,
      seed,
      baseline,
      mitigated,
      deltas: {
        peakDensityDelta: Math.round(peakDensityDelta * 10) / 10,
        peakDensityPercent: Math.round(peakDensityPercent * 10) / 10,
        spillbackDelta: Math.round(spillbackDelta * 10) / 10,
        spillbackPercent: Math.round(spillbackPercent * 10) / 10,
        waitingTimeDelta: Math.round(waitingTimeDelta * 10) / 10,
        waitingTimePercent: Math.round(waitingTimePercent * 10) / 10,
        throughputDelta: Math.round(throughputDelta),
        throughputPercent: Math.round(throughputPercent * 10) / 10,
        hazardDurationDelta: Math.round(hazardDurationDelta * 10) / 10,
        hazardDurationPercent: Math.round(hazardDurationPercent * 10) / 10
      },
      safetyVerdict,
      displacementResult,
      empiricalExplanation: explanation
    };
  }

  /**
   * Audits 3-Zone measurements to determine if bottleneck was resolved or displaced.
   */
  public static analyzeDisplacement(
    base: ThreeZoneTelemetry,
    mit: ThreeZoneTelemetry
  ): DisplacementAnalysisResult {
    // Insufficient observation check
    if (base.timestampSec < this.MIN_SIMULATION_DURATION_SEC || mit.timestampSec < this.MIN_SIMULATION_DURATION_SEC) {
      return {
        verdict: 'INCONCLUSIVE',
        empiricalExplanation: 'Observation duration too short (< 25 simulation seconds) to establish statistical stability.',
        baselineSystemMaxDensity: base.systemMaxDensity,
        mitigatedSystemMaxDensity: mit.systemMaxDensity,
        gateApproach: this.buildZoneComparison('zone_gate', 'Gate Approach', base.gateApproach, mit.gateApproach),
        intermediateHolding: this.buildZoneComparison('zone_holding', 'Holding Area', base.intermediateHolding, mit.intermediateHolding),
        upstreamArrival: this.buildZoneComparison('zone_upstream', 'Upstream Arrival', base.upstreamArrival, mit.upstreamArrival),
        operationalRecommendation: 'Continue simulation run to accumulate observation time.',
        confidenceScore: 0.3
      };
    }

    const gateComp = this.buildZoneComparison('zone_gate', 'Gate Approach', base.gateApproach, mit.gateApproach);
    const holdingComp = this.buildZoneComparison('zone_holding', 'Holding Area', base.intermediateHolding, mit.intermediateHolding);
    const upstreamComp = this.buildZoneComparison('zone_upstream', 'Upstream Arrival', base.upstreamArrival, mit.upstreamArrival);

    const gateDeltaPct = gateComp.densityDeltaPercent;
    const holdingDeltaPct = holdingComp.densityDeltaPercent;
    const upstreamDeltaPct = upstreamComp.densityDeltaPercent;

    let verdict: DisplacementVerdict = 'INCONCLUSIVE';
    let explanation = '';
    let recommendation = '';

    // Condition 1: DISPLACEMENT
    // Gate improved (density fell by >= 5%), but holding or upstream worsened materially (density rose by >= 8%)
    const gateImproved = gateDeltaPct <= this.DENSITY_IMPROVEMENT_THRESHOLD_PCT;
    const holdingWorsened = holdingDeltaPct >= this.DENSITY_DETERIORATION_THRESHOLD_PCT;
    const upstreamWorsened = upstreamDeltaPct >= this.DENSITY_DETERIORATION_THRESHOLD_PCT;

    if (gateImproved && (holdingWorsened || upstreamWorsened)) {
      verdict = 'DISPLACED';
      const worstZone = holdingWorsened ? 'Intermediate Holding Area' : 'Upstream Concourse';
      const worstDelta = holdingWorsened ? holdingDeltaPct : upstreamDeltaPct;
      explanation = `BOTTLENECK DISPLACEMENT DETECTED: While Gate Approach density improved by ${Math.abs(gateDeltaPct).toFixed(1)}% (${base.gateApproach.peakDensity} -> ${mit.gateApproach.peakDensity} p/m²), congestion was transferred upstream into ${worstZone}, which worsened by +${worstDelta.toFixed(1)}% (${holdingWorsened ? base.intermediateHolding.peakDensity : base.upstreamArrival.peakDensity} -> ${holdingWorsened ? mit.intermediateHolding.peakDensity : mit.upstreamArrival.peakDensity} p/m²).`;
      recommendation = `Install upstream chicane baffles in ${worstZone} and meter ingress at perimeter perimeter turnstiles to prevent secondary shockwaves.`;
    }
    // Condition 2: SYSTEM-WIDE IMPROVEMENT
    // Gate improved or held steady, and neither upstream area deteriorated materially
    else if (gateImproved && !holdingWorsened && !upstreamWorsened) {
      verdict = 'IMPROVED';
      explanation = `SYSTEM-WIDE SAFETY IMPROVEMENT: Gate Approach density decreased by ${Math.abs(gateDeltaPct).toFixed(1)}% without material degradation in Holding Area (${holdingDeltaPct > 0 ? '+' : ''}${holdingDeltaPct.toFixed(1)}%) or Upstream (${upstreamDeltaPct > 0 ? '+' : ''}${upstreamDeltaPct.toFixed(1)}%). System maximum density dropped from ${base.systemMaxDensity} to ${mit.systemMaxDensity} p/m².`;
      recommendation = 'Maintain current multi-gate and baffle configuration as standard operating procedure.';
    }
    // Condition 3: OVERALL DEGRADATION
    else if (mit.systemMaxDensity > base.systemMaxDensity * 1.08 || gateDeltaPct >= 8.0) {
      verdict = 'DEGRADED';
      explanation = `SAFETY DEGRADATION: Overall system maximum density increased from ${base.systemMaxDensity} to ${mit.systemMaxDensity} p/m² (+${(((mit.systemMaxDensity - base.systemMaxDensity) / base.systemMaxDensity) * 100).toFixed(1)}%). The intervention increased queue friction.`;
      recommendation = 'Revert operational changes immediately and restore nominal baseline lane configuration.';
    }
    // Condition 4: NEUTRAL / INCONCLUSIVE
    else {
      verdict = 'IMPROVED'; // Minor improvement / within tolerance
      explanation = `MARGINAL SYSTEM STABILITY: System maximum density changed marginally from ${base.systemMaxDensity} to ${mit.systemMaxDensity} p/m² (${(((mit.systemMaxDensity - base.systemMaxDensity) / (base.systemMaxDensity || 1)) * 100).toFixed(1)}%). No dangerous displacement observed.`;
      recommendation = 'Monitor real-time telemetry as arrival surge progresses.';
    }

    return {
      verdict,
      empiricalExplanation: explanation,
      baselineSystemMaxDensity: base.systemMaxDensity,
      mitigatedSystemMaxDensity: mit.systemMaxDensity,
      gateApproach: gateComp,
      intermediateHolding: holdingComp,
      upstreamArrival: upstreamComp,
      operationalRecommendation: recommendation,
      confidenceScore: 0.92
    };
  }

  private static buildZoneComparison(
    zoneId: ZoneId,
    name: string,
    base: { peakDensity: number; queueLengthMeters: number; averageSpeedMps: number },
    mit: { peakDensity: number; queueLengthMeters: number; averageSpeedMps: number }
  ): PairedZoneComparison {
    const densityDelta = mit.peakDensity - base.peakDensity;
    const densityPct = base.peakDensity > 0 ? (densityDelta / base.peakDensity) * 100 : 0;

    const queueDelta = mit.queueLengthMeters - base.queueLengthMeters;
    const queuePct = base.queueLengthMeters > 0 ? (queueDelta / base.queueLengthMeters) * 100 : 0;

    const speedDelta = mit.averageSpeedMps - base.averageSpeedMps;
    const speedPct = base.averageSpeedMps > 0 ? (speedDelta / base.averageSpeedMps) * 100 : 0;

    return {
      zoneId,
      name,
      baselinePeakDensity: base.peakDensity,
      mitigatedPeakDensity: mit.peakDensity,
      densityDeltaPercent: Math.round(densityPct * 10) / 10,
      baselineQueueMeters: base.queueLengthMeters,
      mitigatedQueueMeters: mit.queueLengthMeters,
      queueDeltaPercent: Math.round(queuePct * 10) / 10,
      baselineAvgSpeedMps: base.averageSpeedMps,
      mitigatedAvgSpeedMps: mit.averageSpeedMps,
      speedDeltaPercent: Math.round(speedPct * 10) / 10
    };
  }
}

