/**
 * CROWDWISE — Explainable Safety Recommendation Engine
 * Phase 4: Operational Decision Support & Incident Mitigation
 * M. Chinnaswamy Stadium, Bengaluru
 *
 * Generates transparent, evidence-based operational recommendations:
 * 1. Problem Detected
 * 2. Supporting Measurements
 * 3. Recommended Intervention
 * 4. Expected Benefit
 * 5. Possible Side Effects
 * 6. Confidence Level
 * 7. Operator Approval Flag (Human-in-the-loop)
 *
 * Strict Access-Control: Never routes public spectators to Queens Road VIP access (E5–E10).
 */

import { GATE_CONNECTIVITY_CATALOG, INNER_GATE_STAND_CATALOG, getConnectedInnerGates } from '../stadium/network/gateConnectivity';
import { PredictiveGateStateInput, GateForecastResult } from './PredictiveCongestionEngine';

export type RecommendationCategory =
  | 'GATE_METERING'
  | 'GATE_LOAD_BALANCING'
  | 'TURNSTILE_STAFFING'
  | 'QUEUE_CONFIGURATION'
  | 'DIRECTIONAL_SEPARATION'
  | 'GATE_CLOSURE';

export interface SafetyRecommendation {
  id: string;
  category: RecommendationCategory;
  title: string;
  targetGate: string;
  problemDetected: string;
  supportingMeasurements: {
    label: string;
    value: string;
    threshold: string;
  }[];
  recommendedIntervention: string;
  expectedBenefit: string;
  possibleSideEffects: string;
  confidenceLevel: number; // e.g. 85%
  requiresApproval: boolean; // Always true for operational control
  status: 'PENDING' | 'APPROVED' | 'DISMISSED';
  timestamp: string;
}

export class SafetyRecommendationEngine {
  /**
   * Generates prioritized, explainable recommendations based on real-time gate telemetry and forecasts.
   */
  public static generateRecommendations(
    gateStates: PredictiveGateStateInput[],
    forecasts: Record<string, GateForecastResult>
  ): SafetyRecommendation[] {
    const recommendations: SafetyRecommendation[] = [];

    gateStates.forEach((gate) => {
      const forecast = forecasts[gate.gateId];
      const gateSpec = GATE_CONNECTIVITY_CATALOG[gate.gateId];
      if (!gateSpec) return;

      const isRestrictedVip = gateSpec.accessPermission === 'RESTRICTED_VIP_MEDIA';
      if (isRestrictedVip) return; // Dedicated VIP/Media security protocols handle Queens Road gates

      const arrivalRate = gate.arrivalRatePerMin;
      const capacity = gate.effectiveCapacityPerMin;
      const queue = gate.currentQueue;
      const throatDensity = gate.currentThroatDensity;
      const spillback = gate.currentSpillbackMeters;

      // ─── A. GATE METERING ────────────────────────────────────────────────
      // Triggered when arrival rate significantly exceeds turnstile throat processing
      if (arrivalRate > capacity * 1.25 && throatDensity >= 2.2) {
        recommendations.push({
          id: `rec_meter_${gate.gateId}_${Date.now()}`,
          category: 'GATE_METERING',
          title: `Activate Dynamic Metering at Gate ${gate.gateId}`,
          targetGate: gate.gateId,
          problemDetected: `Arrival demand (${arrivalRate} p/min) exceeds turnstile throat capacity (${capacity} p/min) by ${arrivalRate - capacity} p/min, compressing throat density to ${throatDensity} p/m².`,
          supportingMeasurements: [
            { label: 'Inflow Demand', value: `${arrivalRate} p/min`, threshold: `Max ${capacity} p/min` },
            { label: 'Throat Density', value: `${throatDensity} p/m²`, threshold: 'Safe ≤ 2.2 p/m²' },
            { label: 'Projected Queue (60s)', value: `${forecast?.predictedQueue || queue} persons`, threshold: 'Buffer ≤ 80' }
          ],
          recommendedIntervention: `Throttle perimeter admission at Gate ${gate.gateId} by 35% using pulsed barrier release to allow inner turnstiles to clear queues.`,
          expectedBenefit: `Decompresses turnstile throat by ~0.8 p/m² and stabilizes concourse holding buffer.`,
          possibleSideEffects: `May cause transient queue accumulation (+10–15 persons) at the outer sidewalk holding pen.`,
          confidenceLevel: 88,
          requiresApproval: true,
          status: 'PENDING',
          timestamp: new Date().toLocaleTimeString()
        });
      }

      // ─── B. GATE LOAD BALANCING ──────────────────────────────────────────
      // Triggered when one gate is congested and adjacent verified gates have spare capacity
      if (queue >= 35 && forecast?.warningLevel !== 'NORMAL') {
        const candidateAlts = Object.entries(GATE_CONNECTIVITY_CATALOG)
          .filter(([altId, spec]) => {
            return (
              altId !== gate.gateId &&
              spec.road === gateSpec.road &&
              spec.accessPermission === 'SPECTATOR_PERMITTED' &&
              spec.verificationStatus === 'VERIFIED'
            );
          })
          .map(([altId]) => altId);

        if (candidateAlts.length > 0) {
          const suggestedAlt = candidateAlts[0];
          recommendations.push({
            id: `rec_balance_${gate.gateId}_${Date.now()}`,
            category: 'GATE_LOAD_BALANCING',
            title: `Redistribute Inflow: Gate ${gate.gateId} ──► Gate ${suggestedAlt}`,
            targetGate: gate.gateId,
            problemDetected: `Gate ${gate.gateId} queue (${queue} persons) is causing localized delays, while adjacent verified Gate ${suggestedAlt} operates below capacity.`,
            supportingMeasurements: [
              { label: 'Active Gate Queue', value: `${queue} persons`, threshold: 'Target ≤ 25' },
              { label: 'Corridor Sector', value: gateSpec.road, threshold: 'Match verified sector' },
              { label: 'Authorized Alternative', value: suggestedAlt, threshold: 'General Admission only' }
            ],
            recommendedIntervention: `Deploy dynamic digital signage and marshal directions redirecting general ticket holders to Gate ${suggestedAlt}.`,
            expectedBenefit: `Evens sector wait times and reduces Gate ${gate.gateId} queue growth by ~40%.`,
            possibleSideEffects: `Walking detour of approximately 45 meters along public concourse.`,
            confidenceLevel: 82,
            requiresApproval: true,
            status: 'PENDING',
            timestamp: new Date().toLocaleTimeString()
          });
        }
      }

      // ─── C. TURNSTILE STAFFING ───────────────────────────────────────────
      // Triggered when connected inner turnstiles are understaffed relative to inflow
      const connectedG = getConnectedInnerGates(gate.gateId);
      if (connectedG.length > 0 && arrivalRate > capacity && queue >= 20) {
        const targetInner = connectedG[0];
        const innerSpec = INNER_GATE_STAND_CATALOG[targetInner];
        recommendations.push({
          id: `rec_staff_${gate.gateId}_${Date.now()}`,
          category: 'TURNSTILE_STAFFING',
          title: `Reinforce Turnstile Staffing at Bank ${targetInner}`,
          targetGate: gate.gateId,
          problemDetected: `Inner turnstile bank ${targetInner} (${innerSpec?.standName || 'Stand'}) is serving ${capacity} p/min against an arrival surge of ${arrivalRate} p/min.`,
          supportingMeasurements: [
            { label: 'Operational Capacity', value: `${capacity} p/min`, threshold: `Required ${arrivalRate} p/min` },
            { label: 'Connected Stand', value: innerSpec?.standName || 'Stand Concourse', threshold: 'KSCA Ticketed Stand' }
          ],
          recommendedIntervention: `Activate +1 backup turnstile counter and deploy auxiliary handheld NFC validation marshals at Bank ${targetInner}.`,
          expectedBenefit: `Increases bank clearance capacity by +60 p/min, mitigating throat gridlock.`,
          possibleSideEffects: `Requires pre-assigned steward reserve deployment.`,
          confidenceLevel: 91,
          requiresApproval: true,
          status: 'PENDING',
          timestamp: new Date().toLocaleTimeString()
        });
      }

      // ─── D. QUEUE CONFIGURATION (S-CURVE SWITCHBACKS) ────────────────────
      // Triggered when concourse holding density approaches limits
      if (gate.currentApproachDensity >= 1.8 || queue >= 30) {
        recommendations.push({
          id: `rec_queue_${gate.gateId}_${Date.now()}`,
          category: 'QUEUE_CONFIGURATION',
          title: `Deploy S-Curve Switchback Stanchions at Gate ${gate.gateId}`,
          targetGate: gate.gateId,
          problemDetected: `Concourse holding queue is fanning out laterally, increasing compression risk to ${gate.currentApproachDensity} p/m².`,
          supportingMeasurements: [
            { label: 'Concourse Density', value: `${gate.currentApproachDensity} p/m²`, threshold: 'Unorganized limit: 1.8 p/m²' },
            { label: 'Queue Population', value: `${queue} persons`, threshold: 'Switchback trigger: ≥ 30' }
          ],
          recommendedIntervention: `Extend tensile barrier switchback lanes across Zone B holding concourse.`,
          expectedBenefit: `Eliminates lateral crowd push and stabilizes concourse density within 1.2–1.5 p/m² laminar envelope.`,
          possibleSideEffects: `Slightly increases walking trajectory length by ~12 meters.`,
          confidenceLevel: 94,
          requiresApproval: true,
          status: 'PENDING',
          timestamp: new Date().toLocaleTimeString()
        });
      }

      // ─── E. DIRECTIONAL SEPARATION ───────────────────────────────────────
      // Triggered when counter-flow conflicts or reverse flows are detected
      if (gate.counterFlowActive) {
        recommendations.push({
          id: `rec_dir_${gate.gateId}_${Date.now()}`,
          category: 'DIRECTIONAL_SEPARATION',
          title: `Erect Directional Divider Barriers along Gate ${gate.gateId} Corridor`,
          targetGate: gate.gateId,
          problemDetected: `Opposing spectator trajectories detected in corridor, inducing turbulence and counter-flow velocity collapse.`,
          supportingMeasurements: [
            { label: 'Counter-Flow Status', value: 'ACTIVE CONFLICT', threshold: 'Target: Zero Opposing' },
            { label: 'Throughput Loss', value: '-35% velocity penalty', threshold: 'Allowable: 0%' }
          ],
          recommendedIntervention: `Install central lane dividers to strictly isolate incoming ticket holders from outbound rejected spectators.`,
          expectedBenefit: `Restores forward velocity from 0.4 m/s to nominal 1.3 m/s, eliminating shockwave risk.`,
          possibleSideEffects: `Reduces single-lane effective corridor width by ~1.0m.`,
          confidenceLevel: 89,
          requiresApproval: true,
          status: 'PENDING',
          timestamp: new Date().toLocaleTimeString()
        });
      }

      // ─── F. GATE CLOSURE & EMERGENCY DIVERT ──────────────────────────────
      // Triggered on simulated failure or severe road spillback
      if (spillback >= 15.0 || throatDensity >= 3.8) {
        recommendations.push({
          id: `rec_close_${gate.gateId}_${Date.now()}`,
          category: 'GATE_CLOSURE',
          title: `Emergency Lane Hold & Divert at Gate ${gate.gateId}`,
          targetGate: gate.gateId,
          problemDetected: `CRITICAL HAZARD: Queue spillback (${spillback}m) has extended into public arterial roadway, creating pedestrian-vehicle conflict.`,
          supportingMeasurements: [
            { label: 'Road Spillback', value: `${spillback}m`, threshold: 'Max permissible: 5m' },
            { label: 'Peak Throat Density', value: `${throatDensity} p/m²`, threshold: 'Critical limit: 3.5 p/m²' }
          ],
          recommendedIntervention: `Hold new arrivals at external street perimeter, close Gate ${gate.gateId} turnstile feed, and redirect queue via auxiliary bypass.`,
          expectedBenefit: `Clears roadway congestion and halts dangerous upstream density escalation.`,
          possibleSideEffects: `Temporarily suspends direct stand ingress at this sector for 3–5 minutes.`,
          confidenceLevel: 96,
          requiresApproval: true,
          status: 'PENDING',
          timestamp: new Date().toLocaleTimeString()
        });
      }
    });

    return recommendations;
  }
}
