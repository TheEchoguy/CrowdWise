/**
 * CROWDWISE — 21-Gate Stadium Network Simulation Engine
 * Venue: M. Chinnaswamy Stadium, Bengaluru (35,000 Capacity)
 *
 * Implements independent, multi-gate macro simulation for all 21 stadium gates:
 * 1. Independent queueing, approach accumulation, and turnstile processing per gate.
 * 2. Uncoupled congestion: Bottlenecks at Gate 1 do not spill to Gate 2 unless rerouted.
 * 3. Reserved gate protection: Zero ordinary public demand processed at G4, G9, G13, G20.
 * 4. Safe alternative gate routing: Validates ticket authorization, stand connection,
 *    and downstream approach capacity before diverting.
 * 5. Strict spectator accounting: Invariant conservation holding across all 21 gates.
 */

import {
  STADIUM_21_GATES,
  STADIUM_21_GATES_BY_ID,
  StadiumGateDefinition
} from '../data/stadium21GateConfig';
import {
  StadiumSpectatorRecord,
  TicketAllocationEngine,
  TicketAllocationOptions,
  TicketAllocationResult
} from './TicketAllocationEngine';

export type GateCongestionLevel = 'normal' | 'moderate' | 'high' | 'critical';

export interface GateTurnstileChannel {
  readonly channelIndex: number;
  operational: boolean;
  cooldownRemainingSec: number;
  totalAdmitted: number;
}

export interface GateLiveState {
  readonly gateDefinition: StadiumGateDefinition;
  readonly gateId: string;
  readonly gateNumber: number;
  assignedDemand: number;
  remainingArrivals: number;
  currentQueue: number;
  totalAdmitted: number;
  queueLengthMeters: number;
  localDensity: number;               // People / m² in gate approach
  rollingThroughputPerMin: number;    // Rolling 60s admissions
  estimatedWaitTimeSec: number;       // Current queue drain time
  congestionState: GateCongestionLevel;
  channels: GateTurnstileChannel[];
  recentAdmissionsTimestampsSec: number[];
}

export interface StadiumNetworkSummary {
  readonly totalSpectators: number;
  readonly totalInjected: number;
  readonly totalAdmitted: number;
  readonly totalQueued: number;
  readonly totalRemaining: number;
  readonly activeInSimulation: number;
  readonly currentSimTimeSec: number;
  readonly isArrivalComplete: boolean;
  readonly gateStates: Record<string, GateLiveState>;
}

export class StadiumNetworkEngine {
  private allocation: TicketAllocationResult;
  private spectators: StadiumSpectatorRecord[];
  private currentSimTimeSec: number = 0;
  private schedulePointer: number = 0;

  // Independent Gate State Map for all 21 gates
  private gateStates: Map<string, GateLiveState> = new Map();

  // Active queues of spectators waiting outside each gate
  private gateQueues: Map<string, StadiumSpectatorRecord[]> = new Map();

  constructor(optionsOrAllocation: TicketAllocationOptions | TicketAllocationResult) {
    if ('spectators' in optionsOrAllocation) {
      this.allocation = optionsOrAllocation;
    } else {
      this.allocation = TicketAllocationEngine.allocateTickets(optionsOrAllocation);
    }
    // Deep copy spectators so simulation state can mutate cleanly
    this.spectators = this.allocation.spectators.map((s) => ({ ...s }));
    this.initializeGateStates();
  }

  private initializeGateStates(): void {
    this.gateStates.clear();
    this.gateQueues.clear();

    for (const gate of STADIUM_21_GATES) {
      const assignedDemand = this.allocation.gateAllocations[gate.id]?.assignedCount ?? 0;
      const channels: GateTurnstileChannel[] = [];
      const turnstiles = gate.turnstileCount;

      for (let c = 0; c < turnstiles; c++) {
        channels.push({
          channelIndex: c,
          operational: true,
          cooldownRemainingSec: 0,
          totalAdmitted: 0
        });
      }

      this.gateStates.set(gate.id, {
        gateDefinition: gate,
        gateId: gate.id,
        gateNumber: gate.gateNumber,
        assignedDemand,
        remainingArrivals: assignedDemand,
        currentQueue: 0,
        totalAdmitted: 0,
        queueLengthMeters: 0,
        localDensity: 0.2,
        rollingThroughputPerMin: 0,
        estimatedWaitTimeSec: 0,
        congestionState: 'normal',
        channels,
        recentAdmissionsTimestampsSec: []
      });

      this.gateQueues.set(gate.id, []);
    }
  }

  /**
   * Advances simulation by dt seconds:
   * 1. Injects scheduled arrivals into each gate's independent queue.
   * 2. Processes discrete turnstile admissions for each gate.
   * 3. Calculates independent queue lengths, waiting times, and congestion levels.
   */
  public step(dt: number): StadiumSpectatorRecord[] {
    if (dt <= 0) return [];
    this.currentSimTimeSec += dt;

    // 1. Ingest newly arrived spectators whose arrivalTimeSimSec <= currentSimTimeSec
    const newlyInjected: StadiumSpectatorRecord[] = [];
    const len = this.spectators.length;

    while (
      this.schedulePointer < len &&
      this.spectators[this.schedulePointer].arrivalTimeSimSec <= this.currentSimTimeSec
    ) {
      const spec = this.spectators[this.schedulePointer];
      spec.currentZoneId = 'zone-2'; // Enter intermediate approach queue
      newlyInjected.push(spec);

      const targetGateQueue = this.gateQueues.get(spec.currentGateId);
      if (targetGateQueue) {
        targetGateQueue.push(spec);
      }

      const gState = this.gateStates.get(spec.currentGateId);
      if (gState && gState.remainingArrivals > 0) {
        gState.remainingArrivals--;
      }

      this.schedulePointer++;
    }

    // 2. Process turnstiles for each of the 21 gates independently
    const cutoffTime = this.currentSimTimeSec - 60;

    for (const [gateId, gState] of this.gateStates.entries()) {
      // Prune rolling admissions older than 60s
      while (
        gState.recentAdmissionsTimestampsSec.length > 0 &&
        gState.recentAdmissionsTimestampsSec[0] < cutoffTime
      ) {
        gState.recentAdmissionsTimestampsSec.shift();
      }

      // Decrement turnstile cooldowns
      for (const channel of gState.channels) {
        if (channel.cooldownRemainingSec > 0) {
          channel.cooldownRemainingSec = Math.max(0, channel.cooldownRemainingSec - dt);
        }
      }

      // Reserved gates do not admit ordinary public spectators
      if (!gState.gateDefinition.publicEntryEligible) {
        gState.currentQueue = this.gateQueues.get(gateId)?.length || 0;
        continue;
      }

      // Process turnstile admissions from gate queue
      const queue = this.gateQueues.get(gateId);
      if (queue && queue.length > 0) {
        for (const channel of gState.channels) {
          if (channel.operational && channel.cooldownRemainingSec <= 0 && queue.length > 0) {
            const admittedSpectator = queue.shift()!;
            admittedSpectator.currentZoneId = 'admitted';

            channel.cooldownRemainingSec = gState.gateDefinition.defaultLatencySec;
            channel.totalAdmitted++;
            gState.totalAdmitted++;
            gState.recentAdmissionsTimestampsSec.push(this.currentSimTimeSec);
          }
        }
      }

      // Update independent gate metrics
      const currentQueueLen = queue ? queue.length : 0;
      gState.currentQueue = currentQueueLen;

      // Queue depth: patrons queue in parallel lanes (assuming 1.5m spacing per person)
      const lanes = Math.max(1, gState.gateDefinition.turnstileCount);
      gState.queueLengthMeters = Math.round((currentQueueLen / lanes) * 1.5 * 10) / 10;

      // Local density estimate: approach holding area (assumed ~80m² approach zone)
      const approachAreaM2 = 80;
      const density = Math.min(6.5, Math.max(0.2, (currentQueueLen * 0.4) / (approachAreaM2 * 0.2) + 0.2));
      gState.localDensity = Math.round(density * 10) / 10;

      // Rolling throughput in persons / minute
      gState.rollingThroughputPerMin = gState.recentAdmissionsTimestampsSec.length;

      // Waiting time: queue divided by max discharge capacity (simulated)
      const operationalLanes = gState.channels.filter((c) => c.operational).length;
      const dischargePerSec = operationalLanes > 0
        ? operationalLanes / gState.gateDefinition.defaultLatencySec
        : 0.001;
      gState.estimatedWaitTimeSec = Math.round(currentQueueLen / dischargePerSec);

      // Congestion state threshold classification
      if (gState.localDensity >= 5.0 || gState.estimatedWaitTimeSec >= 300) {
        gState.congestionState = 'critical';
      } else if (gState.localDensity >= 4.0 || gState.estimatedWaitTimeSec >= 180) {
        gState.congestionState = 'high';
      } else if (gState.localDensity >= 2.5 || gState.estimatedWaitTimeSec >= 60) {
        gState.congestionState = 'moderate';
      } else {
        gState.congestionState = 'normal';
      }
    }

    return newlyInjected;
  }

  /**
   * Evaluates and applies a safe alternative gate diversion for a queued spectator:
   * 1. Target gate must be in spectator.authorizedGateIds.
   * 2. Target gate must connect to spectator.assignedStandId.
   * 3. Target gate must be public and not in 'critical' congestion.
   *
   * @param spectatorId Unique ID of spectator to reroute
   * @param targetGateId Intended alternative gate ID
   * @returns true if safely rerouted; false if rejected by safety rules
   */
  public attemptSafeReroute(spectatorId: string, targetGateId: string): boolean {
    const targetGate = STADIUM_21_GATES_BY_ID[targetGateId];
    if (!targetGate || !targetGate.publicEntryEligible) {
      return false; // Cannot divert to reserved or non-existent gate
    }

    const targetState = this.gateStates.get(targetGateId);
    if (!targetState || targetState.congestionState === 'critical') {
      return false; // Cannot divert into a critical crush hazard
    }

    // Locate spectator in current gate queue
    for (const [sourceGateId, queue] of this.gateQueues.entries()) {
      const idx = queue.findIndex((s) => s.spectatorId === spectatorId);
      if (idx !== -1) {
        const spec = queue[idx];

        // RULE: Stand entitlement is fixed and immutable
        // Verify target gate serves the assigned stand
        if (!targetGate.connectedStandIds.includes(spec.assignedStandId)) {
          return false;
        }

        // Verify ticket authorizes this gate
        if (!spec.authorizedGateIds.includes(targetGateId)) {
          return false;
        }

        // Remove from source queue and insert into target queue
        queue.splice(idx, 1);
        spec.currentGateId = targetGateId;
        spec.currentRouteId = `diverted-from-${sourceGateId}-to-${targetGateId}`;
        spec.isRerouted = true;

        this.gateQueues.get(targetGateId)?.push(spec);

        // Synchronize live queue states immediately
        const srcState = this.gateStates.get(sourceGateId);
        if (srcState) {
          srcState.currentQueue = queue.length;
        }
        targetState.currentQueue = this.gateQueues.get(targetGateId)?.length ?? 0;

        return true;
      }
    }

    return false;
  }

  /**
   * Convenience helper to divert the first waiting spectator from sourceGateId to targetGateId.
   */
  public divertSpectator(sourceGateId: string, targetGateId: string): boolean {
    const queue = this.gateQueues.get(sourceGateId);
    if (!queue || queue.length === 0) return false;
    const spec = queue[0];
    return this.attemptSafeReroute(spec.spectatorId, targetGateId);
  }

  /**
   * Sets operational lane override for any gate (e.g. simulating scanner failure).
   */
  public setGateOperationalLanes(gateId: string, operationalCount: number): void {
    const gState = this.gateStates.get(gateId);
    if (!gState) return;

    const op = Math.max(0, Math.min(gState.gateDefinition.turnstileCount, operationalCount));
    for (let i = 0; i < gState.channels.length; i++) {
      gState.channels[i].operational = i < op;
    }
  }

  /**
   * Returns complete network summary and conservation status.
   */
  public getNetworkSummary(): StadiumNetworkSummary {
    let totalInjected = this.schedulePointer;
    let totalAdmitted = 0;
    let totalQueued = 0;
    let totalRemaining = 0;

    const gateStatesObj: Record<string, GateLiveState> = {};
    for (const [id, state] of this.gateStates.entries()) {
      gateStatesObj[id] = state;
      totalAdmitted += state.totalAdmitted;
      totalQueued += state.currentQueue;
      totalRemaining += state.remainingArrivals;
    }

    const activeInSim = totalQueued;

    return {
      totalSpectators: this.allocation.totalSpectators,
      totalInjected,
      totalAdmitted,
      totalQueued,
      totalRemaining,
      activeInSimulation: activeInSim,
      currentSimTimeSec: Math.round(this.currentSimTimeSec * 10) / 10,
      isArrivalComplete: this.schedulePointer >= this.spectators.length,
      gateStates: gateStatesObj
    };
  }

  /**
   * Returns individual gate state by gateNumber (1..21) or id ('gate-1'..'gate-21').
   */
  public getGateState(gateIdOrNumber: string | number): GateLiveState | undefined {
    if (typeof gateIdOrNumber === 'number') {
      const gate = STADIUM_21_GATES.find((g) => g.gateNumber === gateIdOrNumber);
      return gate ? this.gateStates.get(gate.id) : undefined;
    }
    return this.gateStates.get(gateIdOrNumber);
  }

  /**
   * Returns the underlying spectator population.
   */
  public getSpectators(): readonly StadiumSpectatorRecord[] {
    return this.spectators;
  }

  /**
   * Returns current simulation elapsed time in seconds.
   */
  public getCurrentSimTimeSec(): number {
    return this.currentSimTimeSec;
  }

  /**
   * Resets simulation time, schedule pointer, queues, and turnstiles while preserving allocation.
   */
  public reset(): void {
    this.currentSimTimeSec = 0;
    this.schedulePointer = 0;
    this.spectators = this.allocation.spectators.map((s) => ({ ...s }));
    this.initializeGateStates();
  }
}
