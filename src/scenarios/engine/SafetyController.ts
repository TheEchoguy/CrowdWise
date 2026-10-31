/**
 * CROWDWISE Predictive Crowd Digital Twin & Safety Lab
 * Explainable Rule-Based Safety Controller
 *
 * Evaluates live multi-zone telemetry, counterflow, and queue spillback
 * to produce actionable, explainable crowd management recommendations:
 * 1. Concourse arrival metering
 * 2. Auxiliary Gate B bypass activation
 * 3. Directional stanchions / inbound-outbound separation
 * 4. 40m upstream chicane baffle deployment
 * 5. Emergency admission holds
 */

import { CounterflowTelemetry, ThreeZoneTelemetry } from '../types/ScenarioTypes';

export interface SafetyRecommendationItem {
  readonly id: string;
  readonly severity: 'critical' | 'warning' | 'advisory' | 'optimal';
  readonly title: string;
  readonly reason: string;
  readonly actionText: string;
  readonly targetParameter?: string;
  readonly recommendedValue?: boolean | number;
}

export class SafetyController {
  public static evaluateConditions(
    zones: ThreeZoneTelemetry,
    counterflow: CounterflowTelemetry,
    auxGateActive: boolean,
    bafflesActive: boolean,
    dividerActive: boolean
  ): readonly SafetyRecommendationItem[] {
    const items: SafetyRecommendationItem[] = [];

    const gate = zones.gateApproach;
    const holding = zones.intermediateHolding;
    const upstream = zones.upstreamArrival;

    // 1. Critical Crush Zone Detection (>= 5.0 p/m²)
    if (gate.currentDensity >= 5.0 || holding.currentDensity >= 5.0 || upstream.currentDensity >= 5.0) {
      items.push({
        id: 'REC-01-CRUSH-RISK',
        severity: 'critical',
        title: 'CRITICAL CRUSH RISK DETECTED (>= 5.0 p/m²)',
        reason: `Local crowd density has entered Fruin LOS F (${zones.systemMaxDensity} p/m²). Compressive shockwaves may cause physical crowd collapse.`,
        actionText: 'Activate emergency perimeter metering and immediately hold new arrivals at concourse gates.',
        targetParameter: 'inflowRate',
        recommendedValue: 120
      });
    }

    // 2. Auxiliary Gate B Bypass Evaluation
    if (gate.currentDensity >= 4.0 && !auxGateActive) {
      items.push({
        id: 'REC-02-OPEN-GATE-B',
        severity: 'warning',
        title: 'Activate Gate 3 (Auxiliary Bypass B)',
        reason: `Gate Approach density is elevated at ${gate.currentDensity} p/m² with ${gate.waitingAgentsCount} waiting patrons. Opening Gate 3 diverts 45% of incoming crowd load.`,
        actionText: 'Open Gate 3 auxiliary bypass turnstiles.',
        targetParameter: 'auxGateActive',
        recommendedValue: true
      });
    }

    // 3. Upstream Shockwave & Chicane Baffles
    if (gate.spillbackMeters >= 20.0 && !bafflesActive) {
      items.push({
        id: 'REC-03-DEPLOY-BAFFLES',
        severity: 'warning',
        title: 'Deploy 40m Upstream Zigzag Baffles',
        reason: `Queue spillback has propagated ${gate.spillbackMeters.toFixed(1)}m upstream. Longitudinal shockwaves are compressing incoming arrivals.`,
        actionText: 'Erect zigzag crash barriers to stagger concourse wave propagation.',
        targetParameter: 'bafflesActive',
        recommendedValue: true
      });
    }

    // 4. Bidirectional Counterflow Shear
    if (counterflow.opposingFlowPercent >= 15.0 && !dividerActive) {
      items.push({
        id: 'REC-04-COUNTERFLOW-DIVIDER',
        severity: counterflow.capacityReductionPercent >= 25 ? 'critical' : 'warning',
        title: 'Deploy Central Lane Separation Barrier',
        reason: `Opposing pedestrian stream (${counterflow.opposingFlowPercent}%) has caused a ${counterflow.capacityReductionPercent}% capacity reduction due to head-on collision shear.`,
        actionText: 'Install physical central lane dividers to separate inbound and outbound laminar streams.',
        targetParameter: 'dividerActive',
        recommendedValue: true
      });
    }

    // 5. Concourse Arrival Rate Metering
    if (upstream.currentDensity >= 4.2 && upstream.queueLengthMeters >= 15.0) {
      items.push({
        id: 'REC-05-METER-INFLOW',
        severity: 'advisory',
        title: 'Meter Concourse Approach from Metro',
        reason: `Upstream concourse approach from Cubbon Park Metro station is saturating (${upstream.currentDensity} p/m²).`,
        actionText: 'Deploy marshals at MG Road / Cubbon Road perimeter gates to meter arrivals at 200 p/min.',
        targetParameter: 'inflowRate',
        recommendedValue: 200
      });
    }

    // 6. Optimal Operating State
    if (items.length === 0) {
      items.push({
        id: 'REC-06-LAMINAR-FLOW',
        severity: 'optimal',
        title: 'All Concourse Ingress Zones Stable',
        reason: `System maximum density is ${zones.systemMaxDensity} p/m² (LOS A/B). Turnstiles operating smoothly with acceptable queue depths.`,
        actionText: 'Maintain current operational configuration.'
      });
    }

    return items;
  }
}

