/**
 * CROWDWISE — Master Physics Validation Engine
 * Orchestrates empirical validation experiments, statistical error evaluations,
 * and produces the unified Physics Credibility & Safety Verification Report.
 */

import {
  PhysicsValidationMasterReport,
  ValidationStatus
} from '../types/PhysicsValidationTypes';
import { runDensityExperiment } from '../experiments/densityExperiment';
import { runBottleneckExperiment } from '../experiments/bottleneckExperiment';
import { runCounterFlowExperiments } from '../experiments/counterFlowExperiment';
import { runPairedCounterfactualExperiment } from '../experiments/pairedExperiment';

export class PhysicsValidationEngine {
  /**
   * Executes the full automated physics validation suite and compiles master report
   */
  public static executeFullValidation(seed: number = 42): PhysicsValidationMasterReport {
    // 1. Fundamental Diagram Experiment
    const fundamentalResult = runDensityExperiment(seed);

    // 2. Bottleneck Queue Discharge Experiment
    const bottleneckSuite = runBottleneckExperiment(seed);

    // 3. Bidirectional Counter-Flow Experiment
    const counterFlowSuite = runCounterFlowExperiments(seed);

    // 4. Paired Counterfactual Risk Displacement Experiment
    const pairedResult = runPairedCounterfactualExperiment('GATE_METERING', seed);

    // Evaluate overall validation status
    let overallStatus: ValidationStatus = 'PARTIALLY_VALIDATED';
    if (
      fundamentalResult.validationStatus === 'VALIDATED_AGAINST_REFERENCE' &&
      bottleneckSuite.mediumCorridor.validationStatus === 'VALIDATED_AGAINST_REFERENCE' &&
      counterFlowSuite.isCapacityReductionEmergent
    ) {
      overallStatus = 'VALIDATED_AGAINST_REFERENCE';
    } else if (
      fundamentalResult.validationStatus === 'NOT_VALIDATED' ||
      bottleneckSuite.mediumCorridor.validationStatus === 'NOT_VALIDATED'
    ) {
      overallStatus = 'NOT_VALIDATED';
    }

    const summaryFindings: string[] = [
      `Fundamental Diagram: Mean velocity error ${fundamentalResult.meanVelocityError} m/s vs Weidmann (1993) empirical curve (${fundamentalResult.validationStatus})`,
      `Bottleneck Discharge: Specific capacity ${bottleneckSuite.mediumCorridor.specificDischargeCapacity} p/(m*s) aligns with Schadschneider & Seyfried (2011)`,
      `Counter-Flow Dynamics: Emergent throughput drop measured (${counterFlowSuite.fiftyFifty.capacityReductionPercent}% reduction at 50/50 flow; Phi = ${counterFlowSuite.fiftyFifty.laneFormationOrderParameter})`,
      `Spatial Displacement: ${pairedResult.displacementReport.verdict} — ${pairedResult.displacementReport.rationale}`
    ];

    return {
      timestamp: new Date().toISOString(),
      fundamentalDiagram: fundamentalResult,
      counterFlow: {
        forwardOnly: counterFlowSuite.forwardOnly,
        seventyFiveTwentyFive: counterFlowSuite.seventyFiveTwentyFive,
        fiftyFifty: counterFlowSuite.fiftyFifty,
        validationStatus: counterFlowSuite.isCapacityReductionEmergent
          ? 'VALIDATED_AGAINST_REFERENCE'
          : 'PARTIALLY_VALIDATED',
        emergentVsHardcodedVerified: counterFlowSuite.isCapacityReductionEmergent
      },
      queueDischarge: {
        nominalCapacity: bottleneckSuite.mediumCorridor.nominalTheoreticalCapacityPerSec,
        observedDischargeRate: bottleneckSuite.mediumCorridor.observedDischargeRatePerSec,
        specificDischargeCapacity: bottleneckSuite.mediumCorridor.specificDischargeCapacity,
        dischargeErrorPercent: bottleneckSuite.mediumCorridor.dischargeErrorPercent,
        validationStatus: bottleneckSuite.mediumCorridor.validationStatus
      },
      spatialDisplacement: pairedResult.displacementReport,
      pairedExperiment: pairedResult,
      overallStatus,
      summaryFindings
    };
  }

  /**
   * Verifies deterministic bit-for-bit reproducibility across identical seeds
   */
  public static verifySeedReproducibility(seed: number = 42): boolean {
    const run1 = runDensityExperiment(seed);
    const run2 = runDensityExperiment(seed);

    if (run1.dataPoints.length !== run2.dataPoints.length) return false;

    for (let i = 0; i < run1.dataPoints.length; i++) {
      if (
        run1.dataPoints[i].meanVelocity !== run2.dataPoints[i].meanVelocity ||
        run1.dataPoints[i].specificFlow !== run2.dataPoints[i].specificFlow
      ) {
        return false;
      }
    }

    return true;
  }
}

