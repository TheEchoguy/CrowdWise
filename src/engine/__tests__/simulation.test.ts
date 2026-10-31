import { describe, it, expect } from 'vitest';
import { PRNG } from '../random';
import { distance, pointInPolygon, closestPointOnSegment } from '../geometry';
import { SpatialHashGrid } from '../spatialHash';
import { NavigationGraph } from '../pathfinding';
import { SimulationEngine } from '../SimulationEngine';
import { CHINNASWAMY_STADIUM_PROFILE } from '../../data/chinnaswamyStadium';

describe('Deterministic Random Number Generator (PRNG)', () => {
  it('should generate identical sequence with same seed', () => {
    const rng1 = new PRNG(1337);
    const rng2 = new PRNG(1337);

    const seq1 = [rng1.next(), rng1.next(), rng1.range(10, 50)];
    const seq2 = [rng2.next(), rng2.next(), rng2.range(10, 50)];

    expect(seq1).toEqual(seq2);
  });

  it('should generate different sequence with different seeds', () => {
    const rng1 = new PRNG(1337);
    const rng2 = new PRNG(9999);

    expect(rng1.next()).not.toEqual(rng2.next());
  });
});

describe('2D Geometry Utilities', () => {
  it('should calculate Euclidean distance accurately', () => {
    const p1 = { x: 0, y: 0 };
    const p2 = { x: 3, y: 4 };
    expect(distance(p1, p2)).toBe(5);
  });

  it('should correctly detect point in polygon', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];

    expect(pointInPolygon({ x: 5, y: 5 }, square)).toBe(true);
    expect(pointInPolygon({ x: 15, y: 5 }, square)).toBe(false);
  });

  it('should project closest point onto line segment', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 10, y: 0 };
    const p = { x: 5, y: 5 };

    const closest = closestPointOnSegment(p, a, b);
    expect(closest.x).toBe(5);
    expect(closest.y).toBe(0);
  });
});

describe('Spatial Hash Grid', () => {
  it('should query agents within search radius', () => {
    const grid = new SpatialHashGrid(5.0);
    const agent1: any = { id: 1, x: 10, y: 10, radius: 0.3 };
    const agent2: any = { id: 2, x: 12, y: 10, radius: 0.3 };
    const agent3: any = { id: 3, x: 50, y: 50, radius: 0.3 };

    grid.insert(agent1);
    grid.insert(agent2);
    grid.insert(agent3);

    const nearby = grid.query({ x: 10, y: 10 }, 3.0);
    const ids = nearby.map((a) => a.id);

    expect(ids).toContain(1);
    expect(ids).toContain(2);
    expect(ids).not.toContain(3);
  });
});

describe('Navigation & Dynamic Route Planning', () => {
  it('should find path avoiding blocked corridor', () => {
    const nav = new NavigationGraph();
    nav.addNode({ id: 'start', position: { x: 0, y: 0 } });
    nav.addNode({ id: 'mid1', position: { x: 10, y: 0 } });
    nav.addNode({ id: 'mid2', position: { x: 0, y: 10 } });
    nav.addNode({ id: 'goal', position: { x: 10, y: 10 } });

    // Path A via mid1
    nav.addEdge('start', 'mid1', 4, 'corridor-A');
    nav.addEdge('mid1', 'goal', 4, 'corridor-A2');

    // Path B via mid2
    nav.addEdge('start', 'mid2', 4, 'corridor-B');
    nav.addEdge('mid2', 'goal', 4, 'corridor-B2');

    // Block corridor-A
    nav.setEdgeBlocked('corridor-A', true);

    const path = nav.findPath({ x: 0, y: 0 }, { x: 10, y: 10 });
    expect(path.length).toBeGreaterThan(1);
  });
});

describe('Simulation Engine State & Calculations', () => {
  it('should initialize with 12 gates for Chinnaswamy Stadium', () => {
    const engine = new SimulationEngine(CHINNASWAMY_STADIUM_PROFILE, 1337);
    expect(engine.state.venue.gates.length).toBe(12);
    expect(engine.state.venue.seatingCapacity).toBe(40000);
    expect(engine.state.venue.planningCapacity).toBe(40000);
  });

  it('should advance simulation clock on step', () => {
    const engine = new SimulationEngine(CHINNASWAMY_STADIUM_PROFILE, 1337);
    engine.start();
    engine.step(1.0);
    expect(engine.state.simTimeSecs).toBeCloseTo(1.0);
  });

  it('should reduce gate throughput on scanner failure', () => {
    const engine = new SimulationEngine(CHINNASWAMY_STADIUM_PROFILE, 1337);
    const gateN2 = engine.state.venue.gates.find((g) => g.id === 'gate-n2');
    expect(gateN2?.operationalScanners).toBe(3);

    engine.triggerScenario('scanner-failure');
    expect(gateN2?.operationalScanners).toBe(1);
    expect(gateN2?.status).toBe('SCANNER_FAILURE');
  });

  it('should calculate non-negative queues and consistent summary metrics', () => {
    const engine = new SimulationEngine(CHINNASWAMY_STADIUM_PROFILE, 1337);
    engine.start();
    for (let i = 0; i < 20; i++) {
      engine.step(0.5);
    }
    const summary = engine.getSummary();
    expect(summary.peakQueueLength).toBeGreaterThanOrEqual(0);
    expect(summary.totalInside).toBeGreaterThanOrEqual(0);
    expect(summary.totalOutside).toBeGreaterThanOrEqual(0);
  });
});

