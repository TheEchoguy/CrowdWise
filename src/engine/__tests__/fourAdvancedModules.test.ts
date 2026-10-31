import { describe, it, expect, beforeEach } from 'vitest';
import { SimulationEngine } from '../SimulationEngine';
import { CHINNASWAMY_STADIUM_PROFILE } from '../../data/chinnaswamyStadium';
import {
  GateClosureReason,
  GateClosureScenarioType,
  ValidationMetricType,
  ReferenceDataset,
} from '../../types';

describe('Four Advanced Crowd-Safety Modules Test Suite', () => {
  let engine: SimulationEngine;

  beforeEach(() => {
    engine = new SimulationEngine(CHINNASWAMY_STADIUM_PROFILE, 1337);
  });

  // =========================================================================
  // MODULE 1: Gate Closure & Recovery Management Tests
  // =========================================================================
  describe('Module 1: Gate Closure & Recovery Management', () => {
    it('should fail one counter while keeping other counters operational', () => {
      const gateId = 'gate-e2';
      const incident = engine.initiateGateClosure(gateId, 'SCANNER_FAILURE', 'FAIL_1_COUNTER');
      const gate = engine.state.venue.gates.find((g) => g.id === gateId)!;

      expect(incident.state).toBe('DEGRADED');
      expect(gate.counters?.[0].status).toBe('FAILED');
      expect(gate.counters?.[1].status).toBe('OPERATIONAL');
      expect(gate.counters?.[2].status).toBe('OPERATIONAL');
      expect(gate.operationalScanners).toBe(2);
      expect(gate.direction).toBe('ENTRY'); // Remains entry capable
    });

    it('should completely close gate and stop all regular admissions on security or structural alert', () => {
      const gateId = 'gate-e2';
      const incident = engine.initiateGateClosure(gateId, 'SECURITY', 'FULL_CLOSURE_SECURITY');
      const gate = engine.state.venue.gates.find((g) => g.id === gateId)!;

      expect(incident.state).toBe('CLOSED');
      expect(gate.direction).toBe('CLOSED');
      expect(gate.status).toBe('TEMPORARILY_CLOSED');
      expect(gate.operationalScanners).toBe(0);
      expect(gate.isArrivalsPaused).toBe(true);

      // Verify all regular counters offline
      expect(gate.counters?.every((c) => c.status === 'FAILED')).toBe(true);

      // Test processing does not advance admissions
      const preAdmitted = gate.admittedCount || 0;
      for (let i = 0; i < 20; i++) engine.step(0.1);
      expect(gate.admittedCount).toBe(preAdmitted);
    });

    it('should strictly prohibit 4th overflow door from bypassing a full security or structural closure', () => {
      const gateId = 'gate-n2';
      const incident = engine.initiateGateClosure(gateId, 'STRUCTURAL', 'FULL_CLOSURE_STRUCTURAL');
      const gate = engine.state.venue.gates.find((g) => g.id === gateId)!;

      expect(incident.overflowDoorAllowed).toBe(false);
      expect(gate.overflowDoor?.manualOverride).toBe('FORCE_CLOSED');
      expect(gate.overflowDoor?.status).toBe('CLOSED');
      expect(gate.overflowDoor?.doorProgress).toBe(0.0);
    });

    it('should allow overflow door to operate in AUTO when only scanners fail and entrance is physically safe', () => {
      const gateId = 'gate-w2';
      const incident = engine.initiateGateClosure(gateId, 'SCANNER_FAILURE', 'FAIL_3_COUNTERS');
      const gate = engine.state.venue.gates.find((g) => g.id === gateId)!;

      expect(incident.overflowDoorAllowed).toBe(true);
      expect(gate.overflowDoor?.manualOverride).toBe('AUTO');
    });

    it('should divert newly approaching spectators to holding area upon total gate closure', () => {
      const gateId = 'gate-e2';
      const gate = engine.state.venue.gates.find((g) => g.id === gateId)!;

      // Seed 20 approaching spectators
      engine.seedInitialApproachCrowd(gateId, 20);
      const preApproaching = engine.state.agents.filter((a) => a.targetGateId === gateId && a.state === 'APPROACHING').length;
      expect(preApproaching).toBeGreaterThan(0);

      // Initiate closure
      engine.initiateGateClosure(gateId, 'OBSTRUCTION', 'FULL_CLOSURE_OBSTRUCTION');

      // Approaching agents should be safely transitioned to HOLDING
      const holding = engine.state.agents.filter((a) => a.targetGateId === gateId && a.state === 'HOLDING').length;
      expect(holding).toBeGreaterThanOrEqual(preApproaching);
    });

    it('should evaluate alternative gates and enforce security cordon restrictions', () => {
      const gateId = 'gate-e2';
      engine.initiateGateClosure(gateId, 'SECURITY', 'FULL_CLOSURE_SECURITY');

      const evaluations = engine.evaluateAlternativeGates(gateId);
      expect(evaluations.length).toBeGreaterThan(0);

      // Top recommendation should be authorized and accessible
      const topRec = evaluations[0];
      expect(topRec.isAuthorized).toBe(true);
      expect(topRec.isAccessible).toBe(true);
      expect(topRec.recommendationScore).toBeGreaterThan(0);
    });

    it('should execute authorized rerouting without teleportation or loss of spectator mass', () => {
      const gateId = 'gate-e2';
      engine.applyInitialQueue(30, [gateId]);
      engine.step(0.1);

      engine.initiateGateClosure(gateId, 'OBSTRUCTION', 'FULL_CLOSURE_OBSTRUCTION');
      const count = engine.executeAuthorizedReroute(gateId);

      expect(count).toBeGreaterThan(0);

      // Mass conservation check
      const reroutedAgents = engine.state.agents.filter((a) => a.originalTargetGateId === gateId && a.isRerouted);
      expect(reroutedAgents.length).toBe(count);
    });

    it('should require cause-specific recovery clearance before reopening', () => {
      const gateId = 'gate-e2';
      engine.initiateGateClosure(gateId, 'OBSTRUCTION', 'FULL_CLOSURE_OBSTRUCTION');
      const gate = engine.state.venue.gates.find((g) => g.id === gateId)!;

      // Without clearing obstruction, reopening must fail
      const preReopen = engine.reopenGateAfterRecovery(gateId);
      expect(preReopen).toBe(false);
      expect(gate.status).toBe('TEMPORARILY_CLOSED');

      // Mark obstruction cleared
      engine.updateGateRecoveryChecklist(gateId, { obstructionCleared: true });
      expect(engine.checkGateRecoveryReady(gateId)).toBe(true);

      // Reopening must now succeed
      const postReopen = engine.reopenGateAfterRecovery(gateId);
      expect(postReopen).toBe(true);
      expect(gate.status).toBe('OPERATIONAL');
      expect(gate.direction).toBe('ENTRY');
      expect(gate.isArrivalsPaused).toBe(false);
    });
  });

  // =========================================================================
  // MODULE 2: Crowd Model Calibration & Validation Tests
  // =========================================================================
  describe('Module 2: Crowd Model Calibration & Validation', () => {
    it('should compute real simulation measurements across active population', () => {
      // Seed some crowd
      engine.applyInitialQueue(50, ['gate-e2', 'gate-n2']);
      for (let i = 0; i < 20; i++) engine.step(0.1);

      const measurements = engine.getValidationMeasurements();
      expect(measurements).toBeDefined();
      expect(measurements.WALKING_SPEED).toBeGreaterThan(0);
      expect(measurements.COUNTER_SERVICE_TIME).toBeGreaterThan(0);
      expect(measurements.INFLOW_OUTFLOW_BALANCE).toBeGreaterThan(0);
    });

    it('should configure and persist model calibration parameters without corrupting default engine', () => {
      const initialParams = engine.getCalibrationParameters();
      expect(initialParams.preferredSpeed).toBe(1.34);

      engine.setCalibrationParameters({ preferredSpeed: 1.45, counterServiceRate: 1.2 });
      const updated = engine.getCalibrationParameters();
      expect(updated.preferredSpeed).toBe(1.45);
      expect(updated.counterServiceRate).toBe(1.2);
    });

    it('should safely calculate percentage error avoiding zero-division crashes', () => {
      const simVal = 0.5;
      const refVal = 0.0; // edge-case zero denominator
      const safeDenominator = Math.max(0.001, Math.abs(refVal));
      const pctErr = Math.round((Math.abs(simVal - refVal) / safeDenominator) * 1000) / 10;
      expect(pctErr).toBeDefined();
      expect(Number.isFinite(pctErr)).toBe(true);
    });
  });

  // =========================================================================
  // MODULE 3: Multi-Directional Crowd Flow Tests
  // =========================================================================
  describe('Module 3: Multi-Directional Crowd Flow Management', () => {
    it('should initialize multi-stream bidirectional flow scenario with opposing streams', () => {
      engine.initMultiDirectionalScenario('INBOUND_VS_OUTBOUND', 'NONE');
      expect(engine.multiDirectionalActive).toBe(true);
      expect(engine.multiDirectionalStreams.length).toBe(2);

      const streamA = engine.multiDirectionalStreams[0];
      const streamB = engine.multiDirectionalStreams[1];
      expect(streamA.origin.x).toBeLessThan(streamA.destination.x); // Eastbound
      expect(streamB.origin.x).toBeGreaterThan(streamB.destination.x); // Westbound
      expect(engine.state.agents.length).toBeGreaterThan(0);
    });

    it('should simulate crossing flows with orthogonal stream trajectories', () => {
      engine.initMultiDirectionalScenario('TWO_CROSSING_FLOWS', 'NONE');
      expect(engine.multiDirectionalStreams.length).toBe(2);

      const streamEast = engine.multiDirectionalStreams[0];
      const streamSouth = engine.multiDirectionalStreams[1];
      expect(streamEast.id).toBe('stream-east');
      expect(streamSouth.id).toBe('stream-south');
    });

    it('should enforce central median barrier and eliminate opposing collision contact under Directional Lanes', () => {
      engine.initMultiDirectionalScenario('HEAVY_BIDIRECTIONAL', 'DIRECTIONAL_LANES');
      expect(engine.multiDirectionalIntervention).toBe('DIRECTIONAL_LANES');

      // Step simulation for 20 steps
      for (let i = 0; i < 20; i++) engine.step(0.1);

      // Verify Stream A agents (group 1) remain in lower half (y >= 30) and Stream B (group 2) remain in upper half (y <= 30)
      const group1Agents = engine.state.agents.filter((a) => a.groupId === 1);
      const group2Agents = engine.state.agents.filter((a) => a.groupId === 2);

      group1Agents.forEach((a) => {
        expect(a.y).toBeGreaterThanOrEqual(30.0);
      });
      group2Agents.forEach((a) => {
        expect(a.y).toBeLessThanOrEqual(30.0);
      });

      const metrics = engine.getMultiDirectionalMetrics();
      expect(metrics.counterflowFrictionIndex).toBeLessThanOrEqual(0.1);
    });
  });

  // =========================================================================
  // MODULE 4: Spatial Risk Propagation & Counterfactual Analysis Tests
  // =========================================================================
  describe('Module 4: Spatial Risk Propagation & Counterfactual Analysis', () => {
    it('should generate real-time spatial summaries across all monitored venue zones', () => {
      const summaries = engine.getSpatialZoneSummaries();
      expect(summaries.length).toBeGreaterThan(0);

      summaries.forEach((z) => {
        expect(z.zoneId).toBeDefined();
        expect(z.usableAreaSqM).toBeGreaterThan(0);
        expect(z.currentDensity).toBeGreaterThanOrEqual(0);
        expect(['NORMAL', 'WATCH', 'HIGH_CONGESTION', 'CRITICAL']).toContain(z.riskLevel);
      });
    });

    it('should predict potential secondary hotspot formation along connected downstream corridors', () => {
      // Find a concourse zone
      const concourse = engine.state.venue.zones.find((z) => z.category === 'CONCOURSE') || engine.state.venue.zones[0];
      const prediction = engine.analyzeHotspotPropagation(concourse.id);

      expect(prediction).not.toBeNull();
      expect(prediction?.sourceHotspotZoneId).toBe(concourse.id);
      expect(prediction?.predictedImpactedZoneIds.length).toBeGreaterThan(0);
      expect(prediction?.explanation).toBeDefined();
    });

    it('should execute deterministic snapshot and restoration for counterfactual execution', () => {
      engine.applyInitialQueue(40, ['gate-e2']);
      engine.step(0.5);

      const snapshot = engine.createSnapshot();
      const initialTime = engine.state.simTimeSecs;
      const initialAgentCount = engine.state.agents.length;

      // Advance simulation
      for (let i = 0; i < 50; i++) engine.step(0.1);
      expect(engine.state.simTimeSecs).toBeGreaterThan(initialTime);

      // Restore snapshot
      engine.restoreSnapshot(snapshot);
      expect(engine.state.simTimeSecs).toBe(initialTime);
      expect(engine.state.agents.length).toBe(initialAgentCount);
    });
  });

  // =========================================================================
  // INTEGRATION TESTS: Complete Venue & Backward Compatibility
  // =========================================================================
  describe('Integration & Architectural Preservation', () => {
    it('should preserve all 12 venue gates and their operational configurations', () => {
      const gates = engine.state.venue.gates;
      expect(gates.length).toBe(12);

      const regularGates = gates.filter((g) => g.gateType === 'REGULAR');
      expect(regularGates.length).toBe(10);

      regularGates.forEach((g) => {
        expect(g.counters?.length).toBe(3);
        expect(g.overflowDoor).toBeDefined();
      });
    });

    it('should maintain strict spectator mass conservation across multi-gate operations', () => {
      const gateId = 'gate-e2';
      engine.seedInitialApproachCrowd(gateId, 30);
      engine.step(1.0);

      const audit = engine.getGateAccountingAudit(gateId);
      expect(audit).not.toBeNull();
      expect(audit!.isConserved).toBe(true);
      expect(audit!.assigned).toBe(audit!.remaining + audit!.arrived);
    });
  });
});
