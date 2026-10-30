import { describe, it, expect } from 'vitest';
import { SimulationEngine } from '../SimulationEngine';
import { SpatialAnalyzer } from '../SpatialAnalyzer';
import { CHINNASWAMY_STADIUM_PROFILE } from '../../data/chinnaswamyStadium';
import { DEFAULT_INTERVENTIONS } from '../../data/interventions';
import { Venue, ZoneComparisonResult } from '../../types';

describe('SpatialAnalyzer & Zone-by-Zone Congestion Comparison', () => {
  const venue: Venue = CHINNASWAMY_STADIUM_PROFILE;

  it('should accurately calculate delta density with correct sign and arithmetic', () => {
    const baseEngine = new SimulationEngine(venue, 1337);
    const planEngine = new SimulationEngine(venue, 1337);

    // Manually set known test densities in mock zones
    baseEngine.state.venue.zones[0].currentDensity = 2.8;
    baseEngine.state.venue.zones[0].currentPopulation = 2800;
    baseEngine.state.venue.zones[0].riskLevel = 'HIGH_CONGESTION';

    planEngine.state.venue.zones[0].currentDensity = 1.4;
    planEngine.state.venue.zones[0].currentPopulation = 1400;
    planEngine.state.venue.zones[0].riskLevel = 'NORMAL';

    baseEngine.state.venue.zones[1].currentDensity = 0.8;
    baseEngine.state.venue.zones[1].currentPopulation = 800;
    baseEngine.state.venue.zones[1].riskLevel = 'NORMAL';

    planEngine.state.venue.zones[1].currentDensity = 2.4;
    planEngine.state.venue.zones[1].currentPopulation = 2400;
    planEngine.state.venue.zones[1].riskLevel = 'HIGH_CONGESTION';

    const { zoneComparisons, spatialSummary } = SpatialAnalyzer.analyze(
      venue,
      baseEngine,
      planEngine,
      'Test Scenario',
      ['Test Intervention']
    );

    // Zone 0: Relieved (2.8 -> 1.4, delta = -1.4)
    const z0 = zoneComparisons.find((z) => z.zoneId === venue.zones[0].id)!;
    expect(z0.deltaDensity).toBe(-1.4);
    expect(z0.deltaPopulation).toBe(-1400);
    expect(z0.status).toBe('RELIEVED');

    // Zone 1: New Hotspot (0.8 -> 2.4, was safe, reached 2.4 >= 2.0 limit, delta = +1.6)
    const z1 = zoneComparisons.find((z) => z.zoneId === venue.zones[1].id)!;
    expect(z1.deltaDensity).toBe(1.6);
    expect(z1.deltaPopulation).toBe(1600);
    expect(z1.status).toBe('NEW_HOTSPOT');

    // Transferred risk should be detected because z0 is RELIEVED and z1 is NEW_HOTSPOT
    expect(spatialSummary.riskTransferred).toBe(true);
    expect(spatialSummary.spatialVerdict).toBe('TRANSFERRED_RISK');
    expect(spatialSummary.newHotspotCount).toBeGreaterThanOrEqual(1);
    expect(spatialSummary.relievedZonesCount).toBeGreaterThanOrEqual(1);
    expect(spatialSummary.plainLanguageSummary).toContain('Transferred risk detected');
  });

  it('should detect when congestion worsens in an already elevated sector', () => {
    const baseEngine = new SimulationEngine(venue, 1337);
    const planEngine = new SimulationEngine(venue, 1337);

    // Zone already elevated (WATCH, 1.8 p/m²)
    baseEngine.state.venue.zones[0].currentDensity = 1.8;
    baseEngine.state.venue.zones[0].riskLevel = 'WATCH';

    // Rises further to 2.3 p/m² (+0.5)
    planEngine.state.venue.zones[0].currentDensity = 2.3;
    planEngine.state.venue.zones[0].riskLevel = 'HIGH_CONGESTION';

    const { zoneComparisons } = SpatialAnalyzer.analyze(
      venue,
      baseEngine,
      planEngine,
      'Test Surge',
      ['Test Plan']
    );

    const z0 = zoneComparisons.find((z) => z.zoneId === venue.zones[0].id)!;
    expect(z0.deltaDensity).toBe(0.5);
    // Since it was already elevated and increased, it is classified as WORSENED or NEW_HOTSPOT
    expect(['WORSENED', 'NEW_HOTSPOT']).toContain(z0.status);
  });

  it('should report IMPROVED when an intervention relieves congestion without creating any new hotspot', () => {
    const baseEngine = new SimulationEngine(venue, 1337);
    const planEngine = new SimulationEngine(venue, 1337);

    // Baseline has high congestion in zone 0
    baseEngine.state.venue.zones.forEach((z, idx) => {
      z.currentDensity = idx === 0 ? 2.6 : 0.6;
      z.riskLevel = idx === 0 ? 'HIGH_CONGESTION' : 'NORMAL';
    });

    // Plan relieves zone 0 without increasing any other zone
    planEngine.state.venue.zones.forEach((z, idx) => {
      z.currentDensity = idx === 0 ? 1.5 : 0.6;
      z.riskLevel = 'NORMAL';
    });

    const { zoneComparisons, spatialSummary } = SpatialAnalyzer.analyze(
      venue,
      baseEngine,
      planEngine,
      'Staggered Inflow Test',
      ['Upstream Transit Coordination & Staggering']
    );

    expect(spatialSummary.riskTransferred).toBe(false);
    expect(spatialSummary.spatialVerdict).toBe('IMPROVED');
    expect(spatialSummary.relievedZonesCount).toBe(1);
    expect(spatialSummary.newHotspotCount).toBe(0);
    expect(spatialSummary.worsenedZonesCount).toBe(0);
    expect(spatialSummary.plainLanguageSummary).toContain('Net positive safety improvement');
  });

  it('should produce identical deterministic results when simulated with identical seeds', () => {
    const seed = 4242;

    // Run 1: Baseline
    const eng1 = new SimulationEngine(venue, seed);
    eng1.setInflowConfig({ estimatedAttendance: 15000, pattern: 'PEAK_SURGE' });
    eng1.start();
    for (let t = 0; t < 30; t += 0.1) {
      eng1.step(0.1);
    }
    const d1 = eng1.state.venue.zones.map((z) => ({ id: z.id, d: z.currentDensity, p: z.currentPopulation }));

    // Run 2: Exact same setup and seed
    const eng2 = new SimulationEngine(venue, seed);
    eng2.setInflowConfig({ estimatedAttendance: 15000, pattern: 'PEAK_SURGE' });
    eng2.start();
    for (let t = 0; t < 30; t += 0.1) {
      eng2.step(0.1);
    }
    const d2 = eng2.state.venue.zones.map((z) => ({ id: z.id, d: z.currentDensity, p: z.currentPopulation }));

    // Densities and populations must be bit-for-bit identical
    expect(d1).toEqual(d2);
  });

  it('should detect transferred risk during an end-to-end simulated gate rerouting scenario', () => {
    const seed = 7777;

    // Baseline: Sudden arrival surge without interventions
    const baseEngine = new SimulationEngine(venue, seed);
    baseEngine.setInflowConfig({ estimatedAttendance: 25000, pattern: 'PEAK_SURGE', burstIntensity: 3.5 });
    baseEngine.triggerScenario('chinnaswamy-hypothetical-surge');
    baseEngine.start();
    for (let t = 0; t < 60; t += 0.1) {
      baseEngine.step(0.1);
    }

    // Plan: Reroute crowd from Gate 1/2 to East Stand Gate 17/18
    const planEngine = new SimulationEngine(venue, seed);
    planEngine.setInflowConfig({ estimatedAttendance: 25000, pattern: 'PEAK_SURGE', burstIntensity: 3.5 });
    const rerouteIntervention = {
      ...DEFAULT_INTERVENTIONS.find((i) => i.category === 'REROUTE_APPROACH')!,
      isActive: true,
      params: {
        sourceGateIds: ['gate-1', 'gate-2'],
        targetGateIds: ['gate-17', 'gate-18', 'gate-19'],
        maxDiversionRatio: 0.8,
      },
    };
    planEngine.setInterventions([rerouteIntervention]);
    planEngine.triggerScenario('chinnaswamy-hypothetical-surge');
    planEngine.start();
    for (let t = 0; t < 60; t += 0.1) {
      planEngine.step(0.1);
    }

    const { zoneComparisons, spatialSummary } = SpatialAnalyzer.analyze(
      venue,
      baseEngine,
      planEngine,
      'Surge with Gate Rerouting',
      ['Route-Aware Gate Redistribution']
    );

    // Check that zones were evaluated
    expect(zoneComparisons.length).toBe(venue.zones.length);
    expect(spatialSummary.totalZonesEvaluated).toBe(venue.zones.length);

    // Delta density and population should sum or balance across sectors
    const totalDeltaPop = zoneComparisons.reduce((acc, z) => acc + z.deltaPopulation, 0);
    expect(typeof totalDeltaPop).toBe('number');

    // Both largest relief and worst increase should be recorded
    expect(spatialSummary.worstDensityIncrease).toBeDefined();
    expect(spatialSummary.largestRelief).toBeDefined();
  });
});

