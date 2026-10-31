/**
 * CROWDWISE Predictive Crowd Digital Twin & Safety Lab
 * Scenario Engine: Orchestrator & Multi-Lane Gate Controller (Phase 3)
 *
 * Independent, headless orchestrator responsible for:
 * 1. Managing discrete multi-lane turnstile channels per gate
 * 2. Enforcing gate availability (closed gates reject entry and hold queues)
 * 3. Controlled chronological injection of immutable pre-generated arrival schedules
 * 4. Strict population accounting (injected, admitted, queued, active)
 * 5. Simulation lifecycle (pause, resume, step, reset)
 */

import {
  GateLaneConfig,
  PreGeneratedAgentDescriptor,
  PreGeneratedArrivalSchedule,
  SyntheticEventData
} from '../types/ScenarioTypes';

export interface TurnstileChannelState {
  readonly laneIndex: number;
  operational: boolean;        // true if functional, false if down/locked
  cooldownRemainingSec: number;// seconds until this turnstile can process next patron
  totalProcessed: number;      // total pedestrians admitted through this turnstile
}

export interface GateState {
  readonly gateId: string;
  readonly name: string;
  readonly totalLanes: number;
  readonly operationalLanes: number;
  readonly turnstileLatencySec: number;
  readonly channels: TurnstileChannelState[];
  totalPassed: number;
}

export interface PopulationAccounting {
  readonly totalScheduled: number;
  readonly totalInjected: number;
  readonly totalInboundInjected: number;
  readonly totalOutboundInjected: number;
  readonly totalAdmitted: number;          // Inbound turnstile clearances
  readonly totalOutboundExited: number;    // Outbound perimeter exits
  readonly activeInSimulation: number;     // Active inbound + active outbound
  readonly activeInbound: number;          // Active inbound moving north
  readonly activeOutbound: number;         // Active outbound moving south
  readonly representedAdmitted: number;
}

export interface InflowChangeRecord {
  readonly simTimeSec: number;
  readonly repInflowRate: number;
  readonly scalingMultiplier: number;
}

export class ScenarioEngine {
  private event: SyntheticEventData;
  private schedule: PreGeneratedArrivalSchedule;
  private gates: Map<string, GateState> = new Map();

  private currentSimTimeSec: number = 0;
  private scheduleVirtualTimeSec: number = 0;
  private schedulePointer: number = 0;
  private totalAdmittedCount: number = 0;
  private totalInboundInjectedCount: number = 0;
  private totalOutboundInjectedCount: number = 0;
  private totalOutboundExitedCount: number = 0;
  private recentAdmissionsTimestampsSec: number[] = []; // rolling 60s window

  // Dynamic Demand Control (Represented spectators / minute)
  private dynamicInflowRateRepPerMin: number = 0;
  private nominalPeakArrivalRateReal: number = 0;
  private inflowChangeHistory: InflowChangeRecord[] = [];

  constructor(event: SyntheticEventData, schedule: PreGeneratedArrivalSchedule) {
    this.event = event;
    this.schedule = schedule;
    this.initializeGates(event.gates);
    this.initializeInflowRate();
  }

  private initializeInflowRate(): void {
    const nominal = this.event.peak_arrival_rate_real > 0
      ? this.event.peak_arrival_rate_real
      : Math.round(this.event.expected_attendance / Math.max(1, this.event.arrival_end_time_min - this.event.arrival_start_time_min));
    this.nominalPeakArrivalRateReal = Math.max(300, nominal);
    this.dynamicInflowRateRepPerMin = this.nominalPeakArrivalRateReal;
    this.inflowChangeHistory = [{
      simTimeSec: 0,
      repInflowRate: this.dynamicInflowRateRepPerMin,
      scalingMultiplier: 1.0
    }];
  }

  /**
   * Initializes discrete turnstile channel states for each gate.
   * Exactly operationalLanes channels are flagged operational.
   * The remaining (totalLanes - operationalLanes) channels are locked/failed.
   */
  private initializeGates(gateConfigs: Record<string, GateLaneConfig>): void {
    this.gates.clear();

    for (const [key, cfg] of Object.entries(gateConfigs)) {
      const channels: TurnstileChannelState[] = [];
      const total = Math.max(0, cfg.totalLanes);
      const operational = Math.max(0, Math.min(total, cfg.operationalLanes));

      for (let i = 0; i < total; i++) {
        channels.push({
          laneIndex: i,
          operational: i < operational, // First operational lanes are functional, rest failed
          cooldownRemainingSec: 0,
          totalProcessed: 0
        });
      }

      this.gates.set(key, {
        gateId: cfg.gateId,
        name: cfg.name,
        totalLanes: total,
        operationalLanes: operational,
        turnstileLatencySec: Math.max(0.1, cfg.turnstileLatencySec),
        channels,
        totalPassed: 0
      });
    }
  }

  /**
   * Updates gate turnstile channels and advances schedule injection by dt simulation seconds.
   * Returns descriptors of all agents scheduled to spawn in this time step.
   *
   * @param dt Elapsed physical simulation seconds
   */
  public step(dt: number): PreGeneratedAgentDescriptor[] {
    if (dt <= 0) return [];

    // 1. Advance physical simulation time
    this.currentSimTimeSec += dt;

    // 2. Advance schedule virtual time with dynamic demand pacing multiplier
    const demandMultiplier = this.nominalPeakArrivalRateReal > 0
      ? this.dynamicInflowRateRepPerMin / this.nominalPeakArrivalRateReal
      : 1.0;
    this.scheduleVirtualTimeSec += dt * demandMultiplier;

    // 3. Decrement cooldown timers across all turnstile channels
    for (const gate of this.gates.values()) {
      for (const channel of gate.channels) {
        if (channel.cooldownRemainingSec > 0) {
          channel.cooldownRemainingSec = Math.max(0, channel.cooldownRemainingSec - dt);
        }
      }
    }

    // 4. Prune rolling admissions older than 60 simulation seconds
    const cutoffTime = this.currentSimTimeSec - 60;
    while (
      this.recentAdmissionsTimestampsSec.length > 0 &&
      this.recentAdmissionsTimestampsSec[0] < cutoffTime
    ) {
      this.recentAdmissionsTimmissionsShift();
    }

    // 5. Ingest scheduled agents whose spawn time has arrived
    const newlySpawned: PreGeneratedAgentDescriptor[] = [];
    const descriptors = this.schedule.schedule;
    const len = descriptors.length;

    while (
      this.schedulePointer < len &&
      descriptors[this.schedulePointer].spawnTimeSimSec <= this.scheduleVirtualTimeSec
    ) {
      newlySpawned.push(descriptors[this.schedulePointer]);
      this.schedulePointer++;
    }

    return newlySpawned;
  }

  private recentAdmissionsTimmissionsShift(): void {
    this.recentAdmissionsTimestampsSec.shift();
  }

  /**
   * Attempts to pass a pedestrian through a gate turnstile channel.
   *
   * CRITICAL SAFETY & ACCOUNTING RULES:
   * 1. If gate has 0 operational lanes (closed), entry is unconditionally rejected.
   * 2. Population conservation: cannot admit more patrons than active in simulation.
   * 3. If all operational channels are on cooldown, entry is rejected (queued).
   * 4. If an idle operational channel exists, admission is granted:
   *    - Channel enters cooldown for turnstileLatencySec.
   *    - Admission counters are incremented.
   *    - Agent is cleared.
   *
   * @returns true if admitted, false if rejected (stalled outside gate)
   */
  public attemptGatePassage(gateId: string): boolean {
    const gate = this.gates.get(gateId);
    if (!gate) return false;

    // If gate has 0 operational lanes, entry is impossible
    if (gate.operationalLanes <= 0) {
      return false;
    }

    // Population conservation check: cannot admit more patrons than active inbound in simulation
    const activeInbound = this.totalInboundInjectedCount > 0
      ? this.totalInboundInjectedCount - this.totalAdmittedCount
      : this.schedulePointer - this.totalAdmittedCount;

    if (activeInbound <= 0) {
      return false;
    }

    // Look for first idle operational channel
    for (const channel of gate.channels) {
      if (channel.operational && channel.cooldownRemainingSec <= 0) {
        // Admit pedestrian
        channel.cooldownRemainingSec = gate.turnstileLatencySec;
        channel.totalProcessed++;
        gate.totalPassed++;
        this.totalAdmittedCount++;
        this.recentAdmissionsTimestampsSec.push(this.currentSimTimeSec);
        return true;
      }
    }

    // All channels busy
    return false;
  }

  /**
   * Returns true when all scheduled arrivals have been injected into simulation.
   */
  public isArrivalComplete(): boolean {
    return this.schedulePointer >= this.schedule.schedule.length;
  }

  /**
   * Registers an inbound agent when instantiated on canvas.
   */
  public recordInboundInjected(count: number = 1): void {
    this.totalInboundInjectedCount += count;
  }

  /**
   * Registers an outbound counterflow agent when instantiated on canvas.
   */
  public recordOutboundInjected(count: number = 1): void {
    this.totalOutboundInjectedCount += count;
  }

  /**
   * Registers an outbound counterflow agent exiting the south concourse boundary.
   * Decrements active outbound count without affecting inbound turnstile admissions.
   */
  public recordOutboundExit(): void {
    this.totalOutboundExitedCount++;
  }

  /**
   * Sets dynamic inflow rate in represented spectators per minute.
   * Paces future arrivals proportionally without mutating or dropping scheduled descriptors.
   */
  public setDynamicInflowRate(repPerMin: number): void {
    const clamped = Math.max(300, Math.min(3600, repPerMin));
    if (Math.abs(clamped - this.dynamicInflowRateRepPerMin) > 0.01) {
      this.dynamicInflowRateRepPerMin = clamped;
      const multiplier = this.nominalPeakArrivalRateReal > 0
        ? this.dynamicInflowRateRepPerMin / this.nominalPeakArrivalRateReal
        : 1.0;
      this.inflowChangeHistory.push({
        simTimeSec: Math.round(this.currentSimTimeSec * 10) / 10,
        repInflowRate: clamped,
        scalingMultiplier: Math.round(multiplier * 100) / 100
      });
    }
  }

  /**
   * Returns current effective simulated inflow rate (simulated agents / minute).
   */
  public getSimulatedInflowRatePerMin(): number {
    return Math.round((this.dynamicInflowRateRepPerMin / this.schedule.populationScalingRatio) * 10) / 10;
  }

  /**
   * Returns current represented inflow rate (represented spectators / minute).
   */
  public getRepresentedInflowRatePerMin(): number {
    return this.dynamicInflowRateRepPerMin;
  }

  /**
   * Returns current virtual schedule time in seconds.
   */
  public getScheduleVirtualTimeSec(): number {
    return this.scheduleVirtualTimeSec;
  }

  /**
   * Returns complete history of dynamic inflow rate changes.
   */
  public getInflowChangeHistory(): readonly InflowChangeRecord[] {
    return this.inflowChangeHistory;
  }

  /**
   * Overrides the operational lanes for a gate (e.g. when opening Gate B as an intervention
   * or simulating hardware failure).
   */
  public setGateOperationalLanes(gateId: string, operationalLanes: number): void {
    const gate = this.gates.get(gateId);
    if (!gate) return;

    const op = Math.max(0, Math.min(gate.totalLanes, operationalLanes));
    (gate as { operationalLanes: number }).operationalLanes = op;

    for (let i = 0; i < gate.channels.length; i++) {
      gate.channels[i].operational = i < op;
    }
  }

  /**
   * Sets latency for a gate (e.g. bag check slowdown).
   */
  public setGateLatency(gateId: string, latencySec: number): void {
    const gate = this.gates.get(gateId);
    if (!gate) return;
    (gate as { turnstileLatencySec: number }).turnstileLatencySec = Math.max(0.1, latencySec);
  }

  /**
   * Returns current population accounting.
   */
  public getAccounting(): PopulationAccounting {
    const hasExplicitCounts = this.totalInboundInjectedCount > 0 || this.totalOutboundInjectedCount > 0;
    const totalInboundInjected = hasExplicitCounts
      ? this.totalInboundInjectedCount
      : this.schedulePointer;
    const totalOutboundInjected = this.totalOutboundInjectedCount;
    const totalInjected = hasExplicitCounts
      ? (totalInboundInjected + totalOutboundInjected)
      : this.schedulePointer;
    const totalAdmitted = this.totalAdmittedCount;
    const totalOutboundExited = this.totalOutboundExitedCount;
    const activeInbound = Math.max(0, totalInboundInjected - totalAdmitted);
    const activeOutbound = Math.max(0, totalOutboundInjected - totalOutboundExited);
    const activeInSim = activeInbound + activeOutbound;
    const repAdmitted = Math.round(totalAdmitted * this.schedule.populationScalingRatio);

    return {
      totalScheduled: this.schedule.totalAgentsToSpawn,
      totalInjected,
      totalInboundInjected,
      totalOutboundInjected,
      totalAdmitted,
      totalOutboundExited,
      activeInSimulation: activeInSim,
      activeInbound,
      activeOutbound,
      representedAdmitted: repAdmitted
    };
  }

  /**
   * Returns rolling 60s throughput in simulated agents per minute.
   */
  public getObservedThroughputSimPerMin(): number {
    return this.recentAdmissionsTimestampsSec.length;
  }

  /**
   * Returns rolling 60s throughput in represented spectators per minute.
   */
  public getObservedThroughputRepPerMin(): number {
    return Math.round(this.recentAdmissionsTimestampsSec.length * this.schedule.populationScalingRatio);
  }

  /**
   * Returns gate state by ID.
   */
  public getGateState(gateId: string): GateState | undefined {
    return this.gates.get(gateId);
  }

  /**
   * Returns theoretical capacity for a gate in simulated agents per minute.
   */
  public getTheoreticalThroughputSimPerMin(gateId: string): number {
    const gate = this.gates.get(gateId);
    if (!gate || gate.operationalLanes <= 0 || gate.turnstileLatencySec <= 0) return 0;
    return (gate.operationalLanes / gate.turnstileLatencySec) * 60;
  }

  /**
   * Returns current physical simulation elapsed time in seconds.
   */
  public getCurrentSimTimeSec(): number {
    return this.currentSimTimeSec;
  }

  /**
   * Resets simulation time, schedule injection pointer, gate channel cooldowns,
   * and admission tallies while strictly preserving the immutable schedule and event.
   */
  public reset(): void {
    this.currentSimTimeSec = 0;
    this.scheduleVirtualTimeSec = 0;
    this.schedulePointer = 0;
    this.totalAdmittedCount = 0;
    this.totalInboundInjectedCount = 0;
    this.totalOutboundInjectedCount = 0;
    this.totalOutboundExitedCount = 0;
    this.recentAdmissionsTimestampsSec = [];
    this.initializeGates(this.event.gates);
    this.initializeInflowRate();
  }

  /**
   * Re-initializes engine with a new event and schedule.
   */
  public loadEventAndSchedule(event: SyntheticEventData, schedule: PreGeneratedArrivalSchedule): void {
    this.event = event;
    this.schedule = schedule;
    this.reset();
  }

  /**
   * Returns loaded event data.
   */
  public getEvent(): SyntheticEventData {
    return this.event;
  }

  /**
   * Returns loaded schedule.
   */
  public getSchedule(): PreGeneratedArrivalSchedule {
    return this.schedule;
  }
}
