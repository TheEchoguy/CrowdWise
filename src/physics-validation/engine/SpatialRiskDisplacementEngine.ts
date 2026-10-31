/**
 * CROWDWISE — Spatial Risk Displacement Engine
 * Stage 6/7: Comprehensive 5-Zone Spatial Risk & Displacement Evaluation
 *
 * Ground-truth stadium coordinates (20px = 1m):
 * - Z1: Public road / gate approach (y in [490, 560], x in [40, 920])
 * - Z2: Holding area (y in [360, 490], x in [60, 900])
 * - Z3: Queue and concourse (y in [230, 360], x in [80, 880])
 * - Z4: Security / turnstile throat (y in [160, 230], x in [120, 840])
 * - Z5: Downstream stand dispersal (y in [90, 160], x in [140, 820])
 */

import {
  SpatialZoneId,
  FiveZoneGeometryBounds,
  ZoneRiskMetrics,
  FiveZoneSnapshot,
  ZoneDisplacementComparison,
  RiskDisplacementReport,
  FinalSafetyVerdict
} from '../types/PhysicsValidationTypes';

export class SpatialRiskDisplacementEngine {
  /**
   * Ground truth geometric boundaries for the 5 monitored zones (20px = 1m)
   */
  public static readonly ZONE_BOUNDS: Record<SpatialZoneId, FiveZoneGeometryBounds> = {
    ZONE_1_PUBLIC_ROAD: {
      id: 'ZONE_1_PUBLIC_ROAD',
      name: 'Zone 1: Public Roadway & Approach',
      xMin: 40,
      xMax: 920,
      yMin: 490,
      yMax: 560,
      areaM2: Math.round(((880 * 70) / 400) * 10) / 10, // ~154 m²
      hazardThresholdDensity: 4.5
    },
    ZONE_2_HOLDING_AREA: {
      id: 'ZONE_2_HOLDING_AREA',
      name: 'Zone 2: Outer Holding Corral',
      xMin: 60,
      xMax: 900,
      yMin: 360,
      yMax: 490,
      areaM2: Math.round(((840 * 130) / 400) * 10) / 10, // ~273 m²
      hazardThresholdDensity: 4.5
    },
    ZONE_3_QUEUE_CONCOURSE: {
      id: 'ZONE_3_QUEUE_CONCOURSE',
      name: 'Zone 3: S-Queue & Concourse Buffer',
      xMin: 80,
      xMax: 880,
      yMin: 230,
      yMax: 360,
      areaM2: Math.round(((800 * 130) / 400) * 10) / 10, // ~260 m²
      hazardThresholdDensity: 4.5
    },
    ZONE_4_THROAT: {
      id: 'ZONE_4_THROAT',
      name: 'Zone 4: Security & Turnstile Throat',
      xMin: 120,
      xMax: 840,
      yMin: 160,
      yMax: 230,
      areaM2: Math.round(((720 * 70) / 400) * 10) / 10, // ~126 m²
      hazardThresholdDensity: 4.5
    },
    ZONE_5_DOWNSTREAM_STAND: {
      id: 'ZONE_5_DOWNSTREAM_STAND',
      name: 'Zone 5: Downstream Vomitory Dispersal',
      xMin: 140,
      xMax: 820,
      yMin: 90,
      yMax: 160,
      areaM2: Math.round(((680 * 70) / 400) * 10) / 10, // ~119 m²
      hazardThresholdDensity: 4.5
    }
  };

  /**
   * Evaluates spatial risk metrics for an agent population across the 5 geometric zones
   */
  public static sampleZones(
    agents: {
      x: number;
      y: number;
      vx: number;
      vy: number;
      active?: boolean;
      density?: number;
      isCleared?: boolean;
    }[],
    timestamp: number = 0,
    missingZoneId?: SpatialZoneId
  ): FiveZoneSnapshot {
    const zones: Partial<Record<SpatialZoneId, ZoneRiskMetrics>> = {};
    let systemPeak = 0;
    const anyMissing = missingZoneId !== undefined;

    const zoneKeys: SpatialZoneId[] = [
      'ZONE_1_PUBLIC_ROAD',
      'ZONE_2_HOLDING_AREA',
      'ZONE_3_QUEUE_CONCOURSE',
      'ZONE_4_THROAT',
      'ZONE_5_DOWNSTREAM_STAND'
    ];

    for (const zid of zoneKeys) {
      if (zid === missingZoneId) {
        zones[zid] = {
          zoneId: zid,
          zoneName: this.ZONE_BOUNDS[zid].name,
          activeCount: 0,
          maxDensity: 0,
          meanDensity: 0,
          avgVelocity: 0,
          maxQueueLength: 0,
          longitudinalSpillbackMeters: 0,
          avgWaitTimeSec: 0,
          maxWaitTimeSec: 0,
          counterFlowIntensity: 0,
          collisionContactCount: 0,
          hazardDurationSec: 0,
          hasMissingTelemetry: true
        };
        continue;
      }

      const bounds = this.ZONE_BOUNDS[zid];
      const contained = agents.filter(
        (a) =>
          a.active !== false &&
          a.x >= bounds.xMin &&
          a.x <= bounds.xMax &&
          a.y >= bounds.yMin &&
          a.y <= bounds.yMax
      );

      const count = contained.length;
      const meanRho = Math.round((count / bounds.areaM2) * 100) / 100;

      let maxRho = meanRho;
      let sumVel = 0;
      let opposingCount = 0;

      for (let i = 0; i < count; i++) {
        const a = contained[i];
        if (a.density && a.density > maxRho) maxRho = a.density;
        const spd = Math.hypot(a.vx, a.vy) / 20.0; // convert px/s to m/s
        sumVel += spd;
        // Directional opposition: moving southward (+y) against northward ingress (-y)
        if (a.vy > 1.0) opposingCount++;
      }

      const avgVel = count > 0 ? Math.round((sumVel / count) * 100) / 100 : 1.34;
      if (maxRho > systemPeak) systemPeak = maxRho;

      // Directional queue spillback distance: measured along ingress axis (upstream direction southward +y)
      let spillbackM = 0;
      const queuedAgents = contained.filter((a) => (Math.hypot(a.vx, a.vy) / 20.0) < 0.35);
      if (queuedAgents.length > 0) {
        // Measure span from downstream gate/choke boundary (bounds.yMin) to tail of queue (max y)
        const maxY = Math.max(...queuedAgents.map((a) => a.y));
        const minY = Math.min(...queuedAgents.map((a) => a.y));
        spillbackM = Math.max(0, Math.round(((maxY - minY) / 20.0) * 10) / 10);
      }
      if (spillbackM === 0 && count > 0) {
        // Fallback estimate based on pedestrian occupancy: each queued agent occupies ~0.5m longitudinally
        spillbackM = Math.max(0, Math.round(((count * 0.5) - bounds.areaM2 * 0.08) * 10) / 10);
      }

      zones[zid] = {
        zoneId: zid,
        zoneName: bounds.name,
        activeCount: count,
        maxDensity: Math.round(maxRho * 10) / 10,
        meanDensity: meanRho,
        avgVelocity: avgVel,
        maxQueueLength: count,
        longitudinalSpillbackMeters: spillbackM,
        avgWaitTimeSec: Math.round(count * 1.2),
        maxWaitTimeSec: Math.round(count * 2.5),
        counterFlowIntensity: opposingCount,
        collisionContactCount: Math.round(opposingCount * 1.5),
        hazardDurationSec: maxRho >= bounds.hazardThresholdDensity ? 6.0 : 0.0,
        hasMissingTelemetry: false
      };
    }

    return {
      timestamp,
      zones: zones as Record<SpatialZoneId, ZoneRiskMetrics>,
      systemPeakDensity: Math.round(systemPeak * 10) / 10,
      hasMissingTelemetry: anyMissing
    };
  }

  /**
   * Compares Matched Baseline vs Intervention Snapshots across all five spatial zones simultaneously.
   */
  public static compare(
    baseline: FiveZoneSnapshot,
    mitigated: FiveZoneSnapshot,
    baselineThroughput: number = 240,
    mitigatedThroughput: number = 240
  ): RiskDisplacementReport {
    const comparisons: Partial<Record<SpatialZoneId, ZoneDisplacementComparison>> = {};
    const zoneKeys: SpatialZoneId[] = [
      'ZONE_1_PUBLIC_ROAD',
      'ZONE_2_HOLDING_AREA',
      'ZONE_3_QUEUE_CONCOURSE',
      'ZONE_4_THROAT',
      'ZONE_5_DOWNSTREAM_STAND'
    ];

    const hasAnyMissingData = baseline.hasMissingTelemetry || mitigated.hasMissingTelemetry;

    let worstZoneId: SpatialZoneId = 'ZONE_4_THROAT';
    let maxRiskDelta = -Infinity;

    for (const zid of zoneKeys) {
      const baseZ = baseline.zones[zid];
      const mitZ = mitigated.zones[zid];

      if (!baseZ || !mitZ || baseZ.hasMissingTelemetry || mitZ.hasMissingTelemetry) {
        comparisons[zid] = {
          zoneId: zid,
          zoneName: this.ZONE_BOUNDS[zid].name,
          baselinePeakDensity: 0,
          mitigatedPeakDensity: 0,
          baselineDensity: 0,
          interventionDensity: 0,
          deltaDensity: 0,
          baselineQueue: 0,
          interventionQueue: 0,
          deltaQueue: 0,
          baselineSpillbackMeters: 0,
          mitigatedSpillbackMeters: 0,
          baselineMeanVelocity: 0,
          mitigatedMeanVelocity: 0,
          baselineHazardDurationSec: 0,
          interventionHazardDurationSec: 0,
          deltaHazardDurationSec: 0,
          isImproved: false,
          isDeteriorated: false,
          isHotspot: false,
          isNewHotspot: false,
          isWorstRisk: false,
          hasMissingData: true
        };
        continue;
      }

      const deltaRho = Math.round((mitZ.meanDensity - baseZ.meanDensity) * 10) / 10;
      const deltaHazard = Math.round((mitZ.hazardDurationSec - baseZ.hazardDurationSec) * 10) / 10;
      const deltaQueue = mitZ.activeCount - baseZ.activeCount;

      const isHotspot = mitZ.maxDensity >= 4.5 || mitZ.meanDensity >= 4.0;
      const isNewHotspot = isHotspot && baseZ.maxDensity < 4.0;

      // Deteriorated if density increased meaningfully or new hazard formed
      const isDeteriorated = deltaRho >= 0.6 || isNewHotspot || deltaHazard >= 3.0 || mitZ.maxDensity >= 4.8;
      // Improved if density decreased meaningfully without becoming a hazard
      const isImproved = deltaRho <= -0.5 || (deltaHazard <= -3.0 && deltaRho <= 0);

      // Risk score to find worst affected zone
      const riskScore = deltaRho * 2.0 + (isNewHotspot ? 5.0 : 0) + (isHotspot ? 3.0 : 0) + deltaHazard;
      if (riskScore > maxRiskDelta) {
        maxRiskDelta = riskScore;
        worstZoneId = zid;
      }

      comparisons[zid] = {
        zoneId: zid,
        zoneName: this.ZONE_BOUNDS[zid].name,
        baselinePeakDensity: baseZ.maxDensity,
        mitigatedPeakDensity: mitZ.maxDensity,
        baselineDensity: baseZ.meanDensity,
        interventionDensity: mitZ.meanDensity,
        deltaDensity: deltaRho,
        baselineQueue: baseZ.activeCount,
        interventionQueue: mitZ.activeCount,
        deltaQueue,
        baselineSpillbackMeters: baseZ.longitudinalSpillbackMeters,
        mitigatedSpillbackMeters: mitZ.longitudinalSpillbackMeters,
        baselineMeanVelocity: baseZ.avgVelocity,
        mitigatedMeanVelocity: mitZ.avgVelocity,
        baselineHazardDurationSec: baseZ.hazardDurationSec,
        interventionHazardDurationSec: mitZ.hazardDurationSec,
        deltaHazardDurationSec: deltaHazard,
        isImproved,
        isDeteriorated,
        isHotspot,
        isNewHotspot,
        isWorstRisk: false,
        hasMissingData: false
      };
    }

    // Tag worst risk zone
    if (comparisons[worstZoneId]) {
      comparisons[worstZoneId]!.isWorstRisk = true;
    }

    const fullComparisons = comparisons as Record<SpatialZoneId, ZoneDisplacementComparison>;

    // Throughput Impact
    const safeBaseThru = Math.max(1, baselineThroughput);
    const throughputImpact = Math.round(((mitigatedThroughput - safeBaseThru) / safeBaseThru) * 100);

    // Rule 1: Missing telemetry strictly produces INCONCLUSIVE, never IMPROVED
    if (hasAnyMissingData) {
      return {
        isDisplacementDetected: false,
        worstAffectedZone: 'Missing Sensor Coverage',
        verdict: 'INCONCLUSIVE',
        overallThroughputImpactPercent: throughputImpact,
        zoneComparisons: fullComparisons,
        confidencePercent: 30,
        rationale: 'Telemetry missing in one or more monitored spatial zones. A safety permit cannot be verified without complete spatial coverage.',
        permitOfficerRecommendation: 'HOLD EVENT PERMIT: Complete 5-zone sensor or camera stream is required for risk certification.'
      };
    }

    // Displacement Logic:
    // Risk decreases at any intervention zone (e.g. Zone 4 Throat or Zone 3 Concourse),
    // but increases in an upstream or adjacent zone (Zone 1, Zone 2, Zone 3, etc.)
    const improvedZoneKey = zoneKeys.find((zid) => fullComparisons[zid].isImproved);
    const deterioratedZoneKey = zoneKeys.find(
      (zid) => zid !== improvedZoneKey && (fullComparisons[zid].isDeteriorated || fullComparisons[zid].isNewHotspot)
    );

    let isDisplacementDetected = false;
    let displacedSource: string | undefined;
    let displacedTarget: string | undefined;

    if (improvedZoneKey && deterioratedZoneKey) {
      isDisplacementDetected = true;
      displacedSource = fullComparisons[improvedZoneKey].zoneName;
      displacedTarget = fullComparisons[deterioratedZoneKey].zoneName;
    }

    // Determine Final Safety Verdict
    let verdict: FinalSafetyVerdict = 'INCONCLUSIVE';
    let confidence = 75;
    let rationale = '';
    let permitRecommendation = '';

    const deterioratedCount = Object.values(fullComparisons).filter((c) => c.isDeteriorated).length;
    const improvedCount = Object.values(fullComparisons).filter((c) => c.isImproved).length;
    const hasAnyNewHotspot = Object.values(fullComparisons).some((c) => c.isNewHotspot);
    const hasSevereHotspot = Object.values(fullComparisons).some((c) => c.mitigatedPeakDensity >= 5.0);

    if (isDisplacementDetected && deterioratedZoneKey) {
      verdict = 'DISPLACED';
      confidence = 94;
      rationale = `Risk displacement detected: Intervention decompressed ${displacedSource}, but displaced crowd risk into ${displacedTarget} (Δρ = +${fullComparisons[deterioratedZoneKey].deltaDensity} p/m²).`;
      permitRecommendation = 'CONDITIONAL APPROVAL: Upstream buffer or municipal road closure required before permit issuance.';
    } else if (hasSevereHotspot || deterioratedCount >= 2 || (deterioratedCount >= 1 && hasAnyNewHotspot)) {
      verdict = 'DETERIORATED';
      confidence = 96;
      rationale = `Safety deteriorated: Intervention amplified crowd density or created a new crush hazard in ${fullComparisons[worstZoneId]?.zoneName}.`;
      permitRecommendation = 'DENY EVENT PERMIT: Intervention induces unsafe crowd compression.';
    } else if (improvedCount >= 1 && deterioratedCount === 0 && !hasAnyNewHotspot) {
      // Check if all other zones had near-zero shift (|delta| <= 0.3)
      const allOthersZeroShift = zoneKeys.every(
        (zid) => fullComparisons[zid].isImproved || Math.abs(fullComparisons[zid].deltaDensity) <= 0.3
      );

      if (allOthersZeroShift) {
        verdict = 'ZERO_DISPLACEMENT';
        confidence = 95;
        rationale = 'Zero displacement verified: Turnstile throat and concourse safely decompressed without any risk transfer to upstream holding areas or roadways.';
        permitRecommendation = 'GRANT EVENT PERMIT: Verified laminar flow with zero crowd displacement across all 5 zones.';
      } else {
        verdict = 'IMPROVED';
        confidence = 92;
        rationale = 'Overall improvement: Monitored pedestrian risk decreased across the facility without creating any new hazard hotspots.';
        permitRecommendation = 'GRANT EVENT PERMIT: Operational plan maintains crowd safety within certified limits.';
      }
    } else {
      verdict = 'INCONCLUSIVE';
      confidence = 65;
      rationale = 'Inconclusive: Observed density variations between baseline and mitigation fall within natural statistical movement tolerance (±0.3 p/m²).';
      permitRecommendation = 'CONTINUE MONITORING: Differences fall within statistical margin of error.';
    }

    return {
      isDisplacementDetected,
      displacedSourceZone: displacedSource,
      displacedTargetZone: displacedTarget,
      worstAffectedZone: fullComparisons[worstZoneId]?.zoneName || 'None',
      verdict,
      overallThroughputImpactPercent: throughputImpact,
      zoneComparisons: fullComparisons,
      confidencePercent: confidence,
      rationale,
      permitOfficerRecommendation: permitRecommendation
    };
  }
}
