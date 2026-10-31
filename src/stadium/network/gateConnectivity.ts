/**
 * CROWDWISE — Phase 2: Pedestrian Ingress Network & Gate Connectivity
 * M. Chinnaswamy Stadium, Bengaluru
 *
 * Ground truth gate connectivity graph derived from official KSCA ingress blueprint:
 * OUTER GATE ──► PEDESTRIAN CORRIDOR ──► HOLDING AREA ──► INNER TURNSTILES ──► DESTINATION STAND
 */

import { VerificationStatus, AccessPermission } from '../types/stadium';

export interface GateConnectionSpec {
  outerGateId: string;
  road: string;
  accessPermission: AccessPermission;
  verificationStatus: VerificationStatus;
  connectedInnerGates: string[];
  holdingAreaId?: string;
  holdingCapacity: number;
  notes: string;
}

export interface InnerGateStandSpec {
  innerGateId: string;
  standId: string;
  standName: string;
  turnstileCount: number;
  nominalThroughputPerMin: number;
  serviceLatencySec: number;
  section: string;
}

/**
 * Verified connectivity map from Outer Perimeter Gates (E1–E23)
 * to Inner Concourse Turnstile Banks (G1–G15).
 */
export const GATE_CONNECTIVITY_CATALOG: Record<string, GateConnectionSpec> = {
  // ─── CUBBON ROAD (NORTH SECTOR) ─────────────────────────────────────
  E3: {
    outerGateId: 'E3',
    road: 'CUBBON_ROAD',
    accessPermission: 'SPECTATOR_PERMITTED',
    verificationStatus: 'VERIFIED',
    connectedInnerGates: ['G4', 'G5'],
    holdingCapacity: 600,
    notes: 'Long North-West promenade along B-Ground feeding A Stand.'
  },
  E2: {
    outerGateId: 'E2',
    road: 'CUBBON_ROAD',
    accessPermission: 'SPECTATOR_PERMITTED',
    verificationStatus: 'VERIFIED',
    connectedInnerGates: ['G5'],
    holdingCapacity: 450,
    notes: 'Direct ingress corridor into A Stand Upper Tier.'
  },
  E1: {
    outerGateId: 'E1',
    road: 'CUBBON_ROAD',
    accessPermission: 'SPECTATOR_PERMITTED',
    verificationStatus: 'VERIFIED',
    connectedInnerGates: ['G5', 'G6'],
    holdingCapacity: 500,
    notes: 'North-West concourse approach splitting between A Stand and B Stand.'
  },
  E23: {
    outerGateId: 'E23',
    road: 'CUBBON_ROAD',
    accessPermission: 'SPECTATOR_PERMITTED',
    verificationStatus: 'VERIFIED',
    connectedInnerGates: ['G6', 'G7'],
    holdingAreaId: 'HOLDING_G7_G8',
    holdingCapacity: 750,
    notes: 'Feeds B Stand and Platinum Lounge holding concourse.'
  },
  E22: {
    outerGateId: 'E22',
    road: 'CUBBON_ROAD',
    accessPermission: 'SPECTATOR_PERMITTED',
    verificationStatus: 'VERIFIED',
    connectedInnerGates: ['G7', 'G8'],
    holdingAreaId: 'HOLDING_G7_G8',
    holdingCapacity: 800,
    notes: 'High-volume artery into C Stand Main, adjacent to North Medical Bay.'
  },
  E21: {
    outerGateId: 'E21',
    road: 'CUBBON_ROAD',
    accessPermission: 'SPECTATOR_PERMITTED',
    verificationStatus: 'UNVERIFIED',
    connectedInnerGates: ['G8'],
    holdingCapacity: 350,
    notes: 'Mid-fence gate opposite Minsk Square. Connection marked UNVERIFIED.'
  },
  E20: {
    outerGateId: 'E20',
    road: 'CUBBON_ROAD',
    accessPermission: 'SPECTATOR_PERMITTED',
    verificationStatus: 'UNVERIFIED',
    connectedInnerGates: ['G8', 'G9'],
    holdingCapacity: 400,
    notes: 'Intermediate North concourse gate. Connection marked UNVERIFIED.'
  },
  E19: {
    outerGateId: 'E19',
    road: 'CUBBON_ROAD',
    accessPermission: 'SPECTATOR_PERMITTED',
    verificationStatus: 'VERIFIED',
    connectedInnerGates: ['G9', 'G10'],
    holdingAreaId: 'HOLDING_G9_G10',
    holdingCapacity: 700,
    notes: 'Feeds C Stand East and Grand Terrace via dedicated green holding pen.'
  },
  E18: {
    outerGateId: 'E18',
    road: 'CUBBON_ROAD',
    accessPermission: 'SPECTATOR_PERMITTED',
    verificationStatus: 'VERIFIED',
    connectedInnerGates: ['G10'],
    holdingAreaId: 'HOLDING_G9_G10',
    holdingCapacity: 500,
    notes: 'North-East approach adjacent to Security Watchtower into Grand Terrace.'
  },
  E4: {
    outerGateId: 'E4',
    road: 'CUBBON_ROAD',
    accessPermission: 'SPECTATOR_PERMITTED',
    verificationStatus: 'UNVERIFIED',
    connectedInnerGates: ['G10', 'G11'],
    holdingCapacity: 300,
    notes: 'Corner portal near BRV Junction. Connection marked UNVERIFIED.'
  },

  // ─── LINK ROAD & ST. MARKS (EAST SECTOR) ────────────────────────────
  E17: {
    outerGateId: 'E17',
    road: 'LINK_ROAD',
    accessPermission: 'SPECTATOR_PERMITTED',
    verificationStatus: 'VERIFIED',
    connectedInnerGates: ['G11', 'G12'],
    holdingAreaId: 'HOLDING_G12_G13',
    holdingCapacity: 600,
    notes: 'Upper East grandstand ingress feeding E Stand Main and H Upper.'
  },
  E16: {
    outerGateId: 'E16',
    road: 'LINK_ROAD',
    accessPermission: 'SPECTATOR_PERMITTED',
    verificationStatus: 'VERIFIED',
    connectedInnerGates: ['G12', 'G13'],
    holdingAreaId: 'HOLDING_G12_G13',
    holdingCapacity: 650,
    notes: 'Direct approach corridor into H Upper and F Stand lower concourse.'
  },
  E15: {
    outerGateId: 'E15',
    road: 'LINK_ROAD',
    accessPermission: 'SPECTATOR_PERMITTED',
    verificationStatus: 'UNVERIFIED',
    connectedInnerGates: ['G13'],
    holdingCapacity: 350,
    notes: 'Mid Link Road service portal. Connection marked UNVERIFIED.'
  },
  E14: {
    outerGateId: 'E14',
    road: 'LINK_ROAD',
    accessPermission: 'SPECTATOR_PERMITTED',
    verificationStatus: 'UNVERIFIED',
    connectedInnerGates: ['G14'],
    holdingCapacity: 400,
    notes: 'Link Road approach near East Medical Post. Connection marked UNVERIFIED.'
  },
  E13: {
    outerGateId: 'E13',
    road: 'LINK_ROAD',
    accessPermission: 'SPECTATOR_PERMITTED',
    verificationStatus: 'VERIFIED',
    connectedInnerGates: ['G14', 'G15'],
    holdingAreaId: 'HOLDING_G14',
    holdingCapacity: 800,
    notes: 'High-capacity dual portal with E12 into M3, M4, and M2 Annexe.'
  },
  E12: {
    outerGateId: 'E12',
    road: 'LINK_ROAD',
    accessPermission: 'SPECTATOR_PERMITTED',
    verificationStatus: 'VERIFIED',
    connectedInnerGates: ['G14', 'G15'],
    holdingAreaId: 'HOLDING_G14',
    holdingCapacity: 800,
    notes: 'Paired with E13 to process high-density east grandstand crowds.'
  },
  E11: {
    outerGateId: 'E11',
    road: 'LINK_ROAD',
    accessPermission: 'SPECTATOR_PERMITTED',
    verificationStatus: 'VERIFIED',
    connectedInnerGates: ['G15'],
    holdingAreaId: 'HOLDING_G15',
    holdingCapacity: 1200,
    notes: 'Mass transit feeder from MG Road Metro Plaza into M2 Annexe.'
  },

  // ─── QUEENS ROAD (WEST SECTOR — STRICTLY RESTRICTED) ────────────────
  E5: {
    outerGateId: 'E5',
    road: 'QUEENS_ROAD',
    accessPermission: 'RESTRICTED_VIP_MEDIA',
    verificationStatus: 'RESTRICTED',
    connectedInnerGates: ['G4', 'G5'],
    holdingCapacity: 200,
    notes: 'RESTRICTED: Match officials, players, and VIP escort only.'
  },
  E6: {
    outerGateId: 'E6',
    road: 'QUEENS_ROAD',
    accessPermission: 'RESTRICTED_VIP_MEDIA',
    verificationStatus: 'RESTRICTED',
    connectedInnerGates: ['G4'],
    holdingCapacity: 150,
    notes: 'RESTRICTED: OB vans, broadcast trucks and media personnel.'
  },
  E7: {
    outerGateId: 'E7',
    road: 'QUEENS_ROAD',
    accessPermission: 'RESTRICTED_VIP_MEDIA',
    verificationStatus: 'RESTRICTED',
    connectedInnerGates: ['G4'],
    holdingCapacity: 150,
    notes: 'RESTRICTED: KSCA Members Pavilion private service access.'
  },
  E8: {
    outerGateId: 'E8',
    road: 'QUEENS_ROAD',
    accessPermission: 'RESTRICTED_VIP_MEDIA',
    verificationStatus: 'RESTRICTED',
    connectedInnerGates: ['G2', 'G3'],
    holdingCapacity: 250,
    notes: 'RESTRICTED: VIP hospitality shuttles to P3 and P1 Annexe.'
  },
  E9: {
    outerGateId: 'E9',
    road: 'QUEENS_ROAD',
    accessPermission: 'RESTRICTED_VIP_MEDIA',
    verificationStatus: 'RESTRICTED',
    connectedInnerGates: ['G2'],
    holdingCapacity: 150,
    notes: 'RESTRICTED: Police security operations and staff post.'
  },
  E10: {
    outerGateId: 'E10',
    road: 'QUEENS_ROAD',
    accessPermission: 'RESTRICTED_VIP_MEDIA',
    verificationStatus: 'RESTRICTED',
    connectedInnerGates: ['G1', 'G2'],
    holdingCapacity: 300,
    notes: 'RESTRICTED: Leads to KSCA Car Park & Corporate Box parking.'
  }
};

/**
 * Inner Turnstile Banks to Destination Stand Topology
 */
export const INNER_GATE_STAND_CATALOG: Record<string, InnerGateStandSpec> = {
  G1: {
    innerGateId: 'G1',
    standId: 'P_TERRACE_CORPORATE',
    standName: 'P Terrace & P Corporate',
    turnstileCount: 4,
    nominalThroughputPerMin: 240,
    serviceLatencySec: 1.0,
    section: 'SOUTH_MG'
  },
  G2: {
    innerGateId: 'G2',
    standId: 'P1_ANNEXE_LOFT',
    standName: 'P1 Annexe / P-Loft',
    turnstileCount: 4,
    nominalThroughputPerMin: 240,
    serviceLatencySec: 1.0,
    section: 'SOUTH_MG'
  },
  G3: {
    innerGateId: 'G3',
    standId: 'P3_STAND',
    standName: 'P3 Stand',
    turnstileCount: 3,
    nominalThroughputPerMin: 180,
    serviceLatencySec: 1.0,
    section: 'SOUTH_MG'
  },
  G4: {
    innerGateId: 'G4',
    standId: 'A_STAND',
    standName: 'A Stand Lower',
    turnstileCount: 4,
    nominalThroughputPerMin: 240,
    serviceLatencySec: 1.0,
    section: 'WEST_QUEENS'
  },
  G5: {
    innerGateId: 'G5',
    standId: 'A_STAND',
    standName: 'A Stand Upper Tier',
    turnstileCount: 5,
    nominalThroughputPerMin: 300,
    serviceLatencySec: 1.0,
    section: 'NORTH_CUBBON'
  },
  G6: {
    innerGateId: 'G6',
    standId: 'B_STAND',
    standName: 'B Stand',
    turnstileCount: 4,
    nominalThroughputPerMin: 240,
    serviceLatencySec: 1.0,
    section: 'NORTH_CUBBON'
  },
  G7: {
    innerGateId: 'G7',
    standId: 'PLATINUM_LOUNGE',
    standName: 'Platinum Lounge & C Stand Left',
    turnstileCount: 3,
    nominalThroughputPerMin: 180,
    serviceLatencySec: 1.0,
    section: 'NORTH_CUBBON'
  },
  G8: {
    innerGateId: 'G8',
    standId: 'C_STAND',
    standName: 'C Stand Main',
    turnstileCount: 6,
    nominalThroughputPerMin: 360,
    serviceLatencySec: 1.0,
    section: 'NORTH_CUBBON'
  },
  G9: {
    innerGateId: 'G9',
    standId: 'C_STAND',
    standName: 'C Stand East & Grand Terrace',
    turnstileCount: 5,
    nominalThroughputPerMin: 300,
    serviceLatencySec: 1.0,
    section: 'NORTH_CUBBON'
  },
  G10: {
    innerGateId: 'G10',
    standId: 'GRAND_TERRACE',
    standName: 'Grand Terrace Concourse',
    turnstileCount: 4,
    nominalThroughputPerMin: 240,
    serviceLatencySec: 1.0,
    section: 'NORTH_CUBBON'
  },
  G11: {
    innerGateId: 'G11',
    standId: 'E_STAND',
    standName: 'E Stand / Grand Terrace Upper',
    turnstileCount: 4,
    nominalThroughputPerMin: 240,
    serviceLatencySec: 1.0,
    section: 'EAST_LINK'
  },
  G12: {
    innerGateId: 'G12',
    standId: 'H_UPPER',
    standName: 'H Upper Tier',
    turnstileCount: 4,
    nominalThroughputPerMin: 240,
    serviceLatencySec: 1.0,
    section: 'EAST_LINK'
  },
  G13: {
    innerGateId: 'G13',
    standId: 'F_STAND',
    standName: 'F Stand / H Concourse',
    turnstileCount: 5,
    nominalThroughputPerMin: 300,
    serviceLatencySec: 1.0,
    section: 'EAST_LINK'
  },
  G14: {
    innerGateId: 'G14',
    standId: 'M3_M4',
    standName: 'M3 & M4 Stands',
    turnstileCount: 6,
    nominalThroughputPerMin: 360,
    serviceLatencySec: 1.0,
    section: 'EAST_LINK'
  },
  G15: {
    innerGateId: 'G15',
    standId: 'M2_ANNEXE',
    standName: 'M2 Annexe',
    turnstileCount: 4,
    nominalThroughputPerMin: 240,
    serviceLatencySec: 1.0,
    section: 'EAST_LINK'
  }
};

