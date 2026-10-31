import { InnerGate } from '../types/stadium';
import { getConnectedOuterGates } from '../network/gateConnectivity';

/**
 * Authentic Inner Gates (G-Series: G1 to G15)
 * M. Chinnaswamy Stadium, Bengaluru
 *
 * Positioned on the internal bowl concourse leading directly to vomitory staircases
 * and grandstand seating blocks as documented in the official KSCA blueprint.
 */

export const CHINNASWAMY_INNER_GATES: InnerGate[] = [
  {
    id: 'G1',
    label: 'Inner Gate G1',
    section: 'SOUTH_MG',
    x: 800,
    y: 930,
    standId: 'P_TERRACE_CORPORATE',
    standName: 'P Terrace & P Corporate',
    turnstileCount: 4,
    baseCapacityPerMin: 240,
    verificationStatus: 'VERIFIED',
    connectedOuterGates: getConnectedOuterGates('G1'),
    notes: 'South Members/VIP vomitory leading to P Terrace and KSCA Clubhouse.'
  },
  {
    id: 'G2',
    label: 'Inner Gate G2',
    section: 'SOUTH_MG',
    x: 670,
    y: 895,
    standId: 'P1_ANNEXE_LOFT',
    standName: 'P1 Annexe / P-Loft',
    turnstileCount: 4,
    baseCapacityPerMin: 240,
    verificationStatus: 'VERIFIED',
    connectedOuterGates: getConnectedOuterGates('G2'),
    notes: 'South-west vomitory serving P1 Annexe and elevated corporate lofts.'
  },
  {
    id: 'G3',
    label: 'Inner Gate G3',
    section: 'SOUTH_MG',
    x: 565,
    y: 800,
    standId: 'P3_STAND',
    standName: 'P3 Stand',
    turnstileCount: 3,
    baseCapacityPerMin: 180,
    verificationStatus: 'VERIFIED',
    connectedOuterGates: getConnectedOuterGates('G3'),
    notes: 'Direct turnstile ingress for P3 covered seating.'
  },
  {
    id: 'G4',
    label: 'Inner Gate G4',
    section: 'WEST_QUEENS',
    x: 480,
    y: 640,
    standId: 'A_STAND',
    standName: 'A Stand Lower',
    turnstileCount: 4,
    baseCapacityPerMin: 240,
    verificationStatus: 'VERIFIED',
    connectedOuterGates: getConnectedOuterGates('G4'),
    notes: 'West concourse entrance into A Stand Lower Tier via long promenade.'
  },
  {
    id: 'G5',
    label: 'Inner Gate G5',
    section: 'NORTH_CUBBON',
    x: 530,
    y: 480,
    standId: 'A_STAND',
    standName: 'A Stand Upper Tier',
    turnstileCount: 5,
    baseCapacityPerMin: 300,
    verificationStatus: 'VERIFIED',
    connectedOuterGates: getConnectedOuterGates('G5'),
    notes: 'Major public vomitory feeding A Stand from Cubbon Road gates E1, E2, E3.'
  },
  {
    id: 'G6',
    label: 'Inner Gate G6',
    section: 'NORTH_CUBBON',
    x: 610,
    y: 375,
    standId: 'B_STAND',
    standName: 'B Stand',
    turnstileCount: 4,
    baseCapacityPerMin: 240,
    verificationStatus: 'VERIFIED',
    connectedOuterGates: getConnectedOuterGates('G6'),
    notes: 'North-west concourse portal leading to B Stand.'
  },
  {
    id: 'G7',
    label: 'Inner Gate G7',
    section: 'NORTH_CUBBON',
    x: 700,
    y: 310,
    standId: 'PLATINUM_LOUNGE',
    standName: 'Platinum Lounge & C Stand Left',
    turnstileCount: 3,
    baseCapacityPerMin: 180,
    verificationStatus: 'VERIFIED',
    connectedOuterGates: getConnectedOuterGates('G7'),
    notes: 'Direct access portal for Platinum Lounge and West C Stand.'
  },
  {
    id: 'G8',
    label: 'Inner Gate G8',
    section: 'NORTH_CUBBON',
    x: 780,
    y: 275,
    standId: 'C_STAND',
    standName: 'C Stand Main',
    turnstileCount: 6,
    baseCapacityPerMin: 360,
    verificationStatus: 'VERIFIED',
    connectedOuterGates: getConnectedOuterGates('G8'),
    notes: 'Central high-volume North entrance directly adjacent to emergency medical bay.'
  },
  {
    id: 'G9',
    label: 'Inner Gate G9',
    section: 'NORTH_CUBBON',
    x: 890,
    y: 285,
    standId: 'C_STAND',
    standName: 'C Stand East & Grand Terrace',
    turnstileCount: 5,
    baseCapacityPerMin: 300,
    verificationStatus: 'VERIFIED',
    connectedOuterGates: getConnectedOuterGates('G9'),
    notes: 'North-East turnstile cluster with dedicated green holding enclosure.'
  },
  {
    id: 'G10',
    label: 'Inner Gate G10',
    section: 'NORTH_CUBBON',
    x: 980,
    y: 330,
    standId: 'GRAND_TERRACE',
    standName: 'Grand Terrace Concourse',
    turnstileCount: 4,
    baseCapacityPerMin: 240,
    verificationStatus: 'VERIFIED',
    connectedOuterGates: getConnectedOuterGates('G10'),
    notes: 'Corner vomitory feeding Grand Terrace from Gate E18/E19.'
  },
  {
    id: 'G11',
    label: 'Inner Gate G11',
    section: 'EAST_LINK',
    x: 1050,
    y: 420,
    standId: 'E_STAND',
    standName: 'E Stand / Grand Terrace Upper',
    turnstileCount: 4,
    baseCapacityPerMin: 240,
    verificationStatus: 'VERIFIED',
    connectedOuterGates: getConnectedOuterGates('G11'),
    notes: 'East concourse upper turnstile bank receiving spectators from Gate E17.'
  },
  {
    id: 'G12',
    label: 'Inner Gate G12',
    section: 'EAST_LINK',
    x: 1080,
    y: 500,
    standId: 'H_UPPER',
    standName: 'H Upper Tier',
    turnstileCount: 4,
    baseCapacityPerMin: 240,
    verificationStatus: 'VERIFIED',
    connectedOuterGates: getConnectedOuterGates('G12'),
    notes: 'Dedicated staircase access to the prominent H Upper Tier.'
  },
  {
    id: 'G13',
    label: 'Inner Gate G13',
    section: 'EAST_LINK',
    x: 1080,
    y: 600,
    standId: 'F_STAND',
    standName: 'F Stand / H Concourse',
    turnstileCount: 5,
    baseCapacityPerMin: 300,
    verificationStatus: 'VERIFIED',
    connectedOuterGates: getConnectedOuterGates('G13'),
    notes: 'Mid East concourse portal with dedicated green holding pen.'
  },
  {
    id: 'G14',
    label: 'Inner Gate G14',
    section: 'EAST_LINK',
    x: 1050,
    y: 700,
    standId: 'M3_M4',
    standName: 'M3 & M4 Stands',
    turnstileCount: 6,
    baseCapacityPerMin: 360,
    verificationStatus: 'VERIFIED',
    connectedOuterGates: getConnectedOuterGates('G14'),
    notes: 'High-throughput ingress cluster fed by the dual Link Road gates E12 & E13.'
  },
  {
    id: 'G15',
    label: 'Inner Gate G15',
    section: 'EAST_LINK',
    x: 975,
    y: 780,
    standId: 'M2_ANNEXE',
    standName: 'M2 Annexe',
    turnstileCount: 4,
    baseCapacityPerMin: 240,
    verificationStatus: 'VERIFIED',
    connectedOuterGates: getConnectedOuterGates('G15'),
    notes: 'South-east vomitory feeding M2 Annexe and connecting to MG Road corridor via E11.'
  }
];

