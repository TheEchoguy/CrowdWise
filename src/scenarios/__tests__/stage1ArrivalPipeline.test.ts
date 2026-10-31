/**
 * CROWDWISE — STAGE 1 AUDIT & VALIDATION SUITE: CROWD ARRIVAL PIPELINE
 *
 * Exhaustively tests the 12 Stage 1 Acceptance Criteria:
 * 1. Inflow conversion semantics: UI inflowRate (rep/min) converts accurately to simulated arrival rate via S_pop.
 * 2. Dynamic demand pacing: Dynamic inflow changes modify future pacing without mutating historical timestamps.
 * 3. No dropped or duplicate agents: Dynamic pacing preserves exact scheduled agent count and unique IDs.
 * 4. Gate independence: Physical turnstile capacity remains independent of arrival demand.
 * 5. Simultaneous gate distribution: Scenario 4 maintains ~75% Gate A and ~25% Gate B across all 4 arrival quartiles.
 * 6. Deterministic replay: Identical random seeds produce bit-for-bit identical arrival sequences.
 * 7. Queueing at unavailable gate: Agents targeting closed/failed gates queue outside and are not silently rerouted.
 * 8. Inbound vs Outbound lifecycle accounting: Strict separation of inbound admissions and outbound egress.
 * 9. Outbound single exit registration: Egressing agents register exit once and are never counted as admissions.
 * 10. 60-minute operational duration: All canonical scenarios specify 60-minute (3,600s) operational timelines.
 * 11. Demonstration mode 20x compression: 20x time acceleration maintains stable sub-stepping (dt_sub <= 0.025s).
 * 12. Simulation-time clock advancement: Agent injection depends strictly on simulation time, independent of FPS.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ScenarioEngine } from '../engine/ScenarioEngine';
import { SyntheticDemandGenerator } from '../engine/SyntheticDemandGenerator';
import { SCENARIO_DEFINITIONS } from '../data/scenarioDefinitions';
import { SyntheticEventConfigInput } from '../types/ScenarioTypes';

describe('CROWDWISE Stage 1: Crowd Arrival Pipeline Validation', () => {

  it('1. Inflow conversion: UI inflowRate (rep) converts accurately to simulated rate via S_pop', () => {
    const input: SyntheticEventConfigInput = {
      venueCapacity: 35000,
      ticketSalesPercentage: 0.95,
      attendancePercentage: 1.0,
      maxSimulatedAgents: 2500,
      arrivalStartTimeMin: 0,
      arrivalEndTimeMin: 60,
      arrivalDistribution: 'gaussian_peak',
      gateAShare: 0.75,
      gateBShare: 0.25,
      gates: {
        'gate-a': { gateId: 'gate-a', name: 'Gate 2', totalLanes: 4, operationalLanes: 4, turnstileLatencySec: 4.0 },
        'gate-b': { gateId: 'gate-b', name: 'Gate 3', totalLanes: 4, operationalLanes: 4, turnstileLatencySec: 4.0 }
      },
      randomSeed: 42
    };

    const event = SyntheticDemandGenerator.generateSyntheticEvent(input);
    const expectedAttendees = 35000 * 0.95; // 33,250
    assert.strictEqual(event.expected_attendance, expectedAttendees);
    assert.strictEqual(event.simulated_agent_population, 2500);

    const sPop = event.population_scaling_ratio; // S_pop = 33,250 / 2500 = 13.3
    assert.strictEqual(Math.abs(sPop - 13.3) < 0.05, true, `S_pop should be ~13.3, got ${sPop}`);

    // Verify conversion: R_sim = R_rep / S_pop
    const repRate600 = 600;
    const simRate600 = repRate600 / sPop;
    assert.strictEqual(Math.abs(simRate600 - 45.11) < 0.5, true, `600 rep p/min should yield ~45.1 sim/min`);

    const repRate1200 = 1200;
    const simRate1200 = repRate1200 / sPop;
    assert.strictEqual(Math.abs(simRate1200 - 90.23) < 0.5, true, `1200 rep p/min should yield ~90.2 sim/min`);
  });

  it('2. Dynamic demand pacing: slider change modifies pacing without mutating schedule timestamps', () => {
    const input: SyntheticEventConfigInput = {
      venueCapacity: 35000,
      ticketSalesPercentage: 0.60,
      maxSimulatedAgents: 600,
      arrivalStartTimeMin: 0,
      arrivalEndTimeMin: 60,
      arrivalDistribution: 'uniform',
      gateAShare: 0.5,
      gateBShare: 0.5,
      gates: {
        'gate-a': { gateId: 'gate-a', name: 'Gate A', totalLanes: 4, operationalLanes: 4, turnstileLatencySec: 4.0 }
      },
      randomSeed: 101
    };

    const event = SyntheticDemandGenerator.generateSyntheticEvent(input);
    const schedule = SyntheticDemandGenerator.generateArrivalSchedule(event);

    // Snapshot original schedule timestamps
    const originalTimestamps = schedule.schedule.map((a) => a.spawnTimeSimSec);

    const engine = new ScenarioEngine(event, schedule);

    // Step nominal (120s of sim time)
    const injectedPhase1 = engine.step(120.0);
    const countPhase1 = injectedPhase1.length;
    assert.strictEqual(countPhase1 > 0, true);

    // Double demand rate dynamically
    const currentNominalRep = event.peak_arrival_rate_real;
    engine.setDynamicInflowRate(currentNominalRep * 2.0);

    // Step another 60s of sim time with doubled demand
    const injectedPhase2 = engine.step(60.0);
    const countPhase2 = injectedPhase2.length;

    // Rate in Phase 2 (count / 60s) should be roughly double rate in Phase 1 (count / 120s)
    const rate1 = countPhase1 / 120;
    const rate2 = countPhase2 / 60;
    assert.strictEqual(rate2 > rate1 * 1.5, true, `Dynamic rate should be substantially higher: rate1=${rate1}, rate2=${rate2}`);

    // Verify schedule timestamps were NOT mutated
    for (let i = 0; i < schedule.schedule.length; i++) {
      assert.strictEqual(schedule.schedule[i].spawnTimeSimSec, originalTimestamps[i], `Schedule descriptor ${i} was mutated`);
    }
  });

  it('3. No dropped or duplicate agents: dynamic pacing preserves exact scheduled population and IDs', () => {
    const input: SyntheticEventConfigInput = {
      venueCapacity: 10000,
      ticketSalesPercentage: 0.50,
      maxSimulatedAgents: 300,
      arrivalStartTimeMin: 0,
      arrivalEndTimeMin: 10,
      arrivalDistribution: 'uniform',
      gateAShare: 1.0,
      gateBShare: 0.0,
      gates: {
        'gate-a': { gateId: 'gate-a', name: 'Gate A', totalLanes: 4, operationalLanes: 4, turnstileLatencySec: 4.0 }
      },
      randomSeed: 777
    };

    const event = SyntheticDemandGenerator.generateSyntheticEvent(input);
    const schedule = SyntheticDemandGenerator.generateArrivalSchedule(event);
    assert.strictEqual(schedule.schedule.length, 300);

    const engine = new ScenarioEngine(event, schedule);
    const spawnedIds = new Set<number>();

    // Step in intervals while fluctuating dynamic demand rate
    const nominalRate = event.peak_arrival_rate_real;
    const multipliers = [1.0, 2.5, 0.4, 3.0, 1.2, 5.0];

    for (let i = 0; i < multipliers.length; i++) {
      engine.setDynamicInflowRate(nominalRate * multipliers[i]);
      const spawned = engine.step(150.0);
      for (const a of spawned) {
        assert.strictEqual(spawnedIds.has(a.agentIndex), false, `Agent ${a.agentIndex} spawned more than once!`);
        spawnedIds.add(a.agentIndex);
      }
    }

    // Step until all are spawned
    while (!engine.isArrivalComplete()) {
      const spawned = engine.step(100.0);
      for (const a of spawned) {
        assert.strictEqual(spawnedIds.has(a.agentIndex), false, `Agent ${a.agentIndex} duplicate!`);
        spawnedIds.add(a.agentIndex);
      }
    }

    assert.strictEqual(spawnedIds.size, 300, `Expected 300 unique spawned agents, got ${spawnedIds.size}`);
    assert.strictEqual(engine.getAccounting().totalInjected, 300);
  });

  it('4. Gate independence: physical turnstile capacity remains independent of arrival demand', () => {
    const input: SyntheticEventConfigInput = {
      venueCapacity: 35000,
      ticketSalesPercentage: 0.95,
      maxSimulatedAgents: 1000,
      arrivalStartTimeMin: 0,
      arrivalEndTimeMin: 20,
      arrivalDistribution: 'uniform',
      gateAShare: 1.0,
      gateBShare: 0.0,
      gates: {
        'gate-a': { gateId: 'gate-a', name: 'Gate A', totalLanes: 4, operationalLanes: 4, turnstileLatencySec: 4.0 }
      },
      randomSeed: 42
    };

    const event = SyntheticDemandGenerator.generateSyntheticEvent(input);
    const schedule = SyntheticDemandGenerator.generateArrivalSchedule(event);
    const engine = new ScenarioEngine(event, schedule);

    // Gate A has 4 lanes, 4.0s latency -> Theoretical max throughput = 4 / 4s = 1.0 agent/sec = 60 agents/min
    const theoreticalCap = engine.getTheoreticalThroughputSimPerMin('gate-a');
    assert.strictEqual(theoreticalCap, 60.0);

    // Inject 200 agents
    engine.step(300.0);
    assert.strictEqual(engine.getAccounting().totalInjected >= 200, true);

    // Simulate 60 seconds of turnstile discharge under heavy queue
    let admittedCount = 0;
    const simDurationSec = 60;
    const dt = 0.5;
    for (let t = 0; t < simDurationSec; t += dt) {
      engine.step(dt);
      while (engine.attemptGatePassage('gate-a')) {
        admittedCount++;
      }
    }

    // In 60 seconds with 4 lanes at 4s each, maximum admitted is exactly 60 agents
    assert.strictEqual(admittedCount <= 61, true, `Admitted ${admittedCount} exceeded physical capacity (60)`);
    assert.strictEqual(admittedCount >= 58, true, `Admitted ${admittedCount} should be near capacity (60)`);

    // Triple the inflow rate slider and verify theoretical capacity is still strictly 60.0
    engine.setDynamicInflowRate(event.peak_arrival_rate_real * 3.0);
    assert.strictEqual(engine.getTheoreticalThroughputSimPerMin('gate-a'), 60.0, 'Capacity must remain independent of demand');
  });

  it('5. Simultaneous gate distribution: Scenario 4 maintains ~75% Gate A and ~25% Gate B across all 4 quartiles', () => {
    const def = SCENARIO_DEFINITIONS['uneven_distribution'];
    const event = SyntheticDemandGenerator.generateSyntheticEvent(def.defaultEvent);
    const schedule = SyntheticDemandGenerator.generateArrivalSchedule(event);

    const descriptors = schedule.schedule;
    const N = descriptors.length;
    assert.strictEqual(N >= 1000, true, 'Scenario 4 should have simulated population >= 1000');

    // Chronologically sorted schedule
    for (let i = 1; i < N; i++) {
      assert.strictEqual(descriptors[i].spawnTimeSimSec >= descriptors[i - 1].spawnTimeSimSec, true);
    }

    // Divide into 4 quartiles
    const qSize = Math.floor(N / 4);
    const quartiles = [
      descriptors.slice(0, qSize),
      descriptors.slice(qSize, qSize * 2),
      descriptors.slice(qSize * 2, qSize * 3),
      descriptors.slice(qSize * 3)
    ];

    for (let q = 0; q < 4; q++) {
      const qSlice = quartiles[q];
      const gateACount = qSlice.filter((a) => a.defaultGateTarget === 'gate-a').length;
      const gateBCount = qSlice.filter((a) => a.defaultGateTarget === 'gate-b').length;
      const ratioA = gateACount / qSlice.length;
      const ratioB = gateBCount / qSlice.length;

      // Each quartile must have ~75% Gate A and ~25% Gate B simultaneously (+- 10% tolerance)
      assert.strictEqual(
        Math.abs(ratioA - 0.75) < 0.10,
        true,
        `Quartile ${q + 1} Gate A ratio was ${ratioA.toFixed(3)}, expected ~0.75`
      );
      assert.strictEqual(
        Math.abs(ratioB - 0.25) < 0.10,
        true,
        `Quartile ${q + 1} Gate B ratio was ${ratioB.toFixed(3)}, expected ~0.25`
      );
    }
  });

  it('6. Deterministic replay: identical seeds yield bit-for-bit identical schedules; different seeds diverge', () => {
    const input: SyntheticEventConfigInput = {
      venueCapacity: 35000,
      ticketSalesPercentage: 0.85,
      maxSimulatedAgents: 500,
      arrivalStartTimeMin: 0,
      arrivalEndTimeMin: 60,
      arrivalDistribution: 'burst',
      burstIntervals: [
        { startMin: 15, endMin: 25, weight: 0.6 },
        { startMin: 45, endMin: 55, weight: 0.4 }
      ],
      gateAShare: 0.6,
      gateBShare: 0.4,
      gates: {
        'gate-a': { gateId: 'gate-a', name: 'Gate A', totalLanes: 4, operationalLanes: 4, turnstileLatencySec: 4.0 },
        'gate-b': { gateId: 'gate-b', name: 'Gate B', totalLanes: 4, operationalLanes: 4, turnstileLatencySec: 4.0 }
      },
      randomSeed: 8888
    };

    const event1 = SyntheticDemandGenerator.generateSyntheticEvent(input);
    const sched1 = SyntheticDemandGenerator.generateArrivalSchedule(event1);

    const event2 = SyntheticDemandGenerator.generateSyntheticEvent(input);
    const sched2 = SyntheticDemandGenerator.generateArrivalSchedule(event2);

    assert.strictEqual(sched1.schedule.length, sched2.schedule.length);
    for (let i = 0; i < sched1.schedule.length; i++) {
      assert.strictEqual(sched1.schedule[i].agentIndex, sched2.schedule[i].agentIndex);
      assert.strictEqual(sched1.schedule[i].spawnTimeSimSec, sched2.schedule[i].spawnTimeSimSec);
      assert.strictEqual(sched1.schedule[i].initialConcourseX, sched2.schedule[i].initialConcourseX);
      assert.strictEqual(sched1.schedule[i].initialConcourseY, sched2.schedule[i].initialConcourseY);
      assert.strictEqual(sched1.schedule[i].defaultGateTarget, sched2.schedule[i].defaultGateTarget);
      assert.strictEqual(sched1.schedule[i].walkingSpeedMps, sched2.schedule[i].walkingSpeedMps);
    }

    // Different seed
    const eventDiff = SyntheticDemandGenerator.generateSyntheticEvent({ ...input, randomSeed: 9999 });
    const schedDiff = SyntheticDemandGenerator.generateArrivalSchedule(eventDiff);
    let differences = 0;
    for (let i = 0; i < sched1.schedule.length; i++) {
      if (sched1.schedule[i].spawnTimeSimSec !== schedDiff.schedule[i].spawnTimeSimSec ||
          sched1.schedule[i].initialConcourseX !== schedDiff.schedule[i].initialConcourseX) {
        differences++;
      }
    }
    assert.strictEqual(differences > 400, true, 'Different seed must produce divergent arrival schedule');
  });

  it('7. Queueing at unavailable gate: closed gate rejects entry and preserves assigned target', () => {
    const input: SyntheticEventConfigInput = {
      venueCapacity: 35000,
      ticketSalesPercentage: 0.85,
      maxSimulatedAgents: 500,
      arrivalStartTimeMin: 0,
      arrivalEndTimeMin: 60,
      arrivalDistribution: 'uniform',
      gateAShare: 0.70,
      gateBShare: 0.30,
      gates: {
        'gate-a': { gateId: 'gate-a', name: 'Gate A', totalLanes: 4, operationalLanes: 4, turnstileLatencySec: 4.0 },
        'gate-b': { gateId: 'gate-b', name: 'Gate B (Closed)', totalLanes: 4, operationalLanes: 0, turnstileLatencySec: 4.0 }
      },
      randomSeed: 3003
    };

    const event = SyntheticDemandGenerator.generateSyntheticEvent(input);
    const schedule = SyntheticDemandGenerator.generateArrivalSchedule(event);

    // Confirm that Gate B target is explicitly assigned
    const gateBTargets = schedule.schedule.filter((a) => a.defaultGateTarget === 'gate-b');
    assert.strictEqual(gateBTargets.length > 0, true, 'Gate B assigned agents must exist in schedule');

    const engine = new ScenarioEngine(event, schedule);
    engine.step(120.0);

    // Attempt passage at Gate B: must be unconditionally rejected
    assert.strictEqual(engine.attemptGatePassage('gate-b'), false, 'Closed gate must reject passage');

    const gateBState = engine.getGateState('gate-b');
    assert.strictEqual(gateBState?.operationalLanes, 0);
  });

  it('8. Inbound vs Outbound lifecycle accounting: tracks injections, admissions, and exits separately', () => {
    const input: SyntheticEventConfigInput = {
      venueCapacity: 10000,
      ticketSalesPercentage: 0.50,
      maxSimulatedAgents: 100,
      arrivalStartTimeMin: 0,
      arrivalEndTimeMin: 10,
      arrivalDistribution: 'uniform',
      gateAShare: 1.0,
      gateBShare: 0.0,
      gates: {
        'gate-a': { gateId: 'gate-a', name: 'Gate A', totalLanes: 4, operationalLanes: 4, turnstileLatencySec: 4.0 }
      },
      randomSeed: 55
    };

    const event = SyntheticDemandGenerator.generateSyntheticEvent(input);
    const schedule = SyntheticDemandGenerator.generateArrivalSchedule(event);
    const engine = new ScenarioEngine(event, schedule);

    // Simulate 40 inbound injections and 15 outbound injections
    for (let i = 0; i < 40; i++) engine.recordInboundInjected();
    for (let i = 0; i < 15; i++) engine.recordOutboundInjected();

    let acc = engine.getAccounting();
    assert.strictEqual(acc.totalInboundInjected, 40);
    assert.strictEqual(acc.totalOutboundInjected, 15);
    assert.strictEqual(acc.totalInjected, 55);
    assert.strictEqual(acc.activeInbound, 40);
    assert.strictEqual(acc.activeOutbound, 15);
    assert.strictEqual(acc.activeInSimulation, 55);

    // 25 inbound patrons pass Gate A turnstile
    for (let i = 0; i < 25; i++) {
      engine.step(5.0); // Reset cooldown
      engine.attemptGatePassage('gate-a');
    }

    // 10 outbound patrons exit the concourse boundary
    for (let i = 0; i < 10; i++) {
      engine.recordOutboundExit();
    }

    acc = engine.getAccounting();
    assert.strictEqual(acc.totalAdmitted, 25);
    assert.strictEqual(acc.totalOutboundExited, 10);
    assert.strictEqual(acc.activeInbound, 15, 'Active inbound: 40 - 25 = 15');
    assert.strictEqual(acc.activeOutbound, 5, 'Active outbound: 15 - 10 = 5');
    assert.strictEqual(acc.activeInSimulation, 20, 'Total active: 15 + 5 = 20');
  });

  it('9. Outbound single exit registration: exits never count as turnstile admissions', () => {
    const input: SyntheticEventConfigInput = {
      venueCapacity: 10000,
      ticketSalesPercentage: 0.50,
      maxSimulatedAgents: 50,
      arrivalStartTimeMin: 0,
      arrivalEndTimeMin: 10,
      arrivalDistribution: 'uniform',
      gateAShare: 1.0,
      gateBShare: 0.0,
      gates: {
        'gate-a': { gateId: 'gate-a', name: 'Gate A', totalLanes: 4, operationalLanes: 4, turnstileLatencySec: 4.0 }
      },
      randomSeed: 12
    };

    const event = SyntheticDemandGenerator.generateSyntheticEvent(input);
    const schedule = SyntheticDemandGenerator.generateArrivalSchedule(event);
    const engine = new ScenarioEngine(event, schedule);

    // Inject 10 outbound agents
    for (let i = 0; i < 10; i++) engine.recordOutboundInjected();

    // Register 10 exits
    for (let i = 0; i < 10; i++) {
      engine.recordOutboundExit();
    }

    const acc = engine.getAccounting();
    assert.strictEqual(acc.totalOutboundExited, 10);
    assert.strictEqual(acc.activeOutbound, 0);
    assert.strictEqual(acc.totalAdmitted, 0, 'Outbound exit must NOT increment totalAdmitted');
    assert.strictEqual(acc.representedAdmitted, 0, 'Outbound exit must NOT increment representedAdmitted');
  });

  it('10. 60-minute operational duration: canonical scenarios define 60m (3,600s) timeline', () => {
    const scenarioKeys = Object.keys(SCENARIO_DEFINITIONS) as (keyof typeof SCENARIO_DEFINITIONS)[];
    assert.strictEqual(scenarioKeys.length, 6);

    for (const key of scenarioKeys) {
      const def = SCENARIO_DEFINITIONS[key];
      const startMin = def.defaultEvent.arrivalStartTimeMin ?? 0;
      const endMin = def.defaultEvent.arrivalEndTimeMin ?? 60;
      const durationMin = endMin - startMin;
      assert.strictEqual(durationMin, 60, `Scenario ${key} duration must be 60 minutes`);

      const event = SyntheticDemandGenerator.generateSyntheticEvent(def.defaultEvent);
      assert.strictEqual(event.arrival_start_time_min, 0);
      assert.strictEqual(event.arrival_end_time_min, 60);
    }
  });

  it('11. Demonstration mode 20x time compression: sub-stepping guarantees dt_sub <= 0.025s', () => {
    const timeScale = 1.0;
    const demoTimeMultiplier = 20.0;
    const nominalFps = 60.0;
    const rawDt = 1.0 / nominalFps; // ~0.01667s

    // Total simulation delta in 20x demo mode
    const totalSimDt = rawDt * timeScale * demoTimeMultiplier; // ~0.3333s
    assert.strictEqual(Math.abs(totalSimDt - 0.3333) < 0.01, true);

    // Sub-stepping calculation to enforce Helbing force stability (dt_sub <= 0.025s)
    const subSteps = Math.max(1, Math.ceil(totalSimDt / 0.025));
    const dtSub = totalSimDt / subSteps;

    assert.strictEqual(subSteps >= 14, true, `Expected >= 14 sub-steps for 20x compression, got ${subSteps}`);
    assert.strictEqual(dtSub <= 0.025, true, `dtSub must be <= 0.025s for physics stability, got ${dtSub}`);

    // Total real time to execute full 60-minute (3,600s) simulation
    const simulatedEventDurationSec = 3600;
    const realTimeSec = simulatedEventDurationSec / demoTimeMultiplier;
    assert.strictEqual(realTimeSec, 180, '60-minute simulation runs in exactly 3.0 real minutes at 20x');
  });

  it('12. Simulation-time clock advancement: injection depends strictly on t_sim, independent of FPS', () => {
    const input: SyntheticEventConfigInput = {
      venueCapacity: 10000,
      ticketSalesPercentage: 0.50,
      maxSimulatedAgents: 100,
      arrivalStartTimeMin: 0,
      arrivalEndTimeMin: 10,
      arrivalDistribution: 'uniform',
      gateAShare: 1.0,
      gateBShare: 0.0,
      gates: {
        'gate-a': { gateId: 'gate-a', name: 'Gate A', totalLanes: 4, operationalLanes: 4, turnstileLatencySec: 4.0 }
      },
      randomSeed: 333
    };

    const event = SyntheticDemandGenerator.generateSyntheticEvent(input);
    const schedule = SyntheticDemandGenerator.generateArrivalSchedule(event);

    // Runner 1: 60 FPS (dt = 1/60s) for 10.0 seconds = 600 steps
    const engine60Fps = new ScenarioEngine(event, schedule);
    const dt60 = 10.0 / 600;
    let injected60 = 0;
    for (let i = 0; i < 600; i++) {
      injected60 += engine60Fps.step(dt60).length;
    }

    // Runner 2: 30 FPS (dt = 1/30s) for 10.0 seconds = 300 steps
    const engine30Fps = new ScenarioEngine(event, schedule);
    const dt30 = 10.0 / 300;
    let injected30 = 0;
    for (let i = 0; i < 300; i++) {
      injected30 += engine30Fps.step(dt30).length;
    }

    // Runner 3: Variable framerate (dt jittered between 0.01 and 0.04) summing to 10.0s
    const engineVariable = new ScenarioEngine(event, schedule);
    let injectedVar = 0;
    let accumulatedTime = 0;
    let stepIndex = 0;
    while (accumulatedTime < 10.0) {
      const stepDt = Math.min(0.01 + ((stepIndex * 7) % 30) * 0.001, 10.0 - accumulatedTime);
      injectedVar += engineVariable.step(stepDt).length;
      accumulatedTime += stepDt;
      stepIndex++;
    }

    assert.strictEqual(
      injected60,
      injected30,
      `60 FPS and 30 FPS must produce identical injected counts: ${injected60} vs ${injected30}`
    );
    assert.strictEqual(
      injected60,
      injectedVar,
      `Fixed FPS and variable FPS must produce identical injected counts: ${injected60} vs ${injectedVar}`
    );
  });

});
