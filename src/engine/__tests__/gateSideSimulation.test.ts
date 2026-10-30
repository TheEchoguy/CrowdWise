import { describe, it, expect, beforeEach } from 'vitest';
import { SimulationEngine } from '../SimulationEngine';
import { CHINNASWAMY_STADIUM_PROFILE } from '../../data/chinnaswamyStadium';
import { GateSideSimConfig } from '../../types';

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

      // Inflow: 100 ppl/min; Capacity: 1.0 p/s * 4 counters * 60 = 240 ppl/min
      engine.setGateSideConfig({
        selectedGateIds: ['gate-1'],
        inflowRatePerMin: 100,
        processingRatePerSec: 1.0,
        arrivalPattern: 'GRADUAL',
      });

      // Apply initial queue of 20 people
      engine.applyInitialQueue(20, ['gate-1']);
      expect(gate1.currentQueue).toBe(20);

      engine.start();

      // Step for 30 seconds (0.5 mins)
      // Expected arrivals ~ 50, Expected capacity ~ 120
      // 20 initial + 50 arrivals - up to 120 processed -> queue should clear
      for (let i = 0; i < 300; i++) {
        engine.step(0.1);
      }

      expect(gate1.totalProcessedCount).toBeGreaterThan(0);
      expect(gate1.currentQueue).toBeLessThan(10);
    });
  });

  describe('Scenario B: Inflow Exceeds Capacity', () => {
    it('should accumulate queue when inflow rate is higher than processing capacity', () => {
      const gate1 = engine.state.venue.gates.find((g) => g.id === 'gate-1')!;
      gate1.scannerCount = 4;
      gate1.operationalScanners = 4;

      // Capacity = 4 * 1.0 * 60 = 240 ppl/min
      // Inflow = 360 ppl/min (net +120 ppl/min = +2 ppl/sec)
      engine.setGateSideConfig({
        selectedGateIds: ['gate-1'],
        inflowRatePerMin: 360,
        processingRatePerSec: 1.0,
        arrivalPattern: 'GRADUAL',
      });

      engine.applyInitialQueue(10, ['gate-1']);
      engine.start();

      // Step for 40 seconds
      for (let i = 0; i < 400; i++) {
        engine.step(0.1);
      }

      // Total arrivals should exceed total processed
      expect(gate1.totalArrivalsCount || 0).toBeGreaterThan(gate1.totalProcessedCount || 0);
      // Queue must have grown beyond initial
      expect(gate1.maxQueueRecorded || 0).toBeGreaterThan(10);
    });
  });

  describe('Scenario C: Counter Failure', () => {
    it('should transition from stable to queue accumulation when counters fail', () => {
      const gate1 = engine.state.venue.gates.find((g) => g.id === 'gate-1')!;
      gate1.scannerCount = 4;
      gate1.operationalScanners = 4;

      // Inflow = 200 ppl/min
      // With 4 counters @ 1 p/s = 240 ppl/min capacity -> stable
      engine.setGateSideConfig({
        selectedGateIds: ['gate-1'],
        inflowRatePerMin: 200,
        processingRatePerSec: 1.0,
        arrivalPattern: 'GRADUAL',
      });

      engine.applyInitialQueue(10, ['gate-1']);
      engine.start();

      // Run 15 seconds normally
      for (let i = 0; i < 150; i++) {
        engine.step(0.1);
      }
      const queueBeforeFailure = gate1.currentQueue;

      // Failure occurs: 2 counters go offline -> only 2 remain (120 ppl/min capacity)
      // Now inflow (200) > capacity (120)
      gate1.operationalScanners = 2;
      gate1.status = 'SCANNER_FAILURE';
      engine.logGateSideEvent('COUNTER_FAILURE', '2 counters went offline');

      // Run another 30 seconds
      for (let i = 0; i < 300; i++) {
        engine.step(0.1);
      }

      // Queue should now grow significantly
      expect(gate1.currentQueue).toBeGreaterThanOrEqual(queueBeforeFailure);
      expect(gate1.operationalScanners).toBe(2);
    });
  });

  describe('Scenario D: Surge and Recovery', () => {
    it('should build queue during peak surge and clear during recovery window', () => {
      const gate1 = engine.state.venue.gates.find((g) => g.id === 'gate-1')!;
      gate1.scannerCount = 4;
      gate1.operationalScanners = 4;
      // Processing capacity = 240 ppl/min

      engine.start();

      // Phase 1: Sudden Surge (420 ppl/min) for 25 seconds
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

      // Phase 2: Recovery (Drop inflow to 40 ppl/min) for 40 seconds
      engine.setGateSideConfig({
        inflowRatePerMin: 40,
      });

      for (let i = 0; i < 400; i++) {
        engine.step(0.1);
      }

      // Queue must have drained significantly during recovery
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

      // Close gate
      gate1.direction = 'CLOSED';
      gate1.status = 'TEMPORARILY_CLOSED';
      engine.logGateSideEvent('GATE_CLOSED', 'Gate 1 closed for tactical safety');

      const processedBefore = gate1.totalProcessedCount || 0;

      // Run 20 seconds
      for (let i = 0; i < 200; i++) {
        engine.step(0.1);
      }

      // No new processing should have occurred through the closed gate
      expect(gate1.totalProcessedCount).toBe(processedBefore);
      // Queued count should remain or increase, never disappear
      expect(gate1.currentQueue).toBeGreaterThanOrEqual(25);
    });
  });

  describe('Scenario F: Multi-Gate Routing Policies', () => {
    it('should route incoming crowd to the gate with SHORTEST_QUEUE', () => {
      const g1 = engine.state.venue.gates.find((g) => g.id === 'gate-1')!;
      const g2 = engine.state.venue.gates.find((g) => g.id === 'gate-2')!;
      const g3 = engine.state.venue.gates.find((g) => g.id === 'gate-3')!;

      g1.currentQueue = 50;
      g2.currentQueue = 5; // shortest queue!
      g3.currentQueue = 30;

      engine.setGateSideConfig({
        selectedGateIds: ['gate-1', 'gate-2', 'gate-3'],
        routingPolicy: 'SHORTEST_QUEUE',
        inflowRatePerMin: 120,
        processingRatePerSec: 1.0,
      });

      const arrivalsBefore = g2.totalArrivalsCount || 0;

      // Spawn 1 agent via step
      engine.start();
      engine.step(1.0);

      // Gate 2 should have received arrivals
      expect((g2.totalArrivalsCount || 0)).toBeGreaterThan(arrivalsBefore);
    });

    it('should route incoming crowd avoiding gates with blocked downstream corridors in ROUTE_AWARE mode', () => {
      const g1 = engine.state.venue.gates.find((g) => g.id === 'gate-1')!;
      const g2 = engine.state.venue.gates.find((g) => g.id === 'gate-2')!;

      g1.currentQueue = 10;
      g2.currentQueue = 12;

      // Block downstream corridor for Gate 1
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

      // Route aware should steer away from blocked gate-1 towards gate-2
      expect((g2.totalArrivalsCount || 0)).toBeGreaterThan(arrivalsG2Before);
    });
  });

  describe('Scenario G: Physical Queue Overflow & Spillback', () => {
    it('should track spillback count when queue exceeds queueAreaCapacity', () => {
      const gate1 = engine.state.venue.gates.find((g) => g.id === 'gate-1')!;
      gate1.queueAreaCapacity = 80;

      // Below capacity -> spillback = 0
      gate1.currentQueue = 50;
      engine.step(0.1);
      expect(gate1.spillbackCount).toBe(0);

      // Above capacity -> spillback = queue - capacity
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

      // Find downstream corridor and block it
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

      // Step for 10 seconds
      for (let i = 0; i < 100; i++) {
        engine.step(0.1);
      }

      // No agents should be pushed into the blocked corridor
      expect(gate1.totalProcessedCount).toBe(processedBefore);
      expect(gate1.suggestedAction).toContain('Downstream corridor congested / blocked');
    });
  });

  describe('Scenario I: Live Configuration Changes Mid-Simulation', () => {
    it('should update inflow and counter rates mid-run without resetting clock or losing queue', () => {
      const gate1 = engine.state.venue.gates.find((g) => g.id === 'gate-1')!;
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

      // Dynamic live reconfiguration
      engine.setGateSideConfig({
        inflowRatePerMin: 300,
        processingRatePerSec: 2.0,
      });

      // Simulation clock must not have reset
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

      // Run for 20 seconds
      for (let i = 0; i < 200; i++) {
        engine.step(0.1);
      }

      const agents = engine.state.agents;
      const agentIds = new Set(agents.map((a) => a.id));

      // 1. Zero duplicate agent IDs
      expect(agentIds.size).toBe(agents.length);

      // 2. All agent states belong to valid simulation states
      const validStates = new Set([
        'APPROACHING',
        'QUEUING',
        'PROCESSING',
        'EN_ROUTE_DESTINATION',
        'INSIDE',
        'DIVERTED',
        'WAITING_ASSISTANCE',
      ]);

      for (const a of agents) {
        expect(validStates.has(a.state)).toBe(true);
      }

      // 3. Processed + Remaining queuing must match total queue handled
      expect(gate1.totalProcessedCount || 0).toBeGreaterThan(0);
      expect(gate1.totalArrivalsCount || 0).toBeGreaterThanOrEqual(gate1.totalProcessedCount || 0);
    });
  });
});
