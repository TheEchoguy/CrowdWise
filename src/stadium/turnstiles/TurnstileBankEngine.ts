/**
 * CROWDWISE — Phase 2: Independent Turnstile Bank System
 * M. Chinnaswamy Stadium, Bengaluru
 *
 * Microscopic turnstile counter physics for all 15 inner banks (G1–G15):
 * Total Gate Capacity = Sum of Active Turnstile Counter Capacities.
 */

import { INNER_GATE_STAND_CATALOG } from '../network/gateConnectivity';

export interface TurnstileCounterState {
  counterId: string; // e.g. 'G8-1'
  gateId: string;    // e.g. 'G8'
  laneIndex: number;
  status: 'IDLE' | 'BUSY' | 'FAILED';
  currentAgentId: number | null;
  serviceRemainingSec: number;
  nominalLatencySec: number; // e.g. 1.0s (60 p/min)
  processedCount: number;
  totalBusyTimeSec: number;
}

export interface InnerGateBankState {
  gateId: string;
  standName: string;
  counters: TurnstileCounterState[];
  activeCounterCount: number;
  totalProcessed: number;
  currentQueueCount: number;
  nominalThroughputPerMin: number;
  effectiveThroughputPerMin: number;
  isFailed: boolean;
}

export class TurnstileBankEngine {
  private banks: Map<string, InnerGateBankState> = new Map();

  constructor() {
    this.initDefaultBanks();
  }

  /**
   * Initializes all 15 inner gates (G1–G15) with their default KSCA turnstile counts.
   */
  public initDefaultBanks(overrides?: Record<string, number>): void {
    this.banks.clear();

    Object.values(INNER_GATE_STAND_CATALOG).forEach((spec) => {
      const gateId = spec.innerGateId;
      const count = overrides && overrides[gateId] !== undefined ? overrides[gateId] : spec.turnstileCount;
      const counters: TurnstileCounterState[] = [];

      for (let i = 1; i <= count; i++) {
        counters.push({
          counterId: `${gateId}-${i}`,
          gateId,
          laneIndex: i,
          status: 'IDLE',
          currentAgentId: null,
          serviceRemainingSec: 0,
          nominalLatencySec: spec.serviceLatencySec,
          processedCount: 0,
          totalBusyTimeSec: 0
        });
      }

      this.banks.set(gateId, {
        gateId,
        standName: spec.standName,
        counters,
        activeCounterCount: count,
        totalProcessed: 0,
        currentQueueCount: 0,
        nominalThroughputPerMin: count * (60 / spec.serviceLatencySec),
        effectiveThroughputPerMin: count * (60 / spec.serviceLatencySec),
        isFailed: false
      });
    });
  }

  /**
   * Reconfigures the number of active turnstiles at an individual inner gate.
   */
  public setGateTurnstileCount(gateId: string, newCount: number): void {
    const bank = this.banks.get(gateId);
    if (!bank) return;

    const clampedCount = Math.max(1, Math.min(12, Math.round(newCount)));
    const currentCounters = bank.counters;

    if (clampedCount > currentCounters.length) {
      // Add new counters
      for (let i = currentCounters.length + 1; i <= clampedCount; i++) {
        currentCounters.push({
          counterId: `${gateId}-${i}`,
          gateId,
          laneIndex: i,
          status: 'IDLE',
          currentAgentId: null,
          serviceRemainingSec: 0,
          nominalLatencySec: 1.0,
          processedCount: 0,
          totalBusyTimeSec: 0
        });
      }
    } else if (clampedCount < currentCounters.length) {
      // Truncate surplus counters
      currentCounters.splice(clampedCount);
    }

    bank.activeCounterCount = clampedCount;
    bank.nominalThroughputPerMin = clampedCount * 60;
  }

  /**
   * Triggers or clears hardware failure on a gate's turnstiles.
   */
  public setGateFailure(gateId: string, failed: boolean): void {
    const bank = this.banks.get(gateId);
    if (!bank) return;

    bank.isFailed = failed;
    bank.counters.forEach((c) => {
      if (failed) {
        c.status = 'FAILED';
      } else if (c.status === 'FAILED') {
        c.status = 'IDLE';
      }
    });
    bank.effectiveThroughputPerMin = failed ? 0 : bank.activeCounterCount * 60;
  }

  /**
   * Updates turnstiles state over a timestep dt (seconds).
   * Processes agents currently at the counter and admits them when service completes.
   */
  public step(dt: number): { clearedAgentIds: number[] } {
    const clearedAgentIds: number[] = [];

    this.banks.forEach((bank) => {
      let activeCount = 0;

      bank.counters.forEach((counter) => {
        if (counter.status === 'FAILED') return;
        activeCount++;

        if (counter.status === 'BUSY' && counter.currentAgentId !== null) {
          counter.serviceRemainingSec -= dt;
          counter.totalBusyTimeSec += dt;

          if (counter.serviceRemainingSec <= 0) {
            // Service completed!
            clearedAgentIds.push(counter.currentAgentId);
            counter.processedCount++;
            bank.totalProcessed++;
            counter.currentAgentId = null;
            counter.status = 'IDLE';
            counter.serviceRemainingSec = 0;
          }
        }
      });

      bank.effectiveThroughputPerMin = activeCount * 60;
    });

    return { clearedAgentIds };
  }

  /**
   * Attempts to assign a waiting agent to an idle turnstile counter at their assigned inner gate.
   * Returns true if patron was admitted into a turnstile lane, false if all counters are busy.
   */
  public tryAdmitAgent(gateId: string, agentId: number, serviceLatencySec = 1.0): boolean {
    const bank = this.banks.get(gateId);
    if (!bank || bank.isFailed) return false;

    // Find first idle counter
    const idleCounter = bank.counters.find((c) => c.status === 'IDLE');
    if (!idleCounter) return false;

    // Engage counter
    idleCounter.status = 'BUSY';
    idleCounter.currentAgentId = agentId;
    idleCounter.serviceRemainingSec = Math.max(0.1, serviceLatencySec);
    idleCounter.nominalLatencySec = serviceLatencySec;
    return true;
  }

  /**
   * Retrieves live state of all turnstile banks.
   */
  public getBanks(): Map<string, InnerGateBankState> {
    return this.banks;
  }

  public getAllBanks(): InnerGateBankState[] {
    return Array.from(this.banks.values());
  }

  public getBank(gateId: string): InnerGateBankState | undefined {
    return this.banks.get(gateId);
  }

  public getBankState(gateId: string): InnerGateBankState | undefined {
    return this.banks.get(gateId);
  }

  /**
   * Calculates overall venue turnstile processing capacity (p/min).
   */
  public getTotalVenueCapacityPerMin(): number {
    let total = 0;
    this.banks.forEach((b) => {
      if (!b.isFailed) {
        total += b.counters.filter((c) => c.status !== 'FAILED').length * 60;
      }
    });
    return total;
  }
}
