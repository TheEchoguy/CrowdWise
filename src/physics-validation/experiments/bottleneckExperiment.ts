/**
 * CROWDWISE — Experiment C: Narrow Corridor & Bottleneck Discharge
 * Evaluates queue discharge rates and capacity scaling across constriction widths
 * References: Schadschneider & Seyfried (2011)
 */

import { SocialForceEngineCore } from '../../engine/SocialForceModel';
import { SeededPRNG } from '../../engine/prng';
import { QueueDischargeAnalyzer, BottleneckDischargeReport } from '../engine/QueueDischargeAnalyzer';

export interface BottleneckExperimentSuite {
  narrowCorridor: BottleneckDischargeReport; // 1.2m constriction
  mediumCorridor: BottleneckDischargeReport; // 2.0m constriction
  wideCorridor: BottleneckDischargeReport;   // 3.0m constriction
  isCapacityScalingMonotonic: boolean;      // Wider constriction yields strictly >= throughput
}

export function runBottleneckExperiment(seed: number = 42): BottleneckExperimentSuite {
  const widths = [1.2, 2.0, 3.0];
  const reports: BottleneckDischargeReport[] = [];

  for (const width of widths) {
    const queueCount = 40;
    const engine = new SocialForceEngineCore(30.0, 16.0, queueCount + 10, seed);
    engine.init(seed);

    const prng = new SeededPRNG(seed);

    // Arena with bottleneck at x = 15.0
    // Corridor Y center = 8.0, opening from (8 - width/2) to (8 + width/2)
    const yTop = 8.0 - width / 2.0;
    const yBottom = 8.0 + width / 2.0;

    // Boundary walls forming bottleneck constriction
    engine.addWall('top_wall', 0, 0, 30, 0);
    engine.addWall('bot_wall', 0, 16, 30, 16);
    engine.addWall('funnel_top', 15.0, 0, 15.0, yTop);
    engine.addWall('funnel_bot', 15.0, yBottom, 15.0, 16.0);

    // Spawn queue behind constriction at x in [4.0, 14.0], y in [4.0, 12.0]
    for (let i = 0; i < queueCount; i++) {
      const x = prng.nextRangeFloat(4.0, 14.0);
      const y = prng.nextRangeFloat(4.0, 12.0);
      engine.spawnAgent(x, y, 25.0, 8.0); // Target beyond bottleneck
    }

    // Step simulation for 12.0 seconds
    const durationSec = 12.0;
    const totalSubsteps = Math.round(durationSec / engine.DT);
    let discharged = 0;
    let firstDischargeTimeSec = -1;
    let lastDischargeTimeSec = -1;

    for (let step = 0; step < totalSubsteps; step++) {
      engine.stepSubstep();
      const currentTime = step * engine.DT;

      // Count directional crossing through bottleneck (x >= 15.5 with positive eastward velocity)
      for (let i = 0; i < engine.count; i++) {
        if (engine.active[i] === 1 && engine.x[i] >= 15.5 && engine.vx[i] > 0) {
          discharged++;
          if (firstDischargeTimeSec < 0) {
            firstDischargeTimeSec = currentTime;
          }
          lastDischargeTimeSec = currentTime;
          engine.despawnAgent(i); // Clear out so they don't block downstream
        }
      }
    }

    // Active discharge duration: measures true active clearing window without idle dilution
    const activeDischargeDurationSec =
      discharged >= 2 && lastDischargeTimeSec > firstDischargeTimeSec
        ? Math.max(1.0, lastDischargeTimeSec - firstDischargeTimeSec)
        : durationSec;

    // Active lanes proportional to width
    const lanes = Math.max(1, Math.round(width / 0.8));
    const report = QueueDischargeAnalyzer.evaluateDischarge(
      width,
      queueCount,
      discharged,
      durationSec,
      0.75,
      lanes,
      activeDischargeDurationSec
    );
    reports.push(report);
  }

  const [narrow, medium, wide] = reports;
  const monotonic =
    wide.observedDischargeRatePerSec >= medium.observedDischargeRatePerSec &&
    medium.observedDischargeRatePerSec >= narrow.observedDischargeRatePerSec;

  return {
    narrowCorridor: narrow,
    mediumCorridor: medium,
    wideCorridor: wide,
    isCapacityScalingMonotonic: monotonic
  };
}

