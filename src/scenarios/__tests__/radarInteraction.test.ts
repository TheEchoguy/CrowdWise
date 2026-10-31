/**
 * CROWDWISE — 21-Gate Radar Interaction & Dashboard Synchronization Test Suite
 *
 * Verifies all 9 interaction requirements:
 * 1. Unique stable gate IDs for all 21 markers matching centralized configuration.
 * 2. Every marker clickable at both stanchion dot and outward label position.
 * 3. Clicking Gate 1 updates selected gate in store to Gate 1.
 * 4. Clicking Gate 7 updates selected gate and reflects unresolved / pending survey status.
 * 5. Reserved gates (G4, G9, G13, G20) have correct classification and zero public demand.
 * 6. Selecting another gate changes inspection data across fields.
 * 7. State consistency between radar coordinates, store, and telemetry.
 * 8. Selecting a gate does not reset simulation clock, spectator accounting, or active scenarios.
 * 9. Gate data is strictly sourced from centralized stadium21GateConfig.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  STADIUM_21_GATES,
  STADIUM_21_GATES_BY_ID,
  RADAR_CENTER_X,
  RADAR_CENTER_Y,
  RADAR_OUTER_RADIUS,
  RADAR_GATE_HIT_TOLERANCE_PX
} from '../data/stadium21GateConfig';

import {
  computeRadarGateCoordinates,
  findNearestRadarGate,
  convertPointerToCanvasCoordinates,
  DEFAULT_GATE_CLICK_TOLERANCE_PX
} from '../utils/radarGateSelection';

import { useSimulationStore } from '../../state/useSimulationStore';
import { StadiumNetworkEngine } from '../engine/StadiumNetworkEngine';

describe('CROWDWISE: 21-Gate Radar Interaction & Synchronization Suite', () => {
  const gateCoords = computeRadarGateCoordinates();

  it('1. Unique stable gate IDs for all 21 markers matching centralized configuration', () => {
    assert.equal(STADIUM_21_GATES.length, 21);
    assert.equal(gateCoords.length, 21);

    const ids = new Set<string>();
    const numbers = new Set<number>();

    for (let i = 0; i < 21; i++) {
      const def = STADIUM_21_GATES[i];
      const coord = gateCoords[i];

      assert.equal(def.id, `gate-${i + 1}`);
      assert.equal(def.gateNumber, i + 1);
      assert.equal(coord.id, def.id);
      assert.equal(coord.gateNumber, def.gateNumber);

      assert.ok(!ids.has(def.id), `Duplicate gate ID: ${def.id}`);
      assert.ok(!numbers.has(def.gateNumber), `Duplicate gate number: ${def.gateNumber}`);
      ids.add(def.id);
      numbers.add(def.gateNumber);

      // Verify confirmed vs unresolved placeholder mappings
      if (def.mappingStatus === 'unresolved_placeholder') {
        assert.equal(def.externalReferenceId, 'E-UNRESOLVED');
        assert.equal(def.entryRoadGroup, 'Unassigned (Pending Survey)');
      } else {
        assert.ok(def.externalReferenceId.startsWith('E-'));
        assert.notEqual(def.externalReferenceId, 'E-UNRESOLVED');
      }
    }
  });

  it('2. Every marker can be clicked at both stanchion dot and outward label position', () => {
    for (const gate of gateCoords) {
      const rad = (gate.angleDeg * Math.PI) / 180;

      // 2A: Click at stanchion center (R = 200)
      const stanchionHit = findNearestRadarGate(
        gate.x,
        gate.y,
        DEFAULT_GATE_CLICK_TOLERANCE_PX,
        RADAR_CENTER_X,
        RADAR_CENTER_Y,
        RADAR_OUTER_RADIUS
      );
      assert.ok(stanchionHit !== null, `Failed to hit stanchion dot for Gate ${gate.gateNumber}`);
      assert.equal(stanchionHit!.gate.gateNumber, gate.gateNumber);
      assert.equal(stanchionHit!.distancePx, 0);

      // 2B: Click at outward gate label (R = 222)
      const lx = RADAR_CENTER_X + Math.cos(rad) * (RADAR_OUTER_RADIUS + 22);
      const ly = RADAR_CENTER_Y + Math.sin(rad) * (RADAR_OUTER_RADIUS + 22);

      const labelHit = findNearestRadarGate(
        lx,
        ly,
        DEFAULT_GATE_CLICK_TOLERANCE_PX,
        RADAR_CENTER_X,
        RADAR_CENTER_Y,
        RADAR_OUTER_RADIUS
      );
      assert.ok(labelHit !== null, `Failed to hit outward label for Gate ${gate.gateNumber}`);
      assert.equal(labelHit!.gate.gateNumber, gate.gateNumber);
      assert.ok(labelHit!.distancePx <= DEFAULT_GATE_CLICK_TOLERANCE_PX);
    }
  });

  it('3. Clicking Gate 1 updates the selected gate in store to Gate 1', () => {
    const gate1 = gateCoords.find((g) => g.gateNumber === 1)!;
    const hit = findNearestRadarGate(gate1.x, gate1.y);
    assert.ok(hit !== null);

    // Apply store update
    useSimulationStore.getState().setSelectedGateNumber(hit!.gate.gateNumber);
    const state = useSimulationStore.getState();
    assert.equal(state.selectedGateNumber, 1);
    assert.equal(state.selectedGateId, 'gate-1');
  });

  it('4. Clicking Gate 7 updates selected gate and reflects unresolved / pending survey status', () => {
    const gate7 = gateCoords.find((g) => g.gateNumber === 7)!;
    const hit = findNearestRadarGate(gate7.x, gate7.y);
    assert.ok(hit !== null);
    assert.equal(hit!.gate.gateNumber, 7);

    useSimulationStore.getState().setSelectedGateNumber(7);
    const state = useSimulationStore.getState();
    assert.equal(state.selectedGateNumber, 7);
    assert.equal(state.selectedGateId, 'gate-7');

    const def = STADIUM_21_GATES_BY_ID['gate-7'];
    assert.ok(def !== undefined);
    assert.equal(def.mappingStatus, 'unresolved_placeholder');
    assert.equal(def.externalReferenceId, 'E-UNRESOLVED');
    assert.equal(def.entryRoadGroup, 'Unassigned (Pending Survey)');
    assert.equal(def.approachGeometryStatus, 'macro_estimate');
  });

  it('5. Reserved gates (G4, G9, G13, G20) display correct classification and zero public demand', () => {
    const g4 = STADIUM_21_GATES_BY_ID['gate-4'];
    const g9 = STADIUM_21_GATES_BY_ID['gate-9'];
    const g13 = STADIUM_21_GATES_BY_ID['gate-13'];
    const g20 = STADIUM_21_GATES_BY_ID['gate-20'];

    assert.equal(g4.gateType, 'vip');
    assert.equal(g4.publicEntryEligible, false);

    assert.equal(g9.gateType, 'vip');
    assert.equal(g9.publicEntryEligible, false);

    assert.equal(g13.gateType, 'restricted');
    assert.equal(g13.publicEntryEligible, false);

    assert.equal(g20.gateType, 'emergency');
    assert.equal(g20.publicEntryEligible, false);

    // Verify through network engine that public demand is 0
    const engine = new StadiumNetworkEngine({
      totalSpectators: 10000,
      durationMinutes: 60,
      arrivalDistribution: 'gaussian_peak',
      randomSeed: 2026
    });

    const s4 = engine.getGateState('gate-4')!;
    const s9 = engine.getGateState('gate-9')!;
    const s13 = engine.getGateState('gate-13')!;
    const s20 = engine.getGateState('gate-20')!;

    assert.equal(s4.assignedDemand, 0);
    assert.equal(s9.assignedDemand, 0);
    assert.equal(s13.assignedDemand, 0);
    assert.equal(s20.assignedDemand, 0);
  });

  it('6. Clicking another gate changes the inspection data across fields', () => {
    // Select Gate 1
    useSimulationStore.getState().setSelectedGateNumber(1);
    const def1 = STADIUM_21_GATES_BY_ID[useSimulationStore.getState().selectedGateId];

    // Select Gate 8
    useSimulationStore.getState().setSelectedGateNumber(8);
    const def8 = STADIUM_21_GATES_BY_ID[useSimulationStore.getState().selectedGateId];

    assert.notEqual(def1.id, def8.id);
    assert.notEqual(def1.displayName, def8.displayName);
    assert.notEqual(def1.entryRoadGroup, def8.entryRoadGroup);
    assert.notEqual(def1.externalReferenceId, def8.externalReferenceId);
    assert.notEqual(def1.approachGeometryStatus, def8.approachGeometryStatus);
    assert.equal(def1.approachGeometryStatus, 'verified');
    assert.equal(def8.approachGeometryStatus, 'macro_estimate');
  });

  it('7. State consistency between radar coordinates, store, and telemetry', () => {
    const engine = new StadiumNetworkEngine({
      totalSpectators: 5000,
      durationMinutes: 60,
      arrivalDistribution: 'uniform',
      randomSeed: 2026
    });

    // Test selection of Gate 12
    useSimulationStore.getState().setSelectedGateId('gate-12');
    const storeState = useSimulationStore.getState();
    assert.equal(storeState.selectedGateNumber, 12);
    assert.equal(storeState.selectedGateId, 'gate-12');

    const liveState = engine.getGateState(storeState.selectedGateNumber);
    assert.ok(liveState !== undefined);
    assert.equal(liveState!.gateId, 'gate-12');
    assert.equal(liveState!.gateDefinition.displayName, 'Gate 12 (Stand F Block 1)');
    assert.equal(liveState!.gateDefinition.entryRoadGroup, 'Link Road');
  });

  it('8. Selecting a gate does not reset simulation clock, spectator accounting, or active scenarios', () => {
    const engine = new StadiumNetworkEngine({
      totalSpectators: 5000,
      durationMinutes: 60,
      arrivalDistribution: 'uniform',
      randomSeed: 2026
    });

    // Advance engine by 30 seconds
    engine.step(30.0);
    const clockBefore = engine.getCurrentSimTimeSec();
    assert.ok(clockBefore >= 30.0);

    const summaryBefore = engine.getNetworkSummary();
    const resetSignalBefore = useSimulationStore.getState().resetSignal;

    // Change gate selections
    useSimulationStore.getState().setSelectedGateNumber(3);
    useSimulationStore.getState().setSelectedGateNumber(15);
    useSimulationStore.getState().setSelectedGateId('gate-2');

    // Confirm store resetSignal was NOT bumped
    const resetSignalAfter = useSimulationStore.getState().resetSignal;
    assert.equal(resetSignalBefore, resetSignalAfter);

    // Confirm engine state did not reset
    const clockAfter = engine.getCurrentSimTimeSec();
    assert.equal(clockBefore, clockAfter);

    const summaryAfter = engine.getNetworkSummary();
    assert.equal(summaryBefore.totalInjected, summaryAfter.totalInjected);
    assert.equal(summaryBefore.totalAdmitted, summaryAfter.totalAdmitted);
    assert.equal(summaryBefore.totalQueued, summaryAfter.totalQueued);
  });

  it('9. Gate data is strictly sourced from centralized stadium21GateConfig', () => {
    const coords = computeRadarGateCoordinates();
    for (const c of coords) {
      const sourceDef = STADIUM_21_GATES_BY_ID[c.id];
      assert.ok(sourceDef !== undefined);
      assert.equal(c.name, sourceDef.displayName);
      assert.equal(c.sectorId, sourceDef.sectorId);
      assert.equal(c.angleDeg, sourceDef.angleDeg);
      assert.equal(c.approachStreet, sourceDef.entryRoadGroup);
      assert.equal(c.gateDefinition, sourceDef);
    }
  });

  it('10. Pointer coordinate conversion correctly maps CSS scaled rectangles and respects tolerance', () => {
    // 50% scale container (480x290 DOM box for 960x580 canvas) with (100, 50) offset
    const domRect = { left: 100, top: 50, width: 480, height: 290 };

    // Point in center
    const centerPtr = convertPointerToCanvasCoordinates(100 + 240, 50 + 145, domRect);
    assert.ok(centerPtr !== null);
    assert.equal(centerPtr!.x, 480);
    assert.equal(centerPtr!.y, 290);

    // Point out of bounds
    const outPtr = convertPointerToCanvasCoordinates(50, 50, domRect);
    assert.equal(outPtr, null);

    // Tolerance constant consistency
    assert.ok(DEFAULT_GATE_CLICK_TOLERANCE_PX <= RADAR_GATE_HIT_TOLERANCE_PX);
  });
});
