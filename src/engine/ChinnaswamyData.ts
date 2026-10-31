/**
 * CROWDWISE — M. Chinnaswamy Stadium Official Digital Twin Dataset
 * Theme 03: Simulation, Digital Twins & Synthetic Data
 *
 * Ground Truth Operational Parameters & KSCA Blueprint Specs:
 * - Venue: M. Chinnaswamy Stadium, Bengaluru, Karnataka, India
 * - Total Sanctioned Seating Capacity: 35,000
 * - Transit Feeds: MG Road Metro Station (Purple Line), Cubbon Park Metro, Queen's Road Arterial
 */

export interface InnerGateSpec {
  id: string; // G1 to G14
  stand: string;
  turnstileCount: number;
  baseCapacityPerMin: number;
  x: number;
  y: number;
}

export interface OuterGateSpec {
  id: string; // E1 to E23
  road: 'CUBBON_ROAD' | 'LINK_ROAD' | 'MG_ROAD' | 'QUEENS_ROAD';
  isSpectatorPermitted: boolean;
  x: number;
  y: number;
}

export interface StadiumSectorData {
  id: 'CUBBON_ROAD' | 'LINK_ROAD' | 'MG_ROAD' | 'QUEENS_ROAD';
  name: string;
  roadLabel: string;
  isSpectatorPermitted: boolean;
  outerGates: string[];
  innerGates: InnerGateSpec[];
  defaultInflow: number;
}

export const KSCA_STADIUM_SECTORS: Record<string, StadiumSectorData> = {
  CUBBON_ROAD: {
    id: 'CUBBON_ROAD',
    name: 'Cubbon Road (North Sector)',
    roadLabel: 'Cubbon Road (Minsk Square ──► BRV Junction)',
    isSpectatorPermitted: true,
    outerGates: ['E18', 'E19', 'E20', 'E21', 'E22', 'E23', 'E1', 'E2', 'E3', 'E4'],
    innerGates: [
      { id: 'G7', stand: 'C Stand', turnstileCount: 4, baseCapacityPerMin: 240, x: 340, y: 160 },
      { id: 'G8', stand: 'D Stand', turnstileCount: 4, baseCapacityPerMin: 240, x: 420, y: 160 },
      { id: 'G9', stand: 'B-Ground Annex', turnstileCount: 3, baseCapacityPerMin: 180, x: 500, y: 160 },
    ],
    defaultInflow: 480,
  },
  LINK_ROAD: {
    id: 'LINK_ROAD',
    name: 'Link Road / St. Marks (East Sector)',
    roadLabel: 'Link Road & St. Marks Road (From MG Road Metro)',
    isSpectatorPermitted: true,
    outerGates: ['E12', 'E13', 'E14', 'E15', 'E16', 'E17'],
    innerGates: [
      { id: 'G10', stand: 'Grand Terrace', turnstileCount: 3, baseCapacityPerMin: 180, x: 300, y: 160 },
      { id: 'G11', stand: 'E Stand Main', turnstileCount: 4, baseCapacityPerMin: 240, x: 380, y: 160 },
      { id: 'G12', stand: 'H Upper Tier', turnstileCount: 3, baseCapacityPerMin: 180, x: 460, y: 160 },
      { id: 'G13', stand: 'Floor & P2', turnstileCount: 4, baseCapacityPerMin: 240, x: 540, y: 160 },
      { id: 'G14', stand: 'Pavilion East', turnstileCount: 3, baseCapacityPerMin: 180, x: 620, y: 160 },
    ],
    defaultInflow: 620,
  },
  MG_ROAD: {
    id: 'MG_ROAD',
    name: 'MG Road Plaza (South Sector)',
    roadLabel: 'MG Road & Anil Kumble Circle Promenade',
    isSpectatorPermitted: true,
    outerGates: ['E11'],
    innerGates: [
      { id: 'G1', stand: 'P-Loft / P-Terrace', turnstileCount: 4, baseCapacityPerMin: 240, x: 360, y: 160 },
      { id: 'G2', stand: 'P3 Stand', turnstileCount: 4, baseCapacityPerMin: 240, x: 440, y: 160 },
      { id: 'G3', stand: 'Club Annex', turnstileCount: 2, baseCapacityPerMin: 120, x: 520, y: 160 },
    ],
    defaultInflow: 320,
  },
  QUEENS_ROAD: {
    id: 'QUEENS_ROAD',
    name: "Queen's Road (West Sector) — RESTRICTED",
    roadLabel: "Queen's Road (NO SPECTATOR ENTRY - Police/Media/VIP Only)",
    isSpectatorPermitted: false,
    outerGates: ['E5', 'E6', 'E7', 'E8', 'E9', 'E10'],
    innerGates: [
      { id: 'G4', stand: 'A Stand (Restricted)', turnstileCount: 2, baseCapacityPerMin: 120, x: 380, y: 160 },
      { id: 'G5', stand: 'B Stand (Restricted)', turnstileCount: 2, baseCapacityPerMin: 120, x: 460, y: 160 },
      { id: 'G6', stand: 'Media Center', turnstileCount: 2, baseCapacityPerMin: 120, x: 540, y: 160 },
    ],
    defaultInflow: 80,
  },
};

export type StadiumSectorId = 'EAST' | 'WEST' | 'NORTH' | 'SOUTH';

export interface OuterGate {
  id: string; // 'E1' to 'E23'
  road: 'CUBBON_ROAD' | 'LINK_ROAD' | 'MG_ROAD' | 'QUEENS_ROAD';
  x: number;
  y: number;
  approachVector: { dx: number; dy: number };
  active: boolean;
  inflowShare: number;
  bufferCapacity: number;
  queueCount: number;
  admittedTotal: number;
  status: 'OPEN' | 'CONGESTED' | 'CLOSED';
  allowedSpectators: boolean; // false for Queens Road (Media/Staff only)
  capacityPerMin: number;
  connectedInnerGates: string[];
}

export interface InnerGate {
  id: string; // 'G1' to 'G14'
  standName: string; // 'A Stand', 'B Stand', 'C Stand', 'E Stand', 'H Upper', 'P Terrace', etc.
  sector: 'CUBBON_ROAD' | 'LINK_ROAD' | 'MG_ROAD' | 'QUEENS_ROAD';
  x: number;
  y: number;
  turnstileCount: number;
  capacityPerMin: number;
}

export const KSCA_ROADS = {
  CUBBON_ROAD: { name: 'Cubbon Road', allowed: true, gates: ['E18', 'E19', 'E20', 'E21', 'E22', 'E23', 'E1', 'E2', 'E3', 'E4'] },
  LINK_ROAD: { name: 'Link Road / St. Marks', allowed: true, gates: ['E12', 'E13', 'E14', 'E15', 'E16', 'E17'] },
  MG_ROAD: { name: 'MG Road Plaza', allowed: true, gates: ['E11'] },
  QUEENS_ROAD: { name: 'Queens Road', allowed: false, gates: ['E5', 'E6', 'E7', 'E8', 'E9', 'E10'] } // VIP/Media only
};

export const KSCA_INNER_GATES: Record<string, InnerGate> = {
  G1: { id: 'G1', standName: 'P-Loft / P-Terrace', sector: 'MG_ROAD', x: 340, y: 360, turnstileCount: 4, capacityPerMin: 180 },
  G2: { id: 'G2', standName: 'P3 Stand', sector: 'MG_ROAD', x: 420, y: 375, turnstileCount: 4, capacityPerMin: 180 },
  G3: { id: 'G3', standName: 'Club Annex', sector: 'MG_ROAD', x: 500, y: 390, turnstileCount: 2, capacityPerMin: 90 },
  G4: { id: 'G4', standName: 'Pavilion Terrace (A Stand)', sector: 'QUEENS_ROAD', x: 295, y: 285, turnstileCount: 3, capacityPerMin: 120 },
  G5: { id: 'G5', standName: 'VIP Club House (B Stand)', sector: 'QUEENS_ROAD', x: 310, y: 220, turnstileCount: 2, capacityPerMin: 90 },
  G6: { id: 'G6', standName: 'Media Center', sector: 'QUEENS_ROAD', x: 345, y: 165, turnstileCount: 4, capacityPerMin: 180 },
  G7: { id: 'G7', standName: 'C Stand', sector: 'CUBBON_ROAD', x: 405, y: 130, turnstileCount: 5, capacityPerMin: 220 },
  G8: { id: 'G8', standName: 'D Stand', sector: 'CUBBON_ROAD', x: 480, y: 115, turnstileCount: 6, capacityPerMin: 260 },
  G9: { id: 'G9', standName: 'B-Ground Annex', sector: 'CUBBON_ROAD', x: 555, y: 125, turnstileCount: 5, capacityPerMin: 220 },
  G10: { id: 'G10', standName: 'Grand Terrace (E Stand Upper)', sector: 'LINK_ROAD', x: 620, y: 155, turnstileCount: 5, capacityPerMin: 220 },
  G11: { id: 'G11', standName: 'E Stand Main', sector: 'LINK_ROAD', x: 655, y: 195, turnstileCount: 4, capacityPerMin: 180 },
  G12: { id: 'G12', standName: 'H Upper Tier', sector: 'LINK_ROAD', x: 668, y: 245, turnstileCount: 4, capacityPerMin: 180 },
  G13: { id: 'G13', standName: 'Floor & P2', sector: 'LINK_ROAD', x: 650, y: 320, turnstileCount: 6, capacityPerMin: 260 },
  G14: { id: 'G14', standName: 'Pavilion East (East Grandstand)', sector: 'LINK_ROAD', x: 610, y: 385, turnstileCount: 8, capacityPerMin: 340 }
};

export const KSCA_OUTER_GATES: Record<string, OuterGate> = {
  // Cubbon Road (North Perimeter) - Approaching southwards (dx: 0, dy: 1)
  E18: { id: 'E18', road: 'CUBBON_ROAD', x: 320, y: 70, approachVector: { dx: 0, dy: 1 }, active: true, inflowShare: 0.1, bufferCapacity: 60, queueCount: 0, admittedTotal: 0, status: 'OPEN', allowedSpectators: true, capacityPerMin: 160, connectedInnerGates: ['G6'] },
  E19: { id: 'E19', road: 'CUBBON_ROAD', x: 360, y: 70, approachVector: { dx: 0, dy: 1 }, active: true, inflowShare: 0.1, bufferCapacity: 60, queueCount: 0, admittedTotal: 0, status: 'OPEN', allowedSpectators: true, capacityPerMin: 180, connectedInnerGates: ['G6', 'G7'] },
  E20: { id: 'E20', road: 'CUBBON_ROAD', x: 400, y: 70, approachVector: { dx: 0, dy: 1 }, active: true, inflowShare: 0.1, bufferCapacity: 60, queueCount: 0, admittedTotal: 0, status: 'OPEN', allowedSpectators: true, capacityPerMin: 200, connectedInnerGates: ['G7'] },
  E21: { id: 'E21', road: 'CUBBON_ROAD', x: 440, y: 70, approachVector: { dx: 0, dy: 1 }, active: true, inflowShare: 0.12, bufferCapacity: 80, queueCount: 0, admittedTotal: 0, status: 'OPEN', allowedSpectators: true, capacityPerMin: 220, connectedInnerGates: ['G7', 'G8'] },
  E22: { id: 'E22', road: 'CUBBON_ROAD', x: 480, y: 70, approachVector: { dx: 0, dy: 1 }, active: true, inflowShare: 0.12, bufferCapacity: 80, queueCount: 0, admittedTotal: 0, status: 'OPEN', allowedSpectators: true, capacityPerMin: 240, connectedInnerGates: ['G8'] },
  E23: { id: 'E23', road: 'CUBBON_ROAD', x: 520, y: 70, approachVector: { dx: 0, dy: 1 }, active: true, inflowShare: 0.12, bufferCapacity: 80, queueCount: 0, admittedTotal: 0, status: 'OPEN', allowedSpectators: true, capacityPerMin: 220, connectedInnerGates: ['G8', 'G9'] },
  E1: { id: 'E1', road: 'CUBBON_ROAD', x: 560, y: 70, approachVector: { dx: 0, dy: 1 }, active: true, inflowShare: 0.1, bufferCapacity: 60, queueCount: 0, admittedTotal: 0, status: 'OPEN', allowedSpectators: true, capacityPerMin: 220, connectedInnerGates: ['G9'] },
  E2: { id: 'E2', road: 'CUBBON_ROAD', x: 605, y: 75, approachVector: { dx: -0.2, dy: 0.98 }, active: true, inflowShare: 0.09, bufferCapacity: 60, queueCount: 0, admittedTotal: 0, status: 'OPEN', allowedSpectators: true, capacityPerMin: 200, connectedInnerGates: ['G9', 'G10'] },
  E3: { id: 'E3', road: 'CUBBON_ROAD', x: 645, y: 75, approachVector: { dx: -0.3, dy: 0.95 }, active: true, inflowShare: 0.08, bufferCapacity: 60, queueCount: 0, admittedTotal: 0, status: 'OPEN', allowedSpectators: true, capacityPerMin: 180, connectedInnerGates: ['G10', 'G11'] },
  E4: { id: 'E4', road: 'CUBBON_ROAD', x: 685, y: 80, approachVector: { dx: -0.4, dy: 0.91 }, active: true, inflowShare: 0.07, bufferCapacity: 60, queueCount: 0, admittedTotal: 0, status: 'OPEN', allowedSpectators: true, capacityPerMin: 160, connectedInnerGates: ['G11'] },

  // Link Road / St. Marks (East Perimeter) - Approaching westwards (dx: -1, dy: 0)
  E12: { id: 'E12', road: 'LINK_ROAD', x: 740, y: 140, approachVector: { dx: -1, dy: 0 }, active: true, inflowShare: 0.14, bufferCapacity: 80, queueCount: 0, admittedTotal: 0, status: 'OPEN', allowedSpectators: true, capacityPerMin: 160, connectedInnerGates: ['G10', 'G11'] },
  E13: { id: 'E13', road: 'LINK_ROAD', x: 740, y: 195, approachVector: { dx: -1, dy: 0 }, active: true, inflowShare: 0.16, bufferCapacity: 80, queueCount: 0, admittedTotal: 0, status: 'OPEN', allowedSpectators: true, capacityPerMin: 180, connectedInnerGates: ['G11', 'G12'] },
  E14: { id: 'E14', road: 'LINK_ROAD', x: 740, y: 250, approachVector: { dx: -1, dy: 0 }, active: true, inflowShare: 0.18, bufferCapacity: 90, queueCount: 0, admittedTotal: 0, status: 'OPEN', allowedSpectators: true, capacityPerMin: 200, connectedInnerGates: ['G12'] },
  E15: { id: 'E15', road: 'LINK_ROAD', x: 740, y: 310, approachVector: { dx: -1, dy: 0 }, active: true, inflowShare: 0.2, bufferCapacity: 100, queueCount: 0, admittedTotal: 0, status: 'OPEN', allowedSpectators: true, capacityPerMin: 220, connectedInnerGates: ['G12', 'G13'] },
  E16: { id: 'E16', road: 'LINK_ROAD', x: 740, y: 365, approachVector: { dx: -1, dy: 0 }, active: true, inflowShare: 0.18, bufferCapacity: 90, queueCount: 0, admittedTotal: 0, status: 'OPEN', allowedSpectators: true, capacityPerMin: 220, connectedInnerGates: ['G13', 'G14'] },
  E17: { id: 'E17', road: 'LINK_ROAD', x: 740, y: 420, approachVector: { dx: -1, dy: 0 }, active: true, inflowShare: 0.14, bufferCapacity: 80, queueCount: 0, admittedTotal: 0, status: 'OPEN', allowedSpectators: true, capacityPerMin: 180, connectedInnerGates: ['G14'] },

  // MG Road Plaza (South Perimeter - Mass Transit Feeder) - Approaching northwest (dx: -0.6, dy: -0.8)
  E11: { id: 'E11', road: 'MG_ROAD', x: 670, y: 485, approachVector: { dx: -0.6, dy: -0.8 }, active: true, inflowShare: 1.0, bufferCapacity: 250, queueCount: 0, admittedTotal: 0, status: 'OPEN', allowedSpectators: true, capacityPerMin: 600, connectedInnerGates: ['G13', 'G14', 'G1'] },

  // Queens Road (West Perimeter - VIP / Media / Staff only) - Approaching east (dx: 0.9, dy: 0.4)
  E5: { id: 'E5', road: 'QUEENS_ROAD', x: 215, y: 205, approachVector: { dx: 0.9, dy: 0.4 }, active: true, inflowShare: 0.15, bufferCapacity: 40, queueCount: 0, admittedTotal: 0, status: 'OPEN', allowedSpectators: false, capacityPerMin: 60, connectedInnerGates: ['G5', 'G6'] },
  E6: { id: 'E6', road: 'QUEENS_ROAD', x: 250, y: 255, approachVector: { dx: 0.9, dy: 0.4 }, active: true, inflowShare: 0.15, bufferCapacity: 40, queueCount: 0, admittedTotal: 0, status: 'OPEN', allowedSpectators: false, capacityPerMin: 60, connectedInnerGates: ['G4', 'G5'] },
  E7: { id: 'E7', road: 'QUEENS_ROAD', x: 280, y: 305, approachVector: { dx: 0.9, dy: 0.4 }, active: true, inflowShare: 0.2, bufferCapacity: 40, queueCount: 0, admittedTotal: 0, status: 'OPEN', allowedSpectators: false, capacityPerMin: 60, connectedInnerGates: ['G4'] },
  E8: { id: 'E8', road: 'QUEENS_ROAD', x: 315, y: 360, approachVector: { dx: 0.9, dy: 0.4 }, active: true, inflowShare: 0.15, bufferCapacity: 40, queueCount: 0, admittedTotal: 0, status: 'OPEN', allowedSpectators: false, capacityPerMin: 60, connectedInnerGates: ['G1', 'G4'] },
  E9: { id: 'E9', road: 'QUEENS_ROAD', x: 350, y: 410, approachVector: { dx: 0.9, dy: 0.4 }, active: true, inflowShare: 0.15, bufferCapacity: 40, queueCount: 0, admittedTotal: 0, status: 'OPEN', allowedSpectators: false, capacityPerMin: 60, connectedInnerGates: ['G1'] },
  E10: { id: 'E10', road: 'QUEENS_ROAD', x: 390, y: 455, approachVector: { dx: 0.9, dy: 0.4 }, active: true, inflowShare: 0.2, bufferCapacity: 40, queueCount: 0, admittedTotal: 0, status: 'OPEN', allowedSpectators: false, capacityPerMin: 60, connectedInnerGates: ['G1'] }
};

/**
 * Calculates theoretical admission throughput for a turnstile bank
 * enforcing sequential NFC Tap and Security Screening stages:
 * C_NFC = activeNfcLanes * 60 / nfcServiceSec
 * C_SECURITY = activeSecurityBooths * 60 / screeningServiceSec
 * C_EFFECTIVE = min(C_NFC, C_SECURITY)
 */
export function calculateTheoreticalThroughput(
  activeNfcLanes: number,
  nfcLatencySec: number,
  activeSecurityBooths: number,
  screeningLatencySec: number
): {
  perNfcLaneCap: number;
  totalNfcCap: number;
  perSecurityBoothCap: number;
  totalSecurityCap: number;
  effectiveCapacityPerMin: number;
  bottleneckStage: 'NFC_TAP' | 'SECURITY_SCREENING';
} {
  const safeNfcTime = Math.max(0.1, nfcLatencySec);
  const safeScreenTime = Math.max(0.5, screeningLatencySec);

  const perNfcLaneCap = 60 / safeNfcTime;
  const totalNfcCap = activeNfcLanes * perNfcLaneCap;

  const perSecurityBoothCap = 60 / safeScreenTime;
  const totalSecurityCap = activeSecurityBooths * perSecurityBoothCap;

  const effectiveCapacityPerMin = Math.min(totalNfcCap, totalSecurityCap);
  const bottleneckStage = totalNfcCap < totalSecurityCap ? 'NFC_TAP' : 'SECURITY_SCREENING';

  return {
    perNfcLaneCap,
    totalNfcCap,
    perSecurityBoothCap,
    totalSecurityCap,
    effectiveCapacityPerMin,
    bottleneckStage
  };
}

export interface SectorDefinition {
  id: StadiumSectorId;
  name: string;
  standTitle: string;
  gatesDescription: string;
  gateNumbers: number[];
  capacity: number;
  turnstiles: number;
  maxThroughputPerMin: number;
  riskRating: 'HIGH' | 'MEDIUM' | 'LOW-MEDIUM' | 'LOW';
  transitFeed: string;
  accentColor: string;
}

export const CHINNASWAMY_CONFIG = {
  venueName: 'M. Chinnaswamy Stadium',
  location: 'Cubbon Road / MG Road, Bengaluru',
  totalCapacity: 35000,
  pitchDimensionsMeters: { length: 140, width: 130 },
  sectors: {
    EAST: {
      id: 'EAST',
      name: 'East Stand',
      standTitle: 'East Stand (Gates 1–6)',
      gatesDescription: 'Gates 1–6 (Main Public Concourse)',
      gateNumbers: [1, 2, 3, 4, 5, 6],
      capacity: 12500,
      turnstiles: 14,
      maxThroughputPerMin: 300,
      riskRating: 'HIGH',
      transitFeed: 'MG Road Metro Station Feed (Mass Influx Corridors)',
      accentColor: '#f97316'
    },
    NORTH: {
      id: 'NORTH',
      name: 'North Stand',
      standTitle: 'North Stand (Gates 16–21)',
      gatesDescription: 'Gates 16–21 (General & Student Stands)',
      gateNumbers: [16, 17, 18, 19, 20, 21],
      capacity: 8500,
      turnstiles: 12,
      maxThroughputPerMin: 240,
      riskRating: 'MEDIUM',
      transitFeed: 'Shivajinagar Bus Terminus & Queen’s Road',
      accentColor: '#38bdf8'
    },
    SOUTH: {
      id: 'SOUTH',
      name: 'South Stand',
      standTitle: 'South Stand (Gates 7–11)',
      gatesDescription: 'Gates 7–11 (Corporate Box & Lower Tier)',
      gateNumbers: [7, 8, 9, 10, 11],
      capacity: 7500,
      turnstiles: 10,
      maxThroughputPerMin: 200,
      riskRating: 'LOW-MEDIUM',
      transitFeed: 'Cubbon Road Pedestrian Walkway',
      accentColor: '#a855f7'
    },
    WEST: {
      id: 'WEST',
      name: 'West Stand',
      standTitle: 'West Stand / Pavilion (Gates 12–15)',
      gatesDescription: 'Gates 12–15 (Club House & VIP / Media)',
      gateNumbers: [12, 13, 14, 15],
      capacity: 6500,
      turnstiles: 8,
      maxThroughputPerMin: 350,
      riskRating: 'LOW',
      transitFeed: 'KSLCA Club House Dedicated Carriageway',
      accentColor: '#10b981'
    }
  } as Record<StadiumSectorId, SectorDefinition>
};

/**
 * Calculates estimated hours remaining until full venue capacity is reached.
 */
export function calculateTimeToFillHours(
  inflowRatePerMin: number,
  currentOccupancy: number = 0,
  targetCapacity: number = CHINNASWAMY_CONFIG.totalCapacity
): number {
  if (inflowRatePerMin <= 0) return 99.9;
  const remainingSeats = Math.max(0, targetCapacity - currentOccupancy);
  const totalMinutes = remainingSeats / inflowRatePerMin;
  return Math.round((totalMinutes / 60) * 10) / 10;
}

/**
 * Calculates current sector saturation and congestion state.
 */
export function calculateSectorSaturation(
  sectorId: StadiumSectorId,
  currentSectorLoad: number
): {
  percentage: number;
  isCongested: boolean;
  statusText: string;
  fillCount: number;
} {
  const sector = CHINNASWAMY_CONFIG.sectors[sectorId];
  if (!sector) {
    return { percentage: 0, isCongested: false, statusText: 'NORMAL', fillCount: 0 };
  }

  const percentage = Math.min(100, Math.round((currentSectorLoad / sector.capacity) * 100));
  const isCongested = percentage >= 85;
  const statusText =
    percentage >= 95
      ? 'CRITICAL CAPACITY'
      : percentage >= 85
      ? 'HEAVY SATURATION'
      : percentage >= 60
      ? 'MODERATE OCCUPANCY'
      : 'FLOWING NORMALLY';

  return {
    percentage,
    isCongested,
    statusText,
    fillCount: currentSectorLoad
  };
}

/**
 * Computes a standardized Stampede & Crush Risk Index (0 - 100%).
 * Integrates localized peak density, compressive back-pressure, and queue spillback distance.
 */
export function calculateCrushProbabilityIndex(
  peakDensity: number,
  compressivePressure: number,
  spillbackMeters: number
): number {
  // Density component: exponential rise past 3.5 p/m²
  const densityFactor = Math.min(60, Math.pow(Math.max(0, peakDensity - 1.5) / 3.5, 2) * 50);

  // Pressure component: 0 to 25%
  const pressureFactor = Math.min(25, (compressivePressure / 30) * 25);

  // Spillback component: 0 to 15% (past 20m spillback onto road)
  const spillbackFactor = Math.min(15, (spillbackMeters / 35) * 15);

  const rawScore = Math.round(densityFactor + pressureFactor + spillbackFactor);
  return Math.min(100, Math.max(0, rawScore));
}
