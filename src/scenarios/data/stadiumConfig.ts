/**
 * CROWDWISE — M. Chinnaswamy Stadium Official Configuration
 * Authoritative Stadium Dataset & 21-Gate Radar Geometry
 *
 * Venue: M. Chinnaswamy Stadium, Bengaluru
 * Total Physical Capacity: 35,000 spectators
 *
 * Sector Distribution:
 * - East Stand:  12,500 capacity (Gates 1 - 5)   - Primary MG Road / Cubbon Road Concourse
 * - North Stand:  8,500 capacity (Gates 6 - 10)  - Queen's Road Approach
 * - West Stand:   6,500 capacity (Gates 11 - 15) - KSLTA / Link Road Approach
 * - South Stand:  7,500 capacity (Gates 16 - 21) - Cubbon Park / Kasturba Road Concourse
 * Total:         35,000 capacity
 */

export interface StadiumSector {
  readonly id: 'east' | 'north' | 'west' | 'south';
  readonly name: string;
  readonly capacity: number;
  readonly gates: readonly number[];
  readonly color: string;
  readonly angleStartDeg: number;
  readonly angleEndDeg: number;
}

export interface StadiumPerimeterGate {
  readonly gateNumber: number;
  readonly id: string;
  readonly name: string;
  readonly sectorId: 'east' | 'north' | 'west' | 'south';
  readonly angleDeg: number;
  readonly turnstileCount: number;
  readonly approachStreet: string;
  readonly isPrimarySurgeGate?: boolean;
}

export const CHINNASWAMY_TOTAL_CAPACITY = 35000;

export const CHINNASWAMY_SECTORS: Record<string, StadiumSector> = {
  east: {
    id: 'east',
    name: 'East Stand (MG Road)',
    capacity: 12500,
    gates: [1, 2, 3, 4, 5],
    color: '#06b6d4', // Cyan
    angleStartDeg: 315,
    angleEndDeg: 45
  },
  north: {
    id: 'north',
    name: 'North Stand (Queen\'s Road)',
    capacity: 8500,
    gates: [6, 7, 8, 9, 10],
    color: '#10b981', // Emerald
    angleStartDeg: 45,
    angleEndDeg: 135
  },
  west: {
    id: 'west',
    name: 'West Stand (KSLTA)',
    capacity: 6500,
    gates: [11, 12, 13, 14, 15],
    color: '#f59e0b', // Amber
    angleStartDeg: 135,
    angleEndDeg: 225
  },
  south: {
    id: 'south',
    name: 'South Stand (Cubbon Park)',
    capacity: 7500,
    gates: [16, 17, 18, 19, 20, 21],
    color: '#8b5cf6', // Violet
    angleStartDeg: 225,
    angleEndDeg: 315
  }
};

/**
 * 21 Perimeter Gates positioned around the stadium circumference
 */
export const CHINNASWAMY_GATES: readonly StadiumPerimeterGate[] = [
  // East Stand: Gates 1 to 5 (330° to 30°)
  { gateNumber: 1, id: 'gate-1', name: 'Gate 1 (Main Ingress)', sectorId: 'east', angleDeg: 330, turnstileCount: 6, approachStreet: 'MG Road' },
  { gateNumber: 2, id: 'gate-2', name: 'Gate 2 (Turnstile A)', sectorId: 'east', angleDeg: 345, turnstileCount: 4, approachStreet: 'MG Road', isPrimarySurgeGate: true },
  { gateNumber: 3, id: 'gate-3', name: 'Gate 3 (Auxiliary B)', sectorId: 'east', angleDeg: 0, turnstileCount: 4, approachStreet: 'Cubbon Road', isPrimarySurgeGate: true },
  { gateNumber: 4, id: 'gate-4', name: 'Gate 4 (Hospitality)', sectorId: 'east', angleDeg: 15, turnstileCount: 3, approachStreet: 'Cubbon Road' },
  { gateNumber: 5, id: 'gate-5', name: 'Gate 5 (East Upper)', sectorId: 'east', angleDeg: 30, turnstileCount: 4, approachStreet: 'Cubbon Road' },

  // North Stand: Gates 6 to 10 (60° to 120°)
  { gateNumber: 6, id: 'gate-6', name: 'Gate 6 (Queen\'s Road)', sectorId: 'north', angleDeg: 60, turnstileCount: 4, approachStreet: 'Queen\'s Road' },
  { gateNumber: 7, id: 'gate-7', name: 'Gate 7 (Unresolved Position 7)', sectorId: 'north', angleDeg: 75, turnstileCount: 3, approachStreet: 'Unassigned (Pending Survey)' },
  { gateNumber: 8, id: 'gate-8', name: 'Gate 8 (North Pavilion)', sectorId: 'north', angleDeg: 90, turnstileCount: 5, approachStreet: 'Queen\'s Road' },
  { gateNumber: 9, id: 'gate-9', name: 'Gate 9 (Media / VIP)', sectorId: 'north', angleDeg: 105, turnstileCount: 2, approachStreet: 'Queen\'s Road' },
  { gateNumber: 10, id: 'gate-10', name: 'Gate 10 (Unresolved Position 10)', sectorId: 'north', angleDeg: 120, turnstileCount: 4, approachStreet: 'Unassigned (Pending Survey)' },

  // West Stand: Gates 11 to 15 (150° to 210°)
  { gateNumber: 11, id: 'gate-11', name: 'Gate 11 (KSLTA Gate)', sectorId: 'west', angleDeg: 150, turnstileCount: 3, approachStreet: 'Link Road' },
  { gateNumber: 12, id: 'gate-12', name: 'Gate 12 (West Concourse)', sectorId: 'west', angleDeg: 165, turnstileCount: 4, approachStreet: 'Link Road' },
  { gateNumber: 13, id: 'gate-13', name: 'Gate 13 (Members Gate)', sectorId: 'west', angleDeg: 180, turnstileCount: 4, approachStreet: 'Link Road' },
  { gateNumber: 14, id: 'gate-14', name: 'Gate 14 (West Upper)', sectorId: 'west', angleDeg: 195, turnstileCount: 3, approachStreet: 'Link Road' },
  { gateNumber: 15, id: 'gate-15', name: 'Gate 15 (West Ramp)', sectorId: 'west', angleDeg: 210, turnstileCount: 3, approachStreet: 'Link Road' },

  // South Stand: Gates 16 to 21 (240° to 310°)
  { gateNumber: 16, id: 'gate-16', name: 'Gate 16 (Cubbon Park)', sectorId: 'south', angleDeg: 240, turnstileCount: 4, approachStreet: 'Kasturba Road' },
  { gateNumber: 17, id: 'gate-17', name: 'Gate 17 (South Lower)', sectorId: 'south', angleDeg: 255, turnstileCount: 4, approachStreet: 'Kasturba Road' },
  { gateNumber: 18, id: 'gate-18', name: 'Gate 18 (B-Challengers)', sectorId: 'south', angleDeg: 270, turnstileCount: 5, approachStreet: 'Kasturba Road' },
  { gateNumber: 19, id: 'gate-19', name: 'Gate 19 (Unresolved Position 19)', sectorId: 'south', angleDeg: 285, turnstileCount: 4, approachStreet: 'Unassigned (Pending Survey)' },
  { gateNumber: 20, id: 'gate-20', name: 'Gate 20 (Emergency Egress)', sectorId: 'south', angleDeg: 300, turnstileCount: 6, approachStreet: 'Kasturba Road' },
  { gateNumber: 21, id: 'gate-21', name: 'Gate 21 (Unresolved Position 21)', sectorId: 'south', angleDeg: 312, turnstileCount: 4, approachStreet: 'Unassigned (Pending Survey)' }
];

