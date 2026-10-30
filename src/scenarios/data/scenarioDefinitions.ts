/**
 * CROWDWISE Predictive Crowd Digital Twin & Safety Lab
 * Canonical Scenario Definitions (Phase 3)
 *
 * Implements the six approved realistic scenario configurations:
 * 1. Normal Stadium Entry (60% capacity, uniform arrival)
 * 2. Sudden Ticket-Sale Surge (95% capacity, Gaussian surge, 1,800 p/min peak)
 * 3. Gate Failure / Delay (80% capacity, 2 of 4 lanes down, 12s latency = 10 sim agents/min)
 * 4. Uneven Crowd Distribution (85% capacity, 75/25 Gate split)
 * 5. Emergency Crowd Reversal (70% capacity, shock reversal geometry)
 * 6. Intelligent Safety Intervention (3-way paired ablation on identical Scenario 2 demand)
 */

import { ScenarioDefinition, ScenarioId } from '../types/ScenarioTypes';

export const SCENARIO_DEFINITIONS: Record<ScenarioId, ScenarioDefinition> = {
  stadium_normal: {
    id: 'stadium_normal',
    name: 'Normal Stadium Entry',
    subtitle: 'Baseline 60% Capacity Steady Ingress',
    category: 'operational',
    description: 'Simulates nominal match-day concourse entry with steady arrival rates and standard bag-check turnstiles. Gate A operates at full design capacity while Gate B remains inactive.',
    researchHypothesis: 'Hypothesized to maintain laminar flow in Fruin LOS A/B (< 2.5 p/m²) with longitudinal spillback < 8m.',
    defaultEvent: {
      eventId: 'SCEN-01-NORM-ENTRY',
      eventName: 'Match Day Normal Ingress (60% Capacity)',
      venueCapacity: 50000,
      ticketSalesPercentage: 0.60,
      attendancePercentage: 1.0,
      maxSimulatedAgents: 2500,
      arrivalStartTimeMin: 0,
      arrivalEndTimeMin: 60,
      arrivalDistribution: 'uniform',
      gateAShare: 1.0,
      gateBShare: 0.0,
      gates: {
        'gate-a': {
          gateId: 'gate-a',
          name: 'Gate A (Main Turnstile)',
          totalLanes: 4,
          operationalLanes: 4,
          turnstileLatencySec: 4.0
        },
        'gate-b': {
          gateId: 'gate-b',
          name: 'Gate B (Auxiliary Bypass)',
          totalLanes: 4,
          operationalLanes: 0,
          turnstileLatencySec: 4.0
        }
      },
      randomSeed: 1001,
      routingMode: 'fixed'
    },
    initialGeometryType: 'stadium',
    defaultMitigations: {
      bafflesActive: false,
      auxGateActive: false,
      dividerActive: false
    }
  },

  ticket_surge: {
    id: 'ticket_surge',
    name: 'Sudden Ticket-Sale Surge',
    subtitle: '95% Sold-Out Match Day with Gaussian Peak Surge',
    category: 'stress_test',
    description: 'Stress-tests entry gates against concentrated arrivals (15–20 min surge window). Peak demand reaches 1,800 represented people/min, exceeding single-gate capacity by 57.9%.',
    researchHypothesis: 'Arrival demand of 1,800 p/min exceeds 4-lane turnstile capacity of 1,140 p/min by 57.9%; hypothesized to generate local density >= 5.0 p/m² and longitudinal spillback > 25m.',
    defaultEvent: {
      eventId: 'SCEN-02-TICKET-SURGE',
      eventName: 'Sold-Out Match Surge (95% Capacity)',
      venueCapacity: 50000,
      ticketSalesPercentage: 0.95,
      attendancePercentage: 1.0,
      maxSimulatedAgents: 2500,
      arrivalStartTimeMin: 0,
      arrivalEndTimeMin: 60,
      arrivalDistribution: 'gaussian_peak',
      gaussianPeakMin: 25,
      targetPeakArrivalRateReal: 1800.0,
      gateAShare: 1.0,
      gateBShare: 0.0,
      gates: {
        'gate-a': {
          gateId: 'gate-a',
          name: 'Gate A (Main Turnstile)',
          totalLanes: 4,
          operationalLanes: 4,
          turnstileLatencySec: 4.0
        },
        'gate-b': {
          gateId: 'gate-b',
          name: 'Gate B (Auxiliary Bypass)',
          totalLanes: 4,
          operationalLanes: 0,
          turnstileLatencySec: 4.0
        }
      },
      randomSeed: 2026,
      routingMode: 'fixed'
    },
    initialGeometryType: 'stadium',
    defaultMitigations: {
      bafflesActive: false,
      auxGateActive: false,
      dividerActive: false
    }
  },

  gate_failure: {
    id: 'gate_failure',
    name: 'Gate Scanner Failure & Delay',
    subtitle: '50% Turnstile Outage with 12s Service Delay',
    category: 'stress_test',
    description: 'Simulates barcode reader breakdown at Gate A with 2 of 4 lanes failing and latency on remaining lanes spiking to 12.0s per person. Gate B remains unavailable.',
    researchHypothesis: 'Turnstile discharge capacity collapses to 10 sim agents/min (160 rep people/min); hypothesized to cause severe queue buildup and average waiting times > 180s.',
    defaultEvent: {
      eventId: 'SCEN-03-GATE-FAILURE',
      eventName: 'Scanner Hardware Outage (80% Capacity)',
      venueCapacity: 50000,
      ticketSalesPercentage: 0.80,
      attendancePercentage: 1.0,
      maxSimulatedAgents: 2500,
      arrivalStartTimeMin: 0,
      arrivalEndTimeMin: 60,
      arrivalDistribution: 'uniform',
      gateAShare: 1.0,
      gateBShare: 0.0,
      gates: {
        'gate-a': {
          gateId: 'gate-a',
          name: 'Gate A (Degraded Turnstile)',
          totalLanes: 4,
          operationalLanes: 2, // 2 failed, 2 operational
          turnstileLatencySec: 12.0 // Latency spikes to 12s -> capacity = (2 * 60) / 12 = 10 agents/min
        },
        'gate-b': {
          gateId: 'gate-b',
          name: 'Gate B (Auxiliary Bypass)',
          totalLanes: 4,
          operationalLanes: 0,
          turnstileLatencySec: 4.0
        }
      },
      randomSeed: 3003,
      routingMode: 'fixed'
    },
    initialGeometryType: 'stadium',
    defaultMitigations: {
      bafflesActive: false,
      auxGateActive: false,
      dividerActive: false
    }
  },

  uneven_distribution: {
    id: 'uneven_distribution',
    name: 'Uneven Crowd Distribution',
    subtitle: '75% Gate A vs. 25% Gate B Structural Imbalance',
    category: 'stress_test',
    description: 'Models asymmetrical concourse ingress where 75% of spectators funnel toward Gate A despite Gate B being open and operational, illustrating structural imbalance.',
    researchHypothesis: 'Gate A funnel experiences severe congestion (density >= 4.5 p/m², spillback > 20m) while Gate B remains underutilized (< 1.8 p/m²).',
    defaultEvent: {
      eventId: 'SCEN-04-UNEVEN-DIST',
      eventName: 'Concourse Ingress Imbalance (85% Capacity)',
      venueCapacity: 50000,
      ticketSalesPercentage: 0.85,
      attendancePercentage: 1.0,
      maxSimulatedAgents: 2500,
      arrivalStartTimeMin: 0,
      arrivalEndTimeMin: 60,
      arrivalDistribution: 'uniform',
      gateAShare: 0.75,
      gateBShare: 0.25,
      gates: {
        'gate-a': {
          gateId: 'gate-a',
          name: 'Gate A (Main Turnstile)',
          totalLanes: 4,
          operationalLanes: 4,
          turnstileLatencySec: 4.0
        },
        'gate-b': {
          gateId: 'gate-b',
          name: 'Gate B (Auxiliary Bypass)',
          totalLanes: 4,
          operationalLanes: 4,
          turnstileLatencySec: 4.0
        }
      },
      randomSeed: 4004,
      routingMode: 'fixed'
    },
    initialGeometryType: 'stadium',
    defaultMitigations: {
      bafflesActive: false,
      auxGateActive: true,
      dividerActive: false
    }
  },

  emergency_reversal: {
    id: 'emergency_reversal',
    name: 'Emergency Crowd Reversal',
    subtitle: 'Alarm Triggered Sudden Counterflow & Evacuation',
    category: 'emergency',
    description: 'Simulates forward ingress suddenly interrupted by an emergency alarm, reversing pedestrian flow toward the rear emergency egress gate.',
    researchHypothesis: 'Counterflow shear and head-on pedestrian collisions produce transient compressive shockwaves (density >= 5.0 p/m²) before laminar evacuation stabilizes.',
    defaultEvent: {
      eventId: 'SCEN-05-EMERGENCY-REV',
      eventName: 'Sudden Ingress Reversal (70% Capacity)',
      venueCapacity: 50000,
      ticketSalesPercentage: 0.70,
      attendancePercentage: 1.0,
      maxSimulatedAgents: 2500,
      arrivalStartTimeMin: 0,
      arrivalEndTimeMin: 60,
      arrivalDistribution: 'burst',
      gateAShare: 1.0,
      gateBShare: 0.0,
      gates: {
        'gate-emergency-rear': {
          gateId: 'gate-emergency-rear',
          name: 'Rear Emergency Egress',
          totalLanes: 4,
          operationalLanes: 4,
          turnstileLatencySec: 3.0
        }
      },
      randomSeed: 5005,
      routingMode: 'fixed'
    },
    initialGeometryType: 'reversal',
    defaultMitigations: {
      bafflesActive: false,
      auxGateActive: false,
      dividerActive: false
    }
  },

  safety_intervention: {
    id: 'safety_intervention',
    name: 'Intelligent Safety Intervention Lab',
    subtitle: '3-Way Paired Ablation: Baseline vs. Gate B vs. Chicanes',
    category: 'counterfactual',
    description: 'Applies a 3-way paired ablation study using the exact same immutable arrival schedule from Scenario 2: Baseline (Gate B closed, no baffles) vs. Exp A (Gate B open, no baffles) vs. Exp B (Gate B open + 40m zigzag baffles).',
    researchHypothesis: 'Reopening Gate B increases discharge capacity by 100%, and 40m zigzag baffles damp longitudinal shockwaves, keeping local density below 3.5 p/m².',
    defaultEvent: {
      eventId: 'SCEN-06-SAFETY-INTERV',
      eventName: '3-Way Paired Intervention Study (95% Capacity)',
      venueCapacity: 50000,
      ticketSalesPercentage: 0.95,
      attendancePercentage: 1.0,
      maxSimulatedAgents: 2500,
      arrivalStartTimeMin: 0,
      arrivalEndTimeMin: 60,
      arrivalDistribution: 'gaussian_peak',
      gaussianPeakMin: 25,
      targetPeakArrivalRateReal: 1800.0,
      gateAShare: 0.50,
      gateBShare: 0.50,
      gates: {
        'gate-a': {
          gateId: 'gate-a',
          name: 'Gate A (Main Turnstile)',
          totalLanes: 4,
          operationalLanes: 4,
          turnstileLatencySec: 4.0
        },
        'gate-b': {
          gateId: 'gate-b',
          name: 'Gate B (Auxiliary Bypass)',
          totalLanes: 4,
          operationalLanes: 0, // Baseline: Closed
          turnstileLatencySec: 4.0
        }
      },
      randomSeed: 2026, // Identical to Scenario 2 for exact parity
      routingMode: 'fixed'
    },
    initialGeometryType: 'stadium',
    defaultMitigations: {
      bafflesActive: false,
      auxGateActive: false,
      dividerActive: false
    }
  }
};

