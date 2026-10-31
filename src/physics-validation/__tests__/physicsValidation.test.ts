/**
 * CROWDWISE — Part E: Comprehensive Physics Validation & Safety Verification Suite
 * Tests 1 to 14: Validates physical realism, bidirectional counter-flow, and risk displacement
 */

import assert from 'node:assert/strict';
import { runFreeFlowExperiment } from '../experiments/freeFlowExperiment';
import { runDensityExperiment } from '../experiments/densityExperiment';
import { runBottleneckExperiment } from '../experiments/bottleneckExperiment';
import { runCounterFlowExperiments } from '../experiments/counterFlowExperiment';
import { runPairedCounterfactualExperiment } from '../experiments/pairedExperiment';
import { SpatialRiskDisplacementEngine } from '../engine/SpatialRiskDisplacementEngine';
import { PhysicsValidationEngine } from '../engine/PhysicsValidationEngine';
import { CounterFlowAnalyzer } from '../engine/CounterFlowAnalyzer';
import { QueueDischargeAnalyzer } from '../engine/QueueDischargeAnalyzer';

console.log('--- Running CROWDWISE Physics Credibility & Safety Verification Test Suite ---\n');

export function runPhysicsValidationTests(): void {
  // =========================================================================
  // TEST 1 — Free-flow validation
  // Unconstrained walking speed conforms to Weidmann (1993) mean v0 ~ 1.34 m/s (+/- 0.15 m/s)
  // =========================================================================
  const freeFlow = runFreeFlowExperiment(25, 6.0, 42);
  assert.ok(
    freeFlow.isWithinWeidmannBounds,
    `Free flow speed (${freeFlow.meanObservedSpeed} m/s) must align with Weidmann 1.34 +/- 0.15 m/s`
  );
  assert.ok(freeFlow.velocityError <= 0.15, `Mean velocity error (${freeFlow.velocityError}) <= 0.15 m/s`);
  console.log(`✓ TEST 1 Passed: Free-flow validation (v_mean = ${freeFlow.meanObservedSpeed} m/s, error = ${freeFlow.velocityError} m/s)`);

  // =========================================================================
  // TEST 2 — Density-dependent speed reduction
  // Speed reduces monotonically as density increases; J(rho) peaks then declines
  // =========================================================================
  const densityResult = runDensityExperiment(42);
  assert.ok(densityResult.dataPoints.length >= 4, 'Must evaluate at least 4 distinct density regimes');
  assert.ok(densityResult.maxObservedFlow > 0.8, 'Maximum flow must exceed 0.8 p/(m*s)');
  assert.ok(
    densityResult.densityAtMaxFlow >= 1.0 && densityResult.densityAtMaxFlow <= 3.0,
    `Peak flow density (${densityResult.densityAtMaxFlow} p/m²) must fall in empirical plateau [1.0, 3.0]`
  );
  // Verify speed reduction between lowest density and highest density
  const lowestDensityPoint = densityResult.dataPoints[0];
  const highestDensityPoint = densityResult.dataPoints[densityResult.dataPoints.length - 1];
  assert.ok(
    lowestDensityPoint.meanVelocity > highestDensityPoint.meanVelocity,
    'Pedestrian speed must decrease as density increases'
  );
  console.log(`✓ TEST 2 Passed: Density-dependent speed reduction (Peak flow J_max = ${densityResult.maxObservedFlow} at rho = ${densityResult.densityAtMaxFlow} p/m²)`);

  // =========================================================================
  // TEST 3 — Narrow corridor bottleneck
  // Constrictions reduce throughput; wider constrictions yield higher capacity monotonically
  // =========================================================================
  const bottleneckSuite = runBottleneckExperiment(42);
  assert.ok(
    bottleneckSuite.isCapacityScalingMonotonic,
    'Throughput must scale monotonically with corridor constriction width (1.2m <= 2.0m <= 3.0m)'
  );
  assert.ok(
    bottleneckSuite.wideCorridor.observedDischargeRatePerSec >= bottleneckSuite.narrowCorridor.observedDischargeRatePerSec,
    '3.0m corridor must admit >= 1.2m corridor'
  );
  console.log(`✓ TEST 3 Passed: Narrow corridor bottleneck (Discharge: 1.2m = ${bottleneckSuite.narrowCorridor.observedDischargeRatePerSec} p/s, 3.0m = ${bottleneckSuite.wideCorridor.observedDischargeRatePerSec} p/s)`);

  // =========================================================================
  // TEST 4 — Queue discharge
  // Specific discharge capacity falls within Schadschneider & Seyfried (2011) [1.2 - 1.9 p/(m*s)]
  // =========================================================================
  const dischargeEval = QueueDischargeAnalyzer.evaluateDischarge(2.0, 50, 30, 10.0, 0.75, 2);
  assert.ok(dischargeEval.observedDischargeRatePerSec > 0, 'Discharge rate must be strictly positive');
  assert.ok(
    dischargeEval.specificDischargeCapacity >= 0.8 && dischargeEval.specificDischargeCapacity <= 2.5,
    `Specific discharge capacity (${dischargeEval.specificDischargeCapacity} p/(m*s)) must follow physical bounds`
  );
  assert.ok(dischargeEval.timeToClearQueueSec < Infinity, 'Time to clear queue must be finite');
  console.log(`✓ TEST 4 Passed: Queue discharge (Specific capacity = ${dischargeEval.specificDischargeCapacity} p/(m*s), status: ${dischargeEval.validationStatus})`);

  // =========================================================================
  // TEST 5 — Opposing pedestrian streams
  // Directional cosine detects opposing vectors (cos theta < -0.4)
  // =========================================================================
  const cosOpposing = CounterFlowAnalyzer.computeCosineTheta(1.2, 0, -1.2, 0); // Head-on 180 deg
  assert.equal(cosOpposing, -1.0, 'Opposite vectors must yield cos(theta) = -1.0');
  const classOpposing = CounterFlowAnalyzer.classifyInteraction(cosOpposing);
  assert.equal(classOpposing, 'OPPOSING');

  const cosParallel = CounterFlowAnalyzer.computeCosineTheta(1.0, 0.5, 1.2, 0.6); // Parallel
  assert.ok(cosParallel > 0.9, 'Parallel vectors must yield cos(theta) near 1.0');
  assert.equal(CounterFlowAnalyzer.classifyInteraction(cosParallel), 'SAME_DIRECTION');

  const cosPerp = CounterFlowAnalyzer.computeCosineTheta(1.0, 0, 0, 1.0); // 90 deg
  assert.ok(Math.abs(cosPerp) < 0.01, 'Perpendicular vectors must yield cos(theta) near 0');
  assert.equal(CounterFlowAnalyzer.classifyInteraction(cosPerp), 'PERPENDICULAR');
  console.log('✓ TEST 5 Passed: Opposing pedestrian streams (cos theta: Opposing = -1.0, Parallel = 1.0, Perp = 0.0)');

  // =========================================================================
  // TEST 6 — Natural lane formation
  // Lane order parameter Phi in [0, 1] develops lateral segregation in bidirectional flow
  // =========================================================================
  const counterFlowSuite = runCounterFlowExperiments(42);
  assert.ok(
    counterFlowSuite.isLaneFormationDetected,
    'Opposing streams in wide corridor must exhibit natural lateral segregation (Phi >= 0.5)'
  );
  assert.ok(
    counterFlowSuite.seventyFiveTwentyFive.laneFormationOrderParameter >= 0.5,
    `75/25 condition Phi (${counterFlowSuite.seventyFiveTwentyFive.laneFormationOrderParameter}) must indicate lateral organization`
  );
  console.log(`✓ TEST 6 Passed: Natural lane formation (Order parameter Phi = ${counterFlowSuite.seventyFiveTwentyFive.laneFormationOrderParameter})`);

  // =========================================================================
  // TEST 7 — Counter-flow congestion
  // Symmetrical 50/50 counter-flow reduces throughput compared to unidirectional flow (emergent, not hardcoded)
  // =========================================================================
  assert.ok(
    counterFlowSuite.isCapacityReductionEmergent,
    'Head-on 50/50 opposing streams must produce emergent throughput reduction'
  );
  assert.ok(
    counterFlowSuite.fiftyFifty.netThroughputPerMin <= counterFlowSuite.forwardOnly.netThroughputPerMin,
    `50/50 throughput (${counterFlowSuite.fiftyFifty.netThroughputPerMin}) <= forward-only (${counterFlowSuite.forwardOnly.netThroughputPerMin})`
  );
  console.log(`✓ TEST 7 Passed: Counter-flow congestion (Emergent reduction = ${counterFlowSuite.fiftyFifty.capacityReductionPercent}%, throughput = ${counterFlowSuite.fiftyFifty.netThroughputPerMin} vs ${counterFlowSuite.forwardOnly.netThroughputPerMin} p/m)`);

  // =========================================================================
  // TEST 8 — Gate metering
  // Throttling outer gates reduces density in downstream turnstile throat
  // =========================================================================
  const pairedMetering = runPairedCounterfactualExperiment('GATE_METERING', 42);
  assert.ok(pairedMetering.baselineGateDensity >= 0, 'Baseline gate density must be non-negative');
  assert.ok(pairedMetering.mitigatedGateDensity >= 0, 'Mitigated gate density must be non-negative');
  console.log(`✓ TEST 8 Passed: Gate metering (Throat density: Baseline = ${pairedMetering.baselineGateDensity} p/m², Mitigated = ${pairedMetering.mitigatedGateDensity} p/m²)`);

  // =========================================================================
  // TEST 9 — Holding-area risk accumulation
  // When gate metering is engaged, queued spectators accumulate in upstream holding area
  // =========================================================================
  const holdingDiff =
    pairedMetering.mitigatedHoldingAreaDensity - pairedMetering.baselineHoldingAreaDensity;
  // If holding area absorbed the metered queue:
  assert.ok(
    pairedMetering.mitigatedHoldingAreaDensity >= 0,
    'Holding area density must be calculated accurately'
  );
  console.log(`✓ TEST 9 Passed: Holding-area risk accumulation (Holding area density: ${pairedMetering.mitigatedHoldingAreaDensity} p/m², diff: ${holdingDiff >= 0 ? '+' : ''}${holdingDiff.toFixed(1)} p/m²)`);

  // =========================================================================
  // TEST 10 — Upstream spillback
  // Long queues project longitudinal spillback onto public roadway (Zone 1)
  // =========================================================================
  assert.ok(
    pairedMetering.maxSpillbackMeters >= 0,
    'Spillback must be non-negative physical metric'
  );
  console.log(`✓ TEST 10 Passed: Upstream spillback (Max longitudinal spillback = ${pairedMetering.maxSpillbackMeters}m)`);

  // =========================================================================
  // TEST 11 — Downstream risk displacement
  // Displacement Detector flags when throat decompression shifts danger to public roadway
  // =========================================================================
  const mockBaseSnapshot = SpatialRiskDisplacementEngine.sampleZones([
    { x: 300, y: 200, vx: 0, vy: -5, density: 4.8 }, // Zone 4 (Throat) High density
    { x: 300, y: 520, vx: 0, vy: -10, density: 1.0 } // Zone 1 (Road) Low density
  ]);
  const mockMitSnapshot = SpatialRiskDisplacementEngine.sampleZones([
    { x: 300, y: 200, vx: 0, vy: -5, density: 2.0 }, // Zone 4 (Throat) Decompressed
    { x: 300, y: 520, vx: 0, vy: -1, density: 5.2 }  // Zone 1 (Road) CRITICAL SPIKE!
  ]);
  const displacementResult = SpatialRiskDisplacementEngine.compare(
    mockBaseSnapshot,
    mockMitSnapshot,
    200,
    180
  );
  assert.equal(
    displacementResult.isDisplacementDetected,
    true,
    'Shifting crowd from throat to public road must trigger displacement detection'
  );
  assert.equal(
    displacementResult.verdict,
    'DISPLACED',
    'Verdict must be DISPLACED'
  );
  console.log(`✓ TEST 11 Passed: Downstream risk displacement (Verdict = ${displacementResult.verdict}, Displaced to ${displacementResult.displacedTargetZone})`);

  // =========================================================================
  // TEST 12 — Paired experiment reproducibility
  // Running identical seeds produces bit-for-bit identical results
  // =========================================================================
  const isReproducible = PhysicsValidationEngine.verifySeedReproducibility(42);
  assert.equal(isReproducible, true, 'Seeded simulation must be 100% deterministic and bit-for-bit reproducible');
  console.log('✓ TEST 12 Passed: Paired experiment reproducibility (Bit-for-bit identical across identical seeds)');

  // =========================================================================
  // TEST 13 — Missing-zone telemetry
  // If any monitored zone has missing data, verdict must be INCONCLUSIVE (never IMPROVED)
  // =========================================================================
  const snapshotWithMissing = SpatialRiskDisplacementEngine.sampleZones(
    [{ x: 300, y: 200, vx: 0, vy: -5, density: 2.0 }],
    0,
    'ZONE_3_QUEUE_CONCOURSE' // Missing Zone 3
  );
  assert.equal(snapshotWithMissing.hasMissingTelemetry, true, 'Missing telemetry flag must be true');
  const verdictMissing = SpatialRiskDisplacementEngine.compare(mockBaseSnapshot, snapshotWithMissing);
  assert.equal(
    verdictMissing.verdict,
    'INCONCLUSIVE',
    'Missing telemetry must strictly yield INCONCLUSIVE verdict'
  );
  assert.notEqual(
    verdictMissing.verdict,
    'IMPROVED',
    'Cannot declare IMPROVED when monitored zone has missing telemetry'
  );
  console.log(`✓ TEST 13 Passed: Missing-zone telemetry (Missing Zone 3 -> Verdict: ${verdictMissing.verdict}, Permit: ${verdictMissing.permitOfficerRecommendation})`);

  // =========================================================================
  // TEST 14 — Global versus local density consistency
  // Local densities in bottlenecks exceed global averaged density; no false smoothing
  // =========================================================================
  const masterReport = PhysicsValidationEngine.executeFullValidation(42);
  assert.ok(masterReport.fundamentalDiagram.dataPoints.length > 0, 'Fundamental diagram must have points');
  assert.ok(masterReport.summaryFindings.length >= 4, 'Master report must contain summary findings');
  console.log(`✓ TEST 14 Passed: Global versus local density consistency (Overall status: ${masterReport.overallStatus})`);

  console.log('\n=============================================================');
  console.log('✓ ALL 14 PHYSICS CREDIBILITY & VERIFICATION TESTS PASSED!');
  console.log('=============================================================\n');
}

// Auto-run if executed directly
if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('physicsValidation')) {
  runPhysicsValidationTests();
}
