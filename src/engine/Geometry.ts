import {
  Wall,
  Gate,
  ScenarioType,
  ScenarioGeometry,
  StadiumViewMode,
  GateCompound,
  SecurityCounter,
  ActiveGateSector,
  RoadSectorId
} from '../types/simulation';
import {
  KSCA_STADIUM_SECTORS,
  KSCA_OUTER_GATES,
  KSCA_INNER_GATES,
  OuterGate,
  InnerGate
} from './ChinnaswamyData';

/**
 * Generates dynamic security screening counters distributed evenly across a gate compound
 */
export function generateSecurityCounters(
  _gateId: string,
  centerX: number,
  compoundWidth: number,
  counterY: number,
  counterCount: number
): SecurityCounter[] {
  const counters: SecurityCounter[] = [];
  const count = Math.max(1, counterCount);
  const spacing = compoundWidth / count;
  const startX = centerX - compoundWidth / 2;

  for (let i = 0; i < count; i++) {
    const cx = startX + spacing * (i + 0.5);
    counters.push({
      id: i + 1,
      x: cx,
      y: counterY,
      width: Math.min(28, spacing * 0.8),
      height: 20,
      isOccupied: false,
      occupantAgentId: null,
      processingRemaining: 0,
      totalProcessed: 0,
      status: 'IDLE'
    });
  }

  return counters;
}

/**
 * Creates a multi-stage Gate Compound (Fast NFC Scan Bar + Security Screening Counters)
 */
export function createGateCompound(
  id: string,
  name: string,
  centerX: number,
  counterY: number,
  compoundWidth: number,
  scanBarY: number,
  counterCount: number,
  active: boolean
): GateCompound {
  return {
    id,
    name,
    x: centerX,
    y: counterY,
    width: compoundWidth,
    active,
    scanBarY,
    counters: generateSecurityCounters(id, centerX, compoundWidth, counterY, counterCount)
  };
}

/**
 * Calculates unobstructed forward feeder lane waypoints for sector concourses:
 * Street Sidewalk -> Outer Security Frisking (E) -> Holding Concourse -> Inner Turnstiles (G) -> Vomitory Stairwells
 */
export function getSectorWaypoints(
  sector: RoadSectorId,
  targetInnerGateId: string,
  startY: number
): { x: number; y: number }[] {
  const sectorData = KSCA_STADIUM_SECTORS[sector] || KSCA_STADIUM_SECTORS.LINK_ROAD;
  const innerGate = sectorData.innerGates.find((g) => g.id === targetInnerGateId) || sectorData.innerGates[0];

  const targetX = innerGate.x;
  const turnstileY = innerGate.y; // e.g. 160

  return [
    { x: targetX + (Math.random() - 0.5) * 40, y: Math.max(startY - 40, 430) }, // 1. Outer Street Sidewalk & Frisking Entrance
    { x: targetX + (Math.random() - 0.5) * 20, y: 320 },                          // 2. Wide Intermediate Holding Concourse
    { x: targetX, y: 220 },                                                        // 3. Automated NFC Scan Line Approach
    { x: targetX, y: turnstileY + 10 },                                            // 4. Turnstile Throat
    { x: targetX, y: turnstileY - 45 },                                            // 5. Post-Turnstile Vomitory Portal
    { x: targetX + (Math.random() - 0.5) * 30, y: 40 }                             // 6. Seating Bowl Grandstand Tier
  ];
}

/**
 * Backward compatibility alias for legacy waypoints
 */
export function getSCurveWaypoints(
  gateCenterX: number,
  _gateLeft: number,
  _gateRight: number,
  scanBarY: number,
  startY: number
): { x: number; y: number }[] {
  return [
    { x: gateCenterX, y: Math.max(startY - 40, 360) },
    { x: gateCenterX, y: 260 },
    { x: gateCenterX, y: scanBarY + 8 },
    { x: gateCenterX, y: 40 }
  ];
}

export function getGate2Waypoints(gate2X: number, scanBarY: number, startY: number) {
  return [
    { x: gate2X, y: Math.max(startY - 40, 360) },
    { x: gate2X, y: 260 },
    { x: gate2X, y: scanBarY + 8 },
    { x: gate2X, y: 40 }
  ];
}

export function getSouthWaypoints(_targetX: number, _scanBarY: number, startY: number) {
  return getSectorWaypoints('MG_ROAD', 'G1', startY);
}

export function getNorthWaypoints(_targetX: number, _scanBarY: number, startY: number) {
  return getSectorWaypoints('CUBBON_ROAD', 'G7', startY);
}

export function getWestWaypoints(_targetX: number, _scanBarY: number, startY: number) {
  return getSectorWaypoints('QUEENS_ROAD', 'G4', startY);
}

export function getZigZagWaypoints(gateX: number, gateY: number, startY: number) {
  return getSCurveWaypoints(gateX, gateX - 100, gateX + 100, gateY, startY);
}

/**
 * Main Scenario & Sector Geometry Generator
 * Replaces artificial S-curves with real KSCA 2-tier concourses and 360° Macro boundaries
 */
export function getScenarioGeometry(
  scenario: ScenarioType,
  width: number,
  height: number,
  _bafflesActive: boolean = false,
  _auxGateActive: boolean = false,
  dividerActive: boolean = false,
  stadiumViewMode: StadiumViewMode = 'MACRO_VIEW',
  _overflowRerouteActive: boolean = false,
  _counterCountGate1: number = 4,
  _counterCountGate2: number = 3,
  _sQueueEnabled: boolean = true,
  activeGateSector?: ActiveGateSector | RoadSectorId
): ScenarioGeometry {
  const walls: Wall[] = [];
  const gates: Gate[] = [];
  const baffles: Wall[] = [];
  const compounds: GateCompound[] = [];

  if (scenario === 'stadium') {
    if (stadiumViewMode === 'MACRO_VIEW') {
      // =========================================================================
      // MODE A: Full Chinnaswamy Stadium Satellite Radar
      // =========================================================================
      const cx = 485;
      const cy = 260;
      const rx = 185;
      const ry = 155;

      // Outer gates from KSCA Ground Truth
      (Object.entries(KSCA_OUTER_GATES) as [string, OuterGate][]).forEach(([id, og]) => {
        gates.push({
          id: `outer-${id}`,
          name: `Gate ${id}`,
          x: og.x,
          y: og.y,
          width: 20,
          height: 16,
          cooldown: 0,
          active: true,
          totalPassed: 0
        });
      });

      // Inner stand turnstile gates
      (Object.entries(KSCA_INNER_GATES) as [string, InnerGate][]).forEach(([id, ig]) => {
        gates.push({
          id: `inner-${id}`,
          name: `${id} (${ig.standName})`,
          x: ig.x,
          y: ig.y,
          width: 18,
          height: 18,
          cooldown: 0,
          active: true,
          totalPassed: 0
        });
      });

      // Stadium bowl outer perimeter wall ring
      const numSegments = 32;
      for (let i = 0; i < numSegments; i++) {
        const rad1 = (i * 2 * Math.PI) / numSegments;
        const rad2 = ((i + 1) * 2 * Math.PI) / numSegments;
        walls.push({
          x1: cx + rx * Math.cos(rad1),
          y1: cy + ry * Math.sin(rad1),
          x2: cx + rx * Math.cos(rad2),
          y2: cy + ry * Math.sin(rad2),
          type: 'boundary',
          color: '#334155',
          thickness: 3
        });
      }

      // Queens Road security diversion wall
      walls.push({
        x1: 170,
        y1: 90,
        x2: 410,
        y2: 500,
        type: 'barrier',
        color: '#ef4444',
        thickness: 3,
        label: 'QUEENS ROAD RESTRICTED PERIMETER'
      });
    } else {
      // =========================================================================
      // MODE B: Real Road Sector Concourse (Quarter-Circle / 1:1 Scale CAD)
      // =========================================================================
      let sectorId: RoadSectorId = 'LINK_ROAD';
      if (activeGateSector === 'CUBBON_ROAD' || activeGateSector === 'G16-G21_NORTH') sectorId = 'CUBBON_ROAD';
      else if (activeGateSector === 'LINK_ROAD' || activeGateSector === 'G1-G6_EAST') sectorId = 'LINK_ROAD';
      else if (activeGateSector === 'MG_ROAD' || activeGateSector === 'G7-G11_SOUTH') sectorId = 'MG_ROAD';
      else if (activeGateSector === 'QUEENS_ROAD' || activeGateSector === 'G12-G15_WEST') sectorId = 'QUEENS_ROAD';

      const secData = KSCA_STADIUM_SECTORS[sectorId] || KSCA_STADIUM_SECTORS.LINK_ROAD;

      // Outer Sidewalk & Curb Line (Bottom boundary along arrival road)
      walls.push({
        x1: 60,
        y1: 470,
        x2: width - 60,
        y2: 470,
        type: 'boundary',
        color: '#64748b',
        thickness: 4,
        label: secData.roadLabel
      });

      // Intermediate Holding Concourse Barriers (Sides)
      walls.push({
        x1: 100,
        y1: 470,
        x2: 120,
        y2: 240,
        type: 'boundary',
        color: '#475569',
        thickness: 4
      });
      walls.push({
        x1: width - 100,
        y1: 470,
        x2: width - 120,
        y2: 240,
        type: 'boundary',
        color: '#475569',
        thickness: 4
      });

      // Inner Stand Turnstile Bank Facility
      const mainCompound = createGateCompound(
        `compound-${sectorId}`,
        secData.name,
        width / 2,
        160,
        secData.innerGates.length * 80 + 40,
        220,
        secData.innerGates.length,
        true
      );
      compounds.push(mainCompound);

      // Create gates for each inner gate in this sector
      secData.innerGates.forEach((ig) => {
        gates.push({
          id: ig.id,
          name: `${ig.id} - ${ig.stand}`,
          x: ig.x,
          y: ig.y,
          width: 32,
          height: 22,
          cooldown: 0,
          active: true,
          totalPassed: 0
        });
      });

      // Inner Bowl Wall & Vomitory Portals (Top concourse)
      walls.push({
        x1: 140,
        y1: 80,
        x2: width - 140,
        y2: 80,
        type: 'barrier',
        color: '#334155',
        thickness: 5,
        label: 'INNER STADIUM GRANDSTAND PERIMETER'
      });
    }
  } else {
    // Legacy fallback for bridge / reversal scenarios
    walls.push({ x1: 50, y1: height - 80, x2: width - 50, y2: height - 80, type: 'boundary', color: '#64748b', thickness: 3 });
    gates.push({ id: 'gate-fallback', name: 'Main Gate', x: width / 2, y: 120, width: 40, height: 20, cooldown: 0, active: true });
    if (dividerActive) {
      walls.push({ x1: width / 2, y1: height - 80, x2: width / 2, y2: 160, type: 'divider', color: '#0ea5e9', thickness: 3 });
    }
  }

  return { walls, gates, baffles, compounds, viewMode: stadiumViewMode };
}
