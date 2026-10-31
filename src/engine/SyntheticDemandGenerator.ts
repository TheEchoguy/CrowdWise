/**
 * CROWDWISE — Synthetic Demand & Scenario Generation Engine
 * Stage 1: Deterministic Multi-Scenario Crowd Generation & Controlled Experimentation
 * M. Chinnaswamy Stadium, Bengaluru
 *
 * Supports All 7 Principal Safety Scenarios:
 * - Scenario A: Normal Ingress (NORMAL_INGRESS)
 * - Scenario B: Metro Passenger Surge (METRO_SURGE)
 * - Scenario C: Outer Gate Failure (OUTER_GATE_FAILURE)
 * - Scenario D: Inner Turnstile Failure (TURNSTILE_FAILURE)
 * - Scenario E: Counter-Flow Shock (COUNTER_FLOW_SHOCK)
 * - Scenario F: Ticket Rejection Shockwave (TICKET_REJECTION_SHOCKWAVE)
 * - Scenario G: Combined Emergency (COMBINED_EMERGENCY)
 */

import { RoadSectorId } from '../types/simulation';
import { SeededPRNG } from './prng';
import { KSCA_OUTER_GATES, KSCA_STADIUM_SECTORS } from './ChinnaswamyData';
import { GATE_CONNECTIVITY_CATALOG, getConnectedInnerGates } from '../stadium/network/gateConnectivity';

export type ScenarioType =
  | 'NORMAL_INGRESS'
  | 'METRO_SURGE'
  | 'OUTER_GATE_FAILURE'
  | 'TURNSTILE_FAILURE'
  | 'COUNTER_FLOW_SHOCK'
  | 'TICKET_REJECTION_SHOCKWAVE'
  | 'COMBINED_EMERGENCY';

// Backwards-compatible alias for existing tests
export type ExperimentType = ScenarioType | 'NORMAL' | 'SURGE' | 'GATE_FAILURE' | 'COUNTER_FLOW';

export interface SurgeParameters {
  magnitude: number;          // e.g. +500 p/min
  durationSeconds: number;    // e.g. 45s
  startSeconds: number;       // e.g. 15s
  affectedGates: string[];    // e.g. ['E11', 'E12']
  profile: 'step' | 'pulse' | 'wave';
}

export interface GateFailureParameters {
  failedGateId: string;       // e.g. 'E22'
  startSeconds: number;       // e.g. 20s
  durationSeconds: number;    // e.g. 60s
  alternateGates: string[];   // e.g. ['E23', 'E21'] (strictly authorized)
}

export interface TurnstileFailureParameters {
  innerGateId: string;        // e.g. 'G7'
  failedCounterCount: number; // e.g. 2
  startSeconds: number;       // e.g. 20s
  durationSeconds: number;    // e.g. 60s
}

export interface CounterFlowParameters {
  inboundCount: number;       // nominal arriving
  outboundCount: number;      // returning / rejected
  intensityPercent: number;   // e.g. 12% to 25%
  startSeconds: number;
  durationSeconds: number;
  corridorWidthMeters: number; // e.g. 12m
  separationAvailable: boolean;
}

export interface TicketRejectionParameters {
  rejectionPercentage: number;   // e.g. 0.08 (8%) to 0.20 (20%)
  wrongGatePercentage: number;   // e.g. 0.05
  duplicatePercentage: number;   // e.g. 0.04
  recoveryCorridorCapacity: number; // e.g. 180 p/min
}

export interface TimelineEvent {
  id: string;
  name: string;
  startSeconds: number;
  durationSeconds: number;
  type: 'SURGE' | 'GATE_FAIL' | 'TURNSTILE_FAIL' | 'COUNTER_FLOW' | 'REJECTION_SPIKE';
  parameters: Record<string, any>;
}

export interface ScenarioConfig {
  id: string;
  type: ScenarioType;
  name: string;
  description: string;
  seed: number;
  expectedAttendance: number;  // Venue target (e.g. 35,000)
  baseInflowRate: number;      // p/min (nominal 360)
  durationSeconds: number;     // e.g. 120s
  walkingSpeed: number;        // m/s (1.34)
  turnstileServiceTime: number;// sec/person (1.0)
  selectedOuterGates: string[];
  selectedInnerGates: string[];

  // Scenario-Specific Parameter Objects
  surge?: SurgeParameters;
  gateFailure?: GateFailureParameters;
  turnstileFailure?: TurnstileFailureParameters;
  counterFlow?: CounterFlowParameters;
  ticketRejection?: TicketRejectionParameters;
  combinedEvents?: TimelineEvent[];

  // Legacy compatibility fields
  surgeMagnitude?: number;
  surgeDurationSeconds?: number;
  surgeProfile?: 'step' | 'pulse' | 'wave';
  metroBurstOrigin?: boolean;
  failedGateId?: string;
  failedTurnstileCount?: number;
  failureLatencyMultiplier?: number;
  counterFlowPercentage?: number;
  counterFlowStartSeconds?: number;
}

export interface ScheduledAgentArrival {
  agentId: number;
  timeSeconds: number;
  targetOuterGate: string;
  targetInnerGate: string;
  sectorRoad: RoadSectorId;
  isVipMedia: boolean;
  isRejected: boolean;
  isRerouted: boolean;
  originalGate?: string;
  desiredSpeed: number;
  spawnX: number;
  spawnY: number;
}

export const PRESET_SCENARIOS: Record<ScenarioType, ScenarioConfig> = {
  NORMAL_INGRESS: {
    id: 'scen_a_normal_ingress',
    type: 'NORMAL_INGRESS',
    name: 'Scenario A: Normal Gameday Ingress',
    description: 'Steady, laminar 360 p/m spectator arrival distributed across open outer gates and authorized stand turnstiles.',
    seed: 42,
    expectedAttendance: 35000,
    baseInflowRate: 360,
    durationSeconds: 120,
    walkingSpeed: 1.34,
    turnstileServiceTime: 1.0,
    selectedOuterGates: ['E18', 'E19', 'E22', 'E23', 'E12', 'E13', 'E11'],
    selectedInnerGates: ['G7', 'G8', 'G9', 'G10', 'G14', 'G15']
  },

  METRO_SURGE: {
    id: 'scen_b_metro_surge',
    type: 'METRO_SURGE',
    name: 'Scenario B: Metro Passenger Surge',
    description: 'High-density +600 p/m arrival pulse from MG Road & Cubbon Park Metro stations creating holding concourse congestion.',
    seed: 101,
    expectedAttendance: 35000,
    baseInflowRate: 360,
    durationSeconds: 120,
    walkingSpeed: 1.45,
    turnstileServiceTime: 1.0,
    selectedOuterGates: ['E11', 'E12', 'E13'],
    selectedInnerGates: ['G14', 'G15'],
    surge: {
      magnitude: 600,
      durationSeconds: 45,
      startSeconds: 15,
      affectedGates: ['E11', 'E12'],
      profile: 'wave'
    },
    surgeMagnitude: 600,
    surgeDurationSeconds: 45,
    surgeProfile: 'wave',
    metroBurstOrigin: true
  },

  OUTER_GATE_FAILURE: {
    id: 'scen_c_outer_gate_failure',
    type: 'OUTER_GATE_FAILURE',
    name: 'Scenario C: Outer Gate E22 Failure & Rerouting',
    description: 'Complete physical closure of Gate E22; arriving patrons must dynamically reroute to verified alternative gates (E23/E21).',
    seed: 202,
    expectedAttendance: 35000,
    baseInflowRate: 420,
    durationSeconds: 120,
    walkingSpeed: 1.30,
    turnstileServiceTime: 1.0,
    selectedOuterGates: ['E22', 'E23', 'E21'],
    selectedInnerGates: ['G7', 'G8'],
    gateFailure: {
      failedGateId: 'E22',
      startSeconds: 15,
      durationSeconds: 65,
      alternateGates: ['E23', 'E21']
    },
    failedGateId: 'E22'
  },

  TURNSTILE_FAILURE: {
    id: 'scen_d_turnstile_failure',
    type: 'TURNSTILE_FAILURE',
    name: 'Scenario D: Inner Bank G7 Turnstile Breakdown',
    description: 'Hardware malfunction disables 2 of 3 turnstiles at inner bank G7, causing queue accumulation and concourse spillback.',
    seed: 303,
    expectedAttendance: 35000,
    baseInflowRate: 380,
    durationSeconds: 120,
    walkingSpeed: 1.34,
    turnstileServiceTime: 1.0,
    selectedOuterGates: ['E22', 'E23'],
    selectedInnerGates: ['G7', 'G8'],
    turnstileFailure: {
      innerGateId: 'G7',
      failedCounterCount: 2,
      startSeconds: 15,
      durationSeconds: 60
    },
    failedTurnstileCount: 2
  },

  COUNTER_FLOW_SHOCK: {
    id: 'scen_e_counter_flow_shock',
    type: 'COUNTER_FLOW_SHOCK',
    name: 'Scenario E: Concourse Counter-Flow Shock',
    description: '15% reverse crowd stream opposing primary ingress in narrow corridors, inducing head-on collisions and flow penalties.',
    seed: 404,
    expectedAttendance: 35000,
    baseInflowRate: 420,
    durationSeconds: 120,
    walkingSpeed: 1.30,
    turnstileServiceTime: 1.0,
    selectedOuterGates: ['E12', 'E13'],
    selectedInnerGates: ['G14', 'G15'],
    counterFlow: {
      inboundCount: 380,
      outboundCount: 65,
      intensityPercent: 0.15,
      startSeconds: 10,
      durationSeconds: 80,
      corridorWidthMeters: 10,
      separationAvailable: false
    },
    counterFlowPercentage: 0.15,
    counterFlowStartSeconds: 10
  },

  TICKET_REJECTION_SHOCKWAVE: {
    id: 'scen_f_ticket_rejection',
    type: 'TICKET_REJECTION_SHOCKWAVE',
    name: 'Scenario F: 12% Ticket Rejection Shockwave',
    description: 'Surge of invalid QR codes and duplicate credentials diverted into lateral recovery corridor without blocking active ingress.',
    seed: 505,
    expectedAttendance: 35000,
    baseInflowRate: 400,
    durationSeconds: 120,
    walkingSpeed: 1.34,
    turnstileServiceTime: 1.0,
    selectedOuterGates: ['E22', 'E19'],
    selectedInnerGates: ['G7', 'G8', 'G9'],
    ticketRejection: {
      rejectionPercentage: 0.12,
      wrongGatePercentage: 0.04,
      duplicatePercentage: 0.05,
      recoveryCorridorCapacity: 160
    }
  },

  COMBINED_EMERGENCY: {
    id: 'scen_g_combined_emergency',
    type: 'COMBINED_EMERGENCY',
    name: 'Scenario G: Multi-Incident Compound Emergency',
    description: 'Synchronized compound failure: Metro mass surge pulse coinciding with turnstile counter breakdown and ticket rejections.',
    seed: 606,
    expectedAttendance: 35000,
    baseInflowRate: 450,
    durationSeconds: 120,
    walkingSpeed: 1.40,
    turnstileServiceTime: 1.0,
    selectedOuterGates: ['E11', 'E12', 'E22'],
    selectedInnerGates: ['G7', 'G8', 'G15'],
    surge: {
      magnitude: 500,
      durationSeconds: 40,
      startSeconds: 10,
      affectedGates: ['E11', 'E12'],
      profile: 'pulse'
    },
    turnstileFailure: {
      innerGateId: 'G15',
      failedCounterCount: 2,
      startSeconds: 20,
      durationSeconds: 50
    },
    counterFlow: {
      inboundCount: 420,
      outboundCount: 50,
      intensityPercent: 0.10,
      startSeconds: 25,
      durationSeconds: 50,
      corridorWidthMeters: 10,
      separationAvailable: false
    },
    combinedEvents: [
      {
        id: 'evt_metro_pulse',
        name: 'Metro Pulse (+500 p/min at E11)',
        startSeconds: 10,
        durationSeconds: 40,
        type: 'SURGE',
        parameters: { magnitude: 500, gates: ['E11'] }
      },
      {
        id: 'evt_g15_choke',
        name: 'Bank G15 Turnstile 2-Counter Failure',
        startSeconds: 20,
        durationSeconds: 50,
        type: 'TURNSTILE_FAIL',
        parameters: { innerGate: 'G15', failedCount: 2 }
      },
      {
        id: 'evt_rejection_wave',
        name: 'Ticket Rejection Counter-Flow Wave',
        startSeconds: 25,
        durationSeconds: 50,
        type: 'COUNTER_FLOW',
        parameters: { intensity: 0.12 }
      }
    ]
  }
};

// Backward-compatible aliases for tests and legacy callers
(PRESET_SCENARIOS as any).NORMAL = PRESET_SCENARIOS.NORMAL_INGRESS;
(PRESET_SCENARIOS as any).SURGE = PRESET_SCENARIOS.METRO_SURGE;
(PRESET_SCENARIOS as any).GATE_FAILURE = PRESET_SCENARIOS.OUTER_GATE_FAILURE;
(PRESET_SCENARIOS as any).COUNTER_FLOW = PRESET_SCENARIOS.COUNTER_FLOW_SHOCK;

export class SyntheticDemandGenerator {
  /**
   * Resolves unified scenario configuration supporting both modern and legacy types.
   */
  public static resolveConfig(type: ScenarioType | ExperimentType): ScenarioConfig {
    if (type === 'NORMAL') return PRESET_SCENARIOS.NORMAL_INGRESS;
    if (type === 'SURGE') return PRESET_SCENARIOS.METRO_SURGE;
    if (type === 'GATE_FAILURE') return PRESET_SCENARIOS.OUTER_GATE_FAILURE;
    if (type === 'COUNTER_FLOW') return PRESET_SCENARIOS.COUNTER_FLOW_SHOCK;
    return PRESET_SCENARIOS[type as ScenarioType] || PRESET_SCENARIOS.NORMAL_INGRESS;
  }

  /**
   * Generates a fully deterministic, reproducible schedule of pedestrian arrivals.
   */
  public static generateSchedule(
    config: ScenarioConfig,
    sector: RoadSectorId = 'LINK_ROAD'
  ): ScheduledAgentArrival[] {
    const prng = new SeededPRNG(config.seed);
    const arrivals: ScheduledAgentArrival[] = [];
    const secData = KSCA_STADIUM_SECTORS[sector] || KSCA_STADIUM_SECTORS.LINK_ROAD;
    const outerGates = config.selectedOuterGates && config.selectedOuterGates.length > 0
      ? config.selectedOuterGates
      : secData.outerGates;

    const totalSeconds = config.durationSeconds;
    let agentCounter = 1;

    for (let sec = 0; sec < totalSeconds; sec++) {
      let currentRate = config.baseInflowRate;

      // 1. Surge handling (Scenario B or G)
      const surgeParams = config.surge;
      if (surgeParams) {
        const surgeStart = surgeParams.startSeconds;
        const surgeEnd = surgeStart + surgeParams.durationSeconds;
        if (sec >= surgeStart && sec <= surgeEnd) {
          if (surgeParams.profile === 'wave') {
            const progress = (sec - surgeStart) / (surgeEnd - surgeStart);
            const waveFactor = Math.sin(progress * Math.PI);
            currentRate += surgeParams.magnitude * waveFactor;
          } else {
            currentRate += surgeParams.magnitude;
          }
        }
      } else if (config.surgeMagnitude) {
        // Legacy fallback
        const surgeStart = 15;
        const surgeEnd = surgeStart + (config.surgeDurationSeconds || 30);
        if (sec >= surgeStart && sec <= surgeEnd) {
          const progress = (sec - surgeStart) / (surgeEnd - surgeStart);
          currentRate += config.surgeMagnitude * (config.surgeProfile === 'wave' ? Math.sin(progress * Math.PI) : 1.0);
        }
      }

      // 2. Poisson arrivals this second
      const expectedArrivalsThisSec = currentRate / 60;
      const count = this.samplePoisson(expectedArrivalsThisSec, prng);

      for (let i = 0; i < count; i++) {
        const timeFraction = prng.nextFloat();
        const arrivalTime = sec + timeFraction;

        // Choose outer gate
        let chosenOuterId = outerGates[Math.floor(prng.nextFloat() * outerGates.length)] || outerGates[0];
        let isRerouted = false;
        let originalGate: string | undefined = undefined;

        // 3. Gate Failure & Authorized Rerouting (Scenario C)
        const gateFail = config.gateFailure;
        if (gateFail && chosenOuterId === gateFail.failedGateId) {
          const failStart = gateFail.startSeconds;
          const failEnd = failStart + gateFail.durationSeconds;
          if (sec >= failStart && sec <= failEnd) {
            // Reroute ONLY to authorized connected alternatives
            const alts = gateFail.alternateGates.filter((g) => {
              const spec = GATE_CONNECTIVITY_CATALOG[g];
              return spec && spec.accessPermission !== 'RESTRICTED_VIP_MEDIA';
            });

            if (alts.length > 0) {
              originalGate = chosenOuterId;
              chosenOuterId = alts[Math.floor(prng.nextFloat() * alts.length)];
              isRerouted = true;
            }
          }
        }

        const outerGate = KSCA_OUTER_GATES[chosenOuterId] || KSCA_OUTER_GATES.E12;

        // Choose connected inner gate strictly from gateConnectivity
        const validInnerGates = getConnectedInnerGates(chosenOuterId);
        const innerId = validInnerGates.length > 0
          ? validInnerGates[Math.floor(prng.nextFloat() * validInnerGates.length)]
          : 'G8';

        // VIP/Media Access Check (Strict Queens Road Isolation)
        const gateSpec = GATE_CONNECTIVITY_CATALOG[chosenOuterId];
        const isRestricted = gateSpec?.accessPermission === 'RESTRICTED_VIP_MEDIA';
        const isVipMedia = isRestricted ? prng.nextFloat() < 0.05 : prng.nextFloat() < 0.02;

        // 4. Rejection simulation (Scenario E, F, or G)
        let isRejected = false;
        if (config.type === 'COUNTER_FLOW_SHOCK' || (config.type as string) === 'COUNTER_FLOW') {
          const startSec = config.counterFlow?.startSeconds ?? config.counterFlowStartSeconds ?? 5;
          const pct = config.counterFlow?.intensityPercent ?? config.counterFlowPercentage ?? 0.12;
          if (sec >= startSec) {
            isRejected = prng.nextFloat() < pct;
          }
        } else if (config.ticketRejection) {
          isRejected = prng.nextFloat() < config.ticketRejection.rejectionPercentage;
        }

        // Desired walking speed: N(walkingSpeed, 0.20) clamped [0.8, 2.2]
        const nominalSpeed = config.walkingSpeed || 1.34;
        const speed = Math.max(0.8, Math.min(2.2, prng.nextGaussian(nominalSpeed, 0.18)));

        // Outer approach spawn offset
        const lateralSpread = prng.nextRangeFloat(-16, 16);
        const startY = 525 + prng.nextRangeFloat(0, 20);

        arrivals.push({
          agentId: agentCounter++,
          timeSeconds: Math.round(arrivalTime * 100) / 100,
          targetOuterGate: chosenOuterId,
          targetInnerGate: innerId,
          sectorRoad: sector,
          isVipMedia,
          isRejected,
          isRerouted,
          originalGate,
          desiredSpeed: speed,
          spawnX: outerGate.x + lateralSpread,
          spawnY: startY
        });
      }
    }

    return arrivals.sort((a, b) => a.timeSeconds - b.timeSeconds);
  }

  /**
   * Knuth's Poisson random generator algorithm with SeededPRNG.
   */
  private static samplePoisson(lambda: number, prng: SeededPRNG): number {
    if (lambda <= 0) return 0;
    const L = Math.exp(-lambda);
    let k = 0;
    let p = 1.0;
    do {
      k++;
      p *= prng.nextFloat();
    } while (p > L && k < 40);
    return k - 1;
  }
}
