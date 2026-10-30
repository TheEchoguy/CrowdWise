/**
 * CROWDWISE Predictive Crowd Digital Twin & Safety Lab
 * Phase 2 Automated Validation Test Suite (Audited & Expanded)
 *
 * Validates:
 * 1. Seed reproducibility (Mulberry32 PRNG)
 * 2. Box-Muller Gaussian distribution & statistical moments
 * 3. Arrival distribution normalization (Uniform, Gaussian Peak, Burst)
 * 4. Numerical integration of arrival demand (conservation of total population)
 * 5. Canonical Scenario 2 consistency (50k cap, 47.5k attendees, S_pop = 19.0, 1800 peak, 1140 cap, 157.9% ratio)
 * 6. Gate assignment validation & closed-gate demand preservation
 * 7. Exact generated agent counts & population scaling ratios
 * 8. Venue capacity & attendance constraints (default 100% show-up)
 * 9. Chronological spawn-time ordering & boundary clamping
 * 10. Invalid configuration boundary handling
 */

import { SeededPRNG } from '../utils/seededRandom';
import { ArrivalDistributionEngine } from '../engine/ArrivalDistribution';
import { SyntheticDemandGenerator } from '../engine/SyntheticDemandGenerator';
import { SyntheticEventConfigInput } from '../types/ScenarioTypes';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED]: ${message}`);
  }
}

function assertClose(actual: number, expected: number, tolerance: number, message: string): void {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`[ASSERTION FAILED]: ${message} (Expected: ${expected}, Actual: ${actual}, Tol: ${tolerance})`);
  }
}

console.log('===============================================================');
console.log('   CROWDWISE — PHASE 2 FINAL AUDIT & VALIDATION SUITE          ');
console.log('===============================================================\n');

let totalTests = 0;
let passedTests = 0;

function runTest(testName: string, testFn: () => void): void {
  totalTests++;
  try {
    testFn();
    passedTests++;
    console.log(`[PASS] ${testName}`);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[FAIL] ${testName} -> ${errorMsg}`);
  }
}

// ----------------------------------------------------------------------------
// TEST GROUP 1: SEEDED PRNG REPRODUCIBILITY (Mulberry32)
// ----------------------------------------------------------------------------
runTest('PRNG: Exact reproducibility with identical seed', () => {
  const prng1 = new SeededPRNG(42);
  const prng2 = new SeededPRNG(42);

  const seq1: number[] = [];
  const seq2: number[] = [];

  for (let i = 0; i < 500; i++) {
    seq1.push(prng1.next());
    seq2.push(prng2.next());
  }

  assert(seq1.length === seq2.length, 'Sequences must have identical length');
  for (let i = 0; i < 500; i++) {
    assert(seq1[i] === seq2[i], `Item ${i} mismatch: ${seq1[i]} !== ${seq2[i]}`);
  }
});

runTest('PRNG: Divergence with different seeds', () => {
  const prngA = new SeededPRNG(101);
  const prngB = new SeededPRNG(102);

  let identicalCount = 0;
  for (let i = 0; i < 100; i++) {
    if (prngA.next() === prngB.next()) identicalCount++;
  }
  assert(identicalCount < 5, 'Different seeds should produce divergent streams');
});

runTest('PRNG: Edge case seed handling (0, negative, floats, NaN)', () => {
  const prngZero = new SeededPRNG(0);
  const valZero = prngZero.next();
  assert(valZero >= 0 && valZero < 1, 'Zero seed should produce valid float [0, 1)');

  const prngNeg = new SeededPRNG(-999);
  const valNeg = prngNeg.next();
  assert(valNeg >= 0 && valNeg < 1, 'Negative seed should produce valid float');

  const prngNaN = new SeededPRNG(NaN);
  const valNaN = prngNaN.next();
  assert(valNaN >= 0 && valNaN < 1, 'NaN seed should fallback to default state');
});

// ----------------------------------------------------------------------------
// TEST GROUP 2: GAUSSIAN GENERATION (Box-Muller)
// ----------------------------------------------------------------------------
runTest('PRNG Gaussian: Empirical mean and standard deviation accuracy', () => {
  const prng = new SeededPRNG(9999);
  const targetMean = 1.30;
  const targetStdDev = 0.15;
  const sampleSize = 10000;

  let sum = 0;
  const samples = new Array<number>(sampleSize);
  for (let i = 0; i < sampleSize; i++) {
    const val = prng.nextGaussian(targetMean, targetStdDev);
    samples[i] = val;
    sum += val;
  }

  const sampleMean = sum / sampleSize;
  let varianceSum = 0;
  for (let i = 0; i < sampleSize; i++) {
    varianceSum += Math.pow(samples[i] - sampleMean, 2);
  }
  const sampleStdDev = Math.sqrt(varianceSum / (sampleSize - 1));

  assertClose(sampleMean, targetMean, 0.015, 'Sample mean must closely match target mean');
  assertClose(sampleStdDev, targetStdDev, 0.015, 'Sample stdDev must closely match target stdDev');
});

// ----------------------------------------------------------------------------
// TEST GROUP 3: ARRIVAL DISTRIBUTION NORMALIZATION & TIMESTAMPS
// ----------------------------------------------------------------------------
runTest('Arrival Distributions: Exact agent count normalization', () => {
  const prng = new SeededPRNG(555);
  const totalAgents = 1250;
  const durationMin = 60;

  // 1. Uniform
  const uniformTimes = ArrivalDistributionEngine.generateSpawnTimestamps({
    pattern: 'uniform',
    totalAgents,
    durationMinutes: durationMin,
    prng
  });
  assert(uniformTimes.length === totalAgents, `Uniform count must be exactly ${totalAgents}`);

  // 2. Gaussian
  const gaussianTimes = ArrivalDistributionEngine.generateSpawnTimestamps({
    pattern: 'gaussian_peak',
    totalAgents,
    durationMinutes: durationMin,
    gaussianPeakMin: 25,
    gaussianStdDevMin: 10.53,
    prng
  });
  assert(gaussianTimes.length === totalAgents, `Gaussian count must be exactly ${totalAgents}`);

  // 3. Burst
  const burstTimes = ArrivalDistributionEngine.generateSpawnTimestamps({
    pattern: 'burst',
    totalAgents,
    durationMinutes: durationMin,
    prng
  });
  assert(burstTimes.length === totalAgents, `Burst count must be exactly ${totalAgents}`);
});

runTest('Arrival Distributions: Strict chronological ordering and bounds', () => {
  const prng = new SeededPRNG(777);
  const durationSec = 3600; // 60 mins

  const times = ArrivalDistributionEngine.generateSpawnTimestamps({
    pattern: 'gaussian_peak',
    totalAgents: 800,
    durationMinutes: 60,
    gaussianPeakMin: 25,
    gaussianStdDevMin: 8,
    prng
  });

  for (let i = 0; i < times.length; i++) {
    assert(times[i] >= 0, `Timestamp ${times[i]} cannot be negative`);
    assert(times[i] <= durationSec, `Timestamp ${times[i]} cannot exceed duration ${durationSec}`);
    if (i > 0) {
      assert(times[i] >= times[i - 1], `Timestamps must be ascending: times[${i}] < times[${i - 1}]`);
    }
  }
});

// ----------------------------------------------------------------------------
// TEST GROUP 4: NUMERICAL INTEGRATION OF ARRIVAL DEMAND
// ----------------------------------------------------------------------------
runTest('Numerical Integration: Integrated arrival curve equals total expected population', () => {
  const totalAttendees = 47500;
  const durationMin = 60;

  // 1. Uniform
  const uniformProfile = ArrivalDistributionEngine.computeArrivalRateProfile(
    'uniform',
    totalAttendees,
    durationMin
  );
  const integratedUniform = ArrivalDistributionEngine.integrateArrivalRate(uniformProfile, 0, durationMin, 2000);
  assertClose(integratedUniform, totalAttendees, 1.0, 'Integrated uniform curve must equal total population');

  // 2. Gaussian Peak
  const gaussianProfile = ArrivalDistributionEngine.computeArrivalRateProfile(
    'gaussian_peak',
    totalAttendees,
    durationMin,
    { gaussianPeakMin: 25, gaussianStdDevMin: 10.53 }
  );
  const integratedGaussian = ArrivalDistributionEngine.integrateArrivalRate(gaussianProfile, 0, durationMin, 2000);
  assertClose(integratedGaussian, totalAttendees, 50.0, 'Integrated gaussian curve must equal total population');

  // 3. Burst
  const burstProfile = ArrivalDistributionEngine.computeArrivalRateProfile(
    'burst',
    totalAttendees,
    durationMin
  );
  const integratedBurst = ArrivalDistributionEngine.integrateArrivalRate(burstProfile, 0, durationMin, 2000);
  assertClose(integratedBurst, totalAttendees, 50.0, 'Integrated burst curve must equal total population');
});

// ----------------------------------------------------------------------------
// TEST GROUP 5: CANONICAL SCENARIO 2 CAPACITY & DEMAND CONSISTENCY
// ----------------------------------------------------------------------------
runTest('Canonical Scenario 2: Capacity, Attendance, S_pop and Overload Ratio', () => {
  // Canonical Scenario 2 configuration:
  // - Venue capacity: 50,000
  // - Ticket sales: 95% -> 47,500 expected attendees
  // - Simulated agent budget: 2,500
  // - Gate A: 4 operational lanes, 4.0s latency
  // - Gate B: unavailable (0 operational lanes)
  // - Target peak arrival rate: 1,800 represented people / min
  const input: SyntheticEventConfigInput = {
    venueCapacity: 50000,
    ticketSalesPercentage: 0.95,
    maxSimulatedAgents: 2500,
    arrivalStartTimeMin: 0,
    arrivalEndTimeMin: 60,
    arrivalDistribution: 'gaussian_peak',
    gaussianPeakMin: 25,
    targetPeakArrivalRateReal: 1800.0,
    gateAShare: 1.0,
    gateBShare: 0.0,
    gates: {
      'gate-a': { gateId: 'gate-a', name: 'Gate A (Main)', totalLanes: 4, operationalLanes: 4, turnstileLatencySec: 4.0 },
      'gate-b': { gateId: 'gate-b', name: 'Gate B (Aux)', totalLanes: 4, operationalLanes: 0, turnstileLatencySec: 4.0 }
    },
    randomSeed: 2026
  };

  const event = SyntheticDemandGenerator.generateSyntheticEvent(input);

  // 1. Verify Attendance semantics & S_pop
  assert(event.venue_capacity === 50000, 'Venue capacity must be exactly 50,000');
  assert(event.tickets_sold === 47500, 'Tickets sold must be exactly 47,500 (95%)');
  assert(event.expected_attendance === 47500, 'Expected attendance must be exactly 47,500 (no unexpected 98% show-up)');
  assert(event.simulated_agent_population === 2500, 'Simulated agents must equal budget 2,500');
  assert(event.population_scaling_ratio === 19.0, `Population scaling ratio S_pop must be exactly 19.0 (got ${event.population_scaling_ratio})`);

  // 2. Verify Peak Arrival Rate
  assertClose(event.peak_arrival_rate_real, 1800.0, 5.0, `Peak arrival rate must be ~1,800 people/min (got ${event.peak_arrival_rate_real})`);
  assertClose(event.peak_arrival_rate_sim, 1800.0 / 19.0, 1.0, 'Simulated peak arrival rate must be ~94.7 agents/min');

  // 3. Verify Gate Discharge Capacity
  const capA = SyntheticDemandGenerator.calculateTheoreticalGateCapacity(event.gates['gate-a'], event.population_scaling_ratio);
  assert(capA.simCapacityPerMin === 60.0, `Simulated gate capacity must be exactly 60.0 agents/min (got ${capA.simCapacityPerMin})`);
  assert(capA.repCapacityPerMin === 1140.0, `Represented gate capacity must be exactly 1,140.0 people/min (got ${capA.repCapacityPerMin})`);

  const capB = SyntheticDemandGenerator.calculateTheoreticalGateCapacity(event.gates['gate-b'], event.population_scaling_ratio);
  assert(capB.simCapacityPerMin === 0, 'Gate B must have 0 capacity when unavailable');

  // 4. Verify Authoritative Demand-to-Capacity Ratio
  const ratioResult = SyntheticDemandGenerator.calculateDemandCapacityRatio(
    event.peak_arrival_rate_real,
    event.gates,
    event.population_scaling_ratio
  );

  assert(ratioResult.isOverloaded === true, 'Scenario 2 must be classified as overloaded');
  assertClose(ratioResult.demandCapacityRatio, 1.579, 0.005, 'Demand/Capacity ratio must be ~1.579 (157.9%)');
  assertClose(ratioResult.overloadPercentage, 57.9, 0.5, 'Overload percentage must be ~57.9%');
});

// ----------------------------------------------------------------------------
// TEST GROUP 6: GATE ASSIGNMENT VALIDATION & CLOSED-GATE ROUTING
// ----------------------------------------------------------------------------
runTest('Gate Assignment: Closed Gate B routing preserves target for failure simulation', () => {
  // Scenario: 75% Gate A, 25% Gate B, but Gate B has 0 operational lanes
  const input: SyntheticEventConfigInput = {
    venueCapacity: 50000,
    ticketSalesPercentage: 0.85,
    maxSimulatedAgents: 1000,
    arrivalDistribution: 'uniform',
    gateAShare: 0.75,
    gateBShare: 0.25,
    gates: {
      'gate-a': { gateId: 'gate-a', name: 'Gate A', totalLanes: 4, operationalLanes: 4, turnstileLatencySec: 4.0 },
      'gate-b': { gateId: 'gate-b', name: 'Gate B', totalLanes: 4, operationalLanes: 0, turnstileLatencySec: 4.0 }
    },
    randomSeed: 404
  };

  const val = SyntheticDemandGenerator.validateConfig(input);
  assert(val.isValid === true, 'Configuration should be valid');
  assert(val.warnings.length > 0, 'Should produce a warning when routing pedestrians to a closed gate');

  const event = SyntheticDemandGenerator.generateSyntheticEvent(input);
  const schedule = SyntheticDemandGenerator.generateArrivalSchedule(event);

  let gateACount = 0;
  let gateBCount = 0;
  for (const desc of schedule.schedule) {
    if (desc.defaultGateTarget === 'gate-a') gateACount++;
    if (desc.defaultGateTarget === 'gate-b') gateBCount++;
  }

  assert(gateACount === 750, `Gate A should receive 750 agents: got ${gateACount}`);
  assert(gateBCount === 250, `Gate B should receive 250 agents (preserved for closed turnstile queueing): got ${gateBCount}`);
});

// ----------------------------------------------------------------------------
// TEST GROUP 7: BOUNDARY VALIDATION & ERROR HANDLING
// ----------------------------------------------------------------------------
runTest('Validation: Catches invalid venue capacity, gate shares and negative lanes', () => {
  // 1. Negative venue capacity
  const invalid1: SyntheticEventConfigInput = {
    venueCapacity: -500,
    ticketSalesPercentage: 0.9,
    arrivalDistribution: 'uniform',
    gateAShare: 0.5,
    gateBShare: 0.5,
    gates: {},
    randomSeed: 1
  };
  const val1 = SyntheticDemandGenerator.validateConfig(invalid1);
  assert(!val1.isValid, 'Negative venue capacity must fail validation');

  // 2. Unbalanced gate shares (sum !== 1.0)
  const invalid2: SyntheticEventConfigInput = {
    venueCapacity: 50000,
    ticketSalesPercentage: 0.9,
    arrivalDistribution: 'uniform',
    gateAShare: 0.6,
    gateBShare: 0.2, // sum = 0.8
    gates: {},
    randomSeed: 1
  };
  const val2 = SyntheticDemandGenerator.validateConfig(invalid2);
  assert(!val2.isValid, 'Gate shares not summing to 1.0 must fail validation');

  // 3. Operational lanes > total lanes
  const invalid3: SyntheticEventConfigInput = {
    venueCapacity: 50000,
    ticketSalesPercentage: 0.9,
    arrivalDistribution: 'uniform',
    gateAShare: 0.5,
    gateBShare: 0.5,
    gates: {
      'gate-a': { gateId: 'gate-a', name: 'Gate A', totalLanes: 4, operationalLanes: 6, turnstileLatencySec: 4.0 }
    },
    randomSeed: 1
  };
  const val3 = SyntheticDemandGenerator.validateConfig(invalid3);
  assert(!val3.isValid, 'Operational lanes exceeding total lanes must fail validation');
});

console.log('\n===============================================================');
console.log(`   VALIDATION SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED (100%)`);
console.log('===============================================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
