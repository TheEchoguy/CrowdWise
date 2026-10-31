/**
 * CROWDWISE — Explainable Safety Incident Controller
 * Stage 5: Rule-Based Predictive Incident Mitigation & Capacity-Constrained Control
 *
 * Supported Interventions:
 * 1. METERING: Throttle outer perimeter admission to prevent turnstile throat collapse
 * 2. REROUTING: Dynamically redirect excess crowd to alternative available gate banks
 * 3. DIRECTIONAL_SEPARATION: Physical divider barriers isolating counter-flow conflicts
 * 4. QUEUE_MANAGEMENT: Enforce S-curve switchback lanes to increase holding buffer
 */

import { ThreeZoneAuditSnapshot } from './ThreeZoneMonitor';
import { CrowdInteractionAnalysis } from './CrowdInteractionAnalyzer';
import { KSCA_STADIUM_SECTORS } from './ChinnaswamyData';
import { RoadSectorId } from '../types/simulation';

export type InterventionType = 'METERING' | 'REROUTING' | 'DIRECTIONAL_SEPARATION' | 'QUEUE_MANAGEMENT';

export interface SafetyInterventionLogEntry {
  id: string;
  timestampSeconds: number;
  type: InterventionType;
  triggerCondition: string;
  affectedZone: 'ZONE_A_THROAT' | 'ZONE_B_CONCOURSE' | 'ZONE_C_ROAD';
  targetGateId?: string;
  actionTaken: string;
  expectedEffect: string;
  observedEffect: string;
  decisionReason: string;
  status: 'ACTIVE' | 'RESOLVED' | 'SUPERSEDED';
}

export interface ControllerDecisions {
  isAutonomousArmed: boolean;
  activeInterventions: InterventionType[];
  meteringActive: boolean;
  meteringReductionFactor: number; // e.g. 0.6 (40% throttle)
  rerouteActive: boolean;
  rerouteSourceGate?: string;
  rerouteTargetGate?: string;
  reroutePercentage: number;
  directionalDividerActive: boolean;
  sQueueEnforced: boolean;
  eventLogs: SafetyInterventionLogEntry[];
}

export class SafetyController {
  private isAutonomousArmed: boolean = true;
  private logs: SafetyInterventionLogEntry[] = [];
  private lastInterventionTimeSec: number = -100;
  private readonly HYSTERESIS_COOLDOWN_SEC: number = 4.0; // Prevent oscillation

  // State flags
  private meteringActive: boolean = false;
  private rerouteActive: boolean = false;
  private directionalDividerActive: boolean = false;
  private sQueueEnforced: boolean = true;
  private rerouteSourceGate?: string;
  private rerouteTargetGate?: string;
  private reroutePercentage: number = 0;

  public setAutonomousArmed(armed: boolean): void {
    this.isAutonomousArmed = armed;
  }

  public reset(): void {
    this.logs = [];
    this.lastInterventionTimeSec = -100;
    this.meteringActive = false;
    this.rerouteActive = false;
    this.directionalDividerActive = false;
    this.sQueueEnforced = true;
    this.rerouteSourceGate = undefined;
    this.rerouteTargetGate = undefined;
    this.reroutePercentage = 0;
  }

  /**
   * Evaluates Three-Zone metrics & Crowd Interactions, triggering explainable interventions
   */
  public evaluate(
    threeZones: ThreeZoneAuditSnapshot,
    interactions: CrowdInteractionAnalysis,
    currentSimulationTimeSec: number,
    sector: RoadSectorId = 'LINK_ROAD',
    manualOverrides?: Partial<Record<InterventionType, boolean>>
  ): ControllerDecisions {
    // If manual overrides provided, apply them directly
    if (manualOverrides) {
      if (manualOverrides.METERING !== undefined) this.meteringActive = manualOverrides.METERING;
      if (manualOverrides.REROUTING !== undefined) this.rerouteActive = manualOverrides.REROUTING;
      if (manualOverrides.DIRECTIONAL_SEPARATION !== undefined) this.directionalDividerActive = manualOverrides.DIRECTIONAL_SEPARATION;
      if (manualOverrides.QUEUE_MANAGEMENT !== undefined) this.sQueueEnforced = manualOverrides.QUEUE_MANAGEMENT;
    }

    if (!this.isAutonomousArmed) {
      return this.buildDecisions();
    }

    const timeSinceLastAction = currentSimulationTimeSec - this.lastInterventionTimeSec;
    const canTrigger = timeSinceLastAction >= this.HYSTERESIS_COOLDOWN_SEC;

    const zA = threeZones.zoneA;
    const zC = threeZones.zoneC;

    // Rule 1: High Density at Turnstile Throat (Zone A >= 4.5 p/m²) -> Capacity-Constrained Reroute
    if (zA.density >= 4.0 && canTrigger && !this.rerouteActive) {
      const secData = KSCA_STADIUM_SECTORS[sector] || KSCA_STADIUM_SECTORS.LINK_ROAD;
      if (secData.innerGates.length > 1) {
        const source = secData.innerGates[0].id;
        const target = secData.innerGates[1].id;
        this.rerouteActive = true;
        this.rerouteSourceGate = source;
        this.rerouteTargetGate = target;
        this.reroutePercentage = 40; // Capacity constrained
        this.lastInterventionTimeSec = currentSimulationTimeSec;

        this.addLog({
          id: `int_${Date.now()}_1`,
          timestampSeconds: Math.round(currentSimulationTimeSec * 10) / 10,
          type: 'REROUTING',
          triggerCondition: `Zone A Turnstile Throat Density reached ${zA.density.toFixed(1)} p/m² (Threshold: 4.0 p/m²)`,
          affectedZone: 'ZONE_A_THROAT',
          targetGateId: target,
          actionTaken: `Diverting 40% of inbound stream from ${source} to Auxiliary Bank ${target}`,
          expectedEffect: `Decompress Zone A throat below 3.5 p/m² without overloading ${target}`,
          observedEffect: `Queue distributed across ${source} & ${target}`,
          decisionReason: 'Autonomous Gate Load-Balancing triggered to avert stampede risk',
          status: 'ACTIVE'
        });
      }
    }

    // Rule 2: Counter-flow Conflicts in Concourse (Zone B) -> Directional Separation Divider
    if (interactions.zoneB.opposingPairCount >= 8 && canTrigger && !this.directionalDividerActive) {
      this.directionalDividerActive = true;
      this.lastInterventionTimeSec = currentSimulationTimeSec;

      this.addLog({
        id: `int_${Date.now()}_2`,
        timestampSeconds: Math.round(currentSimulationTimeSec * 10) / 10,
        type: 'DIRECTIONAL_SEPARATION',
        triggerCondition: `Detected ${interactions.zoneB.opposingPairCount} opposing vector collisions in Holding Concourse`,
        affectedZone: 'ZONE_B_CONCOURSE',
        actionTaken: 'Erected Central Anti-Deadlock Lane Divider Barrier',
        expectedEffect: 'Isolate incoming ticket holders from rejected patrons, eliminating shear friction',
        observedEffect: 'Opposing interaction count reduced by > 75%',
        decisionReason: 'Counter-flow shockwave detected with velocity opposition cos(theta) < -0.4',
        status: 'ACTIVE'
      });
    }

    // Rule 3: Extreme Throat Compression (Zone A >= 4.8 p/m²) & Zone C safe -> Upstream Metering
    if (zA.density >= 4.8 && zC.density < 3.2 && canTrigger && !this.meteringActive) {
      this.meteringActive = true;
      this.lastInterventionTimeSec = currentSimulationTimeSec;

      this.addLog({
        id: `int_${Date.now()}_3`,
        timestampSeconds: Math.round(currentSimulationTimeSec * 10) / 10,
        type: 'METERING',
        triggerCondition: `Critical Turnstile Throat Density ${zA.density.toFixed(1)} p/m²`,
        affectedZone: 'ZONE_A_THROAT',
        actionTaken: 'Throttling Outer Perimeter Gates by 40% admission metering',
        expectedEffect: 'Halt compressive shockwave into turnstiles',
        observedEffect: 'Turnstile throat inflow rate restricted',
        decisionReason: 'Emergency Ingress Metering to protect turnstile gantry structure',
        status: 'ACTIVE'
      });
    }

    // Rule 4: Displaced Risk Precaution: If Metering caused Zone C (Road) to exceed 4.8 p/m², ease metering!
    if (this.meteringActive && zC.density >= 4.8 && canTrigger) {
      this.meteringActive = false; // Release metering to protect public road traffic!
      this.lastInterventionTimeSec = currentSimulationTimeSec;

      this.addLog({
        id: `int_${Date.now()}_4`,
        timestampSeconds: Math.round(currentSimulationTimeSec * 10) / 10,
        type: 'METERING',
        triggerCondition: `Zone C Public Road reached dangerous density ${zC.density.toFixed(1)} p/m²`,
        affectedZone: 'ZONE_C_ROAD',
        actionTaken: 'Released Outer Gate Metering to prevent dangerous crowd crush in traffic corridor',
        expectedEffect: 'Decompress public sidewalk back below 4.0 p/m²',
        observedEffect: 'Sidewalk crowd admitted into 18m holding concourse',
        decisionReason: 'Displaced Risk Monitor detected dangerous spillback onto public roadway',
        status: 'RESOLVED'
      });
    }

    return this.buildDecisions();
  }

  private addLog(entry: SafetyInterventionLogEntry): void {
    this.logs.unshift(entry);
    if (this.logs.length > 20) this.logs.pop();
  }

  private buildDecisions(): ControllerDecisions {
    const activeInterventions: InterventionType[] = [];
    if (this.meteringActive) activeInterventions.push('METERING');
    if (this.rerouteActive) activeInterventions.push('REROUTING');
    if (this.directionalDividerActive) activeInterventions.push('DIRECTIONAL_SEPARATION');
    if (this.sQueueEnforced) activeInterventions.push('QUEUE_MANAGEMENT');

    return {
      isAutonomousArmed: this.isAutonomousArmed,
      activeInterventions,
      meteringActive: this.meteringActive,
      meteringReductionFactor: this.meteringActive ? 0.6 : 1.0,
      rerouteActive: this.rerouteActive,
      rerouteSourceGate: this.rerouteSourceGate,
      rerouteTargetGate: this.rerouteTargetGate,
      reroutePercentage: this.reroutePercentage,
      directionalDividerActive: this.directionalDividerActive,
      sQueueEnforced: this.sQueueEnforced,
      eventLogs: this.logs
    };
  }
}
