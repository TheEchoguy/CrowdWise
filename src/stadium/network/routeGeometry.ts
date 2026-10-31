/**
 * CROWDWISE — Phase 2: Route Geometry & Waypoint Trajectories
 * M. Chinnaswamy Stadium, Bengaluru
 *
 * Precise waypoint trajectories in normalized venue coordinates (1600 x 1200)
 * guiding agents from outer perimeter gates through holding pens and turnstile banks
 * into the seating bowl vomitories.
 */

import { VerificationStatus } from '../types/stadium';

export interface RouteWaypoint {
  x: number;
  y: number;
  label?: string;
  isQueueThreshold?: boolean;
}

export interface IngressRoutePath {
  routeKey: string; // e.g. 'E11_G15', 'E22_G8'
  outerGateId: string;
  innerGateId: string;
  standId: string;
  verificationStatus: VerificationStatus;
  corridorWidthMeters: number;
  waypoints: RouteWaypoint[];
  holdingAreaId?: string;
  vomitoryDispersalTarget: { x: number; y: number };
}

/**
 * Trajectories matching official KSCA red dotted pedestrian paths.
 */
export const INGRESS_ROUTE_TRAJECTORIES: Record<string, IngressRoutePath> = {
  // ─── CUBBON ROAD NORTH INGRESS ROUTES ──────────────────────────────
  E3_G4: {
    routeKey: 'E3_G4',
    outerGateId: 'E3',
    innerGateId: 'G4',
    standId: 'A_STAND',
    verificationStatus: 'VERIFIED',
    corridorWidthMeters: 2.2,
    waypoints: [
      { x: 440, y: 160, label: 'Sidewalk Entry' },
      { x: 440, y: 185, label: 'Gate E3 Stanchions' },
      { x: 450, y: 260, label: 'B-Ground Promenade' },
      { x: 460, y: 440, label: 'West Outer Walkway' },
      { x: 470, y: 580, isQueueThreshold: true, label: 'Holding Queue' },
      { x: 480, y: 640, label: 'G4 Turnstile Throat' }
    ],
    vomitoryDispersalTarget: { x: 520, y: 640 }
  },
  E3_G5: {
    routeKey: 'E3_G5',
    outerGateId: 'E3',
    innerGateId: 'G5',
    standId: 'A_STAND',
    verificationStatus: 'VERIFIED',
    corridorWidthMeters: 2.5,
    waypoints: [
      { x: 440, y: 160, label: 'Sidewalk Entry' },
      { x: 440, y: 185, label: 'Gate E3 Stanchions' },
      { x: 465, y: 280, label: 'Promenade Fork' },
      { x: 505, y: 400, isQueueThreshold: true, label: 'Holding Queue' },
      { x: 530, y: 480, label: 'G5 Turnstile Throat' }
    ],
    vomitoryDispersalTarget: { x: 565, y: 500 }
  },
  E2_G5: {
    routeKey: 'E2_G5',
    outerGateId: 'E2',
    innerGateId: 'G5',
    standId: 'A_STAND',
    verificationStatus: 'VERIFIED',
    corridorWidthMeters: 2.4,
    waypoints: [
      { x: 495, y: 160, label: 'Sidewalk Entry' },
      { x: 495, y: 185, label: 'Gate E2 Stanchions' },
      { x: 510, y: 280, label: 'Concourse Approach' },
      { x: 525, y: 410, isQueueThreshold: true, label: 'Holding Queue' },
      { x: 530, y: 480, label: 'G5 Turnstile Throat' }
    ],
    vomitoryDispersalTarget: { x: 565, y: 500 }
  },
  E1_G5: {
    routeKey: 'E1_G5',
    outerGateId: 'E1',
    innerGateId: 'G5',
    standId: 'A_STAND',
    verificationStatus: 'VERIFIED',
    corridorWidthMeters: 2.2,
    waypoints: [
      { x: 555, y: 160, label: 'Sidewalk Entry' },
      { x: 555, y: 185, label: 'Gate E1 Stanchions' },
      { x: 550, y: 310, isQueueThreshold: true, label: 'Holding Queue' },
      { x: 530, y: 480, label: 'G5 Turnstile Throat' }
    ],
    vomitoryDispersalTarget: { x: 565, y: 500 }
  },
  E1_G6: {
    routeKey: 'E1_G6',
    outerGateId: 'E1',
    innerGateId: 'G6',
    standId: 'B_STAND',
    verificationStatus: 'VERIFIED',
    corridorWidthMeters: 2.4,
    waypoints: [
      { x: 555, y: 160, label: 'Sidewalk Entry' },
      { x: 555, y: 185, label: 'Gate E1 Stanchions' },
      { x: 580, y: 280, isQueueThreshold: true, label: 'Holding Queue' },
      { x: 610, y: 375, label: 'G6 Turnstile Throat' }
    ],
    vomitoryDispersalTarget: { x: 635, y: 410 }
  },
  E23_G6: {
    routeKey: 'E23_G6',
    outerGateId: 'E23',
    innerGateId: 'G6',
    standId: 'B_STAND',
    verificationStatus: 'VERIFIED',
    corridorWidthMeters: 2.2,
    waypoints: [
      { x: 625, y: 160, label: 'Sidewalk Entry' },
      { x: 625, y: 185, label: 'Gate E23 Stanchions' },
      { x: 620, y: 280, isQueueThreshold: true, label: 'Holding Queue' },
      { x: 610, y: 375, label: 'G6 Turnstile Throat' }
    ],
    vomitoryDispersalTarget: { x: 635, y: 410 }
  },
  E23_G7: {
    routeKey: 'E23_G7',
    outerGateId: 'E23',
    innerGateId: 'G7',
    standId: 'PLATINUM_LOUNGE',
    verificationStatus: 'VERIFIED',
    corridorWidthMeters: 2.0,
    holdingAreaId: 'HOLDING_G7_G8',
    waypoints: [
      { x: 625, y: 160, label: 'Sidewalk Entry' },
      { x: 625, y: 185, label: 'Gate E23 Stanchions' },
      { x: 665, y: 250, isQueueThreshold: true, label: 'Holding Pen G7' },
      { x: 700, y: 310, label: 'G7 Turnstile Throat' }
    ],
    vomitoryDispersalTarget: { x: 720, y: 345 }
  },
  E22_G7: {
    routeKey: 'E22_G7',
    outerGateId: 'E22',
    innerGateId: 'G7',
    standId: 'PLATINUM_LOUNGE',
    verificationStatus: 'VERIFIED',
    corridorWidthMeters: 2.0,
    holdingAreaId: 'HOLDING_G7_G8',
    waypoints: [
      { x: 695, y: 160, label: 'Sidewalk Entry' },
      { x: 695, y: 185, label: 'Gate E22 Stanchions' },
      { x: 695, y: 245, isQueueThreshold: true, label: 'Holding Pen G7' },
      { x: 700, y: 310, label: 'G7 Turnstile Throat' }
    ],
    vomitoryDispersalTarget: { x: 720, y: 345 }
  },
  E22_G8: {
    routeKey: 'E22_G8',
    outerGateId: 'E22',
    innerGateId: 'G8',
    standId: 'C_STAND',
    verificationStatus: 'VERIFIED',
    corridorWidthMeters: 3.2,
    holdingAreaId: 'HOLDING_G7_G8',
    waypoints: [
      { x: 695, y: 160, label: 'Sidewalk Entry' },
      { x: 695, y: 185, label: 'Gate E22 Stanchions' },
      { x: 735, y: 225, label: 'Holding Corral G8' },
      { x: 760, y: 250, isQueueThreshold: true, label: 'Queue Lanes' },
      { x: 780, y: 275, label: 'G8 Turnstile Throat' }
    ],
    vomitoryDispersalTarget: { x: 780, y: 330 }
  },
  E21_G8: {
    routeKey: 'E21_G8',
    outerGateId: 'E21',
    innerGateId: 'G8',
    standId: 'C_STAND',
    verificationStatus: 'UNVERIFIED',
    corridorWidthMeters: 2.0,
    waypoints: [
      { x: 760, y: 160 },
      { x: 760, y: 185 },
      { x: 770, y: 235, isQueueThreshold: true },
      { x: 780, y: 275 }
    ],
    vomitoryDispersalTarget: { x: 780, y: 330 }
  },
  E20_G9: {
    routeKey: 'E20_G9',
    outerGateId: 'E20',
    innerGateId: 'G9',
    standId: 'C_STAND',
    verificationStatus: 'UNVERIFIED',
    corridorWidthMeters: 2.0,
    waypoints: [
      { x: 825, y: 160 },
      { x: 825, y: 185 },
      { x: 865, y: 235, isQueueThreshold: true },
      { x: 890, y: 285 }
    ],
    vomitoryDispersalTarget: { x: 880, y: 340 }
  },
  E19_G9: {
    routeKey: 'E19_G9',
    outerGateId: 'E19',
    innerGateId: 'G9',
    standId: 'C_STAND',
    verificationStatus: 'VERIFIED',
    corridorWidthMeters: 2.8,
    holdingAreaId: 'HOLDING_G9_G10',
    waypoints: [
      { x: 895, y: 160, label: 'Sidewalk Entry' },
      { x: 895, y: 185, label: 'Gate E19 Stanchions' },
      { x: 895, y: 235, isQueueThreshold: true, label: 'Holding Pen G9' },
      { x: 890, y: 285, label: 'G9 Turnstile Throat' }
    ],
    vomitoryDispersalTarget: { x: 880, y: 340 }
  },
  E19_G10: {
    routeKey: 'E19_G10',
    outerGateId: 'E19',
    innerGateId: 'G10',
    standId: 'GRAND_TERRACE',
    verificationStatus: 'VERIFIED',
    corridorWidthMeters: 2.4,
    holdingAreaId: 'HOLDING_G9_G10',
    waypoints: [
      { x: 895, y: 160, label: 'Sidewalk Entry' },
      { x: 895, y: 185, label: 'Gate E19 Stanchions' },
      { x: 940, y: 245, isQueueThreshold: true, label: 'Holding Pen G10' },
      { x: 980, y: 330, label: 'G10 Turnstile Throat' }
    ],
    vomitoryDispersalTarget: { x: 960, y: 380 }
  },
  E18_G10: {
    routeKey: 'E18_G10',
    outerGateId: 'E18',
    innerGateId: 'G10',
    standId: 'GRAND_TERRACE',
    verificationStatus: 'VERIFIED',
    corridorWidthMeters: 2.4,
    waypoints: [
      { x: 960, y: 160, label: 'Sidewalk Entry' },
      { x: 960, y: 185, label: 'Gate E18 Stanchions' },
      { x: 970, y: 255, isQueueThreshold: true, label: 'Holding Pen' },
      { x: 980, y: 330, label: 'G10 Turnstile Throat' }
    ],
    vomitoryDispersalTarget: { x: 960, y: 380 }
  },

  // ─── LINK ROAD EAST INGRESS ROUTES ──────────────────────────────────
  E17_G11: {
    routeKey: 'E17_G11',
    outerGateId: 'E17',
    innerGateId: 'G11',
    standId: 'E_STAND',
    verificationStatus: 'VERIFIED',
    corridorWidthMeters: 2.4,
    waypoints: [
      { x: 1265, y: 310, label: 'Link Rd Sidewalk' },
      { x: 1240, y: 310, label: 'Gate E17 Portal' },
      { x: 1140, y: 325, label: 'Upper East Walkway' },
      { x: 1090, y: 375, isQueueThreshold: true, label: 'Queue Threshold' },
      { x: 1050, y: 420, label: 'G11 Turnstile Throat' }
    ],
    vomitoryDispersalTarget: { x: 1010, y: 440 }
  },
  E17_G12: {
    routeKey: 'E17_G12',
    outerGateId: 'E17',
    innerGateId: 'G12',
    standId: 'H_UPPER',
    verificationStatus: 'VERIFIED',
    corridorWidthMeters: 2.2,
    holdingAreaId: 'HOLDING_G12_G13',
    waypoints: [
      { x: 1265, y: 310, label: 'Link Rd Sidewalk' },
      { x: 1240, y: 310, label: 'Gate E17 Portal' },
      { x: 1150, y: 355, label: 'Holding Pen' },
      { x: 1110, y: 435, isQueueThreshold: true, label: 'Queue Threshold' },
      { x: 1080, y: 500, label: 'G12 Turnstile Throat' }
    ],
    vomitoryDispersalTarget: { x: 1030, y: 510 }
  },
  E16_G12: {
    routeKey: 'E16_G12',
    outerGateId: 'E16',
    innerGateId: 'G12',
    standId: 'H_UPPER',
    verificationStatus: 'VERIFIED',
    corridorWidthMeters: 2.4,
    holdingAreaId: 'HOLDING_G12_G13',
    waypoints: [
      { x: 1265, y: 420, label: 'Link Rd Sidewalk' },
      { x: 1240, y: 420, label: 'Gate E16 Portal' },
      { x: 1160, y: 445, isQueueThreshold: true, label: 'Holding Area' },
      { x: 1080, y: 500, label: 'G12 Turnstile Throat' }
    ],
    vomitoryDispersalTarget: { x: 1030, y: 510 }
  },
  E16_G13: {
    routeKey: 'E16_G13',
    outerGateId: 'E16',
    innerGateId: 'G13',
    standId: 'F_STAND',
    verificationStatus: 'VERIFIED',
    corridorWidthMeters: 2.5,
    holdingAreaId: 'HOLDING_G12_G13',
    waypoints: [
      { x: 1265, y: 420, label: 'Link Rd Sidewalk' },
      { x: 1240, y: 420, label: 'Gate E16 Portal' },
      { x: 1170, y: 485, label: 'F Stand Walkway' },
      { x: 1120, y: 545, isQueueThreshold: true, label: 'Queue Threshold' },
      { x: 1080, y: 600, label: 'G13 Turnstile Throat' }
    ],
    vomitoryDispersalTarget: { x: 1030, y: 600 }
  },
  E13_G14: {
    routeKey: 'E13_G14',
    outerGateId: 'E13',
    innerGateId: 'G14',
    standId: 'M3_M4',
    verificationStatus: 'VERIFIED',
    corridorWidthMeters: 3.4,
    holdingAreaId: 'HOLDING_G14',
    waypoints: [
      { x: 1265, y: 640, label: 'Link Rd Sidewalk' },
      { x: 1240, y: 640, label: 'Gate E13 Portal' },
      { x: 1150, y: 650, label: 'Holding Pen G14' },
      { x: 1090, y: 680, isQueueThreshold: true, label: 'Queue Lanes' },
      { x: 1050, y: 700, label: 'G14 Turnstile Throat' }
    ],
    vomitoryDispersalTarget: { x: 1000, y: 690 }
  },
  E12_G14: {
    routeKey: 'E12_G14',
    outerGateId: 'E12',
    innerGateId: 'G14',
    standId: 'M3_M4',
    verificationStatus: 'VERIFIED',
    corridorWidthMeters: 3.4,
    holdingAreaId: 'HOLDING_G14',
    waypoints: [
      { x: 1265, y: 680, label: 'Link Rd Sidewalk' },
      { x: 1240, y: 680, label: 'Gate E12 Portal' },
      { x: 1150, y: 670, label: 'Holding Pen G14' },
      { x: 1090, y: 685, isQueueThreshold: true, label: 'Queue Lanes' },
      { x: 1050, y: 700, label: 'G14 Turnstile Throat' }
    ],
    vomitoryDispersalTarget: { x: 1000, y: 690 }
  },
  E12_G15: {
    routeKey: 'E12_G15',
    outerGateId: 'E12',
    innerGateId: 'G15',
    standId: 'M2_ANNEXE',
    verificationStatus: 'VERIFIED',
    corridorWidthMeters: 2.2,
    holdingAreaId: 'HOLDING_G15',
    waypoints: [
      { x: 1265, y: 680, label: 'Link Rd Sidewalk' },
      { x: 1240, y: 680, label: 'Gate E12 Portal' },
      { x: 1130, y: 725, label: 'M2 Approach' },
      { x: 1050, y: 760, isQueueThreshold: true, label: 'Queue Threshold' },
      { x: 975, y: 780, label: 'G15 Turnstile Throat' }
    ],
    vomitoryDispersalTarget: { x: 940, y: 760 }
  },
  E11_G15: {
    routeKey: 'E11_G15',
    outerGateId: 'E11',
    innerGateId: 'G15',
    standId: 'M2_ANNEXE',
    verificationStatus: 'VERIFIED',
    corridorWidthMeters: 4.0,
    holdingAreaId: 'HOLDING_G15',
    waypoints: [
      { x: 1200, y: 990, label: 'Metro Plaza Feeder' },
      { x: 1160, y: 940, label: 'Gate E11 Apex Stanchions' },
      { x: 1100, y: 885, label: 'Holding Promenade' },
      { x: 1030, y: 825, isQueueThreshold: true, label: 'Queue Corral' },
      { x: 975, y: 780, label: 'G15 Turnstile Throat' }
    ],
    vomitoryDispersalTarget: { x: 940, y: 760 }
  },

  // ─── QUEENS ROAD RESTRICTED INGRESS ROUTES ──────────────────────────
  E5_G4: {
    routeKey: 'E5_G4',
    outerGateId: 'E5',
    innerGateId: 'G4',
    standId: 'A_STAND',
    verificationStatus: 'RESTRICTED',
    corridorWidthMeters: 2.0,
    waypoints: [
      { x: 340, y: 290 },
      { x: 360, y: 310 },
      { x: 410, y: 440 },
      { x: 450, y: 560, isQueueThreshold: true },
      { x: 480, y: 640 }
    ],
    vomitoryDispersalTarget: { x: 520, y: 640 }
  },
  E8_G3: {
    routeKey: 'E8_G3',
    outerGateId: 'E8',
    innerGateId: 'G3',
    standId: 'P3_STAND',
    verificationStatus: 'RESTRICTED',
    corridorWidthMeters: 2.0,
    waypoints: [
      { x: 400, y: 670 },
      { x: 420, y: 690 },
      { x: 470, y: 730 },
      { x: 520, y: 770, isQueueThreshold: true },
      { x: 565, y: 800 }
    ],
    vomitoryDispersalTarget: { x: 590, y: 770 }
  },
  E10_G1: {
    routeKey: 'E10_G1',
    outerGateId: 'E10',
    innerGateId: 'G1',
    standId: 'P_TERRACE_CORPORATE',
    verificationStatus: 'RESTRICTED',
    corridorWidthMeters: 2.5,
    waypoints: [
      { x: 480, y: 810 },
      { x: 500, y: 830 },
      { x: 580, y: 870 },
      { x: 700, y: 915, isQueueThreshold: true },
      { x: 800, y: 930 }
    ],
    vomitoryDispersalTarget: { x: 800, y: 890 }
  }
};

