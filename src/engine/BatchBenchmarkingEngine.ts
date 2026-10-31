/**
 * CROWDWISE — Batch Benchmarking & Parametric Sweep Engine
 * Phase 4: Controlled Parametric Experimentation & Comparison
 * M. Chinnaswamy Stadium, Bengaluru
 *
 * Runs reproducible, seed-locked parameter sweeps across:
 * - Arrival Rates (240 to 960 p/min)
 * - Turnstile Staffing (2 to 6 counters)
 * - Walking Speeds (0.9 to 1.8 m/s)
 * - Counter-Flow Intensities (0% to 25%)
 * - Failure Modes (None, Outer Gate Fail, Turnstile Fail, Metro Surge)
 * - Intervention Strategies (None, Metering, S-Lanes, Directional, Combined)
 */

import { ControlledExperimentRunner, ExperimentRecord, InterventionType } from './ControlledExperimentRunner';
import { PRESET_SCENARIOS, ScenarioConfig } from './SyntheticDemandGenerator';

export interface BenchmarkTrialConfig {
  trialId: string;
  name: string;
  arrivalRate: number;
  turnstileCount: number;
  walkingSpeed: number;
  counterFlowPercent: number;
  interventions: InterventionType[];
  primaryGate: string;
  durationSeconds: number;
  seed: number;
}

export interface BenchmarkTrialResult {
  config: BenchmarkTrialConfig;
  record: ExperimentRecord;
  throughputPerMin: number;
  averageWaitTimeSec: number;
  peakThroatDensity: number;
  peakConcourseDensity: number;
  peakRoadDensity: number;
  displacementDetected: boolean;
  percentageSafetyImprovement: number;
  verdict: string;
}

export class BatchBenchmarkingEngine {
  /**
   * Pre-configured parametric benchmark suites.
   */
  public static getStandardBenchmarkSuites(): BenchmarkTrialConfig[] {
    return [
      {
        trialId: 'suite_inflow_low',
        name: 'Inflow Calibration: Low (240 p/min)',
        arrivalRate: 240,
        turnstileCount: 4,
        walkingSpeed: 1.34,
        counterFlowPercent: 0,
        interventions: ['METERING'],
        primaryGate: 'E22',
        durationSeconds: 30,
        seed: 42
      },
      {
        trialId: 'suite_inflow_nominal',
        name: 'Inflow Calibration: Nominal (360 p/min)',
        arrivalRate: 360,
        turnstileCount: 4,
        walkingSpeed: 1.34,
        counterFlowPercent: 0,
        interventions: ['METERING', 'QUEUE_MANAGEMENT'],
        primaryGate: 'E22',
        durationSeconds: 30,
        seed: 42
      },
      {
        trialId: 'suite_inflow_surge',
        name: 'Inflow Calibration: Surge (720 p/min)',
        arrivalRate: 720,
        turnstileCount: 4,
        walkingSpeed: 1.45,
        counterFlowPercent: 0.05,
        interventions: ['METERING', 'QUEUE_MANAGEMENT', 'REROUTING'],
        primaryGate: 'E11',
        durationSeconds: 30,
        seed: 42
      },
      {
        trialId: 'suite_counter_flow_stress',
        name: 'Stress Test: 15% Counter-Flow Shock',
        arrivalRate: 420,
        turnstileCount: 4,
        walkingSpeed: 1.2,
        counterFlowPercent: 0.15,
        interventions: ['DIRECTIONAL_SEPARATION', 'QUEUE_MANAGEMENT'],
        primaryGate: 'E22',
        durationSeconds: 30,
        seed: 101
      },
      {
        trialId: 'suite_turnstile_choke',
        name: 'Capacity Constraint: 2-Counter Failure',
        arrivalRate: 480,
        turnstileCount: 2,
        walkingSpeed: 1.34,
        counterFlowPercent: 0,
        interventions: ['METERING', 'TURNSTILE_LOAD_BALANCING'],
        primaryGate: 'E22',
        durationSeconds: 30,
        seed: 202
      }
    ];
  }

  /**
   * Executes a batch benchmarking suite synchronously or progressively.
   */
  public static runBenchmarkSuite(
    configs: BenchmarkTrialConfig[] = this.getStandardBenchmarkSuites()
  ): BenchmarkTrialResult[] {
    return configs.map((cfg) => {
      const scenario: ScenarioConfig = {
        ...PRESET_SCENARIOS.NORMAL_INGRESS,
        id: `scen_${cfg.trialId}`,
        name: cfg.name,
        seed: cfg.seed,
        baseInflowRate: cfg.arrivalRate,
        walkingSpeed: cfg.walkingSpeed,
        durationSeconds: cfg.durationSeconds,
        selectedOuterGates: [cfg.primaryGate],
        ticketRejection: cfg.counterFlowPercent > 0
          ? {
              rejectionPercentage: cfg.counterFlowPercent,
              wrongGatePercentage: 0.04,
              duplicatePercentage: 0.02,
              recoveryCorridorCapacity: 160
            }
          : undefined
      };

      const record = ControlledExperimentRunner.runExperiment(
        scenario,
        cfg.interventions,
        cfg.primaryGate,
        0.05
      );

      const basePeak = record.baselineResults.peakDensityOverall;
      const intervPeak = record.interventionResults.peakDensityOverall;
      const improvement = basePeak > 0 ? Math.round(((basePeak - intervPeak) / basePeak) * 100) : 0;

      return {
        config: cfg,
        record,
        throughputPerMin: record.interventionResults.peakThroughputPerMin,
        averageWaitTimeSec: record.interventionResults.averageWaitTimeSec,
        peakThroatDensity: record.interventionResults.zoneA.peakDensity,
        peakConcourseDensity: record.interventionResults.zoneB.peakDensity,
        peakRoadDensity: record.interventionResults.zoneC.peakDensity,
        displacementDetected: record.displacementResults.isDisplacementDetected,
        percentageSafetyImprovement: improvement,
        verdict: record.safetyVerdict.verdict
      };
    });
  }
}

