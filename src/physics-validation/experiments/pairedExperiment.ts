/**
 * CROWDWISE — Part D: Paired Counterfactual Experiment Runner
 * Evaluates matched Baseline (Run A) vs Intervention (Run B) runs
 * using an immutable deterministic arrival schedule and identical initial conditions.
 */

import { SyntheticDemandGenerator, ScenarioConfig } from '../../engine/SyntheticDemandGenerator';
import { SocialForceEngineCore } from '../../engine/SocialForceModel';
import { SpatialRiskDisplacementEngine } from '../engine/SpatialRiskDisplacementEngine';
import { PairedExperimentResult } from '../types/PhysicsValidationTypes';

export type PairedInterventionType =
  | 'BASELINE'
  | 'GATE_METERING'
  | 'HOLDING_AREA_ACCUMULATION'
  | 'AUXILIARY_GATE_ACTIVATION'
  | 'QUEUE_REDISTRIBUTION'
  | 'COUNTER_FLOW_SEPARATION'
  | 'UPSTREAM_BARRIER';

export function runPairedCounterfactualExperiment(
  intervention: PairedInterventionType = 'GATE_METERING',
  seed: number = 42
): PairedExperimentResult {
  // Generate immutable deterministic arrival schedule
  const scenarioConfig: ScenarioConfig = {
    id: 'paired_experiment_config',
    type: 'NORMAL',
    name: 'Paired Verification Scenario',
    description: 'Deterministic 480 p/m surge ingress for counterfactual testing',
    seed,
    baseInflowRate: 480,
    durationSeconds: 30
  };

  const schedule = SyntheticDemandGenerator.generateSchedule(scenarioConfig, 'LINK_ROAD');

  // Helper to run one branch of the experiment
  const runBranch = (isMitigated: boolean) => {
    // 48m x 30m arena
    const engine = new SocialForceEngineCore(48.0, 30.0, schedule.length + 20, seed);
    engine.init(seed);

    // Geometry layout:
    // Zone 1: Public Roadway [y in 24 to 28]
    // Zone 2: Holding Area [y in 18 to 24]
    // Zone 3: Queue & Concourse [y in 12 to 18]
    // Zone 4: Turnstile Throat [y in 8 to 12]
    // Zone 5: Downstream Vomitory [y in 4 to 8]

    // Physical walls forming gate entrance at x = 24.0, y = 10.0
    engine.addWall('left_funnel', 0, 10.0, 21.0, 10.0);
    engine.addWall('right_funnel', 27.0, 10.0, 48.0, 10.0);

    // Apply declared physical interventions
    if (isMitigated) {
      if (intervention === 'GATE_METERING') {
        // Metering: constrict outer entrance from 6m to 2.4m, slowing inflow into throat
        engine.addWall('meter_left', 0, 24.0, 22.8, 24.0);
        engine.addWall('meter_right', 25.2, 24.0, 48.0, 24.0);
      } else if (intervention === 'AUXILIARY_GATE_ACTIVATION') {
        // Secondary gate opened at x = 12.0
        engine.addWall('aux_open', 10.0, 10.0, 14.0, 10.0);
      } else if (intervention === 'COUNTER_FLOW_SEPARATION') {
        // Longitudinal center divider barrier
        engine.addWall('center_divider', 24.0, 10.0, 24.0, 24.0);
      } else if (intervention === 'UPSTREAM_BARRIER') {
        // Zigzag chicane baffles in holding area
        engine.addWall('baffle_1', 18.0, 20.0, 28.0, 20.0);
        engine.addWall('baffle_2', 20.0, 22.0, 30.0, 22.0);
      }
    }

    // Agent state tracking
    const simulatedAgents: {
      x: number;
      y: number;
      vx: number;
      vy: number;
      active: boolean;
      density: number;
    }[] = [];

    // Inject scheduled agents based on immutable arrival schedule
    for (let i = 0; i < schedule.length; i++) {
      const arr = schedule[i];
      // Target is through the primary throat (x = 24.0, y = 5.0)
      const targetX = 24.0 + (arr.spawnX % 4) - 2;
      const targetY = 5.0;
      const spawnX = 24.0 + ((arr.spawnX % 16) - 8);
      const spawnY = 26.0;

      engine.spawnAgent(spawnX, spawnY, targetX, targetY);
      simulatedAgents.push({
        x: spawnX,
        y: spawnY,
        vx: 0,
        vy: 0,
        active: true,
        density: 0.5
      });
    }

    // Run simulation for 15 seconds
    const durationSec = 15.0;
    const substeps = Math.round(durationSec / engine.DT);
    let admittedCount = 0;

    for (let step = 0; step < substeps; step++) {
      engine.stepSubstep();

      // Check admissions past y = 8.0
      for (let i = 0; i < engine.count; i++) {
        if (engine.active[i] === 1 && engine.y[i] <= 8.0) {
          admittedCount++;
          engine.despawnAgent(i);
        }
      }
    }

    // Sync agent coordinates for 5-zone spatial mapping (scale from meters to 20px=1m)
    const scaledAgents = simulatedAgents.map((a, idx) => ({
      x: idx < engine.count ? engine.x[idx] * 20 : a.x * 20,
      y: idx < engine.count ? engine.y[idx] * 20 : a.y * 20,
      vx: idx < engine.count ? engine.vx[idx] * 20 : 0,
      vy: idx < engine.count ? engine.vy[idx] * 20 : 0,
      active: idx < engine.count ? engine.active[idx] === 1 : false,
      density: 1.0
    }));

    const snapshot = SpatialRiskDisplacementEngine.sampleZones(scaledAgents, durationSec);
    const throughput = Math.round((admittedCount / (durationSec / 60)));

    return { snapshot, throughput, admittedCount };
  };

  // Run A: Baseline
  const baseline = runBranch(false);

  // Run B: Mitigated
  const mitigated = runBranch(true);

  // Detect displacement and compute safety verdict
  const displacementReport = SpatialRiskDisplacementEngine.compare(
    baseline.snapshot,
    mitigated.snapshot,
    baseline.throughput,
    mitigated.throughput
  );

  return {
    baselineSnapshot: baseline.snapshot,
    mitigatedSnapshot: mitigated.snapshot,
    baselinePeakDensity: baseline.snapshot.systemPeakDensity,
    mitigatedPeakDensity: mitigated.snapshot.systemPeakDensity,
    baselineHoldingAreaDensity: baseline.snapshot.zones.ZONE_2_HOLDING_AREA.meanDensity,
    mitigatedHoldingAreaDensity: mitigated.snapshot.zones.ZONE_2_HOLDING_AREA.meanDensity,
    baselineGateDensity: baseline.snapshot.zones.ZONE_4_THROAT.meanDensity,
    mitigatedGateDensity: mitigated.snapshot.zones.ZONE_4_THROAT.meanDensity,
    maxSpillbackMeters: Math.max(
      mitigated.snapshot.zones.ZONE_1_PUBLIC_ROAD.longitudinalSpillbackMeters,
      mitigated.snapshot.zones.ZONE_2_HOLDING_AREA.longitudinalSpillbackMeters
    ),
    avgWaitTimeSec: mitigated.snapshot.zones.ZONE_3_QUEUE_CONCOURSE.avgWaitTimeSec,
    throughputPerMin: mitigated.throughput,
    hazardDurationSec: mitigated.snapshot.zones.ZONE_4_THROAT.hazardDurationSec,
    displacementReport
  };
}
