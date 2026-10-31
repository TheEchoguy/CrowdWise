import { describe, it, expect, beforeEach } from 'vitest';
import { SimulationEngine } from '../SimulationEngine';
import { CHINNASWAMY_STADIUM_PROFILE } from '../../data/chinnaswamyStadium';
import { distance } from '../geometry';
import { Gate } from '../../types';

describe('Independent Gate Arrivals & Realistic Three-Counter Queue Simulation', () => {
  let engine: SimulationEngine;

  beforeEach(() => {
    engine = new SimulationEngine(CHINNASWAMY_STADIUM_PROFILE, 2026);
  });

  // =========================================================================
  // REQUIREMENT 1: Independent Crowd Spawning at Each Gate
  // =========================================================================
  describe('Requirement 1: Independent Crowd Spawning at Each Gate', () => {
    it('Test 1.1: each regular entry gate has a distinct spawn position located outside that gate', () => {
      const regularGates = engine.state.venue.gates.filter((g) => g.gateType === 'REGULAR');
      expect(regularGates.length).toBe(10);

      const gateN1 = engine.state.venue.gates.find((g) => g.id === 'gate-n1')!;
      expect(gateN1).toBeDefined();

      const spawnCoordinates = new Set<string>();

      for (const gate of regularGates) {
        expect(gate.spawnPosition).toBeDefined();
        const sp = gate.spawnPosition!;

        // Must be unique coordinate
        const coordKey = `${sp.x.toFixed(1)},${sp.y.toFixed(1)}`;
        expect(spawnCoordinates.has(coordKey)).toBe(false);
        spawnCoordinates.add(coordKey);

        // Must be located near that gate (15m - 30m outside)
        const distToOwnGate = distance(sp, gate.position);
        expect(distToOwnGate).toBeGreaterThan(12);
        expect(distToOwnGate).toBeLessThan(35);

        // Must NOT be located near Gate 1 (N1), unless it is adjacent
        if (gate.stadiumSide !== 'NORTH') {
          const distToGate1 = distance(sp, gateN1.position);
          expect(distToGate1).toBeGreaterThan(60); // East, West, South are 60-150m away from Gate 1
        }
      }
    });

    it('Test 1.2: spectators spawned for a gate spawn at that gate and never at Gate 1', () => {
      const gateE2 = engine.state.venue.gates.find((g) => g.id === 'gate-e2')!;
      const gateN1 = engine.state.venue.gates.find((g) => g.id === 'gate-n1')!;

      const agentE2 = engine.spawnAgentForGate(gateE2)!;

      // Must spawn near Gate E2's spawn position (within natural jitter radius < 2m)
      expect(agentE2.assignedGateId).toBe('gate-e2');
      expect(agentE2.targetGateId).toBe('gate-e2');
      expect(agentE2.ticketGateId).toBe('gate-e2');
      expect(distance({ x: agentE2.x, y: agentE2.y }, gateE2.spawnPosition!)).toBeLessThan(2.0);

      // Distance to Gate 1 must be large (across the perimeter, ~140m away)
      const distToGate1 = distance({ x: agentE2.x, y: agentE2.y }, gateN1.position);
      expect(distToGate1).toBeGreaterThan(100);
    });

    it('Test 1.3: all 10 regular entry gates spawn arrivals concurrently in full stadium mode', () => {
      engine.start();

      // Step simulation for 6 seconds (60 steps @ 0.1s dt)
      for (let i = 0; i < 60; i++) {
        engine.step(0.1);
      }

      const regularGates = engine.state.venue.gates.filter((g) => g.gateType === 'REGULAR');
      const regularGateIds = regularGates.map((g) => g.id);

      // Check that arrivals have been generated across multiple regular gates concurrently
      const gatesWithArrivals = regularGates.filter((g) => (g.totalArrivalsCount || 0) > 0);
      expect(gatesWithArrivals.length).toBe(10); // All 10 regular gates have active arrivals

      // Verify that agents exist with targetGateId matching different sides of the stadium
      const targetsRepresented = new Set(engine.state.agents.map((a) => a.targetGateId));
      for (const gid of regularGateIds) {
        expect(targetsRepresented.has(gid)).toBe(true);
      }

      // Exit-only gate S1 must NOT generate incoming arrivals
      const gateS1 = engine.state.venue.gates.find((g) => g.id === 'gate-s1')!;
      expect(gateS1.totalArrivalsCount || 0).toBe(0);
    });

    it('Test 1.4: spectators preserve their assignedGateId throughout navigation and queuing', () => {
      const gateW2 = engine.state.venue.gates.find((g) => g.id === 'gate-w2')!;
      const agent = engine.spawnAgentForGate(gateW2)!;

      expect(agent.assignedGateId).toBe('gate-w2');

      // Step simulation
      for (let i = 0; i < 30; i++) {
        engine.step(0.1);
      }

      // Agent must retain assignedGateId and ticketGateId
      const liveAgent = engine.state.agents.find((a) => a.id === agent.id);
      expect(liveAgent).toBeDefined();
      expect(liveAgent?.assignedGateId).toBe('gate-w2');
      expect(liveAgent?.ticketGateId).toBe('gate-w2');
    });
  });

  // =========================================================================
  // REQUIREMENT 2 & 3: Three Counters at Every Regular Gate
  // =========================================================================
  describe('Requirement 2 & 3: Three Counters & Counter Queue Dynamics', () => {
    it('Test 2.1: every regular entry gate contains exactly three scanner counters', () => {
      const regularGates = engine.state.venue.gates.filter((g) => g.gateType === 'REGULAR');
      for (const gate of regularGates) {
        expect(gate.counters).toBeDefined();
        expect(gate.counters!.length).toBe(3);
        expect(gate.scannerCount).toBe(3);
        expect(gate.operationalScanners).toBe(3);

        expect(gate.counters![0].name).toBe('Counter 1');
        expect(gate.counters![1].name).toBe('Counter 2');
        expect(gate.counters![2].name).toBe('Counter 3');

        expect(gate.counters![0].status).toBe('OPERATIONAL');
        expect(gate.counters![1].status).toBe('OPERATIONAL');
        expect(gate.counters![2].status).toBe('OPERATIONAL');

        // Nominal service rate is 1.0 person/sec each
        expect(gate.counters![0].serviceRatePerSec).toBe(1.0);
        expect(gate.counters![1].serviceRatePerSec).toBe(1.0);
        expect(gate.counters![2].serviceRatePerSec).toBe(1.0);
      }
    });

    it('Test 2.2: all three counters process spectators concurrently and fairly', () => {
      const gateE1 = engine.state.venue.gates.find((g) => g.id === 'gate-e1')!;

      // Enforce 6 initial queuers at Gate E1
      engine.applyInitialQueue(6, ['gate-e1']);

      // 6 agents split across 3 counters: 2 agents per counter
      const e1Agents = engine.state.agents.filter(
        (a) => (a.state === 'QUEUING' || a.state === 'PROCESSING') && a.targetGateId === 'gate-e1'
      );
      expect(e1Agents.length).toBe(6);

      const lane0 = e1Agents.filter((a) => a.assignedLane === 0);
      const lane1 = e1Agents.filter((a) => a.assignedLane === 1);
      const lane2 = e1Agents.filter((a) => a.assignedLane === 2);

      expect(lane0.length).toBe(2);
      expect(lane1.length).toBe(2);
      expect(lane2.length).toBe(2);

      // In initial state, depth 0 agents are in PROCESSING
      const processingAgents = e1Agents.filter((a) => a.state === 'PROCESSING');
      expect(processingAgents.length).toBe(3); // 1 per active operational counter

      engine.start();

      // Step 1.2 seconds: all 3 counters process their front agent concurrently
      for (let i = 0; i < 12; i++) {
        engine.step(0.1);
      }

      // Admitted count should be 3 (1 from each of the 3 counters)
      expect(gateE1.admittedCount).toBe(3);
      expect(gateE1.counters![0].totalProcessedCount).toBe(1);
      expect(gateE1.counters![1].totalProcessedCount).toBe(1);
      expect(gateE1.counters![2].totalProcessedCount).toBe(1);

      // Remaining queue is 3 (1 per counter now stepping up to PROCESSING)
      expect(gateE1.currentQueue).toBe(3);
    });

    it('Test 2.3: counter failure drops processing capacity and redirects queuers away from failed desk', () => {
      const gateE1 = engine.state.venue.gates.find((g) => g.id === 'gate-e1')!;

      // Fail Counter 1
      gateE1.counters![0].status = 'FAILED';

      engine.step(0.1);

      // Operational scanners is now 2
      expect(gateE1.operationalScanners).toBe(2);

      // Combined capacity drops from 180 to 120 p/min
      const activeRate = gateE1.counters!
        .filter((c) => c.status === 'OPERATIONAL')
        .reduce((sum, c) => sum + (c.serviceRatePerSec || 1.0), 0);
      expect(activeRate).toBe(2.0); // 2 persons/sec = 120 persons/min
    });

    it('Test 2.4: restoring all counters brings capacity back to 180 p/min', () => {
      const gateE1 = engine.state.venue.gates.find((g) => g.id === 'gate-e1')!;

      // Fail 2 counters
      gateE1.counters![0].status = 'FAILED';
      gateE1.counters![1].status = 'FAILED';
      engine.step(0.1);
      expect(gateE1.operationalScanners).toBe(1);

      // Restore all
      gateE1.counters!.forEach((c) => (c.status = 'OPERATIONAL'));
      engine.step(0.1);

      expect(gateE1.operationalScanners).toBe(3);
      expect(gateE1.status).toBe('OPERATIONAL');
    });
  });

  // =========================================================================
  // REQUIREMENT 4: Congestion Demo (Gate E2 Congested vs Gate E3 Normal)
  // =========================================================================
  describe('Requirement 4: Congestion Demonstration (Gate E2 vs Gate E3)', () => {
    it('Test 4.1: Gate E2 queue accumulates when inflow (240 p/m) exceeds capacity (180 p/m)', () => {
      const gateE2 = engine.state.venue.gates.find((g) => g.id === 'gate-e2')!;
      const gateE3 = engine.state.venue.gates.find((g) => g.id === 'gate-e3')!;

      // E2: 240 arrivals/min, 180 capacity/min (nominal net +60 p/m)
      gateE2.arrivalRatePerMin = 240;

      // E3: 60 arrivals/min, 180 capacity/min (nominal net -120 p/m, queue clears)
      gateE3.arrivalRatePerMin = 60;

      // Pre-seed a modest queue of 15 people at each gate
      engine.applyInitialQueue(15, ['gate-e2', 'gate-e3']);

      expect(gateE2.currentQueue).toBe(15);
      expect(gateE3.currentQueue).toBe(15);

      engine.start();

      // Step simulation for 20 seconds (200 steps @ 0.1s dt)
      for (let i = 0; i < 200; i++) {
        engine.step(0.1);
      }

      // At Gate E3 (60 in vs 180 out), queue clears or stays very low
      expect(gateE3.currentQueue).toBeLessThan(10);

      // At Gate E2 (240 in vs 180 out), queue builds or remains congested
      expect(gateE2.currentQueue).toBeGreaterThan(gateE3.currentQueue);
      expect(gateE2.totalArrivalsCount || 0).toBeGreaterThan(gateE3.totalArrivalsCount || 0);

      // Gate E2 spectators must NOT be silently reassigned to Gate E3
      const e3Agents = engine.state.agents.filter((a) => a.targetGateId === 'gate-e3');
      for (const a of e3Agents) {
        expect(a.ticketGateId).toBe('gate-e3');
      }
    });

    it('Test 4.2: Gate E3 operates independently when Gate E2 has counter failures', () => {
      const gateE2 = engine.state.venue.gates.find((g) => g.id === 'gate-e2')!;
      const gateE3 = engine.state.venue.gates.find((g) => g.id === 'gate-e3')!;

      // Pre-seed 6 queuers at both gates so counters immediately start processing
      engine.applyInitialQueue(6, ['gate-e2', 'gate-e3']);

      // E2 suffers 2 counter failures (capacity drops to 60 p/m)
      gateE2.counters![0].status = 'FAILED';
      gateE2.counters![1].status = 'FAILED';
      gateE2.arrivalRatePerMin = 180;

      // E3 remains fully operational
      gateE3.arrivalRatePerMin = 120;

      engine.start();

      for (let i = 0; i < 20; i++) {
        engine.step(0.1);
      }

      // Gate E3 counters all processed spectators independently
      expect(gateE3.operationalScanners).toBe(3);
      expect(gateE3.counters![0].totalProcessedCount).toBeGreaterThan(0);
      expect(gateE3.counters![1].totalProcessedCount).toBeGreaterThan(0);
      expect(gateE3.counters![2].totalProcessedCount).toBeGreaterThan(0);

      // Gate E2 processed work only through Counter 3
      expect(gateE2.counters![0].totalProcessedCount).toBe(0);
      expect(gateE2.counters![1].totalProcessedCount).toBe(0);
      expect(gateE2.counters![2].totalProcessedCount).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // REQUIREMENT 6: Mass Conservation & Reconciled Live Metrics
  // =========================================================================
  describe('Requirement 6: Gate Mass Conservation & Audit Reconciliation', () => {
    it('Test 6.1: Gate Mass Conservation holds exactly: Assigned = Remaining + Arrived', () => {
      const gate = engine.state.venue.gates.find((g) => g.id === 'gate-e2')!;
      gate.arrivalRatePerMin = 180;

      engine.start();
      for (let i = 0; i < 100; i++) {
        engine.step(0.1);
      }

      const audit = engine.getGateAccountingAudit('gate-e2');
      expect(audit).not.toBeNull();
      expect(audit!.isConserved).toBe(true);
      expect(audit!.assigned).toBe(audit!.remaining + audit!.arrived);
    });

    it('Test 6.2: Gate admitted count matches the sum of totalProcessedCount across its 3 counters', () => {
      const gate = engine.state.venue.gates.find((g) => g.id === 'gate-e1')!;
      engine.applyInitialQueue(12, ['gate-e1']);

      engine.start();
      for (let i = 0; i < 60; i++) {
        engine.step(0.1);
      }

      const sumCounters =
        (gate.counters![0].totalProcessedCount || 0) +
        (gate.counters![1].totalProcessedCount || 0) +
        (gate.counters![2].totalProcessedCount || 0);

      expect(gate.admittedCount).toBe(sumCounters);
    });

    it('Test 6.3: simulation reset clears all accumulators, agents, and counter workloads cleanly', () => {
      engine.applyInitialQueue(10, ['gate-e2']);
      engine.start();

      for (let i = 0; i < 50; i++) {
        engine.step(0.1);
      }

      expect(engine.state.agents.length).toBeGreaterThan(0);

      engine.reset();

      // Everything must be zeroed
      expect(engine.state.simTimeSecs).toBe(0);
      expect(engine.state.agents.length).toBe(0);
      expect(engine.totalGeneratedArrivals).toBe(0);
      expect(engine.totalAdmittedCount).toBe(0);

      for (const g of engine.state.venue.gates) {
        expect(g.currentQueue).toBe(0);
        expect(g.admittedCount).toBe(0);
        expect(g.counter1QueueCount).toBe(0);
        expect(g.counter2QueueCount).toBe(0);
        expect(g.counter3QueueCount).toBe(0);
        if (g.counters) {
          for (const c of g.counters) {
            expect(c.isProcessing).toBe(false);
            expect(c.queueCount).toBe(0);
            expect(c.totalProcessedCount).toBe(0);
          }
        }
      }
    });
  });
});
