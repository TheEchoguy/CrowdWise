import { OuterGate } from '../types/stadium';

/**
 * Authentic Outer Perimeter Gates (E-Series: E1 to E23)
 * M. Chinnaswamy Stadium, Bengaluru
 *
 * Operational Venue Restriction:
 * Official KSCA ingress security regulations state that Spectator Entry is strictly
 * permitted ONLY via Cubbon Road (North) and Link Road (East).
 * Queens Road (West) gates (E5, E6, E7, E8, E9, E10) are strictly RESTRICTED to
 * Media, VIP Dignitaries, Team Coaches & Police Personnel.
 */

export const CHINNASWAMY_OUTER_GATES: OuterGate[] = [
  // ─── CUBBON ROAD (NORTH PERIMETER) ──────────────────────────────────
  {
    id: 'E3',
    label: 'Gate E3',
    road: 'CUBBON_ROAD',
    section: 'NORTH_CUBBON',
    x: 440,
    y: 185,
    approachVector: { dx: 0.1, dy: 0.99 },
    accessPermission: 'SPECTATOR_PERMITTED',
    verificationStatus: 'VERIFIED',
    connectedInnerGates: ['G4', 'G5'],
    holdingAreaLabel: 'B-Ground Promenade',
    notes: 'Directly verified from Cubbon Road map crop. Connects to West Pavilion Wing (A Stand).'
  },
  {
    id: 'E2',
    label: 'Gate E2',
    road: 'CUBBON_ROAD',
    section: 'NORTH_CUBBON',
    x: 495,
    y: 185,
    approachVector: { dx: 0, dy: 1 },
    accessPermission: 'SPECTATOR_PERMITTED',
    verificationStatus: 'VERIFIED',
    connectedInnerGates: ['G5'],
    holdingAreaLabel: 'North-West Promenade',
    notes: 'Directly verified from Cubbon Road map crop. Leads to Gate G5 (A Stand Upper).'
  },
  {
    id: 'E1',
    label: 'Gate E1',
    road: 'CUBBON_ROAD',
    section: 'NORTH_CUBBON',
    x: 555,
    y: 185,
    approachVector: { dx: 0, dy: 1 },
    accessPermission: 'SPECTATOR_PERMITTED',
    verificationStatus: 'VERIFIED',
    connectedInnerGates: ['G5', 'G6'],
    holdingAreaLabel: 'North-West Concourse',
    notes: 'Directly verified from Cubbon Road map crop. Splits flow to G5 and G6 (B Stand).'
  },
  {
    id: 'E23',
    label: 'Gate E23',
    road: 'CUBBON_ROAD',
    section: 'NORTH_CUBBON',
    x: 625,
    y: 185,
    approachVector: { dx: 0, dy: 1 },
    accessPermission: 'SPECTATOR_PERMITTED',
    verificationStatus: 'VERIFIED',
    connectedInnerGates: ['G6', 'G7'],
    holdingAreaLabel: 'Platinum Lounge Holding Concourse',
    notes: 'Directly verified from Cubbon Road map crop. Primary entrance to Platinum Lounge and B Stand.'
  },
  {
    id: 'E22',
    label: 'Gate E22',
    road: 'CUBBON_ROAD',
    section: 'NORTH_CUBBON',
    x: 695,
    y: 185,
    approachVector: { dx: 0, dy: 1 },
    accessPermission: 'SPECTATOR_PERMITTED',
    verificationStatus: 'VERIFIED',
    connectedInnerGates: ['G7', 'G8'],
    holdingAreaLabel: 'Holding Area for G7 & G8',
    notes: 'Directly verified from Cubbon Road map crop. Dedicated approach into C Stand holding pen.'
  },
  {
    id: 'E21',
    label: 'Gate E21',
    road: 'CUBBON_ROAD',
    section: 'NORTH_CUBBON',
    x: 760,
    y: 185,
    approachVector: { dx: 0, dy: 1 },
    accessPermission: 'SPECTATOR_PERMITTED',
    verificationStatus: 'UNVERIFIED',
    connectedInnerGates: ['G8'],
    notes: 'Mid-concourse access portal along central Cubbon Road fence. Exact route marked UNVERIFIED.'
  },
  {
    id: 'E20',
    label: 'Gate E20',
    road: 'CUBBON_ROAD',
    section: 'NORTH_CUBBON',
    x: 825,
    y: 185,
    approachVector: { dx: 0, dy: 1 },
    accessPermission: 'SPECTATOR_PERMITTED',
    verificationStatus: 'UNVERIFIED',
    connectedInnerGates: ['G8', 'G9'],
    notes: 'Intermediate gate opposite Minsk Square. Connection marked UNVERIFIED.'
  },
  {
    id: 'E19',
    label: 'Gate E19',
    road: 'CUBBON_ROAD',
    section: 'NORTH_CUBBON',
    x: 895,
    y: 185,
    approachVector: { dx: 0, dy: 1 },
    accessPermission: 'SPECTATOR_PERMITTED',
    verificationStatus: 'VERIFIED',
    connectedInnerGates: ['G9', 'G10'],
    holdingAreaLabel: 'Holding Area for G9 & G10',
    notes: 'Directly verified from Cubbon Road map crop. Leads to C Stand / Grand Terrace concourse.'
  },
  {
    id: 'E18',
    label: 'Gate E18',
    road: 'CUBBON_ROAD',
    section: 'NORTH_CUBBON',
    x: 960,
    y: 185,
    approachVector: { dx: 0, dy: 1 },
    accessPermission: 'SPECTATOR_PERMITTED',
    verificationStatus: 'VERIFIED',
    connectedInnerGates: ['G10'],
    holdingAreaLabel: 'Grand Terrace Holding Pen',
    notes: 'Directly verified from Cubbon Road map crop. Flanked by perimeter Security Watchtower.'
  },
  {
    id: 'E4',
    label: 'Gate E4',
    road: 'CUBBON_ROAD',
    section: 'NORTH_CUBBON',
    x: 1025,
    y: 195,
    approachVector: { dx: -0.2, dy: 0.98 },
    accessPermission: 'SPECTATOR_PERMITTED',
    verificationStatus: 'UNVERIFIED',
    connectedInnerGates: ['G10', 'G11'],
    notes: 'North-East perimeter gate near BRV Junction. Pathway connection marked UNVERIFIED.'
  },

  // ─── LINK ROAD / ST. MARKS (EAST PERIMETER) ─────────────────────────
  {
    id: 'E17',
    label: 'Gate E17',
    road: 'LINK_ROAD',
    section: 'EAST_LINK',
    x: 1240,
    y: 310,
    approachVector: { dx: -1, dy: 0 },
    accessPermission: 'SPECTATOR_PERMITTED',
    verificationStatus: 'VERIFIED',
    connectedInnerGates: ['G11', 'G12'],
    holdingAreaLabel: 'Holding Area for G11 & G12',
    notes: 'Directly verified from Link Road map crop. Splits to Grand Terrace (G11) and H Upper (G12).'
  },
  {
    id: 'E16',
    label: 'Gate E16',
    road: 'LINK_ROAD',
    section: 'EAST_LINK',
    x: 1240,
    y: 420,
    approachVector: { dx: -1, dy: 0 },
    accessPermission: 'SPECTATOR_PERMITTED',
    verificationStatus: 'VERIFIED',
    connectedInnerGates: ['G12', 'G13'],
    holdingAreaLabel: 'Holding Area for G12 & G13',
    notes: 'Directly verified from Link Road map crop. Feeds H Upper Tier (G12) and F Stand (G13).'
  },
  {
    id: 'E15',
    label: 'Gate E15',
    road: 'LINK_ROAD',
    section: 'EAST_LINK',
    x: 1240,
    y: 490,
    approachVector: { dx: -1, dy: 0 },
    accessPermission: 'SPECTATOR_PERMITTED',
    verificationStatus: 'UNVERIFIED',
    connectedInnerGates: ['G13'],
    notes: 'Mid Link Road gate portal. Direct inner connection unconfirmed in crop, marked UNVERIFIED.'
  },
  {
    id: 'E14',
    label: 'Gate E14',
    road: 'LINK_ROAD',
    section: 'EAST_LINK',
    x: 1240,
    y: 560,
    approachVector: { dx: -1, dy: 0 },
    accessPermission: 'SPECTATOR_PERMITTED',
    verificationStatus: 'UNVERIFIED',
    connectedInnerGates: ['G14'],
    notes: 'Intermediate gate near East Medical Post. Pathway marked UNVERIFIED.'
  },
  {
    id: 'E13',
    label: 'Gate E13',
    road: 'LINK_ROAD',
    section: 'EAST_LINK',
    x: 1240,
    y: 640,
    approachVector: { dx: -1, dy: 0 },
    accessPermission: 'SPECTATOR_PERMITTED',
    verificationStatus: 'VERIFIED',
    connectedInnerGates: ['G14', 'G15'],
    holdingAreaLabel: 'Holding Area for G14',
    notes: 'Directly verified from Link Road map crop. High-capacity dual portal with E12 into M Stands.'
  },
  {
    id: 'E12',
    label: 'Gate E12',
    road: 'LINK_ROAD',
    section: 'EAST_LINK',
    x: 1240,
    y: 680,
    approachVector: { dx: -1, dy: 0 },
    accessPermission: 'SPECTATOR_PERMITTED',
    verificationStatus: 'VERIFIED',
    connectedInnerGates: ['G14', 'G15'],
    holdingAreaLabel: 'Holding Area for G14',
    notes: 'Directly verified from Link Road map crop. Paired with E13 to feed M3/M4 & M2 Annexe.'
  },
  {
    id: 'E11',
    label: 'Gate E11',
    road: 'LINK_ROAD',
    section: 'SOUTH_MG',
    x: 1160,
    y: 940,
    approachVector: { dx: -0.6, dy: -0.8 },
    accessPermission: 'SPECTATOR_PERMITTED',
    verificationStatus: 'VERIFIED',
    connectedInnerGates: ['G15'],
    holdingAreaLabel: 'Holding Area for G15',
    notes: 'Directly verified from Link Road map crop. Major apex entrance from MG Road Metro corridor.'
  },

  // ─── QUEENS ROAD (WEST PERIMETER — STRICTLY RESTRICTED) ─────────────
  {
    id: 'E5',
    label: 'Gate E5 [RESTRICTED]',
    road: 'QUEENS_ROAD',
    section: 'WEST_QUEENS',
    x: 360,
    y: 310,
    approachVector: { dx: 0.8, dy: 0.6 },
    accessPermission: 'RESTRICTED_VIP_MEDIA',
    verificationStatus: 'RESTRICTED',
    connectedInnerGates: ['G4', 'G5'],
    notes: 'Directly verified from Queens Road crop. RESTRICTED: Players, Match Officials & VIPs only. No public spectator entry.'
  },
  {
    id: 'E6',
    label: 'Gate E6 [RESTRICTED]',
    road: 'QUEENS_ROAD',
    section: 'WEST_QUEENS',
    x: 325,
    y: 410,
    approachVector: { dx: 0.8, dy: 0.6 },
    accessPermission: 'RESTRICTED_VIP_MEDIA',
    verificationStatus: 'RESTRICTED',
    connectedInnerGates: ['G4'],
    notes: 'RESTRICTED: Broadcast trucks, OB vans and media crew access corridor.'
  },
  {
    id: 'E7',
    label: 'Gate E7 [RESTRICTED]',
    road: 'QUEENS_ROAD',
    section: 'WEST_QUEENS',
    x: 290,
    y: 520,
    approachVector: { dx: 0.8, dy: 0.6 },
    accessPermission: 'RESTRICTED_VIP_MEDIA',
    verificationStatus: 'RESTRICTED',
    connectedInnerGates: ['G4'],
    notes: 'RESTRICTED: KSCA Members Pavilion private service carriageway.'
  },
  {
    id: 'E8',
    label: 'Gate E8 [RESTRICTED]',
    road: 'QUEENS_ROAD',
    section: 'WEST_QUEENS',
    x: 420,
    y: 690,
    approachVector: { dx: 0.8, dy: -0.6 },
    accessPermission: 'RESTRICTED_VIP_MEDIA',
    verificationStatus: 'RESTRICTED',
    connectedInnerGates: ['G2', 'G3'],
    notes: 'Directly verified from Queens Road crop. RESTRICTED: Hospitality guests & authorized shuttle service.'
  },
  {
    id: 'E9',
    label: 'Gate E9 [RESTRICTED]',
    road: 'QUEENS_ROAD',
    section: 'WEST_QUEENS',
    x: 455,
    y: 760,
    approachVector: { dx: 0.7, dy: -0.7 },
    accessPermission: 'RESTRICTED_VIP_MEDIA',
    verificationStatus: 'RESTRICTED',
    connectedInnerGates: ['G2'],
    notes: 'RESTRICTED: Police security post & emergency staff ingress.'
  },
  {
    id: 'E10',
    label: 'Gate E10 [RESTRICTED]',
    road: 'QUEENS_ROAD',
    section: 'WEST_QUEENS',
    x: 500,
    y: 830,
    approachVector: { dx: 0.6, dy: -0.8 },
    accessPermission: 'RESTRICTED_VIP_MEDIA',
    verificationStatus: 'RESTRICTED',
    connectedInnerGates: ['G1', 'G2'],
    notes: 'Directly verified from Queens Road crop. RESTRICTED: Leads to KSCA Car Park & Corporate Box parking.'
  }
];

