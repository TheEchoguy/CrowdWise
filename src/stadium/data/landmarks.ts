import { Landmark, HoldingArea } from '../types/stadium';

/**
 * Geographic Landmarks & Major Venue Enclosures
 * M. Chinnaswamy Stadium, Bengaluru
 */

export const CHINNASWAMY_LANDMARKS: Landmark[] = [
  {
    id: 'LANDMARK_B_GROUND',
    name: 'B Ground (Practice Ground & Hospitality Lawn)',
    type: 'TRAINING_GROUND',
    bounds: {
      x: 320,
      y: 200,
      width: 140,
      height: 120,
      path: 'M 320,200 L 440,200 L 430,300 C 390,320 340,310 320,260 Z'
    },
    labelPosition: { x: 375, y: 250 },
    color: '#15803d',
    description: 'KSCA auxiliary B Ground practice pitch, warmup nets and Executive Stand holding area.'
  },
  {
    id: 'LANDMARK_MG_PARK',
    name: 'Mahatma Gandhi Park',
    type: 'PARK',
    bounds: {
      x: 270,
      y: 350,
      width: 130,
      height: 220,
      path: 'M 300,350 L 410,380 L 410,580 L 330,550 Z'
    },
    labelPosition: { x: 350, y: 460 },
    color: '#166534',
    description: 'Lush public parkland insulating the western perimeter between Queens Road and Stadium walls.'
  },
  {
    id: 'LANDMARK_KSCA_CARPARK',
    name: 'KSCA Car Park',
    type: 'PARKING',
    bounds: {
      x: 520,
      y: 840,
      width: 200,
      height: 140,
      path: 'M 520,840 L 720,870 L 680,1020 L 490,950 Z'
    },
    labelPosition: { x: 600, y: 920 },
    color: '#334155',
    description: 'Official KSCA matchday parking enclosure for club members, players, and match day VIPs.'
  },
  {
    id: 'LANDMARK_METRO_MG_ROAD',
    name: 'MG Road Metro Station (Purple Line)',
    type: 'METRO_STATION',
    bounds: { x: 1200, y: 1110, width: 180, height: 42 },
    labelPosition: { x: 1290, y: 1135 },
    color: '#7e22ce',
    description: 'High-frequency Namma Metro Purple Line station discharging thousands of fans onto MG Road Plaza.'
  },
  {
    id: 'LANDMARK_METRO_CUBBON',
    name: 'Cubbon Park Metro Station',
    type: 'METRO_STATION',
    bounds: { x: 180, y: 90, width: 170, height: 40 },
    labelPosition: { x: 265, y: 115 },
    color: '#7e22ce',
    description: 'Underground Namma Metro Purple Line station serving Minsk Square and Cubbon Road gates.'
  },
  {
    id: 'LANDMARK_ANIL_KUMBLE_CIRCLE',
    name: 'Anil Kumble Circle',
    type: 'JUNCTION',
    bounds: { x: 1300, y: 1080, width: 90, height: 90 },
    labelPosition: { x: 1345, y: 1080 },
    color: '#475569',
    description: 'Iconic roundabout intersection joining MG Road, St. Marks Road, and Link Road.'
  },
  {
    id: 'LANDMARK_BRV_JUNCTION',
    name: 'BRV Junction',
    type: 'JUNCTION',
    bounds: { x: 1300, y: 140, width: 80, height: 80 },
    labelPosition: { x: 1320, y: 120 },
    color: '#475569',
    description: 'Major junction connecting Cubbon Road to Link Road and Kamaraj Road.'
  }
];

export const CHINNASWAMY_HOLDING_AREAS: HoldingArea[] = [
  {
    id: 'HOLDING_G7_G8',
    name: 'Holding Area for G7 & G8',
    x: 690,
    y: 215,
    width: 110,
    height: 32,
    targetGates: ['G7', 'G8'],
    label: 'HOLDING AREA: G7 & G8'
  },
  {
    id: 'HOLDING_G9_G10',
    name: 'Holding Area for G9 & G10',
    x: 885,
    y: 215,
    width: 115,
    height: 32,
    targetGates: ['G9', 'G10'],
    label: 'HOLDING AREA: G9 & G10'
  },
  {
    id: 'HOLDING_G12_G13',
    name: 'Holding Area for G12 & G13',
    x: 1150,
    y: 430,
    width: 105,
    height: 34,
    targetGates: ['G12', 'G13'],
    label: 'HOLDING AREA: G12 & G13'
  },
  {
    id: 'HOLDING_G14',
    name: 'Holding Area for G14',
    x: 1145,
    y: 620,
    width: 100,
    height: 34,
    targetGates: ['G14'],
    label: 'HOLDING AREA: G14'
  },
  {
    id: 'HOLDING_G15',
    name: 'Holding Area for G15',
    x: 1110,
    y: 770,
    width: 95,
    height: 34,
    targetGates: ['G15'],
    label: 'HOLDING AREA: G15'
  }
];

