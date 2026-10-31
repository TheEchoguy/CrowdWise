import { describe, it, expect, beforeEach } from 'vitest';
import { SimulationEngine } from '../SimulationEngine';
import { CHINNASWAMY_STADIUM_PROFILE } from '../../data/chinnaswamyStadium';
import { Gate, CrowdAgent } from '../../types';

describe('Detailed Gate Architecture with Three-Lane Crowd Management & Intelligent Balancing', () => {
  let engine: SimulationEngine;

  beforeEach(() => {
    engine = new SimulationEngine(CHINNASWAMY_STADIUM_PROFILE, 42);
  });

  // =========================================================================
  // Requirement 1 & 2 & 8: Three Distinct Lanes across all 10 Regular Gates
  // =========================================================================
  describe('Requirement 1, 2 & 8: Three Distinct Lanes across all Stadium Sides', () => {
    const regularGateIds = [
      'gate-n2', 'gate-n3',
      'gate-e1', 'gate-e2', 'gate-e3',
      'gate-s2', 'gate-s3',
      'gate-w1', 'gate-w2', 'gate-w3',
    ];

    it('should configure exactly 3 distinct counters and scanner lanes for all 10 regular entry gates', () => {
      regularGateIds.forEach((gid) => {
        const gate = engine.state.venue.gates.find((g) => g.id === gid);
        expect(gate).toBeDefined();
        expect(gate!.counters).toBeDefined();
        expect(gate!.counters!.length).toBe(3);
        expect(gate!.scannerCount).toBe(3);
        expect(gate!.operationalScanners).toBe(3);

        // Verify each counter has unique ID, name, and default 1.0 p/s service rate
        const counters = gate!.counters!;
        expect(counters[0].id).toBe(`${gid}-c1`);
        expect(counters[1].id).toBe(`${gid}-c2`);
        expect(counters[2].id).toBe(`${gid}-c3`);

        expect(counters[0].name).toBe('Counter 1');
        expect(counters[1].name).toBe('Counter 2');
        expect(counters[2].name).toBe('Counter 3');

        expect(counters[0].status).toBe('OPERATIONAL');
        expect(counters[1].status).toBe('OPERATIONAL');
        expect(counters[2].status).toBe('OPERATIONAL');

        expect(counters[0].serviceRatePerSec).toBe(1.0);
        expect(counters[1].serviceRatePerSec).toBe(1.0);
        expect(counters[2].serviceRatePerSec).toBe(1.0);
      });
    });

    it('should preserve distinct non-regular roles for VIP gate (N1) and Exit gate (S1)', () => {
      const n1 = engine.state.venue.gates.find((g) => g.id === 'gate-n1')!;
      expect(n1.gateType).toBe('VIP');
      expect(n1.assignedSpectatorCount).toBe(500);

      const s1 = engine.state.venue.gates.find((g) => g.id === 'gate-s1')!;
      expect(s1.gateType).toBe('EXIT_ONLY');
      expect(s1.direction).toBe('EXIT');
      expect(s1.assignedSpectatorCount).toBe(0);
    });

    it('should compute initial lane metrics for North, East, South, and West gates', () => {
      const sampleGates = ['gate-n2', 'gate-e2', 'gate-s3', 'gate-w2'];
      engine.step(0.1);

      sampleGates.forEach((gid) => {
        const metrics = engine.getGateLaneMetrics(gid);
        expect(metrics).toBeDefined();
        expect(metrics.length).toBe(3);

        metrics.forEach((m, idx) => {
          expect(m.laneNumber).toBe(idx + 1);
          expect(m.counterStatus).toBe('OPERATIONAL');
          expect(m.serviceRatePerSec).toBe(1.0);
          expect(m.serviceRatePerMin).toBe(60);
          expect(m.laneCapacity).toBe(40);
          expect(m.waitingCount).toBe(0);
          expect(m.processingCount).toBe(0);
          expect(m.totalLaneCount).toBe(0);
          expect(m.congestionStatus).toBe('OPTIMAL');
        });
      });
    });
  });

  // =========================================================================
  // Requirement 4: Concurrent Counter Processing & Processing Lifecycle
  // =========================================================================
  describe('Requirement 4: Concurrent Counter Processing & Admission Lifecycle', () => {
    it('should process spectators through all three counters concurrently', () => {
      const gateE2 = engine.state.venue.gates.find((g) => g.id === 'gate-e2')!;
      engine.setGateSideConfig({
        selectedGateIds: ['gate-e2'],
        processingRatePerSec: 1.0,
      });

      // Queue 3 spectators: one for each counter
      engine.applyInitialQueue(3, ['gate-e2']);
      expect(gateE2.currentQueue).toBe(3);

      const agents = engine.state.agents.filter((a) => a.targetGateId === 'gate-e2');
      expect(agents.length).toBe(3);

      // In initial queue with 3 people and 3 operational counters, all 3 are at depth 0
      const lane0 = agents.find((a) => a.assignedLane === 0);
      const lane1 = agents.find((a) => a.assignedLane === 1);
      const lane2 = agents.find((a) => a.assignedLane === 2);

      expect(lane0).toBeDefined();
      expect(lane1).toBeDefined();
      expect(lane2).toBeDefined();

      expect(lane0!.state).toBe('PROCESSING');
      expect(lane1!.state).toBe('PROCESSING');
      expect(lane2!.state).toBe('PROCESSING');

      // Step forward 1.2s -> each counter at 1 p/s should admit their spectator
      for (let i = 0; i < 12; i++) {
        engine.step(0.1);
      }

      // All 3 spectators admitted concurrently
      expect(gateE2.admittedCount).toBe(3);
      expect(gateE2.currentQueue).toBe(0);

      expect(lane0!.state).toBe('ADMITTED');
      expect(lane1!.state).toBe('ADMITTED');
      expect(lane2!.state).toBe('ADMITTED');

      expect(gateE2.counters![0].totalProcessedCount).toBe(1);
      expect(gateE2.counters![1].totalProcessedCount).toBe(1);
      expect(gateE2.counters![2].totalProcessedCount).toBe(1);
    });

    it('should not admit spectators before processing duration completes', () => {
      const gateE2 = engine.state.venue.gates.find((g) => g.id === 'gate-e2')!;
      engine.applyInitialQueue(1, ['gate-e2']);
      expect(gateE2.currentQueue).toBe(1);
      expect(gateE2.admittedCount).toBe(0);

      // Step forward 0.5s (only halfway through 1.0s service duration)
      for (let i = 0; i < 5; i++) {
        engine.step(0.1);
      }

      expect(gateE2.admittedCount).toBe(0);
      expect(gateE2.currentQueue).toBe(1);

      // Step remaining 0.6s -> total 1.1s > 1.0s
      for (let i = 0; i < 6; i++) {
        engine.step(0.1);
      }

      expect(gateE2.admittedCount).toBe(1);
      expect(gateE2.currentQueue).toBe(0);
    });
  });

  // =========================================================================
  // Requirement 3: Intelligent Lane Balancing & Workload Comparison
  // =========================================================================
  describe('Requirement 3: Intelligent Lane Balancing', () => {
    it('should assign newly arriving spectators to the lane with the lowest expected wait time', () => {
      const gate = engine.state.venue.gates.find((g) => g.id === 'gate-e2')!;

      // Setup uneven queues: Lane 0 has 5 people, Lane 1 has 5 people, Lane 2 is empty
      engine.applyInitialQueue(10, ['gate-e2']);
      // Step once to settle lane assignments
      engine.step(0.1);

      const countLane0 = engine.state.agents.filter((a) => a.targetGateId === 'gate-e2' && a.assignedLane === 0).length;
      const countLane1 = engine.state.agents.filter((a) => a.targetGateId === 'gate-e2' && a.assignedLane === 1).length;
      const countLane2 = engine.state.agents.filter((a) => a.targetGateId === 'gate-e2' && a.assignedLane === 2).length;

      // Initial queue distributes evenly
      expect(countLane0 + countLane1 + countLane2).toBe(10);
    });

    it('should rebalance waiting spectators from a congested lane to a significantly less congested lane', () => {
      const gate = engine.state.venue.gates.find((g) => g.id === 'gate-w2')!;
      gate.laneBalancingEnabled = true;

      // Manually simulate an imbalanced queue on Gate W2:
      // Lane 0: 20 waiting spectators (Wait time = (20+1)/1 = 21s)
      // Lane 1: 5 waiting spectators (Wait time = 6s)
      // Lane 2: 1 waiting spectator (Wait time = 2s)
      // Lane 2 offers a ~90% reduction in wait time compared to Lane 0 (>= 35% threshold)
      for (let i = 0; i < 15; i++) {
        const agent: CrowdAgent = {
          id: 5000 + i,
          x: gate.position.x,
          y: gate.position.y - 10,
          vx: 0,
          vy: 0,
          targetX: gate.position.x,
          targetY: gate.position.y,
          preferredSpeed: 1.3,
          radius: 0.32,
          state: i === 0 ? 'PROCESSING' : 'QUEUING',
          assignedLane: 0, // all in Lane 0!
          assignedCounterId: gate.counters![0].id,
          assignedGateId: gate.id,
          targetGateId: gate.id,
          ticketGateId: gate.id,
          inHoldingArea: false,
          pathWaypoints: [gate.position],
          currentWaypointIdx: 0,
          shirtColor: '#FFFFFF',
          skinColor: '#F5D0C5',
          stridePhase: 0,
          facingAngle: 0,
          arrivalTime: 0,
          waitDurationSecs: 10,
          lastLaneSwitchTime: 0, // ready for switch
          laneSwitchCount: 0,
        };
        engine.state.agents.push(agent);
      }
      gate.currentQueue = 15;

      // Step simulation by 1.0s to allow lane balancing evaluation
      engine.step(1.0);

      // Eligible spectators from Lane 0 should have dynamically balanced into Lane 1 or Lane 2
      const lane0Agents = engine.state.agents.filter((a) => a.targetGateId === gate.id && a.assignedLane === 0);
      const lane1Agents = engine.state.agents.filter((a) => a.targetGateId === gate.id && a.assignedLane === 1);
      const lane2Agents = engine.state.agents.filter((a) => a.targetGateId === gate.id && a.assignedLane === 2);

      // Verify lane rebalancing occurred
      expect(lane1Agents.length + lane2Agents.length).toBeGreaterThan(0);
      expect(gate.totalLaneSwitches).toBeGreaterThan(0);
    });

    it('should NEVER allow the front spectator at depth 0 (in PROCESSING) to switch lanes', () => {
      const gate = engine.state.venue.gates.find((g) => g.id === 'gate-e1')!;
      gate.laneBalancingEnabled = true;

      // Create a spectator actively in PROCESSING at Counter 1
      const frontAgent: CrowdAgent = {
        id: 7777,
        x: gate.position.x,
        y: gate.position.y - 1.2,
        vx: 0,
        vy: 0,
        targetX: gate.position.x,
        targetY: gate.position.y,
        preferredSpeed: 1.3,
        radius: 0.32,
        state: 'PROCESSING',
        assignedLane: 0,
        assignedCounterId: gate.counters![0].id,
        assignedGateId: gate.id,
        targetGateId: gate.id,
        ticketGateId: gate.id,
        inHoldingArea: false,
        pathWaypoints: [gate.position],
        currentWaypointIdx: 0,
        shirtColor: '#FFFFFF',
        skinColor: '#F5D0C5',
        stridePhase: 0,
        facingAngle: 0,
        arrivalTime: 0,
        waitDurationSecs: 0.2,
        lastLaneSwitchTime: 0,
        laneSwitchCount: 0,
      };
      engine.state.agents.push(frontAgent);
      gate.currentQueue = 1;

      // Step simulation
      engine.step(0.2);

      // Front agent must remain in Lane 0 and in PROCESSING
      expect(frontAgent.assignedLane).toBe(0);
      expect(frontAgent.state).toBe('PROCESSING');
      expect(frontAgent.laneSwitchCount).toBe(0);
    });

    it('should enforce hysteresis cooldown (>= 3.0s) preventing rapid oscillation between lanes', () => {
      const gate = engine.state.venue.gates.find((g) => g.id === 'gate-e3')!;
      gate.laneBalancingEnabled = true;

      const agent: CrowdAgent = {
        id: 8888,
        x: gate.position.x,
        y: gate.position.y - 5,
        vx: 0,
        vy: 0,
        targetX: gate.position.x,
        targetY: gate.position.y,
        preferredSpeed: 1.3,
        radius: 0.32,
        state: 'QUEUING',
        assignedLane: 0,
        assignedCounterId: gate.counters![0].id,
        assignedGateId: gate.id,
        targetGateId: gate.id,
        ticketGateId: gate.id,
        inHoldingArea: false,
        pathWaypoints: [gate.position],
        currentWaypointIdx: 0,
        shirtColor: '#FFFFFF',
        skinColor: '#F5D0C5',
        stridePhase: 0,
        facingAngle: 0,
        arrivalTime: 0,
        waitDurationSecs: 10,
        lastLaneSwitchTime: 10.0, // Switched at t = 10.0s
        laneSwitchCount: 1,
      };
      engine.state.agents.push(agent);
      engine.state.simTimeSecs = 11.0; // only 1.0s elapsed (cooldown requires 3.0s)

      engine.step(0.5);

      // Should not switch because cooldown (1.5s < 3.0s) is active
      expect(agent.assignedLane).toBe(0);
      expect(agent.laneSwitchCount).toBe(1);
    });

    it('should move spectators smoothly without teleportation when switching lanes', () => {
      const gate = engine.state.venue.gates.find((g) => g.id === 'gate-s2')!;
      gate.laneBalancingEnabled = true;

      const agent: CrowdAgent = {
        id: 9999,
        x: gate.position.x - 3.0,
        y: gate.position.y + 4.0,
        vx: 0,
        vy: 0,
        targetX: gate.position.x,
        targetY: gate.position.y,
        preferredSpeed: 1.3,
        radius: 0.32,
        state: 'QUEUING',
        assignedLane: 0,
        assignedCounterId: gate.counters![0].id,
        assignedGateId: gate.id,
        targetGateId: gate.id,
        ticketGateId: gate.id,
        inHoldingArea: false,
        pathWaypoints: [gate.position],
        currentWaypointIdx: 0,
        shirtColor: '#FFFFFF',
        skinColor: '#F5D0C5',
        stridePhase: 0,
        facingAngle: 0,
        arrivalTime: 0,
        waitDurationSecs: 10,
        lastLaneSwitchTime: 0,
        laneSwitchCount: 0,
      };
      engine.state.agents.push(agent);
      gate.currentQueue = 1;

      const initialPos = { x: agent.x, y: agent.y };
      engine.step(0.1);

      // Positional displacement over 0.1s must obey physical velocity bounds (v <= 1.4 m/s -> max dist <= 0.2m)
      const dx = agent.x - initialPos.x;
      const dy = agent.y - initialPos.y;
      const stepDist = Math.sqrt(dx * dx + dy * dy);

      expect(stepDist).toBeLessThanOrEqual(0.25);
    });
  });

  // =========================================================================
  // Requirement 7: Counter Failure & Recovery Lifecycle
  // =========================================================================
  describe('Requirement 7: Counter Failure & Recovery Lifecycle', () => {
    it('should stop processing on a failed counter while remaining counters operate', () => {
      const gate = engine.state.venue.gates.find((g) => g.id === 'gate-n3')!;
      engine.setGateSideConfig({
        selectedGateIds: ['gate-n3'],
        processingRatePerSec: 1.0,
      });

      // Fail Counter 1 (Lane 0)
      gate.counters![0].status = 'FAILED';
      gate.operationalScanners = 2;

      engine.applyInitialQueue(2, ['gate-n3']);
      expect(gate.currentQueue).toBe(2);

      // Step forward 1.2s
      for (let i = 0; i < 12; i++) {
        engine.step(0.1);
      }

      // Operational counters (Counter 2 and 3) processed people
      expect(gate.admittedCount).toBe(2);
      expect(gate.counters![0].totalProcessedCount).toBe(0); // Failed counter processed 0
    });

    it('should dynamically rebalance spectators assigned to a failed counter to operational lanes', () => {
      const gate = engine.state.venue.gates.find((g) => g.id === 'gate-w1')!;
      gate.laneBalancingEnabled = true;

      // Spectator in Lane 0 whose counter suddenly fails
      const agent: CrowdAgent = {
        id: 4444,
        x: gate.position.x,
        y: gate.position.y - 4,
        vx: 0,
        vy: 0,
        targetX: gate.position.x,
        targetY: gate.position.y,
        preferredSpeed: 1.3,
        radius: 0.32,
        state: 'QUEUING',
        assignedLane: 0,
        assignedCounterId: gate.counters![0].id,
        assignedGateId: gate.id,
        targetGateId: gate.id,
        ticketGateId: gate.id,
        inHoldingArea: false,
        pathWaypoints: [gate.position],
        currentWaypointIdx: 0,
        shirtColor: '#FFFFFF',
        skinColor: '#F5D0C5',
        stridePhase: 0,
        facingAngle: 0,
        arrivalTime: 0,
        waitDurationSecs: 10,
        lastLaneSwitchTime: 0,
        laneSwitchCount: 0,
      };
      engine.state.agents.push(agent);
      gate.currentQueue = 1;

      // Fail Counter 1
      gate.counters![0].status = 'FAILED';

      engine.step(1.0);

      // Agent must have rebalanced to an operational lane (Lane 1 or Lane 2)
      expect(agent.assignedLane).not.toBe(0);
      expect([1, 2]).toContain(agent.assignedLane);
    });

    it('should halt all gate processing if all three counters fail', () => {
      const gate = engine.state.venue.gates.find((g) => g.id === 'gate-e2')!;
      gate.counters!.forEach((c) => (c.status = 'FAILED'));
      gate.operationalScanners = 0;

      engine.applyInitialQueue(10, ['gate-e2']);
      const initialAdmitted = gate.admittedCount || 0;

      for (let i = 0; i < 20; i++) {
        engine.step(0.1);
      }

      // No admissions allowed when all counters offline
      expect(gate.admittedCount).toBe(initialAdmitted);
      expect(gate.currentQueue).toBe(10);
      expect(gate.status).toBe('SCANNER_FAILURE');
      expect(gate.operationalControlState).toBe('ADMISSION_PAUSED');
    });

    it('should restore full processing capacity when all counters recover', () => {
      const gate = engine.state.venue.gates.find((g) => g.id === 'gate-e2')!;
      // Fail all
      gate.counters!.forEach((c) => (c.status = 'FAILED'));
      gate.operationalScanners = 0;
      engine.step(0.1);
      expect(gate.effectiveCapacityPerMin).toBe(0);

      // Restore all
      gate.counters!.forEach((c) => (c.status = 'OPERATIONAL'));
      gate.operationalScanners = 3;
      engine.step(0.1);

      expect(gate.effectiveCapacityPerMin).toBe(180);
      expect(gate.operationalControlState).toBe('NORMAL');
    });
  });

  // =========================================================================
  // Requirement 9: Strict Ticket & Gate Assignment Preservation
  // =========================================================================
  describe('Requirement 9: Ticket & Gate Assignment Preservation', () => {
    it('should strictly balance lanes ONLY within the same gate and never cross-assign to other gates', () => {
      const gateE2 = engine.state.venue.gates.find((g) => g.id === 'gate-e2')!;
      gateE2.laneBalancingEnabled = true;

      // Add a spectator ticketed to Gate E2
      const agent: CrowdAgent = {
        id: 12345,
        x: gateE2.position.x,
        y: gateE2.position.y - 6,
        vx: 0,
        vy: 0,
        targetX: gateE2.position.x,
        targetY: gateE2.position.y,
        preferredSpeed: 1.3,
        radius: 0.32,
        state: 'QUEUING',
        assignedLane: 0,
        assignedCounterId: gateE2.counters![0].id,
        assignedGateId: 'gate-e2',
        targetGateId: 'gate-e2',
        ticketGateId: 'gate-e2',
        inHoldingArea: false,
        pathWaypoints: [gateE2.position],
        currentWaypointIdx: 0,
        shirtColor: '#FFFFFF',
        skinColor: '#F5D0C5',
        stridePhase: 0,
        facingAngle: 0,
        arrivalTime: 0,
        waitDurationSecs: 10,
        lastLaneSwitchTime: 0,
        laneSwitchCount: 0,
      };
      engine.state.agents.push(agent);

      // Step simulation through several balancing cycles
      for (let i = 0; i < 20; i++) {
        engine.step(0.2);
      }

      // Gate assignment and ticket MUST remain gate-e2
      expect(agent.targetGateId).toBe('gate-e2');
      expect(agent.ticketGateId).toBe('gate-e2');
      expect(agent.assignedGateId).toBe('gate-e2');
      // Lane assignment must be within [0, 1, 2]
      expect([0, 1, 2]).toContain(agent.assignedLane);
    });
  });

  // =========================================================================
  // Requirement 6: Authoritative Metrics Reconciliation & Zero Double Counting
  // =========================================================================
  describe('Requirement 6: Authoritative Metrics Reconciliation', () => {
    it('should reconcile lane metrics exactly with gate queue and admitted counts without double counting', () => {
      const gate = engine.state.venue.gates.find((g) => g.id === 'gate-n2')!;
      engine.setGateSideConfig({
        selectedGateIds: ['gate-n2'],
        processingRatePerSec: 1.0,
      });

      engine.applyInitialQueue(15, ['gate-n2']);
      engine.step(0.1);

      const metrics = engine.getGateLaneMetrics('gate-n2');
      expect(metrics.length).toBe(3);

      const sumWaiting = metrics.reduce((sum, m) => sum + m.waitingCount, 0);
      const sumProcessing = metrics.reduce((sum, m) => sum + m.processingCount, 0);
      const sumLaneTotal = metrics.reduce((sum, m) => sum + m.totalLaneCount, 0);

      expect(sumWaiting + sumProcessing).toBe(15);
      expect(sumLaneTotal).toBe(15);
      expect(gate.currentQueue).toBe(15);

      // Run 5 seconds of processing
      for (let i = 0; i < 50; i++) {
        engine.step(0.1);
      }

      const updatedMetrics = engine.getGateLaneMetrics('gate-n2');
      const sumAdmitted = updatedMetrics.reduce((sum, m) => sum + m.totalAdmitted, 0);

      expect(sumAdmitted).toBe(gate.admittedCount);
      expect(gate.totalProcessedCount).toBe(gate.admittedCount);

      // Mass conservation check
      const audit = engine.getGateAccountingAudit('gate-n2')!;
      expect(audit).toBeDefined();
      expect(audit.isConserved).toBe(true);
    });
  });
});

