import { PedestrianRoute } from '../types/stadium';

/**
 * Authentic Pedestrian Ingress Routes
 * M. Chinnaswamy Stadium, Bengaluru
 *
 * Faithfully traces the red dotted pedestrian corridors from the official KSCA blueprint.
 * Unverified routes are explicitly marked with status: 'UNVERIFIED'.
 */

export const CHINNASWAMY_PEDESTRIAN_ROUTES: PedestrianRoute[] = [
  // ─── CUBBON ROAD NORTH INGRESS ROUTES ──────────────────────────────
  {
    id: 'ROUTE_E3_G4',
    outerGateId: 'E3',
    innerGateId: 'G4',
    points: [
      { x: 440, y: 185 },
      { x: 450, y: 250 },
      { x: 460, y: 440 },
      { x: 480, y: 640 }
    ],
    verificationStatus: 'VERIFIED',
    flowDirection: 'INBOUND',
    description: 'Long western promenade running between B-Ground and A Stand lower gates.'
  },
  {
    id: 'ROUTE_E3_G5',
    outerGateId: 'E3',
    innerGateId: 'G5',
    points: [
      { x: 440, y: 185 },
      { x: 460, y: 270 },
      { x: 500, y: 390 },
      { x: 530, y: 480 }
    ],
    verificationStatus: 'VERIFIED',
    flowDirection: 'INBOUND',
    description: 'Direct approach from Gate E3 branching towards A Stand Upper Tier.'
  },
  {
    id: 'ROUTE_E2_G5',
    outerGateId: 'E2',
    innerGateId: 'G5',
    points: [
      { x: 495, y: 185 },
      { x: 510, y: 270 },
      { x: 525, y: 380 },
      { x: 530, y: 480 }
    ],
    verificationStatus: 'VERIFIED',
    flowDirection: 'INBOUND',
    description: 'Direct North-West ingress corridor feeding A Stand Upper Tier.'
  },
  {
    id: 'ROUTE_E1_G5',
    outerGateId: 'E1',
    innerGateId: 'G5',
    points: [
      { x: 555, y: 185 },
      { x: 550, y: 310 },
      { x: 530, y: 480 }
    ],
    verificationStatus: 'VERIFIED',
    flowDirection: 'INBOUND',
    description: 'Feeder path from Gate E1 into A Stand upper vomitories.'
  },
  {
    id: 'ROUTE_E1_G6',
    outerGateId: 'E1',
    innerGateId: 'G6',
    points: [
      { x: 555, y: 185 },
      { x: 580, y: 280 },
      { x: 610, y: 375 }
    ],
    verificationStatus: 'VERIFIED',
    flowDirection: 'INBOUND',
    description: 'Main approach corridor from Gate E1 into B Stand concourse.'
  },
  {
    id: 'ROUTE_E23_G6',
    outerGateId: 'E23',
    innerGateId: 'G6',
    points: [
      { x: 625, y: 185 },
      { x: 620, y: 275 },
      { x: 610, y: 375 }
    ],
    verificationStatus: 'VERIFIED',
    flowDirection: 'INBOUND',
    description: 'Direct approach into B Stand lower turnstiles.'
  },
  {
    id: 'ROUTE_E23_G7',
    outerGateId: 'E23',
    innerGateId: 'G7',
    points: [
      { x: 625, y: 185 },
      { x: 660, y: 255 },
      { x: 700, y: 310 }
    ],
    verificationStatus: 'VERIFIED',
    holdingAreaId: 'HOLDING_G7_G8',
    flowDirection: 'INBOUND',
    description: 'Dedicated walkway leading to Platinum Lounge and West C Stand.'
  },
  {
    id: 'ROUTE_E22_G7',
    outerGateId: 'E22',
    innerGateId: 'G7',
    points: [
      { x: 695, y: 185 },
      { x: 695, y: 245 },
      { x: 700, y: 310 }
    ],
    verificationStatus: 'VERIFIED',
    holdingAreaId: 'HOLDING_G7_G8',
    flowDirection: 'INBOUND',
    description: 'Passes through holding area pen into Platinum Lounge entry portal.'
  },
  {
    id: 'ROUTE_E22_G8',
    outerGateId: 'E22',
    innerGateId: 'G8',
    points: [
      { x: 695, y: 185 },
      { x: 735, y: 230 },
      { x: 780, y: 275 }
    ],
    verificationStatus: 'VERIFIED',
    holdingAreaId: 'HOLDING_G7_G8',
    flowDirection: 'INBOUND',
    description: 'High-volume artery into C Stand Main, flanked by parked emergency ambulances.'
  },
  {
    id: 'ROUTE_E21_G8',
    outerGateId: 'E21',
    innerGateId: 'G8',
    points: [
      { x: 760, y: 185 },
      { x: 770, y: 230 },
      { x: 780, y: 275 }
    ],
    verificationStatus: 'UNVERIFIED',
    flowDirection: 'INBOUND',
    description: 'Secondary North fence ingress into C Stand. Connection unverified in blueprint crop.'
  },
  {
    id: 'ROUTE_E20_G9',
    outerGateId: 'E20',
    innerGateId: 'G9',
    points: [
      { x: 825, y: 185 },
      { x: 860, y: 235 },
      { x: 890, y: 285 }
    ],
    verificationStatus: 'UNVERIFIED',
    flowDirection: 'INBOUND',
    description: 'Central Cubbon Road portal into C Stand East. Connection unverified.'
  },
  {
    id: 'ROUTE_E19_G9',
    outerGateId: 'E19',
    innerGateId: 'G9',
    points: [
      { x: 895, y: 185 },
      { x: 895, y: 240 },
      { x: 890, y: 285 }
    ],
    verificationStatus: 'VERIFIED',
    holdingAreaId: 'HOLDING_G9_G10',
    flowDirection: 'INBOUND',
    description: 'Direct North-East approach through holding pen into C Stand East / Grand Terrace.'
  },
  {
    id: 'ROUTE_E19_G10',
    outerGateId: 'E19',
    innerGateId: 'G10',
    points: [
      { x: 895, y: 185 },
      { x: 935, y: 245 },
      { x: 980, y: 330 }
    ],
    verificationStatus: 'VERIFIED',
    holdingAreaId: 'HOLDING_G9_G10',
    flowDirection: 'INBOUND',
    description: 'Branch path feeding Grand Terrace lower turnstiles.'
  },
  {
    id: 'ROUTE_E18_G10',
    outerGateId: 'E18',
    innerGateId: 'G10',
    points: [
      { x: 960, y: 185 },
      { x: 970, y: 250 },
      { x: 980, y: 330 }
    ],
    verificationStatus: 'VERIFIED',
    flowDirection: 'INBOUND',
    description: 'Verified ingress path past North-East Watchtower into Grand Terrace.'
  },
  {
    id: 'ROUTE_E4_G10',
    outerGateId: 'E4',
    innerGateId: 'G10',
    points: [
      { x: 1025, y: 195 },
      { x: 1005, y: 260 },
      { x: 980, y: 330 }
    ],
    verificationStatus: 'UNVERIFIED',
    flowDirection: 'INBOUND',
    description: 'Corner portal connection from BRV Junction. Marked UNVERIFIED.'
  },

  // ─── LINK ROAD / ST. MARKS EAST INGRESS ROUTES ──────────────────────
  {
    id: 'ROUTE_E17_G11',
    outerGateId: 'E17',
    innerGateId: 'G11',
    points: [
      { x: 1240, y: 310 },
      { x: 1140, y: 320 },
      { x: 1090, y: 370 },
      { x: 1050, y: 420 }
    ],
    verificationStatus: 'VERIFIED',
    flowDirection: 'INBOUND',
    description: 'Upper East grandstand ingress leading directly to E Stand Main.'
  },
  {
    id: 'ROUTE_E17_G12',
    outerGateId: 'E17',
    innerGateId: 'G12',
    points: [
      { x: 1240, y: 310 },
      { x: 1150, y: 350 },
      { x: 1110, y: 430 },
      { x: 1080, y: 500 }
    ],
    verificationStatus: 'VERIFIED',
    flowDirection: 'INBOUND',
    description: 'Diagonal staircase feeder toward H Upper Tier.'
  },
  {
    id: 'ROUTE_E16_G12',
    outerGateId: 'E16',
    innerGateId: 'G12',
    points: [
      { x: 1240, y: 420 },
      { x: 1160, y: 440 },
      { x: 1080, y: 500 }
    ],
    verificationStatus: 'VERIFIED',
    holdingAreaId: 'HOLDING_G12_G13',
    flowDirection: 'INBOUND',
    description: 'Direct East portal through holding pen into H Upper Tier.'
  },
  {
    id: 'ROUTE_E16_G13',
    outerGateId: 'E16',
    innerGateId: 'G13',
    points: [
      { x: 1240, y: 420 },
      { x: 1170, y: 480 },
      { x: 1120, y: 540 },
      { x: 1080, y: 600 }
    ],
    verificationStatus: 'VERIFIED',
    holdingAreaId: 'HOLDING_G12_G13',
    flowDirection: 'INBOUND',
    description: 'Branch path feeding F Stand lower concourse.'
  },
  {
    id: 'ROUTE_E15_G13',
    outerGateId: 'E15',
    innerGateId: 'G13',
    points: [
      { x: 1240, y: 490 },
      { x: 1160, y: 540 },
      { x: 1080, y: 600 }
    ],
    verificationStatus: 'UNVERIFIED',
    flowDirection: 'INBOUND',
    description: 'Intermediate East gate approach into F Stand. Marked UNVERIFIED.'
  },
  {
    id: 'ROUTE_E14_G14',
    outerGateId: 'E14',
    innerGateId: 'G14',
    points: [
      { x: 1240, y: 560 },
      { x: 1150, y: 630 },
      { x: 1050, y: 700 }
    ],
    verificationStatus: 'UNVERIFIED',
    flowDirection: 'INBOUND',
    description: 'Path past East Medical Post into M3/M4 Stands. Marked UNVERIFIED.'
  },
  {
    id: 'ROUTE_E13_G14',
    outerGateId: 'E13',
    innerGateId: 'G14',
    points: [
      { x: 1240, y: 640 },
      { x: 1150, y: 650 },
      { x: 1090, y: 680 },
      { x: 1050, y: 700 }
    ],
    verificationStatus: 'VERIFIED',
    holdingAreaId: 'HOLDING_G14',
    flowDirection: 'INBOUND',
    description: 'Dual high-capacity entrance into M3 & M4 Stands with dedicated holding area.'
  },
  {
    id: 'ROUTE_E12_G14',
    outerGateId: 'E12',
    innerGateId: 'G14',
    points: [
      { x: 1240, y: 680 },
      { x: 1150, y: 670 },
      { x: 1050, y: 700 }
    ],
    verificationStatus: 'VERIFIED',
    holdingAreaId: 'HOLDING_G14',
    flowDirection: 'INBOUND',
    description: 'Paired portal with E13 feeding M Stand grandstands.'
  },
  {
    id: 'ROUTE_E12_G15',
    outerGateId: 'E12',
    innerGateId: 'G15',
    points: [
      { x: 1240, y: 680 },
      { x: 1130, y: 720 },
      { x: 1050, y: 760 },
      { x: 975, y: 780 }
    ],
    verificationStatus: 'VERIFIED',
    flowDirection: 'INBOUND',
    description: 'Concourse branch path into M2 Annexe.'
  },
  {
    id: 'ROUTE_E11_G15',
    outerGateId: 'E11',
    innerGateId: 'G15',
    points: [
      { x: 1160, y: 940 },
      { x: 1100, y: 880 },
      { x: 1030, y: 820 },
      { x: 975, y: 780 }
    ],
    verificationStatus: 'VERIFIED',
    holdingAreaId: 'HOLDING_G15',
    flowDirection: 'INBOUND',
    description: 'Direct diagonal mass transit ingress from MG Road Metro Plaza into M2 Annexe.'
  },

  // ─── QUEENS ROAD RESTRICTED ROUTES (VIP / MEDIA ONLY) ───────────────
  {
    id: 'ROUTE_E5_G4',
    outerGateId: 'E5',
    innerGateId: 'G4',
    points: [
      { x: 360, y: 310 },
      { x: 410, y: 440 },
      { x: 450, y: 560 },
      { x: 480, y: 640 }
    ],
    verificationStatus: 'RESTRICTED',
    flowDirection: 'INBOUND',
    description: 'RESTRICTED: Players, match officials and VIP escort carriageway to Members Pavilion.'
  },
  {
    id: 'ROUTE_E8_G3',
    outerGateId: 'E8',
    innerGateId: 'G3',
    points: [
      { x: 420, y: 690 },
      { x: 470, y: 730 },
      { x: 520, y: 770 },
      { x: 565, y: 800 }
    ],
    verificationStatus: 'RESTRICTED',
    flowDirection: 'INBOUND',
    description: 'RESTRICTED: VIP hospitality guest access to P3 Stand suites.'
  },
  {
    id: 'ROUTE_E8_G2',
    outerGateId: 'E8',
    innerGateId: 'G2',
    points: [
      { x: 420, y: 690 },
      { x: 510, y: 760 },
      { x: 600, y: 830 },
      { x: 670, y: 895 }
    ],
    verificationStatus: 'RESTRICTED',
    flowDirection: 'INBOUND',
    description: 'RESTRICTED: Authorized access from Queens Road drop-off to P1 Annexe / P-Loft.'
  },
  {
    id: 'ROUTE_E10_G1',
    outerGateId: 'E10',
    innerGateId: 'G1',
    points: [
      { x: 500, y: 830 },
      { x: 580, y: 870 },
      { x: 700, y: 915 },
      { x: 800, y: 930 }
    ],
    verificationStatus: 'RESTRICTED',
    flowDirection: 'INBOUND',
    description: 'RESTRICTED: KSCA Car Park perimeter path into P Terrace Corporate boxes.'
  },
  {
    id: 'ROUTE_E10_G2',
    outerGateId: 'E10',
    innerGateId: 'G2',
    points: [
      { x: 500, y: 830 },
      { x: 560, y: 855 },
      { x: 620, y: 880 },
      { x: 670, y: 895 }
    ],
    verificationStatus: 'RESTRICTED',
    flowDirection: 'INBOUND',
    description: 'RESTRICTED: Internal link from Car Park into P-Loft.'
  }
];

