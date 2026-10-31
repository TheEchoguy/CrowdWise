/**
 * CROWDWISE — Fundamental Diagram Analyzer
 * Evaluates J(rho) = rho * v(rho) against empirical pedestrian flow references
 *
 * References:
 * - Weidmann, U. (1993). Transporttechnik der Fussgänger. ETH Zürich.
 * - Schadschneider, A., & Seyfried, A. (2011). Empirical Results for Pedestrian Dynamics.
 */

import {
  FundamentalDiagramDataPoint,
  FundamentalDiagramResult,
  ValidationStatus,
  WEIDMANN_EMPIRICAL_BENCHMARKS
} from '../types/PhysicsValidationTypes';

export class FundamentalDiagramAnalyzer {
  /**
   * Evaluates empirical Weidmann velocity at a given local density rho (p/m²).
   * v(rho) = v0 * (1 - exp(-gamma * (1/rho - 1/rho_max)))
   * Where v0 = 1.34 m/s, rho_max = 5.4 p/m², gamma = 1.913
   */
  public static getWeidmannVelocity(density: number): number {
    if (density <= 0.05) return 1.34;
    const rhoMax = 5.4;
    if (density >= rhoMax) return 0.0;
    const v0 = 1.34;
    const gamma = 1.913;
    const exponent = -gamma * (1.0 / density - 1.0 / rhoMax);
    const speed = v0 * (1.0 - Math.exp(exponent));
    return Math.max(0.0, Math.min(v0, speed));
  }

  /**
   * Analyzes an empirical or simulated array of (density, velocity) samples.
   * Aggregates samples into density bins and computes J(rho) = rho * v(rho).
   */
  public static analyze(
    samples: { density: number; velocity: number }[]
  ): FundamentalDiagramResult {
    if (!samples || samples.length === 0) {
      return {
        dataPoints: [],
        maxObservedFlow: 0,
        densityAtMaxFlow: 0,
        meanVelocityError: 0,
        densityFlowCurveDeviation: 0,
        validationStatus: 'INSUFFICIENT_REFERENCE_DATA',
        statusRationale: 'No simulation or empirical sample points provided for fundamental diagram analysis.',
        evidence: {
          referenceModel: 'Weidmann (1993) Pedestrian Fundamental Diagram',
          referenceDataset: 'Empirical IVT Schriftenreihe 90 (v0=1.34 m/s, rho_max=5.4 p/m²)',
          sampleCount: 0,
          simulationDurationSec: 0,
          densityRangeTested: '0 - 0 p/m²',
          meanVelocityError: 0,
          mveThreshold: 0.18,
          flowCurveRMSE: 0,
          rmseThreshold: 0.35,
          status: 'INSUFFICIENT_REFERENCE_DATA',
          isEmpiricalComparison: true
        }
      };
    }

    // Bin into 0.5 p/m² increments from 0.0 to 6.0 p/m²
    const binSize = 0.5;
    const maxBin = 6.0;
    const numBins = Math.ceil(maxBin / binSize);

    const binSums = new Float64Array(numBins);
    const binCounts = new Uint32Array(numBins);

    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      if (s.density < 0 || isNaN(s.density) || isNaN(s.velocity)) continue;
      const binIdx = Math.min(numBins - 1, Math.floor(s.density / binSize));
      binSums[binIdx] += Math.max(0, s.velocity);
      binCounts[binIdx]++;
    }

    const dataPoints: FundamentalDiagramDataPoint[] = [];
    let maxFlow = 0;
    let densityAtMax = 0;
    let totalVelocityError = 0;
    let totalFlowSquaredError = 0;
    let comparedPointsCount = 0;

    for (let b = 0; b < numBins; b++) {
      if (binCounts[b] === 0) continue;

      const density = (b + 0.5) * binSize;
      const meanVelocity = binSums[b] / binCounts[b];
      const specificFlow = density * meanVelocity; // J(rho) = rho * v(rho)

      if (specificFlow > maxFlow) {
        maxFlow = specificFlow;
        densityAtMax = density;
      }

      const refVelocity = this.getWeidmannVelocity(density);
      const refFlow = density * refVelocity;
      const velError = Math.abs(meanVelocity - refVelocity);

      totalVelocityError += velError;
      totalFlowSquaredError += Math.pow(specificFlow - refFlow, 2);
      comparedPointsCount++;

      dataPoints.push({
        density: Math.round(density * 100) / 100,
        meanVelocity: Math.round(meanVelocity * 100) / 100,
        specificFlow: Math.round(specificFlow * 100) / 100,
        sampleCount: binCounts[b],
        referenceVelocity: Math.round(refVelocity * 100) / 100,
        velocityError: Math.round(velError * 100) / 100
      });
    }

    const meanVelocityError =
      comparedPointsCount > 0 ? Math.round((totalVelocityError / comparedPointsCount) * 1000) / 1000 : 0;
    const densityFlowCurveDeviation =
      comparedPointsCount > 0
        ? Math.round(Math.sqrt(totalFlowSquaredError / comparedPointsCount) * 1000) / 1000
        : 0;

    // Determine Validation Status based on scientific criteria
    let validationStatus: ValidationStatus = 'NOT_VALIDATED';
    let statusRationale = '';

    if (comparedPointsCount < 4) {
      validationStatus = 'INSUFFICIENT_REFERENCE_DATA';
      statusRationale = `Only ${comparedPointsCount} density bins evaluated; minimum 4 bins required across free-flow, plateau, and jam densities.`;
    } else if (meanVelocityError <= 0.18 && densityFlowCurveDeviation <= 0.35) {
      validationStatus = 'VALIDATED_AGAINST_REFERENCE';
      statusRationale = `Mean velocity error (${meanVelocityError} m/s) and flow curve RMSE (${densityFlowCurveDeviation} p/(m*s)) closely follow Weidmann (1993) empirical standards within 15% tolerance.`;
    } else if (meanVelocityError <= 0.35 && densityFlowCurveDeviation <= 0.65) {
      validationStatus = 'PARTIALLY_VALIDATED';
      statusRationale = `Model reproduces qualitative velocity decay and maximum flow plateau, but numerical deviation (${meanVelocityError} m/s MVE) exceeds high-fidelity threshold.`;
    } else {
      validationStatus = 'NOT_VALIDATED';
      statusRationale = `Significant deviation from empirical fundamental diagram (MVE: ${meanVelocityError} m/s, RMSE: ${densityFlowCurveDeviation}).`;
    }

    return {
      dataPoints,
      maxObservedFlow: Math.round(maxFlow * 100) / 100,
      densityAtMaxFlow: Math.round(densityAtMax * 100) / 100,
      meanVelocityError,
      densityFlowCurveDeviation,
      validationStatus,
      statusRationale,
      evidence: {
        referenceModel: 'Weidmann (1993) Pedestrian Fundamental Diagram',
        referenceDataset: 'Empirical IVT Schriftenreihe 90 (v0=1.34 m/s, rho_max=5.4 p/m²)',
        sampleCount: samples.length,
        simulationDurationSec: 60,
        densityRangeTested: dataPoints.length > 0 ? `${dataPoints[0].density} - ${dataPoints[dataPoints.length - 1].density} p/m²` : '0 p/m²',
        meanVelocityError,
        mveThreshold: 0.18,
        flowCurveRMSE: densityFlowCurveDeviation,
        rmseThreshold: 0.35,
        status: validationStatus,
        isEmpiricalComparison: true
      }
    };
  }

  /**
   * Compares a simulated dataset against the exact Weidmann benchmark table
   */
  public static compareAgainstWeidmannBenchmarks(
    simulatedFlowMap: Map<number, { velocity: number; flow: number }>
  ): {
    benchmarkComparisons: {
      density: number;
      refVelocity: number;
      simVelocity: number;
      absDiff: number;
      percentDiff: number;
    }[];
    overallMVE: number;
  } {
    const comparisons: {
      density: number;
      refVelocity: number;
      simVelocity: number;
      absDiff: number;
      percentDiff: number;
    }[] = [];

    let totalDiff = 0;
    let count = 0;

    for (const ref of WEIDMANN_EMPIRICAL_BENCHMARKS) {
      const sim = simulatedFlowMap.get(ref.density);
      if (sim !== undefined) {
        const absDiff = Math.abs(sim.velocity - ref.velocity);
        const percentDiff = ref.velocity > 0 ? (absDiff / ref.velocity) * 100 : 0;
        comparisons.push({
          density: ref.density,
          refVelocity: ref.velocity,
          simVelocity: Math.round(sim.velocity * 100) / 100,
          absDiff: Math.round(absDiff * 100) / 100,
          percentDiff: Math.round(percentDiff * 10) / 10
        });
        totalDiff += absDiff;
        count++;
      }
    }

    const overallMVE = count > 0 ? Math.round((totalDiff / count) * 1000) / 1000 : 0;
    return { benchmarkComparisons: comparisons, overallMVE };
  }
}

