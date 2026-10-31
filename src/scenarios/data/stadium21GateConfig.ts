/**
 * CROWDWISE — Centralized 21-Gate Stadium Configuration & Data Mapping
 * Venue: M. Chinnaswamy Stadium, Bengaluru (Physical Capacity: 35,000)
 *
 * Establishes typed configuration for all 21 perimeter gates, stands,
 * road access groups, ticket authorizations, and operational restrictions.
 *
 * Explicitly reconciles G-numbers (1..21) on the Macro Stadium Radar with
 * operational E-numbers from the reference document. Flags unresolved mappings
 * as configurable placeholders.
 */

export type TicketCategory =
  | 'general'
  | 'premium'
  | 'hospitality'
  | 'vip'
  | 'members';

export type GateOperationalType =
  | 'public'
  | 'vip'
  | 'emergency'
  | 'restricted';

export type EntryRoadGroup =
  | 'Cubbon Road'
  | 'Link Road'
  | 'Queen\'s Road'
  | 'MG Road'
  | 'Kasturba Road'
  | 'Unassigned (Pending Survey)';

/**
 * Shared Macro Radar Geometric Constants (Single Source of Truth)
 * Coordinates: 960x580 canvas space. Center (480, 226) with 170px perimeter radius.
 * Guarantees 0px overlap with bottom inspection panel (y: 464) while keeping
 * generous 35px+ chord spacing between all 21 gate stanchions.
 */
export const RADAR_CANVAS_WIDTH = 960;
export const RADAR_CANVAS_HEIGHT = 580;
export const RADAR_CENTER_X = 480;
export const RADAR_CENTER_Y = 226;
export const RADAR_OUTER_RADIUS = 170;
export const RADAR_GATE_HIT_TOLERANCE_PX = 20;

export type GateMappingStatus =
  | 'confirmed'
  | 'unresolved_placeholder';

export type ApproachGeometryStatus =
  | 'verified'       // Fully modeled microscopic physical geometry & SocialForceEngine
  | 'macro_estimate'; // Calibrated macro-level queue & throughput model; geometry blueprint pending

export interface StadiumStandDefinition {
  readonly id: string;
  readonly name: string;
  readonly sectorId: 'east' | 'north' | 'west' | 'south';
  readonly capacity: number;
  readonly allowedTicketCategories: readonly TicketCategory[];
  readonly primaryGateIds: readonly string[];
  readonly alternativeGateIds: readonly string[];
}

export interface StadiumGateDefinition {
  readonly gateNumber: number;          // 1 to 21 (Radar label: G1..G21)
  readonly id: string;                  // Canonical ID: 'gate-1' .. 'gate-21'
  readonly displayName: string;
  readonly entryRoadGroup: EntryRoadGroup;
  readonly externalReferenceId: string; // e.g. 'E-1', 'E-2', or 'E-UNRESOLVED'
  readonly mappingStatus: GateMappingStatus;
  readonly gateType: GateOperationalType;
  readonly publicEntryEligible: boolean; // false for VIP, Media, Restricted, Emergency
  readonly connectedStandIds: readonly string[];
  readonly authorizedTicketCategories: readonly TicketCategory[];
  readonly turnstileCount: number;
  readonly defaultLatencySec: number;
  readonly approachGeometryStatus: ApproachGeometryStatus;
  readonly angleDeg: number;            // 0 - 360 degrees around stadium oval
  readonly sectorId: 'east' | 'north' | 'west' | 'south';
  readonly nominalDemandWeight: number; // Relative public demand weight (0.0 for reserved gates)
}

/**
 * Authoritative Stand Definitions for M. Chinnaswamy Stadium
 */
export const CHINNASWAMY_STANDS: Record<string, StadiumStandDefinition> = {
  'stand-A': {
    id: 'stand-A',
    name: 'Stand A (East Lower)',
    sectorId: 'east',
    capacity: 3500,
    allowedTicketCategories: ['general', 'premium'],
    primaryGateIds: ['gate-1', 'gate-2'],
    alternativeGateIds: ['gate-3']
  },
  'stand-B': {
    id: 'stand-B',
    name: 'Stand B (East Lower/Mid)',
    sectorId: 'east',
    capacity: 3500,
    allowedTicketCategories: ['general', 'premium'],
    primaryGateIds: ['gate-2'],
    alternativeGateIds: ['gate-1', 'gate-3']
  },
  'stand-C': {
    id: 'stand-C',
    name: 'Stand C (Cubbon Corner)',
    sectorId: 'east',
    capacity: 3000,
    allowedTicketCategories: ['general'],
    primaryGateIds: ['gate-3'],
    alternativeGateIds: ['gate-2', 'gate-5']
  },
  'stand-G': {
    id: 'stand-G',
    name: 'Stand G (East Upper)',
    sectorId: 'east',
    capacity: 2500,
    allowedTicketCategories: ['general'],
    primaryGateIds: ['gate-5'],
    alternativeGateIds: ['gate-3']
  },
  'platinum-lounge': {
    id: 'platinum-lounge',
    name: 'Platinum Lounge & Hospitality',
    sectorId: 'east',
    capacity: 800,
    allowedTicketCategories: ['hospitality', 'vip'],
    primaryGateIds: ['gate-4'],
    alternativeGateIds: []
  },
  'corporate-D': {
    id: 'corporate-D',
    name: 'Corporate D Stand',
    sectorId: 'north',
    capacity: 2800,
    allowedTicketCategories: ['premium', 'hospitality'],
    primaryGateIds: ['gate-6'],
    alternativeGateIds: ['gate-7']
  },
  'diamond-box': {
    id: 'diamond-box',
    name: 'Diamond Box & Suites',
    sectorId: 'north',
    capacity: 600,
    allowedTicketCategories: ['vip', 'hospitality'],
    primaryGateIds: ['gate-8'],
    alternativeGateIds: []
  },
  'pavilion-tiers': {
    id: 'pavilion-tiers',
    name: 'Pavilion Tiers (P1–P3)',
    sectorId: 'north',
    capacity: 2200,
    allowedTicketCategories: ['premium', 'general'],
    primaryGateIds: ['gate-8'],
    alternativeGateIds: ['gate-6', 'gate-10']
  },
  'north-lower': {
    id: 'north-lower',
    name: 'North Stand Lower Tiers',
    sectorId: 'north',
    capacity: 2900,
    allowedTicketCategories: ['general'],
    primaryGateIds: ['gate-10'],
    alternativeGateIds: ['gate-7']
  },
  'media-centre': {
    id: 'media-centre',
    name: 'National Media Centre & Broadcast',
    sectorId: 'north',
    capacity: 400,
    allowedTicketCategories: ['vip'],
    primaryGateIds: ['gate-9'],
    alternativeGateIds: []
  },
  'stand-E': {
    id: 'stand-E',
    name: 'Stand E (West Terrace)',
    sectorId: 'west',
    capacity: 2000,
    allowedTicketCategories: ['general'],
    primaryGateIds: ['gate-11'],
    alternativeGateIds: ['gate-12']
  },
  'stand-F-block1': {
    id: 'stand-F-block1',
    name: 'Stand F (Block 1)',
    sectorId: 'west',
    capacity: 1800,
    allowedTicketCategories: ['general', 'premium'],
    primaryGateIds: ['gate-12'],
    alternativeGateIds: ['gate-11', 'gate-14']
  },
  'stand-F-block2': {
    id: 'stand-F-block2',
    name: 'Stand F (Block 2)',
    sectorId: 'west',
    capacity: 1500,
    allowedTicketCategories: ['general'],
    primaryGateIds: ['gate-14'],
    alternativeGateIds: ['gate-12', 'gate-15']
  },
  'stand-H-upper': {
    id: 'stand-H-upper',
    name: 'Stand H (Upper Tier)',
    sectorId: 'west',
    capacity: 1200,
    allowedTicketCategories: ['general'],
    primaryGateIds: ['gate-14'],
    alternativeGateIds: ['gate-15']
  },
  'm2-annexe': {
    id: 'm2-annexe',
    name: 'M2 Annexe Concourse',
    sectorId: 'west',
    capacity: 800,
    allowedTicketCategories: ['general', 'premium'],
    primaryGateIds: ['gate-15'],
    alternativeGateIds: ['gate-14']
  },
  'ksca-clubhouse': {
    id: 'ksca-clubhouse',
    name: 'KSCA Members Club Lounge',
    sectorId: 'west',
    capacity: 500,
    allowedTicketCategories: ['members'],
    primaryGateIds: ['gate-13'],
    alternativeGateIds: []
  },
  'south-lower': {
    id: 'south-lower',
    name: 'South Stand Lower Tiers',
    sectorId: 'south',
    capacity: 2600,
    allowedTicketCategories: ['general'],
    primaryGateIds: ['gate-16', 'gate-17'],
    alternativeGateIds: ['gate-18']
  },
  'b-challengers': {
    id: 'b-challengers',
    name: 'B-Challengers Stand',
    sectorId: 'south',
    capacity: 2200,
    allowedTicketCategories: ['general', 'premium'],
    primaryGateIds: ['gate-18'],
    alternativeGateIds: ['gate-17', 'gate-19']
  },
  'south-upper': {
    id: 'south-upper',
    name: 'South Stand Upper Tiers',
    sectorId: 'south',
    capacity: 1700,
    allowedTicketCategories: ['general'],
    primaryGateIds: ['gate-19', 'gate-21'],
    alternativeGateIds: ['gate-18']
  }
};

/**
 * Authoritative 21-Gate Stadium Configuration
 * Exactly 21 gates, with 4 designated reserved gates receiving 0 public demand.
 */
export const STADIUM_21_GATES: readonly StadiumGateDefinition[] = [
  // -------------------------------------------------------------------------
  // EAST SECTOR (MG Road & Cubbon Road): G1 - G5
  // -------------------------------------------------------------------------
  {
    gateNumber: 1,
    id: 'gate-1',
    displayName: 'Gate 1 (Main MG Road Ingress)',
    entryRoadGroup: 'MG Road',
    externalReferenceId: 'E-1',
    mappingStatus: 'confirmed',
    gateType: 'public',
    publicEntryEligible: true,
    connectedStandIds: ['stand-A', 'stand-B'],
    authorizedTicketCategories: ['general', 'premium'],
    turnstileCount: 6,
    defaultLatencySec: 4.0,
    approachGeometryStatus: 'verified',
    angleDeg: 330,
    sectorId: 'east',
    nominalDemandWeight: 0.12
  },
  {
    gateNumber: 2,
    id: 'gate-2',
    displayName: 'Gate 2 (Turnstile A — East Stand)',
    entryRoadGroup: 'MG Road',
    externalReferenceId: 'E-2',
    mappingStatus: 'confirmed',
    gateType: 'public',
    publicEntryEligible: true,
    connectedStandIds: ['stand-A', 'stand-B', 'stand-C'],
    authorizedTicketCategories: ['general', 'premium'],
    turnstileCount: 4,
    defaultLatencySec: 4.0,
    approachGeometryStatus: 'verified',
    angleDeg: 345,
    sectorId: 'east',
    nominalDemandWeight: 0.14
  },
  {
    gateNumber: 3,
    id: 'gate-3',
    displayName: 'Gate 3 (Cubbon Road Auxiliary B)',
    entryRoadGroup: 'Cubbon Road',
    externalReferenceId: 'E-3',
    mappingStatus: 'confirmed',
    gateType: 'public',
    publicEntryEligible: true,
    connectedStandIds: ['stand-A', 'stand-C', 'stand-G'],
    authorizedTicketCategories: ['general', 'premium'],
    turnstileCount: 4,
    defaultLatencySec: 4.0,
    approachGeometryStatus: 'verified',
    angleDeg: 0,
    sectorId: 'east',
    nominalDemandWeight: 0.08
  },
  {
    gateNumber: 4,
    id: 'gate-4',
    displayName: 'Gate 4 (Platinum Lounge / VIP)',
    entryRoadGroup: 'Cubbon Road',
    externalReferenceId: 'E-22',
    mappingStatus: 'confirmed',
    gateType: 'vip',
    publicEntryEligible: false, // RESERVED GATE 1/4 (VIP & Hospitality)
    connectedStandIds: ['platinum-lounge'],
    authorizedTicketCategories: ['vip', 'hospitality'],
    turnstileCount: 3,
    defaultLatencySec: 6.0,
    approachGeometryStatus: 'macro_estimate',
    angleDeg: 15,
    sectorId: 'east',
    nominalDemandWeight: 0.00 // Zero public demand
  },
  {
    gateNumber: 5,
    id: 'gate-5',
    displayName: 'Gate 5 (Stand G & East Upper)',
    entryRoadGroup: 'Cubbon Road',
    externalReferenceId: 'E-18',
    mappingStatus: 'confirmed',
    gateType: 'public',
    publicEntryEligible: true,
    connectedStandIds: ['stand-G'],
    authorizedTicketCategories: ['general'],
    turnstileCount: 4,
    defaultLatencySec: 4.0,
    approachGeometryStatus: 'macro_estimate',
    angleDeg: 30,
    sectorId: 'east',
    nominalDemandWeight: 0.06
  },

  // -------------------------------------------------------------------------
  // NORTH SECTOR (Queen's Road): G6 - G10
  // -------------------------------------------------------------------------
  {
    gateNumber: 6,
    id: 'gate-6',
    displayName: 'Gate 6 (Corporate D / Queen\'s Road)',
    entryRoadGroup: 'Queen\'s Road',
    externalReferenceId: 'E-05',
    mappingStatus: 'confirmed',
    gateType: 'public',
    publicEntryEligible: true,
    connectedStandIds: ['corporate-D'],
    authorizedTicketCategories: ['premium', 'hospitality'],
    turnstileCount: 4,
    defaultLatencySec: 4.5,
    approachGeometryStatus: 'macro_estimate',
    angleDeg: 60,
    sectorId: 'north',
    nominalDemandWeight: 0.07
  },
  {
    gateNumber: 7,
    id: 'gate-7',
    displayName: 'Gate 7 (Unresolved North Position 7)',
    entryRoadGroup: 'Unassigned (Pending Survey)',
    externalReferenceId: 'E-UNRESOLVED',
    mappingStatus: 'unresolved_placeholder',
    gateType: 'public',
    publicEntryEligible: true,
    connectedStandIds: ['corporate-D', 'north-lower'],
    authorizedTicketCategories: ['general'],
    turnstileCount: 3,
    defaultLatencySec: 4.0,
    approachGeometryStatus: 'macro_estimate',
    angleDeg: 75,
    sectorId: 'north',
    nominalDemandWeight: 0.05
  },
  {
    gateNumber: 8,
    id: 'gate-8',
    displayName: 'Gate 8 (Pavilion Tiers P1–P3 & Diamond Box)',
    entryRoadGroup: 'Queen\'s Road',
    externalReferenceId: 'E-08',
    mappingStatus: 'confirmed',
    gateType: 'public',
    publicEntryEligible: true,
    connectedStandIds: ['pavilion-tiers', 'diamond-box'],
    authorizedTicketCategories: ['general', 'premium', 'hospitality', 'vip'],
    turnstileCount: 5,
    defaultLatencySec: 4.5,
    approachGeometryStatus: 'macro_estimate',
    angleDeg: 90,
    sectorId: 'north',
    nominalDemandWeight: 0.08
  },
  {
    gateNumber: 9,
    id: 'gate-9',
    displayName: 'Gate 9 (National Media Centre / VIP Broadcast)',
    entryRoadGroup: 'Queen\'s Road',
    externalReferenceId: 'E-MEDIA-VIP',
    mappingStatus: 'confirmed',
    gateType: 'vip',
    publicEntryEligible: false, // RESERVED GATE 2/4 (Media & VIP Broadcast)
    connectedStandIds: ['media-centre'],
    authorizedTicketCategories: ['vip'],
    turnstileCount: 2,
    defaultLatencySec: 8.0,
    approachGeometryStatus: 'macro_estimate',
    angleDeg: 105,
    sectorId: 'north',
    nominalDemandWeight: 0.00 // Zero public demand
  },
  {
    gateNumber: 10,
    id: 'gate-10',
    displayName: 'Gate 10 (Unresolved North Position 10)',
    entryRoadGroup: 'Unassigned (Pending Survey)',
    externalReferenceId: 'E-UNRESOLVED',
    mappingStatus: 'unresolved_placeholder',
    gateType: 'public',
    publicEntryEligible: true,
    connectedStandIds: ['north-lower'],
    authorizedTicketCategories: ['general'],
    turnstileCount: 4,
    defaultLatencySec: 4.0,
    approachGeometryStatus: 'macro_estimate',
    angleDeg: 120,
    sectorId: 'north',
    nominalDemandWeight: 0.06
  },

  // -------------------------------------------------------------------------
  // WEST SECTOR (Link Road & KSLTA): G11 - G15
  // -------------------------------------------------------------------------
  {
    gateNumber: 11,
    id: 'gate-11',
    displayName: 'Gate 11 (Stand E / Link Road)',
    entryRoadGroup: 'Link Road',
    externalReferenceId: 'E-11',
    mappingStatus: 'confirmed',
    gateType: 'public',
    publicEntryEligible: true,
    connectedStandIds: ['stand-E'],
    authorizedTicketCategories: ['general'],
    turnstileCount: 3,
    defaultLatencySec: 4.0,
    approachGeometryStatus: 'macro_estimate',
    angleDeg: 150,
    sectorId: 'west',
    nominalDemandWeight: 0.05
  },
  {
    gateNumber: 12,
    id: 'gate-12',
    displayName: 'Gate 12 (Stand F Block 1)',
    entryRoadGroup: 'Link Road',
    externalReferenceId: 'E-12',
    mappingStatus: 'confirmed',
    gateType: 'public',
    publicEntryEligible: true,
    connectedStandIds: ['stand-F-block1'],
    authorizedTicketCategories: ['general', 'premium'],
    turnstileCount: 4,
    defaultLatencySec: 4.0,
    approachGeometryStatus: 'macro_estimate',
    angleDeg: 165,
    sectorId: 'west',
    nominalDemandWeight: 0.05
  },
  {
    gateNumber: 13,
    id: 'gate-13',
    displayName: 'Gate 13 (KSCA Members Restricted Club Gate)',
    entryRoadGroup: 'Link Road',
    externalReferenceId: 'E-13',
    mappingStatus: 'confirmed',
    gateType: 'restricted',
    publicEntryEligible: false, // RESERVED GATE 3/4 (Members Only Restricted)
    connectedStandIds: ['ksca-clubhouse'],
    authorizedTicketCategories: ['members'],
    turnstileCount: 3,
    defaultLatencySec: 5.0,
    approachGeometryStatus: 'macro_estimate',
    angleDeg: 180,
    sectorId: 'west',
    nominalDemandWeight: 0.00 // Zero public demand
  },
  {
    gateNumber: 14,
    id: 'gate-14',
    displayName: 'Gate 14 (Stand F Block 2 & H Upper)',
    entryRoadGroup: 'Link Road',
    externalReferenceId: 'E-14',
    mappingStatus: 'confirmed',
    gateType: 'public',
    publicEntryEligible: true,
    connectedStandIds: ['stand-F-block2', 'stand-H-upper'],
    authorizedTicketCategories: ['general'],
    turnstileCount: 4,
    defaultLatencySec: 4.0,
    approachGeometryStatus: 'macro_estimate',
    angleDeg: 195,
    sectorId: 'west',
    nominalDemandWeight: 0.06
  },
  {
    gateNumber: 15,
    id: 'gate-15',
    displayName: 'Gate 15 (M2 Annexe & West Ramp)',
    entryRoadGroup: 'Link Road',
    externalReferenceId: 'E-15',
    mappingStatus: 'confirmed',
    gateType: 'public',
    publicEntryEligible: true,
    connectedStandIds: ['m2-annexe'],
    authorizedTicketCategories: ['general', 'premium'],
    turnstileCount: 3,
    defaultLatencySec: 4.0,
    approachGeometryStatus: 'macro_estimate',
    angleDeg: 210,
    sectorId: 'west',
    nominalDemandWeight: 0.04
  },

  // -------------------------------------------------------------------------
  // SOUTH SECTOR (Kasturba Road & Cubbon Park): G16 - G21
  // -------------------------------------------------------------------------
  {
    gateNumber: 16,
    id: 'gate-16',
    displayName: 'Gate 16 (Cubbon Park Approach / South Lower)',
    entryRoadGroup: 'Link Road',
    externalReferenceId: 'E-16',
    mappingStatus: 'confirmed',
    gateType: 'public',
    publicEntryEligible: true,
    connectedStandIds: ['south-lower'],
    authorizedTicketCategories: ['general'],
    turnstileCount: 4,
    defaultLatencySec: 4.0,
    approachGeometryStatus: 'macro_estimate',
    angleDeg: 240,
    sectorId: 'south',
    nominalDemandWeight: 0.04
  },
  {
    gateNumber: 17,
    id: 'gate-17',
    displayName: 'Gate 17 (South Lower Tiers Ingress)',
    entryRoadGroup: 'Link Road',
    externalReferenceId: 'E-17',
    mappingStatus: 'confirmed',
    gateType: 'public',
    publicEntryEligible: true,
    connectedStandIds: ['south-lower'],
    authorizedTicketCategories: ['general'],
    turnstileCount: 4,
    defaultLatencySec: 4.0,
    approachGeometryStatus: 'macro_estimate',
    angleDeg: 255,
    sectorId: 'south',
    nominalDemandWeight: 0.04
  },
  {
    gateNumber: 18,
    id: 'gate-18',
    displayName: 'Gate 18 (B-Challengers Concourse)',
    entryRoadGroup: 'Cubbon Road',
    externalReferenceId: 'E-19',
    mappingStatus: 'confirmed',
    gateType: 'public',
    publicEntryEligible: true,
    connectedStandIds: ['b-challengers'],
    authorizedTicketCategories: ['general', 'premium'],
    turnstileCount: 5,
    defaultLatencySec: 4.0,
    approachGeometryStatus: 'macro_estimate',
    angleDeg: 270,
    sectorId: 'south',
    nominalDemandWeight: 0.06
  },
  {
    gateNumber: 19,
    id: 'gate-19',
    displayName: 'Gate 19 (Unresolved South Position 19)',
    entryRoadGroup: 'Unassigned (Pending Survey)',
    externalReferenceId: 'E-UNRESOLVED',
    mappingStatus: 'unresolved_placeholder',
    gateType: 'public',
    publicEntryEligible: true,
    connectedStandIds: ['south-upper'],
    authorizedTicketCategories: ['general'],
    turnstileCount: 4,
    defaultLatencySec: 4.0,
    approachGeometryStatus: 'macro_estimate',
    angleDeg: 285,
    sectorId: 'south',
    nominalDemandWeight: 0.03
  },
  {
    gateNumber: 20,
    id: 'gate-20',
    displayName: 'Gate 20 (Perimeter Emergency Egress Route)',
    entryRoadGroup: 'Kasturba Road',
    externalReferenceId: 'E-23',
    mappingStatus: 'confirmed',
    gateType: 'emergency',
    publicEntryEligible: false, // RESERVED GATE 4/4 (Emergency Access Only)
    connectedStandIds: [],
    authorizedTicketCategories: [],
    turnstileCount: 6,
    defaultLatencySec: 1.0,
    approachGeometryStatus: 'macro_estimate',
    angleDeg: 300,
    sectorId: 'south',
    nominalDemandWeight: 0.00 // Zero public demand
  },
  {
    gateNumber: 21,
    id: 'gate-21',
    displayName: 'Gate 21 (Unresolved South-East Position 21)',
    entryRoadGroup: 'Unassigned (Pending Survey)',
    externalReferenceId: 'E-UNRESOLVED',
    mappingStatus: 'unresolved_placeholder',
    gateType: 'public',
    publicEntryEligible: true,
    connectedStandIds: ['south-upper'],
    authorizedTicketCategories: ['general'],
    turnstileCount: 4,
    defaultLatencySec: 4.0,
    approachGeometryStatus: 'macro_estimate',
    angleDeg: 312,
    sectorId: 'south',
    nominalDemandWeight: 0.02
  }
];

/**
 * Quick Lookup Map for 21 Stadium Gates by canonical id ('gate-1' .. 'gate-21')
 */
export const STADIUM_21_GATES_BY_ID: Record<string, StadiumGateDefinition> = Object.fromEntries(
  STADIUM_21_GATES.map((g) => [g.id, g])
);

/**
 * Filtered array of strictly public-entry eligible gates (17 gates total)
 */
export const PUBLIC_STADIUM_GATES: readonly StadiumGateDefinition[] = STADIUM_21_GATES.filter(
  (g) => g.publicEntryEligible
);

/**
 * Filtered array of strictly reserved gates (4 gates: G4, G9, G13, G20)
 */
export const RESERVED_STADIUM_GATES: readonly StadiumGateDefinition[] = STADIUM_21_GATES.filter(
  (g) => !g.publicEntryEligible
);

/**
 * Filtered array of confirmed gates from official reference
 */
export const CONFIRMED_GATES: readonly StadiumGateDefinition[] = STADIUM_21_GATES.filter(
  (g) => g.mappingStatus === 'confirmed'
);

/**
 * Filtered array of explicit placeholder gates pending CAD blueprints
 */
export const PLACEHOLDER_GATES: readonly StadiumGateDefinition[] = STADIUM_21_GATES.filter(
  (g) => g.mappingStatus === 'unresolved_placeholder'
);
