import { StadiumStand } from '../types/stadium';

/**
 * Authentic stand arrangement of M. Chinnaswamy Stadium, Bengaluru.
 * Derived from official KSCA ingress blueprint and sectional architectural elevations.
 * Total Sanctioned Seating Capacity: 35,000 seats.
 *
 * Polar angle definition:
 * 0° = East (Link Road)
 * 90° = South (MG Road / Car Park)
 * 180° = West (Queens Road)
 * 270° = North (Cubbon Road)
 */

export const CHINNASWAMY_STANDS: StadiumStand[] = [
  {
    id: 'C_STAND',
    name: 'C Stand',
    tierLabel: 'General Lower & Upper',
    startAngleDeg: 258,
    endAngleDeg: 288,
    innerRadius: 210,
    outerRadius: 338,
    fillColor: '#10b981', // Emerald green (matches official map)
    strokeColor: '#059669',
    labelPosition: { x: 800, y: 300 },
    capacity: 4200,
    associatedInnerGates: ['G8', 'G9'],
    description: 'Premier north-facing spectator grandstand overlooking the pitch from Cubbon Road End.'
  },
  {
    id: 'PLATINUM_LOUNGE',
    name: 'Platinum Lounge',
    tierLabel: 'Hospitality Enclosure',
    startAngleDeg: 246,
    endAngleDeg: 258,
    innerRadius: 210,
    outerRadius: 338,
    fillColor: '#94a3b8', // Platinum silver
    strokeColor: '#64748b',
    labelPosition: { x: 700, y: 325 },
    capacity: 800,
    associatedInnerGates: ['G7'],
    description: 'Exclusive air-conditioned corporate and VIP enclosure adjacent to C Stand.'
  },
  {
    id: 'B_STAND',
    name: 'B Stand',
    tierLabel: 'Lower & Upper Tier',
    startAngleDeg: 218,
    endAngleDeg: 246,
    innerRadius: 210,
    outerRadius: 335,
    fillColor: '#0d9488', // Teal
    strokeColor: '#0f766e',
    labelPosition: { x: 610, y: 395 },
    capacity: 2800,
    associatedInnerGates: ['G6'],
    description: 'North-west spectator stand facing the B-Ground practice facility.'
  },
  {
    id: 'A_STAND',
    name: 'A Stand',
    tierLabel: 'Pavilion Wing & General Tier',
    startAngleDeg: 168,
    endAngleDeg: 218,
    innerRadius: 210,
    outerRadius: 340,
    fillColor: '#818cf8', // Lavender / Indigo
    strokeColor: '#6366f1',
    labelPosition: { x: 520, y: 550 },
    capacity: 4600,
    associatedInnerGates: ['G4', 'G5'],
    description: 'Large west spectator wing flanking the main Members Pavilion along Queens Road.'
  },
  {
    id: 'P3_STAND',
    name: 'P3 Stand',
    tierLabel: 'Covered Tier',
    startAngleDeg: 136,
    endAngleDeg: 168,
    innerRadius: 210,
    outerRadius: 335,
    fillColor: '#f97316', // Orange
    strokeColor: '#ea580c',
    labelPosition: { x: 565, y: 740 },
    capacity: 2400,
    associatedInnerGates: ['G3'],
    description: 'South-west covered stand with direct proximity to KSCA Car Park.'
  },
  {
    id: 'P1_ANNEXE_LOFT',
    name: 'P1 Annexe / P-Loft',
    tierLabel: 'Terrace & Boxes',
    startAngleDeg: 118,
    endAngleDeg: 136,
    innerRadius: 210,
    outerRadius: 335,
    fillColor: '#8b5cf6', // Violet
    strokeColor: '#7c3aed',
    labelPosition: { x: 670, y: 830 },
    capacity: 1500,
    associatedInnerGates: ['G2'],
    description: 'South pavilion annexe and elevated hospitality boxes.'
  },
  {
    id: 'P_TERRACE_CORPORATE',
    name: 'P Terrace & P Corporate',
    tierLabel: 'Members & Corporate Tier',
    startAngleDeg: 80,
    endAngleDeg: 118,
    innerRadius: 210,
    outerRadius: 345,
    fillColor: '#2563eb', // Royal Blue
    strokeColor: '#1d4ed8',
    labelPosition: { x: 800, y: 860 },
    capacity: 3100,
    associatedInnerGates: ['G1'],
    description: 'Premier south-facing corporate box terrace overlooking the Pavilion end wickets.'
  },
  {
    id: 'M2_ANNEXE',
    name: 'M2 Annexe',
    tierLabel: 'East Lower Annexe',
    startAngleDeg: 62,
    endAngleDeg: 80,
    innerRadius: 210,
    outerRadius: 340,
    fillColor: '#a855f7', // Purple
    strokeColor: '#9333ea',
    labelPosition: { x: 935, y: 830 },
    capacity: 1200,
    associatedInnerGates: ['G15'],
    description: 'South-east auxiliary seating section accessible from Gate E11.'
  },
  {
    id: 'M3_M4',
    name: 'M3 & M4 Stands',
    tierLabel: 'Public Multi-Tier',
    startAngleDeg: 24,
    endAngleDeg: 62,
    innerRadius: 205,
    outerRadius: 345,
    fillColor: '#ec4899', // Pink / Rose
    strokeColor: '#db2777',
    labelPosition: { x: 1040, y: 735 },
    capacity: 3600,
    associatedInnerGates: ['G14'],
    description: 'East grandstand public block receiving spectators from Link Road gates.'
  },
  {
    id: 'H_UPPER',
    name: 'H Upper Tier',
    tierLabel: 'Upper Grandstand',
    startAngleDeg: 336,
    endAngleDeg: 24,
    innerRadius: 255,
    outerRadius: 362,
    fillColor: '#eab308', // Bright Yellow
    strokeColor: '#ca8a04',
    labelPosition: { x: 1105, y: 580 },
    capacity: 3200,
    associatedInnerGates: ['G12', 'G13'],
    description: 'High-elevation upper tier offering panoramic gameday sightlines.'
  },
  {
    id: 'F_STAND',
    name: 'F Stand',
    tierLabel: 'Lower Concourse Tier',
    startAngleDeg: 336,
    endAngleDeg: 24,
    innerRadius: 205,
    outerRadius: 255,
    fillColor: '#06b6d4', // Cyan
    strokeColor: '#0891b2',
    labelPosition: { x: 1025, y: 580 },
    capacity: 2600,
    associatedInnerGates: ['G12', 'G13'],
    description: 'Lower concourse seating beneath H Upper tier.'
  },
  {
    id: 'GRAND_TERRACE',
    name: 'Grand Terrace',
    tierLabel: 'East Elevated Terrace',
    startAngleDeg: 288,
    endAngleDeg: 336,
    innerRadius: 240,
    outerRadius: 355,
    fillColor: '#b45309', // Amber / Tan
    strokeColor: '#92400e',
    labelPosition: { x: 1005, y: 400 },
    capacity: 2900,
    associatedInnerGates: ['G9', 'G10', 'G11'],
    description: 'Northeastern elevated terrace connecting C Stand to the East Grandstand.'
  },
  {
    id: 'E_STAND',
    name: 'E Stand',
    tierLabel: 'East Main Concourse',
    startAngleDeg: 300,
    endAngleDeg: 336,
    innerRadius: 205,
    outerRadius: 240,
    fillColor: '#0284c7', // Sky Blue
    strokeColor: '#0369a1',
    labelPosition: { x: 940, y: 450 },
    capacity: 2100,
    associatedInnerGates: ['G11'],
    description: 'Lower seating tier positioned in front of Grand Terrace.'
  }
];
