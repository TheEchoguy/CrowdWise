import { ScenarioDefinition } from '../types';

export const SCENARIOS: ScenarioDefinition[] = [
  {
    id: 'chinnaswamy-hypothetical-surge',
    name: 'Chinnaswamy Stadium — Hypothetical Crowd Surge Scenario',
    category: 'HYPOTHETICAL DEMO',
    venueId: 'chinnaswamy-stadium',
    description:
      'Hypothetical celebration scenario based on public reporting context: an anticipated attendance of 35,000+ faces sudden arrival spikes at perimeter gates, testing admission regulation, holding areas, and downstream corridor flow.',
    factualBackground:
      'The ICC lists M. Chinnaswamy Stadium seating capacity as 40,000. Public reporting concerning the June 4, 2025 RCB victory-celebration tragedy referred to an event planning capacity of ~35,000 and 21 stadium gates. The external gathering was reported far larger than could be admitted. This scenario tests pre-event crowd management assumptions.',
    initialConditions:
      '14 public entry gates operational, 4 scanner lanes per gate, initial baseline arrival rate of 350 people/min across 4 approach roads.',
    triggerTimeSecs: 45,
    parameters: {
      surgeMultiplier: 2.8,
      surgeDurationSecs: 180,
      affectedGates: ['gate-1', 'gate-2', 'gate-3', 'gate-7', 'gate-12'],
      externalCrowdSurplus: 15000,
    },
    expectedRisks: [
      'Cubbon Road and MG Road approach plazas exceed 3.0 people/m²',
      'Queues spill back onto vehicular carriage-ways',
      'Downstream concourses face bottlenecking if all entries push simultaneously',
      'Emergency access routes risk lateral obstruction',
    ],
    recommendedInterventions: [
      'REGULATE_ADMISSION',
      'OPEN_HOLDING_AREA',
      'STAGGER_INFLOW',
      'EARLY_PUBLIC_COMMUNICATION',
    ],
    completionCriteria:
      'Evaluate whether staggered inflow and auxiliary holding space prevent queue spillback onto active roads without exceeding concourse threshold (2.0 p/m²).',
  },
  {
    id: 'unexpected-arrival-surge',
    name: 'Scenario 1: Unexpected Arrival Surge',
    category: 'ARRIVAL SURGES',
    venueId: 'chinnaswamy-stadium',
    description:
      'A sharp unexpected spike in attendee arrivals occurs within a 15-minute window, exceeding nominal gate throughput and building extensive external queues.',
    initialConditions: 'Gates operating normally at standard service rates (12 persons/scanner/min).',
    triggerTimeSecs: 30,
    parameters: {
      surgeMultiplier: 3.0,
      surgeDurationSecs: 150,
    },
    expectedRisks: [
      'Rapid queue expansion beyond physical corral space',
      'Pedestrian crowd spillback onto adjacent roads',
      'Disproportionate pressure on primary gates facing transit lines',
    ],
    recommendedInterventions: ['REGULATE_ADMISSION', 'OPEN_HOLDING_AREA', 'STAGGER_INFLOW'],
    completionCriteria:
      'Observe queue growth, peak wait times, and the effectiveness of admission regulation vs baseline.',
  },
  {
    id: 'scanner-failure',
    name: 'Scenario 2: Ticket Scanner Outage (Gate 2 & 7)',
    category: 'ENTRANCE & HARDWARE FAILURES',
    venueId: 'chinnaswamy-stadium',
    description:
      'Network or power glitch causes 75% of optical scanners at Gate 2 and Gate 7 to drop offline, drastically cutting processing throughput while crowds continue to arrive.',
    initialConditions: 'Gate 2 and Gate 7 operating with 6 scanners each.',
    triggerTimeSecs: 40,
    parameters: {
      failedGateIds: ['gate-2', 'gate-7'],
      offlineScannersCount: 4,
      failureDurationSecs: 120,
    },
    expectedRisks: [
      'Immediate queue spike and wait time increase from 4 mins to 25+ mins',
      'Local crowd frustration and surging near turnstiles',
      'Crowd naturally bleeding toward adjacent gates without coordination',
    ],
    recommendedInterventions: ['SPARE_SCANNERS', 'REROUTE_APPROACH', 'EARLY_PUBLIC_COMMUNICATION'],
    completionCriteria:
      'Examine queue buildup and compare whether deploying spare mobile scanners outperforms crowd diversion.',
  },
  {
    id: 'complete-gate-closure',
    name: 'Scenario 3: Complete Gate Closure (Gate 1 Main Portal)',
    category: 'ENTRANCE & HARDWARE FAILURES',
    venueId: 'chinnaswamy-stadium',
    description:
      'A physical turnstile or security barrier fault forces the total closure of Gate 1. Inflow must be routed to Gate 2 and Gate 3 without creating new downstream choke points.',
    initialConditions: 'All gates open; Gate 1 processing high volume from North plaza.',
    triggerTimeSecs: 35,
    parameters: {
      closedGateId: 'gate-1',
    },
    expectedRisks: [
      'Sudden accumulation of stranded attendees at Gate 1 boundary',
      'Severe overload transferred onto Gate 2 and North Concourse Corridor',
    ],
    recommendedInterventions: ['REROUTE_APPROACH', 'EARLY_PUBLIC_COMMUNICATION'],
    completionCriteria:
      'Route-aware recommendation engine must verify whether alternative gates have downstream capacity before advising diversion.',
  },
  {
    id: 'all-gates-congested',
    name: 'Scenario 4: Systemic Perimeter Congestion (All Gates Overwhelmed)',
    category: 'COMPOUND INCIDENTS',
    venueId: 'chinnaswamy-stadium',
    description:
      'Every operational entrance receives sustained inflow exceeding scanner capacity. External plazas hit critical density with zero spare entrance capacity.',
    initialConditions: 'High attendance with compressed arrival window.',
    triggerTimeSecs: 25,
    parameters: {
      globalInflowMultiplier: 2.6,
    },
    expectedRisks: [
      'External waiting areas saturated',
      'Arterial roads blocked by waiting attendees',
      'Risk of crush dynamics at perimeter gates',
    ],
    recommendedInterventions: [
      'ADMISSION_PAUSE',
      'OPEN_HOLDING_AREA',
      'STAGGER_INFLOW',
      'EARLY_PUBLIC_COMMUNICATION',
    ],
    completionCriteria:
      'Assess emergency admission pause and holding zone activation to relieve perimeter pressure.',
  },
  {
    id: 'main-stage-surge',
    name: 'Scenario 5: Center Stage & Presentation Surge',
    category: 'INTERNAL CROWD MOVEMENT',
    venueId: 'chinnaswamy-stadium',
    description:
      'A surprise guest appearance or victory ceremony at the infield stage draws 60% of concourse and seating spectators towards the central viewing rails simultaneously.',
    initialConditions: '15,000 spectators distributed across stands and concourses.',
    triggerTimeSecs: 50,
    parameters: {
      attractionId: 'attr-stage',
      surgeRatio: 0.6,
    },
    expectedRisks: [
      'Dangerous density spikes (>3.5 p/m²) around field perimeter railings',
      'Concourse radial corridors jammed with bidirectional conflicts',
    ],
    recommendedInterventions: ['EARLY_PUBLIC_COMMUNICATION'],
    completionCriteria:
      'Test public announcement broadcast and auxiliary screen distribution to prevent single-point concentration.',
  },
  {
    id: 'corridor-bottleneck',
    name: 'Scenario 6: North-West Concourse Corridor Bottleneck',
    category: 'CROWD BOTTLENECKS',
    venueId: 'chinnaswamy-stadium',
    description:
      'High pedestrian flow into the North-West radial corridor causes upstream accumulation and localized stagnation.',
    initialConditions: 'Normal concourse traversal.',
    triggerTimeSecs: 30,
    parameters: {
      corridorId: 'corridor-circ-nw',
      effectiveWidthReduction: 0.5,
    },
    expectedRisks: [
      'Shockwave slowing down upstream spectators',
      'Concourse density exceeding 2.5 p/m²',
    ],
    recommendedInterventions: ['REROUTE_APPROACH'],
    completionCriteria:
      'Verify whether directional one-way flow or rerouting relieves concourse congestion.',
  },
  {
    id: 'blocked-emergency-route',
    name: 'Scenario 7: Blocked Emergency Vehicle Corridor',
    category: 'EMERGENCY EXITS & BLOCKED ROUTES',
    venueId: 'chinnaswamy-stadium',
    description:
      'A delivery vehicle breakdown or temporary obstacle obstructs the primary North Emergency Access Corridor from Cubbon Road to the infield.',
    initialConditions: 'Emergency routes clear.',
    triggerTimeSecs: 20,
    parameters: {
      corridorId: 'corridor-emerg-north',
    },
    expectedRisks: [
      'Loss of designated primary emergency evacuation & ambulance thoroughfare',
      'Required diversion to South Emergency route (Gate 21)',
    ],
    recommendedInterventions: ['EARLY_PUBLIC_COMMUNICATION'],
    completionCriteria:
      'System flags affected zones, highlights alternative South route, and issues operator action.',
  },
  {
    id: 'medical-emergency',
    name: 'Scenario 8: Medical Emergency in High-Density Concourse',
    category: 'MEDICAL INCIDENTS',
    venueId: 'chinnaswamy-stadium',
    description:
      'A spectator requires acute medical intervention inside North Concourse near Gate 3. First-aid responders must navigate through the crowded concourse from North First-Aid Base.',
    initialConditions: 'Moderate concourse crowd density.',
    triggerTimeSecs: 25,
    parameters: {
      incidentLocation: { x: 130, y: 48 },
      assignedMedicalPointId: 'med-north',
    },
    expectedRisks: [
      'Crowd rubbernecking / slowing around the patient',
      'Delayed responder traversal time due to high local density',
    ],
    recommendedInterventions: ['EARLY_PUBLIC_COMMUNICATION'],
    completionCriteria:
      'Pathfinding calculates clear corridor route, measures responder arrival time, and issues public guidance.',
  },
  {
    id: 'external-crowd-overflow',
    name: 'Scenario 9: External Gathering Exceeds Available Capacity',
    category: 'EXTERNAL CROWD ACCUMULATION',
    venueId: 'chinnaswamy-stadium',
    description:
      'Un-ticketed crowds and celebratory gatherings swell the external plaza by 15,000+ people, exceeding designated approach plaza holding capacities.',
    initialConditions: 'Standard external arrival flow.',
    triggerTimeSecs: 30,
    parameters: {
      unexpectedExternalCount: 15000,
    },
    expectedRisks: [
      'Extreme crush risk against perimeter gates',
      'Spillover into public transit lines and traffic intersections',
    ],
    recommendedInterventions: [
      'OPEN_HOLDING_AREA',
      'STAGGER_INFLOW',
      'EARLY_PUBLIC_COMMUNICATION',
    ],
    completionCriteria:
      'Evaluate opening Cubbon Park auxiliary staging area and transit coordination.',
  },
  {
    id: 'departure-surge',
    name: 'Scenario 10: Event-Ending Departure Surge',
    category: 'EVENT-ENDING DEPARTURE SURGES',
    venueId: 'chinnaswamy-stadium',
    description:
      'Event concludes and 30,000 attendees head towards exits simultaneously, putting heavy demand on exit gates and external transit corridors.',
    initialConditions: 'Full stadium population inside.',
    triggerTimeSecs: 15,
    parameters: {
      departureDemandRatio: 0.9,
    },
    expectedRisks: [
      'Exit gate choke points',
      'Crowd conflicts between departing spectators heading to MG Road Metro vs Queen\'s Road bus corridors',
    ],
    recommendedInterventions: ['PHASED_DEPARTURE', 'EARLY_PUBLIC_COMMUNICATION'],
    completionCriteria:
      'Measure clearance time and compare phased stand-by-stand departure vs unmanaged simultaneous surge.',
  },
  {
    id: 'heavy-rain-shelter-rush',
    name: 'Scenario 11: Sudden Monsoonal Rain (Shelter Surge)',
    category: 'WEATHER-RELATED CHANGES',
    venueId: 'open-festival',
    description:
      'Sudden heavy rainfall causes open lawn spectators to sprint towards the covered pavilion and shelter zones, spiking local densities to dangerous levels.',
    initialConditions: 'Festival grounds populated across open lawn.',
    triggerTimeSecs: 35,
    parameters: {
      targetZoneId: 'zone-fest-shelter',
    },
    expectedRisks: [
      'Shelter zone exceeding 3.5 p/m²',
      'Slips, falls, and localized crushing at shelter entrance',
    ],
    recommendedInterventions: ['EARLY_PUBLIC_COMMUNICATION'],
    completionCriteria:
      'Test distribution of crowd between multiple shelters and covered concourses.',
  },
];

