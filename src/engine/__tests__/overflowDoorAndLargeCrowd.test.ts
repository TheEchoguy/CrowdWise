import { describe, it, expect, beforeEach } from 'vitest';
import { SimulationEngine } from '../SimulationEngine';
import { CHINNASWAMY_STADIUM_PROFILE } from '../../data/chinnaswamyStadium';

describe('Congestion-Responsive Gate Management with 4th Overflow Door & Large Crowd Simulation', () => {
  let engine: SimulationEngine;

  beforeEach(() => {
    engine = new SimulationEngine(CHINNASWAMY_STADIUM_PROFILE, 2026);
    engine.state.inflowConfig.estimatedAttendance = 0;
    engine.state.inflowConfig.unexpectedCrowdAddition = 0;
  });

  // =========================================================================
  // Test Suite 1: Physical Architecture & Multi-Gate Verification
  // =========================================================================
  describe('Architecture & Gate Setup', () => {
    it('should equip all 10 regular entry gates with a 4th Overflow Door in CLOSED state', () => {
      const regularGates = engine.state.venue.gates.filter(
        (g) => g.gateType === 'REGULAR' && g.direction === 'ENTRY'
      );
      expect(regularGates.length).toBe(10);

      regularGates.forEach((gate) => {
        expect(gate.overflowDoor).toBeDefined();
        expect(gate.overflowDoor?.status).toBe('CLOSED');
        expect(gate.overflowDoor?.doorProgress).toBe(0.0);
        expect(gate.overflowDoor?.serviceRatePerSec).toBe(1.0);
        expect(gate.overflowDoor?.highCongestionThreshold).toBe(60);
        expect(gate.overflowDoor?.extremeCongestionThreshold).toBe(80);
        expect(gate.overflowDoor?.recoveryThreshold).toBe(40);
        expect(gate.overflowDoor?.minSustainedExtremeSecs).toBe(5.0);
        expect(gate.overflowDoor?.minRecoveryDurationSecs).toBe(5.0);
        expect(gate.overflowDoor?.manualOverride).toBe('AUTO');
      });
    });

    it('should NOT attach overflow door to VIP gate N1 or Exit gate S1', () => {
      const vipGate = engine.state.venue.gates.find((g) => g.id === 'gate-n1');
      const exitGate = engine.state.venue.gates.find((g) => g.id === 'gate-s1');

      expect(vipGate?.overflowDoor).toBeUndefined();
      expect(exitGate?.overflowDoor).toBeUndefined();
    });

    it('should provide 4 distinct lane metrics for regular entry gates', () => {
      engine.step(0.1);
      const metrics = engine.getGateLaneMetrics('gate-e2', true);
      expect(metrics.length).toBe(4);

      expect(metrics[0].laneNumber).toBe(1);
      expect(metrics[0].counterName).toBe('Counter 1');
      expect(metrics[1].laneNumber).toBe(2);
      expect(metrics[1].counterName).toBe('Counter 2');
      expect(metrics[2].laneNumber).toBe(3);
      expect(metrics[2].counterName).toBe('Counter 3');

      expect(metrics[3].laneIndex).toBe(3);
      expect(metrics[3].laneNumber).toBe(4);
      expect(metrics[3].counterName).toBe('Overflow Door (4th Passage)');
      expect(metrics[3].counterStatus).toBe('CLOSED');
      expect(metrics[3].waitingCount).toBe(0);
    });
  });

  // =========================================================================
  // Test Suite 2: Profile 1 - Normal Arrival (Standby Overflow Door)
  // =========================================================================
  describe('Profile 1: Normal Arrival (120 p/min)', () => {
    it('should keep overflow door CLOSED when 3 regular lanes handle nominal inflow', () => {
      const gate = engine.state.venue.gates.find((g) => g.id === 'gate-e2')!;
      engine.setDemonstrationProfile('gate-e2', 'NORMAL');

      expect(gate.arrivalRatePerMin).toBe(120);
      expect(gate.overflowDoor?.status).toBe('CLOSED');

      // Simulate 10 seconds of normal arrivals
      for (let i = 0; i < 100; i++) {
        engine.step(0.1);
      }

      // Regular queues remain small and manageable (< 20)
      expect(gate.currentQueue).toBeLessThan(30);
      expect(gate.overflowDoor?.status).toBe('CLOSED');
      expect(gate.overflowDoor?.doorProgress).toBe(0.0);
      expect(gate.overflowDoor?.activationReason).toBeUndefined();
    });
  });

  // =========================================================================
  // Test Suite 3: Profile 2 - Heavy Arrival (240 p/min)
  // =========================================================================
  describe('Profile 2: Heavy Arrival (240 p/min)', () => {
    it('should build queues across regular lanes without prematurely triggering overflow door', () => {
      const gate = engine.state.venue.gates.find((g) => g.id === 'gate-e2')!;
      engine.setDemonstrationProfile('gate-e2', 'HEAVY');

      expect(gate.arrivalRatePerMin).toBe(240);

      // Simulate 20 seconds of heavy inflow
      for (let i = 0; i < 200; i++) {
        engine.step(0.1);
      }

      // Queue grows because 240 p/m exceeds 3 counters capacity (180 p/m)
      expect(gate.currentQueue).toBeGreaterThan(5);
      // Below extreme threshold (80 per lane), door stays closed
      expect(gate.overflowDoor?.status).toBe('CLOSED');
      expect(gate.overflowDoor?.doorProgress).toBe(0.0);
    });
  });

  // =========================================================================
  // Test Suite 4: Profile 3 - Extreme Arrival Surge & Automatic Door Activation
  // =========================================================================
  describe('Profile 3: Extreme Arrival Surge & Automatic Door Activation', () => {
    it('should automatically open overflow door when all 3 lanes experience extreme congestion for >= 5s', () => {
      const gate = engine.state.venue.gates.find((g) => g.id === 'gate-e2')!;
      engine.setDemonstrationProfile('gate-e2', 'SURGE');

      expect(gate.arrivalRatePerMin).toBe(720);

      // Pre-load extreme queues across all three lanes (85 each, total 255)
      engine.applyInitialQueue(255, ['gate-e2']);
      engine.step(0.1);

      expect(gate.counter1QueueCount).toBeGreaterThanOrEqual(80);
      expect(gate.counter2QueueCount).toBeGreaterThanOrEqual(80);
      expect(gate.counter3QueueCount).toBeGreaterThanOrEqual(80);

      // Advance 4.5 seconds (less than 5.0s sustained required duration)
      for (let i = 0; i < 45; i++) {
        engine.step(0.1);
      }
      // Door should not be fully open yet
      expect(gate.overflowDoor?.status).not.toBe('OPEN');

      // Advance another 1.0 second (total >= 5.5s sustained)
      for (let i = 0; i < 10; i++) {
        engine.step(0.1);
      }

      // Door should have initiated opening or be open
      expect(['OPENING', 'OPEN']).toContain(gate.overflowDoor?.status);

      // Advance 2 more seconds for smooth motorized slide to complete (doorProgress = 1.0)
      for (let i = 0; i < 20; i++) {
        engine.step(0.1);
      }

      expect(gate.overflowDoor?.status).toBe('OPEN');
      expect(gate.overflowDoor?.doorProgress).toBe(1.0);
      expect(['HIGH', 'CRITICAL']).toContain(gate.warningLevel);
      expect(gate.overflowDoor?.activationReason).toContain('Extreme congestion sustained');
    });

    it('should process spectators through the 4th Overflow Door once open and reduce congestion', () => {
      const gate = engine.state.venue.gates.find((g) => g.id === 'gate-e2')!;
      engine.setDemonstrationProfile('gate-e2', 'SURGE');

      // Pre-load extreme queues
      engine.applyInitialQueue(255, ['gate-e2']);

      // Advance 8 seconds to ensure door is fully OPEN
      for (let i = 0; i < 80; i++) {
        engine.step(0.1);
      }
      expect(gate.overflowDoor?.status).toBe('OPEN');

      const initialAdmitted = gate.admittedCount || 0;
      const initialDoorAdmitted = gate.overflowDoor?.totalProcessedCount || 0;

      // Run 5 more seconds of 4-route processing
      for (let i = 0; i < 50; i++) {
        engine.step(0.1);
      }

      // Overflow door should have independently admitted spectators
      expect((gate.overflowDoor?.totalProcessedCount || 0)).toBeGreaterThan(initialDoorAdmitted);
      expect(gate.admittedCount).toBeGreaterThan(initialAdmitted);
    });
  });

  // =========================================================================
  // Test Suite 5: Counter Outage Scenarios (Profiles 4, 5, 6)
  // =========================================================================
  describe('Counter Failures and Full Outages', () => {
    it('Profile 4: should handle Counter 1 failure with dynamic lane balancing', () => {
      const gate = engine.state.venue.gates.find((g) => g.id === 'gate-e2')!;
      engine.setDemonstrationProfile('gate-e2', 'FAIL_1');

      expect(gate.counters?.[0].status).toBe('FAILED');
      expect(gate.counters?.[1].status).toBe('OPERATIONAL');
      expect(gate.counters?.[2].status).toBe('OPERATIONAL');

      engine.applyInitialQueue(40, ['gate-e2']);

      // Step 5 seconds
      for (let i = 0; i < 50; i++) {
        engine.step(0.1);
      }

      // Lane 2 and 3 should be actively processing
      expect(gate.counters?.[1].totalProcessedCount).toBeGreaterThan(0);
      expect(gate.counters?.[2].totalProcessedCount).toBeGreaterThan(0);
      // Counter 1 should have processed 0
      expect(gate.counters?.[0].totalProcessedCount).toBe(0);
    });

    it('Profile 6: should activate overflow door when all regular counters fail', () => {
      const gate = engine.state.venue.gates.find((g) => g.id === 'gate-e2')!;
      engine.setDemonstrationProfile('gate-e2', 'FAIL_ALL');

      expect(gate.counters?.[0].status).toBe('FAILED');
      expect(gate.counters?.[1].status).toBe('FAILED');
      expect(gate.counters?.[2].status).toBe('FAILED');

      engine.applyInitialQueue(30, ['gate-e2']);

      // Step 7 seconds (exceeding sustained outage threshold of 5s)
      for (let i = 0; i < 70; i++) {
        engine.step(0.1);
      }

      // Overflow door activates due to complete counter failure
      expect(['OPENING', 'OPEN']).toContain(gate.overflowDoor?.status);
    });
  });

  // =========================================================================
  // Test Suite 6: Hysteresis Recovery
  // =========================================================================
  describe('Hysteresis Recovery & Door Closure', () => {
    it('should close overflow door only after regular queues drop below 40 for >= 5s', () => {
      const gate = engine.state.venue.gates.find((g) => g.id === 'gate-e2')!;
      engine.setDemonstrationProfile('gate-e2', 'SURGE');

      // Trigger door open
      engine.applyInitialQueue(255, ['gate-e2']);
      for (let i = 0; i < 80; i++) {
        engine.step(0.1);
      }
      expect(gate.overflowDoor?.status).toBe('OPEN');

      // Stop arrivals and clear large queues so regular queues drop below recovery threshold (<40)
      engine.stopArrivals('gate-e2');
      // Drain agents until queue < 40
      engine.state.agents = engine.state.agents.filter((a) => a.targetGateId !== 'gate-e2');
      gate.currentQueue = 10;
      gate.counter1QueueCount = 3;
      gate.counter2QueueCount = 3;
      gate.counter3QueueCount = 4;

      // Advance 4.0 seconds (< 5s recovery duration)
      for (let i = 0; i < 40; i++) {
        engine.step(0.1);
      }
      // Should still be OPEN or CLOSING, recovery timer counting
      expect(gate.overflowDoor?.recoveryTimer).toBeGreaterThan(3.5);

      // Advance another 2.5 seconds (total > 6s of recovery)
      for (let i = 0; i < 25; i++) {
        engine.step(0.1);
      }

      // Smooth slide closes door
      for (let i = 0; i < 20; i++) {
        engine.step(0.1);
      }

      expect(gate.overflowDoor?.status).toBe('CLOSED');
      expect(gate.overflowDoor?.doorProgress).toBe(0.0);
    });
  });

  // =========================================================================
  // Test Suite 7: Operator Manual Overrides
  // =========================================================================
  describe('Operator Manual Overrides', () => {
    it('should force open overflow door immediately on FORCE_OPEN override', () => {
      const gate = engine.state.venue.gates.find((g) => g.id === 'gate-n3')!;
      engine.setOverflowDoorOverride('gate-n3', 'FORCE_OPEN');

      expect(gate.overflowDoor?.status).toBe('OPEN');
      expect(gate.overflowDoor?.doorProgress).toBe(1.0);
      expect(gate.overflowDoor?.manualOverride).toBe('FORCE_OPEN');

      // Step simulation and verify it stays open despite zero queue
      engine.step(0.5);
      expect(gate.overflowDoor?.status).toBe('OPEN');
    });

    it('should force close overflow door immediately on FORCE_CLOSED override', () => {
      const gate = engine.state.venue.gates.find((g) => g.id === 'gate-n3')!;
      // First force open
      engine.setOverflowDoorOverride('gate-n3', 'FORCE_OPEN');
      expect(gate.overflowDoor?.status).toBe('OPEN');

      // Now force close
      engine.setOverflowDoorOverride('gate-n3', 'FORCE_CLOSED');
      expect(gate.overflowDoor?.status).toBe('CLOSED');
      expect(gate.overflowDoor?.doorProgress).toBe(0.0);
      expect(gate.overflowDoor?.manualOverride).toBe('FORCE_CLOSED');
    });

    it('should return control to state machine when set back to AUTO', () => {
      const gate = engine.state.venue.gates.find((g) => g.id === 'gate-n3')!;
      engine.setOverflowDoorOverride('gate-n3', 'FORCE_OPEN');
      expect(gate.overflowDoor?.manualOverride).toBe('FORCE_OPEN');

      engine.setOverflowDoorOverride('gate-n3', 'AUTO');
      expect(gate.overflowDoor?.manualOverride).toBe('AUTO');
    });
  });

  // =========================================================================
  // Test Suite 8: Authoritative Mass Conservation Audit
  // =========================================================================
  describe('Mass Conservation Audit', () => {
    it('should maintain strict conservation of pedestrians across all 4 admission routes', () => {
      const gate = engine.state.venue.gates.find((g) => g.id === 'gate-w2')!;
      engine.setDemonstrationProfile('gate-w2', 'SURGE');

      // Queue 100 pedestrians
      engine.applyInitialQueue(100, ['gate-w2']);

      // Run 30 seconds (300 steps)
      for (let i = 0; i < 300; i++) {
        engine.step(0.1);
      }

      // Mathematical mass conservation equation
      // N_assigned = N_remaining + N_arrived
      const audit = engine.getGateAccountingAudit('gate-w2');
      expect(audit).not.toBeNull();
      expect(audit!.isConserved).toBe(true);
      expect(audit!.assigned).toBe(audit!.remaining + audit!.arrived);
      expect(audit!.admitted).toBeGreaterThan(0);

      // Authoritative 4-lane reconciliation: sum of admissions across all 4 routes == gate admitted count
      const metrics = engine.getGateLaneMetrics('gate-w2', true);
      expect(metrics.length).toBe(4);
      const sumLaneAdmitted = metrics.reduce((sum, m) => sum + m.totalAdmitted, 0);
      expect(sumLaneAdmitted).toBe(gate.admittedCount);
      expect(gate.totalProcessedCount).toBe(gate.admittedCount);
    });
  });

  // =========================================================================
  // Test Suite 9: Crowd Arrival Inflow Controls
  // =========================================================================
  describe('Inflow Control Actions', () => {
    it('should pause, resume, and stop crowd arrivals correctly', () => {
      const gate = engine.state.venue.gates.find((g) => g.id === 'gate-s2')!;

      // Pause arrivals
      engine.pauseArrivals('gate-s2');
      expect(gate.isArrivalsPaused).toBe(true);

      const arrivalsAtPause = gate.totalArrivalsCount || 0;
      for (let i = 0; i < 50; i++) {
        engine.step(0.1);
      }
      expect(gate.totalArrivalsCount).toBe(arrivalsAtPause);

      // Resume arrivals
      engine.resumeArrivals('gate-s2');
      expect(gate.isArrivalsPaused).toBe(false);

      for (let i = 0; i < 50; i++) {
        engine.step(0.1);
      }
      expect(gate.totalArrivalsCount).toBeGreaterThan(arrivalsAtPause);

      // Stop arrivals
      engine.stopArrivals('gate-s2');
      expect(gate.arrivalRatePerMin).toBe(0);
      expect(gate.isArrivalsPaused).toBe(true);
    });

    it('should add instant arrival surges (+60, +120)', () => {
      const gate = engine.state.venue.gates.find((g) => g.id === 'gate-s2')!;
      const beforeSurge = gate.totalArrivalsCount || 0;

      engine.addArrivalSurge('gate-s2', 60);
      expect(gate.totalArrivalsCount).toBe(beforeSurge + 60);

      engine.addArrivalSurge('gate-s2', 120);
      expect(gate.totalArrivalsCount).toBe(beforeSurge + 180);
    });

    it('should completely reset gate simulation state', () => {
      const gate = engine.state.venue.gates.find((g) => g.id === 'gate-s2')!;
      engine.setDemonstrationProfile('gate-s2', 'SURGE');
      engine.applyInitialQueue(100, ['gate-s2']);
      for (let i = 0; i < 50; i++) {
        engine.step(0.1);
      }

      expect(gate.currentQueue).toBeGreaterThan(0);

      // Reset
      engine.resetGateSimulation('gate-s2');

      expect(gate.currentQueue).toBe(0);
      expect(gate.totalArrivalsCount).toBe(0);
      expect(gate.admittedCount).toBe(0);
      expect(gate.overflowDoor?.status).toBe('CLOSED');
      expect(gate.overflowDoor?.doorProgress).toBe(0.0);
      expect(gate.counters?.every((c) => c.status === 'OPERATIONAL')).toBe(true);
    });
  });

  // =========================================================================
  // Test Suite 10: Deterministic 11-Step End-to-End Overflow Activation Lifecycle
  // =========================================================================
  describe('Deterministic 11-Step Overflow Door Activation & Recovery Lifecycle', () => {
    it('should complete the full 11-step lifecycle verifying every transition and invariant', () => {
      const gateId = 'gate-e2';
      const gate = engine.state.venue.gates.find((g) => g.id === gateId)!;

      // STEP 1: Verify all 3 regular counters operational
      expect(gate.counters?.length).toBe(3);
      expect(gate.counters?.every((c) => c.status === 'OPERATIONAL')).toBe(true);
      expect(gate.operationalScanners).toBe(3);
      expect(gate.overflowDoor?.status).toBe('CLOSED');

      // STEP 2: Configure sustained extreme arrivals (720 p/min)
      engine.setDemonstrationProfile(gateId, 'SURGE');
      expect(gate.arrivalRatePerMin).toBe(720);
      expect(gate.isArrivalsPaused).toBe(false);

      // STEP 3: Queues form and balance across all 3 lanes
      engine.applyInitialQueue(255, [gateId]);
      engine.step(0.1);
      const initialTotalQueue = (gate.counter1QueueCount || 0) + (gate.counter2QueueCount || 0) + (gate.counter3QueueCount || 0);
      expect(initialTotalQueue).toBeGreaterThanOrEqual(240);

      // STEP 4: Each regular queue reaches >= 80 spectators
      expect(gate.counter1QueueCount).toBeGreaterThanOrEqual(80);
      expect(gate.counter2QueueCount).toBeGreaterThanOrEqual(80);
      expect(gate.counter3QueueCount).toBeGreaterThanOrEqual(80);

      // STEP 5: Persistence timer increments and reaches 5.0 seconds
      // Advance 4.5 seconds: timer must be > 4.0s but < 5.0s, door still CLOSED
      for (let i = 0; i < 45; i++) {
        engine.step(0.1);
      }
      expect(gate.overflowDoor?.sustainedExtremeTimer).toBeGreaterThanOrEqual(4.0);
      expect(gate.overflowDoor?.status).toBe('CLOSED');

      // Advance another 1.0s (total > 5.0s sustained)
      for (let i = 0; i < 10; i++) {
        engine.step(0.1);
      }
      expect(gate.overflowDoor?.sustainedExtremeTimer).toBeGreaterThanOrEqual(5.0);

      // STEP 6: Overflow activation event logged in event feed
      const events = engine.getGateSideEvents(gateId);
      const activationEvent = events.find((e) => e.message.includes('OVERFLOW DOOR ACTIVATED') || e.message.includes('Extreme congestion sustained'));
      expect(activationEvent).toBeDefined();

      // STEP 7: Physical door opens (transition OPENING -> OPEN, aperture progress reaches 1.0)
      for (let i = 0; i < 20; i++) {
        engine.step(0.1);
      }
      expect(gate.overflowDoor?.status).toBe('OPEN');
      expect(gate.overflowDoor?.doorProgress).toBe(1.0);

      // STEP 8: Overflow route accepts eligible queuers
      const metricsBefore = engine.getGateLaneMetrics(gateId, true);
      const overflowMetric = metricsBefore.find((m) => m.laneIndex === 3);
      expect(overflowMetric).toBeDefined();
      expect(overflowMetric?.counterStatus).toBe('OPEN');

      // STEP 9: Overflow door processes spectators and updates admissions
      const priorOverflowAdmissions = gate.overflowDoor?.totalProcessedCount || 0;
      const priorTotalAdmissions = gate.admittedCount || 0;

      for (let i = 0; i < 50; i++) {
        engine.step(0.1);
      }
      expect((gate.overflowDoor?.totalProcessedCount || 0)).toBeGreaterThan(priorOverflowAdmissions);
      expect((gate.admittedCount || 0)).toBeGreaterThan(priorTotalAdmissions);

      // STEP 10: Spectator accounting remains strictly conserved
      const audit = engine.getGateAccountingAudit(gateId);
      expect(audit).not.toBeNull();
      expect(audit!.isConserved).toBe(true);
      expect(audit!.assigned).toBe(audit!.remaining + audit!.arrived);

      // STEP 11: Door closes only after recovery condition (< 40 in all 3 lanes for >= 5.0s)
      engine.stopArrivals(gateId);
      engine.state.agents = engine.state.agents.filter((a) => a.targetGateId !== gateId);
      gate.currentQueue = 15;
      gate.counter1QueueCount = 5;
      gate.counter2QueueCount = 5;
      gate.counter3QueueCount = 5;

      // 4 seconds below threshold: recovery timer runs, door not yet closed
      for (let i = 0; i < 40; i++) {
        engine.step(0.1);
      }
      expect(gate.overflowDoor?.recoveryTimer).toBeGreaterThanOrEqual(3.5);
      expect(gate.overflowDoor?.status).not.toBe('CLOSED');

      // Advance through remaining recovery and motorized closing slide
      for (let i = 0; i < 40; i++) {
        engine.step(0.1);
      }
      expect(gate.overflowDoor?.status).toBe('CLOSED');
      expect(gate.overflowDoor?.doorProgress).toBe(0.0);
    });
  });
});
