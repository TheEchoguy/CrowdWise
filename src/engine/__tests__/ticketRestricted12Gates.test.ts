import { describe, it, expect, beforeEach } from 'vitest';
import { SimulationEngine } from '../SimulationEngine';
import { CHINNASWAMY_STADIUM_PROFILE } from '../../data/chinnaswamyStadium';

describe('12-Gate Ticket-Restricted Crowd Management & Simulation System', () => {
  let engine: SimulationEngine;

  beforeEach(() => {
    engine = new SimulationEngine(CHINNASWAMY_STADIUM_PROFILE, 1337);
  });

  describe('Requirement 1: 12-Gate Stadium Layout & Population Allocation', () => {
    it('should configure exactly 12 operationally modelled gates with 3 per side', () => {
      const gates = engine.state.venue.gates;
      expect(gates.length).toBe(12);

      const northGates = gates.filter((g) => g.stadiumSide === 'NORTH');
      const eastGates = gates.filter((g) => g.stadiumSide === 'EAST');
      const southGates = gates.filter((g) => g.stadiumSide === 'SOUTH');
      const westGates = gates.filter((g) => g.stadiumSide === 'WEST');

      expect(northGates.length).toBe(3);
      expect(eastGates.length).toBe(3);
      expect(southGates.length).toBe(3);
      expect(westGates.length).toBe(3);

      expect(northGates.map((g) => g.id)).toEqual(['gate-n1', 'gate-n2', 'gate-n3']);
      expect(eastGates.map((g) => g.id)).toEqual(['gate-e1', 'gate-e2', 'gate-e3']);
      expect(southGates.map((g) => g.id)).toEqual(['gate-s1', 'gate-s2', 'gate-s3']);
      expect(westGates.map((g) => g.id)).toEqual(['gate-w1', 'gate-w2', 'gate-w3']);
    });

    it('should assign exactly 4,000 spectators per regular gate (total 40,000 regular allocation)', () => {
      const gates = engine.state.venue.gates;
      const regularGates = gates.filter((g) => g.gateType === 'REGULAR');
      expect(regularGates.length).toBe(10);

      let totalRegularAssigned = 0;
      for (const g of regularGates) {
        expect(g.assignedSpectatorCount).toBe(4000);
        totalRegularAssigned += g.assignedSpectatorCount || 0;
      }
      expect(totalRegularAssigned).toBe(40000);

      // VIP and Exit gates
      const vipGate = gates.find((g) => g.id === 'gate-n1')!;
      expect(vipGate.gateType).toBe('VIP');
      expect(vipGate.assignedSpectatorCount).toBe(500);

      const exitGate = gates.find((g) => g.id === 'gate-s1')!;
      expect(exitGate.gateType).toBe('EXIT_ONLY');
      expect(exitGate.assignedSpectatorCount).toBe(0);
    });
  });

  describe('Requirement 2: 3 Independent Scanner Counters per Regular Gate', () => {
    it('should model 3 independent physical counters per regular gate with nominal 180 ppl/min capacity', () => {
      const e2 = engine.state.venue.gates.find((g) => g.id === 'gate-e2')!;
      expect(e2.counters).toBeDefined();
      expect(e2.counters?.length).toBe(3);
      expect(e2.operationalScanners).toBe(3);

      // Nominal throughput: 3 counters * 1.0 p/s * 60 = 180 people/minute
      const nominalCapacity = e2.counters!.reduce((sum, c) => sum + c.serviceRatePerSec * 60, 0);
      expect(nominalCapacity).toBe(180);
    });

    it('should reduce gate throughput proportionally when 1 or 2 counters fail', () => {
      const e2 = engine.state.venue.gates.find((g) => g.id === 'gate-e2')!;
      engine.start();

      // Initially all 3 counters online (180 p/m)
      engine.step(0.1);
      expect(e2.effectiveCapacityPerMin).toBe(180);

      // 1 Counter Fails: 2 active (120 p/m = 2/3 throughput)
      e2.counters![0].status = 'FAILED';
      engine.step(0.1);
      expect(e2.operationalScanners).toBe(2);
      expect(e2.effectiveCapacityPerMin).toBe(120);

      // 2 Counters Fail: 1 active (60 p/m = 1/3 throughput)
      e2.counters![1].status = 'FAILED';
      engine.step(0.1);
      expect(e2.operationalScanners).toBe(1);
      expect(e2.effectiveCapacityPerMin).toBe(60);

      // 3 Counters Fail: 0 active (0 p/m = full admission halt)
      e2.counters![2].status = 'FAILED';
      engine.step(0.1);
      expect(e2.operationalScanners).toBe(0);
      expect(e2.effectiveCapacityPerMin).toBe(0);
      expect(e2.operationalControlState).toBe('ADMISSION_PAUSED');
      expect(e2.status).toBe('SCANNER_FAILURE');

      // Restoration restores capacity
      e2.counters!.forEach((c) => (c.status = 'OPERATIONAL'));
      engine.step(0.1);
      expect(e2.operationalScanners).toBe(3);
      expect(e2.effectiveCapacityPerMin).toBe(180);
      expect(e2.status).toBe('OPERATIONAL');
    });

    it('should track individual counter processed counts correctly', () => {
      const e2 = engine.state.venue.gates.find((g) => g.id === 'gate-e2')!;
      engine.applyInitialQueue(15, ['gate-e2']);
      engine.start();

      for (let i = 0; i < 40; i++) {
        engine.step(0.1);
      }

      expect(e2.admittedCount).toBeGreaterThan(0);
      const sumCounters = e2.counters!.reduce((sum, c) => sum + c.totalProcessedCount, 0);
      expect(sumCounters).toBe(e2.admittedCount);
    });
  });

  describe('Requirement 3: Strict Ticket Restrictions & No Spurious Cross-Gate Rerouting', () => {
    it('should NEVER automatically reroute ticket holders of Gate E2 to Gate E1 or E3 during scanner outage', () => {
      const e1 = engine.state.venue.gates.find((g) => g.id === 'gate-e1')!;
      const e2 = engine.state.venue.gates.find((g) => g.id === 'gate-e2')!;
      const e3 = engine.state.venue.gates.find((g) => g.id === 'gate-e3')!;

      // Configure gate-side simulation targeting Gate E2
      engine.setGateSideConfig({
        selectedGateIds: ['gate-e2'],
        inflowRatePerMin: 120,
        processingRatePerSec: 1.0,
      });

      engine.start();

      // Step 5 seconds to generate approaching flow
      for (let i = 0; i < 50; i++) {
        engine.step(0.1);
      }

      // Verify spectators have ticketGateId stamped to gate-e2
      const e2Agents = engine.state.agents.filter((a) => a.targetGateId === 'gate-e2');
      expect(e2Agents.length).toBeGreaterThan(0);
      for (const a of e2Agents) {
        expect(a.ticketGateId).toBe('gate-e2');
      }

      // Complete scanner failure at Gate E2
      e2.counters!.forEach((c) => (c.status = 'FAILED'));
      e2.operationalScanners = 0;
      e2.status = 'SCANNER_FAILURE';

      // Step simulation for 10 seconds during the failure
      for (let i = 0; i < 100; i++) {
        engine.step(0.1);
      }

      // STRICT TICKET RULE: ZERO agents should divert to E1 or E3!
      const divertedToE1 = engine.state.agents.filter(
        (a) => a.ticketGateId === 'gate-e2' && a.targetGateId === 'gate-e1'
      );
      const divertedToE3 = engine.state.agents.filter(
        (a) => a.ticketGateId === 'gate-e2' && a.targetGateId === 'gate-e3'
      );
      expect(divertedToE1.length).toBe(0);
      expect(divertedToE3.length).toBe(0);

      // Instead, spectators are held in Gate E2 dedicated holding area
      const heldAtE2 = engine.state.agents.filter(
        (a) => a.ticketGateId === 'gate-e2' && (a.state === 'HOLDING' || a.inHoldingArea)
      );
      expect(heldAtE2.length).toBeGreaterThan(0);
      expect(e2.inHoldingCount).toBeGreaterThan(0);
    });

    it('should hold spectators in Gate Holding Area when turnstile queue is saturated', () => {
      const e2 = engine.state.venue.gates.find((g) => g.id === 'gate-e2')!;
      e2.maxSafeQueueOccupancy = 20;

      // Apply queue of 25 (exceeding safe queue of 20)
      engine.applyInitialQueue(25, ['gate-e2']);
      expect(e2.currentQueue).toBe(25);

      // 2 counters offline so processing (60 p/m) is less than inflow (180 p/m)
      e2.counters![0].status = 'FAILED';
      e2.counters![1].status = 'FAILED';

      engine.setGateSideConfig({
        selectedGateIds: ['gate-e2'],
        inflowRatePerMin: 180,
      });

      engine.start();

      // Step simulation: queue remains saturated above safe limit
      for (let i = 0; i < 40; i++) {
        engine.step(0.1);
      }

      // Check operational state
      expect(e2.operationalControlState).toBe('CONGESTED');

      // Add approaching agent with ticket for E2
      const approaching = {
        id: 99999,
        x: 236,
        y: 110,
        vx: 0,
        vy: 0,
        targetX: e2.position.x,
        targetY: e2.position.y,
        preferredSpeed: 1.3,
        radius: 0.32,
        state: 'APPROACHING' as const,
        targetGateId: 'gate-e2',
        ticketGateId: 'gate-e2',
        inHoldingArea: false,
        pathWaypoints: [e2.position],
        currentWaypointIdx: 0,
        shirtColor: '#fff',
        skinColor: '#ffe',
        stridePhase: 0,
        facingAngle: 0,
        arrivalTime: 0,
        waitDurationSecs: 0,
      };
      engine.state.agents.push(approaching);

      engine.step(0.1);
      expect(approaching.state).toBe('HOLDING');
      expect(approaching.inHoldingArea).toBe(true);
    });
  });

  describe('Requirement 4: Dedicated Holding Area & Admission Flow Metering', () => {
    it('should meter spectators from holding area into queue when turnstile capacity becomes available', () => {
      const e2 = engine.state.venue.gates.find((g) => g.id === 'gate-e2')!;
      e2.maxSafeQueueOccupancy = 30;

      // Artificially place agents into holding area
      for (let i = 0; i < 10; i++) {
        engine.state.agents.push({
          id: 5000 + i,
          x: e2.holdingAreaPosition!.x,
          y: e2.holdingAreaPosition!.y,
          vx: 0,
          vy: 0,
          targetX: e2.holdingAreaPosition!.x,
          targetY: e2.holdingAreaPosition!.y,
          preferredSpeed: 1.3,
          radius: 0.32,
          state: 'HOLDING',
          targetGateId: 'gate-e2',
          ticketGateId: 'gate-e2',
          inHoldingArea: true,
          pathWaypoints: [],
          currentWaypointIdx: 0,
          shirtColor: '#fff',
          skinColor: '#fa0',
          stridePhase: 0,
          facingAngle: 0,
          arrivalTime: 0,
          waitDurationSecs: 0,
        });
      }

      e2.currentQueue = 5;
      e2.operationalScanners = 3;
      engine.start();

      const initialHolding = engine.state.agents.filter(
        (a) => a.state === 'HOLDING' && a.targetGateId === 'gate-e2'
      ).length;
      expect(initialHolding).toBe(10);

      // Run simulation steps with active turnstiles
      for (let i = 0; i < 50; i++) {
        engine.step(0.1);
      }

      // Holding area should meter agents into queue
      const remainingHolding = engine.state.agents.filter(
        (a) => a.state === 'HOLDING' && a.targetGateId === 'gate-e2'
      ).length;
      expect(remainingHolding).toBeLessThan(initialHolding);
    });
  });

  describe('Requirement 5: Exact Population Mass Conservation', () => {
    it('should strictly conserve attendee mass across assigned, arrived, waiting, holding, and admitted states', () => {
      const gateId = 'gate-n2';
      const gate = engine.state.venue.gates.find((g) => g.id === gateId)!;

      engine.setGateSideConfig({
        selectedGateIds: [gateId],
        inflowRatePerMin: 180,
        processingRatePerSec: 1.0,
      });

      engine.applyInitialQueue(15, [gateId]);
      engine.start();

      for (let i = 0; i < 150; i++) {
        engine.step(0.1);
      }

      const audit = engine.getGateAccountingAudit(gateId);
      expect(audit).not.toBeNull();
      expect(audit!.isConserved).toBe(true);

      // Mathematical mass conservation equation
      // N_assigned = N_remaining + N_arrived
      expect(audit!.assigned).toBe(audit!.remaining + audit!.arrived);
      expect(audit!.admitted).toBeGreaterThan(0);
    });
  });

  describe('Requirement 6: Inflow Capping & Population Bounds', () => {
    it('should cap gate arrivals at assignedSpectatorCount', () => {
      const gate = engine.state.venue.gates.find((g) => g.id === 'gate-w1')!;
      gate.assignedSpectatorCount = 50; // Set low test cap

      engine.setGateSideConfig({
        selectedGateIds: ['gate-w1'],
        inflowRatePerMin: 600, // fast inflow
      });

      engine.start();

      for (let i = 0; i < 200; i++) {
        engine.step(0.1);
      }

      // Cannot exceed quota
      expect((gate.totalArrivalsCount || 0)).toBeLessThanOrEqual(50);
    });
  });

  describe('Requirement 7: Deterministic PRNG Seed Verification', () => {
    it('should produce identical entry counts with identical random seeds', () => {
      const runSim = (seed: number) => {
        const eng = new SimulationEngine(CHINNASWAMY_STADIUM_PROFILE, seed);
        eng.setGateSideConfig({
          selectedGateIds: ['gate-e2'],
          inflowRatePerMin: 120,
          processingRatePerSec: 1.0,
        });
        eng.applyInitialQueue(10, ['gate-e2']);
        eng.start();
        for (let i = 0; i < 100; i++) {
          eng.step(0.1);
        }
        const g = eng.state.venue.gates.find((gate) => gate.id === 'gate-e2')!;
        return {
          admitted: g.admittedCount,
          queue: g.currentQueue,
          arrived: g.totalArrivalsCount,
        };
      };

      const res1 = runSim(42);
      const res2 = runSim(42);
      expect(res1).toEqual(res2);

      const res3 = runSim(9999);
      expect(res3.admitted).toBeDefined();
    });
  });
});
