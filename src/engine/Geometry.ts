import { Wall, Gate, ScenarioType, ScenarioGeometry, StadiumViewMode, GateCompound, SecurityCounter, ActiveGateSector } from '../types/simulation';

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
 * Creates a multi-stage Gate Compound (Stage 2: NFC Scan Bar + Stage 3: Security Screening Counters)
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
 * S-Lane Corridor Flow Zone Definitions (Bounding Boxes & Dominant Vectors)
 */
export interface SLaneDef {
  id: 'lane1' | 'lane2' | 'lane3';
  yMin: number;
  yMax: number;
  xMin: number;
  xMax: number;
  dirX: 1 | -1; // +1 for WEST to EAST (+X), -1 for EAST to WEST (-X)
  targetY: number;
}

export const S_LANE_DEFINITIONS: SLaneDef[] = [
  { id: 'lane1', yMin: 250, yMax: 290, xMin: 220, xMax: 505, dirX: 1, targetY: 270 },
  { id: 'lane2', yMin: 190, yMax: 230, xMin: 220, xMax: 505, dirX: -1, targetY: 210 },
  { id: 'lane3', yMin: 130, yMax: 170, xMin: 220, xMax: 505, dirX: 1, targetY: 150 }
];

/**
 * Calculates sequential centerline waypoints through the Wide Queue Hopper & 3-Tier S-Queue:
 * WP_HopperMouth (120px) -> WP_HopperNeck (60px) -> Lane 1 (East) -> U-Turn 1 (Up) ->
 * Lane 2 (West) -> U-Turn 2 (Up) -> Lane 3 (East) -> Fast-Scan Line
 */
export function getSCurveWaypoints(
  gateCenterX: number,
  gateLeft: number,
  gateRight: number,
  scanBarY: number,
  _startY: number
): { x: number; y: number }[] {
  const sLeft = gateLeft + 25;   // 230
  const sRight = gateRight - 25; // 500
  const hopperCenterX = 260;     // Centerline of 140px mouth at y=350 & 60px neck at y=280
  const yLane1 = 270;            // Centerline of Lane 1 (y in [250, 290])
  const yLane2 = 210;            // Centerline of Lane 2 (y in [190, 230])
  const yLane3 = 150;            // Centerline of Lane 3 (y in [130, 170])

  return [
    { x: hopperCenterX, y: 350 },           // 1. Wide Queue Hopper Entrance (Width 140px mouth)
    { x: hopperCenterX, y: 280 },           // 2. Hopper Funnel Neck (Width 60px start of Lane 1)
    { x: hopperCenterX + 25, y: yLane1 },   // 3. Lane 1 Start: West to East flow (+X)
    { x: sRight - 25, y: yLane1 },          // 4. Lane 1 Eastbound End
    { x: sRight - 25, y: yLane2 },          // 5. U-Turn 1: Turn up into Lane 2
    { x: sLeft + 25, y: yLane2 },           // 6. Lane 2 Westbound End (-X)
    { x: sLeft + 25, y: yLane3 },           // 7. U-Turn 2: Turn up into Lane 3
    { x: sRight - 40, y: yLane3 },          // 8. Lane 3 Eastbound End (+X)
    { x: gateCenterX, y: scanBarY + 8 }     // 9. Fast-Scan Ingress Bar (0.2s Auto-Tap)
  ];
}

/**
 * Backward compatibility alias for S-Curve switchback waypoints
 */
export function getZigZagWaypoints(
  gateX: number,
  gateY: number,
  startY: number
): { x: number; y: number }[] {
  return getSCurveWaypoints(gateX, gateX - 160, gateX + 160, gateY - 20, startY);
}

/**
 * Calculates clean, unobstructed diagonal feeder lane waypoints leading from the
 * right plaza directly into Gate 2 Dedicated Express Lane (bypassing Gate 1's S-queue completely).
 */
export function getGate2Waypoints(
  gate2X: number,
  scanBarY: number,
  startY: number
): { x: number; y: number }[] {
  return [
    { x: Math.max(580, gate2X - 80), y: Math.max(startY, 345) }, // 1. Dedicated right plaza express entry
    { x: gate2X - 30, y: 220 },                                   // 2. Unobstructed diagonal express channel
    { x: gate2X, y: 120 },                                        // 3. Gate 2 gantry approach
    { x: gate2X, y: scanBarY + 8 }                                // 4. Gate 2 Fast-Scan Bar
  ];
}

export function getSouthWaypoints(
  targetX: number,
  scanBarY: number,
  startY: number
): { x: number; y: number }[] {
  return [
    { x: targetX, y: Math.max(startY - 40, 330) },
    { x: targetX, y: 220 },
    { x: targetX, y: 130 },
    { x: targetX, y: scanBarY + 8 }
  ];
}

export function getNorthWaypoints(
  targetX: number,
  scanBarY: number,
  startY: number
): { x: number; y: number }[] {
  const hopperStagingX = targetX < 480 ? 400 : 560;
  return [
    { x: hopperStagingX, y: Math.max(startY - 30, 340) },
    { x: targetX, y: 230 },
    { x: targetX, y: 130 },
    { x: targetX, y: scanBarY + 8 }
  ];
}

export function getWestWaypoints(
  targetX: number,
  scanBarY: number,
  startY: number
): { x: number; y: number }[] {
  return [
    { x: targetX, y: Math.max(startY - 50, 300) },
    { x: targetX, y: 180 },
    { x: targetX, y: 120 },
    { x: targetX, y: scanBarY + 8 }
  ];
}

/**
 * CROWDWISE — M. Chinnaswamy Stadium Digital Twin Vector Geometry Pipeline
 * Dual-Mode Vector Model:
 * 1. MACRO_VIEW: Full Oval Stadium Radar (Pitch, 4 Grandstands, 21 Perimeter Gates)
 * 2. MICRO_VIEW_EAST: Detailed 1:1 Concourse Vector Model (MG Road Metro Feed, 320px Gate 1 Compound, S-Queue)
 */
export function getScenarioGeometry(
  scenario: ScenarioType,
  width: number,
  height: number,
  bafflesActive: boolean,
  auxGateActive: boolean,
  dividerActive: boolean,
  stadiumViewMode: StadiumViewMode = 'MICRO_VIEW_EAST',
  overflowRerouteActive: boolean = false,
  gate1Counters: number = 4,
  gate2Counters: number = 3,
  sQueueEnabled: boolean = true,
  activeGateSector: ActiveGateSector = 'G1-G6_EAST'
): ScenarioGeometry {
  const walls: Wall[] = [];
  const gates: Gate[] = [];
  const baffles: Wall[] = [];
  const compounds: GateCompound[] = [];

  if (scenario === 'stadium') {
    if (stadiumViewMode === 'MACRO_VIEW') {
      // =========================================================================
      // MACRO_VIEW: Full Chinnaswamy Stadium Radar (35,000 Capacity Oval)
      // =========================================================================
      const cx = width / 2;
      const cy = height / 2;
      const rx = width * 0.42;
      const ry = height * 0.38;

      const innerRx = width * 0.28;
      const innerRy = height * 0.25;

      const gateAngles: { num: number; angleDeg: number; sector: 'EAST' | 'WEST' | 'NORTH' | 'SOUTH'; name: string }[] = [
        { num: 1, angleDeg: -35, sector: 'EAST', name: 'GATE 1 (Metro Feed)' },
        { num: 2, angleDeg: -20, sector: 'EAST', name: 'GATE 2 (Metro Feed)' },
        { num: 3, angleDeg: -5, sector: 'EAST', name: 'GATE 3 (East Ingress)' },
        { num: 4, angleDeg: 10, sector: 'EAST', name: 'GATE 4 (East Ingress)' },
        { num: 5, angleDeg: 25, sector: 'EAST', name: 'GATE 5 (East Bypass)' },
        { num: 6, angleDeg: 40, sector: 'EAST', name: 'GATE 6 (East Bypass)' },

        { num: 7, angleDeg: 60, sector: 'SOUTH', name: 'GATE 7 (Cubbon Rd)' },
        { num: 8, angleDeg: 75, sector: 'SOUTH', name: 'GATE 8 (Cubbon Rd)' },
        { num: 9, angleDeg: 90, sector: 'SOUTH', name: 'GATE 9 (South Main)' },
        { num: 10, angleDeg: 105, sector: 'SOUTH', name: 'GATE 10 (South Concourse)' },
        { num: 11, angleDeg: 120, sector: 'SOUTH', name: 'GATE 11 (South Gate)' },

        { num: 12, angleDeg: 145, sector: 'WEST', name: 'GATE 12 (Club House)' },
        { num: 13, angleDeg: 165, sector: 'WEST', name: 'GATE 13 (VIP Carriageway)' },
        { num: 14, angleDeg: 195, sector: 'WEST', name: 'GATE 14 (Corporate Pavilion)' },
        { num: 15, angleDeg: 215, sector: 'WEST', name: 'GATE 15 (Media Concourse)' },

        { num: 16, angleDeg: 240, sector: 'NORTH', name: 'GATE 16 (North Ingress)' },
        { num: 17, angleDeg: 255, sector: 'NORTH', name: 'GATE 17 (North Ingress)' },
        { num: 18, angleDeg: 270, sector: 'NORTH', name: 'GATE 18 (Queen’s Rd)' },
        { num: 19, angleDeg: 285, sector: 'NORTH', name: 'GATE 19 (North Concourse)' },
        { num: 20, angleDeg: 300, sector: 'NORTH', name: 'GATE 20 (General Stand)' },
        { num: 21, angleDeg: 315, sector: 'NORTH', name: 'GATE 21 (Student Stand)' }
      ];

      gateAngles.forEach((g) => {
        const rad = (g.angleDeg * Math.PI) / 180;
        const gx = cx + rx * Math.cos(rad);
        const gy = cy + ry * Math.sin(rad);

        gates.push({
          id: `gate-chinnaswamy-${g.num}`,
          name: g.name,
          gateNumber: g.num,
          sector: g.sector,
          x: gx,
          y: gy,
          width: 22,
          height: 18,
          cooldown: 0,
          active: true,
          totalPassed: 0
        });
      });

      const sorted = [...gateAngles].sort((a, b) => a.angleDeg - b.angleDeg);
      for (let i = 0; i < sorted.length; i++) {
        const curr = sorted[i];
        const next = sorted[(i + 1) % sorted.length];
        const rad1 = ((curr.angleDeg + 4) * Math.PI) / 180;
        const rad2 = ((next.angleDeg - 4) * Math.PI) / 180;

        walls.push({
          x1: cx + rx * Math.cos(rad1),
          y1: cy + ry * Math.sin(rad1),
          x2: cx + rx * Math.cos(rad2),
          y2: cy + ry * Math.sin(rad2),
          type: 'boundary',
          color: '#334155',
          thickness: 4
        });
      }

      const dividerAnglesDeg = [48, 132, 228, 328];
      dividerAnglesDeg.forEach((deg, idx) => {
        const rad = (deg * Math.PI) / 180;
        walls.push({
          x1: cx + innerRx * Math.cos(rad),
          y1: cy + innerRy * Math.sin(rad),
          x2: cx + rx * Math.cos(rad),
          y2: cy + ry * Math.sin(rad),
          type: 'divider',
          color: '#0ea5e9',
          thickness: 3,
          label: `SECTOR PARTITION ${idx + 1}`
        });
      });
    } else if (activeGateSector === 'G7-G11_SOUTH') {
      // =========================================================================
      // SOUTH STAND (GATES 7–11) CONCOURSE: Cubbon Road Feeder
      // 4 Turnstiles, Straight Stanchion Lanes (x = 320, 400, 480, 560, 640)
      // =========================================================================
      const compoundX = width * 0.5;
      const compoundWidth = 320;
      const counterY = 55;
      const scanBarY = 80;

      const southCompound = createGateCompound(
        'gate-south',
        'SOUTH STAND (G7-11) CONCOURSE',
        compoundX,
        counterY,
        compoundWidth,
        scanBarY,
        4,
        true
      );
      compounds.push(southCompound);

      gates.push({
        id: 'gate-south',
        name: 'SOUTH GATES 7–11',
        gateNumber: 7,
        sector: 'SOUTH',
        x: compoundX,
        y: counterY,
        width: compoundWidth,
        height: 32,
        cooldown: 0,
        active: true,
        totalPassed: 0,
        compound: southCompound
      });

      // Perimeter boundaries
      walls.push(
        { x1: 240, y1: height - 40, x2: 240, y2: 105, type: 'boundary', color: '#64748b', thickness: 5, label: 'Cubbon Rd West' },
        { x1: 720, y1: height - 40, x2: 720, y2: 105, type: 'boundary', color: '#64748b', thickness: 5, label: 'Cubbon Rd East' },
        { x1: 240, y1: 105, x2: compoundX - compoundWidth / 2 - 10, y2: counterY - 20, type: 'funnel', color: '#475569', thickness: 4 },
        { x1: 720, y1: 105, x2: compoundX + compoundWidth / 2 + 10, y2: counterY - 20, type: 'funnel', color: '#475569', thickness: 4 }
      );

      // Straight vertical stanchion lane dividers (4 parallel lanes)
      const stanchionXs = [320, 400, 480, 560, 640];
      stanchionXs.forEach((lx, i) => {
        const wall: Wall = {
          x1: lx,
          y1: 120,
          x2: lx,
          y2: 300,
          type: 'barrier',
          color: '#a855f7',
          thickness: 4,
          label: `South Stanchion ${i + 1}`
        };
        walls.push(wall);
        baffles.push(wall);
      });
    } else if (activeGateSector === 'G16-G21_NORTH') {
      // =========================================================================
      // NORTH STAND (GATES 16–21) CONCOURSE: Queen's Road Bus Feed
      // 5 Turnstiles, Dual-Hopper Wide Channels
      // =========================================================================
      const compoundX = width * 0.5;
      const compoundWidth = 350;
      const counterY = 55;
      const scanBarY = 80;

      const northCompound = createGateCompound(
        'gate-north',
        'NORTH BUS CONCOURSE (G16-21)',
        compoundX,
        counterY,
        compoundWidth,
        scanBarY,
        5,
        true
      );
      compounds.push(northCompound);

      gates.push({
        id: 'gate-north',
        name: 'NORTH GATES 16–21',
        gateNumber: 16,
        sector: 'NORTH',
        x: compoundX,
        y: counterY,
        width: compoundWidth,
        height: 32,
        cooldown: 0,
        active: true,
        totalPassed: 0,
        compound: northCompound
      });

      // Boundaries
      walls.push(
        { x1: 210, y1: height - 40, x2: 210, y2: 105, type: 'boundary', color: '#64748b', thickness: 5, label: "Queen's Rd West" },
        { x1: 750, y1: height - 40, x2: 750, y2: 105, type: 'boundary', color: '#64748b', thickness: 5, label: "Queen's Rd East" },
        { x1: 210, y1: 105, x2: compoundX - compoundWidth / 2 - 10, y2: counterY - 20, type: 'funnel', color: '#38bdf8', thickness: 4 },
        { x1: 750, y1: 105, x2: compoundX + compoundWidth / 2 + 10, y2: counterY - 20, type: 'funnel', color: '#38bdf8', thickness: 4 }
      );

      // Dual-Hopper guide funnels
      const northWalls: Wall[] = [
        { x1: 250, y1: 340, x2: 340, y2: 230, type: 'funnel', color: '#38bdf8', thickness: 5, label: 'North Hopper Left' },
        { x1: 710, y1: 340, x2: 620, y2: 230, type: 'funnel', color: '#38bdf8', thickness: 5, label: 'North Hopper Right' },
        { x1: 480, y1: 350, x2: 480, y2: 190, type: 'divider', color: '#0284c7', thickness: 5, label: 'Central Channel Island' }
      ];
      walls.push(...northWalls);
      baffles.push(...northWalls);
    } else if (activeGateSector === 'G12-G15_WEST') {
      // =========================================================================
      // WEST PAVILION (GATES 12–15): VIP / Club Doors
      // 3 Turnstiles / Wide VIP Gates, Open Unobstructed Ingress
      // =========================================================================
      const compoundX = width * 0.5;
      const compoundWidth = 300;
      const counterY = 55;
      const scanBarY = 80;

      const westCompound = createGateCompound(
        'gate-west',
        'WEST PAVILION VIP DOORS (G12-15)',
        compoundX,
        counterY,
        compoundWidth,
        scanBarY,
        3,
        true
      );
      compounds.push(westCompound);

      gates.push({
        id: 'gate-west',
        name: 'WEST VIP GATES 12–15',
        gateNumber: 12,
        sector: 'WEST',
        x: compoundX,
        y: counterY,
        width: compoundWidth,
        height: 32,
        cooldown: 0,
        active: true,
        totalPassed: 0,
        compound: westCompound
      });

      // Boundaries & velvet rope dividers
      walls.push(
        { x1: 270, y1: height - 40, x2: 270, y2: 105, type: 'boundary', color: '#eab308', thickness: 4, label: 'VIP West Boundary' },
        { x1: 690, y1: height - 40, x2: 690, y2: 105, type: 'boundary', color: '#eab308', thickness: 4, label: 'VIP East Boundary' },
        { x1: 270, y1: 105, x2: compoundX - compoundWidth / 2 - 10, y2: counterY - 20, type: 'funnel', color: '#eab308', thickness: 4 },
        { x1: 690, y1: 105, x2: compoundX + compoundWidth / 2 + 10, y2: counterY - 20, type: 'funnel', color: '#eab308', thickness: 4 }
      );

      const vipRopes: Wall[] = [
        { x1: 340, y1: 130, x2: 340, y2: 280, type: 'barrier', color: '#eab308', thickness: 4, label: 'VIP Stanchion Left' },
        { x1: 620, y1: 130, x2: 620, y2: 280, type: 'barrier', color: '#eab308', thickness: 4, label: 'VIP Stanchion Right' }
      ];
      walls.push(...vipRopes);
      baffles.push(...vipRopes);
    } else {
      // =========================================================================
      // EAST STAND (GATES 1–6) CONCOURSE: MG Road Metro Feed
      // 320px Gate 1 Ingress Facility with 3-Tier S-Queue & Gate 2 Auxiliary Bypass
      // =========================================================================
      const boulevardLeft = width * 0.12;
      const boulevardRight = width * 0.88;
      const gate1X = 365;          // Gate 1 Facility Center
      const gate1Width = 320;      // Wide Gate 1 Facility (320px)
      const gate2X = width * 0.77; // Gate 2 Auxiliary Bypass Compound
      const gate2Width = 190;      // Auxiliary wide compound
      const counterY = 55;         // Security Gantry (Screening Booths)
      const scanBarY = 80;         // Automated Scanner Line: 25px below counters

      const isBypassActive = auxGateActive || overflowRerouteActive;
      const isSQueueActive = sQueueEnabled || bafflesActive;

      // Gate 1 Multi-Stage Compound (Stage 2 NFC + Stage 3 Screening Counters)
      const gate1Compound = createGateCompound(
        'gate-1',
        'GATE 1 INGRESS FACILITY',
        gate1X,
        counterY,
        gate1Width,
        scanBarY,
        gate1Counters,
        true
      );

      // Gate 2 Multi-Stage Compound
      const gate2Compound = createGateCompound(
        'gate-2',
        'GATE 2 AUXILIARY BYPASS',
        gate2X,
        counterY,
        gate2Width,
        scanBarY,
        gate2Counters,
        isBypassActive
      );

      compounds.push(gate1Compound, gate2Compound);

      // Gate 1: Primary East Main Ingress
      gates.push({
        id: 'gate-1',
        name: 'GATE 1 INGRESS FACILITY',
        gateNumber: 1,
        sector: 'EAST',
        x: gate1X,
        y: counterY,
        width: gate1Width,
        height: 32,
        cooldown: 0,
        active: true,
        totalPassed: 0,
        compound: gate1Compound
      });

      // Gate 2: East Auxiliary Bypass
      gates.push({
        id: 'gate-2',
        name: 'GATE 2 AUXILIARY BYPASS',
        gateNumber: 2,
        sector: 'EAST',
        x: gate2X,
        y: counterY,
        width: gate2Width,
        height: 32,
        cooldown: 0,
        active: isBypassActive,
        totalPassed: 0,
        compound: gate2Compound
      });

      const collar1Left = gate1X - gate1Width / 2;   // 205
      const collar1Right = gate1X + gate1Width / 2;  // 525
      const collar2Left = gate2X - gate2Width / 2;
      const collar2Right = gate2X + gate2Width / 2;

      // Concourse Perimeter Enclosure Walls (Spacious wide boulevard, no narrow triangle pinch)
      walls.push(
        // Outer Left Perimeter Wall (MG Road West boundary)
        { x1: boulevardLeft, y1: height - 40, x2: boulevardLeft, y2: 120, type: 'boundary', color: '#475569', thickness: 5, label: 'MG Road Boundary' },
        { x1: boulevardLeft, y1: 120, x2: collar1Left - 15, y2: 105, type: 'boundary', color: '#475569', thickness: 4 },
        // Outer Left Collar to Security Gantry
        { x1: collar1Left - 15, y1: 105, x2: collar1Left - 15, y2: counterY - 25, type: 'funnel', color: '#64748b', thickness: 4 }
      );

      if (isBypassActive) {
        // Dynamic Partition between Gate 1 Facility and Gate 2 Bypass
        walls.push(
          { x1: collar1Right + 15, y1: counterY - 25, x2: collar1Right + 15, y2: 105, type: 'funnel', color: '#0ea5e9', thickness: 4 },
          { x1: collar1Right + 15, y1: 105, x2: 550, y2: 320, type: 'funnel', color: '#0ea5e9', thickness: 4, label: 'DYNAMIC BYPASS PARTITION' },
          // Right Concourse Boundary to Gate 2
          { x1: boulevardRight, y1: height - 40, x2: boulevardRight, y2: 120, type: 'boundary', color: '#475569', thickness: 5 },
          { x1: boulevardRight, y1: 120, x2: collar2Right + 10, y2: 105, type: 'funnel', color: '#0ea5e9', thickness: 4 },
          { x1: collar2Right + 10, y1: 105, x2: collar2Right + 10, y2: counterY - 25, type: 'funnel', color: '#38bdf8', thickness: 4 },
          { x1: collar2Left - 10, y1: 105, x2: collar2Left - 10, y2: counterY - 25, type: 'funnel', color: '#38bdf8', thickness: 4 }
        );
      } else {
        // Gate 2 Closed: Right Concourse Wall funnels smoothly
        walls.push(
          { x1: collar1Right + 15, y1: counterY - 25, x2: collar1Right + 15, y2: 105, type: 'funnel', color: '#64748b', thickness: 4 },
          { x1: collar1Right + 15, y1: 105, x2: boulevardRight, y2: height * 0.45, type: 'boundary', color: '#475569', thickness: 4 },
          { x1: boulevardRight, y1: height * 0.45, x2: boulevardRight, y2: height - 40, type: 'boundary', color: '#475569', thickness: 5 },
          // Closed barrier across Gate 2
          { x1: collar2Left - 15, y1: scanBarY + 15, x2: collar2Right + 15, y2: scanBarY + 15, type: 'barrier', color: '#ef4444', thickness: 5, label: 'GATE 2 CLOSED' }
        );
      }

      // =========================================================================
      // 3-Tier Horizontal S-Shaped Switchback Queuing Structure (The S-Queue)
      // =========================================================================
      if (isSQueueActive) {
        const sLeft = collar1Left + 25;   // 230
        const sRight = collar1Right - 25; // 500
        const turnGap = 50;

        // Outer S-Channel Left & Right Boundary Railings
        const leftBoundaryRail: Wall = {
          x1: sLeft,
          y1: 120,
          x2: sLeft,
          y2: 280,
          type: 'barrier',
          color: '#06b6d4',
          thickness: 4,
          label: 'S-Queue Left Guide'
        };
        const rightBoundaryRail: Wall = {
          x1: sRight,
          y1: 120,
          x2: sRight,
          y2: 290,
          type: 'barrier',
          color: '#06b6d4',
          thickness: 4,
          label: 'S-Queue Right Guide'
        };

        // Top barrier for Lane 3 (leaving exit opening to Fast-Scan on the right side)
        const topLane3Rail: Wall = {
          x1: sLeft,
          y1: 120,
          x2: sRight - 90,
          y2: 120,
          type: 'barrier',
          color: '#06b6d4',
          thickness: 4,
          label: 'Lane 3 Top Guide'
        };

        // Divider 2 (between Lane 2 and Lane 3): Left gap to Right anchored at y = 180
        const divider2Rail: Wall = {
          x1: sLeft + turnGap,
          y1: 180,
          x2: sRight,
          y2: 180,
          type: 'baffle',
          color: '#06b6d4',
          thickness: 5,
          label: 'S-Lane Divider 2'
        };

        // Divider 1 (between Lane 1 and Lane 2): Left anchored to Right gap at y = 240
        const divider1Rail: Wall = {
          x1: sLeft,
          y1: 240,
          x2: sRight - turnGap,
          y2: 240,
          type: 'baffle',
          color: '#06b6d4',
          thickness: 5,
          label: 'S-Lane Divider 1'
        };

        // Bottom barrier of Lane 1 (forces entry exclusively through the Hopper)
        const lane1BottomRail: Wall = {
          x1: 290,
          y1: 290,
          x2: sRight,
          y2: 290,
          type: 'barrier',
          color: '#06b6d4',
          thickness: 4,
          label: 'Lane 1 Barrier'
        };

        // Wide Queue Hopper (Funnel Entrance):
        // Two angled guide walls forming a wide mouth (140px) at y=350 down to 60px at y=280
        const hopperMouthLeft: Wall = {
          x1: 190,
          y1: 350,
          x2: 230,
          y2: 280,
          type: 'funnel',
          color: '#06b6d4',
          thickness: 5,
          label: 'HOPPER LEFT (140px)'
        };
        const hopperMouthRight: Wall = {
          x1: 330,
          y1: 350,
          x2: 290,
          y2: 280,
          type: 'funnel',
          color: '#06b6d4',
          thickness: 5,
          label: 'HOPPER RIGHT (60px)'
        };

        // Outer wing barricades: ensure no agent can walk around outside of queue barriers
        const hopperLeftWing: Wall = {
          x1: boulevardLeft,
          y1: 350,
          x2: 190,
          y2: 350,
          type: 'barrier',
          color: '#475569',
          thickness: 4,
          label: 'WEST PLAZA WING'
        };
        const hopperRightWing: Wall = {
          x1: 330,
          y1: 350,
          x2: 550,
          y2: 350,
          type: 'barrier',
          color: '#475569',
          thickness: 4,
          label: 'EAST PLAZA WING'
        };

        baffles.push(divider2Rail, divider1Rail);
        walls.push(
          leftBoundaryRail,
          rightBoundaryRail,
          topLane3Rail,
          divider2Rail,
          divider1Rail,
          lane1BottomRail,
          hopperMouthLeft,
          hopperMouthRight,
          hopperLeftWing,
          hopperRightWing
        );
      }
    }
  } else if (scenario === 'bridge') {
    // Footbridge: Horizontal corridor
    const topY = height * 0.32;
    const botY = height * 0.68;

    walls.push(
      { x1: 45, y1: topY, x2: width - 45, y2: topY, type: 'boundary', color: '#475569', thickness: 5 },
      { x1: 45, y1: botY, x2: width - 45, y2: botY, type: 'boundary', color: '#475569', thickness: 5 }
    );

    if (dividerActive) {
      const dividerWall: Wall = {
        x1: width * 0.12,
        y1: height * 0.5,
        x2: width * 0.88,
        y2: height * 0.5,
        type: 'divider',
        color: '#06b6d4',
        thickness: 6,
        label: 'CENTRAL ANTI-DEADLOCK DIVIDER'
      };
      walls.push(dividerWall);
    }

    gates.push(
      {
        id: 'gate-bridge-east',
        name: 'EAST PLATFORM EGRESS',
        x: width - 45,
        y: (topY + height * 0.5) / 2,
        width: 22,
        height: 60,
        cooldown: 0,
        active: true,
        totalPassed: 0
      },
      {
        id: 'gate-bridge-west',
        name: 'WEST CONCOURSE EGRESS',
        x: 45,
        y: (botY + height * 0.5) / 2,
        width: 22,
        height: 60,
        cooldown: 0,
        active: true,
        totalPassed: 0
      }
    );
  } else if (scenario === 'reversal') {
    const topY = height * 0.28;
    const botY = height * 0.72;
    const blockX = width - 60;

    walls.push(
      { x1: 50, y1: topY, x2: blockX, y2: topY, type: 'boundary', color: '#475569', thickness: 4 },
      { x1: 50, y1: botY, x2: blockX, y2: botY, type: 'boundary', color: '#475569', thickness: 4 },
      { x1: blockX, y1: topY, x2: blockX, y2: botY, type: 'barrier', color: '#ef4444', thickness: 6, label: 'BLOCKED INGRESS GATE' }
    );

    gates.push({
      id: 'gate-emergency-rear',
      name: 'REAR EMERGENCY EGRESS',
      x: 50,
      y: height * 0.5,
      width: 22,
      height: 70,
      cooldown: 0,
      active: true,
      totalPassed: 0
    });

    if (bafflesActive) {
      const revB1: Wall = {
        x1: width * 0.35,
        y1: topY + 20,
        x2: width * 0.35,
        y2: height * 0.55,
        type: 'baffle',
        color: '#f97316',
        thickness: 6,
        label: 'Reverse Buffer 1'
      };
      const revB2: Wall = {
        x1: width * 0.62,
        y1: height * 0.45,
        x2: width * 0.62,
        y2: botY - 20,
        type: 'baffle',
        color: '#f97316',
        thickness: 6,
        label: 'Reverse Buffer 2'
      };
      baffles.push(revB1, revB2);
      walls.push(revB1, revB2);
    }
  }

  return { walls, gates, baffles, compounds, viewMode: stadiumViewMode };
}
