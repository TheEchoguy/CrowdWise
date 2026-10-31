/**
 * CROWDWISE — 21-Gate Stadium Network & Ticket Allocation Test Suite
 * Venue: M. Chinnaswamy Stadium, Bengaluru (35,000 Capacity)
 *
 * Verifies all 12 Engineering Acceptance Criteria:
 *  1. All 21 radar positions represented (G1..G21) with valid coordinates and metadata.
 *  2. Reserved gates receive zero ordinary public spectator demand (G4, G9, G13, G20).
 *  3. Total allocated spectators exactly equal requested demand (N = 10,000 and 33,250).
 *  4. Valid assigned gate and stand (or explicit placeholder mapping) for all spectators.
 *  5. Ticket authorization is strictly respected across gates and stands.
 *  6. Deterministic PRNG seed produces bit-for-bit identical allocations; differing seeds diverge.
 *  7. Independent gate queues, wait times, densities, and congestion levels.
 *  8. Uncoupled congestion: Gate 1 failure does not alter Gate 2 demand without diversion.
 *  9. Admission throughput strictly capped by physical turnstile capacity (lanes * 60 / latency).
 * 10. Invariant conservation holding at all simulation steps (Total = Injected + Remaining = Admitted + Queued + Remaining).
 * 11. Alternative gate diversion strictly validates stand connection and downstream capacity.
 * 12. Macro radar indicators accurately reflect underlying multi-gate simulation state.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STADIUM_21_GATES,
  STADIUM_21_GATES_BY_ID,
  PUBLIC_STADIUM_GATES,
  RESERVED_STADIUM_GATES,
  CHINNASWAMY_STANDS,
  CONFIRMED_GATES,
  PLACEHOLDER_GATES
} from '../data/stadium21GateConfig';
import {
  TicketAllocationEngine
} from '../engine/TicketAllocationEngine';
import {
  StadiumNetworkEngine,
  GateLiveState
} from '../engine/StadiumNetworkEngine';

test('21-Gate Stadium Network & Ticket Allocation Acceptance Suite', async (t) => {
  // =========================================================================
  // CRITERION 1: ALL 21 RADAR POSITIONS REPRESENTED
  // =========================================================================
  await t.test('1. All 21 radar positions represented with valid coordinates and unique numbers', () => {
    assert.equal(STADIUM_21_GATES.length, 21, 'Must define exactly 21 perimeter gates');

    const seenNumbers = new Set<number>();
    const seenIds = new Set<string>();

    for (const gate of STADIUM_21_GATES) {
      assert.ok(gate.gateNumber >= 1 && gate.gateNumber <= 21, `Gate number ${gate.gateNumber} must be 1..21`);
      assert.ok(!seenNumbers.has(gate.gateNumber), `Duplicate gate number detected: ${gate.gateNumber}`);
      seenNumbers.add(gate.gateNumber);

      assert.ok(!seenIds.has(gate.id), `Duplicate gate ID detected: ${gate.id}`);
      seenIds.add(gate.id);

      assert.ok(gate.angleDeg >= 0 && gate.angleDeg <= 360, `Gate ${gate.id} angleDeg must be in [0, 360]`);
      assert.ok(gate.displayName.length > 0, `Gate ${gate.id} must have a non-empty displayName`);
      assert.ok(gate.entryRoadGroup.length > 0, `Gate ${gate.id} must have a non-empty entryRoadGroup`);
      assert.ok(['east', 'north', 'west', 'south'].includes(gate.sectorId), `Gate ${gate.id} sectorId must be valid`);
      assert.ok(gate.turnstileCount >= 1, `Gate ${gate.id} turnstiles must be >= 1`);
      assert.ok(gate.defaultLatencySec > 0, `Gate ${gate.id} latency must be > 0`);
    }

    // Verify confirmed vs placeholder gate discipline
    assert.ok(CONFIRMED_GATES.length >= 17, 'Must have at least 17 confirmed gates from stadium reference');
    assert.ok(PLACEHOLDER_GATES.length <= 4, 'Must have at most 4 placeholder gates explicitly tagged');
    for (const pg of PLACEHOLDER_GATES) {
      assert.equal(pg.mappingStatus, 'unresolved_placeholder');
    }
  });

  // =========================================================================
  // CRITERION 2: RESERVED GATES ZERO ORDINARY PUBLIC DEMAND
  // =========================================================================
  await t.test('2. Reserved gates receive zero ordinary public spectator demand', () => {
    assert.equal(RESERVED_STADIUM_GATES.length, 4, 'Must have exactly 4 reserved perimeter gates');
    const reservedIds = new Set(RESERVED_STADIUM_GATES.map((g) => g.id));
    assert.ok(reservedIds.has('gate-4'), 'Gate 4 (VIP E-22) must be reserved');
    assert.ok(reservedIds.has('gate-9'), 'Gate 9 (Media/VIP) must be reserved');
    assert.ok(reservedIds.has('gate-13'), 'Gate 13 (KSCA Members/Restricted) must be reserved');
    assert.ok(reservedIds.has('gate-20'), 'Gate 20 (Emergency Egress Only) must be reserved');

    for (const rg of RESERVED_STADIUM_GATES) {
      assert.equal(rg.publicEntryEligible, false, `Reserved gate ${rg.id} publicEntryEligible must be false`);
      assert.equal(rg.nominalDemandWeight, 0, `Reserved gate ${rg.id} nominalDemandWeight must be strictly 0.0`);
    }

    // Allocate 10,000 public spectators
    const allocation = TicketAllocationEngine.allocateTickets({
      totalSpectators: 10000,
      randomSeed: 2026
    });

    for (const rg of RESERVED_STADIUM_GATES) {
      const assigned = allocation.gateAllocations[rg.id]?.assignedCount ?? 0;
      assert.equal(assigned, 0, `Reserved gate ${rg.id} must receive strictly 0 public assigned spectators`);
    }

    // Verify all 10,000 are allocated strictly among public gates
    for (const spec of allocation.spectators) {
      assert.ok(!reservedIds.has(spec.assignedGateId), `Spectator ${spec.spectatorId} erroneously assigned to reserved gate ${spec.assignedGateId}`);
    }
  });

  // =========================================================================
  // CRITERION 3: EXACT POPULATION PRESERVATION (N = 10,000 & N = 33,250)
  // =========================================================================
  await t.test('3. Total allocated spectators exactly equal requested demand', () => {
    // Test N = 10,000
    const alloc10k = TicketAllocationEngine.allocateTickets({
      totalSpectators: 10000,
      randomSeed: 42
    });
    assert.equal(alloc10k.totalSpectators, 10000);
    assert.equal(alloc10k.spectators.length, 10000);
    let sum10k = 0;
    for (const g of Object.values(alloc10k.gateAllocations)) {
      sum10k += g.assignedCount;
    }
    assert.equal(sum10k, 10000, 'Sum of gate allocations must exactly equal 10,000');

    // Test N = 33,250 (Full 95% attendance of 35,000 capacity)
    const allocFull = TicketAllocationEngine.allocateTickets({
      totalSpectators: 33250,
      randomSeed: 2026
    });
    assert.equal(allocFull.totalSpectators, 33250);
    assert.equal(allocFull.spectators.length, 33250);
    let sumFull = 0;
    for (const g of Object.values(allocFull.gateAllocations)) {
      sumFull += g.assignedCount;
    }
    assert.equal(sumFull, 33250, 'Sum of gate allocations must exactly equal 33,250');
  });

  // =========================================================================
  // CRITERION 4: VALID ASSIGNED GATE AND STAND
  // =========================================================================
  await t.test('4. Every spectator has a valid assigned gate and stand, or explicit placeholder mapping', () => {
    const allocation = TicketAllocationEngine.allocateTickets({
      totalSpectators: 5000,
      randomSeed: 12345
    });

    for (const spec of allocation.spectators) {
      const gate = STADIUM_21_GATES_BY_ID[spec.assignedGateId];
      assert.ok(gate, `Spectator ${spec.spectatorId} assigned unknown gate ${spec.assignedGateId}`);

      const stand = CHINNASWAMY_STANDS[spec.assignedStandId];
      assert.ok(stand, `Spectator ${spec.spectatorId} assigned unknown stand ${spec.assignedStandId}`);

      // The gate must connect to the stand, or be an explicit placeholder
      const isConnected = gate.connectedStandIds.includes(stand.id);
      const isPlaceholder = gate.mappingStatus === 'unresolved_placeholder';
      assert.ok(
        isConnected || isPlaceholder,
        `Gate ${gate.id} must connect to stand ${stand.id} or be marked unresolved_placeholder`
      );
    }
  });

  // =========================================================================
  // CRITERION 5: TICKET CATEGORY AUTHORIZATION RESPECTED
  // =========================================================================
  await t.test('5. Ticket category authorization is strictly respected across gates and stands', () => {
    const allocation = TicketAllocationEngine.allocateTickets({
      totalSpectators: 4000,
      randomSeed: 777
    });

    for (const spec of allocation.spectators) {
      const stand = CHINNASWAMY_STANDS[spec.assignedStandId];
      const gate = STADIUM_21_GATES_BY_ID[spec.assignedGateId];

      // Spectator ticket category must be valid for the stand
      assert.ok(
        stand.allowedTicketCategories.includes(spec.ticketCategory),
        `Spectator ${spec.spectatorId} category ${spec.ticketCategory} not allowed in stand ${stand.name}`
      );

      // Spectator ticket category must be authorized at assigned gate
      assert.ok(
        gate.authorizedTicketCategories.includes(spec.ticketCategory),
        `Spectator ${spec.spectatorId} category ${spec.ticketCategory} not authorized at gate ${gate.displayName}`
      );

      // Authorized gate list must include assigned gate
      assert.ok(
        spec.authorizedGateIds.includes(spec.assignedGateId),
        `Assigned gate ${spec.assignedGateId} missing from spectator authorizedGateIds`
      );
    }
  });

  // =========================================================================
  // CRITERION 6: DETERMINISTIC SEED PARITY & REPEATABILITY
  // =========================================================================
  await t.test('6. Fixed seeds produce bit-for-bit repeatable allocations; differing seeds diverge', () => {
    const allocA = TicketAllocationEngine.allocateTickets({
      totalSpectators: 2000,
      randomSeed: 2026
    });

    const allocB = TicketAllocationEngine.allocateTickets({
      totalSpectators: 2000,
      randomSeed: 2026
    });

    const allocC = TicketAllocationEngine.allocateTickets({
      totalSpectators: 2000,
      randomSeed: 8888
    });

    // A and B must match bit-for-bit
    assert.equal(allocA.spectators.length, allocB.spectators.length);
    for (let i = 0; i < allocA.spectators.length; i++) {
      const sA = allocA.spectators[i];
      const sB = allocB.spectators[i];
      assert.equal(sA.spectatorId, sB.spectatorId);
      assert.equal(sA.assignedGateId, sB.assignedGateId);
      assert.equal(sA.assignedStandId, sB.assignedStandId);
      assert.equal(sA.ticketCategory, sB.ticketCategory);
      assert.equal(sA.arrivalTimeSimSec, sB.arrivalTimeSimSec);
    }

    // A and C must diverge
    let diffCount = 0;
    for (let i = 0; i < Math.min(allocA.spectators.length, allocC.spectators.length); i++) {
      if (allocA.spectators[i].assignedGateId !== allocC.spectators[i].assignedGateId) {
        diffCount++;
      }
    }
    assert.ok(diffCount > 100, `Differing seeds must produce divergent allocations (diffCount = ${diffCount})`);
  });

  // =========================================================================
  // CRITERION 7: INDEPENDENT GATE QUEUES AND CONGESTION CALCULATION
  // =========================================================================
  await t.test('7. Gate queues, wait times, densities, and congestion levels are calculated independently', () => {
    const engine = new StadiumNetworkEngine({
      totalSpectators: 10000,
      durationMinutes: 10,
      arrivalDistribution: 'gaussian_peak',
      randomSeed: 2026
    });

    // Step for 180 seconds (into peak arrival surge)
    const dt = 1.0;
    for (let tSec = 0; tSec < 180; tSec++) {
      engine.step(dt);
    }

    const summary = engine.getNetworkSummary();
    assert.ok(summary.totalInjected > 0, 'Should have injected arrivals');

    // Verify public gates have distinct state measurements
    const publicStates: GateLiveState[] = [];
    for (const g of PUBLIC_STADIUM_GATES) {
      const state = engine.getGateState(g.id);
      assert.ok(state, `State must exist for gate ${g.id}`);
      assert.ok(state.localDensity >= 0, `Density must be non-negative for ${g.id}`);
      assert.ok(state.estimatedWaitTimeSec >= 0, `Wait time must be non-negative for ${g.id}`);
      publicStates.push(state);
    }

    // Verify gates with different demand have distinct queue lengths and admissions
    const queues = publicStates.map((s) => s.currentQueue);
    const hasQueueVariance = Math.max(...queues) !== Math.min(...queues);
    assert.ok(hasQueueVariance, 'Public gates must exhibit independent queue variation');

    const admissions = publicStates.map((s) => s.totalAdmitted);
    const hasAdmissionVariance = Math.max(...admissions) !== Math.min(...admissions);
    assert.ok(hasAdmissionVariance, 'Public gates must exhibit independent throughput and admissions');
  });

  // =========================================================================
  // CRITERION 8: UNCOUPLED CONGESTION (GATE 1 FAILURE DOES NOT ALTER GATE 2 DEMAND)
  // =========================================================================
  await t.test('8. Gate 1 congestion does not alter Gate 2 demand without explicit diversion', () => {
    const engineNormal = new StadiumNetworkEngine({
      totalSpectators: 3000,
      durationMinutes: 30,
      randomSeed: 2026
    });

    const engineFailedG1 = new StadiumNetworkEngine({
      totalSpectators: 3000,
      durationMinutes: 30,
      randomSeed: 2026
    });

    // Fail all lanes at Gate 1 on the second engine
    engineFailedG1.setGateOperationalLanes('gate-1', 0);

    // Simulate for 300 seconds without diversion
    for (let tSec = 0; tSec < 300; tSec++) {
      engineNormal.step(1.0);
      engineFailedG1.step(1.0);
    }

    const g1Normal = engineNormal.getGateState('gate-1')!;
    const g1Failed = engineFailedG1.getGateState('gate-1')!;

    const g2Normal = engineNormal.getGateState('gate-2')!;
    const g2Failed = engineFailedG1.getGateState('gate-2')!;

    // Gate 1 on failed engine should have 0 admissions and massive queue
    assert.equal(g1Failed.totalAdmitted, 0, 'Failed Gate 1 must admit 0 spectators');
    assert.ok(g1Failed.currentQueue > g1Normal.currentQueue, 'Failed Gate 1 must accumulate larger queue');

    // Crucial: Gate 2 arrivals and queue must remain identical because congestion is uncoupled
    assert.equal(
      g2Failed.remainingArrivals,
      g2Normal.remainingArrivals,
      'Gate 2 remaining arrivals must be unaffected by Gate 1 failure'
    );
    assert.equal(
      g2Failed.totalAdmitted,
      g2Normal.totalAdmitted,
      'Gate 2 admissions must be unaffected by Gate 1 failure when no diversion is ordered'
    );
  });

  // =========================================================================
  // CRITERION 9: THROUGHPUT RESPECTS CONFIGURED PHYSICAL CAPACITY
  // =========================================================================
  await t.test('9. Admission throughput strictly respects configured gate capacity', () => {
    const engine = new StadiumNetworkEngine({
      totalSpectators: 5000,
      durationMinutes: 20,
      randomSeed: 2026
    });

    // Set Gate 1: 4 lanes, 4.0s latency -> max 1 person/lane every 4s = 0.25 p/s * 4 = 1.0 p/s = 60 p/min
    const g1Def = STADIUM_21_GATES_BY_ID['gate-1'];
    const maxTheoreticalPerSec = g1Def.turnstileCount / g1Def.defaultLatencySec;

    // Simulate 60 seconds
    for (let tSec = 0; tSec < 60; tSec++) {
      engine.step(1.0);
    }

    const g1State = engine.getGateState('gate-1')!;
    // Observed admissions in 60s cannot exceed turnstileCount * (60 / latency) + turnstileCount (initial burst)
    const maxAllowed = Math.ceil(maxTheoreticalPerSec * 60) + g1Def.turnstileCount;
    assert.ok(
      g1State.totalAdmitted <= maxAllowed,
      `Admissions (${g1State.totalAdmitted}) exceeded physical capacity limit (${maxAllowed})`
    );
  });

  // =========================================================================
  // CRITERION 10: INVARIANT CONSERVATION HOLDING ACROSS ALL STEPS
  // =========================================================================
  await t.test('10. Spectator accounting has no duplicates or losses across all 21 gates', () => {
    const total = 4000;
    const engine = new StadiumNetworkEngine({
      totalSpectators: total,
      durationMinutes: 25,
      randomSeed: 2026
    });

    for (let step = 0; step < 100; step++) {
      engine.step(10.0);
      const summary = engine.getNetworkSummary();

      // Invariant 1: Total = Injected + Remaining
      assert.equal(
        summary.totalInjected + summary.totalRemaining,
        total,
        `Invariant 1 failed at step ${step}: Injected (${summary.totalInjected}) + Remaining (${summary.totalRemaining}) != Total (${total})`
      );

      // Invariant 2: Injected = Admitted + Queued
      assert.equal(
        summary.totalAdmitted + summary.totalQueued,
        summary.totalInjected,
        `Invariant 2 failed at step ${step}: Admitted (${summary.totalAdmitted}) + Queued (${summary.totalQueued}) != Injected (${summary.totalInjected})`
      );

      // Invariant 3: Total = Admitted + Queued + Remaining
      assert.equal(
        summary.totalAdmitted + summary.totalQueued + summary.totalRemaining,
        total,
        `Invariant 3 failed at step ${step}: Admitted + Queued + Remaining != Total`
      );
    }
  });

  // =========================================================================
  // CRITERION 11: SAFE ALTERNATIVE GATE DIVERSION
  // =========================================================================
  await t.test('11. Alternative gate diversion strictly validates stand connection and downstream capacity', () => {
    const engine = new StadiumNetworkEngine({
      totalSpectators: 3000,
      durationMinutes: 10,
      arrivalDistribution: 'uniform',
      randomSeed: 2026
    });

    // Simulate scanner hardware failure at Gate 1 so arrivals accumulate in queue
    engine.setGateOperationalLanes('gate-1', 0);

    // Advance 60 seconds to build queues at Gate 1
    for (let t = 0; t < 60; t++) {
      engine.step(1.0);
    }

    const g1State = engine.getGateState('gate-1')!;
    assert.ok(g1State.currentQueue > 0, 'Gate 1 must have waiting spectators in queue');

    // Attempt invalid diversion to reserved Gate 4 (should be rejected)
    const divertedToReserved = engine.divertSpectator('gate-1', 'gate-4');
    assert.equal(divertedToReserved, false, 'Diversion to reserved gate must be unconditionally rejected');

    // Attempt diversion to an un-connected stand gate (e.g. G11 on North/Link Rd for Stand A in East)
    const divertedToInvalidStand = engine.divertSpectator('gate-1', 'gate-11');
    assert.equal(divertedToInvalidStand, false, 'Diversion to gate serving different stand must be rejected');

    // Attempt valid diversion to Gate 2 (serves Stand A, has capacity)
    const initialG2Queue = engine.getGateState('gate-2')!.currentQueue;
    const divertedValid = engine.divertSpectator('gate-1', 'gate-2');
    assert.ok(divertedValid, 'Valid diversion to Gate 2 serving same stand must succeed');
    assert.equal(engine.getGateState('gate-2')!.currentQueue, initialG2Queue + 1, 'Gate 2 queue must receive diverted spectator');
  });

  // =========================================================================
  // CRITERION 12: MACRO RADAR INDICATORS REFLECT ACTUAL STATE
  // =========================================================================
  await t.test('12. Macro gate indicators reflect actual simulation state', () => {
    const engine = new StadiumNetworkEngine({
      totalSpectators: 3000,
      durationMinutes: 20,
      randomSeed: 2026
    });

    // Advance 200 seconds
    for (let t = 0; t < 200; t++) {
      engine.step(1.0);
    }

    for (const gate of STADIUM_21_GATES) {
      const state = engine.getGateState(gate.id);
      assert.ok(state, `Gate state must exist for ${gate.id}`);

      // Verify congestion state classification matches density rules
      if (state.localDensity >= 5.0) {
        assert.equal(state.congestionState, 'critical');
      } else if (state.localDensity >= 4.0) {
        assert.equal(state.congestionState, 'high');
      } else if (state.localDensity >= 2.5) {
        assert.equal(state.congestionState, 'moderate');
      } else {
        assert.equal(state.congestionState, 'normal');
      }
    }
  });
});
