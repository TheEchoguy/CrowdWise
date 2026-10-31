/**
 * CROWDWISE — QA-01 and QA-02 Verification Test Suite
 *
 * Tests:
 * 1. QA-01: Macro Radar Gate Selection
 *    - Clicking Gate 1 (angle 330°)
 *    - Clicking Gate 21 (angle 312°)
 *    - Clicking Gate 2 (angle 345°) and Gate 3 (angle 0°)
 *    - Clicking between two gates (midpoints)
 *    - Clicking empty space (center field, outer corners)
 *    - Canvas scaling and coordinate conversion (different CSS rects and offsets)
 * 2. QA-02: Separate Print and Download
 *    - Structured JSON export construction with complete paired audit result
 *    - Structured JSON export construction with live telemetry fallback (graceful degradation)
 *    - All required fields presence and typing
 *    - Export JSON serializability and validity
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  computeRadarGateCoordinates,
  convertPointerToCanvasCoordinates,
  findNearestRadarGate,
  DEFAULT_GATE_CLICK_TOLERANCE_PX,
  RADAR_CANVAS_WIDTH,
  RADAR_CANVAS_HEIGHT,
  RADAR_CENTER_X,
  RADAR_CENTER_Y,
  RADAR_OUTER_RADIUS
} from '../utils/radarGateSelection';

import {
  buildDisplacementAuditExport,
  DisplacementAuditExportData
} from '../utils/displacementExport';

import {
  ScenarioComparisonResult
} from '../types/ScenarioTypes';
import { TelemetryState } from '../../types/simulation';

describe('QA-01: Macro Radar 21-Gate Selection Geometry & Hit-Testing', () => {
  const gateCoords = computeRadarGateCoordinates();

  it('All 21 perimeter gates are computed with valid coordinates on the radius', () => {
    assert.equal(gateCoords.length, 21);

    for (const g of gateCoords) {
      assert.ok(g.gateNumber >= 1 && g.gateNumber <= 21);

      // Verify each gate lies on the outer radius circle around (480, 300)
      const distFromCenter = Math.hypot(g.x - RADAR_CENTER_X, g.y - RADAR_CENTER_Y);
      assert.ok(Math.abs(distFromCenter - RADAR_OUTER_RADIUS) < 0.001);
    }
  });

  it('Clicking Gate 1 coordinates selects Gate 1 (angle 330°)', () => {
    const gate1 = gateCoords.find((g) => g.gateNumber === 1);
    assert.ok(gate1 !== undefined);

    // Exact click
    const exactHit = findNearestRadarGate(gate1!.x, gate1!.y);
    assert.ok(exactHit !== null);
    assert.equal(exactHit!.gate.gateNumber, 1);
    assert.equal(exactHit!.distancePx, 0);

    // Near click within tolerance (e.g. 5px offset)
    const nearHit = findNearestRadarGate(gate1!.x + 3, gate1!.y - 4);
    assert.ok(nearHit !== null);
    assert.equal(nearHit!.gate.gateNumber, 1);
    assert.equal(nearHit!.distancePx, 5);
  });

  it('Clicking Gate 21 coordinates selects Gate 21 (angle 312°)', () => {
    const gate21 = gateCoords.find((g) => g.gateNumber === 21);
    assert.ok(gate21 !== undefined);

    // Exact click
    const exactHit = findNearestRadarGate(gate21!.x, gate21!.y);
    assert.ok(exactHit !== null);
    assert.equal(exactHit!.gate.gateNumber, 21);
    assert.equal(exactHit!.distancePx, 0);

    // Near click within tolerance (e.g. 4px offset in x and y)
    const nearHit = findNearestRadarGate(gate21!.x - 4, gate21!.y + 4);
    assert.ok(nearHit !== null);
    assert.equal(nearHit!.gate.gateNumber, 21);
    assert.ok(Math.abs(nearHit!.distancePx - Math.hypot(4, 4)) < 0.1);
  });

  it('Clicking Gate 2 and Gate 3 disambiguates correctly', () => {
    const gate2 = gateCoords.find((g) => g.gateNumber === 2);
    const gate3 = gateCoords.find((g) => g.gateNumber === 3);
    assert.ok(gate2 !== undefined);
    assert.ok(gate3 !== undefined);

    // Click near Gate 2
    const hit2 = findNearestRadarGate(gate2!.x + 2, gate2!.y - 2);
    assert.ok(hit2 !== null);
    assert.equal(hit2!.gate.gateNumber, 2);

    // Click near Gate 3
    const hit3 = findNearestRadarGate(gate3!.x - 2, gate3!.y + 2);
    assert.ok(hit3 !== null);
    assert.equal(hit3!.gate.gateNumber, 3);

    // Verify distance between Gate 2 and Gate 3 stanchions is distinct
    const distBetween = Math.hypot(gate2!.x - gate3!.x, gate2!.y - gate3!.y);
    assert.ok(distBetween > 40); // 15° arc ~ 48px
  });

  it('Clicking between two gates (midpoints) does not accidentally select any gate', () => {
    // 1. Midpoint between Gate 1 (330°) and Gate 2 (345°)
    const gate1 = gateCoords.find((g) => g.gateNumber === 1)!;
    const gate2 = gateCoords.find((g) => g.gateNumber === 2)!;
    const midX12 = (gate1.x + gate2.x) / 2;
    const midY12 = (gate1.y + gate2.y) / 2;

    const hitBetween12 = findNearestRadarGate(midX12, midY12, DEFAULT_GATE_CLICK_TOLERANCE_PX);
    assert.equal(hitBetween12, null);

    // 2. Midpoint between closest pair: Gate 20 (300°) and Gate 21 (312°)
    const gate20 = gateCoords.find((g) => g.gateNumber === 20)!;
    const gate21 = gateCoords.find((g) => g.gateNumber === 21)!;
    const midX2021 = (gate20.x + gate21.x) / 2;
    const midY2021 = (gate20.y + gate21.y) / 2;

    const hitBetween2021 = findNearestRadarGate(midX2021, midY2021, DEFAULT_GATE_CLICK_TOLERANCE_PX);
    assert.equal(hitBetween2021, null);
  });

  it('Clicking empty radar space returns null', () => {
    // Central cricket pitch
    const centerHit = findNearestRadarGate(RADAR_CENTER_X, RADAR_CENTER_Y);
    assert.equal(centerHit, null);

    // Outer corner (10, 10)
    const cornerHit = findNearestRadarGate(10, 10);
    assert.equal(cornerHit, null);

    // Bottom right corner
    const brHit = findNearestRadarGate(RADAR_CANVAS_WIDTH - 20, RADAR_CANVAS_HEIGHT - 20);
    assert.equal(brHit, null);

    // Intermediate space between pitch and perimeter
    const innerRingHit = findNearestRadarGate(RADAR_CENTER_X + 80, RADAR_CENTER_Y);
    assert.equal(innerRingHit, null);
  });

  it('Canvas scaling and pointer coordinate conversion computes correctly across DOM viewports', () => {
    // 1. Unscaled 1:1 DOM rect at (0, 0)
    const rect1 = { left: 0, top: 0, width: 960, height: 580 };
    const p1 = convertPointerToCanvasCoordinates(480, 300, rect1);
    assert.deepEqual(p1, { x: 480, y: 300 });

    // 2. 50% CSS scaled canvas with viewport offset (e.g. left: 100, top: 50, width: 480, height: 290)
    const rect2 = { left: 100, top: 50, width: 480, height: 290 };
    // Click at clientX = 100 + 240 = 340, clientY = 50 + 150 = 200 (corresponding to canvas x: 480, y: 300)
    const p2 = convertPointerToCanvasCoordinates(340, 200, rect2);
    assert.ok(p2 !== null);
    assert.ok(Math.abs(p2!.x - 480) < 0.1);
    assert.ok(Math.abs(p2!.y - 300) < 0.1);

    // 3. Pointer outside DOM rect boundaries returns null
    const outsideLeft = convertPointerToCanvasCoordinates(50, 100, rect2);
    assert.equal(outsideLeft, null);

    const outsideBottom = convertPointerToCanvasCoordinates(200, 400, rect2);
    assert.equal(outsideBottom, null);

    // 4. Invalid or zero bounding rect returns null
    const zeroRect = { left: 0, top: 0, width: 0, height: 0 };
    assert.equal(convertPointerToCanvasCoordinates(100, 100, zeroRect), null);
  });
});

describe('QA-02: Structured Displacement Audit JSON Export', () => {
  const dummyTelemetry: TelemetryState = {
    peakDensity: 4.8,
    spillbackMeters: 14.2,
    throughputPerMin: 42,
    liveAgents: 185,
    fps: 59,
    isCritical: false,
    threeZone: {
      timestampSec: 180.5,
      systemMaxDensity: 4.8,
      timeIntegratedExposure: 120.4,
      gateApproach: {
        zoneId: 'zone_gate',
        name: 'Zone 1: Gate Approach Area',
        currentDensity: 4.8,
        peakDensity: 5.4,
        averageSpeedMps: 0.32,
        agentCount: 78,
        waitingAgentsCount: 78,
        averageWaitingTimeSec: 24.5,
        queueLengthMeters: 14.2,
        observedThroughputPerMin: 32,
        spillbackMeters: 14.2,
        areaM2: 204,
        warningTriggered: true
      },
      intermediateHolding: {
        zoneId: 'zone_holding',
        name: 'Zone 2: Intermediate Holding Concourse',
        currentDensity: 3.2,
        peakDensity: 3.5,
        averageSpeedMps: 0.85,
        agentCount: 65,
        waitingAgentsCount: 65,
        averageWaitingTimeSec: 8.2,
        queueLengthMeters: 6.0,
        observedThroughputPerMin: 55,
        spillbackMeters: 6.0,
        areaM2: 333,
        warningTriggered: false
      },
      upstreamArrival: {
        zoneId: 'zone_upstream',
        name: 'Zone 3: Upstream Arrival Concourse',
        currentDensity: 2.1,
        peakDensity: 2.3,
        averageSpeedMps: 1.15,
        agentCount: 42,
        waitingAgentsCount: 10,
        averageWaitingTimeSec: 2.1,
        queueLengthMeters: 0,
        observedThroughputPerMin: 60,
        spillbackMeters: 0,
        areaM2: 360,
        warningTriggered: false
      }
    },
    safetyRecommendations: [
      {
        id: 'rec-gate-aux',
        severity: 'critical',
        title: 'Open Auxiliary Gate 3 Bypass',
        reason: 'Gate 2 density at 4.8 p/m² exceeding 4.5 threshold',
        actionText: 'Diverts up to 48% of incoming crowd',
        targetParameter: 'auxGateActive',
        recommendedValue: true
      }
    ],
    simTimeSec: 180.5,
    representedAdmitted: 2450,
    totalAdmittedSim: 184,
    totalGeneratedSim: 369,
    observedThroughputRep: 480
  };

  const dummyComparisonResult: ScenarioComparisonResult = {
    scenarioId: 'safety_intervention',
    seed: 2026,
    baseline: {
      scenarioId: 'safety_intervention',
      seed: 2026,
      totalGeneratedAgents: 2500,
      totalAdmittedAgents: 1850,
      peakLocalDensity: 5.4,
      averageLocalDensity: 3.6,
      spillbackGateAMeters: 18.5,
      spillbackGateBMeters: 0,
      maxQueueSpillbackMeters: 18.5,
      averageWaitingTimeSeconds: 42.1,
      maximumWaitingTimeSeconds: 110.0,
      observedThroughputSimPerMin: 32.5,
      observedThroughputRepPerMin: 432.2,
      theoreticalCapacityRepPerMin: 540.0,
      capacityUtilizationRatio: 0.8,
      congestionEventsCount: 6,
      criticalHazardDurationSeconds: 45.0,
      simulationDurationSeconds: 900,
      actualFps: 60
    },
    mitigated: {
      scenarioId: 'safety_intervention',
      seed: 2026,
      totalGeneratedAgents: 2500,
      totalAdmittedAgents: 2350,
      peakLocalDensity: 3.4,
      averageLocalDensity: 2.5,
      spillbackGateAMeters: 6.2,
      spillbackGateBMeters: 4.1,
      maxQueueSpillbackMeters: 6.2,
      averageWaitingTimeSeconds: 14.5,
      maximumWaitingTimeSeconds: 38.0,
      observedThroughputSimPerMin: 58.0,
      observedThroughputRepPerMin: 771.4,
      theoreticalCapacityRepPerMin: 960.0,
      capacityUtilizationRatio: 0.8,
      congestionEventsCount: 0,
      criticalHazardDurationSeconds: 0,
      simulationDurationSeconds: 900,
      actualFps: 60
    },
    deltas: {
      peakDensityDelta: -2.0,
      peakDensityPercent: -37.0,
      spillbackDelta: -12.3,
      spillbackPercent: -66.5,
      waitingTimeDelta: -27.6,
      waitingTimePercent: -65.6,
      throughputDelta: 339.2,
      throughputPercent: 78.5,
      hazardDurationDelta: -45.0,
      hazardDurationPercent: -100.0
    },
    safetyVerdict: 'Improvement',
    displacementResult: {
      verdict: 'IMPROVED',
      empiricalExplanation: 'Gate 2 approach density reduced by 37% with no holding concourse congestion displacement.',
      baselineSystemMaxDensity: 5.4,
      mitigatedSystemMaxDensity: 3.4,
      gateApproach: {
        zoneId: 'zone_gate',
        name: 'Zone 1: Gate Approach Area',
        baselinePeakDensity: 5.4,
        mitigatedPeakDensity: 3.4,
        densityDeltaPercent: -37.0,
        baselineQueueMeters: 18.5,
        mitigatedQueueMeters: 6.2,
        queueDeltaPercent: -66.5,
        baselineAvgSpeedMps: 0.28,
        mitigatedAvgSpeedMps: 0.75,
        speedDeltaPercent: 167.8
      },
      intermediateHolding: {
        zoneId: 'zone_holding',
        name: 'Zone 2: Intermediate Holding Concourse',
        baselinePeakDensity: 3.1,
        mitigatedPeakDensity: 3.2,
        densityDeltaPercent: 3.2,
        baselineQueueMeters: 5.0,
        mitigatedQueueMeters: 5.5,
        queueDeltaPercent: 10.0,
        baselineAvgSpeedMps: 0.82,
        mitigatedAvgSpeedMps: 0.88,
        speedDeltaPercent: 7.3
      },
      upstreamArrival: {
        zoneId: 'zone_upstream',
        name: 'Zone 3: Upstream Arrival Concourse',
        baselinePeakDensity: 2.2,
        mitigatedPeakDensity: 2.1,
        densityDeltaPercent: -4.5,
        baselineQueueMeters: 0,
        mitigatedQueueMeters: 0,
        queueDeltaPercent: 0,
        baselineAvgSpeedMps: 1.12,
        mitigatedAvgSpeedMps: 1.15,
        speedDeltaPercent: 2.7
      },
      operationalRecommendation: 'Maintain Gate 3 auxiliary bypass operational for all matches exceeding 80% attendance.',
      confidenceScore: 0.95
    },
    empiricalExplanation: 'Paired counterfactual run demonstrates robust crowd relief without displacement.'
  };

  it('buildDisplacementAuditExport includes all required metadata, 3-zone metrics, and paired audit fields', () => {
    const exportData: DisplacementAuditExportData = buildDisplacementAuditExport({
      comparisonResult: dummyComparisonResult,
      telemetry: dummyTelemetry,
      activeScenarioId: 'safety_intervention',
      scenarioName: 'Scenario 6: Safety Lab Ablation',
      activeSchedule: null,
      syntheticEvent: null,
      inflowRate: 180,
      gateLatency: 4.0,
      walkingSpeed: 1.2,
      bafflesActive: true,
      auxGateActive: true,
      opposingFlowPercent: 10,
      physicsValidationMode: false
    });

    // 1. Metadata
    assert.ok(exportData.exportMetadata.system.includes('CROWDWISE'));
    assert.equal(exportData.exportMetadata.venue, 'M. Chinnaswamy Stadium, Bengaluru');
    assert.equal(exportData.exportMetadata.venueCapacity, 35000);
    assert.equal(exportData.exportMetadata.auditStatus, 'PAIRED_COUNTERFACTUAL_COMPLETE');
    assert.ok(exportData.exportMetadata.experimentId.includes('EXP-CHINNASWAMY-SAFETY_INTERVENTION'));

    // 2. Paired Summary & Verdict
    assert.ok(exportData.pairedAuditSummary !== null);
    assert.equal(exportData.pairedAuditSummary!.displacementVerdict, 'IMPROVED');
    assert.equal(exportData.pairedAuditSummary!.confidenceScore, 0.95);
    assert.equal(exportData.pairedAuditSummary!.baselineSystemMaxDensity, 5.4);
    assert.equal(exportData.pairedAuditSummary!.mitigatedSystemMaxDensity, 3.4);
    assert.equal(exportData.pairedAuditSummary!.systemMaxDensityDeltaPercent, -37.0);

    // 3. Three-Zone Measurements
    assert.equal(exportData.threeZoneMeasurements.zone1GateApproach.baselinePeakDensity, 5.4);
    assert.equal(exportData.threeZoneMeasurements.zone1GateApproach.mitigatedPeakDensity, 3.4);
    assert.equal(exportData.threeZoneMeasurements.zone1GateApproach.densityDeltaPercent, -37.0);

    assert.equal(exportData.threeZoneMeasurements.zone2HoldingArea.baselinePeakDensity, 3.1);
    assert.equal(exportData.threeZoneMeasurements.zone2HoldingArea.mitigatedPeakDensity, 3.2);

    assert.equal(exportData.threeZoneMeasurements.zone3UpstreamArrival.baselinePeakDensity, 2.2);

    // 4. Performance & Recommendations
    assert.equal(exportData.simulationPerformance.peakDensity, 4.8);
    assert.equal(exportData.simulationPerformance.maxQueueSpillbackMeters, 14.2);
    assert.equal(exportData.safetyRecommendations.length, 1);
    assert.equal(exportData.safetyRecommendations[0].id, 'rec-gate-aux');

    // 5. JSON Serializability
    const jsonStr = JSON.stringify(exportData);
    assert.ok(jsonStr.length > 500);
    const parsed = JSON.parse(jsonStr);
    assert.equal(parsed.exportMetadata.venueCapacity, 35000);
  });

  it('buildDisplacementAuditExport handles missing comparisonResult gracefully (live snapshot)', () => {
    const exportData = buildDisplacementAuditExport({
      comparisonResult: null, // Paired comparison not yet triggered
      telemetry: dummyTelemetry,
      activeScenarioId: 'metro_surge',
      scenarioName: 'Scenario 2: Metro Surge',
      activeSchedule: null,
      syntheticEvent: null,
      inflowRate: 240,
      gateLatency: 4.5,
      walkingSpeed: 1.3,
      bafflesActive: false,
      auxGateActive: false,
      opposingFlowPercent: 0,
      physicsValidationMode: true
    });

    assert.equal(exportData.exportMetadata.auditStatus, 'LIVE_TELEMETRY_SNAPSHOT');
    assert.equal(exportData.pairedAuditSummary, null);

    // Live measurements populated from telemetry
    assert.equal(exportData.threeZoneMeasurements.zone1GateApproach.currentDensity, 4.8);
    assert.equal(exportData.threeZoneMeasurements.zone2HoldingArea.currentDensity, 3.2);
    assert.equal(exportData.threeZoneMeasurements.zone3UpstreamArrival.currentDensity, 2.1);

    // Baseline fields gracefully undefined
    assert.equal(exportData.threeZoneMeasurements.zone1GateApproach.baselinePeakDensity, undefined);

    // JSON serializes without throw
    const jsonStr = JSON.stringify(exportData);
    assert.ok(jsonStr.includes('LIVE_TELEMETRY_SNAPSHOT'));
  });
});
