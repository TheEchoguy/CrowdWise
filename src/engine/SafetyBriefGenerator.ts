/**
 * CROWDWISE — Automated Safety Brief & Report Generator
 * Phase 4: Formal Safety Permitting & Technical Documentation
 * M. Chinnaswamy Stadium, Bengaluru
 *
 * Implements the Full 10-Section Crowd Safety Permitting Brief:
 * Section 1: Executive Summary
 * Section 2: Stadium Configuration
 * Section 3: Scenario Description
 * Section 4: Baseline Analysis
 * Section 5: Intervention Analysis
 * Section 6: Comparative Results & Percentage Improvements
 * Section 7: Displacement Analysis
 * Section 8: Final Verdict & Decision
 * Section 9: Recommended Operational Actions
 * Section 10: Technical Appendix
 *
 * Generates structured CSV data and formatted printable report structure.
 */

import { ExperimentRecord } from './ControlledExperimentRunner';
import { INNER_GATE_STAND_CATALOG } from '../stadium/network/gateConnectivity';

export interface SafetyBriefData {
  section1_ExecutiveSummary: {
    venue: string;
    experimentId: string;
    scenarioType: string;
    scenarioName: string;
    experimentDate: string;
    safetyVerdict: string;
    permitOfficerAction: string;
    confidenceScore: number;
  };
  section2_StadiumConfiguration: {
    capacity: number;
    activeOuterGates: string[];
    innerGateTopology: string[];
    turnstileCount: number;
    assumptions: string[];
  };
  section3_ScenarioDescription: {
    initialDemandRatePerMin: number;
    selectedGates: string[];
    failureConditions: string;
    durationSeconds: number;
    walkingSpeedMps: number;
  };
  section4_BaselineAnalysis: {
    peakThroatDensity: number;
    peakConcourseDensity: number;
    peakRoadDensity: number;
    admittedTotal: number;
    avgWaitTimeSec: number;
    hotspotsIdentified: string[];
  };
  section5_InterventionAnalysis: {
    activeInterventions: string[];
    operationalChanges: string[];
  };
  section6_ComparativeResults: {
    throughputBaseline: number;
    throughputIntervention: number;
    throughputImprovementPercent: number;
    waitTimeBaseline: number;
    waitTimeIntervention: number;
    waitTimeImprovementPercent: number;
    peakDensityBaseline: number;
    peakDensityIntervention: number;
    densityImprovementPercent: number;
  };
  section7_DisplacementAnalysis: {
    isDisplacementDetected: boolean;
    displacementSummary: string;
    affectedTargetZone: string;
    publicRoadImpact: string;
  };
  section8_FinalVerdict: {
    verdict: string;
    verdictTitle: string;
    supportingFindings: string[];
    limitations: string[];
  };
  section9_RecommendedActions: {
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    action: string;
    rationale: string;
  }[];
  section10_TechnicalAppendix: {
    randomSeed: number;
    simulationEngine: string;
    evaluationWindowSec: number;
    disclaimer: string;
  };
}

export class SafetyBriefGenerator {
  /**
   * Builds the comprehensive 10-section safety brief data structure from an ExperimentRecord.
   */
  public static generateBriefData(record: ExperimentRecord): SafetyBriefData {
    const base = record.baselineResults;
    const interv = record.interventionResults;
    const disp = record.displacementResults;
    const verd = record.safetyVerdict;

    // Calculate percentage improvements: ((Base - Interv) / Base) * 100
    const calcImprovement = (baseVal: number, intervVal: number, lowerIsBetter = true) => {
      if (baseVal <= 0) return 0;
      const diff = lowerIsBetter ? baseVal - intervVal : intervVal - baseVal;
      return Math.round((diff / baseVal) * 100);
    };

    const waitTimeImp = calcImprovement(base.averageWaitTimeSec, interv.averageWaitTimeSec, true);
    const thruImp = calcImprovement(base.peakThroughputPerMin, interv.peakThroughputPerMin, false);
    const densImp = calcImprovement(base.peakDensityOverall, interv.peakDensityOverall, true);

    const outerGates = record.selectedGates.outerGates || ['E22'];
    const innerGates = record.selectedGates.innerGates || ['G7', 'G8'];

    return {
      section1_ExecutiveSummary: {
        venue: 'M. Chinnaswamy Stadium, Bengaluru (KSCA)',
        experimentId: record.experimentId,
        scenarioType: record.scenarioType,
        scenarioName: record.scenarioName,
        experimentDate: new Date(record.timestamp).toLocaleString(),
        safetyVerdict: verd.verdict,
        permitOfficerAction: verd.permitOfficerSummary,
        confidenceScore: verd.confidencePercent
      },
      section2_StadiumConfiguration: {
        capacity: 35000,
        activeOuterGates: outerGates,
        innerGateTopology: innerGates,
        turnstileCount: innerGates.reduce(
          (sum, ig) => sum + (INNER_GATE_STAND_CATALOG[ig]?.turnstileCount || 4),
          0
        ),
        assumptions: [
          'Venue topology calibrated to official KSCA ingress architectural blueprints.',
          'General spectator access strictly isolated from Queens Road VIP/Media access (E5–E10).',
          'Pedestrian walking speeds sampled from Helbing Gaussian velocity distribution (μ = 1.34 m/s).'
        ]
      },
      section3_ScenarioDescription: {
        initialDemandRatePerMin: record.initialParameters.baseInflowRate,
        selectedGates: outerGates,
        failureConditions:
          record.scenarioType === 'OUTER_GATE_FAILURE'
            ? 'Outer perimeter gate failure with lane choke'
            : record.scenarioType === 'TURNSTILE_FAILURE'
            ? 'Inner turnstile bank scanner failure'
            : record.scenarioType === 'METRO_SURGE'
            ? '+600 p/min Metro pulse from MG Road & Cubbon Park stations'
            : 'Nominal gameday crowd ingress',
        durationSeconds: record.simulationDurationSeconds,
        walkingSpeedMps: record.initialParameters.walkingSpeed
      },
      section4_BaselineAnalysis: {
        peakThroatDensity: base.zoneA.peakDensity,
        peakConcourseDensity: base.zoneB.peakDensity,
        peakRoadDensity: base.zoneC.peakDensity,
        admittedTotal: base.totalAdmitted,
        avgWaitTimeSec: base.averageWaitTimeSec,
        hotspotsIdentified: [
          `Turnstile Throat Zone A peak at ${base.zoneA.peakDensity} p/m²`,
          `Holding Concourse Zone B peak at ${base.zoneB.peakDensity} p/m²`,
          `Public Roadway Zone C peak at ${base.zoneC.peakDensity} p/m²`
        ]
      },
      section5_InterventionAnalysis: {
        activeInterventions: record.interventionConfiguration,
        operationalChanges: [
          record.interventionConfiguration.includes('METERING')
            ? 'Dynamic Metering: 35% throttled pulsed intake at outer perimeter barriers'
            : 'Metering: Inactive',
          record.interventionConfiguration.includes('REROUTING')
            ? 'Intelligent Rerouting: Autonomous diversion to verified adjacent gates'
            : 'Rerouting: Inactive',
          record.interventionConfiguration.includes('DIRECTIONAL_SEPARATION')
            ? 'Directional Divider: Stanchion separation isolating counter-flow rejected spectators'
            : 'Directional Divider: Inactive',
          record.interventionConfiguration.includes('QUEUE_MANAGEMENT')
            ? 'Queue S-Lanes: Switchback tensile barriers deployed across Zone B'
            : 'Queue S-Lanes: Inactive',
          record.interventionConfiguration.includes('TURNSTILE_LOAD_BALANCING')
            ? 'Turnstile Balancing: Real-time re-allocation across active operational counters'
            : 'Turnstile Balancing: Inactive'
        ]
      },
      section6_ComparativeResults: {
        throughputBaseline: base.peakThroughputPerMin,
        throughputIntervention: interv.peakThroughputPerMin,
        throughputImprovementPercent: thruImp,
        waitTimeBaseline: base.averageWaitTimeSec,
        waitTimeIntervention: interv.averageWaitTimeSec,
        waitTimeImprovementPercent: waitTimeImp,
        peakDensityBaseline: base.peakDensityOverall,
        peakDensityIntervention: interv.peakDensityOverall,
        densityImprovementPercent: densImp
      },
      section7_DisplacementAnalysis: {
        isDisplacementDetected: disp.isDisplacementDetected,
        displacementSummary: disp.explanation,
        affectedTargetZone: disp.displacedTargetZone || 'None',
        publicRoadImpact:
          disp.zoneCDelta.absoluteDensityDelta > 0.4
            ? `Upstream public road density increased by +${disp.zoneCDelta.absoluteDensityDelta} p/m² due to throttling.`
            : 'No hazardous public roadway spillback observed.'
      },
      section8_FinalVerdict: {
        verdict: verd.verdict,
        verdictTitle: verd.verdictTitle,
        supportingFindings: verd.supportingFindings,
        limitations: [
          'Derived from deterministic microscopic vector simulation under synthetic demand schedules.',
          'Does not replace certified on-site structural crowd safety officer inspection.',
          'Assumes 100% steward adherence to configured barrier and stanchion alignments.'
        ]
      },
      section9_RecommendedActions: [
        {
          priority: 'HIGH',
          action: 'Enforce Verified Gate Connectivity Limits',
          rationale: 'Prevent unauthorized cross-sector diversions into Queens Road VIP corridors.'
        },
        {
          priority: 'HIGH',
          action: 'Deploy Zone B Switchback Barriers',
          rationale: 'Stabilizes holding concourse queue density below Fruin Level of Service E.'
        },
        {
          priority: 'MEDIUM',
          action: 'Synchronize Transit Metro Arrival Metering',
          rationale: 'Throttles intake pulses from MG Road station before concourse capacity is overwhelmed.'
        }
      ],
      section10_TechnicalAppendix: {
        randomSeed: record.seed,
        simulationEngine: 'Helbing Social Force Model (2000) & Spatial Hashing',
        evaluationWindowSec: record.simulationDurationSeconds,
        disclaimer:
          'This document is a synthetic simulation decision-support prototype. It is not a certified structural engineering sign-off.'
      }
    };
  }

  /**
   * Generates a downloadable CSV formatted string containing all comparative metrics and audit logs.
   */
  public static generateCSV(record: ExperimentRecord): string {
    const brief = this.generateBriefData(record);
    const rows: string[][] = [
      ['CROWDWISE EVENT SAFETY PERMITTING BRIEF & COMPARATIVE AUDIT'],
      ['Venue', brief.section1_ExecutiveSummary.venue],
      ['Experiment ID', brief.section1_ExecutiveSummary.experimentId],
      ['Scenario Name', brief.section1_ExecutiveSummary.scenarioName],
      ['Date', brief.section1_ExecutiveSummary.experimentDate],
      ['Safety Verdict', brief.section1_ExecutiveSummary.safetyVerdict],
      ['Confidence Score', `${brief.section1_ExecutiveSummary.confidenceScore}%`],
      ['Permit Action', brief.section1_ExecutiveSummary.permitOfficerAction],
      [],
      ['COMPARATIVE PERFORMANCE METRICS'],
      ['Metric', 'Baseline (Run A)', 'Intervention (Run B)', 'Delta / Improvement'],
      [
        'Total Admitted Spectators',
        `${record.baselineResults.totalAdmitted}`,
        `${record.interventionResults.totalAdmitted}`,
        `${record.interventionResults.totalAdmitted - record.baselineResults.totalAdmitted}`
      ],
      [
        'Average Waiting Time (sec)',
        `${record.baselineResults.averageWaitTimeSec.toFixed(1)}s`,
        `${record.interventionResults.averageWaitTimeSec.toFixed(1)}s`,
        `${brief.section6_ComparativeResults.waitTimeImprovementPercent}% improvement`
      ],
      [
        'Peak Flow Rate (p/min)',
        `${record.baselineResults.peakThroughputPerMin}`,
        `${record.interventionResults.peakThroughputPerMin}`,
        `${brief.section6_ComparativeResults.throughputImprovementPercent}% change`
      ],
      [
        'Overall Peak Density (p/m²)',
        `${record.baselineResults.peakDensityOverall.toFixed(1)} p/m²`,
        `${record.interventionResults.peakDensityOverall.toFixed(1)} p/m²`,
        `${brief.section6_ComparativeResults.densityImprovementPercent}% improvement`
      ],
      [],
      ['THREE-ZONE SPATIAL DENSITY & DISPLACEMENT AUDIT'],
      ['Zone', 'Baseline Density', 'Intervention Density', 'Delta Density', 'Hazard Duration Delta'],
      [
        'Zone A: Turnstile Throat (80m²)',
        `${record.baselineResults.zoneA.density.toFixed(1)} p/m²`,
        `${record.interventionResults.zoneA.density.toFixed(1)} p/m²`,
        `${record.displacementResults.zoneADelta.absoluteDensityDelta.toFixed(1)} p/m²`,
        `${record.displacementResults.zoneADelta.hazardDurationDeltaSec.toFixed(1)}s`
      ],
      [
        'Zone B: Holding Concourse (250m²)',
        `${record.baselineResults.zoneB.density.toFixed(1)} p/m²`,
        `${record.interventionResults.zoneB.density.toFixed(1)} p/m²`,
        `${record.displacementResults.zoneBDelta.absoluteDensityDelta.toFixed(1)} p/m²`,
        `${record.displacementResults.zoneBDelta.hazardDurationDeltaSec.toFixed(1)}s`
      ],
      [
        'Zone C: Public Roadway (120m²)',
        `${record.baselineResults.zoneC.density.toFixed(1)} p/m²`,
        `${record.interventionResults.zoneC.density.toFixed(1)} p/m²`,
        `${record.displacementResults.zoneCDelta.absoluteDensityDelta.toFixed(1)} p/m²`,
        `${record.displacementResults.zoneCDelta.hazardDurationDeltaSec.toFixed(1)}s`
      ],
      [],
      ['DISPLACEMENT VERDICT SUMMARY'],
      ['Displacement Detected', brief.section7_DisplacementAnalysis.isDisplacementDetected ? 'YES' : 'NO'],
      ['Displaced Target Zone', brief.section7_DisplacementAnalysis.affectedTargetZone],
      ['Audit Explanation', `"${brief.section7_DisplacementAnalysis.displacementSummary.replace(/"/g, '""')}"`],
      [],
      ['EXPLAINABLE SUPPORTING FINDINGS'],
      ...brief.section8_FinalVerdict.supportingFindings.map((f, i) => [`Finding ${i + 1}`, `"${f.replace(/"/g, '""')}"`])
    ];

    return rows.map((r) => r.join(',')).join('\n');
  }

  /**
   * Helper to download CSV file directly in browser.
   */
  public static downloadCSV(record: ExperimentRecord): void {
    const csvContent = this.generateCSV(record);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `crowdwise_safety_brief_${record.experimentId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
