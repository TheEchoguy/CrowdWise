/**
 * CROWDWISE — Displaced Risk & Comparative Experiment Detector
 * Stage 6: Matched Baseline vs. Intervention Multi-Zone Comparison
 *
 * Runs Matched Comparative Telemetry:
 * Run A (Baseline: no intervention) vs. Run B (Intervention: active safety mitigation)
 * Under identical random seeds, schedules, and duration.
 */

import { ZoneTelemetrySnapshot } from './ThreeZoneMonitor';

export interface ZoneDeltaMetrics {
  zoneId: string;
  name: string;
  baselineDensity: number;
  interventionDensity: number;
  absoluteDensityDelta: number;
  percentageDensityDelta: number;

  baselineHazardDurationSec: number;
  interventionHazardDurationSec: number;
  hazardDurationDeltaSec: number;

  baselineQueue: number;
  interventionQueue: number;
  queueDelta: number;

  baselineThroughput: number;
  interventionThroughput: number;
  throughputDelta: number;

  isDeteriorated: boolean;
  isImproved: boolean;
}

export interface ComparativeAuditReport {
  sampleDurationSec: number;
  zoneADelta: ZoneDeltaMetrics;
  zoneBDelta: ZoneDeltaMetrics;
  zoneCDelta: ZoneDeltaMetrics;
  overallThroughputImpactPercent: number;
  isDisplacementDetected: boolean;
  displacedSourceZone?: string;
  displacedTargetZone?: string;
  explanation: string;
}

export class DisplacementDetector {
  /**
   * Compares Matched Baseline vs Intervention Snapshots across all three zones
   */
  public static compare(
    baselineA: ZoneTelemetrySnapshot,
    baselineB: ZoneTelemetrySnapshot,
    baselineC: ZoneTelemetrySnapshot,
    intervA: ZoneTelemetrySnapshot,
    intervB: ZoneTelemetrySnapshot,
    intervC: ZoneTelemetrySnapshot,
    sampleDurationSec: number = 30
  ): ComparativeAuditReport {
    const deltaA = this.computeZoneDelta(baselineA, intervA);
    const deltaB = this.computeZoneDelta(baselineB, intervB);
    const deltaC = this.computeZoneDelta(baselineC, intervC);

    // Throughput overall delta
    const baseThru = Math.max(1, baselineA.observedThroughputPerMin);
    const intThru = intervA.observedThroughputPerMin;
    const throughputImpact = Math.round(((intThru - baseThru) / baseThru) * 100);

    // Displacement Logic:
    // If downstream zone (A or B) improved (density reduced by >= 0.6 p/m² or hazard reduced),
    // but upstream zone (C public road) deteriorated (density increased by >= 1.0 p/m² or density >= 4.5)
    const downstreamImproved = (deltaA.isImproved || deltaB.isImproved);
    const upstreamDeteriorated = deltaC.isDeteriorated || intervC.density >= 4.5;

    let isDisplacementDetected = false;
    let displacedSourceZone: string | undefined;
    let displacedTargetZone: string | undefined;
    let explanation = 'No material crowd displacement detected across monitored zones.';

    if (downstreamImproved && upstreamDeteriorated) {
      isDisplacementDetected = true;
      displacedSourceZone = deltaA.isImproved ? 'Zone A (Turnstile Throat)' : 'Zone B (Holding Concourse)';
      displacedTargetZone = 'Zone C (Public Roadway)';
      explanation = `Safety intervention decompressed ${displacedSourceZone} (Δρ = ${
        deltaA.isImproved ? deltaA.absoluteDensityDelta.toFixed(1) : deltaB.absoluteDensityDelta.toFixed(1)
      } p/m²), but displaced crowd compression upstream onto ${displacedTargetZone} (Δρ = +${deltaC.absoluteDensityDelta.toFixed(
        1
      )} p/m² to ${intervC.density.toFixed(1)} p/m²).`;
    } else if (deltaB.isImproved && deltaA.isDeteriorated) {
      isDisplacementDetected = true;
      displacedSourceZone = 'Zone B (Concourse)';
      displacedTargetZone = 'Zone A (Gate Throat)';
      explanation = `Queue metering cleared the concourse, but concentrated crowd surge directly at the turnstile throat (Δρ = +${deltaA.absoluteDensityDelta.toFixed(1)} p/m²).`;
    }

    return {
      sampleDurationSec,
      zoneADelta: deltaA,
      zoneBDelta: deltaB,
      zoneCDelta: deltaC,
      overallThroughputImpactPercent: throughputImpact,
      isDisplacementDetected,
      displacedSourceZone,
      displacedTargetZone,
      explanation
    };
  }

  private static computeZoneDelta(
    base: ZoneTelemetrySnapshot,
    interv: ZoneTelemetrySnapshot
  ): ZoneDeltaMetrics {
    const absDensity = Math.round((interv.density - base.density) * 10) / 10;
    const safeBaseDensity = Math.max(0.1, base.density);
    const pctDensity = Math.round(((interv.density - base.density) / safeBaseDensity) * 100);

    const hazardDelta = Math.round((interv.criticalHazardDurationSec - base.criticalHazardDurationSec) * 10) / 10;
    const queueDelta = interv.queuePopulation - base.queuePopulation;
    const thruDelta = Math.round(interv.observedThroughputPerMin - base.observedThroughputPerMin);

    // A zone is deteriorated if density increased by >= 0.8 p/m² or hazard duration increased by >= 3s
    const isDeteriorated = absDensity >= 0.8 || hazardDelta >= 3.0 || interv.density >= 4.8;
    // A zone is improved if density decreased by >= 0.6 p/m² or hazard duration decreased by >= 3s
    const isImproved = absDensity <= -0.6 || hazardDelta <= -3.0;

    return {
      zoneId: base.zoneId,
      name: base.name,
      baselineDensity: base.density,
      interventionDensity: interv.density,
      absoluteDensityDelta: absDensity,
      percentageDensityDelta: pctDensity,
      baselineHazardDurationSec: base.criticalHazardDurationSec,
      interventionHazardDurationSec: interv.criticalHazardDurationSec,
      hazardDurationDeltaSec: hazardDelta,
      baselineQueue: base.queuePopulation,
      interventionQueue: interv.queuePopulation,
      queueDelta,
      baselineThroughput: base.observedThroughputPerMin,
      interventionThroughput: interv.observedThroughputPerMin,
      throughputDelta: thruDelta,
      isDeteriorated,
      isImproved
    };
  }
}

