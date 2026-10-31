/**
 * CROWDWISE Predictive Crowd Digital Twin & Safety Lab
 * Canonical Scenario Definitions (Phase 3 & Chinnaswamy Calibrated)
 *
 * Implements the six approved realistic scenario configurations for
 * M. Chinnaswamy Stadium (35,000 Capacity):
 * 1. Normal Stadium Entry (60% capacity = 21,000, uniform ingress, S_pop = 8.4)
 * 2. Sudden Ticket / Metro Surge (95% capacity = 33,250, Gaussian peak, S_pop = 13.3)
 * 3. Gate Scanner Failure & Delay (80% capacity = 28,000, 2 of 4 lanes down, 12s latency = 10 sim agents/min)
 * 4. Uneven Crowd Distribution (85% capacity = 29,750, 75/25 Gate split, S_pop = 11.9)
 * 5. Emergency Crowd Reversal (70% capacity = 24,500, shock reversal, S_pop = 9.8)
 * 6. Intelligent Safety Intervention (3-way paired ablation on identical Scenario 2 demand, S_pop = 13.3)
 */

import { ScenarioDefinition, ScenarioId } from '../types/ScenarioTypes';

export const SCENARIO_DEFINITIONS: Record<ScenarioId, ScenarioDefinition> = {
  stadium_normal: {
    id: 'stadium_normal',
    name: 'Normal Stadium Entry',
    subtitle: 'Baseline 60% Capacity (21,000 Spectators) Steady Ingress',
    category: 'operational',
    description: 'Simulates nominal match-day concourse entry at M. Chinnaswamy Stadium with steady arrival rates and standard bag-check turnstiles. Gate A operates at design capacity while Gate B remains inactive.',
    researchHypothesis: 'Hypothesized to maintain laminar flow in Fruin LOS A/B (< 2.5 p/m²) with longitudinal spillback < 8m.',
    defaultEvent: {
      eventId: 'SCEN-01-NORM-ENTRY',
      eventName: 'Chinnaswamy Normal Match Entry (60% Capacity)',
      venueCapacity: 35000,
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
          name: 'Gate 2 (Main Turnstile A)',
          totalLanes: 4,
          operationalLanes: 4,
          turnstileLatencySec: 4.0
        },
        'gate-b': {
          gateId: 'gate-b',
          name: 'Gate 3 (Auxiliary Bypass B)',
          totalLanes: 4,
          operationalLanes: 0,
          turnstileLatencySec: 4.0
        }
      },
      randomSeed: 1001,
      routingMode: 'fixed',
      sectorId: 'east'
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
    name: 'Sudden Ticket / Metro Arrival Surge',
    subtitle: '95% Sold-Out Match Day (33,250 Spectators) Concentrated Surge',
    category: 'stress_test',
    description: 'Stress-tests East Stand entry gates (MG Road / Cubbon Road) against concentrated arrivals from Cubbon Park Metro station. Peak demand reaches 1,800 represented people/min, exceeding single-gate capacity.',
    researchHypothesis: 'Arrival demand of 1,800 p/min exceeds 4-lane turnstile capacity of 1,140 p/min; hypothesized to generate local density >= 5.0 p/m² and longitudinal spillback > 25m.',
    defaultEvent: {
      eventId: 'SCEN-02-TICKET-SURGE',
      eventName: 'Sold-Out Match Metro Surge (95% Capacity)',
      venueCapacity: 35000,
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
          name: 'Gate 2 (Main Turnstile A)',
          totalLanes: 4,
          operationalLanes: 4,
          turnstileLatencySec: 4.0
        },
        'gate-b': {
          gateId: 'gate-b',
          name: 'Gate 3 (Auxiliary Bypass B)',
          totalLanes: 4,
          operationalLanes: 0,
          turnstileLatencySec: 4.0
        }
      },
      randomSeed: 2026,
      routingMode: 'fixed',
      sectorId: 'east'
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
    subtitle: '50% Turnstile Outage with 12s Service Delay (80% Capacity)',
    category: 'stress_test',
    description: 'Simulates NFC reader and biometric barcode failure at Gate 2 with 2 of 4 lanes failing and latency on remaining operational lanes spiking to 12.0s per person.',
    researchHypothesis: 'Turnstile discharge capacity collapses to exactly 10 sim agents/min (112 rep people/min); hypothesized to cause severe queue buildup and average waiting times > 180s.',
    defaultEvent: {
      eventId: 'SCEN-03-GATE-FAILURE',
      eventName: 'Scanner Hardware Outage (80% Capacity = 28,000)',
      venueCapacity: 35000,
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
          name: 'Gate 2 (Degraded Turnstile A)',
          totalLanes: 4,
          operationalLanes: 2, // 2 failed, 2 operational
          turnstileLatencySec: 12.0 // Latency spikes to 12s -> capacity = (2 * 60) / 12 = 10 sim agents/min
        },
        'gate-b': {
          gateId: 'gate-b',
          name: 'Gate 3 (Auxiliary Bypass B)',
          totalLanes: 4,
          operationalLanes: 0,
          turnstileLatencySec: 4.0
        }
      },
      randomSeed: 3003,
      routingMode: 'fixed',
      sectorId: 'east'
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
    subtitle: '75% Gate 2 vs. 25% Gate 3 Structural Imbalance (85% Capacity)',
    category: 'stress_test',
    description: 'Models asymmetrical concourse ingress where 75% of spectators funnel toward Gate 2 despite Gate 3 being operational, illustrating severe structural load imbalance.',
    researchHypothesis: 'Gate 2 funnel experiences severe congestion (density >= 4.5 p/m², spillback > 20m) while Gate 3 remains underutilized (< 1.8 p/m²).',
    defaultEvent: {
      eventId: 'SCEN-04-UNEVEN-DIST',
      eventName: 'Concourse Ingress Imbalance (85% Capacity = 29,750)',
      venueCapacity: 35000,
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
          name: 'Gate 2 (Main Turnstile A)',
          totalLanes: 4,
          operationalLanes: 4,
          turnstileLatencySec: 4.0
        },
        'gate-b': {
          gateId: 'gate-b',
          name: 'Gate 3 (Auxiliary Bypass B)',
          totalLanes: 4,
          operationalLanes: 4,
          turnstileLatencySec: 4.0
        }
      },
      randomSeed: 4004,
      routingMode: 'fixed',
      sectorId: 'east'
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
    subtitle: 'Alarm Triggered Sudden Counterflow & Evacuation (70% Capacity)',
    category: 'emergency',
    description: 'Simulates forward concourse ingress suddenly interrupted by an emergency alarm, reversing pedestrian flow toward the perimeter emergency egress gates (Gates 20 & 21).',
    researchHypothesis: 'Counterflow shear and head-on pedestrian collisions produce transient compressive shockwaves (density >= 5.0 p/m²) before laminar evacuation stabilizes.',
    defaultEvent: {
      eventId: 'SCEN-05-EMERGENCY-REV',
      eventName: 'Sudden Ingress Reversal (70% Capacity = 24,500)',
      venueCapacity: 35000,
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
          name: 'Gate 20 / 21 Emergency Egress',
          totalLanes: 4,
          operationalLanes: 4,
          turnstileLatencySec: 3.0
        }
      },
      randomSeed: 5005,
      routingMode: 'fixed',
      sectorId: 'south'
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
    subtitle: '3-Way Paired Ablation: Baseline vs. Gate 3 vs. Chicanes (95% Capacity)',
    category: 'counterfactual',
    description: 'Applies a 3-way paired ablation study using the exact same immutable arrival schedule from Scenario 2: Baseline (Gate 3 closed, no baffles) vs. Exp A (Gate 3 open, no baffles) vs. Exp B (Gate 3 open + 40m zigzag baffles).',
    researchHypothesis: 'Reopening Gate 3 increases discharge capacity by 100%, and 40m zigzag baffles damp longitudinal shockwaves, keeping local density below 3.5 p/m².',
    defaultEvent: {
      eventId: 'SCEN-06-SAFETY-INTERV',
      eventName: '3-Way Paired Intervention Study (95% Capacity = 33,250)',
      venueCapacity: 35000,
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
          name: 'Gate 2 (Main Turnstile A)',
          totalLanes: 4,
          operationalLanes: 4,
          turnstileLatencySec: 4.0
        },
        'gate-b': {
          gateId: 'gate-b',
          name: 'Gate 3 (Auxiliary Bypass B)',
          totalLanes: 4,
          operationalLanes: 0, // Baseline: Closed
          turnstileLatencySec: 4.0
        }
      },
      randomSeed: 2026, // Identical to Scenario 2 for exact parity
      routingMode: 'fixed',
      sectorId: 'east'
    },
    initialGeometryType: 'stadium',
    defaultMitigations: {
      bafflesActive: false,
      auxGateActive: false,
      dividerActive: false
    }
  }
};
