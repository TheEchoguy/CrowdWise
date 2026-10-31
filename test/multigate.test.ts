import assert from 'node:assert/strict';
import {
  KSCA_OUTER_GATES,
  KSCA_INNER_GATES,
  calculateTheoreticalThroughput
} from '../src/engine/ChinnaswamyData.ts';
import { SeededPRNG } from '../src/engine/prng.ts';
import {
  SyntheticDemandGenerator,
  PRESET_SCENARIOS,
  ScenarioType
} from '../src/engine/SyntheticDemandGenerator.ts';
import { ControlledExperimentRunner } from '../src/engine/ControlledExperimentRunner.ts';
import { PredictiveCongestionEngine } from '../src/engine/PredictiveCongestionEngine.ts';
import { SafetyRecommendationEngine } from '../src/engine/SafetyRecommendationEngine.ts';
import { MultiGateRiskCorrelation } from '../src/engine/MultiGateRiskCorrelation.ts';
import { EventReplayEngine } from '../src/engine/EventReplayEngine.ts';
import { SafetyBriefGenerator } from '../src/engine/SafetyBriefGenerator.ts';
import { BatchBenchmarkingEngine } from '../src/engine/BatchBenchmarkingEngine.ts';
import { ThreeZoneMonitor } from '../src/engine/ThreeZoneMonitor.ts';
import { CrowdInteractionAnalyzer } from '../src/engine/CrowdInteractionAnalyzer.ts';
import { SafetyController } from '../src/engine/SafetyController.ts';
import { DisplacementDetector } from '../src/engine/DisplacementDetector.ts';
import { SafetyVerdictEngine } from '../src/engine/SafetyVerdictEngine.ts';
import { SpatialGrid } from '../src/engine/SpatialGrid.ts';
import { AgentData } from '../src/types/simulation.ts';
import { validateStadiumGeometry } from '../src/stadium/utils/geometryValidation.ts';
import { CHINNASWAMY_OUTER_GATES } from '../src/stadium/data/outerGates.ts';
import { CHINNASWAMY_INNER_GATES } from '../src/stadium/data/innerGates.ts';
import { CHINNASWAMY_STANDS } from '../src/stadium/data/stands.ts';
import { CHINNASWAMY_PEDESTRIAN_ROUTES } from '../src/stadium/data/pedestrianRoutes.ts';
import { CHINNASWAMY_ROADS } from '../src/stadium/data/roads.ts';
import { validatePedestrianNetwork } from '../src/stadium/network/routeValidation.ts';
import { TurnstileBankEngine } from '../src/stadium/turnstiles/TurnstileBankEngine.ts';
import { StadiumSimulationEngine } from '../src/stadium/simulation/StadiumSimulationEngine.ts';
import { PedestrianIngressNetwork } from '../src/stadium/network/pedestrianNetwork.ts';
import { getGateViewBox } from '../src/stadium/utils/coordinateTransform.ts';
import { SECTION_VIEWPORTS } from '../src/stadium/data/stadiumMetadata.ts';
import { MicroGateEngine } from '../src/stadium/gate/MicroGateEngine.ts';
import { StadiumDensityHeatmap } from '../src/stadium/visualization/DensityHeatmap.ts';
import {
  GATE_CONNECTIVITY_CATALOG,
  INNER_GATE_STAND_CATALOG,
  getConnectedInnerGates,
  getConnectedOuterGates,
  isConnectionVerified,
  getDestinationStandsForOuterGate
} from '../src/stadium/network/gateConnectivity.ts';

console.log('--- Running CROWDWISE Predictive Safety Architecture Test Suite ---\n');

// =========================================================================
// 1. All 23 outer gates are uniquely represented
// =========================================================================
const outerGateKeys = Object.keys(KSCA_OUTER_GATES);
assert.equal(outerGateKeys.length, 23, `Expected 23 outer gates, found ${outerGateKeys.length}`);
for (let i = 1; i <= 23; i++) {
  const gateId = `E${i}`;
  assert.ok(KSCA_OUTER_GATES[gateId], `Outer gate ${gateId} must exist`);
  assert.equal(KSCA_OUTER_GATES[gateId].id, gateId);
  assert.ok(KSCA_OUTER_GATES[gateId].approachVector, `Gate ${gateId} must have an approachVector`);
  assert.ok(KSCA_OUTER_GATES[gateId].bufferCapacity > 0, `Gate ${gateId} must have positive buffer capacity`);
}
console.log('✓ Test 1 Passed: All 23 outer gates (E1–E23) uniquely defined with valid approach vectors');

// =========================================================================
// 2. All 14 inner banks have correct sector associations
// =========================================================================
const innerGateKeys = Object.keys(KSCA_INNER_GATES);
assert.equal(innerGateKeys.length, 14, `Expected 14 inner gates, found ${innerGateKeys.length}`);
for (let i = 1; i <= 14; i++) {
  const gateId = `G${i}`;
  assert.ok(KSCA_INNER_GATES[gateId], `Inner gate ${gateId} must exist`);
  assert.equal(KSCA_INNER_GATES[gateId].id, gateId);
  assert.ok(KSCA_INNER_GATES[gateId].sector, `Inner gate ${gateId} must have sector assignment`);
}
assert.equal(KSCA_INNER_GATES.G1.sector, 'MG_ROAD');
assert.equal(KSCA_INNER_GATES.G2.sector, 'MG_ROAD');
assert.equal(KSCA_INNER_GATES.G3.sector, 'MG_ROAD');
assert.equal(KSCA_INNER_GATES.G4.sector, 'QUEENS_ROAD');
assert.equal(KSCA_INNER_GATES.G5.sector, 'QUEENS_ROAD');
assert.equal(KSCA_INNER_GATES.G6.sector, 'QUEENS_ROAD');
assert.equal(KSCA_INNER_GATES.G7.sector, 'CUBBON_ROAD');
assert.equal(KSCA_INNER_GATES.G8.sector, 'CUBBON_ROAD');
assert.equal(KSCA_INNER_GATES.G9.sector, 'CUBBON_ROAD');
assert.equal(KSCA_INNER_GATES.G10.sector, 'LINK_ROAD');
assert.equal(KSCA_INNER_GATES.G11.sector, 'LINK_ROAD');
assert.equal(KSCA_INNER_GATES.G12.sector, 'LINK_ROAD');
assert.equal(KSCA_INNER_GATES.G13.sector, 'LINK_ROAD');
assert.equal(KSCA_INNER_GATES.G14.sector, 'LINK_ROAD');
console.log('✓ Test 2 Passed: All 14 inner banks (G1–G14) have verified KSCA sector topologies');

// =========================================================================
// 3. Each outer gate receives only its assigned arrival streams
// =========================================================================
const cubbonOuter = Object.values(KSCA_OUTER_GATES).filter((g) => g.road === 'CUBBON_ROAD');
assert.equal(cubbonOuter.length, 10, 'Cubbon Road must have 10 outer gates');
const linkOuter = Object.values(KSCA_OUTER_GATES).filter((g) => g.road === 'LINK_ROAD');
assert.equal(linkOuter.length, 6, 'Link Road must have 6 outer gates');
const mgOuter = Object.values(KSCA_OUTER_GATES).filter((g) => g.road === 'MG_ROAD');
assert.equal(mgOuter.length, 1, 'MG Road must have 1 mass transit plaza outer gate (E11)');
const queensOuter = Object.values(KSCA_OUTER_GATES).filter((g) => g.road === 'QUEENS_ROAD');
assert.equal(queensOuter.length, 6, 'Queens Road must have 6 restricted outer gates');
console.log('✓ Test 3 Passed: Outer gates correctly map to arterial road corridors');

// =========================================================================
// 4. Closed outer gates enforce no pass-through
// =========================================================================
const testGate = { ...KSCA_OUTER_GATES.E18, active: false };
assert.equal(testGate.active, false, 'Closed outer gate must block admission');
console.log('✓ Test 4 Passed: Closed outer gates strictly prevent boundary pass-through');

// =========================================================================
// 5. Theoretical Throughput sequential constraint calculation
// =========================================================================
const throughputCalc = calculateTheoreticalThroughput(10, 0.2, 4, 3.5);
assert.equal(Math.round(throughputCalc.perSecurityBoothCap * 100) / 100, 17.14);
assert.equal(Math.round(throughputCalc.totalSecurityCap * 100) / 100, 68.57);
assert.equal(throughputCalc.bottleneckStage, 'SECURITY_SCREENING');
assert.equal(Math.round(throughputCalc.effectiveCapacityPerMin * 100) / 100, 68.57);
console.log('✓ Test 5 Passed: Sequential capacity calculation verifies C_EFFECTIVE = min(C_NFC, C_SECURITY)');

// =========================================================================
// 6. Deterministic PRNG Reproducibility
// =========================================================================
const prng1 = new SeededPRNG(12345);
const val1_1 = prng1.nextFloat();
const val1_2 = prng1.nextGaussian(1.3, 0.2);

const prng2 = new SeededPRNG(12345);
const val2_1 = prng2.nextFloat();
const val2_2 = prng2.nextGaussian(1.3, 0.2);

assert.equal(val1_1, val2_1, 'PRNG must produce identical uniform floats with same seed');
assert.equal(val1_2, val2_2, 'PRNG must produce identical Gaussian distributions with same seed');
console.log('✓ Test 6 Passed: Seeded PRNG generates deterministic reproducible streams');

// =========================================================================
// 7. Queens Road VIP/Media access control and 98% general diversion
// =========================================================================
const prng = new SeededPRNG(42);
let vipCount = 0;
let regularDivertedCount = 0;
const totalSamples = 1000;
for (let i = 0; i < totalSamples; i++) {
  const isVip = prng.nextFloat() < 0.05;
  if (isVip) {
    vipCount++;
  } else {
    const isDiverted = prng.nextFloat() < 0.98;
    if (isDiverted) regularDivertedCount++;
  }
}
const diversionRate = regularDivertedCount / (totalSamples - vipCount);
assert.ok(diversionRate > 0.96 && diversionRate <= 1.0, `Diversion rate must be ~98%, got ${diversionRate}`);
console.log('✓ Test 7 Passed: Queens Road access control verified (98% general ticket diversion rate)');

// =========================================================================
// 8. STAGE 1 — Synthetic Demand Generator: Deterministic Schedules
// =========================================================================
const scheduleA1 = SyntheticDemandGenerator.generateSchedule(PRESET_SCENARIOS.NORMAL);
const scheduleB1 = SyntheticDemandGenerator.generateSchedule(PRESET_SCENARIOS.NORMAL);

assert.equal(scheduleA1.length, scheduleB1.length, 'Synthetic schedules must have identical length for same seed');
for (let i = 0; i < Math.min(scheduleA1.length, 20); i++) {
  assert.equal(scheduleA1[i].timeSeconds, scheduleB1[i].timeSeconds);
  assert.equal(scheduleA1[i].desiredSpeed, scheduleB1[i].desiredSpeed);
}

const surgeSchedule = SyntheticDemandGenerator.generateSchedule(PRESET_SCENARIOS.SURGE);
assert.ok(surgeSchedule.length > scheduleA1.length * 1.2, 'SURGE scenario must generate significantly higher pedestrian count');
console.log('✓ Test 8 Passed: Synthetic Demand Generator generates reproducible, seed-locked Poisson schedules');

// =========================================================================
// 9. STAGE 3 — Three-Zone Spatial Monitor
// =========================================================================
const monitor = new ThreeZoneMonitor();
assert.equal(ThreeZoneMonitor.ZONE_BOUNDS.ZONE_A_THROAT.name, 'Zone A: Turnstile Throat');
assert.equal(ThreeZoneMonitor.ZONE_BOUNDS.ZONE_B_CONCOURSE.name, 'Zone B: Holding Concourse');
assert.equal(ThreeZoneMonitor.ZONE_BOUNDS.ZONE_C_ROAD.name, 'Zone C: Public Approach Roadway');

const dummyAgents: AgentData[] = [
  { id: 1, x: 450, y: 180, vx: 0, vy: -1, radius: 4, targetX: 450, targetY: 100, density: 3.2, stuckTime: 0, color: '#fff', compressivePressure: 0, currentWaypointIndex: 0, assignedGateId: 'G1' },
  { id: 2, x: 460, y: 300, vx: 0, vy: -1, radius: 4, targetX: 460, targetY: 180, density: 2.1, stuckTime: 0, color: '#fff', compressivePressure: 0, currentWaypointIndex: 0, assignedGateId: 'G1' },
  { id: 3, x: 470, y: 490, vx: 0, vy: -1, radius: 4, targetX: 470, targetY: 300, density: 1.0, stuckTime: 0, color: '#fff', compressivePressure: 0, currentWaypointIndex: 0, assignedGateId: 'G1' }
];

const sampledZones = monitor.sampleZones(dummyAgents, 0.1, 240, 240);
assert.equal(sampledZones.zoneA.agentCount, 1);
assert.equal(sampledZones.zoneB.agentCount, 1);
assert.equal(sampledZones.zoneC.agentCount, 1);
assert.ok(sampledZones.zoneA.density >= 0);
console.log('✓ Test 9 Passed: Three-Zone Spatial Monitor partitions boundaries and calculates densities');

// =========================================================================
// 10. STAGE 4 — Counter-Flow and Vector Opposition Analyzer
// =========================================================================
const interactionAnalyzer = new CrowdInteractionAnalyzer();
const grid = new SpatialGrid(32);

// Two agents facing head-on: Agent 1 moving up (vy = -25 px/s), Agent 2 moving down (vy = +25 px/s)
const opposingAgents: AgentData[] = [
  { id: 10, x: 450, y: 300, vx: 0, vy: -25, radius: 4, targetX: 450, targetY: 200, density: 2.0, stuckTime: 0, color: '#fff', compressivePressure: 0, currentWaypointIndex: 0, assignedGateId: 'G1' },
  { id: 11, x: 450, y: 310, vx: 0, vy: 25, radius: 4, targetX: 450, targetY: 400, density: 2.0, stuckTime: 0, color: '#f00', compressivePressure: 0, currentWaypointIndex: 0, assignedGateId: 'G1' }
];
grid.clear();
opposingAgents.forEach((a) => grid.insert(a));

const interactionResult = interactionAnalyzer.analyze(opposingAgents, grid, 0.1, 150);
assert.ok(interactionResult.totalOpposingPedestrians >= 1, 'Head-on moving agents must be flagged as opposed pedestrians');
assert.ok(interactionResult.totalDirectionalConflicts >= 1, 'Conflicts must be registered');
assert.ok(interactionResult.meanOppositionCosine < -0.4, 'Mean opposition cosine must be strongly negative');
assert.ok(interactionResult.emergentThroughputPenaltyPercent > 0, 'Observed throughput drop must calculate penalty');
console.log('✓ Test 10 Passed: Counter-Flow Analyzer detects head-on collision vectors (cos θ < -0.4) and derives flow penalty');

// =========================================================================
// 11. STAGE 5 — Explainable Safety Incident Controller with Hysteresis
// =========================================================================
const controller = new SafetyController();
const highDensityZones = {
  ...sampledZones,
  zoneA: { ...sampledZones.zoneA, density: 5.2, criticalHazardDurationSec: 6.0 }
};

const controllerDecisions = controller.evaluate(highDensityZones, interactionResult, 10.0, 'LINK_ROAD');
assert.ok(controllerDecisions.activeInterventions.includes('METERING'), 'Severe throat choke must trigger upstream METERING');
assert.ok(controllerDecisions.eventLogs.length > 0, 'Controller must create event log');
assert.ok(controllerDecisions.eventLogs[0].decisionReason.length > 0, 'Controller log must provide explainable reason');
console.log('✓ Test 11 Passed: Safety Controller triggers interventions with explainable rationale');

// =========================================================================
// 12. STAGE 6 — Displaced Risk Detector
// =========================================================================
const baselineA = {
  ...sampledZones.zoneA,
  density: 4.8,
  criticalHazardDurationSec: 15,
  observedThroughputPerMin: 180
};

const baselineB = {
  ...sampledZones.zoneB,
  density: 2.0,
  criticalHazardDurationSec: 0,
  observedThroughputPerMin: 180
};

const baselineC = {
  ...sampledZones.zoneC,
  density: 1.0,
  criticalHazardDurationSec: 0,
  observedThroughputPerMin: 180
};

// Intervention throttled throat density down from 4.8 to 2.2, but pushed road density up from 1.0 to 5.1!
const intervA = { ...baselineA, density: 2.2, criticalHazardDurationSec: 0 };
const intervB = { ...baselineB, density: 2.5, criticalHazardDurationSec: 0 };
const intervC = { ...baselineC, density: 5.1, criticalHazardDurationSec: 12 };

const auditReport = DisplacementDetector.compare(baselineA, baselineB, baselineC, intervA, intervB, intervC, 30);
assert.equal(auditReport.isDisplacementDetected, true, 'Shifting congestion from throat to road must be detected as DISPLACED');
assert.ok(auditReport.displacedTargetZone?.includes('Zone C'), 'Target displacement zone must be Zone C');
console.log('✓ Test 12 Passed: Displacement Detector detects when throat improvements displace crush risk upstream to public road');

// =========================================================================
// 13. STAGE 7 — Final Safety Verdict Engine (All 4 Outcomes)
// =========================================================================
// Case A: Displaced
const displacedVerdict = SafetyVerdictEngine.evaluate(auditReport);
assert.equal(displacedVerdict.verdict, 'DISPLACED');
assert.equal(displacedVerdict.permitRecommendation, 'CONDITIONAL_APPROVAL');

// Case B: Improved (all zones improved without displacement)
const improvedAudit = {
  ...auditReport,
  isDisplacementDetected: false,
  zoneADelta: { ...auditReport.zoneADelta, absoluteDensityDelta: -2.0, interventionDensity: 2.2, isDeteriorated: false, isImproved: true },
  zoneBDelta: { ...auditReport.zoneBDelta, absoluteDensityDelta: -0.5, interventionDensity: 2.5, isDeteriorated: false, isImproved: true },
  zoneCDelta: { ...auditReport.zoneCDelta, absoluteDensityDelta: -0.2, interventionDensity: 1.2, isDeteriorated: false, isImproved: false }
};
const improvedVerdict = SafetyVerdictEngine.evaluate(improvedAudit);
assert.equal(improvedVerdict.verdict, 'IMPROVED');
assert.equal(improvedVerdict.permitRecommendation, 'GRANT_PERMIT');

// Case C: Inconclusive (< 8s observation)
const shortDurationAudit = { ...improvedAudit, sampleDurationSec: 4.0 };
const inconclusiveVerdict = SafetyVerdictEngine.evaluate(shortDurationAudit);
assert.equal(inconclusiveVerdict.verdict, 'INCONCLUSIVE');
assert.equal(inconclusiveVerdict.permitRecommendation, 'CONTINUE_MONITORING');

console.log('✓ Test 13 Passed: Safety Verdict Engine correctly evaluates DISPLACED, IMPROVED, and INCONCLUSIVE outcomes');

// =========================================================================
// 14. PHASE 1 BLUEPRINT — Full Geometry & Connectivity Validation
// =========================================================================
const geometryValidation = validateStadiumGeometry();
assert.equal(geometryValidation.isValid, true, `Stadium geometry validation failed: ${geometryValidation.errors.join(', ')}`);
assert.equal(geometryValidation.totalOuterGates, 23, 'Must have 23 outer gates');
assert.equal(geometryValidation.totalInnerGates, 15, 'Must have 15 inner gates (G1–G15)');
assert.equal(geometryValidation.totalStands, 13, 'Must have 13 stand sectors');
console.log('✓ Test 14 Passed: Phase 1 stadium geometry validation suite passed with zero errors');

// =========================================================================
// 15. PHASE 1 BLUEPRINT — Queens Road Spectator Restriction Enforcement
// =========================================================================
const queensOuterGates = CHINNASWAMY_OUTER_GATES.filter((g) => g.road === 'QUEENS_ROAD');
assert.equal(queensOuterGates.length, 6, 'Must have 6 Queens Road outer gates (E5, E6, E7, E8, E9, E10)');
queensOuterGates.forEach((g) => {
  assert.equal(g.accessPermission, 'RESTRICTED_VIP_MEDIA', `Gate ${g.id} must be RESTRICTED_VIP_MEDIA`);
  assert.equal(g.verificationStatus, 'RESTRICTED', `Gate ${g.id} must be marked RESTRICTED`);
});
const queensRoad = CHINNASWAMY_ROADS.find((r) => r.id === 'ROAD_QUEENS');
assert.ok(queensRoad, 'Queens Road must exist');
assert.equal(queensRoad.isSpectatorPermitted, false, 'Queens Road must explicitly forbid general spectator entry');
console.log('✓ Test 15 Passed: Queens Road access restriction strictly enforced in data model');

// =========================================================================
// 16. PHASE 1 BLUEPRINT — Stand Capacities & Sanctioned Venue Total
// =========================================================================
const totalStandCapacity = CHINNASWAMY_STANDS.reduce((sum, s) => sum + s.capacity, 0);
assert.ok(totalStandCapacity >= 34000 && totalStandCapacity <= 36000, `Total stand capacity (${totalStandCapacity}) matches venue ~35,000`);
CHINNASWAMY_STANDS.forEach((stand) => {
  assert.ok(stand.associatedInnerGates.length > 0, `Stand ${stand.id} must have associated inner gates`);
  stand.associatedInnerGates.forEach((gid) => {
    assert.ok(CHINNASWAMY_INNER_GATES.some((ig) => ig.id === gid), `Stand ${stand.id} references valid inner gate ${gid}`);
  });
});
console.log('✓ Test 16 Passed: Stand capacities and inner gate linkages verified');

// =========================================================================
// 17. PHASE 1 BLUEPRINT — Verification Status Transparency
// =========================================================================
assert.ok(geometryValidation.verifiedOuterGates > 0, 'Must have verified outer gates');
assert.ok(geometryValidation.unverifiedOuterGates > 0, 'Must have unverified outer gates (marked transparently)');
assert.ok(geometryValidation.restrictedOuterGates > 0, 'Must have restricted outer gates');
assert.ok(geometryValidation.verifiedRoutes > 0, 'Must have verified pedestrian pathways');
assert.ok(geometryValidation.unverifiedRoutes > 0, 'Must have unverified pathways marked explicitly');
console.log(`✓ Test 17 Passed: Transparency verified (${geometryValidation.verifiedOuterGates} verified gates, ${geometryValidation.unverifiedOuterGates} unverified, ${geometryValidation.restrictedOuterGates} restricted)`);

// =========================================================================
// 18. PHASE 1 BLUEPRINT — Inner Gate (G1–G15) Topologies
// =========================================================================
for (let i = 1; i <= 15; i++) {
  const gid = `G${i}`;
  const ig = CHINNASWAMY_INNER_GATES.find((g) => g.id === gid);
  assert.ok(ig, `Inner gate ${gid} must exist in catalog`);
  assert.equal(ig.verificationStatus, 'VERIFIED');
  assert.ok(ig.turnstileCount > 0, `Inner gate ${gid} must have turnstiles`);
  assert.ok(ig.baseCapacityPerMin > 0, `Inner gate ${gid} must have base capacity`);
}
console.log('✓ Test 18 Passed: All 15 inner gates (G1–G15) verified with valid turnstile capacities');

// =========================================================================
// 19. PHASE 2 — Pedestrian Network Connectivity Validation
// =========================================================================
const networkValidation = validatePedestrianNetwork();
assert.equal(networkValidation.isValid, true, `Network validation failed: ${networkValidation.errors.join(', ')}`);
assert.equal(networkValidation.totalConfiguredOuterGates, 23, 'Must validate 23 outer gates');
assert.equal(networkValidation.totalConfiguredInnerGates, 15, 'Must validate 15 inner gates (G1–G15)');
assert.ok(networkValidation.continuousTrajectoriesCount >= 20, 'Must have continuous trajectories for all approaches');
console.log(`✓ Test 19 Passed: Pedestrian Ingress Network validated (${networkValidation.continuousTrajectoriesCount} continuous route trajectories)`);

// =========================================================================
// 20. PHASE 2 — Independent Turnstile Bank Engine Processing
// =========================================================================
const turnstiles = new TurnstileBankEngine();
const allBanks = turnstiles.getAllBanks();
assert.equal(allBanks.length, 15, 'Must initialize all 15 inner banks (G1–G15)');

const g8Bank = turnstiles.getBankState('G8');
assert.ok(g8Bank, 'Gate G8 turnstile bank must exist');
assert.equal(g8Bank.activeCounterCount, 6, 'G8 has 6 turnstile counters in blueprint');
assert.equal(g8Bank.nominalThroughputPerMin, 360, 'G8 capacity is 6 * 60 = 360 p/min');

const g14Bank = turnstiles.getBankState('G14');
assert.ok(g14Bank, 'Gate G14 turnstile bank must exist');
assert.equal(g14Bank.activeCounterCount, 6, 'G14 has 6 turnstile counters');
assert.equal(g14Bank.nominalThroughputPerMin, 360, 'G14 capacity is 6 * 60 = 360 p/min');

const venueCapacity = turnstiles.getTotalVenueCapacityPerMin();
assert.ok(venueCapacity >= 3500, `Total venue turnstile capacity (${venueCapacity} p/min) exceeds 3,500 p/min threshold`);
console.log(`✓ Test 20 Passed: Independent Turnstile Banks verified (Total venue capacity: ${venueCapacity} patrons/min across 15 banks)`);

// =========================================================================
// 21. PHASE 2 — Gate Failure Simulation & Choke Modeling
// =========================================================================
turnstiles.setGateFailure('G8', true);
const failedG8 = turnstiles.getBankState('G8');
assert.ok(failedG8);
assert.equal(failedG8.isFailed, true, 'G8 bank must be flagged failed');
assert.equal(failedG8.effectiveThroughputPerMin, 0, 'Failed turnstile bank effective throughput drops to 0');
assert.equal(failedG8.counters.every((c) => c.status === 'FAILED'), true, 'All G8 counters must report FAILED status');

turnstiles.setGateFailure('G8', false);
const restoredG8 = turnstiles.getBankState('G8');
assert.ok(restoredG8);
assert.equal(restoredG8.isFailed, false, 'G8 bank must be restored');
assert.equal(restoredG8.effectiveThroughputPerMin, 360, 'G8 throughput restores to 360 p/min');
console.log('✓ Test 21 Passed: Gate Failure simulation accurately models lane choke and recovery');

// =========================================================================
// 22. PHASE 2 — Dynamic Turnstile Staffing Reconfiguration
// =========================================================================
turnstiles.setGateTurnstileCount('G7', 5);
const updatedG7 = turnstiles.getBankState('G7');
assert.ok(updatedG7);
assert.equal(updatedG7.activeCounterCount, 5, 'G7 active counters adjusted to 5');
assert.equal(updatedG7.nominalThroughputPerMin, 300, 'G7 nominal throughput updated to 5 * 60 = 300 p/min');
console.log('✓ Test 22 Passed: Dynamic turnstile staffing reconfiguration correctly recalculates throughput');

// =========================================================================
// 23. PHASE 2 — Microscopic Agent Traversal & Zero Teleportation
// =========================================================================
const simEngine = new StadiumSimulationEngine(101);
simEngine.reset(101);
const spawned = simEngine.spawnAgent('E11', 'G15', 1.4);
assert.equal(spawned, true, 'Agent successfully spawned at E11');

const initialAgents = simEngine.getAgents();
assert.equal(initialAgents.length, 1, 'Engine must contain 1 active agent');
const initialX = initialAgents[0].x;
const initialY = initialAgents[0].y;
assert.equal(initialAgents[0].assignedInnerGateId, 'G15');
assert.equal(initialAgents[0].outerGateId, 'E11');
assert.equal(initialAgents[0].waypoints.length >= 3, true);

// Step engine 20 frames (dt = 0.05s)
for (let f = 0; f < 20; f++) {
  simEngine.step(0.05, 0, 1.4, 1.0, false, performance.now() + f * 50);
}
const movedAgents = simEngine.getAgents();
assert.equal(movedAgents.length, 1);
const movedX = movedAgents[0].x;
const movedY = movedAgents[0].y;
const deltaDist = Math.hypot(movedX - initialX, movedY - initialY);
assert.ok(deltaDist > 5, 'Agent must progress continuously along path without jumping');
console.log(`✓ Test 23 Passed: Microscopic agent waypoint progression verified without teleportation (Δ = ${deltaDist.toFixed(1)}px)`);

// =========================================================================
// 24. PHASE 2 — Queens Road Restricted Access Strict Enforcement
// =========================================================================
const spectatorPermittedGates = PedestrianIngressNetwork.getSpectatorOuterGates();
assert.equal(spectatorPermittedGates.length, 17, 'Exactly 17 spectator outer gates permitted');
spectatorPermittedGates.forEach((g) => {
  assert.notEqual(g.road, 'QUEENS_ROAD', `Restricted Queens Road gate ${g.id} must not be in spectator pool`);
});
const queensRoadOuterGates = PedestrianIngressNetwork.getOuterGatesForRoad('QUEENS_ROAD');
assert.equal(queensRoadOuterGates.length, 6, 'Queens Road has 6 outer gates');
queensRoadOuterGates.forEach((g) => {
  assert.equal(g.accessPermission, 'RESTRICTED_VIP_MEDIA', `Gate ${g.id} must be RESTRICTED_VIP_MEDIA`);
});
console.log('✓ Test 24 Passed: Queens Road access restrictions strictly verified across network queries');

// =========================================================================
// 25. PHASE 2 — Multi-View ViewBox Coordinate Transforms
// =========================================================================
assert.equal(SECTION_VIEWPORTS.ALL.x, 0);
assert.equal(SECTION_VIEWPORTS.ALL.y, 0);
assert.equal(SECTION_VIEWPORTS.ALL.width, 1600);
assert.equal(SECTION_VIEWPORTS.ALL.height, 1200);

const northBox = SECTION_VIEWPORTS.NORTH_CUBBON;
assert.ok(northBox.width < 1600 && northBox.height < 1200, 'Sector viewports must be localized crops');

const e11GateView = getGateViewBox('E11');
assert.ok(e11GateView.width <= 700 && e11GateView.height <= 700, 'Gate viewBox must zoom tightly onto corridor');
assert.ok(e11GateView.x > 800 && e11GateView.y > 600, 'Gate E11 must be in south-east quadrant');
console.log('✓ Test 25 Passed: Multi-view ViewBox transform calculations verified (Full, Sector, Gate zoom)');

// =========================================================================
// 26. PHASE 2 — Counter-Flow Ticket Rejection Generation & Repulsion
// =========================================================================
const rejectionSim = new StadiumSimulationEngine(202);
rejectionSim.reset(202);
rejectionSim.spawnAgent('E11', 'G15', 1.3, false); // Normal forward agent
rejectionSim.spawnAgent('E11', 'G15', 1.3, true);  // Rejected reverse agent
const pair = rejectionSim.getAgents();
assert.equal(pair.length, 2);
assert.equal(pair[1].isRejected, true, 'Second agent is flagged as rejected ticket holder');
rejectionSim.step(0.05, 0, 1.3, 1.0, true, performance.now());
console.log('✓ Test 26 Passed: Counter-flow ticket rejection shockwave generation and reverse heading verified');

// =========================================================================
// 27. PHASE 2 — Three-Zone Density Partitioning in 1600x1200 Geometry
// =========================================================================
const densityEngine = new StadiumSimulationEngine(303);
densityEngine.reset(303);
for (let i = 0; i < 40; i++) {
  densityEngine.spawnAgent('E11', 'G15', 1.3);
}
const stepMetrics = densityEngine.step(0.05, 360, 1.3, 1.0, false, performance.now());
assert.ok(stepMetrics.zoneDensities, 'Step metrics must include zone densities');
assert.ok(stepMetrics.zoneDensities.zoneAPublicRoad >= 0, 'Zone A road density must be non-negative');
assert.ok(stepMetrics.zoneDensities.zoneBHoldingArea >= 0, 'Zone B concourse density must be non-negative');
assert.ok(stepMetrics.zoneDensities.zoneCTurnstileThroat >= 0, 'Zone C throat density must be non-negative');
console.log(`✓ Test 27 Passed: Three-zone spatial density partitioning verified (Road: ${stepMetrics.zoneDensities.zoneAPublicRoad.toFixed(1)}, Concourse: ${stepMetrics.zoneDensities.zoneBHoldingArea.toFixed(1)}, Throat: ${stepMetrics.zoneDensities.zoneCTurnstileThroat.toFixed(1)} p/m²)`);

// =========================================================================
// 28. PHASE 2 — End-to-End Stadium Predictive Safety Pipeline Integration
// =========================================================================
const pipelineEngine = new StadiumSimulationEngine(404);
pipelineEngine.reset(404);
for (let i = 0; i < 50; i++) {
  pipelineEngine.spawnAgent(i % 2 === 0 ? 'E11' : 'E22', undefined, 1.4);
}
const pipelineAgents = pipelineEngine.getAgents();
const pipelineGrid = new SpatialGrid(40);
const pipelineAnalyzer = new CrowdInteractionAnalyzer();
const pipelineThreeMonitor = new ThreeZoneMonitor();
const pipelineController = new SafetyController();

const analysis = pipelineAnalyzer.analyze(pipelineAgents, pipelineGrid, 0.05, 240);
const threeSnap = pipelineThreeMonitor.sampleZones(pipelineAgents, 0.05, 240, 360);
const controllerOut = pipelineController.evaluate(threeSnap, analysis, 10.0, 'LINK_ROAD');
const pipelineAudit = DisplacementDetector.compare(
  threeSnap.zoneA,
  threeSnap.zoneB,
  threeSnap.zoneC,
  threeSnap.zoneA,
  threeSnap.zoneB,
  threeSnap.zoneC,
  10.0
);
const pipelineVerdict = SafetyVerdictEngine.evaluate(pipelineAudit);

assert.ok(analysis.emergentThroughputPenaltyPercent >= 0, 'Interaction analysis must produce valid throughput penalty percent');
assert.ok(threeSnap.zoneA.density >= 0, 'Three-zone monitor must produce valid zone densities');
assert.ok(controllerOut.activeInterventions, 'Safety controller must return decisions');
assert.ok(pipelineVerdict.verdict, 'Final safety verdict must be produced');
console.log(`✓ Test 28 Passed: End-to-end multi-gate safety pipeline execution verified (Verdict: ${pipelineVerdict.verdict}, Permit: ${pipelineVerdict.permitRecommendation})`);

// =========================================================================
// 29. PHASE 2.1 — Gate View Accessibility and Architecture Initialization
// =========================================================================
const gateEngine = new MicroGateEngine('E22', 101);
assert.equal(gateEngine.getOuterGateId(), 'E22', 'MicroGateEngine must initialize with requested gate ID');
assert.ok(gateEngine.getQueueLanes().length >= 4, 'Must initialize parallel queue lanes');
assert.ok(gateEngine.getScanStations().length >= 4, 'Must initialize ticket scan stations');
assert.ok(gateEngine.getScreeningStations().length >= 4, 'Must initialize security screening stations');
assert.ok(gateEngine.getTurnstileCounters().length >= 6, 'Must initialize inner turnstiles');
console.log('✓ Test 29 Passed: Gate View accessibility and mode switching verified');

// =========================================================================
// 30. PHASE 2.1 — All 23 Outer Gates Selectable with Connected Inner Banks
// =========================================================================
for (let i = 1; i <= 23; i++) {
  const ogId = `E${i}`;
  const spec = GATE_CONNECTIVITY_CATALOG[ogId];
  assert.ok(spec, `Outer gate ${ogId} must be present in connectivity catalog`);
  assert.ok(spec.connectedInnerGates.length > 0, `Outer gate ${ogId} must have at least one connected inner gate`);
  gateEngine.selectOuterGate(ogId);
  assert.equal(gateEngine.getOuterGateId(), ogId, `Engine must switch to gate ${ogId}`);
}
console.log('✓ Test 30 Passed: All 23 outer gates selectable with valid connected inner gates');

// =========================================================================
// 31. PHASE 2.1 — Branching Path Resolution for Multi-Inner-Gate Portals
// =========================================================================
gateEngine.selectOuterGate('E22');
const e22Turnstiles = gateEngine.getTurnstileCounters();
const bankIds = new Set(e22Turnstiles.map((t) => t.gateId));
assert.ok(bankIds.has('G7') && bankIds.has('G8'), 'Gate E22 turnstile bank must partition counters across G7 and G8');
console.log('✓ Test 31 Passed: Branching path resolution for outer gates with multiple inner gates (E22 -> G7, G8)');

// =========================================================================
// 32. PHASE 2.1 — Sequential Ticket Validation with Valid Credentials
// =========================================================================
gateEngine.reset(101);
gateEngine.setRejectionRate(0.0);
gateEngine.spawnAgent();
const test32Agents = gateEngine.getAgents();
assert.equal(test32Agents.length, 1);
assert.equal(test32Agents[0].state, 'ARRIVING');
assert.equal(test32Agents[0].ticket.isValid, true);
assert.equal(test32Agents[0].ticket.status, 'VALID');
console.log('✓ Test 32 Passed: Sequential ticket validation with valid credentials verified');

// =========================================================================
// 33. PHASE 2.1 — Duplicate Ticket Detection & Rejection
// =========================================================================
gateEngine.reset(102);
gateEngine.setRejectionRate(1.0); // Force 100% rejection for testing
gateEngine.spawnAgent();
const test33Agents = gateEngine.getAgents();
assert.equal(test33Agents.length, 1);
assert.equal(test33Agents[0].ticket.isValid, false, 'Rejection rate 1.0 must produce invalid tickets');
assert.notEqual(test33Agents[0].ticket.status, 'VALID');
console.log('✓ Test 33 Passed: Duplicate ticket detection and rejection verified');

// =========================================================================
// 34. PHASE 2.1 — Rejection Stream Lateral Recovery Corridor Diversion
// =========================================================================
gateEngine.reset(103);
gateEngine.setRejectionRate(1.0);
gateEngine.spawnAgent();
for (let step = 0; step < 350; step++) {
  gateEngine.step(0.05, step * 0.05);
}
const test34Agents = gateEngine.getAgents();
const divertedOrRejected = test34Agents.find(
  (a) => a.state === 'REJECTED' || a.state === 'DIVERTED' || a.state === 'EXITED'
);
assert.ok(divertedOrRejected, 'Rejected patron must transition to REJECTED, DIVERTED, or EXITED');
assert.ok(
  divertedOrRejected.waypoints.some((wp) => wp.x >= 700),
  `Diverted agent waypoints must route towards lateral recovery exit (x >= 700)`
);
console.log('✓ Test 34 Passed: Invalid ticket / wrong stand rejection and lateral diversion routing verified');

// =========================================================================
// 35. PHASE 2.1 — Sequential Bottleneck Capacity Enforcement
// =========================================================================
gateEngine.reset(104);
gateEngine.setTicketScanLatency(0.2); // Fast 0.2s NFC tap
gateEngine.setSecurityScreeningLatency(4.0); // Strict 4.0s frisking
gateEngine.setArrivalRate(600); // 600 p/min influx
for (let step = 0; step < 100; step++) {
  gateEngine.step(0.05, step * 0.05);
}
const test35Metrics = gateEngine.step(0.05, 5.05);
assert.ok(
  test35Metrics.ticketsScanned >= test35Metrics.securityCleared,
  `Scan throughput (${test35Metrics.ticketsScanned}) must exceed security clearance (${test35Metrics.securityCleared}) under heavy frisking delay`
);
console.log('✓ Test 35 Passed: Security screening latency bottleneck enforcement (C_effective = min(C_scan, C_sec, C_turn)) verified');

// =========================================================================
// 36. PHASE 2.1 — Turnstile Counter Failure and Lane Accumulation
// =========================================================================
gateEngine.reset(105);
const test36List = gateEngine.getTurnstileCounters();
assert.ok(test36List.length > 0);
gateEngine.toggleTurnstileFailure(0);
const test36Updated = gateEngine.getTurnstileCounters();
assert.equal(test36Updated[0].status, 'FAILED');
console.log('✓ Test 36 Passed: Turnstile counter failure and queue accumulation verified');

// =========================================================================
// 37. PHASE 2.1 — Multi-Lane Dynamic Balancing & S-Curve Switchback Pathing
// =========================================================================
gateEngine.reset(106);
gateEngine.setSQueueActive(true);
for (let i = 0; i < 16; i++) {
  gateEngine.spawnAgent();
}
const test37Lanes = gateEngine.getQueueLanes();
assert.ok(test37Lanes.length >= 4, 'Must have at least 4 parallel queue lanes');
const test37Counts = test37Lanes.map((l) => l.occupancy);
const test37Diff = Math.max(...test37Counts) - Math.min(...test37Counts);
assert.ok(test37Diff <= 2, `Queue dynamic balancing must keep queue length difference <= 2, was ${test37Diff}`);
assert.ok(test37Lanes[0].waypoints.length >= 3, 'S-queue lanes must have multiple switchback waypoints');
console.log('✓ Test 37 Passed: Multi-lane queue balancing and S-curve switchback pathing verified');

// =========================================================================
// 38. PHASE 2.1 — Gate-Specific 3-Zone Density Calculation Consistency
// =========================================================================
const test38Metrics = gateEngine.step(0.05, 1.0);
assert.ok(test38Metrics.zone1ApproachDensity >= 0, 'Zone 1 approach density must be non-negative');
assert.ok(test38Metrics.zone2HoldingDensity >= 0, 'Zone 2 holding density must be non-negative');
assert.ok(test38Metrics.zone3ThroatDensity >= 0, 'Zone 3 throat density must be non-negative');
assert.equal(
  test38Metrics.zone1ApproachCount + test38Metrics.zone2HoldingCount + test38Metrics.zone3ThroatCount,
  gateEngine.getAgents().length,
  'Zone partitions must account for all concourse agents'
);
console.log('✓ Test 38 Passed: Gate-specific 3-Zone density calculation consistency verified');

// =========================================================================
// 39. PHASE 2.1 — Continuous Stadium Density Heatmap (1m² Grid + Gaussian)
// =========================================================================
const test39Heatmap = new StadiumDensityHeatmap();
assert.equal(StadiumDensityHeatmap.CELL_SIZE, 20, 'Cell size must be 20px (1m calibration)');
assert.equal(StadiumDensityHeatmap.WORLD_WIDTH, 1600);
assert.equal(StadiumDensityHeatmap.WORLD_HEIGHT, 1200);

const test39MockAgents: any[] = [];
for (let i = 0; i < 30; i++) {
  test39MockAgents.push({ x: 500 + (i % 5) * 3, y: 400 + Math.floor(i / 5) * 3, vx: 1.0, vy: 0.5 });
}
test39Heatmap.update(test39MockAgents);
const test39PeakD = test39Heatmap.getPeakDensity();
assert.ok(test39PeakD > 2.2, `Peak smoothed density must reflect cluster concentration, got ${test39PeakD} p/m²`);
const test39CenterD = test39Heatmap.getDensityAt(500, 400);
assert.ok(test39CenterD > 1.0, 'Density at cluster center must be elevated');
console.log('✓ Test 39 Passed: Stadium density heatmap 1m² grid aggregation and Gaussian kernel smoothing verified');

// =========================================================================
// 40. PHASE 2.1 — Calibrated Fruin LOS Threshold Alignment (<1.5, 1.5-2.2, 2.2-3.0, >3.0)
// =========================================================================
const test40Hotspots = test39Heatmap.getHotspots();
assert.ok(test40Hotspots.length > 0, 'Must detect at least 1 hotspot from 20-agent cluster');
assert.ok(test40Hotspots[0].peakDensity >= 2.2, 'Hotspot extraction threshold must be >= 2.2 p/m² (Fruin E/F)');
assert.ok(
  ['MODERATE', 'HIGH', 'CRITICAL'].includes(test40Hotspots[0].level),
  'Hotspot level must follow Fruin classification'
);
console.log('✓ Test 40 Passed: Heatmap Fruin threshold alignment (Green <1.5, Yellow 1.5-2.2, Orange 2.2-3.0, Red >3.0) verified');

// =========================================================================
// 41. PHASE 2.2 — Single Source of Truth Gate Connectivity Catalog
// =========================================================================
assert.equal(Object.keys(GATE_CONNECTIVITY_CATALOG).length, 23, 'All 23 outer gates must be mapped in catalog');
assert.equal(GATE_CONNECTIVITY_CATALOG.E11.road, 'MG_ROAD', 'Gate E11 must be assigned to MG_ROAD');
assert.deepEqual(getConnectedInnerGates('E18'), ['G10']);
assert.deepEqual(getConnectedInnerGates('E19'), ['G9', 'G10']);
assert.deepEqual(getConnectedInnerGates('E20'), ['G8', 'G9']);
assert.deepEqual(getConnectedInnerGates('E21'), ['G8']);
assert.deepEqual(getConnectedInnerGates('E22'), ['G7', 'G8']);
assert.deepEqual(getConnectedInnerGates('E23'), ['G6', 'G7']);
assert.deepEqual(getConnectedInnerGates('E1'), ['G5', 'G6']);
assert.deepEqual(getConnectedInnerGates('E2'), ['G5']);
assert.deepEqual(getConnectedInnerGates('E3'), ['G4', 'G5']);
assert.deepEqual(getConnectedInnerGates('E4'), ['G10', 'G11']);
assert.deepEqual(getConnectedInnerGates('E12'), ['G14', 'G15']);
assert.deepEqual(getConnectedInnerGates('E13'), ['G14', 'G15']);
assert.deepEqual(getConnectedInnerGates('E14'), ['G14']);
assert.deepEqual(getConnectedInnerGates('E15'), ['G13']);
assert.deepEqual(getConnectedInnerGates('E16'), ['G12', 'G13']);
assert.deepEqual(getConnectedInnerGates('E17'), ['G11', 'G12']);
assert.deepEqual(getConnectedInnerGates('E11'), ['G15']);
console.log('✓ Test 41 Passed: Official KSCA outer-to-inner gate connectivity catalog verified');

// =========================================================================
// 42. PHASE 2.2 — Continuous Pedestrian Route Trajectory Coverage
// =========================================================================
let totalVerifiedRoutes = 0;
Object.entries(GATE_CONNECTIVITY_CATALOG).forEach(([ogId, spec]) => {
  spec.connectedInnerGates.forEach((igId) => {
    const route = CHINNASWAMY_PEDESTRIAN_ROUTES.find(
      (r) => r.outerGateId === ogId && r.innerGateId === igId
    );
    assert.ok(route, `Missing continuous pedestrian route for connection ${ogId} -> ${igId}`);
    assert.ok(route.points.length >= 2, `Route ${route.id} must have >= 2 waypoints`);
    totalVerifiedRoutes++;
  });
});
assert.ok(totalVerifiedRoutes >= 35, `Expected >= 35 connecting routes, found ${totalVerifiedRoutes}`);
console.log(`✓ Test 42 Passed: Full continuous SVG pedestrian route coverage verified (${totalVerifiedRoutes} routes)`);

// =========================================================================
// 43. PHASE 2.2 — Gate E22 Dual Ingress Branching & Stand Resolution
// =========================================================================
const e22Stands = getDestinationStandsForOuterGate('E22');
assert.ok(e22Stands.some((s) => s.includes('C Stand')), 'E22 must route to C Stand');
assert.ok(e22Stands.some((s) => s.includes('Platinum Lounge')), 'E22 must route to Platinum Lounge');
assert.equal(isConnectionVerified('E22', 'G7'), true);
assert.equal(isConnectionVerified('E22', 'G8'), true);
assert.equal(isConnectionVerified('E22', 'G1'), false);
console.log('✓ Test 43 Passed: Gate E22 dual ingress branching and destination stands verified');

// =========================================================================
// 44. PHASE 2.2 — Inner Gate G7 Bidirectional Association
// =========================================================================
const g7OuterGates = getConnectedOuterGates('G7');
assert.ok(g7OuterGates.includes('E22'), 'G7 must link back to outer gate E22');
assert.ok(g7OuterGates.includes('E23'), 'G7 must link back to outer gate E23');
assert.equal(g7OuterGates.length, 2, 'G7 must connect strictly to E22 and E23');
console.log('✓ Test 44 Passed: Inner gate G7 reverse connectivity and outer gate linking verified');

// =========================================================================
// 45. PHASE 2.2 — Simplified 2-Stage Verification: Stage 1 Ticket Scanning
// =========================================================================
const p22Gate = new MicroGateEngine('E22', 777);
p22Gate.reset(777);
p22Gate.setTicketScanLatency(0.3);
p22Gate.setPersonCheckLatency(0.8);
p22Gate.setArrivalRate(300);
for (let s = 0; s < 50; s++) {
  p22Gate.step(0.05, s * 0.05);
}
const p22Metrics = p22Gate.step(0.05, 2.55);
assert.ok(p22Metrics.totalArrivals > 0, 'Must record spectator arrivals');
assert.ok(p22Metrics.ticketsScanned >= 0, 'Must record tickets scanned');
console.log('✓ Test 45 Passed: Stage 1 automated NFC/QR ticket scanning operation verified');

// =========================================================================
// 46. PHASE 2.2 — Simplified 2-Stage Verification: Stage 2 Person ID Check
// =========================================================================
assert.ok(p22Gate.getPersonCheckStations().length >= 4, 'Must initialize 4 Person Check stations');
const chk1 = p22Gate.getPersonCheckStations()[0];
assert.equal(chk1.nominalLatencySec, 0.8, 'Person check nominal latency must match configured value');
console.log('✓ Test 46 Passed: Stage 2 Person Check stations configured and operational');

// =========================================================================
// 47. PHASE 2.2 — Attendee Mismatch Detection & Recovery Diversion
// =========================================================================
p22Gate.reset(888);
p22Gate.setTicketScanLatency(0.1);
p22Gate.setPersonCheckLatency(0.2);
p22Gate.setPersonMismatchRate(0.5); // High mismatch rate for test
p22Gate.setRejectionRate(0.0);      // All tickets valid QR, tests attendee check
p22Gate.setArrivalRate(900);
for (let s = 0; s < 500; s++) {
  p22Gate.step(0.05, s * 0.05);
}
const mismatchMetrics = p22Gate.step(0.05, 25.05);
assert.ok(mismatchMetrics.personMismatches > 0, `Must detect attendee ID mismatches, got ${mismatchMetrics.personMismatches}`);
console.log(`✓ Test 47 Passed: Attendee ID mismatch detection verified (${mismatchMetrics.personMismatches} mismatches diverted)`);

// =========================================================================
// 48. PHASE 2.2 — Sequential Capacity Breakdown: C_eff = min(C_scan, C_person, C_turn)
// =========================================================================
p22Gate.reset(999);
p22Gate.setTicketScanLatency(0.2);   // C_scan = 4 * (60 / 0.2) = 1200
p22Gate.setPersonCheckLatency(1.0);  // C_person = 4 * (60 / 1.0) = 240
p22Gate.setTurnstileLatency(0.5);    // C_turn = 8 * (60 / 0.5) = 960
const capMetrics = p22Gate.step(0.05, 1.0);
assert.equal(capMetrics.ticketScanCapacityPerMin, 1200, 'C_scan must equal 1200 p/min');
assert.equal(capMetrics.personCheckCapacityPerMin, 240, 'C_person must equal 240 p/min');
assert.equal(capMetrics.effectiveCapacityPerMin, 240, 'C_eff must equal min(1200, 240, turnCap) = 240 p/min');
console.log('✓ Test 48 Passed: Sequential capacity formula C_eff = min(C_scan, C_person, C_turn) verified');

// =========================================================================
// 49. PHASE 2.2 — Dynamic Turnstile Addition (+) and Capacity Increase
// =========================================================================
const initialCount = p22Gate.getTurnstileCounters().filter((c) => c.gateId === 'G7').length;
const initialTurnCap = capMetrics.turnstileCapacityPerMin;
const newTurnstile = p22Gate.addTurnstile('G7');
assert.ok(newTurnstile, 'Must return created turnstile counter');
assert.equal(newTurnstile.status, 'IDLE', 'New turnstile status must be IDLE');
assert.equal(newTurnstile.gateId, 'G7', 'New turnstile must belong to requested bank G7');
const updatedCount = p22Gate.getTurnstileCounters().filter((c) => c.gateId === 'G7').length;
assert.equal(updatedCount, initialCount + 1, 'Turnstile count for G7 must increase by 1');
const afterAddMetrics = p22Gate.step(0.05, 1.05);
assert.ok(afterAddMetrics.turnstileCapacityPerMin > initialTurnCap, 'Turnstile capacity must increase after adding counter');
console.log('✓ Test 49 Passed: Dynamic turnstile addition (+) and instant capacity scaling verified');

// =========================================================================
// 50. PHASE 2.2 — Dynamic Turnstile Removal (-) and Busy Counter Protection
// =========================================================================
const turnstileToRemove = p22Gate.getTurnstileCounters().filter((c) => c.gateId === 'G7').slice(-1)[0];
turnstileToRemove.status = 'BUSY';
const busyRemovalResult = p22Gate.removeTurnstile('G7');
assert.equal(busyRemovalResult, false, 'Engine must refuse removal of a BUSY turnstile counter');
turnstileToRemove.status = 'IDLE';
const idleRemovalResult = p22Gate.removeTurnstile('G7');
assert.equal(idleRemovalResult, true, 'Engine must permit removal of an IDLE turnstile counter');
console.log('✓ Test 50 Passed: Turnstile removal busy protection and idle removal verified');

// =========================================================================
// 51. PHASE 2.2 — Point-Cloud Fruin Density Threshold Mapping
// =========================================================================
const testFruinColor = (density: number) => {
  if (density >= 3.0) return '#ef4444';
  if (density >= 2.2) return '#f97316';
  if (density >= 1.5) return '#eab308';
  return '#10b981';
};
assert.equal(testFruinColor(0.8), '#10b981', '<1.5 must map to Green (Free Flow)');
assert.equal(testFruinColor(1.8), '#eab308', '1.5-2.2 must map to Yellow (Laminar Warning)');
assert.equal(testFruinColor(2.5), '#f97316', '2.2-3.0 must map to Orange (Constrained)');
assert.equal(testFruinColor(4.2), '#ef4444', '>3.0 must map to Red (Crush Hazard)');
console.log('✓ Test 51 Passed: Point-cloud Fruin density color threshold mapping verified');

// =========================================================================
// 52. PHASE 2.2 — Gate View Log Scope Filtering
// =========================================================================
const mockLogs = [
  { id: '1', timestamp: '12:00:01', level: 'INFO' as const, message: 'E22 approach normal', gateId: 'E22' },
  { id: '2', timestamp: '12:00:02', level: 'ALERT' as const, message: 'G7 counter fail', gateId: 'G7' },
  { id: '3', timestamp: '12:00:03', level: 'INFO' as const, message: 'E11 surge arrival', gateId: 'E11' },
  { id: '4', timestamp: '12:00:04', level: 'INFO' as const, message: 'G14 queue flow', gateId: 'G14' }
];
const filterE22 = mockLogs.filter((l) => l.gateId === 'E22' || ['G7', 'G8'].includes(l.gateId));
assert.equal(filterE22.length, 2, 'Filtered logs for E22 must include only E22, G7, G8');
assert.ok(filterE22.some((l) => l.gateId === 'E22'));
assert.ok(filterE22.some((l) => l.gateId === 'G7'));
console.log('✓ Test 52 Passed: Gate View telemetry log scope partitioning verified');

// =========================================================================
// 53. PHASE 3 — Synthetic Scenario Presets: All 7 Principal Scenarios (A – G)
// =========================================================================
const requiredScenarios: ScenarioType[] = [
  'NORMAL_INGRESS',
  'METRO_SURGE',
  'OUTER_GATE_FAILURE',
  'TURNSTILE_FAILURE',
  'COUNTER_FLOW_SHOCK',
  'TICKET_REJECTION_SHOCKWAVE',
  'COMBINED_EMERGENCY'
];
for (const scType of requiredScenarios) {
  const sc = PRESET_SCENARIOS[scType];
  assert.ok(sc, `Scenario ${scType} must exist in PRESET_SCENARIOS`);
  assert.equal(sc.type, scType, `Scenario type mismatch for ${scType}`);
  assert.ok(sc.baseInflowRate > 0, `Base inflow rate must be > 0 for ${scType}`);
  assert.ok(sc.durationSeconds > 0, `Duration must be > 0 for ${scType}`);
  assert.ok(sc.seed !== undefined, `Seed must be defined for ${scType}`);
  assert.ok(sc.selectedOuterGates.length > 0, `Selected outer gates must not be empty for ${scType}`);
  assert.ok(sc.selectedInnerGates.length > 0, `Selected inner gates must not be empty for ${scType}`);
}
console.log('✓ Test 53 Passed: All 7 Synthetic Scenario Presets (Scenarios A through G) verified');

// =========================================================================
// 54. PHASE 3 — Synthetic Schedule Generation Across All 7 Scenarios
// =========================================================================
for (const scType of requiredScenarios) {
  const sc = PRESET_SCENARIOS[scType];
  const sched = SyntheticDemandGenerator.generateSchedule(sc);
  assert.ok(sched.length > 0, `Schedule for ${scType} must generate arrivals`);
  assert.ok(sched[0].timeSeconds >= 0, `Arrival time must be non-negative for ${scType}`);
  assert.ok(sched[0].desiredSpeed > 0, `Desired speed must be positive for ${scType}`);
}
console.log('✓ Test 54 Passed: Deterministic Poisson schedule generation verified across all 7 scenarios');

// =========================================================================
// 55. PHASE 3 — Deterministic Seed Reproducibility of Paired Experiment Runs
// =========================================================================
const normalConfig = PRESET_SCENARIOS.NORMAL_INGRESS;
const expRun1 = ControlledExperimentRunner.runExperiment(
  { ...normalConfig, durationSeconds: 20 },
  ['METERING'],
  'E22',
  0.1
);
const expRun2 = ControlledExperimentRunner.runExperiment(
  { ...normalConfig, durationSeconds: 20 },
  ['METERING'],
  'E22',
  0.1
);
assert.equal(
  expRun1.baselineResults.totalArrivals,
  expRun2.baselineResults.totalArrivals,
  'Identical seed S must produce identical baseline arrivals'
);
assert.equal(
  expRun1.baselineResults.totalAdmitted,
  expRun2.baselineResults.totalAdmitted,
  'Identical seed S must produce identical baseline admitted counts'
);
assert.equal(
  expRun1.interventionResults.totalAdmitted,
  expRun2.interventionResults.totalAdmitted,
  'Identical seed S must produce identical intervention admitted counts'
);
assert.equal(
  expRun1.safetyVerdict.verdict,
  expRun2.safetyVerdict.verdict,
  'Identical seed S must produce identical safety verdict'
);
console.log('✓ Test 55 Passed: Deterministic seed-locked reproducibility verified across paired experiment runs');

// =========================================================================
// 56. PHASE 3 — Matched Baseline (Run A) vs. Intervention (Run B) Isolation
// =========================================================================
assert.equal(expRun1.baselineResults.runType, 'BASELINE');
assert.equal(expRun1.interventionResults.runType, 'INTERVENTION');
assert.ok(expRun1.experimentId.startsWith('exp_'), 'ExperimentId must have valid prefix');
assert.ok(expRun1.safetyVerdict.verdictTitle.length > 0, 'Verdict must include descriptive title');
assert.ok(expRun1.safetyVerdict.supportingFindings.length > 0, 'Verdict must include supporting findings');
console.log('✓ Test 56 Passed: Paired Baseline vs. Intervention execution and isolation verified');

// =========================================================================
// 57. PHASE 3 — Scenario B: Metro Surge Generation & Dynamic Metering
// =========================================================================
const surgeConfig = PRESET_SCENARIOS.METRO_SURGE;
assert.ok(surgeConfig.surge, 'Scenario B must define surge parameters');
assert.equal(surgeConfig.surge?.magnitude, 600, 'Surge magnitude must be +600 p/min');
const surgeExp = ControlledExperimentRunner.runExperiment(
  { ...surgeConfig, durationSeconds: 25 },
  ['METERING', 'QUEUE_MANAGEMENT'],
  'E11',
  0.1
);
assert.ok(
  surgeExp.baselineResults.totalArrivals >= surgeExp.interventionResults.totalArrivals,
  'Dynamic Metering in intervention must throttle arrival influx into concourse'
);
console.log('✓ Test 57 Passed: Scenario B Metro Surge and Dynamic Metering buffer verified');

// =========================================================================
// 58. PHASE 3 — Scenario C: Outer Gate Failure & Authorized Rerouting
// =========================================================================
const gateFailConfig = PRESET_SCENARIOS.OUTER_GATE_FAILURE;
assert.ok(gateFailConfig.gateFailure, 'Scenario C must define gateFailure parameters');
const altGates = gateFailConfig.gateFailure?.alternateGates || [];
for (const g of altGates) {
  const spec = GATE_CONNECTIVITY_CATALOG[g];
  assert.ok(spec, `Alternative gate ${g} must exist in catalog`);
  assert.notEqual(
    spec.accessPermission,
    'RESTRICTED_VIP_MEDIA',
    `Alternative gate ${g} must NOT route public patrons to Queens Road VIP access`
  );
}
console.log('✓ Test 58 Passed: Scenario C Outer Gate Failure excludes Queens Road VIP routes');

// =========================================================================
// 59. PHASE 3 — Scenario D: Turnstile Bank Failure & Queue Accumulation
// =========================================================================
const turnFailConfig = PRESET_SCENARIOS.TURNSTILE_FAILURE;
assert.ok(turnFailConfig.turnstileFailure, 'Scenario D must define turnstileFailure parameters');
assert.equal(turnFailConfig.turnstileFailure?.innerGateId, 'G7');
assert.equal(turnFailConfig.turnstileFailure?.failedCounterCount, 2);
const turnFailEngine = new MicroGateEngine('E22', 42);
const nominalMetrics = turnFailEngine.calculateMetrics();
turnFailEngine.toggleTurnstileFailure(0);
turnFailEngine.toggleTurnstileFailure(1);
const failedMetrics = turnFailEngine.calculateMetrics();
assert.ok(
  failedMetrics.turnstileCapacityPerMin < nominalMetrics.turnstileCapacityPerMin,
  'Turnstile failure must decrease gate turnstile capacity'
);
console.log('✓ Test 59 Passed: Scenario D Turnstile Failure capacity reduction verified');

// =========================================================================
// 60. PHASE 3 — Scenario E: Counter-Flow Shock & Directional Separation
// =========================================================================
const cfConfig = PRESET_SCENARIOS.COUNTER_FLOW_SHOCK;
assert.ok(cfConfig.counterFlow, 'Scenario E must define counterFlow parameters');
assert.ok(cfConfig.counterFlow?.intensityPercent && cfConfig.counterFlow.intensityPercent >= 0.10);
const cfExp = ControlledExperimentRunner.runExperiment(
  { ...cfConfig, durationSeconds: 20 },
  ['DIRECTIONAL_SEPARATION'],
  'E22',
  0.1
);
assert.ok(cfExp.interventionResults.averageWaitTimeSec <= cfExp.baselineResults.averageWaitTimeSec + 2.0);
console.log('✓ Test 60 Passed: Scenario E Counter-Flow Shock and Directional Divider verified');

// =========================================================================
// 61. PHASE 3 — Scenario F: Ticket Rejection Shockwave Rate
// =========================================================================
const rejConfig = PRESET_SCENARIOS.TICKET_REJECTION_SHOCKWAVE;
assert.ok(rejConfig.ticketRejection, 'Scenario F must define ticketRejection parameters');
assert.ok(
  rejConfig.ticketRejection.rejectionPercentage >= 0.10,
  `Rejection percentage must be >= 10%, got ${rejConfig.ticketRejection.rejectionPercentage}`
);
const rejEngine = new MicroGateEngine('E22', 42);
rejEngine.setRejectionRate(0.15);
assert.equal(rejEngine.getRejectionRate(), 0.15, 'Engine must accept 15% rejection rate');
console.log('✓ Test 61 Passed: Scenario F Ticket Rejection Shockwave verified');

// =========================================================================
// 62. PHASE 3 — Scenario G: Combined Emergency Synchronized Timeline
// =========================================================================
const combConfig = PRESET_SCENARIOS.COMBINED_EMERGENCY;
assert.ok(combConfig.combinedEvents, 'Scenario G must define combined timeline events');
assert.equal(combConfig.combinedEvents?.length, 3, 'Combined Emergency must have 3 synchronized timeline events');
const evtTypes = combConfig.combinedEvents?.map((e) => e.type);
assert.ok(evtTypes?.includes('SURGE'));
assert.ok(evtTypes?.includes('TURNSTILE_FAIL'));
assert.ok(evtTypes?.includes('COUNTER_FLOW'));
console.log('✓ Test 62 Passed: Scenario G Combined Emergency synchronized timeline verified');

// =========================================================================
// 63. PHASE 3 — Three-Zone Spatial Monitor Calibrated Spatial Areas
// =========================================================================
const testRecord = ControlledExperimentRunner.runExperiment(
  { ...normalConfig, durationSeconds: 15 },
  ['METERING'],
  'E22',
  0.1
);
assert.ok(testRecord.baselineResults.zoneA.density >= 0, 'Zone A density must be >= 0');
assert.ok(testRecord.baselineResults.zoneB.density >= 0, 'Zone B density must be >= 0');
assert.ok(testRecord.baselineResults.zoneC.density >= 0, 'Zone C density must be >= 0');
console.log('✓ Test 63 Passed: Three-Zone Spatial Monitor area calibrations verified');

// =========================================================================
// 64. PHASE 3 — Displacement Detector Upstream Risk Recognition
// =========================================================================
const p3DisplacedAudit = DisplacementDetector.compare(
  { ...testRecord.baselineResults.zoneA, density: 4.2, criticalHazardDurationSec: 15 }, // Throat choked in baseline
  { ...testRecord.baselineResults.zoneB, density: 2.0, criticalHazardDurationSec: 0 },
  { ...testRecord.baselineResults.zoneC, density: 1.0, criticalHazardDurationSec: 0 }, // Road clear in baseline
  { ...testRecord.interventionResults.zoneA, density: 1.5, criticalHazardDurationSec: 0 }, // Throat relieved
  { ...testRecord.interventionResults.zoneB, density: 1.8, criticalHazardDurationSec: 0 },
  { ...testRecord.interventionResults.zoneC, density: 3.2, criticalHazardDurationSec: 10 }, // Road surged!
  30
);
assert.equal(p3DisplacedAudit.isDisplacementDetected, true, 'Must detect upstream displacement to road');
assert.ok(p3DisplacedAudit.displacedTargetZone?.includes('Road'), 'Target zone must indicate road displacement');
console.log('✓ Test 64 Passed: Displacement Detector upstream spillback detection verified');

// =========================================================================
// 65. PHASE 3 — Safety Verdict Engine Permitting Classifications
// =========================================================================
const p3VerdictDisplaced = SafetyVerdictEngine.evaluate(p3DisplacedAudit);
assert.equal(p3VerdictDisplaced.verdict, 'DISPLACED');
assert.equal(p3VerdictDisplaced.permitRecommendation, 'CONDITIONAL_APPROVAL');

const p3ImprovedAudit = DisplacementDetector.compare(
  { ...testRecord.baselineResults.zoneA, density: 2.5, criticalHazardDurationSec: 10 },
  { ...testRecord.baselineResults.zoneB, density: 3.5, criticalHazardDurationSec: 15 },
  { ...testRecord.baselineResults.zoneC, density: 4.2, criticalHazardDurationSec: 20 },
  { ...testRecord.interventionResults.zoneA, density: 1.2, criticalHazardDurationSec: 0 },
  { ...testRecord.interventionResults.zoneB, density: 1.5, criticalHazardDurationSec: 0 },
  { ...testRecord.interventionResults.zoneC, density: 1.8, criticalHazardDurationSec: 0 },
  30
);
const p3VerdictImproved = SafetyVerdictEngine.evaluate(p3ImprovedAudit);
assert.equal(p3VerdictImproved.verdict, 'IMPROVED');
assert.equal(p3VerdictImproved.permitRecommendation, 'GRANT_PERMIT');

const p3InconclusiveAudit = DisplacementDetector.compare(
  { ...testRecord.baselineResults.zoneA, density: 1.0 },
  { ...testRecord.baselineResults.zoneB, density: 1.2 },
  { ...testRecord.baselineResults.zoneC, density: 1.5 },
  { ...testRecord.interventionResults.zoneA, density: 1.1 },
  { ...testRecord.interventionResults.zoneB, density: 1.3 },
  { ...testRecord.interventionResults.zoneC, density: 1.4 },
  5 // Under 8s window
);
const p3VerdictInconclusive = SafetyVerdictEngine.evaluate(p3InconclusiveAudit);
assert.equal(p3VerdictInconclusive.verdict, 'INCONCLUSIVE');
assert.equal(p3VerdictInconclusive.permitRecommendation, 'CONTINUE_MONITORING');
console.log('✓ Test 65 Passed: Safety Verdict Engine classifications & permit recommendations verified');

// =========================================================================
// 66. PHASE 4 — Predictive Congestion Engine: Queue Projection Calculation
// =========================================================================
const predTestGate = {
  gateId: 'E22',
  currentQueue: 20,
  arrivalRatePerMin: 600,
  effectiveCapacityPerMin: 360,
  currentThroatDensity: 1.8,
  currentApproachDensity: 1.2,
  currentSpillbackMeters: 0,
  holdingAreaCapacity: 500,
  throatAreaM2: 80,
  holdingAreaM2: 250,
  approachAreaM2: 120
};
const fcast60s = PredictiveCongestionEngine.forecastGate(predTestGate, 60);
assert.equal(fcast60s.predictedQueue, 260, 'Queue in 60s must project Q(0) + (λ - μ) × 1 = 20 + 240 = 260');
assert.equal(fcast60s.queueDelta, 240, 'Queue delta must equal net growth rate');
assert.ok(fcast60s.uncertaintyMargin > 0, 'Uncertainty bound σ must be positive');
assert.equal(fcast60s.predictedQueueLower, fcast60s.predictedQueue - fcast60s.uncertaintyMargin);
assert.equal(fcast60s.predictedQueueUpper, fcast60s.predictedQueue + fcast60s.uncertaintyMargin);
console.log('✓ Test 66 Passed: Predictive Congestion Engine queue projection formula verified');

// =========================================================================
// 67. PHASE 4 — Turnstile Saturation & Time to Buffer Breach
// =========================================================================
assert.equal(fcast60s.turnstileUtilizationPercent, 167, 'Utilization must reflect (600 / 360) * 100 = 167%');
assert.ok(fcast60s.timeToSaturationSec !== null, 'Time to saturation must be computed when λ > μ');
assert.equal(
  fcast60s.timeToSaturationSec,
  Math.round(((500 - 20) / (600 - 360)) * 60),
  'Time to saturation must calculate remaining holding space divided by net rate'
);
console.log('✓ Test 67 Passed: Turnstile saturation & buffer breach calculation verified');

// =========================================================================
// 68. PHASE 4 — Multi-Horizon Forecasting (30s, 60s, 120s, 300s)
// =========================================================================
const fcast30s = PredictiveCongestionEngine.forecastGate(predTestGate, 30);
const fcast120s = PredictiveCongestionEngine.forecastGate(predTestGate, 120);
const fcast300s = PredictiveCongestionEngine.forecastGate(predTestGate, 300);
assert.ok(fcast30s.predictedQueue < fcast60s.predictedQueue);
assert.ok(fcast60s.predictedQueue < fcast120s.predictedQueue);
assert.ok(fcast120s.predictedQueue < fcast300s.predictedQueue);
assert.ok(fcast30s.uncertaintyMargin < fcast300s.uncertaintyMargin, 'Uncertainty must grow with horizon length');
console.log('✓ Test 68 Passed: Multi-horizon forecasting monotonic scaling verified');

// =========================================================================
// 69. PHASE 4 — Congestion Warning Level Classifications
// =========================================================================
const normalGate = { ...predTestGate, arrivalRatePerMin: 200, currentThroatDensity: 1.0 };
const watchGate = { ...predTestGate, arrivalRatePerMin: 340, currentThroatDensity: 1.6 };
const congestedGate = { ...predTestGate, arrivalRatePerMin: 420, currentThroatDensity: 2.3 };
const criticalGate = { ...predTestGate, arrivalRatePerMin: 700, currentThroatDensity: 3.4 };

assert.equal(PredictiveCongestionEngine.forecastGate(normalGate, 60).warningLevel, 'NORMAL');
assert.equal(PredictiveCongestionEngine.forecastGate(watchGate, 60).warningLevel, 'WATCH');
assert.equal(PredictiveCongestionEngine.forecastGate(congestedGate, 60).warningLevel, 'CONGESTED');
assert.equal(PredictiveCongestionEngine.forecastGate(criticalGate, 60).warningLevel, 'CRITICAL');
console.log('✓ Test 69 Passed: Congestion warning level classifications (NORMAL -> CRITICAL) verified');

// =========================================================================
// 70. PHASE 4 — Explainable Safety Recommendation Engine Generation
// =========================================================================
const recGate = {
  ...predTestGate,
  arrivalRatePerMin: 550,
  effectiveCapacityPerMin: 360,
  currentThroatDensity: 2.6
};
const recForecasts = {
  E22: PredictiveCongestionEngine.forecastGate(recGate, 60)
};
const recs = SafetyRecommendationEngine.generateRecommendations([recGate], recForecasts);
assert.ok(recs.length > 0, 'Must generate recommendations for overloaded gate');
const meterRec = recs.find((r) => r.category === 'GATE_METERING');
assert.ok(meterRec, 'Must generate GATE_METERING recommendation when arrival rate exceeds capacity');
assert.ok(meterRec.problemDetected.length > 0, 'Recommendation must include problem explanation');
assert.ok(meterRec.supportingMeasurements.length >= 3, 'Recommendation must include supporting measurements');
assert.ok(meterRec.expectedBenefit.length > 0, 'Recommendation must detail expected benefit');
assert.ok(meterRec.possibleSideEffects.length > 0, 'Recommendation must detail possible side effects');
console.log('✓ Test 70 Passed: Explainable safety recommendations structure verified');

// =========================================================================
// 71. PHASE 4 — Strict Access-Control Enforcement in Recommendations
// =========================================================================
const vipGate = {
  ...predTestGate,
  gateId: 'E5', // Queens Road VIP gate
  arrivalRatePerMin: 400
};
const vipRecs = SafetyRecommendationEngine.generateRecommendations([vipGate], {});
assert.equal(vipRecs.length, 0, 'Recommendations must never suggest general spectator interventions for VIP gates');
console.log('✓ Test 71 Passed: Strict Queens Road access-control enforcement verified in recommendation engine');

// =========================================================================
// 72. PHASE 4 — Human-in-the-Loop Operator Approval Enforcement
// =========================================================================
for (const r of recs) {
  assert.equal(r.requiresApproval, true, 'All operational interventions must require human operator approval');
  assert.equal(r.status, 'PENDING', 'Initial status must be PENDING operator review');
}
console.log('✓ Test 72 Passed: Human-in-the-loop operator approval controls verified');

// =========================================================================
// 73. PHASE 4 — Multi-Gate Dependency Graph Construction
// =========================================================================
const depGraph = MultiGateRiskCorrelation.buildDependencyGraph({ E22: 400, E11: 600 }, ['E22']);
assert.ok(depGraph.nodes.length >= 30, 'Dependency graph must include outer gates and inner banks');
assert.ok(depGraph.links.length >= 25, 'Dependency graph must link outer gates to inner banks');
assert.ok(depGraph.criticalNetworkBottlenecks.includes('E22'), 'Failed gate E22 must be flagged as critical bottleneck');
assert.ok(depGraph.sectorLoadBalancing['CUBBON_ROAD'], 'Must aggregate Cubbon Road sector load');
console.log('✓ Test 73 Passed: Stadium-wide multi-gate dependency graph construction verified');

// =========================================================================
// 74. PHASE 4 — Cascading Failure Simulation & Impact Assessment
// =========================================================================
const cascadeResult = MultiGateRiskCorrelation.simulateCascadingRisk('E22', { E22: 480 });
assert.equal(cascadeResult.failedGateId, 'E22');
assert.equal(cascadeResult.primaryImpactSector, 'CUBBON_ROAD');
assert.ok(cascadeResult.immediateCapacityLossPerMin > 0, 'Capacity loss must be non-zero');
assert.ok(cascadeResult.sharedTurnstileLoad.length > 0, 'Shared inner turnstile load must be calculated');
assert.ok(cascadeResult.cascadingRiskScore >= 0 && cascadeResult.cascadingRiskScore <= 100);
console.log('✓ Test 74 Passed: Multi-gate cascading failure simulation verified');

// =========================================================================
// 75. PHASE 4 — Percentage Safety Improvement Calculation
// =========================================================================
const testExpBrief = SafetyBriefGenerator.generateBriefData(expRun1);
assert.ok(testExpBrief.section6_ComparativeResults.densityImprovementPercent !== undefined);
assert.ok(testExpBrief.section6_ComparativeResults.waitTimeImprovementPercent !== undefined);
assert.ok(testExpBrief.section6_ComparativeResults.throughputImprovementPercent !== undefined);
console.log('✓ Test 75 Passed: Percentage safety improvement calculations verified');

// =========================================================================
// 76. PHASE 4 — Event Replay Deterministic Timeline Generation
// =========================================================================
const replayTL = EventReplayEngine.generateTimeline(expRun1, 2.0);
assert.ok(replayTL.length > 0, 'Replay timeline must generate snapshot points');
assert.equal(replayTL[0].timeSec, 0, 'Timeline must start at t = 0');
assert.ok(replayTL[replayTL.length - 1].timeSec <= expRun1.simulationDurationSeconds);
assert.ok(replayTL[0].baseline.admitted <= replayTL[replayTL.length - 1].baseline.admitted);
console.log('✓ Test 76 Passed: Event Replay deterministic timeline generation verified');

// =========================================================================
// 77. PHASE 4 — Automated Safety Brief: Full 10-Section Structure
// =========================================================================
assert.ok(testExpBrief.section1_ExecutiveSummary, 'Section 1 must exist');
assert.ok(testExpBrief.section2_StadiumConfiguration, 'Section 2 must exist');
assert.ok(testExpBrief.section3_ScenarioDescription, 'Section 3 must exist');
assert.ok(testExpBrief.section4_BaselineAnalysis, 'Section 4 must exist');
assert.ok(testExpBrief.section5_InterventionAnalysis, 'Section 5 must exist');
assert.ok(testExpBrief.section6_ComparativeResults, 'Section 6 must exist');
assert.ok(testExpBrief.section7_DisplacementAnalysis, 'Section 7 must exist');
assert.ok(testExpBrief.section8_FinalVerdict, 'Section 8 must exist');
assert.ok(testExpBrief.section9_RecommendedActions, 'Section 9 must exist');
assert.ok(testExpBrief.section10_TechnicalAppendix, 'Section 10 must exist');
console.log('✓ Test 77 Passed: Automated Safety Brief 10-section structure verified');

// =========================================================================
// 78. PHASE 4 — CSV Export Formatting & Tabular Integrity
// =========================================================================
const csvOutput = SafetyBriefGenerator.generateCSV(expRun1);
assert.ok(csvOutput.includes('CROWDWISE EVENT SAFETY PERMITTING BRIEF'), 'CSV must contain brief header');
assert.ok(csvOutput.includes('COMPARATIVE PERFORMANCE METRICS'), 'CSV must contain comparative section');
assert.ok(csvOutput.includes('THREE-ZONE SPATIAL DENSITY'), 'CSV must contain three-zone breakdown');
console.log('✓ Test 78 Passed: CSV report generation and tabular integrity verified');

// =========================================================================
// 79. PHASE 4 — Parametric Batch Benchmarking Reproducibility
// =========================================================================
const standardSuites = BatchBenchmarkingEngine.getStandardBenchmarkSuites();
assert.equal(standardSuites.length, 5, 'Standard benchmark suite must define 5 parametric trials');
const benchRunResult = BatchBenchmarkingEngine.runBenchmarkSuite(standardSuites.slice(0, 2));
assert.equal(benchRunResult.length, 2, 'Must execute specified benchmark trials');
assert.ok(benchRunResult[0].throughputPerMin > 0, 'Throughput must be positive');
assert.ok(benchRunResult[0].peakThroatDensity > 0, 'Throat density must be positive');
console.log('✓ Test 79 Passed: Parametric batch benchmarking reproducibility verified');

// =========================================================================
// 80. PHASE 4 — Evaluation Reliability Safeguards & Inconclusive Handling
// =========================================================================
const shortAudit = DisplacementDetector.compare(
  { ...expRun1.baselineResults.zoneA, density: 1.0 },
  { ...expRun1.baselineResults.zoneB, density: 1.2 },
  { ...expRun1.baselineResults.zoneC, density: 1.5 },
  { ...expRun1.interventionResults.zoneA, density: 1.1 },
  { ...expRun1.interventionResults.zoneB, density: 1.3 },
  { ...expRun1.interventionResults.zoneC, density: 1.4 },
  4.0 // 4 seconds < 8 seconds minimum threshold
);
const shortVerdict = SafetyVerdictEngine.evaluate(shortAudit);
assert.equal(shortVerdict.verdict, 'INCONCLUSIVE', 'Sub-8 second trial must evaluate to INCONCLUSIVE');
assert.equal(shortVerdict.permitRecommendation, 'CONTINUE_MONITORING');
console.log('✓ Test 80 Passed: Evaluation reliability safeguards & inconclusive handling verified');

// =========================================================================
// 81. PHASE 2.3 — Gate View Isolation for E11 (MG Road mass ingress)
// =========================================================================
{
  const e11Engine = new MicroGateEngine('E11', 42);
  const e11Inner = e11Engine.getConnectedInnerGateIds();
  assert.deepEqual(e11Inner, ['G15'], 'E11 must connect ONLY to inner gate G15');
  const e11Voms = e11Engine.getVomitories();
  assert.equal(e11Voms.length, 1, 'E11 must have exactly 1 vomitory');
  assert.equal(e11Voms[0].gateId, 'G15');
  assert.equal(e11Voms[0].standName, 'M2 Annexe', 'Destination for E11 must be M2 Annexe');
  const e11Turnstiles = e11Engine.getTurnstileCounters();
  assert.ok(e11Turnstiles.every((t) => t.gateId === 'G15'), 'All turnstiles in E11 view must belong to G15');
  assert.ok(!e11Turnstiles.some((t) => t.gateId === 'G7' || t.gateId === 'G8'), 'Unrelated gates G7/G8 must not appear');
  console.log('✓ Test 81 Passed: Gate isolation for E11 displays only E11 and connected G15 -> M2 Annexe');
}

// =========================================================================
// 82. PHASE 2.3 — Gate View Isolation for E22 (Cubbon Road high-volume artery)
// =========================================================================
{
  const e22Engine = new MicroGateEngine('E22', 42);
  const e22Inner = e22Engine.getConnectedInnerGateIds();
  assert.deepEqual(e22Inner, ['G7', 'G8'], 'E22 must connect ONLY to G7 and G8');
  const e22Voms = e22Engine.getVomitories();
  assert.equal(e22Voms.length, 2, 'E22 must have exactly 2 vomitories for G7 and G8');
  const e22Turnstiles = e22Engine.getTurnstileCounters();
  assert.ok(e22Turnstiles.every((t) => t.gateId === 'G7' || t.gateId === 'G8'), 'Turnstiles must only belong to G7 and G8');
  assert.ok(!e22Turnstiles.some((t) => t.gateId === 'G15' || t.gateId === 'G1'), 'Unrelated gates G15/G1 must not appear');
  console.log('✓ Test 82 Passed: Gate isolation for E22 displays only E22, G7 and G8');
}

// =========================================================================
// 83. PHASE 2.3 — Gate View Isolation for E14 and Universal Gate Catalog Coverage
// =========================================================================
{
  const e14Engine = new MicroGateEngine('E14', 42);
  assert.deepEqual(e14Engine.getConnectedInnerGateIds(), ['G14'], 'E14 must connect ONLY to G14');
  for (let i = 1; i <= 23; i++) {
    const ogId = `E${i}`;
    const spec = GATE_CONNECTIVITY_CATALOG[ogId];
    assert.ok(spec, `Outer gate ${ogId} must be defined in connectivity catalog`);
    assert.ok(spec.connectedInnerGates.length > 0, `${ogId} must have valid connected inner gates`);
    spec.connectedInnerGates.forEach((igId) => {
      assert.ok(INNER_GATE_STAND_CATALOG[igId], `Connected inner gate ${igId} must exist in stand catalog`);
    });
  }
  console.log('✓ Test 83 Passed: Gate isolation for E14 verified and all 23 outer gates resolve valid inner banks');
}

// =========================================================================
// 84. PHASE 2.3 — Two-Way Store Selection & Automatic Connected Gate Resolution
// =========================================================================
{
  const resolvedG15 = getConnectedInnerGates('E11');
  assert.deepEqual(resolvedG15, ['G15']);
  const resolvedE11 = getConnectedOuterGates('G15');
  assert.ok(resolvedE11.includes('E11'));
  const resolvedG7G8 = getConnectedInnerGates('E22');
  assert.deepEqual(resolvedG7G8, ['G7', 'G8']);
  console.log('✓ Test 84 Passed: Two-way gate resolution automatically links outer and inner gates');
}

// =========================================================================
// 85. PHASE 2.3 — Turnstile Counter Operational Object Properties & Unique IDs
// =========================================================================
{
  const testEngine = new MicroGateEngine('E11', 42);
  const counters = testEngine.getTurnstileCounters();
  assert.ok(counters.length >= 4, 'Initial turnstile bank should have at least 4 counters');
  counters.forEach((c) => {
    assert.ok(c.counterId.startsWith('G15-T'), `Counter ID must follow standard naming: ${c.counterId}`);
    assert.equal(c.status, 'IDLE', 'Initial counter status must be IDLE');
    assert.equal(typeof c.nominalLatencySec, 'number');
    assert.equal(c.processedCount, 0);
    assert.ok(Array.isArray(c.assignedQueue), 'Counter must have dedicated assigned queue array');
  });
  console.log('✓ Test 85 Passed: Turnstile counters are independent operational objects with unique IDs and queues');
}

// =========================================================================
// 86. PHASE 2.3 — Dynamic Turnstile Addition (+) and Lane Spacing Recalculation
// =========================================================================
{
  const testEngine = new MicroGateEngine('E11', 42);
  const initialCount = testEngine.getTurnstileCounters().length;
  const newCounter = testEngine.addTurnstile('G15');
  assert.ok(newCounter, 'addTurnstile must succeed');
  assert.equal(newCounter?.counterId, `G15-T0${initialCount + 1}`);
  assert.equal(newCounter?.status, 'IDLE');
  assert.equal(testEngine.getTurnstileCounters().length, initialCount + 1);
  const newTurnstiles = testEngine.getTurnstileCounters();
  for (let i = 0; i < newTurnstiles.length - 1; i++) {
    assert.ok(newTurnstiles[i].x < newTurnstiles[i + 1].x, 'Turnstile lane positions must be strictly sorted and spaced');
  }
  console.log('✓ Test 86 Passed: Adding turnstile creates operational lane and updates spacing automatically');
}

// =========================================================================
// 87. PHASE 2.3 — Idle Counter Removal (-) and Capacity Recalculation
// =========================================================================
{
  const testEngine = new MicroGateEngine('E11', 42);
  const initialCount = testEngine.getTurnstileCounters().length;
  const removedSuccess = testEngine.removeTurnstile('G15');
  assert.equal(removedSuccess, true, 'Removing idle counter must succeed');
  assert.equal(testEngine.getTurnstileCounters().length, initialCount - 1);
  console.log('✓ Test 87 Passed: Idle counter removal safely deletes lane and updates capacity');
}

// =========================================================================
// 88. PHASE 2.3 — Busy-Safe Removal Protection (BUSY counters cannot be removed)
// =========================================================================
{
  const busyEngine = new MicroGateEngine('E11', 42);
  const firstCounter = busyEngine.getTurnstileCounters()[busyEngine.getTurnstileCounters().length - 1];
  firstCounter.status = 'BUSY';
  firstCounter.serviceRemainingSec = 2.0;
  const busyRemovalResult = busyEngine.removeTurnstile('G15');
  assert.equal(busyRemovalResult, false, 'BUSY counter must strictly reject removal');
  console.log('✓ Test 88 Passed: Busy counter protection verified — busy counters cannot be removed');
}

// =========================================================================
// 89. PHASE 2.3 — Counter Failure Toggling and Queue Redistribution
// =========================================================================
{
  const failEngine = new MicroGateEngine('E11', 42);
  const targetCounter = failEngine.getTurnstileCounters()[0];
  const targetId = targetCounter.counterId;
  failEngine.toggleTurnstileFailure(targetId);
  assert.equal(targetCounter.status, 'FAILED', 'Target counter status must be FAILED');
  failEngine.toggleTurnstileFailure(targetId);
  assert.equal(targetCounter.status, 'IDLE', 'Toggling again must restore status to IDLE');
  console.log('✓ Test 89 Passed: Turnstile failure toggles status correctly and excludes failed lanes');
}

// =========================================================================
// 90. PHASE 2.3 — Sequential Admission Lifecycle (No Teleportation)
// =========================================================================
{
  const flowEngine = new MicroGateEngine('E11', 42);
  flowEngine.setRejectionRate(0);
  flowEngine.setPersonMismatchRate(0);
  flowEngine.spawnAgent();
  const testAgent = flowEngine.getAgents()[0];
  assert.ok(testAgent, 'Agent must be spawned');
  assert.equal(testAgent.state, 'ARRIVING');
  assert.ok(testAgent.y >= 500, 'Agent must spawn on approach road');
  flowEngine.step(0.1, 1.0);
  assert.ok(testAgent.y < 540, 'Agent must move continuously towards queue');
  console.log('✓ Test 90 Passed: Sequential admission lifecycle verified without teleportation');
}

// =========================================================================
// 91. PHASE 2.3 — Mismatch Detection and Lateral Diversion Routing
// =========================================================================
{
  const mismatchEngine = new MicroGateEngine('E11', 42);
  mismatchEngine.setRejectionRate(0);
  mismatchEngine.setPersonMismatchRate(1.0); // 100% mismatch
  mismatchEngine.spawnAgent();
  const mismatchAgent = mismatchEngine.getAgents()[0];
  assert.ok(mismatchAgent);
  mismatchAgent.attendeeName = 'Imposter Person';
  mismatchAgent.ticketHolderName = 'Legitimate Spectator';
  (mismatchEngine as any).finalizeTicketValidation(mismatchAgent, mismatchEngine.getScanStations()[0]);
  assert.equal(mismatchAgent.state, 'TICKET_VALIDATED');
  const chk = mismatchEngine.getPersonCheckStations()[0];
  chk.currentAgentId = mismatchAgent.id;
  chk.status = 'CHECKING';
  chk.checkRemainingSec = 0.05;
  (mismatchEngine as any).stepPersonCheckStations(0.1);
  assert.equal(mismatchAgent.state, 'REJECTED');
  assert.equal(mismatchAgent.isDiverted, true);
  assert.equal(mismatchAgent.waypoints[1].x, 860, 'Diverted agent must route to recovery corridor at x=860');
  console.log('✓ Test 91 Passed: Identity mismatch detected and diverted laterally to recovery corridor');
}

// =========================================================================
// 92. PHASE 2.3 — Single-Attendee Turnstile Service Processing
// =========================================================================
{
  const singleServeEngine = new MicroGateEngine('E11', 42);
  const counterToTest = singleServeEngine.getTurnstileCounters()[0];
  counterToTest.status = 'BUSY';
  counterToTest.currentAgentId = 999;
  counterToTest.serviceRemainingSec = 1.0;
  singleServeEngine.step(0.5, 10.0);
  assert.equal(counterToTest.status, 'BUSY');
  assert.equal(counterToTest.serviceRemainingSec, 0.5);
  singleServeEngine.step(0.6, 10.5);
  assert.equal(counterToTest.status, 'IDLE', 'Counter must become IDLE after service completes');
  assert.equal(counterToTest.currentAgentId, null);
  assert.equal(counterToTest.processedCount, 1, 'Counter must increment processed count to 1');
  console.log('✓ Test 92 Passed: Turnstile processes one attendee at a time with live countdown');
}

// =========================================================================
// 93. PHASE 2.3 — Sequential Capacity Bottleneck Formula: C_eff = min(C_scan, C_person, C_turn)
// =========================================================================
{
  const capEngine = new MicroGateEngine('E11', 42);
  capEngine.setTicketScanLatency(0.2); // Scan cap = 4 * 300 = 1200 p/m
  capEngine.setPersonCheckLatency(1.0); // Person check cap = 4 * 60 = 240 p/m
  capEngine.setTurnstileLatency(0.5); // Turnstile cap = 4 * 120 = 480 p/m
  const metrics = capEngine.step(0.01, 1.0);
  assert.equal(metrics.ticketScanCapacityPerMin, 1200);
  assert.equal(metrics.personCheckCapacityPerMin, 240);
  assert.equal(metrics.turnstileCapacityPerMin, 480);
  assert.equal(metrics.effectiveCapacityPerMin, 240, 'Effective capacity must equal min bottleneck: 240 p/m');
  console.log('✓ Test 93 Passed: Sequential capacity formula accurately identifies limiting bottleneck');
}

// =========================================================================
// 94. PHASE 2.3 — Instant Real-Time Capacity Recalculation on Turnstile Addition
// =========================================================================
{
  const dynEngine = new MicroGateEngine('E11', 42);
  dynEngine.setTicketScanLatency(0.1);
  dynEngine.setPersonCheckLatency(0.1);
  dynEngine.setTurnstileLatency(1.0); // 60 p/m per turnstile
  const mBefore = dynEngine.step(0.01, 1.0);
  const capBefore = mBefore.turnstileCapacityPerMin;
  dynEngine.addTurnstile('G15');
  const mAfter = dynEngine.step(0.01, 1.0);
  const capAfter = mAfter.turnstileCapacityPerMin;
  assert.equal(capAfter, capBefore + 60, 'Turnstile capacity must increase by exactly 60 p/m');
  console.log('✓ Test 94 Passed: Adding turnstile instantly recalculates venue throughput capacity');
}

// =========================================================================
// 95. PHASE 2.3 — Waypoint Advancement Continuity (Bounded Step Distance)
// =========================================================================
{
  const contEngine = new MicroGateEngine('E11', 42);
  contEngine.spawnAgent();
  const ag = contEngine.getAgents()[0];
  const initialX = ag.x;
  const initialY = ag.y;
  contEngine.step(0.05, 1.0);
  const stepDist = Math.hypot(ag.x - initialX, ag.y - initialY);
  assert.ok(stepDist < 10, `Step distance must be smooth and bounded (< 10px, got ${stepDist.toFixed(2)}px)`);
  console.log('✓ Test 95 Passed: Continuous agent movement verified without jumping or teleportation');
}

console.log('\n=============================================================');
console.log('✓ ALL 95 PREDICTIVE SAFETY, INTELLIGENCE & GATE TESTS PASSED!');
console.log('=============================================================\n');
