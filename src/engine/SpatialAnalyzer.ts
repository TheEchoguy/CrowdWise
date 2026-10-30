import {
  Venue,
  Zone,
  ZoneComparisonResult,
  ZoneComparisonStatus,
  SpatialInterventionSummary,
  SimulationMetricsSummary,
} from '../types';
import { SimulationEngine } from './SimulationEngine';

export class SpatialAnalyzer {
  /**
   * Compares baseline and intervention simulation states zone-by-zone.
   * Both engines must be evaluated at equivalent simulation time points.
   */
  public static analyze(
    venue: Venue,
    baseEngine: SimulationEngine,
    planEngine: SimulationEngine,
    scenarioName: string,
    appliedInterventionNames: string[]
  ): {
    zoneComparisons: ZoneComparisonResult[];
    spatialSummary: SpatialInterventionSummary;
  } {
    const baseZones = baseEngine.state.venue.zones;
    const planZones = planEngine.state.venue.zones;

    const zoneComparisons: ZoneComparisonResult[] = [];

    // Evaluate each zone present in the venue
    for (const z of venue.zones) {
      const baseZ = baseZones.find((bz) => bz.id === z.id) || z;
      const planZ = planZones.find((pz) => pz.id === z.id) || z;

      const baseDensity = Math.round(baseZ.currentDensity * 100) / 100;
      const planDensity = Math.round(planZ.currentDensity * 100) / 100;
      const deltaDensity = Math.round((planDensity - baseDensity) * 100) / 100;

      const basePop = baseZ.currentPopulation;
      const planPop = planZ.currentPopulation;
      const deltaPop = planPop - basePop;

      const limit = z.maxRecommendedDensity;
      const baseRisk = baseZ.riskLevel;
      const planRisk = planZ.riskLevel;

      let status: ZoneComparisonStatus = 'UNCHANGED';
      let description = '';

      // Determine Zone Comparison Status
      // 1. Check for NEW HOTSPOT: Zone was previously safe/acceptable (< limit, NORMAL or WATCH)
      //    and became congested (>= limit, HIGH_CONGESTION or CRITICAL) with meaningful increase (+0.25 p/m^2)
      const wasSafe = baseDensity < limit || baseRisk === 'NORMAL' || baseRisk === 'WATCH';
      const isNowCongested = planDensity >= limit || planRisk === 'HIGH_CONGESTION' || planRisk === 'CRITICAL';

      if (wasSafe && isNowCongested && deltaDensity >= 0.25) {
        status = 'NEW_HOTSPOT';
        description = `New congestion hotspot created: density rose from ${baseDensity.toFixed(1)} to ${planDensity.toFixed(1)} p/m² (+${deltaDensity > 0 ? '+' : ''}${deltaDensity.toFixed(2)}), exceeding safe design limit (${limit.toFixed(1)} p/m²).`;
      } else if (deltaDensity <= -0.25 || (baseRisk === 'CRITICAL' && planRisk !== 'CRITICAL' && deltaDensity <= -0.15)) {
        // 2. RELIEVED: Significant density drop or risk classification dropped from CRITICAL
        status = 'RELIEVED';
        description = `Congestion successfully relieved: density decreased by ${Math.abs(deltaDensity).toFixed(2)} p/m² (${baseDensity.toFixed(1)} -> ${planDensity.toFixed(1)} p/m²).`;
      } else if (
        deltaDensity >= 0.20 &&
        (baseDensity >= limit * 0.7 || baseRisk === 'WATCH' || baseRisk === 'HIGH_CONGESTION' || baseRisk === 'CRITICAL')
      ) {
        // 3. WORSENED: Already elevated or congested zone suffered additional crowd build-up
        status = 'WORSENED';
        description = `Existing congestion worsened: density rose by +${deltaDensity.toFixed(2)} p/m² (${baseDensity.toFixed(1)} -> ${planDensity.toFixed(1)} p/m²).`;
      } else {
        // 4. UNCHANGED: Stable conditions within normal tolerance
        status = 'UNCHANGED';
        if (planRisk === 'CRITICAL') {
          description = `Persistent critical density (${planDensity.toFixed(1)} p/m²); intervention did not alleviate bottleneck in this sector.`;
        } else if (planRisk === 'HIGH_CONGESTION') {
          description = `Persistent high congestion (${planDensity.toFixed(1)} p/m²); within threshold tolerance.`;
        } else {
          description = `Stable crowd conditions (${planDensity.toFixed(1)} p/m²); within safe operational capacity.`;
        }
      }

      zoneComparisons.push({
        zoneId: z.id,
        zoneName: z.name,
        category: z.category,
        usableAreaSqM: z.usableAreaSqM,
        maxRecommendedDensity: z.maxRecommendedDensity,
        baselineDensity: baseDensity,
        baselinePopulation: basePop,
        baselineRisk: baseRisk,
        interventionDensity: planDensity,
        interventionPopulation: planPop,
        interventionRisk: planRisk,
        deltaDensity,
        deltaPopulation: deltaPop,
        status,
        description,
      });
    }

    // Synthesize Spatial Intervention Summary
    const relievedZones = zoneComparisons.filter((z) => z.status === 'RELIEVED');
    const worsenedZones = zoneComparisons.filter((z) => z.status === 'WORSENED');
    const newHotspotZones = zoneComparisons.filter((z) => z.status === 'NEW_HOTSPOT');
    const unchangedZones = zoneComparisons.filter((z) => z.status === 'UNCHANGED');

    // Identify worst density increase and largest relief
    let worstDensityIncrease: SpatialInterventionSummary['worstDensityIncrease'] = null;
    let largestRelief: SpatialInterventionSummary['largestRelief'] = null;

    let maxDelta = 0;
    let minDelta = 0;

    for (const z of zoneComparisons) {
      if (z.deltaDensity > maxDelta) {
        maxDelta = z.deltaDensity;
        worstDensityIncrease = {
          zoneId: z.zoneId,
          zoneName: z.zoneName,
          deltaDensity: z.deltaDensity,
          finalDensity: z.interventionDensity,
        };
      }
      if (z.deltaDensity < minDelta) {
        minDelta = z.deltaDensity;
        largestRelief = {
          zoneId: z.zoneId,
          zoneName: z.zoneName,
          deltaDensity: z.deltaDensity,
          finalDensity: z.interventionDensity,
        };
      }
    }

    // Check if baseline hotspots were relieved
    const originalHotspotZones = zoneComparisons.filter(
      (z) => z.baselineRisk === 'CRITICAL' || z.baselineRisk === 'HIGH_CONGESTION'
    );
    const originalHotspotRelieved =
      originalHotspotZones.length > 0 &&
      originalHotspotZones.some((z) => z.status === 'RELIEVED');

    // Transferred risk detection:
    // Risk is transferred if at least one zone achieved relief, but created a new hotspot or significantly worsened another zone
    const riskTransferred =
      (relievedZones.length > 0 && newHotspotZones.length > 0) ||
      (relievedZones.length > 0 && worsenedZones.length > 0 && (worstDensityIncrease?.deltaDensity ?? 0) >= 0.3) ||
      newHotspotZones.length > 0;

    // Determine spatial verdict
    let spatialVerdict: SpatialInterventionSummary['spatialVerdict'] = 'IMPROVED';
    if (newHotspotZones.length > 0 && relievedZones.length > 0) {
      spatialVerdict = 'TRANSFERRED_RISK';
    } else if (newHotspotZones.length > 0 && relievedZones.length === 0) {
      spatialVerdict = 'CRITICAL_CONCERN';
    } else if (worsenedZones.length >= 2 && relievedZones.length <= 1) {
      spatialVerdict = 'CRITICAL_CONCERN';
    } else if (riskTransferred) {
      spatialVerdict = 'TRANSFERRED_RISK';
    } else if (relievedZones.length > 0 && worsenedZones.length === 0 && newHotspotZones.length === 0) {
      spatialVerdict = 'IMPROVED';
    } else {
      spatialVerdict = 'BALANCED';
    }

    // Generate plain-language summary
    let plainLanguageSummary = '';
    if (riskTransferred && newHotspotZones.length > 0) {
      const relievedNames = relievedZones.map((z) => z.zoneName).join(', ') || 'primary zones';
      const newHotspotNames = newHotspotZones
        .map((z) => `${z.zoneName} (+${z.deltaDensity.toFixed(2)} p/m² -> ${z.interventionDensity.toFixed(1)} p/m²)`)
        .join(', ');
      plainLanguageSummary = `Transferred risk detected: intervention relieved crowd congestion in ${relievedNames}, but created ${newHotspotZones.length} NEW HOTSPOT(S) in ${newHotspotNames}. Egress diversions or gate reassignments transferred the physical bottleneck rather than dispersing the total crowd load.`;
    } else if (riskTransferred && worsenedZones.length > 0) {
      const relievedNames = relievedZones.map((z) => z.zoneName).join(', ');
      const worsenedNames = worsenedZones
        .map((z) => `${z.zoneName} (+${z.deltaDensity.toFixed(2)} p/m²)`)
        .join(', ');
      plainLanguageSummary = `Downstream congestion shift detected: while ${relievedNames} showed density reductions, crowd pressure deteriorated in ${worsenedNames}. Upstream flow control or secondary staging is recommended.`;
    } else if (spatialVerdict === 'IMPROVED') {
      const relievedNames = relievedZones.map((z) => `${z.zoneName} (${z.deltaDensity.toFixed(2)} p/m²)`).join(', ');
      plainLanguageSummary = `Net positive safety improvement: crowd densities decreased across ${relievedZones.length} zone(s) (${relievedNames}) without generating secondary bottlenecks or exceeding critical safety thresholds in any downstream sector.`;
    } else if (spatialVerdict === 'CRITICAL_CONCERN') {
      plainLanguageSummary = `Intervention plan generated severe spatial bottlenecks: ${newHotspotZones.length} new hotspot(s) and ${worsenedZones.length} worsened sector(s) without compensating relief. Current intervention parameters require immediate tactical redesign.`;
    } else {
      plainLanguageSummary = `Balanced outcome: minor crowd shifts observed across ${venue.zones.length} zones with no new critical hotspots created. Density shifts remain within operational safety tolerance.`;
    }

    return {
      zoneComparisons,
      spatialSummary: {
        totalZonesEvaluated: zoneComparisons.length,
        relievedZonesCount: relievedZones.length,
        unchangedZonesCount: unchangedZones.length,
        worsenedZonesCount: worsenedZones.length,
        newHotspotCount: newHotspotZones.length,
        worstDensityIncrease,
        largestRelief,
        riskTransferred,
        originalHotspotRelieved,
        plainLanguageSummary,
        spatialVerdict,
      },
    };
  }
}
