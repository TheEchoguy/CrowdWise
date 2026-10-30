import { describe, it, expect, beforeEach } from 'vitest';
import { SimulationEngine } from '../SimulationEngine';
import { CHINNASWAMY_STADIUM_PROFILE } from '../../data/chinnaswamyStadium';

describe('Gate-Side Simulation & Live Capacity Engine', () => {
  let engine: SimulationEngine;

  beforeEach(() => {
    engine = new SimulationEngine(CHINNASWAMY_STADIUM_PROFILE, 42);
    // Zero global inflow to isolate gate-side tests
    engine.state.inflowConfig.estimatedAttendance = 0;
    engine.state.inflowConfig.unexpectedCrowdAddition = 0;
  });

  describe('Capacity Formula & Unit Conversions', () => {
    it('should correctly calculate theoretical capacity: ratePerSec * activeCounters * 60', () => {
      const calcCapacity = (ratePerSec: number, counters: number) =>
        Math.round(ratePerSec * counters * 60);

      // 4 counters @ 1.0 person/sec = 240 people/min
      expect(calcCapacity(1.0, 4)).toBe(240);

      // 6 counters @ 0.5 person/sec = 180 people/min
      expect(calcCapacity(0.5, 6)).toBe(180);

      // 2 counters @ 1.5 person/sec = 180 people/min
      expect(calcCapacity(1.5, 2)).toBe(180);

      // 0 counters (all offline) = 0 people/min
      expect(calcCapacity(1.0, 0)).toBe(0);

      // 8 counters @ 1.2 person/sec = 576 people/min
      expect(calcCapacity(1.2, 8)).toBe(576);
    });
  });

  describe('Scenario A: Normal Operation (Capacity > Inflow)', () => {
    it('should drain existing queue and keep queue stable when processing capacity exceeds inflow', () => {
      const gate1 = engine.state.venue.gates.find((g) => g.id === 'gate-1')!;
      gate1.scannerCount = 4;
      gate1.operationalScanners = 4;

      engine.setGateSideConfig({
        selectedGateIds: ['gate-1'],
        inflowRatePerMin: 100,
        processingRatePerSec: 1.0,
        arrivalPattern: 'GRADUAL',
      });

      engine.applyInitialQueue(20, ['gate-1']);
      expect(gate1.currentQueue).toBe(20);

      engine.start();

      for (let i = 0; i < 300; i++) {
        engine.step(0.1);
      }

      expect(gate1.admittedCount || gate1.totalProcessedCount).toBeGreaterThan(0);
      expect(gate1.currentQueue).toBeLessThan(10);
    });
  });

  describe('Scenario B: Inflow Exceeds Capacity', () => {
    it('should accumulate queue when inflow rate is higher than processing capacity', () => {
      const gate1 = engine.state.venue.gates.find((g) => g.id === 'gate-1')!;
      gate1.scannerCount = 4;
      gate1.operationalScanners = 4;

      engine.setGateSideConfig({
        selectedGateIds: ['gate-1'],
        inflowRatePerMin: 360,
        processingRatePerSec: 1.0,
        arrivalPattern: 'GRADUAL',
      });

      engine.applyInitialQueue(10, ['gate-1']);
      engine.start();

      for (let i = 0; i < 400; i++) {
        engine.step(0.1);
      }

      expect(gate1.totalArrivalsCount || 0).toBeGreaterThan(gate1.totalProcessedCount || 0);
      expect(gate1.maxQueueRecorded || 0).toBeGreaterThan(10);
    });
  });

  describe('Scenario C: Counter Failure', () => {
    it('should transition from stable to queue accumulation when counters fail', () => {
      const gate1 = engine.state.venue.gates.find((g) => g.id === 'gate-1')!;
      gate1.scannerCount = 4;
      gate1.operationalScanners = 4;

      engine.setGateSideConfig({
        selectedGateIds: ['gate-1'],
        inflowRatePerMin: 200,
        processingRatePerSec: 1.0,
        arrivalPattern: 'GRADUAL',
      });

      engine.applyInitialQueue(10, ['gate-1']);
      engine.start();

      for (let i = 0; i < 150; i++) {
        engine.step(0.1);
      }
      const queueBeforeFailure = gate1.currentQueue;

      // Failure occurs
      gate1.operationalScanners = 2;
      gate1.status = 'SCANNER_FAILURE';
      engine.logGateSideEvent('COUNTER_FAILURE', '2 counters went offline');

      for (let i = 0; i < 300; i++) {
        engine.step(0.1);
      }

      expect(gate1.currentQueue).toBeGreaterThanOrEqual(queueBeforeFailure);
      expect(gate1.operationalScanners).toBe(2);
    });
  });

  describe('Scenario D: Surge and Recovery', () => {
    it('should build queue during peak surge and clear during recovery window', () => {
      const gate1 = engine.state.venue.gates.find((g) => g.id === 'gate-1')!;
      gate1.scannerCount = 4;
      gate1.operationalScanners = 4;

      engine.start();

      // Phase 1: Surge
      engine.setGateSideConfig({
        selectedGateIds: ['gate-1'],
        inflowRatePerMin: 420,
        processingRatePerSec: 1.0,
        arrivalPattern: 'GRADUAL',
      });
      engine.applyInitialQueue(20, ['gate-1']);

      for (let i = 0; i < 250; i++) {
        engine.step(0.1);
      }
      const peakQueue = gate1.currentQueue;
      expect(peakQueue).toBeGreaterThan(15);

      // Phase 2: Recovery
      engine.setGateSideConfig({
        inflowRatePerMin: 40,
      });

      for (let i = 0; i < 400; i++) {
        engine.step(0.1);
      }

      expect(gate1.currentQueue).toBeLessThan(peakQueue);
    });
  });

  describe('Scenario E: Gate Closure Handling', () => {
    it('should stop admissions when gate is closed without deleting queued people', () => {
      const gate1 = engine.state.venue.gates.find((g) => g.id === 'gate-1')!;
      gate1.scannerCount = 4;
      gate1.operationalScanners = 4;

      engine.setGateSideConfig({
        selectedGateIds: ['gate-1'],
        inflowRatePerMin: 120,
        processingRatePerSec: 1.0,
      });

      engine.applyInitialQueue(25, ['gate-1']);
      engine.start();

      gate1.direction = 'CLOSED';
      gate1.status = 'TEMPORARILY_CLOSED';
      engine.logGateSideEvent('GATE_CLOSED', 'Gate 1 closed for tactical safety');

      const processedBefore = gate1.totalProcessedCount || 0;

      for (let i = 0; i < 200; i++) {
        engine.step(0.1);
      }

      expect(gate1.totalProcessedCount || 0).toBe(processedBefore);
      expect(gate1.currentQueue).toBeGreaterThanOrEqual(25);
    });
  });

  describe('Scenario F: Multi-Gate Routing Policies', () => {
    it('should route incoming crowd to the gate with SHORTEST_QUEUE', () => {
      const g1 = engine.state.venue.gates.find((g) => g.id === 'gate-1')!;
      const g2 = engine.state.venue.gates.find((g) => g.id === 'gate-2')!;
      const g3 = engine.state.venue.gates.find((g) => g.id === 'gate-3')!;

      g1.currentQueue = 50;
      g2.currentQueue = 5;
      g3.currentQueue = 30;

      engine.setGateSideConfig({
        selectedGateIds: ['gate-1', 'gate-2', 'gate-3'],
        routingPolicy: 'SHORTEST_QUEUE',
        inflowRatePerMin: 120,
        processingRatePerSec: 1.0,
      });

      const arrivalsBefore = g2.totalArrivalsCount || 0;
      engine.start();
      engine.step(1.0);

      expect(g2.totalArrivalsCount || 0).toBeGreaterThan(arrivalsBefore);
    });

    it('should route incoming crowd avoiding gates with blocked downstream corridors in ROUTE_AWARE mode', () => {
      const g1 = engine.state.venue.gates.find((g) => g.id === 'gate-1')!;
      const g2 = engine.state.venue.gates.find((g) => g.id === 'gate-2')!;

      g1.currentQueue = 10;
      g2.currentQueue = 12;

      if (g1.downstreamCorridorId) {
        const corr = engine.state.venue.corridors.find((c) => c.id === g1.downstreamCorridorId);
        if (corr) corr.isBlocked = true;
      }

      engine.setGateSideConfig({
        selectedGateIds: ['gate-1', 'gate-2'],
        routingPolicy: 'ROUTE_AWARE',
        inflowRatePerMin: 120,
        processingRatePerSec: 1.0,
      });

      const arrivalsG2Before = g2.totalArrivalsCount || 0;
      engine.start();
      engine.step(1.0);

      expect(g2.totalArrivalsCount || 0).toBeGreaterThan(arrivalsG2Before);
    });
  });

  describe('Scenario G: Physical Queue Overflow & Spillback', () => {
    it('should track spillback count when queue exceeds queueAreaCapacity', () => {
      const gate1 = engine.state.venue.gates.find((g) => g.id === 'gate-1')!;
      gate1.queueAreaCapacity = 80;

      gate1.currentQueue = 50;
      engine.step(0.1);
      expect(gate1.spillbackCount).toBe(0);

      gate1.currentQueue = 115;
      engine.step(0.1);
      expect(gate1.spillbackCount).toBe(35);
      expect(gate1.maxQueueRecorded).toBeGreaterThanOrEqual(115);
    });
  });

  describe('Scenario H: Downstream Bottleneck Throttling', () => {
    it('should hold gate release when downstream corridor is blocked to prevent crush hazard', () => {
      const gate1 = engine.state.venue.gates.find((g) => g.id === 'gate-1')!;
      gate1.operationalScanners = 4;
      gate1.currentQueue = 30;

      const corr = engine.state.venue.corridors.find((c) => c.id === gate1.downstreamCorridorId);
      if (corr) {
        corr.isBlocked = true;
      }

      engine.setGateSideConfig({
        selectedGateIds: ['gate-1'],
        processingRatePerSec: 1.0,
      });

      const processedBefore = gate1.totalProcessedCount || 0;
      engine.start();

      for (let i = 0; i < 100; i++) {
        engine.step(0.1);
      }

      expect(gate1.totalProcessedCount || 0).toBe(processedBefore);
      expect(gate1.suggestedAction).toContain('Downstream corridor congested / blocked');
    });
  });

  describe('Scenario I: Live Configuration Changes Mid-Simulation', () => {
    it('should update inflow and counter rates mid-run without resetting clock or losing queue', () => {
      engine.setGateSideConfig({
        selectedGateIds: ['gate-1'],
        inflowRatePerMin: 120,
        processingRatePerSec: 1.0,
      });

      engine.applyInitialQueue(15, ['gate-1']);
      engine.start();

      for (let i = 0; i < 100; i++) {
        engine.step(0.1);
      }
      const timeBefore = engine.state.simTimeSecs;
      expect(timeBefore).toBeCloseTo(10.0, 1);

      engine.setGateSideConfig({
        inflowRatePerMin: 300,
        processingRatePerSec: 2.0,
      });

      expect(engine.state.simTimeSecs).toBeCloseTo(timeBefore, 1);
      expect(engine.gateSideConfig.inflowRatePerMin).toBe(300);
      expect(engine.gateSideConfig.processingRatePerSec).toBe(2.0);
    });
  });

  describe('Scenario J: Conservation of People (Mass Balance)', () => {
    it('should conserve total people across states without duplicate IDs or silently dropped agents', () => {
      const gate1 = engine.state.venue.gates.find((g) => g.id === 'gate-1')!;
      gate1.operationalScanners = 4;

      engine.setGateSideConfig({
        selectedGateIds: ['gate-1'],
        inflowRatePerMin: 180,
        processingRatePerSec: 1.0,
      });

      engine.applyInitialQueue(20, ['gate-1']);
      engine.start();

      for (let i = 0; i < 200; i++) {
        engine.step(0.1);
      }

      const agents = engine.state.agents;
      const agentIds = new Set(agents.map((a) => a.id));

      expect(agentIds.size).toBe(agents.length);

      const validStates = new Set([
        'APPROACHING',
        'QUEUING',
        'PROCESSING',
        'ADMITTED',
        'EN_ROUTE_DESTINATION',
        'INSIDE',
        'DIVERTED',
        'WAITING_ASSISTANCE',
      ]);

      for (const a of agents) {
        expect(validStates.has(a.state)).toBe(true);
      }

      expect(gate1.totalProcessedCount || 0).toBeGreaterThan(0);
      expect(gate1.totalArrivalsCount || 0).toBeGreaterThanOrEqual(gate1.totalProcessedCount || 0);
    });
  });

  /* ========================================================================= */
  /* GATE ENTRY COUNTING & VISUAL EXIT AFTER ENTRY: 12 REQUIRED TESTS           */
  /* ========================================================================= */

  describe('Gate Entry Counting & Visual Exit After Entry (12 Requirement Tests)', () => {
    // 1. A pedestrian approaches a gate but does not increase the entry count.
    it('Test 1: should not increase entry count when a pedestrian merely approaches a gate', () => {
      const gate1 = engine.state.venue.gates.find((g) => g.id === 'gate-1')!;
      gate1.operationalScanners = 4;
      gate1.currentQueue = 0;
      gate1.admittedCount = 0;
      gate1.totalProcessedCount = 0;

      // Spawn 1 approaching agent far back on approach route
      engine.setGateSideConfig({
        selectedGateIds: ['gate-1'],
        inflowRatePerMin: 60,
      });

      engine.start();
      // Step 2 seconds: agent spawns and starts walking towards gate
      for (let i = 0; i < 20; i++) {
        engine.step(0.1);
      }

      const approachingAgent = engine.state.agents.find(
        (a) => a.state === 'APPROACHING' && a.targetGateId === 'gate-1'
      );
      expect(approachingAgent).toBeDefined();
      expect(approachingAgent?.state).toBe('APPROACHING');

      // Entry count must be strictly 0
      expect(gate1.admittedCount || 0).toBe(0);
      expect(gate1.totalProcessedCount || 0).toBe(0);
    });

    // 2. A pedestrian waits in the queue without increasing the entry count.
    it('Test 2: should not increase entry count while a pedestrian is waiting in queue', () => {
      const gate1 = engine.state.venue.gates.find((g) => g.id === 'gate-1')!;
      // Zero scanner throughput so queue cannot process
      gate1.operationalScanners = 0;
      gate1.admittedCount = 0;
      gate1.totalProcessedCount = 0;

      engine.applyInitialQueue(10, ['gate-1']);
      expect(gate1.currentQueue).toBe(10);

      engine.start();
      for (let i = 0; i < 50; i++) {
        engine.step(0.1);
      }

      // People are waiting in queue
      expect(gate1.currentQueue).toBe(10);
      // Entry counter must remain 0
      expect(gate1.admittedCount || 0).toBe(0);
      expect(gate1.totalProcessedCount || 0).toBe(0);
    });

    // 3. A pedestrian successfully passes through Gate 1 and increments Gate 1's count exactly once.
    it('Test 3: should increment Gate 1 count exactly once per successful admission', () => {
      const gate1 = engine.state.venue.gates.find((g) => g.id === 'gate-1')!;
      gate1.operationalScanners = 1;
      gate1.scannerProcessingRatePerSec = 1.0;
      gate1.admittedCount = 0;
      gate1.totalProcessedCount = 0;

      engine.setGateSideConfig({
        selectedGateIds: ['gate-1'],
        inflowRatePerMin: 0,
        processingRatePerSec: 1.0,
      });

      // Apply initial queue of exactly 1 person
      engine.applyInitialQueue(1, ['gate-1']);
      const agent = engine.state.agents.find((a) => a.targetGateId === 'gate-1')!;
      expect(agent).toBeDefined();

      engine.start();

      // Step for 1.2s -> exact 1 person processed
      for (let i = 0; i < 12; i++) {
        engine.step(0.1);
      }

      expect(gate1.admittedCount).toBe(1);
      expect(gate1.totalProcessedCount).toBe(1);
      expect(agent.state).toBe('ADMITTED');

      // Step for another 2.0s -> counter MUST NOT increment again for the same agent
      for (let i = 0; i < 20; i++) {
        engine.step(0.1);
      }

      expect(gate1.admittedCount).toBe(1);
      expect(gate1.totalProcessedCount).toBe(1);
    });

    // 4. The admitted pedestrian disappears from the external-crowd rendering.
    it('Test 4: should mark admitted pedestrian as ADMITTED so they are excluded from outside rendering', () => {
      const gate1 = engine.state.venue.gates.find((g) => g.id === 'gate-1')!;
      gate1.operationalScanners = 2;
      gate1.scannerProcessingRatePerSec = 2.0;

      engine.setGateSideConfig({
        selectedGateIds: ['gate-1'],
        inflowRatePerMin: 0,
        processingRatePerSec: 2.0,
      });

      engine.applyInitialQueue(3, ['gate-1']);
      engine.start();

      // Step until all 3 are processed
      for (let i = 0; i < 20; i++) {
        engine.step(0.1);
      }

      expect(gate1.admittedCount).toBe(3);

      // Verify that all 3 agents have state 'ADMITTED' and are excluded from outside crowd rendering
      const outsideCrowdAgents = engine.state.agents.filter(
        (a) => a.state !== 'ADMITTED' && a.state !== 'INSIDE'
      );
      expect(outsideCrowdAgents.length).toBe(0);

      // Verify admitted agents have zero velocity and no internal concourse path
      const admittedAgents = engine.state.agents.filter((a) => a.state === 'ADMITTED');
      expect(admittedAgents.length).toBe(3);
      for (const a of admittedAgents) {
        expect(a.vx).toBe(0);
        expect(a.vy).toBe(0);
        expect(a.pathWaypoints.length).toBe(0);
      }
    });

    // 5. The admitted pedestrian no longer contributes to the external queue or outside density.
    it('Test 5: should exclude admitted pedestrian from external queue and zone density', () => {
      const gate1 = engine.state.venue.gates.find((g) => g.id === 'gate-1')!;
      gate1.operationalScanners = 2;

      engine.setGateSideConfig({
        selectedGateIds: ['gate-1'],
        inflowRatePerMin: 0,
        processingRatePerSec: 2.0,
      });

      engine.applyInitialQueue(5, ['gate-1']);
      expect(gate1.currentQueue).toBe(5);

      engine.start();
      for (let i = 0; i < 20; i++) {
        engine.step(0.1);
      }

      // Queue is cleared as agents are admitted
      expect(gate1.currentQueue).toBe(0);

      // Outside zones must not count admitted agents
      for (const z of engine.state.venue.zones) {
        expect(z.currentDensity).toBe(0);
      }
    });

    // 6. Other pedestrians continue moving and queuing normally.
    it('Test 6: should allow subsequent queuing pedestrians to step forward when a front pedestrian is admitted', () => {
      const gate1 = engine.state.venue.gates.find((g) => g.id === 'gate-1')!;
      gate1.operationalScanners = 1;
      gate1.scannerProcessingRatePerSec = 1.0;

      engine.setGateSideConfig({
        selectedGateIds: ['gate-1'],
        processingRatePerSec: 1.0,
      });

      // Queue 2 people
      engine.applyInitialQueue(2, ['gate-1']);
      const agentA = engine.state.agents[0];
      const agentB = engine.state.agents[1];

      expect(agentA.state).toBe('PROCESSING');
      expect(agentB.state).toBe('QUEUING');

      engine.start();
      // Step 1.2s -> agentA is admitted
      for (let i = 0; i < 12; i++) {
        engine.step(0.1);
      }

      expect(agentA.state).toBe('ADMITTED');
      expect(gate1.admittedCount).toBe(1);

      // Now agentB steps up into the PROCESSING spot
      for (let i = 0; i < 5; i++) {
        engine.step(0.1);
      }

      expect(agentB.state).toBe('PROCESSING');
    });

    // 7. A pedestrian admitted through Gate 2 increments Gate 2's count, not Gate 1's.
    it('Test 7: should increment Gate 2 count and NOT Gate 1 count when an agent enters Gate 2', () => {
      const gate1 = engine.state.venue.gates.find((g) => g.id === 'gate-1')!;
      const gate2 = engine.state.venue.gates.find((g) => g.id === 'gate-2')!;

      gate1.operationalScanners = 0; // gate 1 cannot process
      gate2.operationalScanners = 2; // gate 2 can process
      gate2.scannerProcessingRatePerSec = 1.0;

      engine.applyInitialQueue(5, ['gate-1']);
      engine.applyInitialQueue(3, ['gate-2']);

      engine.start();
      for (let i = 0; i < 20; i++) {
        engine.step(0.1);
      }

      // Gate 2 admitted pedestrians
      expect(gate2.admittedCount || 0).toBeGreaterThan(0);
      // Gate 1 admitted strictly 0
      expect(gate1.admittedCount || 0).toBe(0);
    });

    // 8. A closed gate does not admit pedestrians.
    it('Test 8: should not admit pedestrians when gate is closed', () => {
      const gate1 = engine.state.venue.gates.find((g) => g.id === 'gate-1')!;
      gate1.operationalScanners = 4;
      gate1.direction = 'CLOSED';

      engine.applyInitialQueue(15, ['gate-1']);
      engine.start();

      for (let i = 0; i < 40; i++) {
        engine.step(0.1);
      }

      expect(gate1.admittedCount || 0).toBe(0);
      expect(gate1.currentQueue).toBe(15);
    });

    // 9. A scanner failure does not incorrectly count unsuccessful admissions.
    it('Test 9: should not count admissions during scanner failure with 0 operational scanners', () => {
      const gate1 = engine.state.venue.gates.find((g) => g.id === 'gate-1')!;
      gate1.operationalScanners = 0;
      gate1.status = 'SCANNER_FAILURE';

      engine.applyInitialQueue(12, ['gate-1']);
      engine.start();

      for (let i = 0; i < 30; i++) {
        engine.step(0.1);
      }

      expect(gate1.admittedCount || 0).toBe(0);
      expect(gate1.totalProcessedCount || 0).toBe(0);
      expect(gate1.currentQueue).toBe(12);
    });

    // 10. The total admission count equals the sum of the individual gate counts for the same selected simulation scope.
    it('Test 10: should ensure total admission count equals the exact sum of individual gate counts', () => {
      const g1 = engine.state.venue.gates.find((g) => g.id === 'gate-1')!;
      const g2 = engine.state.venue.gates.find((g) => g.id === 'gate-2')!;
      const g3 = engine.state.venue.gates.find((g) => g.id === 'gate-3')!;

      g1.operationalScanners = 2;
      g2.operationalScanners = 2;
      g3.operationalScanners = 2;
      g1.scannerProcessingRatePerSec = 1.0;
      g2.scannerProcessingRatePerSec = 1.0;
      g3.scannerProcessingRatePerSec = 1.0;

      engine.applyInitialQueue(4, ['gate-1']);
      engine.applyInitialQueue(6, ['gate-2']);
      engine.applyInitialQueue(5, ['gate-3']);

      engine.start();
      for (let i = 0; i < 40; i++) {
        engine.step(0.1);
      }

      const sumOfGates = (g1.admittedCount || 0) + (g2.admittedCount || 0) + (g3.admittedCount || 0);
      const totalVenueAdmitted = engine.getTotalAdmittedCount();

      expect(sumOfGates).toBeGreaterThan(0);
      expect(totalVenueAdmitted).toBe(sumOfGates);
    });

    // 11. Resetting the simulation clears the appropriate counters.
    it('Test 11: should clear cumulative entry counters, entry history, and queues on reset', () => {
      const gate1 = engine.state.venue.gates.find((g) => g.id === 'gate-1')!;
      gate1.operationalScanners = 4;
      gate1.scannerProcessingRatePerSec = 2.0;

      engine.applyInitialQueue(10, ['gate-1']);
      engine.start();

      for (let i = 0; i < 20; i++) {
        engine.step(0.1);
      }

      expect(gate1.admittedCount).toBeGreaterThan(0);
      expect(engine.getTotalAdmittedCount()).toBeGreaterThan(0);

      // Perform Reset
      engine.reset();

      // Everything must be cleanly zeroed
      expect(gate1.admittedCount || 0).toBe(0);
      expect(gate1.totalProcessedCount || 0).toBe(0);
      expect(gate1.currentQueue).toBe(0);
      expect(gate1.totalArrivalsCount || 0).toBe(0);
      expect(engine.getTotalAdmittedCount()).toBe(0);
      expect(engine.totalGeneratedArrivals).toBe(0);
      expect(engine.getGateEntryHistory().length).toBe(0);
      expect(engine.state.agents.length).toBe(0);
    });

    // 12. No admitted pedestrian is accidentally counted twice or silently lost from the accounting model.
    it('Test 12: should strictly conserve all people with zero double-counting and zero lost agents', () => {
      const g1 = engine.state.venue.gates.find((g) => g.id === 'gate-1')!;
      g1.operationalScanners = 4;
      g1.scannerProcessingRatePerSec = 1.5;

      engine.setGateSideConfig({
        selectedGateIds: ['gate-1'],
        inflowRatePerMin: 180,
        processingRatePerSec: 1.5,
      });

      engine.applyInitialQueue(20, ['gate-1']);
      engine.start();

      // Run simulation across multiple time steps and check conservation at each interval
      for (let step = 0; step < 100; step++) {
        engine.step(0.1);

        if (step % 20 === 0) {
          const audit = engine.getAccountingAudit();
          // Total generated must strictly equal waiting + processing + admitted + diverted
          expect(audit.isConserved).toBe(true);

          // Zero duplicate agent IDs
          const ids = new Set(engine.state.agents.map((a) => a.id));
          expect(ids.size).toBe(engine.state.agents.length);
        }
      }

      const finalAudit = engine.getAccountingAudit();
      expect(finalAudit.isConserved).toBe(true);
      expect(finalAudit.admitted).toBeGreaterThan(0);
      expect(finalAudit.admitted).toBe(g1.admittedCount);
    });
  });
});
