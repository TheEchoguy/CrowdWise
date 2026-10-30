/**
 * CROWDWISE — M. Chinnaswamy Stadium Official Digital Twin Dataset
 * Theme 03: Simulation, Digital Twins & Synthetic Data
 *
 * Ground Truth Operational Parameters:
 * - Venue: M. Chinnaswamy Stadium, Bengaluru, Karnataka, India
 * - Total Sanctioned Seating Capacity: 35,000
 * - Transit Feeds: MG Road Metro Station (Purple Line), Cubbon Park Metro, Queen's Road Arterial
 */

export type StadiumSectorId = 'EAST' | 'WEST' | 'NORTH' | 'SOUTH';

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
 * @param inflowRatePerMin Total current ingress rate across all active gates
 * @param currentOccupancy Current patrons seated inside
 * @param targetCapacity Target maximum capacity (defaults to 35,000)
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
 * @param sectorId Target sector
 * @param currentSectorLoad Estimated or measured attendees in sector
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

  // Spillback component: 0 to 15% (past 20m spillback onto MG Road)
  const spillbackFactor = Math.min(15, (spillbackMeters / 35) * 15);

  const rawScore = Math.round(densityFactor + pressureFactor + spillbackFactor);
  return Math.min(100, Math.max(0, rawScore));
}

