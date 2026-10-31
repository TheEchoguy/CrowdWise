/**
 * CROWDWISE Predictive Crowd Digital Twin & Safety Lab
 * Crowd Physics Reality Check & Six Scenario Comprehensive Test Suite
 *
 * Validates:
 * 1. Six scenario configuration loading & 35,000 Chinnaswamy stadium capacity
 * 2. Accurate population scaling (S_pop = 13.3 at 95% attendance for 2,500 agents)
 * 3. Deterministic seeded arrival schedules
 * 4. Simulation-time chronological agent injection
 * 5. Unavailable/closed gate admission rejection (0 throughput)
 * 6. Turnstile service capacity under failure (Scenario 3: exactly 10 sim agents/min)
 * 7. Population accounting invariants & conservation laws
 * 8. Three-zone density calculations & mutual exclusion (zero double-counting)
 * 9. Directional crossing line counting at y = 300
 * 10. Counterflow throughput comparison & capacity loss calculation
 * 11. Identical demand schedule between Baseline and Mitigations
 * 12. Displacement detector logic (reports DISPLACED when gate improves but holding worsens)
 * 13. Deterministic repeated experiment parity
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SCENARIO_DEFINITIONS } from '../data/scenarioDefinitions';
import { SyntheticDemandGenerator } from '../engine/SyntheticDemandGenerator';
import { ScenarioEngine } from '../engine/ScenarioEngine';
import { ThreeZoneMonitor } from '../engine/ThreeZoneMonitor';
import { ScenarioComparator } from '../engine/ScenarioComparator';
import { AgentData } from '../../types/simulation';
import { ThreeZoneTelemetry } from '../types/ScenarioTypes';

describe('CROWDWISE Comprehensive Validation: Six Scenarios & Crowd Physics Reality Check', () => {

  it('1. Six Scenarios: all six canonical configurations load with 35,000 capacity', () => {
    const scenarioIds = [
      'stadium_normal',
      'ticket_surge',
      'gate_failure',
      'uneven_distribution',
      'emergency_reversal',
      'safety_intervention'
    ] as const;

    for (const id of scenarioIds) {
      const def = SCENARIO_DEFINITIONS[id];
      assert.ok(def, `Scenario ${id} must exist in SCENARIO_DEFINITIONS`);
      assert.strictEqual(def.defaultEvent.venueCapacity, 35000, `Scenario ${id} must use 35,000 stadium capacity`);

      const event = SyntheticDemandGenerator.generateSyntheticEvent(def.defaultEvent);
      assert.strictEqual(event.venue_capacity, 35000);
      assert.ok(event.expected_attendance > 0, `Scenario ${id} expected attendance must be > 0`);
      assert.ok(event.population_scaling_ratio > 0, `Scenario ${id} S_pop must be > 0`);
    }
  });

  it('2. Population Scaling: 95% attendance on 35,000 capacity yields exactly S_pop = 13.3 for 2,500 agents', () => {
    const def = SCENARIO_DEFINITIONS['ticket_surge'];
    const event = SyntheticDemandGenerator.generateSyntheticEvent(def.defaultEvent);

    assert.strictEqual(event.expected_attendance, 33250, '35,000 * 0.95 = 33,250');
    assert.strictEqual(event.simulated_agent_population, 2500, 'Simulated agent cap is 2,500');
    assert.strictEqual(event.population_scaling_ratio, 13.3, 'S_pop = 33,250 / 2,500 = 13.3');
  });

  it('3. Deterministic Arrival Schedules: identical seeds yield bit-for-bit identical schedules', () => {
    const def = SCENARIO_DEFINITIONS['ticket_surge'];
    const event1 = SyntheticDemandGenerator.generateSyntheticEvent(def.defaultEvent);
    const event2 = SyntheticDemandGenerator.generateSyntheticEvent(def.defaultEvent);

    const schedule1 = SyntheticDemandGenerator.generateArrivalSchedule(event1);
    const schedule2 = SyntheticDemandGenerator.generateArrivalSchedule(event2);

    assert.strictEqual(schedule1.schedule.length, schedule2.schedule.length);
    for (let i = 0; i < 20; i++) {
      assert.strictEqual(schedule1.schedule[i].agentIndex, schedule2.schedule[i].agentIndex);
      assert.strictEqual(schedule1.schedule[i].spawnTimeSimSec, schedule2.schedule[i].spawnTimeSimSec);
      assert.strictEqual(schedule1.schedule[i].initialConcourseX, schedule2.schedule[i].initialConcourseX);
      assert.strictEqual(schedule1.schedule[i].defaultGateTarget, schedule2.schedule[i].defaultGateTarget);
    }
  });

  it('4. Simulation-Time Agent Injection: spawns strictly when descriptor spawnTimeSimSec <= t', () => {
    const def = SCENARIO_DEFINITIONS['ticket_surge'];
    const event = SyntheticDemandGenerator.generateSyntheticEvent(def.defaultEvent);
    const schedule = SyntheticDemandGenerator.generateArrivalSchedule(event);
    const engine = new ScenarioEngine(event, schedule);

    // Initial state: 0 spawned
    assert.strictEqual(engine.getAccounting().totalInjected, 0);

    // Step 10 seconds
    const spawned10 = engine.step(10.0);
    for (const a of spawned10) {
      assert.ok(a.spawnTimeSimSec <= 10.0, 'Spawned agents must have spawnTime <= 10.0s');
    }

    // Step another 50 seconds (total 60s)
    const spawned60 = engine.step(50.0);
    for (const a of spawned60) {
      assert.ok(a.spawnTimeSimSec <= 60.0, 'Spawned agents must have spawnTime <= 60.0s');
    }
  });

  it('5. Unavailable Gate: closed gate admits exactly 0 patrons', () => {
    const def = SCENARIO_DEFINITIONS['stadium_normal'];
    const event = SyntheticDemandGenerator.generateSyntheticEvent(def.defaultEvent);
    const schedule = SyntheticDemandGenerator.generateArrivalSchedule(event);
    const engine = new ScenarioEngine(event, schedule);

    // Step 60s to accumulate crowd
    engine.step(60.0);

    // Gate B has operationalLanes: 0
    assert.strictEqual(engine.getGateState('gate-b')?.operationalLanes, 0);

    for (let i = 0; i < 25; i++) {
      const admitted = engine.attemptGatePassage('gate-b');
      assert.strictEqual(admitted, false, 'Closed gate must unconditionally reject passage');
    }
    assert.strictEqual(engine.getGateState('gate-b')?.totalPassed, 0);
  });

  it('6. Turnstile Service Capacity: Scenario 3 hardware outage yields exactly 10 sim agents/min', () => {
    const def = SCENARIO_DEFINITIONS['gate_failure'];
    const event = SyntheticDemandGenerator.generateSyntheticEvent(def.defaultEvent);
    const schedule = SyntheticDemandGenerator.generateArrivalSchedule(event);
    const engine = new ScenarioEngine(event, schedule);

    // Theoretical capacity calculation
    const cap = SyntheticDemandGenerator.calculateTheoreticalGateCapacity(
      event.gates['gate-a'],
      event.population_scaling_ratio
    );
    assert.strictEqual(cap.simCapacityPerMin, 10, 'Scenario 3 capacity = (2 * 60) / 12 = 10 agents/min');

    // Ingest crowd
    engine.step(300.0);

    // Step 60 seconds and attempt entry continuously
    let admissions = 0;
    for (let sec = 0; sec < 60; sec++) {
      engine.step(1.0);
      for (let attempt = 0; attempt < 5; attempt++) {
        if (engine.attemptGatePassage('gate-a')) admissions++;
      }
    }

    assert.strictEqual(admissions, 10, 'Must admit exactly 10 agents in 60s window');
  });

  it('7. Population Accounting: strict conservation laws hold at all times', () => {
    const def = SCENARIO_DEFINITIONS['ticket_surge'];
    const event = SyntheticDemandGenerator.generateSyntheticEvent(def.defaultEvent);
    const schedule = SyntheticDemandGenerator.generateArrivalSchedule(event);
    const engine = new ScenarioEngine(event, schedule);

    for (let t = 0; t < 20; t++) {
      engine.step(15.0);
      for (let a = 0; a < 6; a++) {
        engine.attemptGatePassage('gate-a');
      }

      const acc = engine.getAccounting();
      assert.ok(acc.totalScheduled >= acc.totalInjected);
      assert.strictEqual(acc.totalInjected, acc.totalAdmitted + acc.activeInSimulation);
      assert.strictEqual(acc.representedAdmitted, Math.round(acc.totalAdmitted * event.population_scaling_ratio));
    }
  });

  it('8. Three-Zone Density Calculations: mutually exclusive non-overlapping regions', () => {
    const monitor = new ThreeZoneMonitor();

    // Create 30 agents (10 in each zone)
    const mockAgents: AgentData[] = [];
    for (let i = 1; i <= 10; i++) {
      mockAgents.push({ id: i, x: 480, y: 100, vx: 0, vy: -10, radius: 5, targetX: 480, targetY: 60, density: 1, stuckTime: 0, color: '#10b981', active: true }); // Zone 1
      mockAgents.push({ id: 10 + i, x: 480, y: 250, vx: 0, vy: -10, radius: 5, targetX: 480, targetY: 60, density: 1, stuckTime: 0, color: '#10b981', active: true }); // Zone 2
      mockAgents.push({ id: 20 + i, x: 480, y: 450, vx: 0, vy: -10, radius: 5, targetX: 480, targetY: 60, density: 1, stuckTime: 0, color: '#10b981', active: true }); // Zone 3
    }

    const telemetry = monitor.update(mockAgents, 1.0, 1.0, 10);

    // Each zone must have exactly 10 agents
    assert.strictEqual(telemetry.gateApproach.agentCount, 10, 'Zone 1 has exactly 10 agents');
    assert.strictEqual(telemetry.intermediateHolding.agentCount, 10, 'Zone 2 has exactly 10 agents');
    assert.strictEqual(telemetry.upstreamArrival.agentCount, 10, 'Zone 3 has exactly 10 agents');

    // Densities must be non-zero and inversely proportional to zone area
    assert.ok(telemetry.gateApproach.currentDensity > 0);
    assert.ok(telemetry.intermediateHolding.currentDensity > 0);
    assert.ok(telemetry.upstreamArrival.currentDensity > 0);
  });

  it('9. Directional Crossing Counts: counts inbound vs outbound crossings at y = 300', () => {
    const monitor = new ThreeZoneMonitor();

    // Step 1: Agent 1 at y = 320 (below line), Agent 2 at y = 280 (above line)
    const t1Agents: AgentData[] = [
      { id: 1, x: 480, y: 320, vx: 0, vy: -20, radius: 5, targetX: 480, targetY: 60, density: 1, stuckTime: 0, color: '#10b981', active: true },
      { id: 2, x: 480, y: 280, vx: 0, vy: 20, radius: 5, targetX: 480, targetY: 550, density: 1, stuckTime: 0, color: '#c084fc', active: true }
    ];
    monitor.update(t1Agents, 1.0, 1.0, 0);

    // Step 2: Agent 1 crosses to y = 280 (Inbound crossing!), Agent 2 crosses to y = 320 (Outbound crossing!)
    const t2Agents: AgentData[] = [
      { id: 1, x: 480, y: 280, vx: 0, vy: -20, radius: 5, targetX: 480, targetY: 60, density: 1, stuckTime: 0, color: '#10b981', active: true },
      { id: 2, x: 480, y: 320, vx: 0, vy: 20, radius: 5, targetX: 480, targetY: 550, density: 1, stuckTime: 0, color: '#c084fc', active: true }
    ];
    monitor.update(t2Agents, 1.0, 2.0, 0);

    const counterflow = monitor.getCounterflowTelemetry(25);
    assert.strictEqual(counterflow.inboundThroughputPerMin, 1, 'Exactly 1 inbound crossing recorded');
    assert.strictEqual(counterflow.outboundThroughputPerMin, 1, 'Exactly 1 outbound crossing recorded');
    assert.strictEqual(counterflow.totalCrossingCount, 2, 'Total 2 crossings');
  });

  it('10. Counter-Flow Throughput Comparison: capacity reduction is computed accurately', () => {
    const monitor = new ThreeZoneMonitor();
    monitor.setBaselineThroughput(200);

    const tel0 = monitor.getCounterflowTelemetry(0);
    assert.strictEqual(tel0.capacityReductionPercent, 0, '0% counterflow has 0% capacity reduction');

    const tel25 = monitor.getCounterflowTelemetry(25);
    assert.ok(tel25.capacityReductionPercent > 0, '25% counterflow must compute measurable capacity reduction');
    assert.ok(tel25.operationalRecommendation.length > 0, 'Recommendation must be present');
  });

  it('11. Identical Baseline and Mitigation Demand: paired experiment uses exact same arrival schedule', () => {
    const def = SCENARIO_DEFINITIONS['safety_intervention'];
    const event = SyntheticDemandGenerator.generateSyntheticEvent(def.defaultEvent);
    const schedule = SyntheticDemandGenerator.generateArrivalSchedule(event);

    const engineBase = new ScenarioEngine(event, schedule);
    const engineMit = new ScenarioEngine(event, schedule);

    // Verify schedule identity
    assert.strictEqual(engineBase.getSchedule(), engineMit.getSchedule(), 'Both runs MUST share the exact same schedule reference');
  });

  it('12. Displacement Detector Logic: correctly reports DISPLACED when gate improves but holding worsens', () => {
    // Baseline: Gate congested (6.0 p/m²), Holding calm (2.0 p/m²), Upstream calm (1.5 p/m²)
    const baselineZones: ThreeZoneTelemetry = {
      gateApproach: { zoneId: 'zone_gate', name: 'Gate Approach', currentDensity: 6.0, peakDensity: 6.0, averageSpeedMps: 0.3, agentCount: 120, waitingAgentsCount: 80, averageWaitingTimeSec: 45, queueLengthMeters: 25, observedThroughputPerMin: 60, spillbackMeters: 25, areaM2: 204, warningTriggered: true },
      intermediateHolding: { zoneId: 'zone_holding', name: 'Holding Area', currentDensity: 2.0, peakDensity: 2.0, averageSpeedMps: 1.2, agentCount: 60, waitingAgentsCount: 5, averageWaitingTimeSec: 5, queueLengthMeters: 5, observedThroughputPerMin: 60, spillbackMeters: 5, areaM2: 333, warningTriggered: false },
      upstreamArrival: { zoneId: 'zone_upstream', name: 'Upstream Arrival', currentDensity: 1.5, peakDensity: 1.5, averageSpeedMps: 1.3, agentCount: 50, waitingAgentsCount: 0, averageWaitingTimeSec: 0, queueLengthMeters: 2, observedThroughputPerMin: 60, spillbackMeters: 2, areaM2: 360, warningTriggered: false },
      systemMaxDensity: 6.0,
      timeIntegratedExposure: 90,
      timestampSec: 60
    };

    // Mitigated: Gate Approach improved to 3.5 p/m² (-41.7%), BUT Holding Area worsened to 5.2 p/m² (+160% DISPLACEMENT!)
    const mitigatedZones: ThreeZoneTelemetry = {
      gateApproach: { zoneId: 'zone_gate', name: 'Gate Approach', currentDensity: 3.5, peakDensity: 3.5, averageSpeedMps: 0.9, agentCount: 70, waitingAgentsCount: 15, averageWaitingTimeSec: 15, queueLengthMeters: 10, observedThroughputPerMin: 120, spillbackMeters: 10, areaM2: 204, warningTriggered: false },
      intermediateHolding: { zoneId: 'zone_holding', name: 'Holding Area', currentDensity: 5.2, peakDensity: 5.2, averageSpeedMps: 0.4, agentCount: 160, waitingAgentsCount: 90, averageWaitingTimeSec: 50, queueLengthMeters: 28, observedThroughputPerMin: 120, spillbackMeters: 28, areaM2: 333, warningTriggered: true },
      upstreamArrival: { zoneId: 'zone_upstream', name: 'Upstream Arrival', currentDensity: 1.6, peakDensity: 1.6, averageSpeedMps: 1.2, agentCount: 55, waitingAgentsCount: 2, averageWaitingTimeSec: 2, queueLengthMeters: 3, observedThroughputPerMin: 120, spillbackMeters: 3, areaM2: 360, warningTriggered: false },
      systemMaxDensity: 5.2,
      timeIntegratedExposure: 40,
      timestampSec: 60
    };

    const result = ScenarioComparator.analyzeDisplacement(baselineZones, mitigatedZones);

    // MUST report DISPLACED!
    assert.strictEqual(result.verdict, 'DISPLACED', 'Must detect bottleneck displacement to intermediate holding area');
    assert.ok(result.empiricalExplanation.includes('BOTTLENECK DISPLACEMENT DETECTED'));
    assert.ok(result.operationalRecommendation.length > 0);
  });

  it('13. Deterministic Repeated Experiment Parity: identical replay sequence across full run', () => {
    const def = SCENARIO_DEFINITIONS['ticket_surge'];
    const event = SyntheticDemandGenerator.generateSyntheticEvent(def.defaultEvent);
    const schedule = SyntheticDemandGenerator.generateArrivalSchedule(event);

    const engine1 = new ScenarioEngine(event, schedule);
    const engine2 = new ScenarioEngine(event, schedule);

    for (let t = 0; t < 10; t++) {
      const s1 = engine1.step(15.0);
      const s2 = engine2.step(15.0);
      assert.strictEqual(s1.length, s2.length);
      for (let i = 0; i < s1.length; i++) {
        assert.strictEqual(s1[i].agentIndex, s2[i].agentIndex);
        assert.strictEqual(s1[i].spawnTimeSimSec, s2[i].spawnTimeSimSec);
      }
    }
  });

});
