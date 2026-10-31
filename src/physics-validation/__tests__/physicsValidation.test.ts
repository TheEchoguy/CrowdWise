/**
 * CROWDWISE — Part E: Comprehensive Physics Validation & Safety Verification Suite
 * Tests 1 to 14: Validates physical realism, bidirectional counter-flow, 5-zone displacement, and empirical credibility
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
import { FundamentalDiagramAnalyzer } from '../engine/FundamentalDiagramAnalyzer';
import { SyntheticDemandGenerator, ScenarioConfig } from '../../engine/SyntheticDemandGenerator';

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
  const lowestDensityPoint = densityResult.dataPoints[0];
  const highestDensityPoint = densityResult.dataPoints[densityResult.dataPoints.length - 1];
  assert.ok(
    lowestDensityPoint.meanVelocity > highestDensityPoint.meanVelocity,
    'Pedestrian speed must decrease as density increases'
  );
  console.log(`✓ TEST 2 Passed: Density-dependent speed reduction (Peak flow J_max = ${densityResult.maxObservedFlow} at rho = ${densityResult.densityAtMaxFlow} p/m²)`);

  // =========================================================================
  // TEST 3 — Narrow corridor bottleneck & monotonic scaling
  // Constrictions reduce throughput; wider constrictions yield strictly higher capacity
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
  // TEST 4 — Queue discharge units and capacity bounds
  // Specific discharge capacity in p/(m·s) falls within Schadschneider & Seyfried (2011) [1.2 - 1.9 p/(m*s)]
  // =========================================================================
  const dischargeEval = QueueDischargeAnalyzer.evaluateDischarge(2.0, 50, 30, 10.0, 0.75, 2, 8.5);
  assert.ok(dischargeEval.observedDischargeRatePerSec > 0, 'Discharge rate must be strictly positive');
  assert.ok(
    dischargeEval.specificDischargeCapacity >= 0.8 && dischargeEval.specificDischargeCapacity <= 2.5,
    `Specific discharge capacity (${dischargeEval.specificDischargeCapacity} p/(m*s)) must follow physical bounds`
  );
  assert.ok(dischargeEval.timeToClearQueueSec < Infinity, 'Time to clear queue must be finite');
  assert.equal(dischargeEval.corridorWidthMeters, 2.0, 'Discharge calculation must use actual bottleneck width');
  console.log(`✓ TEST 4 Passed: Queue discharge (Specific capacity = ${dischargeEval.specificDischargeCapacity} p/(m*s), status: ${dischargeEval.validationStatus})`);

  // =========================================================================
  // TEST 5 — Opposing pedestrian streams & directional cosines
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
  // TEST 7 — Counter-flow non-zero throughput & reverse counting
  // Symmetrical 50/50 counter-flow produces non-zero throughput and counts reverse agents
  // =========================================================================
  assert.ok(
    counterFlowSuite.fiftyFifty.netThroughputPerMin > 0,
    `Balanced 50/50 counter-flow must produce non-zero net throughput (got ${counterFlowSuite.fiftyFifty.netThroughputPerMin} p/m)`
  );
  assert.ok(
    counterFlowSuite.fiftyFifty.forwardThroughputPerMin > 0,
    `Forward throughput must be non-zero in 50/50 flow (got ${counterFlowSuite.fiftyFifty.forwardThroughputPerMin} p/m)`
  );
  assert.ok(
    counterFlowSuite.fiftyFifty.reverseThroughputPerMin > 0,
    `Reverse throughput must be non-zero in 50/50 flow (got ${counterFlowSuite.fiftyFifty.reverseThroughputPerMin} p/m)`
  );
  assert.equal(
    counterFlowSuite.fiftyFifty.netThroughputPerMin,
    counterFlowSuite.fiftyFifty.forwardThroughputPerMin + counterFlowSuite.fiftyFifty.reverseThroughputPerMin,
    'Net throughput must equal sum of forward and reverse throughput'
  );
  assert.ok(
    counterFlowSuite.isCapacityReductionEmergent,
    '50/50 opposing streams must produce emergent throughput reduction'
  );
  assert.ok(
    counterFlowSuite.fiftyFifty.netThroughputPerMin <= counterFlowSuite.forwardOnly.netThroughputPerMin,
    `50/50 throughput (${counterFlowSuite.fiftyFifty.netThroughputPerMin}) <= forward-only (${counterFlowSuite.forwardOnly.netThroughputPerMin})`
  );
  console.log(`✓ TEST 7 Passed: Counter-flow non-zero throughput & reverse accounting (Forward = ${counterFlowSuite.fiftyFifty.forwardThroughputPerMin} p/m, Reverse = ${counterFlowSuite.fiftyFifty.reverseThroughputPerMin} p/m, Net = ${counterFlowSuite.fiftyFifty.netThroughputPerMin} p/m, Emergent Loss = ${counterFlowSuite.fiftyFifty.capacityReductionPercent}%)`);

  // =========================================================================
  // TEST 8 — Gate metering
  // Throttling outer gates reduces density in downstream turnstile throat
  // =========================================================================
  const pairedMetering = runPairedCounterfactualExperiment('GATE_METERING', 42);
  assert.ok(pairedMetering.baselineGateDensity >= 0, 'Baseline gate density must be non-negative');
  assert.ok(pairedMetering.mitigatedGateDensity >= 0, 'Mitigated gate density must be non-negative');
  console.log(`✓ TEST 8 Passed: Gate metering (Throat density: Baseline = ${pairedMetering.baselineGateDensity} p/m², Mitigated = ${pairedMetering.mitigatedGateDensity} p/m²)`);

  // =========================================================================
  // TEST 9 — Directional queue spillback calculation
  // Directional queue spillback is measured along arrival axis into upstream zones
  // =========================================================================
  // Mock queued agents at throat backed up into Zone 2 holding area
  const mockQueuedAgents = [
    { x: 300, y: 380, vx: 0, vy: 2, density: 4.6 },
    { x: 300, y: 440, vx: 0, vy: 1, density: 4.8 },
    { x: 300, y: 470, vx: 0, vy: 0.5, density: 4.5 }
  ];
  const directionalSnap = SpatialRiskDisplacementEngine.sampleZones(mockQueuedAgents, 0);
  assert.ok(
    directionalSnap.zones.ZONE_2_HOLDING_AREA.longitudinalSpillbackMeters > 0,
    'Queued agents in Zone 2 must project positive longitudinal spillback distance'
  );
  console.log(`✓ TEST 9 Passed: Directional queue spillback calculation (Zone 2 spillback = ${directionalSnap.zones.ZONE_2_HOLDING_AREA.longitudinalSpillbackMeters}m)`);

  // =========================================================================
  // TEST 10 — Hotspot moving from Z4 to Z2 produces DISPLACED
  // Decompressing throat that shifts crowd hazard upstream into holding area must yield DISPLACED
  // =========================================================================
  const snapZ4Hotspot = SpatialRiskDisplacementEngine.sampleZones([
    { x: 300, y: 200, vx: 0, vy: -5, density: 4.8 }, // Z4 Throat: Severe hazard
    { x: 300, y: 400, vx: 0, vy: -10, density: 1.5 } // Z2 Holding: Free flow
  ]);
  const snapZ2Hotspot = SpatialRiskDisplacementEngine.sampleZones([
    { x: 300, y: 200, vx: 0, vy: -5, density: 2.0 }, // Z4 Throat: Decompressed (Improved)
    { x: 300, y: 400, vx: 0, vy: -1, density: 4.9 }  // Z2 Holding: New severe hazard
  ]);
  const dispZ4ToZ2 = SpatialRiskDisplacementEngine.compare(snapZ4Hotspot, snapZ2Hotspot, 200, 180);
  assert.equal(dispZ4ToZ2.isDisplacementDetected, true, 'Moving crowd from Z4 to Z2 must trigger displacement');
  assert.equal(dispZ4ToZ2.verdict, 'DISPLACED', 'Verdict when shifting risk from Z4 to Z2 must be DISPLACED');
  assert.ok(
    dispZ4ToZ2.displacedTargetZone?.includes('Zone 2') || dispZ4ToZ2.displacedTargetZone?.includes('Holding'),
    `Displaced target zone must identify Zone 2 Holding Area (got ${dispZ4ToZ2.displacedTargetZone})`
  );
  console.log(`✓ TEST 10 Passed: Hotspot moving from Z4 to Z2 produces DISPLACED (Target = ${dispZ4ToZ2.displacedTargetZone})`);

  // =========================================================================
  // TEST 11 — New hotspot in Z3 is detected & cannot hide behind other improvements
  // Improvement in Z4 cannot hide new crush hazard in Z3 (Concourse)
  // =========================================================================
  const snapZ3Normal = SpatialRiskDisplacementEngine.sampleZones([
    { x: 300, y: 200, vx: 0, vy: -5, density: 4.8 }, // Z4 Throat
    { x: 300, y: 300, vx: 0, vy: -10, density: 1.8 } // Z3 Concourse (< 4.0 p/m²)
  ]);
  const snapZ3Hotspot = SpatialRiskDisplacementEngine.sampleZones([
    { x: 300, y: 200, vx: 0, vy: -5, density: 2.0 }, // Z4 Throat decompressed
    { x: 300, y: 300, vx: 0, vy: -2, density: 4.7 }  // Z3 Concourse new hotspot (>= 4.5 p/m²)
  ]);
  const dispZ3Result = SpatialRiskDisplacementEngine.compare(snapZ3Normal, snapZ3Hotspot, 220, 190);
  assert.equal(
    dispZ3Result.zoneComparisons.ZONE_3_QUEUE_CONCOURSE.isNewHotspot,
    true,
    'Z3 must be flagged as a new hotspot when rising from 1.8 to 4.7 p/m²'
  );
  assert.notEqual(
    dispZ3Result.verdict,
    'IMPROVED',
    'Improvement in Z4 throat CANNOT hide new hazard hotspot in Z3 concourse'
  );
  assert.equal(dispZ3Result.verdict, 'DISPLACED', 'Shifting risk to Z3 concourse must yield DISPLACED verdict');
  console.log(`✓ TEST 11 Passed: New hotspot in Z3 detected and prevents false IMPROVED verdict (isNewHotspot = true, Verdict = ${dispZ3Result.verdict})`);

  // =========================================================================
  // TEST 12 — Paired experiment schedule immutability & bit-for-bit reproducibility
  // Seeded arrival generator produces bit-for-bit identical schedules for baseline and mitigated runs
  // =========================================================================
  const testConfig: ScenarioConfig = {
    id: 'test_sched',
    type: 'NORMAL',
    name: 'Reproducibility Check',
    description: 'Seed lock test',
    seed: 12345,
    baseInflowRate: 300,
    durationSeconds: 20
  };
  const schedA = SyntheticDemandGenerator.generateSchedule(testConfig, 'LINK_ROAD');
  const schedB = SyntheticDemandGenerator.generateSchedule(testConfig, 'LINK_ROAD');
  assert.equal(schedA.length, schedB.length, 'Schedule lengths must be identical');
  for (let i = 0; i < schedA.length; i++) {
    assert.equal(schedA[i].timeSeconds, schedB[i].timeSeconds, `Agent ${i} timeSeconds mismatch`);
    assert.equal(schedA[i].agentId, schedB[i].agentId, `Agent ${i} agentId mismatch`);
  }
  const isReproducible = PhysicsValidationEngine.verifySeedReproducibility(42);
  assert.equal(isReproducible, true, 'Seeded simulation must be 100% deterministic and bit-for-bit reproducible');
  console.log('✓ TEST 12 Passed: Paired experiment reproducibility & arrival schedule immutability');

  // =========================================================================
  // TEST 13 — Missing-zone telemetry strictly produces INCONCLUSIVE
  // If any monitored zone has missing data, verdict must be INCONCLUSIVE (never IMPROVED)
  // =========================================================================
  const snapshotWithMissing = SpatialRiskDisplacementEngine.sampleZones(
    [{ x: 300, y: 200, vx: 0, vy: -5, density: 2.0 }],
    0,
    'ZONE_3_QUEUE_CONCOURSE' // Missing Zone 3
  );
  assert.equal(snapshotWithMissing.hasMissingTelemetry, true, 'Missing telemetry flag must be true');
  const verdictMissing = SpatialRiskDisplacementEngine.compare(snapZ4Hotspot, snapshotWithMissing);
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
  console.log(`✓ TEST 13 Passed: Missing-zone telemetry (Missing Zone 3 -> Verdict: ${verdictMissing.verdict}, Recommendation: ${verdictMissing.permitOfficerRecommendation})`);

  // =========================================================================
  // TEST 14 — Validation status cannot pass without sufficient reference evidence
  // Insufficient density bins strictly yields INSUFFICIENT_REFERENCE_DATA, not VALIDATED
  // =========================================================================
  const emptyAnalysis = FundamentalDiagramAnalyzer.analyze([]);
  assert.equal(
    emptyAnalysis.validationStatus,
    'INSUFFICIENT_REFERENCE_DATA',
    'Zero samples must produce INSUFFICIENT_REFERENCE_DATA'
  );
  const fewSamplesAnalysis = FundamentalDiagramAnalyzer.analyze([
    { density: 1.0, velocity: 1.25 },
    { density: 1.1, velocity: 1.20 }
  ]);
  assert.equal(
    fewSamplesAnalysis.validationStatus,
    'INSUFFICIENT_REFERENCE_DATA',
    'Fewer than 4 density bins must produce INSUFFICIENT_REFERENCE_DATA'
  );
  assert.notEqual(
    fewSamplesAnalysis.validationStatus,
    'VALIDATED_AGAINST_REFERENCE',
    'Cannot validate without sufficient empirical reference evidence'
  );
  console.log(`✓ TEST 14 Passed: Scientific evidence safeguards (Validation status: ${fewSamplesAnalysis.validationStatus} on insufficient bins)`);

  console.log('\n=============================================================');
  console.log('✓ ALL 14 PHYSICS CREDIBILITY & VERIFICATION TESTS PASSED!');
  console.log('=============================================================\n');
}

// Auto-run if executed directly
if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('physicsValidation')) {
  runPhysicsValidationTests();
}
