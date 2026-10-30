import { Venue, Gate, Zone, Corridor, MedicalPoint, AttractionPoint, ApproachRoute } from '../types';

// Stadium dimensions in meters (260m x 220m)
const CX = 130;
const CY = 110;
const INNER_R_X = 55; // Pitch boundary
const INNER_R_Y = 45;
const CONCOURSE_R_X = 85; // Seating outer edge / Concourse
const CONCOURSE_R_Y = 75;
const PERIMETER_R_X = 105; // Outer wall
const PERIMETER_R_Y = 92;

// Generate 21 Gates around the stadium perimeter
const TOTAL_GATES = 21;
const gates: Gate[] = [];

for (let i = 1; i <= TOTAL_GATES; i++) {
  // Angle around ellipse: Gate 1 starts North-East and moves clockwise
  const angle = ((i - 1) / TOTAL_GATES) * 2 * Math.PI - Math.PI / 2;
  const x = Math.round(CX + Math.cos(angle) * PERIMETER_R_X);
  const y = Math.round(CY + Math.sin(angle) * PERIMETER_R_Y);

  // Default operational profiles
  // Gates 1 to 14 are standard public entrances
  // Gates 15 to 17 are VIP / Hospitality
  // Gates 18, 19 are Exit-only / Secondary
  // Gates 20, 21 are Emergency / Service
  let direction: Gate['direction'] = 'ENTRY';
  let scanners = 4;
  let status: Gate['status'] = 'OPERATIONAL';
  let width = 6.0;

  if (i === 18 || i === 19) {
    direction = 'EXIT';
    scanners = 2;
    status = 'EXIT_ONLY';
  } else if (i === 20 || i === 21) {
    direction = 'EMERGENCY_ONLY';
    scanners = 1;
    status = 'EMERGENCY_ONLY';
    width = 8.0;
  } else if (i === 1 || i === 2 || i === 7 || i === 8 || i === 12 || i === 13) {
    // Primary high-capacity gates
    scanners = 6;
    width = 7.5;
  }

  gates.push({
    id: `gate-${i}`,
    name: `Gate ${i}`,
    position: { x, y },
    width,
    direction,
    scannerCount: scanners,
    operationalScanners: scanners,
    scannerProcessingRatePerMin: 12, // 12 people per scanner/min (~5 secs per person)
    physicalPassageCapacityPerMin: scanners * 20,
    currentQueue: 0,
    queueWaitTimeSecs: 0,
    status,
    warningLevel: 'NORMAL',
    downstreamCorridorId: `corridor-gate-${i}`,
    suggestedAction: 'Monitor standard queue formation',
  });
}

// Zones
const zones: Zone[] = [
  // External Approach Plazas
  {
    id: 'zone-ext-north',
    name: "Cubbon Road North Plaza & Gate 1-5 Approach",
    polygon: [
      { x: 40, y: 5 },
      { x: 220, y: 5 },
      { x: 220, y: 35 },
      { x: 40, y: 35 },
    ],
    usableAreaSqM: 3200,
    maxRecommendedDensity: 2.5,
    currentPopulation: 0,
    currentDensity: 0,
    inflowRatePerMin: 0,
    outflowRatePerMin: 0,
    avgMovementSpeed: 1.3,
    riskLevel: 'NORMAL',
    category: 'EXTERNAL_PLAZA',
    warningDurationSecs: 0,
  },
  {
    id: 'zone-ext-west',
    name: "Queen's Road West Plaza & Gate 6-10 Approach",
    polygon: [
      { x: 5, y: 40 },
      { x: 40, y: 40 },
      { x: 40, y: 180 },
      { x: 5, y: 180 },
    ],
    usableAreaSqM: 2800,
    maxRecommendedDensity: 2.5,
    currentPopulation: 0,
    currentDensity: 0,
    inflowRatePerMin: 0,
    outflowRatePerMin: 0,
    avgMovementSpeed: 1.3,
    riskLevel: 'NORMAL',
    category: 'EXTERNAL_PLAZA',
    warningDurationSecs: 0,
  },
  {
    id: 'zone-ext-south',
    name: "MG Road South Concourse & Gate 11-16 Approach",
    polygon: [
      { x: 40, y: 185 },
      { x: 220, y: 185 },
      { x: 220, y: 215 },
      { x: 40, y: 215 },
    ],
    usableAreaSqM: 3500,
    maxRecommendedDensity: 2.5,
    currentPopulation: 0,
    currentDensity: 0,
    inflowRatePerMin: 0,
    outflowRatePerMin: 0,
    avgMovementSpeed: 1.3,
    riskLevel: 'NORMAL',
    category: 'EXTERNAL_PLAZA',
    warningDurationSecs: 0,
  },
  {
    id: 'zone-ext-east',
    name: "Kasturba Road East Perimeter & Gate 17-21 Approach",
    polygon: [
      { x: 220, y: 40 },
      { x: 255, y: 40 },
      { x: 255, y: 180 },
      { x: 220, y: 180 },
    ],
    usableAreaSqM: 2600,
    maxRecommendedDensity: 2.5,
    currentPopulation: 0,
    currentDensity: 0,
    inflowRatePerMin: 0,
    outflowRatePerMin: 0,
    avgMovementSpeed: 1.3,
    riskLevel: 'NORMAL',
    category: 'EXTERNAL_PLAZA',
    warningDurationSecs: 0,
  },
  // Designated External Holding / Overflow Area (Cubbon Park Annexe)
  {
    id: 'zone-holding-overflow',
    name: "Cubbon Park Auxiliary Holding & Staging Zone",
    polygon: [
      { x: 10, y: 5 },
      { x: 38, y: 5 },
      { x: 38, y: 35 },
      { x: 10, y: 35 },
    ],
    usableAreaSqM: 900,
    maxRecommendedDensity: 2.0,
    currentPopulation: 0,
    currentDensity: 0,
    inflowRatePerMin: 0,
    outflowRatePerMin: 0,
    avgMovementSpeed: 1.2,
    riskLevel: 'NORMAL',
    category: 'HOLDING_AREA',
    warningDurationSecs: 0,
  },
  // Internal Concourses
  {
    id: 'zone-concourse-north',
    name: "North Grand Concourse (Gates 1-5 Interior)",
    polygon: [
      { x: 75, y: 35 },
      { x: 185, y: 35 },
      { x: 175, y: 55 },
      { x: 85, y: 55 },
    ],
    usableAreaSqM: 1800,
    maxRecommendedDensity: 2.0,
    currentPopulation: 0,
    currentDensity: 0,
    inflowRatePerMin: 0,
    outflowRatePerMin: 0,
    avgMovementSpeed: 1.2,
    riskLevel: 'NORMAL',
    category: 'CONCOURSE',
    warningDurationSecs: 0,
  },
  {
    id: 'zone-concourse-west',
    name: "West Stand Concourse (Gates 6-10 Interior)",
    polygon: [
      { x: 45, y: 60 },
      { x: 65, y: 65 },
      { x: 65, y: 155 },
      { x: 45, y: 160 },
    ],
    usableAreaSqM: 1600,
    maxRecommendedDensity: 2.0,
    currentPopulation: 0,
    currentDensity: 0,
    inflowRatePerMin: 0,
    outflowRatePerMin: 0,
    avgMovementSpeed: 1.2,
    riskLevel: 'NORMAL',
    category: 'CONCOURSE',
    warningDurationSecs: 0,
  },
  {
    id: 'zone-concourse-south',
    name: "South Pavilion Concourse (Gates 11-16 Interior)",
    polygon: [
      { x: 75, y: 165 },
      { x: 185, y: 165 },
      { x: 175, y: 145 },
      { x: 85, y: 145 },
    ],
    usableAreaSqM: 1900,
    maxRecommendedDensity: 2.0,
    currentPopulation: 0,
    currentDensity: 0,
    inflowRatePerMin: 0,
    outflowRatePerMin: 0,
    avgMovementSpeed: 1.2,
    riskLevel: 'NORMAL',
    category: 'CONCOURSE',
    warningDurationSecs: 0,
  },
  {
    id: 'zone-concourse-east',
    name: "East Stand Concourse (Gates 17-21 Interior)",
    polygon: [
      { x: 195, y: 60 },
      { x: 215, y: 60 },
      { x: 215, y: 160 },
      { x: 195, y: 155 },
    ],
    usableAreaSqM: 1600,
    maxRecommendedDensity: 2.0,
    currentPopulation: 0,
    currentDensity: 0,
    inflowRatePerMin: 0,
    outflowRatePerMin: 0,
    avgMovementSpeed: 1.2,
    riskLevel: 'NORMAL',
    category: 'CONCOURSE',
    warningDurationSecs: 0,
  },
  // Seating Tiers
  {
    id: 'zone-seating-north',
    name: "North Stand (Gallery & Corporate Boxes)",
    polygon: [
      { x: 85, y: 55 },
      { x: 175, y: 55 },
      { x: 165, y: 75 },
      { x: 95, y: 75 },
    ],
    usableAreaSqM: 1500,
    maxRecommendedDensity: 1.8,
    currentPopulation: 0,
    currentDensity: 0,
    inflowRatePerMin: 0,
    outflowRatePerMin: 0,
    avgMovementSpeed: 0.8,
    riskLevel: 'NORMAL',
    category: 'SEATING',
    warningDurationSecs: 0,
  },
  {
    id: 'zone-seating-south',
    name: "Pavilion End Seating (Members & General)",
    polygon: [
      { x: 85, y: 145 },
      { x: 175, y: 145 },
      { x: 165, y: 125 },
      { x: 95, y: 125 },
    ],
    usableAreaSqM: 1600,
    maxRecommendedDensity: 1.8,
    currentPopulation: 0,
    currentDensity: 0,
    inflowRatePerMin: 0,
    outflowRatePerMin: 0,
    avgMovementSpeed: 0.8,
    riskLevel: 'NORMAL',
    category: 'SEATING',
    warningDurationSecs: 0,
  },
  // Center Playing Field & Stage/Victory Presentation Podium
  {
    id: 'zone-field-stage',
    name: "Ground Infield & Presentation Stage Area",
    polygon: [
      { x: 100, y: 85 },
      { x: 160, y: 85 },
      { x: 160, y: 135 },
      { x: 100, y: 135 },
    ],
    usableAreaSqM: 2500,
    maxRecommendedDensity: 1.5,
    currentPopulation: 0,
    currentDensity: 0,
    inflowRatePerMin: 0,
    outflowRatePerMin: 0,
    avgMovementSpeed: 1.0,
    riskLevel: 'NORMAL',
    category: 'STAGE_ZONE',
    warningDurationSecs: 0,
  },
];

// Corridors connecting Gates and Concourses
const corridors: Corridor[] = [];
gates.forEach((g) => {
  let targetZoneId = 'zone-concourse-north';
  let endX = CX;
  let endY = 45;

  if (g.position.y > 150) {
    targetZoneId = 'zone-concourse-south';
    endX = g.position.x;
    endY = 155;
  } else if (g.position.x < 80) {
    targetZoneId = 'zone-concourse-west';
    endX = 55;
    endY = g.position.y;
  } else if (g.position.x > 180) {
    targetZoneId = 'zone-concourse-east';
    endX = 205;
    endY = g.position.y;
  } else {
    endX = g.position.x;
    endY = 45;
  }

  corridors.push({
    id: `corridor-${g.id}`,
    name: `${g.name} Radial Entry Corridor`,
    start: { x: g.position.x, y: g.position.y },
    end: { x: endX, y: endY },
    width: g.width * 0.9,
    fromZoneId: 'zone-ext-north',
    toZoneId: targetZoneId,
    maxCapacityPerMin: g.scannerCount * 30,
    isBlocked: false,
    isEmergencyRoute: g.direction === 'EMERGENCY_ONLY',
    currentFlowPerMin: 0,
  });
});

// Add main concourse circumferential corridors
corridors.push(
  {
    id: 'corridor-circ-nw',
    name: 'North-West Concourse Connector',
    start: { x: 80, y: 45 },
    end: { x: 55, y: 70 },
    width: 5.5,
    fromZoneId: 'zone-concourse-north',
    toZoneId: 'zone-concourse-west',
    maxCapacityPerMin: 120,
    isBlocked: false,
    isEmergencyRoute: false,
    currentFlowPerMin: 0,
  },
  {
    id: 'corridor-circ-sw',
    name: 'South-West Concourse Connector',
    start: { x: 55, y: 150 },
    end: { x: 80, y: 155 },
    width: 5.5,
    fromZoneId: 'zone-concourse-west',
    toZoneId: 'zone-concourse-south',
    maxCapacityPerMin: 120,
    isBlocked: false,
    isEmergencyRoute: false,
    currentFlowPerMin: 0,
  },
  {
    id: 'corridor-circ-se',
    name: 'South-East Concourse Connector',
    start: { x: 180, y: 155 },
    end: { x: 205, y: 150 },
    width: 5.5,
    fromZoneId: 'zone-concourse-south',
    toZoneId: 'zone-concourse-east',
    maxCapacityPerMin: 120,
    isBlocked: false,
    isEmergencyRoute: false,
    currentFlowPerMin: 0,
  },
  {
    id: 'corridor-circ-ne',
    name: 'North-East Concourse Connector',
    start: { x: 205, y: 70 },
    end: { x: 180, y: 45 },
    width: 5.5,
    fromZoneId: 'zone-concourse-east',
    toZoneId: 'zone-concourse-north',
    maxCapacityPerMin: 120,
    isBlocked: false,
    isEmergencyRoute: false,
    currentFlowPerMin: 0,
  },
  // Dedicated Emergency Access Corridors
  {
    id: 'corridor-emerg-north',
    name: 'Primary North Emergency Access Corridor (Cubbon Rd to Pitch)',
    start: { x: CX, y: 15 },
    end: { x: CX, y: 85 },
    width: 7.0,
    fromZoneId: 'zone-ext-north',
    toZoneId: 'zone-field-stage',
    maxCapacityPerMin: 180,
    isBlocked: false,
    isEmergencyRoute: true,
    currentFlowPerMin: 0,
  },
  {
    id: 'corridor-emerg-south',
    name: 'Primary South Emergency Vehicle Route (Gate 21 to Pitch)',
    start: { x: CX, y: 205 },
    end: { x: CX, y: 135 },
    width: 8.0,
    fromZoneId: 'zone-ext-south',
    toZoneId: 'zone-field-stage',
    maxCapacityPerMin: 200,
    isBlocked: false,
    isEmergencyRoute: true,
    currentFlowPerMin: 0,
  }
);

// Medical Points (4 strategic First Aid Stations)
const medicalPoints: MedicalPoint[] = [
  {
    id: 'med-north',
    name: 'North Stand First-Aid Base (Gate 1)',
    position: { x: 130, y: 38 },
    capacity: 10,
    activePatients: 0,
  },
  {
    id: 'med-south',
    name: 'Pavilion Emergency Care Post (Gate 12)',
    position: { x: 130, y: 162 },
    capacity: 12,
    activePatients: 0,
  },
  {
    id: 'med-west',
    name: 'West Stand Medical Station (Gate 7)',
    position: { x: 50, y: 110 },
    capacity: 8,
    activePatients: 0,
  },
  {
    id: 'med-east',
    name: 'East Stand Medical Point (Gate 18)',
    position: { x: 210, y: 110 },
    capacity: 8,
    activePatients: 0,
  },
];

// Key Attractions / Presentation Points
const attractions: AttractionPoint[] = [
  {
    id: 'attr-stage',
    name: 'Victory Trophy Presentation Stage & Podium',
    position: { x: 130, y: 110 },
    category: 'STAGE',
  },
  {
    id: 'attr-screen-north',
    name: 'North Giant LED Screen & Fan Area',
    position: { x: 130, y: 65 },
    category: 'PODIUM',
  },
  {
    id: 'attr-screen-south',
    name: 'South Giant LED Screen & Fan Area',
    position: { x: 130, y: 155 },
    category: 'PODIUM',
  },
];

// Approach Routes representing external transport & arterial roads
const approachRoutes: ApproachRoute[] = [
  {
    id: 'route-cubbon',
    name: "Cubbon Road Arterial (North Approach)",
    startPoint: { x: 130, y: 5 },
    entryGateIds: ['gate-1', 'gate-2', 'gate-3', 'gate-4', 'gate-5'],
    sharePercentage: 35,
    width: 14,
  },
  {
    id: 'route-queens',
    name: "Queen's Road Corridor (West Approach)",
    startPoint: { x: 5, y: 110 },
    entryGateIds: ['gate-6', 'gate-7', 'gate-8', 'gate-9', 'gate-10'],
    sharePercentage: 25,
    width: 12,
  },
  {
    id: 'route-mg-road',
    name: "MG Road & Metro Station (South Approach)",
    startPoint: { x: 130, y: 215 },
    entryGateIds: ['gate-11', 'gate-12', 'gate-13', 'gate-14', 'gate-15', 'gate-16'],
    sharePercentage: 30,
    width: 16,
  },
  {
    id: 'route-kasturba',
    name: "Kasturba Road Axis (East Approach)",
    startPoint: { x: 255, y: 110 },
    entryGateIds: ['gate-17', 'gate-18', 'gate-19', 'gate-20', 'gate-21'],
    sharePercentage: 10,
    width: 10,
  },
];

export const CHINNASWAMY_STADIUM_PROFILE: Venue = {
  id: 'chinnaswamy-stadium',
  name: 'Chinnaswamy Stadium — Hypothetical Crowd Surge Scenario',
  description:
    'Illustrative 2D digital twin model configured with 21 perimeter gates, external arterial roads, and concourses for pre-event crowd management testing.',
  dimensions: { width: 260, height: 220 },
  seatingCapacity: 40000, // ICC official listed seating capacity
  planningCapacity: 35000, // Explicitly marked as scenario planning limit
  gates,
  zones,
  corridors,
  obstacles: [
    // Perimeter boundary wall segments with openings for gates
    {
      id: 'obs-inner-pitch-railing',
      name: 'Field Perimeter Security Barrier',
      polygon: [
        { x: 92, y: 78 },
        { x: 168, y: 78 },
        { x: 168, y: 142 },
        { x: 92, y: 142 },
      ],
    },
  ],
  medicalPoints,
  attractions,
  approachRoutes,
  sourceAttribution: {
    text:
      'ICC official records list M. Chinnaswamy Stadium seating capacity as 40,000. Public reporting concerning the June 4, 2025 RCB victory-celebration tragedy cited an event planning capacity of ~35,000 and court documentation identified 21 perimeter stadium gates. This digital twin provides a pre-event planning and counterfactual lab model; gate capacities and processing rates are configurable model assumptions.',
    links: [
      {
        label: 'ICC Venue Guide: M. Chinnaswamy Stadium',
        url: 'https://www.icc-cricket.com',
      },
      {
        label: 'Public Documentation & Legal Proceedings Summary',
        url: 'https://timesofindia.indiatimes.com',
      },
    ],
  },
};

