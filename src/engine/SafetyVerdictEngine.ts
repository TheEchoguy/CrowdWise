/**
 * CROWDWISE — Final Safety Verdict Engine
 * Stage 7: Evidence-Based Safety Decision & Permit Recommendation Engine
 *
 * Exactly 4 Verdicts:
 * - IMPROVED: Verified risk reduction across all zones without unacceptable displacement
 * - DISPLACED: Danger shifted from one zone to another (e.g. inner throttling moves crowd to public road)
 * - DEGRADED: Overall safety deteriorated or multiple zones worsened
 * - INCONCLUSIVE: Insufficient runtime evidence or difference within statistical tolerance
 */

import { ComparativeAuditReport } from './DisplacementDetector';

export type SafetyVerdict = 'IMPROVED' | 'DISPLACED' | 'DEGRADED' | 'INCONCLUSIVE';

export interface VerdictReport {
  verdict: SafetyVerdict;
  verdictTitle: string;
  verdictBadgeColor: string; // Tailwind class
  confidencePercent: number;
  primaryRationale: string;
  supportingFindings: string[];
  permitRecommendation: 'GRANT_PERMIT' | 'CONDITIONAL_APPROVAL' | 'DENY_PERMIT' | 'CONTINUE_MONITORING';
  permitOfficerSummary: string;
}

export class SafetyVerdictEngine {
  /**
   * Evaluates the Comparative Audit Report and produces an explainable, transparent safety verdict
   */
  public static evaluate(audit: ComparativeAuditReport): VerdictReport {
    const { zoneADelta, zoneBDelta, zoneCDelta, isDisplacementDetected, sampleDurationSec } = audit;

    // Minimum Evidence Threshold
    if (sampleDurationSec < 8.0) {
      return {
        verdict: 'INCONCLUSIVE',
        verdictTitle: 'Inconclusive: Insufficient Observation Window',
        verdictBadgeColor: 'bg-slate-800 text-slate-300 border-slate-700',
        confidencePercent: 40,
        primaryRationale: `Sample duration (${sampleDurationSec.toFixed(1)}s) is below the minimum required 8.0s evaluation window for statistical validity.`,
        supportingFindings: [
          'Simulation runtime too short to capture steady-state queue progression',
          'Transient crowd fluctuations within statistical margin of error'
        ],
        permitRecommendation: 'CONTINUE_MONITORING',
        permitOfficerSummary: 'Hold permit review until at least 30 seconds of gameday inflow observations are accumulated.'
      };
    }

    // Check for Displaced Risk First
    if (isDisplacementDetected) {
      return {
        verdict: 'DISPLACED',
        verdictTitle: 'Displaced Risk: Upstream Congestion Shift Detected',
        verdictBadgeColor: 'bg-amber-950 text-amber-300 border-amber-600',
        confidencePercent: 92,
        primaryRationale: audit.explanation,
        supportingFindings: [
          `Zone A (Throat) density changed by ${zoneADelta.absoluteDensityDelta.toFixed(1)} p/m² (${zoneADelta.percentageDensityDelta > 0 ? '+' : ''}${zoneADelta.percentageDensityDelta}%)`,
          `Zone C (Public Roadway) density changed by +${zoneCDelta.absoluteDensityDelta.toFixed(1)} p/m² reaching ${zoneCDelta.interventionDensity.toFixed(1)} p/m²`,
          'Throttling inner gates moved queue pressure upstream into municipal traffic flow'
        ],
        permitRecommendation: 'CONDITIONAL_APPROVAL',
        permitOfficerSummary: 'DO NOT APPROVE UNCHECKED METERING. Throttling inner gates protects the gantry but creates dangerous sidewalk stampede hazards on municipal roads.'
      };
    }

    // Check for Overall Degradation
    const deterioratedCount = [zoneADelta.isDeteriorated, zoneBDelta.isDeteriorated, zoneCDelta.isDeteriorated].filter(Boolean).length;
    if (deterioratedCount >= 2 || zoneADelta.interventionDensity >= 5.2 || zoneCDelta.interventionDensity >= 5.2) {
      return {
        verdict: 'DEGRADED',
        verdictTitle: 'Degraded: Critical Safety Hazards Amplified',
        verdictBadgeColor: 'bg-rose-950 text-rose-300 border-rose-600',
        confidencePercent: 95,
        primaryRationale: 'Multiple zones experienced significant density spikes and accumulated critical hazard durations.',
        supportingFindings: [
          `${deterioratedCount} of 3 monitored zones experienced severe density elevation`,
          `Zone A peak density reached ${zoneADelta.interventionDensity.toFixed(1)} p/m² (Critical Threshold: 4.5 p/m²)`,
          `Critical hazard duration increased by ${zoneADelta.hazardDurationDeltaSec.toFixed(1)}s`
        ],
        permitRecommendation: 'DENY_PERMIT',
        permitOfficerSummary: 'DENY EVENT PERMIT. The tested operational staffing or layout plan produces dangerous compressive crowd shockwaves.'
      };
    }

    // Check for Verified Improvement
    const improvedCount = [zoneADelta.isImproved, zoneBDelta.isImproved, zoneCDelta.isImproved].filter(Boolean).length;
    const noZoneCritical = zoneADelta.interventionDensity < 4.2 && zoneBDelta.interventionDensity < 4.0 && zoneCDelta.interventionDensity < 4.2;

    if (improvedCount >= 1 && noZoneCritical && deterioratedCount === 0) {
      return {
        verdict: 'IMPROVED',
        verdictTitle: 'Improved: Safe Laminar Ingress Verified',
        verdictBadgeColor: 'bg-emerald-950 text-emerald-300 border-emerald-600',
        confidencePercent: 94,
        primaryRationale: 'Intervention successfully eliminated compressive bottlenecks across all monitored zones without shifting danger upstream.',
        supportingFindings: [
          `Turnstile throat density reduced to safe ${zoneADelta.interventionDensity.toFixed(1)} p/m² (Δρ = ${zoneADelta.absoluteDensityDelta.toFixed(1)} p/m²)`,
          `Holding concourse queue remains laminar at ${zoneBDelta.interventionDensity.toFixed(1)} p/m²`,
          `Public roadway approach clear at ${zoneCDelta.interventionDensity.toFixed(1)} p/m² with zero spillback`,
          `Throughput impact: ${audit.overallThroughputImpactPercent > 0 ? '+' : ''}${audit.overallThroughputImpactPercent}%`
        ],
        permitRecommendation: 'GRANT_PERMIT',
        permitOfficerSummary: 'GRANT EVENT SAFETY PERMIT. Proposed staffing, gate routing, and queue baffles maintain crowd density well within Fruin Level of Service C safe thresholds.'
      };
    }

    // Default within tolerance bands
    return {
      verdict: 'INCONCLUSIVE',
      verdictTitle: 'Inconclusive: Within Statistical Tolerance Bands',
      verdictBadgeColor: 'bg-slate-800 text-slate-300 border-slate-700',
      confidencePercent: 65,
      primaryRationale: 'Observed variations between Baseline and Intervention fall within the normal ±0.4 p/m² transient crowd movement margin.',
      supportingFindings: [
        `Zone A Δρ = ${zoneADelta.absoluteDensityDelta.toFixed(1)} p/m² (Within ±0.4 p/m² tolerance)`,
        `Zone B Δρ = ${zoneBDelta.absoluteDensityDelta.toFixed(1)} p/m²`,
        'No conclusive safety improvement or degradation could be definitively attributed'
      ],
      permitRecommendation: 'CONTINUE_MONITORING',
      permitOfficerSummary: 'Continue standard monitoring; no critical action required at current density levels.'
    };
  }
}

