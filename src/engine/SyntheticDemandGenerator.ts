/**
 * CROWDWISE — Synthetic Demand & Scenario Generation Engine
 * Stage 1: Deterministic Multi-Scenario Crowd Generation
 *
 * Supports 4 Principal Experiments:
 * - NORMAL: Baseline steady ingress with standard gate allocations
 * - SURGE: High-volume pulse or step surge (e.g. Metro train dump)
 * - GATE_FAILURE: Disabled turnstile/counter causing queue spillback
 * - COUNTER_FLOW: Opposing pedestrian vectors (rejected ticket holders / reverse egress)
 */

import { RoadSectorId } from '../types/simulation';
import { SeededPRNG } from './prng';
import { KSCA_OUTER_GATES, KSCA_STADIUM_SECTORS } from './ChinnaswamyData';

export type ExperimentType = 'NORMAL' | 'SURGE' | 'GATE_FAILURE' | 'COUNTER_FLOW';

export interface ScenarioConfig {
  id: string;
  type: ExperimentType;
  name: string;
  description: string;
  seed: number;
  baseInflowRate: number; // people/minute
  durationSeconds: number;

  // Surge Parameters
  surgeMagnitude?: number; // e.g. +500 people/min
  surgeDurationSeconds?: number;
  surgeProfile?: 'step' | 'pulse' | 'wave';
  metroBurstOrigin?: boolean;

  // Failure Parameters
  failedGateId?: string;
  failedTurnstileCount?: number;
  failureLatencyMultiplier?: number;

  // Counter-Flow Parameters
  counterFlowPercentage?: number; // e.g. 0.08 (8%) to 0.25 (25%)
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
  desiredSpeed: number;
  spawnX: number;
  spawnY: number;
}

export const PRESET_SCENARIOS: Record<ExperimentType, ScenarioConfig> = {
  NORMAL: {
    id: 'exp_normal_baseline',
    type: 'NORMAL',
    name: 'Standard Gameday Ingress',
    description: 'Steady 360 p/m ingress distributed across active sector outer gates with 0.2s NFC and 3.5s frisking.',
    seed: 42,
    baseInflowRate: 360,
    durationSeconds: 120
  },
  SURGE: {
    id: 'exp_metro_surge',
    type: 'SURGE',
    name: 'Namma Metro Mass Transit Pulse',
    description: 'High-density +500 p/m surge wave arriving via MG Road / Cubbon Park Metro stations.',
    seed: 101,
    baseInflowRate: 360,
    surgeMagnitude: 500,
    surgeDurationSeconds: 45,
    surgeProfile: 'wave',
    metroBurstOrigin: true,
    durationSeconds: 120
  },
  GATE_FAILURE: {
    id: 'exp_gate_failure',
    type: 'GATE_FAILURE',
    name: 'Turnstile Gantry Scanner Failure',
    description: 'Hardware outage at primary inner gate reducing capacity by 65% and triggering severe queue spillback.',
    seed: 202,
    baseInflowRate: 420,
    failedGateId: 'G11',
    failedTurnstileCount: 2,
    failureLatencyMultiplier: 2.8,
    durationSeconds: 120
  },
  COUNTER_FLOW: {
    id: 'exp_counter_flow',
    type: 'COUNTER_FLOW',
    name: '8% Ticket Rejection Counter-Flow',
    description: 'Spectators rejected at inner turnstile throat reverse course against oncoming pedestrian streams.',
    seed: 303,
    baseInflowRate: 400,
    counterFlowPercentage: 0.12,
    counterFlowStartSeconds: 10,
    durationSeconds: 120
  }
};

export class SyntheticDemandGenerator {
  /**
   * Generates a fully deterministic, reproducible schedule of pedestrian arrivals
   */
  public static generateSchedule(
    config: ScenarioConfig,
    sector: RoadSectorId = 'LINK_ROAD'
  ): ScheduledAgentArrival[] {
    const prng = new SeededPRNG(config.seed);
    const arrivals: ScheduledAgentArrival[] = [];
    const secData = KSCA_STADIUM_SECTORS[sector] || KSCA_STADIUM_SECTORS.LINK_ROAD;
    const outerGates = secData.outerGates;

    const totalSeconds = config.durationSeconds;
    let agentCounter = 1;

    for (let sec = 0; sec < totalSeconds; sec++) {
      // Calculate instantaneous inflow rate for this second
      let currentRate = config.baseInflowRate;

      if (config.type === 'SURGE' && config.surgeMagnitude) {
        const surgeStart = 15;
        const surgeEnd = surgeStart + (config.surgeDurationSeconds || 30);
        if (sec >= surgeStart && sec <= surgeEnd) {
          if (config.surgeProfile === 'wave') {
            const progress = (sec - surgeStart) / (surgeEnd - surgeStart);
            const waveFactor = Math.sin(progress * Math.PI);
            currentRate += config.surgeMagnitude * waveFactor;
          } else {
            currentRate += config.surgeMagnitude;
          }
        }
      }

      const expectedArrivalsThisSec = currentRate / 60;
      // Poisson sampling using seeded PRNG
      const lambda = expectedArrivalsThisSec;
      const count = this.samplePoisson(lambda, prng);

      for (let i = 0; i < count; i++) {
        const timeFraction = prng.nextFloat();
        const arrivalTime = sec + timeFraction;

        // Choose outer gate from sector
        const chosenOuterId = outerGates[Math.floor(prng.nextFloat() * outerGates.length)] || outerGates[0];
        const outerGate = KSCA_OUTER_GATES[chosenOuterId] || KSCA_OUTER_GATES.E12;

        // Choose connected inner gate
        const connectedInner = outerGate.connectedInnerGates.filter((id) =>
          secData.innerGates.some((g) => g.id === id)
        );
        const innerId =
          connectedInner.length > 0
            ? connectedInner[Math.floor(prng.nextFloat() * connectedInner.length)]
            : secData.innerGates[0]?.id || 'G10';

        const isVipMedia = sector === 'QUEENS_ROAD' ? prng.nextFloat() < 0.08 : prng.nextFloat() < 0.03;

        // Counter-flow rejection candidate
        let isRejected = false;
        if (config.type === 'COUNTER_FLOW') {
          const startSec = config.counterFlowStartSeconds ?? 5;
          if (sec >= startSec) {
            isRejected = prng.nextFloat() < (config.counterFlowPercentage ?? 0.08);
          }
        }

        // Desired walking speed: N(1.34 m/s, 0.22 m/s) clamped [0.8, 2.0]
        const speed = Math.max(0.8, Math.min(2.0, prng.nextGaussian(1.34, 0.22)));

        // Outer approach spawn offset
        const lateralSpread = prng.nextRangeFloat(-15, 15);
        const startY = 525 + prng.nextRangeFloat(0, 20);

        arrivals.push({
          agentId: agentCounter++,
          timeSeconds: Math.round(arrivalTime * 100) / 100,
          targetOuterGate: chosenOuterId,
          targetInnerGate: innerId,
          sectorRoad: sector,
          isVipMedia,
          isRejected,
          desiredSpeed: speed,
          spawnX: outerGate.x + lateralSpread,
          spawnY: startY
        });
      }
    }

    // Sort chronologically
    return arrivals.sort((a, b) => a.timeSeconds - b.timeSeconds);
  }

  /**
   * Knuth's Poisson random generator algorithm with SeededPRNG
   */
  private static samplePoisson(lambda: number, prng: SeededPRNG): number {
    if (lambda <= 0) return 0;
    const L = Math.exp(-lambda);
    let k = 0;
    let p = 1.0;
    do {
      k++;
      p *= prng.nextFloat();
    } while (p > L && k < 30);
    return k - 1;
  }
}
