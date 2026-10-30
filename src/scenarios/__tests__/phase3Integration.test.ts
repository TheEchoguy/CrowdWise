/**
 * CROWDWISE Predictive Crowd Digital Twin & Safety Lab
 * Phase 3 Integration & Multi-Lane Turnstile Orchestration Test Suite
 *
 * Verifies:
 * 1. Multi-lane turnstile processing and channel concurrency (4 lanes, 4s = 60 agents/min)
 * 2. Unconditional admission rejection for closed gates (operationalLanes: 0)
 * 3. Degraded throughput under scanner hardware failure (Scenario 3: 2 lanes, 12s = 10 agents/min)
 * 4. Queue growth when arrival rate exceeds turnstile discharge capacity
 * 5. Queue reduction/clearance when arrivals cease and processing continues
 * 6. Schedule immutability across repeated engine resets
 * 7. Deterministic replay parity (identical chronological arrival sequences)
 * 8. Strict population accounting conservation laws across all states
 * 9. Scenario 6 counterfactual schedule parity between Baseline and Mitigations
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ScenarioEngine } from '../engine/ScenarioEngine';
import { SyntheticDemandGenerator } from '../engine/SyntheticDemandGenerator';
import { SCENARIO_DEFINITIONS } from '../data/scenarioDefinitions';
import { SyntheticEventConfigInput } from '../types/ScenarioTypes';

describe('Phase 3 Integration: Multi-Lane Gate & Simulation Orchestration', () => {

  it('1. Multi-lane gate processing: admits exactly operationalLanes patrons simultaneously', () => {
    const input: SyntheticEventConfigInput = {
      venueCapacity: 50000,
      ticketSalesPercentage: 0.60,
      maxSimulatedAgents: 100,
      arrivalStartTimeMin: 0,
      arrivalEndTimeMin: 10,
      arrivalDistribution: 'uniform',
      gateAShare: 1.0,
      gateBShare: 0.0,
      gates: {
        'gate-a': {
          gateId: 'gate-a',
          name: 'Gate A (4-Lane)',
          totalLanes: 4,
          operationalLanes: 4,
          turnstileLatencySec: 4.0
        }
      },
      randomSeed: 42
    };

    const event = SyntheticDemandGenerator.generateSyntheticEvent(input);
    const schedule = SyntheticDemandGenerator.generateArrivalSchedule(event);
    const engine = new ScenarioEngine(event, schedule);

    // Step 60s so that 10 patrons have spawned and are waiting outside Gate A
    engine.step(60.0);
    assert.strictEqual(engine.getAccounting().totalInjected >= 10, true);

    // Initial state: 4 operational lanes idle
    assert.strictEqual(engine.attemptGatePassage('gate-a'), true, 'Lane 1 should admit');
    assert.strictEqual(engine.attemptGatePassage('gate-a'), true, 'Lane 2 should admit');
    assert.strictEqual(engine.attemptGatePassage('gate-a'), true, 'Lane 3 should admit');
    assert.strictEqual(engine.attemptGatePassage('gate-a'), true, 'Lane 4 should admit');

    // 5th attempt must be rejected (all 4 channels busy on 4s cooldown)
    assert.strictEqual(engine.attemptGatePassage('gate-a'), false, '5th attempt at t=60s must be rejected');

    // Step 2.0 seconds: all channels still have 2.0s cooldown remaining
    engine.step(2.0);
    assert.strictEqual(engine.attemptGatePassage('gate-a'), false, 'Attempt at t=62.0s must still be rejected');

    // Step another 2.0 seconds (total 4.0s elapsed): all 4 channels become idle
    engine.step(2.0);
    assert.strictEqual(engine.attemptGatePassage('gate-a'), true, 'Lane 1 should admit again after 4.0s');
    assert.strictEqual(engine.attemptGatePassage('gate-a'), true, 'Lane 2 should admit again after 4.0s');
    assert.strictEqual(engine.attemptGatePassage('gate-a'), true, 'Lane 3 should admit again after 4.0s');
    assert.strictEqual(engine.attemptGatePassage('gate-a'), true, 'Lane 4 should admit again after 4.0s');
    assert.strictEqual(engine.attemptGatePassage('gate-a'), false, '9th attempt must be rejected');

    assert.strictEqual(engine.getAccounting().totalAdmitted, 8);
  });

  it('2. Closed gate: unconditionally rejects entry and holds pedestrians outside', () => {
    const input: SyntheticEventConfigInput = {
      venueCapacity: 50000,
      ticketSalesPercentage: 0.60,
      maxSimulatedAgents: 50,
      arrivalStartTimeMin: 0,
      arrivalEndTimeMin: 10,
      arrivalDistribution: 'uniform',
      gateAShare: 0.0,
      gateBShare: 1.0,
      gates: {
        'gate-b': {
          gateId: 'gate-b',
          name: 'Gate B (Closed)',
          totalLanes: 4,
          operationalLanes: 0, // Closed gate
          turnstileLatencySec: 4.0
        }
      },
      randomSeed: 99
    };

    const event = SyntheticDemandGenerator.generateSyntheticEvent(input);
    const schedule = SyntheticDemandGenerator.generateArrivalSchedule(event);
    const engine = new ScenarioEngine(event, schedule);

    // Step to spawn agents
    engine.step(60.0);

    // Attempt 20 entries
    for (let i = 0; i < 20; i++) {
      const admitted = engine.attemptGatePassage('gate-b');
      assert.strictEqual(admitted, false, `Closed Gate B must reject passage attempt ${i + 1}`);
    }

    assert.strictEqual(engine.getAccounting().totalAdmitted, 0, 'Zero agents admitted through closed gate');
    assert.strictEqual(engine.getGateState('gate-b')?.totalPassed, 0);
  });

  it('3. Hardware Scanner Failure (Scenario 3 parameters): 2 operational lanes, 12s latency yields exactly 10 sim agents/min', () => {
    const def = SCENARIO_DEFINITIONS['gate_failure'];
    const event = SyntheticDemandGenerator.generateSyntheticEvent(def.defaultEvent);
    const schedule = SyntheticDemandGenerator.generateArrivalSchedule(event);
    const engine = new ScenarioEngine(event, schedule);

    // Theoretical capacity check
    const theoretical = SyntheticDemandGenerator.calculateTheoreticalGateCapacity(
      event.gates['gate-a'],
      event.population_scaling_ratio
    );
    assert.strictEqual(theoretical.simCapacityPerMin, 10, 'Scenario 3 capacity must be exactly 10 sim agents/min');
    assert.strictEqual(theoretical.repCapacityPerMin, 160, 'Scenario 3 rep capacity must be 160 people/min (10 * 16.0)');

    // Step 300s so plenty of patrons (over 100) are queued
    engine.step(300.0);
    assert.strictEqual(engine.getAccounting().totalInjected >= 50, true);

    // Measure admissions over a 60-second window
    let totalAdmissions = 0;
    for (let sec = 0; sec < 60; sec++) {
      engine.step(1.0);
      for (let attempt = 0; attempt < 5; attempt++) {
        if (engine.attemptGatePassage('gate-a')) {
          totalAdmissions++;
        }
      }
    }

    // Over 60 seconds with 12s latency per lane and 2 operational lanes:
    // Exactly 5 cycles * 2 lanes = 10 agents!
    assert.strictEqual(totalAdmissions, 10, 'Exactly 10 agents must be admitted in 60 seconds under Scenario 3 parameters');
  });

  it('4. Queue growth: waiting queue increases monotonically when arrival rate exceeds capacity', () => {
    const input: SyntheticEventConfigInput = {
      venueCapacity: 50000,
      ticketSalesPercentage: 0.60,
      maxSimulatedAgents: 200,
      arrivalStartTimeMin: 0,
      arrivalEndTimeMin: 2, // 200 agents in 2 min = 100 agents/min demand >> 6 agents/min capacity
      arrivalDistribution: 'uniform',
      gateAShare: 1.0,
      gateBShare: 0.0,
      gates: {
        'gate-a': {
          gateId: 'gate-a',
          name: 'Gate A',
          totalLanes: 1,
          operationalLanes: 1,
          turnstileLatencySec: 10.0
        }
      },
      randomSeed: 123
    };

    const event = SyntheticDemandGenerator.generateSyntheticEvent(input);
    const schedule = SyntheticDemandGenerator.generateArrivalSchedule(event);
    const engine = new ScenarioEngine(event, schedule);

    let previousActive = 0;
    let monotonicallyIncreased = true;

    for (let step = 0; step < 10; step++) {
      engine.step(6.0); // 6 seconds step
      engine.attemptGatePassage('gate-a');
      const accounting = engine.getAccounting();
      if (accounting.activeInSimulation < previousActive) {
        monotonicallyIncreased = false;
      }
      previousActive = accounting.activeInSimulation;
    }

    assert.strictEqual(monotonicallyIncreased, true, 'Queue must grow monotonically under severe overload');
    assert.ok(previousActive > 10, 'Queue should have accumulated substantial crowd');
  });

  it('5. Queue clearance: queued crowd drains to zero when arrivals cease and processing continues', () => {
    const input: SyntheticEventConfigInput = {
      venueCapacity: 50000,
      ticketSalesPercentage: 0.60,
      maxSimulatedAgents: 50, // Set to MIN_SIMULATION_AGENTS (50)
      arrivalStartTimeMin: 0,
      arrivalEndTimeMin: 1, // All 50 spawn in first 60 seconds
      arrivalDistribution: 'uniform',
      gateAShare: 1.0,
      gateBShare: 0.0,
      gates: {
        'gate-a': {
          gateId: 'gate-a',
          name: 'Gate A',
          totalLanes: 4,
          operationalLanes: 4,
          turnstileLatencySec: 2.0 // Fast 4-lane turnstile: capacity = 120 agents/min
        }
      },
      randomSeed: 555
    };

    const event = SyntheticDemandGenerator.generateSyntheticEvent(input);
    const schedule = SyntheticDemandGenerator.generateArrivalSchedule(event);
    const engine = new ScenarioEngine(event, schedule);

    // Step 60 seconds to inject all 50 agents
    engine.step(60.0);
    assert.strictEqual(engine.getAccounting().totalInjected, 50);

    // Drain queue by stepping and processing
    while (engine.getAccounting().activeInSimulation > 0) {
      engine.step(2.0);
      for (let i = 0; i < 4; i++) {
        engine.attemptGatePassage('gate-a');
      }
    }

    const accounting = engine.getAccounting();
    assert.strictEqual(accounting.activeInSimulation, 0, 'Active crowd must drain to exactly 0');
    assert.strictEqual(accounting.totalAdmitted, 50, 'All 50 agents admitted');
    assert.strictEqual(accounting.totalInjected, 50);
  });

  it('6. Schedule immutability: schedule descriptors remain identical across repeated resets', () => {
    const def = SCENARIO_DEFINITIONS['ticket_surge'];
    const event = SyntheticDemandGenerator.generateSyntheticEvent(def.defaultEvent);
    const schedule = SyntheticDemandGenerator.generateArrivalSchedule(event);

    const snapshotFirst10 = schedule.schedule.slice(0, 10).map((d) => ({ ...d }));

    const engine = new ScenarioEngine(event, schedule);
    // Advance and mutate engine state
    engine.step(500.0);
    for (let i = 0; i < 50; i++) engine.attemptGatePassage('gate-a');

    // Reset engine
    engine.reset();

    // Verify schedule descriptors in engine are bit-for-bit identical to snapshot
    const currentFirst10 = engine.getSchedule().schedule.slice(0, 10);
    for (let i = 0; i < 10; i++) {
      assert.strictEqual(currentFirst10[i].agentIndex, snapshotFirst10[i].agentIndex);
      assert.strictEqual(currentFirst10[i].spawnTimeSimSec, snapshotFirst10[i].spawnTimeSimSec);
      assert.strictEqual(currentFirst10[i].initialConcourseX, snapshotFirst10[i].initialConcourseX);
      assert.strictEqual(currentFirst10[i].initialConcourseY, snapshotFirst10[i].initialConcourseY);
      assert.strictEqual(currentFirst10[i].defaultGateTarget, snapshotFirst10[i].defaultGateTarget);
      assert.strictEqual(currentFirst10[i].walkingSpeedMps, snapshotFirst10[i].walkingSpeedMps);
      assert.strictEqual(currentFirst10[i].physicalRadiusPx, snapshotFirst10[i].physicalRadiusPx);
    }
  });

  it('7. Deterministic replay parity: identical chronological arrival sequences across runs', () => {
    const def = SCENARIO_DEFINITIONS['ticket_surge'];
    const event = SyntheticDemandGenerator.generateSyntheticEvent(def.defaultEvent);
    const schedule = SyntheticDemandGenerator.generateArrivalSchedule(event);
    const engine = new ScenarioEngine(event, schedule);

    // Run 1: 300 simulation seconds
    const run1SpawnSequence: { id: number; t: number }[] = [];
    for (let sec = 0; sec < 300; sec += 10) {
      const spawned = engine.step(10.0);
      for (const a of spawned) {
        run1SpawnSequence.push({ id: a.agentIndex, t: a.spawnTimeSimSec });
      }
    }

    // Reset
    engine.reset();

    // Run 2: 300 simulation seconds
    const run2SpawnSequence: { id: number; t: number }[] = [];
    for (let sec = 0; sec < 300; sec += 10) {
      const spawned = engine.step(10.0);
      for (const a of spawned) {
        run2SpawnSequence.push({ id: a.agentIndex, t: a.spawnTimeSimSec });
      }
    }

    assert.strictEqual(run1SpawnSequence.length, run2SpawnSequence.length, 'Injected counts must match');
    for (let i = 0; i < run1SpawnSequence.length; i++) {
      assert.strictEqual(run1SpawnSequence[i].id, run2SpawnSequence[i].id);
      assert.strictEqual(run1SpawnSequence[i].t, run2SpawnSequence[i].t);
    }
  });

  it('8. Population accounting: conservation laws hold at all times', () => {
    const def = SCENARIO_DEFINITIONS['ticket_surge'];
    const event = SyntheticDemandGenerator.generateSyntheticEvent(def.defaultEvent);
    const schedule = SyntheticDemandGenerator.generateArrivalSchedule(event);
    const engine = new ScenarioEngine(event, schedule);

    for (let step = 0; step < 50; step++) {
      engine.step(15.0);
      // Attempt some admissions
      for (let a = 0; a < 8; a++) {
        engine.attemptGatePassage('gate-a');
      }

      const acc = engine.getAccounting();
      // Conservation Law 1: totalScheduled >= totalInjected
      assert.ok(acc.totalScheduled >= acc.totalInjected, 'Scheduled >= Injected');
      // Conservation Law 2: totalInjected = totalAdmitted + activeInSimulation
      assert.strictEqual(
        acc.totalInjected,
        acc.totalAdmitted + acc.activeInSimulation,
        'Injected must equal Admitted + Active'
      );
      // Conservation Law 3: representedAdmitted = totalAdmitted * S_pop
      assert.strictEqual(
        acc.representedAdmitted,
        Math.round(acc.totalAdmitted * event.population_scaling_ratio),
        'Represented admitted must equal totalAdmitted * S_pop'
      );
    }
  });

  it('9. Scenario 6 Paired Experiment Schedule Invariance: Baseline vs Exp A vs Exp B', () => {
    const scen6Def = SCENARIO_DEFINITIONS['safety_intervention'];
    const scen2Def = SCENARIO_DEFINITIONS['ticket_surge'];

    // Verify seed parity with Scenario 2
    assert.strictEqual(scen6Def.defaultEvent.randomSeed, scen2Def.defaultEvent.randomSeed, 'Scenario 6 seed must match Scenario 2 (2026)');

    const event6 = SyntheticDemandGenerator.generateSyntheticEvent(scen6Def.defaultEvent);
    const schedule6 = SyntheticDemandGenerator.generateArrivalSchedule(event6);

    // 1. Both baseline and mitigations share the EXACT SAME immutable schedule object
    const engineBaseline = new ScenarioEngine(event6, schedule6);
    const engineExpA = new ScenarioEngine(event6, schedule6);

    // Baseline: Gate B closed
    assert.strictEqual(engineBaseline.getGateState('gate-b')?.operationalLanes, 0);
    // Exp A: Gate B opened to 4 lanes
    engineExpA.setGateOperationalLanes('gate-b', 4);
    assert.strictEqual(engineExpA.getGateState('gate-b')?.operationalLanes, 4);

    // Verify identical injected descriptors over 120 simulation seconds
    const baselineSpawned = engineBaseline.step(120.0);
    const expASpawned = engineExpA.step(120.0);

    assert.strictEqual(baselineSpawned.length, expASpawned.length);
    for (let i = 0; i < baselineSpawned.length; i++) {
      assert.strictEqual(baselineSpawned[i].agentIndex, expASpawned[i].agentIndex);
      assert.strictEqual(baselineSpawned[i].defaultGateTarget, expASpawned[i].defaultGateTarget);
    }

    // Baseline rejects Gate B agents; Exp A admits Gate B agents
    assert.strictEqual(engineBaseline.attemptGatePassage('gate-b'), false, 'Baseline must reject Gate B');
    assert.strictEqual(engineExpA.attemptGatePassage('gate-b'), true, 'Exp A must admit through Gate B');
  });

});
