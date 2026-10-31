import { describe, it, expect, beforeEach } from 'vitest';
import { SimulationEngine } from '../SimulationEngine';
import { CHINNASWAMY_STADIUM_PROFILE } from '../../data/chinnaswamyStadium';
import { distance } from '../geometry';

describe('Intelligent Automatic Gate Rerouting (Comprehensive Suite)', () => {
  let engine: SimulationEngine;

  beforeEach(() => {
    engine = new SimulationEngine(CHINNASWAMY_STADIUM_PROFILE, 1337);
    engine.state.venue.gates.forEach((g) => {
      g.strictTicketEnforcement = false;
    });
  });

  // Test A — Single Gate Failure
  describe('Test A: Single Gate Failure & Dynamic Redirection', () => {
    it('should redirect newly arriving pedestrians to operational alternative gates when Gate 2 closes', () => {
      const g1 = engine.state.venue.gates.find((g) => g.id === 'gate-n1')!;
      const g2 = engine.state.venue.gates.find((g) => g.id === 'gate-n2')!;
      const g3 = engine.state.venue.gates.find((g) => g.id === 'gate-n3')!;

      // Configure focused gates: Gate 1, 2, 3
      engine.setGateSideConfig({
        selectedGateIds: ['gate-n1', 'gate-n2', 'gate-n3'],
        inflowRatePerMin: 100,
        processingRatePerSec: 1.0,
      });

      g1.operationalScanners = 4;
      g2.operationalScanners = 6;
      g3.operationalScanners = 4;

      engine.start();

      // Step simulation for 10 seconds to generate initial flow
      for (let i = 0; i < 100; i++) {
        engine.step(0.1);
      }

      const initialAgents = engine.state.agents.length;
      expect(initialAgents).toBeGreaterThan(0);

      // Trigger complete closure of Gate 2
      g2.direction = 'CLOSED';
      g2.status = 'TEMPORARILY_CLOSED';
      g2.operationalScanners = 0;

      // Step simulation a few steps - redirected agents are actively in flight
      for (let i = 0; i < 15; i++) {
        engine.step(0.1);
      }

      // Verify in-flight redirected pedestrians follow actual navigation paths
      const activeRedirected = engine.state.agents.filter((a) => a.isRerouted && a.state === 'APPROACHING');
      expect(activeRedirected.length).toBeGreaterThan(0);
      for (const a of activeRedirected) {
        expect(a.pathWaypoints.length).toBeGreaterThan(0);
        expect(a.targetGateId).not.toBe('gate-n2');
      }

      // Step simulation further during Gate 2 failure
      for (let i = 0; i < 185; i++) {
        engine.step(0.1);
      }

      // Verify that Gate 2 is marked unavailable with 0 capacity
      expect(engine.isGateUnavailable(g2)).toBe(true);
      expect(g2.effectiveCapacityPerMin).toBe(0);

      // Verify Gate 2 stops receiving incoming assignments
      const approachingGate2 = engine.state.agents.filter(
        (a) => a.state === 'APPROACHING' && a.targetGateId === 'gate-n2'
      );
      expect(approachingGate2.length).toBe(0);

      // Verify alternative gates (Gate 1 and Gate 3) receive the flow
      const approachingOthers = engine.state.agents.filter(
        (a) => a.state === 'APPROACHING' && (a.targetGateId === 'gate-n1' || a.targetGateId === 'gate-n3')
      );
      expect(approachingOthers.length).toBeGreaterThan(0);

      // Verify total redirected agents recorded
      const redirectedAgents = engine.state.agents.filter((a) => a.isRerouted);
      expect(redirectedAgents.length).toBeGreaterThan(0);

      // Verify deflection telemetry is recorded on Gate 2
      expect((g2.deflectedCount || 0) + (g1.redirectedCount || 0) + (g3.redirectedCount || 0)).toBeGreaterThan(0);
    });
  });

  // Test B — Partial Scanner Failure
  describe('Test B: Partial Scanner Failure', () => {
    it('should keep Gate 2 operational with reduced throughput when 2 of 6 scanner lanes fail', () => {
      const g2 = engine.state.venue.gates.find((g) => g.id === 'gate-n2')!;
      g2.scannerCount = 6;
      g2.operationalScanners = 6;
      g2.counters = Array.from({ length: 6 }, (_, i) => ({
        id: `gate-n2-c${i + 1}`,
        name: `Counter ${i + 1}`,
        status: 'OPERATIONAL' as const,
        serviceRatePerSec: 1.0,
        totalProcessedCount: 0,
      }));
      g2.scannerProcessingRatePerSec = 1.0;

      engine.setGateSideConfig({
        selectedGateIds: ['gate-n2'],
        processingRatePerSec: 1.0,
      });

      engine.start();
      engine.step(0.1);

      expect(g2.effectiveCapacityPerMin).toBe(360); // 6 * 1.0 * 60

      // Disable 2 lanes
      g2.operationalScanners = 4;
      g2.counters[4].status = 'FAILED';
      g2.counters[5].status = 'FAILED';
      engine.step(0.1);

      // Gate remains operational, not completely unavailable
      expect(engine.isGateUnavailable(g2)).toBe(false);
      expect(engine.isGateDegraded(g2)).toBe(true);

      // Effective capacity decreases proportionally
      expect(g2.effectiveCapacityPerMin).toBe(240); // 4 * 1.0 * 60
      expect(g2.counterUtilizationPercent).toBe(67);
      expect(g2.status).toBe('SCANNER_FAILURE');
    });
  });

  // Test C — Congested Alternative Gate
  describe('Test C: Congested Alternative Gate', () => {
    it('should select other suitable gates when the nearest alternative is heavily congested', () => {
      const g1 = engine.state.venue.gates.find((g) => g.id === 'gate-n1')!;
      const g2 = engine.state.venue.gates.find((g) => g.id === 'gate-n2')!;
      const g3 = engine.state.venue.gates.find((g) => g.id === 'gate-n3')!;
      const g4 = engine.state.venue.gates.find((g) => g.id === 'gate-e1')!;

      // Gate 2 is unavailable
      g2.direction = 'CLOSED';
      g2.status = 'TEMPORARILY_CLOSED';
      g2.operationalScanners = 0;

      // Gate 3 (nearest to Gate 2) is heavily saturated
      g3.currentQueue = 200;
      g3.queueWaitTimeSecs = 1500;
      g3.warningLevel = 'CRITICAL';

      // Gate 1 and Gate 4 have short queues and high capacity
      g1.currentQueue = 5;
      g1.operationalScanners = 6;
      g4.currentQueue = 2;
      g4.operationalScanners = 4;

      const dummyAgent = {
        id: 999,
        x: g2.position.x,
        y: g2.position.y - 10,
        vx: 0,
        vy: 0,
        targetX: g2.position.x,
        targetY: g2.position.y,
        preferredSpeed: 1.3,
        radius: 0.32,
        state: 'APPROACHING' as const,
        targetGateId: 'gate-n2',
        pathWaypoints: [],
        currentWaypointIdx: 0,
        shirtColor: '#fff',
        skinColor: '#fff',
        stridePhase: 0,
        facingAngle: 0,
        arrivalTime: 0,
        waitDurationSecs: 0,
      };

      const selected = engine.selectBestAlternativeGate(dummyAgent, 'gate-n2');

      // The algorithm should bypass saturated Gate 3 and choose a gate with available capacity
      expect(selected).not.toBeNull();
      expect(selected!.id).not.toBe('gate-n2');
      expect(selected!.id).not.toBe('gate-n3');
      expect(['gate-n1', 'gate-4', 'gate-5']).toContain(selected!.id);
    });
  });

  // Test D — No Available Capacity & Unserved Demand
  describe('Test D: No Available Capacity', () => {
    it('should hold pedestrians in safe waiting area and record unserved demand when all gates fail', () => {
      // Close all gates in venue
      engine.state.venue.gates.forEach((g) => {
        g.direction = 'CLOSED';
        g.status = 'TEMPORARILY_CLOSED';
        g.operationalScanners = 0;
      });

      engine.setGateSideConfig({
        selectedGateIds: ['gate-n1', 'gate-n2'],
        inflowRatePerMin: 120,
        processingRatePerSec: 1.0,
      });

      engine.start();

      for (let i = 0; i < 100; i++) {
        engine.step(0.1);
      }

      const summary = engine.getSummary();

      // All gates unavailable
      expect(summary.unavailableGatesCount).toBeGreaterThanOrEqual(2);
      expect(summary.totalAvailableCapacityPerMin).toBe(0);

      // Unserved demand is recorded
      expect(summary.unservedDemandCount).toBeGreaterThan(0);

      // Pedestrians waiting outside are preserved or diverted, not crashed or admitted
      expect(summary.totalAdmitted).toBe(0);
      const audit = engine.getAccountingAudit();
      expect(audit.isConserved).toBe(true);
    });
  });

  // Test E — Gate Recovery
  describe('Test E: Gate Recovery', () => {
    it('should re-enable Gate 2 for assignments when operational scanners are restored', () => {
      const g2 = engine.state.venue.gates.find((g) => g.id === 'gate-n2')!;

      // Start with Gate 2 failed
      g2.operationalScanners = 0;
      g2.status = 'SCANNER_FAILURE';
      g2.scannerProcessingRatePerSec = 1.0;

      engine.start();
      engine.step(0.1);
      expect(engine.isGateUnavailable(g2)).toBe(true);

      // Restore Gate 2
      g2.operationalScanners = 6;
      g2.counters = Array.from({ length: 6 }, (_, i) => ({
        id: `gate-n2-c${i + 1}`,
        name: `Counter ${i + 1}`,
        status: 'OPERATIONAL' as const,
        serviceRatePerSec: 1.0,
        totalProcessedCount: 0,
      }));
      g2.direction = 'ENTRY';
      g2.status = 'OPERATIONAL';

      engine.step(0.1);

      // Gate 2 is now operational and eligible
      expect(engine.isGateUnavailable(g2)).toBe(false);
      expect(g2.effectiveCapacityPerMin).toBe(360);
      expect(g2.unavailabilityReason).toBeUndefined();

      const dummyAgent = {
        id: 1001,
        x: g2.position.x,
        y: g2.position.y - 15,
        preferredSpeed: 1.3,
      } as any;

      const alt = engine.selectBestAlternativeGate(dummyAgent);
      expect(alt).not.toBeNull();
    });
  });

  // Test F — Increasing Arrival Rate & Demand-to-Capacity Response
  describe('Test F: Increasing Arrival Rate & Capacity Utilization', () => {
    it('should truthfully update demand-to-capacity ratio and queue forecasts as inflow increases', () => {
      const g1 = engine.state.venue.gates.find((g) => g.id === 'gate-n1')!;
      g1.operationalScanners = 4;
      g1.scannerProcessingRatePerSec = 1.0; // 4 * 1.0 * 60 = 240 cap/min

      engine.setGateSideConfig({
        selectedGateIds: ['gate-n1'],
        inflowRatePerMin: 60,
        processingRatePerSec: 1.0,
      });

      engine.start();
      for (let i = 0; i < 50; i++) engine.step(0.1);

      let summary = engine.getSummary();
      const ratioLow = summary.demandToCapacityRatio || 0;

      // Increase arrival rate to 300 people/min (demand now exceeds processing rate of 240)
      engine.setGateSideConfig({ inflowRatePerMin: 300 });

      for (let i = 0; i < 100; i++) engine.step(0.1);

      summary = engine.getSummary();
      const ratioHigh = summary.demandToCapacityRatio || 0;

      expect(ratioHigh).toBeGreaterThan(ratioLow);
      expect(ratioHigh).toBeGreaterThanOrEqual(1.0);
    });
  });

  // Anti-Oscillation Cooldown & Commitment
  describe('Anti-Oscillation & Commitment Rules', () => {
    it('should prevent repeated thrashing between gates within cooldown period', () => {
      const g1 = engine.state.venue.gates.find((g) => g.id === 'gate-n1')!;
      const g2 = engine.state.venue.gates.find((g) => g.id === 'gate-n2')!;

      g1.operationalScanners = 4;
      g2.operationalScanners = 4;

      engine.start();

      const agent = {
        id: 500,
        x: 130,
        y: 20,
        vx: 0,
        vy: 0,
        targetX: g1.position.x,
        targetY: g1.position.y,
        preferredSpeed: 1.3,
        radius: 0.32,
        state: 'APPROACHING' as const,
        targetGateId: 'gate-n1',
        pathWaypoints: [g1.position],
        currentWaypointIdx: 0,
        shirtColor: '#fff',
        skinColor: '#fff',
        stridePhase: 0,
        facingAngle: 0,
        arrivalTime: 0,
        waitDurationSecs: 0,
        lastRerouteTime: 5.0, // Rerouted at t=5s
        rerouteCount: 1,
      };

      engine.state.agents.push(agent);

      // At t=8s (only 3s elapsed, cooldown is 10s):
      engine.state.simTimeSecs = 8.0;
      g1.currentQueue = 40; // Slight degradation

      // Step simulation
      engine.step(0.1);

      // Agent should commit and NOT immediately flip targetGateId again
      expect(agent.targetGateId).toBe('gate-n1');
    });
  });

  // Downstream Corridor Blockage Exclusion
  describe('Downstream Corridor Congestion Exclusion', () => {
    it('should never select an alternative gate if its downstream corridor is blocked', () => {
      const g1 = engine.state.venue.gates.find((g) => g.id === 'gate-n1')!;
      const g2 = engine.state.venue.gates.find((g) => g.id === 'gate-n2')!;

      // Block Gate 1 downstream corridor
      const corr1 = engine.state.venue.corridors.find((c) => c.id === g1.downstreamCorridorId);
      if (corr1) {
        corr1.isBlocked = true;
      }

      expect(engine.isGateDownstreamBlocked(g1)).toBe(true);

      const agent = {
        id: 700,
        x: g2.position.x,
        y: g2.position.y - 10,
        preferredSpeed: 1.3,
      } as any;

      // Select alternative excluding Gate 2
      const candidate = engine.selectBestAlternativeGate(agent, 'gate-n2');

      // Gate 1 must NOT be selected because its corridor is blocked
      expect(candidate).not.toBeNull();
      expect(candidate!.id).not.toBe('gate-n1');
    });
  });

  // Mass Conservation Audit Under Active Rerouting
  describe('Physical Mass Conservation Under Rerouting', () => {
    it('should strictly conserve total attendee mass during multi-gate failures and redirections', () => {
      const g2 = engine.state.venue.gates.find((g) => g.id === 'gate-n2')!;
      engine.setGateSideConfig({
        selectedGateIds: ['gate-n1', 'gate-n2', 'gate-n3'],
        inflowRatePerMin: 120,
        processingRatePerSec: 1.0,
      });

      engine.start();

      for (let i = 0; i < 150; i++) {
        if (i === 50) {
          // Mid-run failure of Gate 2
          g2.direction = 'CLOSED';
          g2.operationalScanners = 0;
          g2.status = 'TEMPORARILY_CLOSED';
        }
        engine.step(0.1);
      }

      const audit = engine.getAccountingAudit();
      expect(audit.isConserved).toBe(true);
      expect(audit.totalGenerated).toBe(
        audit.waitingOutside + audit.processing + audit.admitted + audit.diverted
      );
    });
  });
});
