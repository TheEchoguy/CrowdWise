/**
 * CROWDWISE — Phase 2.2: Simplified 2-Stage Verification Gate Operational Engine
 * M. Chinnaswamy Stadium, Bengaluru
 *
 * Microscopic Gate Operational Architecture:
 * OUTER GATE -> APPROACH CORRIDOR -> HOLDING & QUEUE LANES
 * -> STAGE 1: TICKET VALIDATION (NFC/QR Tap)
 * -> STAGE 2: PERSON CHECK (Attendee vs Ticket-Holder ID Match)
 * -> INNER TURNSTILES (Dynamic Scaling) -> VOMITORY -> SEATING STAND
 *
 * Implements:
 * - Sequential operational state machine
 * - Multi-lane queue balancing & switchback geometry
 * - Synthetic credential verification (QR/NFC, duplicate detection, wrong stand)
 * - Attendee identity verification with mismatch detection & lateral diversion
 * - Real-time turnstile addition (+) and busy-safe removal (-)
 * - Capacity analysis: C_effective = min(C_scan, C_person, C_turn)
 * - Gate-specific microscopic 3-zone density monitoring
 */

import { SeededPRNG } from '../../engine/prng';
import {
  SyntheticTicket,
  MicroGateAgent,
  TicketScanStationState,
  PersonCheckStationState,
  SecurityScreeningStationState,
  MicroTurnstileCounterState,
  QueueLaneState,
  MicroGateMetrics,
  GateLogEvent
} from '../types/gateSimulation';
import { GATE_CONNECTIVITY_CATALOG, INNER_GATE_STAND_CATALOG, GateConnectionSpec } from '../network/gateConnectivity';

const SAMPLE_ATTENDEE_NAMES = [
  'Arun Sharma',
  'Priya Rao',
  'Rahul Dravid',
  'Ananya Hegde',
  'Vikram Patil',
  'Deepa Nair',
  'Karthik Iyer',
  'Sneha Gowda',
  'Rohan Verma',
  'Meera Kulkarni',
  'Aditya Joshi',
  'Divya Prasad',
  'Siddharth Roy',
  'Pooja Nair',
  'Girish Bhat'
];

export class MicroGateEngine {
  public static readonly CANVAS_WIDTH = 960;
  public static readonly CANVAS_HEIGHT = 580;

  private outerGateId: string;
  private innerGateIds: string[];
  private prng: SeededPRNG;
  private nextAgentId = 1;

  // Active agents in gate corridor
  private agents: MicroGateAgent[] = [];

  // Physical stations
  private queueLanes: QueueLaneState[] = [];
  private scanStations: TicketScanStationState[] = [];
  private personCheckStations: PersonCheckStationState[] = [];
  private turnstileCounters: MicroTurnstileCounterState[] = [];

  // Operational Configuration
  private arrivalRatePerMin = 360;
  private ticketScanLatencySec = 0.4;
  private personCheckLatencySec = 1.0;
  private turnstileLatencySec = 1.0;
  private rejectionRate = 0.05;
  private personMismatchRate = 0.03;
  private sQueueActive = true;
  private auxiliaryBypassActive = true;

  // Used ticket registry for duplicate detection
  private usedTicketRegistry: Set<string> = new Set();

  // Metrics
  private totalArrivals = 0;
  private ticketsScanned = 0;
  private ticketsAccepted = 0;
  private ticketsRejected = 0;
  private personsChecked = 0;
  private personsVerified = 0;
  private personMismatches = 0;
  private spectatorsAdmitted = 0;
  private waitTimesHistory: number[] = [];
  private recentAdmittedCount = 0;
  private throughputHistory: number[] = [];
  private lastThroughputSampleTime = 0;

  // Spawn accumulator
  private spawnAccumulator = 0;

  // Event Log Callback
  private onLogEvent?: (event: GateLogEvent) => void;

  constructor(outerGateId = 'E22', seed = 42, onLog?: (event: GateLogEvent) => void) {
    this.outerGateId = outerGateId;
    const spec = GATE_CONNECTIVITY_CATALOG[outerGateId] || GATE_CONNECTIVITY_CATALOG.E22;
    this.innerGateIds = [...spec.connectedInnerGates];
    this.prng = new SeededPRNG(seed);
    this.onLogEvent = onLog;

    this.reconfigureCorridor();
  }

  /**
   * Sets the active outer gate and rebuilds physical stations based on its ground truth connectivity.
   */
  public selectOuterGate(outerGateId: string): void {
    if (this.outerGateId === outerGateId) return;
    this.outerGateId = outerGateId;
    const spec = GATE_CONNECTIVITY_CATALOG[outerGateId] || GATE_CONNECTIVITY_CATALOG.E11;
    this.innerGateIds = [...spec.connectedInnerGates];
    this.reset();
  }

  /**
   * Fully reconfigures queue lanes, scan stations, person check checkpoints and turnstiles.
   */
  public reconfigureCorridor(): void {
    const spec: GateConnectionSpec = GATE_CONNECTIVITY_CATALOG[this.outerGateId] || GATE_CONNECTIVITY_CATALOG.E22;
    const isRestricted = spec.accessPermission === 'RESTRICTED_VIP_MEDIA';

    // 1. Configure S-Queue Lanes (4 Parallel Switchback Lanes across x in [160, 680])
    const laneCount = 4;
    const queueAreaLeft = 180;
    const queueAreaWidth = 500;
    const laneWidth = queueAreaWidth / laneCount;
    this.queueLanes = [];

    for (let i = 0; i < laneCount; i++) {
      const lx = queueAreaLeft + i * laneWidth + laneWidth / 2;
      const waypoints = this.sQueueActive
        ? [
            { x: lx, y: 470 },
            { x: lx + 18, y: 410 },
            { x: lx - 18, y: 350 },
            { x: lx + 10, y: 290 },
            { x: lx, y: 260 }
          ]
        : [
            { x: lx, y: 470 },
            { x: lx, y: 360 },
            { x: lx, y: 260 }
          ];

      this.queueLanes.push({
        laneIndex: i,
        label: `Lane ${i + 1}`,
        startX: lx,
        startY: 470,
        endX: lx,
        endY: 260,
        waypoints,
        occupancy: 0,
        capacity: 35,
        isCongested: false
      });
    }

    // 2. Stage 1: Ticket Validation Stations (NFC / QR Scanners at y = 240)
    const scanCount = 4;
    this.scanStations = [];
    const scanSpacing = queueAreaWidth / scanCount;
    for (let i = 0; i < scanCount; i++) {
      this.scanStations.push({
        id: `SCAN-${i + 1}`,
        name: `NFC/QR Tap ${i + 1}`,
        x: queueAreaLeft + i * scanSpacing + scanSpacing / 2,
        y: 240,
        status: 'IDLE',
        currentAgentId: null,
        scanRemainingSec: 0,
        nominalLatencySec: this.ticketScanLatencySec,
        totalScanned: 0,
        totalAccepted: 0,
        totalRejected: 0
      });
    }

    // 3. Stage 2: Person Verification Stations (Attendee vs Ticket-Holder ID Check at y = 195)
    const chkCount = 4;
    this.personCheckStations = [];
    const chkSpacing = queueAreaWidth / chkCount;
    for (let i = 0; i < chkCount; i++) {
      this.personCheckStations.push({
        id: `CHK-${i + 1}`,
        name: `Person Check ${i + 1}`,
        x: queueAreaLeft + i * chkSpacing + chkSpacing / 2,
        y: 195,
        status: 'IDLE',
        currentAgentId: null,
        checkRemainingSec: 0,
        nominalLatencySec: this.personCheckLatencySec,
        totalChecked: 0,
        totalVerified: 0,
        totalMismatches: 0
      });
    }

    // 4. Inner Turnstile Counters (G1–G15 at y = 150)
    this.turnstileCounters = [];
    let counterIndex = 1;

    // Distribute turnstiles across connected inner gates
    this.innerGateIds.forEach((gid) => {
      const standSpec = INNER_GATE_STAND_CATALOG[gid];
      const count = standSpec ? Math.min(8, standSpec.turnstileCount) : 4;
      const bankWidth = queueAreaWidth / this.innerGateIds.length;
      const bankStartX = queueAreaLeft + this.innerGateIds.indexOf(gid) * bankWidth;
      const counterSpacing = bankWidth / count;

      for (let c = 1; c <= count; c++) {
        const paddedNum = c < 10 ? `0${c}` : `${c}`;
        this.turnstileCounters.push({
          counterId: `${gid}-T${paddedNum}`,
          gateId: gid,
          standName: standSpec ? standSpec.standName : 'General Stand',
          laneIndex: counterIndex++,
          x: bankStartX + (c - 0.5) * counterSpacing,
          y: 150,
          status: 'IDLE',
          currentAgentId: null,
          serviceRemainingSec: 0,
          nominalLatencySec: this.turnstileLatencySec,
          processedCount: 0,
          processingCapacityPerMin: Math.round(60 / this.turnstileLatencySec),
          queueLength: 0,
          assignedQueue: []
        });
      }
    });

    if (isRestricted) {
      this.log(
        'WARNING',
        `Gate ${this.outerGateId} is strictly RESTRICTED (VIP / Media only). Public ticket holders diverted.`,
        this.outerGateId
      );
    }
  }

  /**
   * Resets simulation run, clears agents and resets metrics.
   */
  public reset(seed?: number): void {
    if (seed !== undefined) this.prng = new SeededPRNG(seed);
    this.agents = [];
    this.nextAgentId = 1;
    this.spawnAccumulator = 0;
    this.totalArrivals = 0;
    this.ticketsScanned = 0;
    this.ticketsAccepted = 0;
    this.ticketsRejected = 0;
    this.personsChecked = 0;
    this.personsVerified = 0;
    this.personMismatches = 0;
    this.spectatorsAdmitted = 0;
    this.waitTimesHistory = [];
    this.recentAdmittedCount = 0;
    this.usedTicketRegistry.clear();
    this.reconfigureCorridor();
  }

  // ─── Operational Configuration Setters ───────────────────────────────────

  public setArrivalRate(ratePerMin: number): void {
    this.arrivalRatePerMin = Math.max(0, Math.min(1800, ratePerMin));
  }

  public setTicketScanLatency(sec: number): void {
    this.ticketScanLatencySec = Math.max(0.1, Math.min(4.0, sec));
    this.scanStations.forEach((s) => (s.nominalLatencySec = this.ticketScanLatencySec));
  }

  public setPersonCheckLatency(sec: number): void {
    this.personCheckLatencySec = Math.max(0.2, Math.min(8.0, sec));
    this.personCheckStations.forEach((s) => (s.nominalLatencySec = this.personCheckLatencySec));
  }

  public setSecurityScreeningLatency(sec: number): void {
    this.setPersonCheckLatency(sec);
  }

  public setTurnstileLatency(sec: number): void {
    this.turnstileLatencySec = Math.max(0.2, Math.min(3.0, sec));
    this.turnstileCounters.forEach((t) => (t.nominalLatencySec = this.turnstileLatencySec));
  }

  public setRejectionRate(rate: number): void {
    this.rejectionRate = Math.max(0, Math.min(1.0, rate));
  }

  public getRejectionRate(): number {
    return this.rejectionRate;
  }

  public setPersonMismatchRate(rate: number): void {
    this.personMismatchRate = Math.max(0, Math.min(1.0, rate));
  }

  public setSQueueActive(active: boolean): void {
    this.sQueueActive = active;
    this.reconfigureCorridor();
  }

  public setAuxiliaryBypassActive(active: boolean): void {
    this.auxiliaryBypassActive = active;
  }

  /**
   * Synchronizes turnstile counter counts with external overrides (e.g. from LeftControls).
   */
  public syncTurnstilesFromOverrides(overrides: Record<string, number>): void {
    if (!overrides) return;
    let changed = false;

    this.innerGateIds.forEach((gid) => {
      const targetCount = overrides[gid];
      if (targetCount === undefined || targetCount < 1) return;

      const current = this.turnstileCounters.filter((c) => c.gateId === gid);
      if (current.length < targetCount) {
        // Need to add turnstiles
        const toAdd = targetCount - current.length;
        for (let i = 0; i < toAdd; i++) {
          this.addTurnstile(gid);
        }
        changed = true;
      } else if (current.length > targetCount) {
        // Need to remove turnstiles
        const toRemove = current.length - targetCount;
        for (let i = 0; i < toRemove; i++) {
          const removed = this.removeTurnstile(gid);
          if (!removed) break; // Cannot remove if busy or at limit
        }
        changed = true;
      }
    });

    if (changed) {
      this.rebalanceTurnstilePositions();
    }
  }

  /**
   * Adds a new turnstile counter to the specified inner gate bank in real-time.
   */
  public addTurnstile(gateId?: string): MicroTurnstileCounterState | null {
    const targetGate = gateId || this.innerGateIds[0] || 'G7';
    const standSpec = INNER_GATE_STAND_CATALOG[targetGate];
    const existing = this.turnstileCounters.filter((c) => c.gateId === targetGate);
    const newIdx = existing.length + 1;
    const padded = newIdx < 10 ? `0${newIdx}` : `${newIdx}`;
    const counterId = `${targetGate}-T${padded}`;

    const newCounter: MicroTurnstileCounterState = {
      counterId,
      gateId: targetGate,
      standName: standSpec ? standSpec.standName : 'General Stand',
      laneIndex: this.turnstileCounters.length + 1,
      x: 300,
      y: 150,
      status: 'IDLE',
      currentAgentId: null,
      serviceRemainingSec: 0,
      nominalLatencySec: this.turnstileLatencySec,
      processedCount: 0,
      processingCapacityPerMin: Math.round(60 / Math.max(0.1, this.turnstileLatencySec)),
      queueLength: 0,
      assignedQueue: []
    };

    this.turnstileCounters.push(newCounter);
    this.rebalanceTurnstilePositions();
    this.log(
      'INFO',
      `Added Turnstile Counter ${counterId} to Inner Bank ${targetGate} (capacity: ${Math.round(60 / this.turnstileLatencySec)} p/min)`,
      targetGate
    );
    return newCounter;
  }

  /**
   * Removes the last idle turnstile counter from the specified inner bank.
   * Refuses removal if counter is currently BUSY.
   */
  public removeTurnstile(gateId?: string): boolean {
    const targetGate = gateId || this.innerGateIds[0] || 'G7';
    const matching = this.turnstileCounters.filter((c) => c.gateId === targetGate);
    if (matching.length <= 1) {
      this.log('WARNING', `Cannot remove last turnstile for gate bank ${targetGate}`, targetGate);
      return false;
    }

    const lastCounter = matching[matching.length - 1];
    if (lastCounter.status === 'BUSY' || (lastCounter.assignedQueue && lastCounter.assignedQueue.length > 0)) {
      this.log('WARNING', `Refused removal: Turnstile ${lastCounter.counterId} is currently BUSY`, targetGate);
      return false;
    }

    const idx = this.turnstileCounters.indexOf(lastCounter);
    if (idx !== -1) {
      this.turnstileCounters.splice(idx, 1);
      this.rebalanceTurnstilePositions();
      this.log('INFO', `Removed Turnstile Counter ${lastCounter.counterId} from Inner Bank ${targetGate}`, targetGate);
      return true;
    }
    return false;
  }

  /**
   * Repositions turnstile counters uniformly across gate bank widths.
   */
  private rebalanceTurnstilePositions(): void {
    const queueAreaLeft = 180;
    const queueAreaWidth = 500;
    const bankWidth = queueAreaWidth / Math.max(1, this.innerGateIds.length);

    this.innerGateIds.forEach((gid, bankIdx) => {
      const counters = this.turnstileCounters.filter((c) => c.gateId === gid);
      const bankStartX = queueAreaLeft + bankIdx * bankWidth;
      const count = counters.length;
      if (count > 0) {
        const counterSpacing = bankWidth / count;
        counters.forEach((c, idx) => {
          c.x = bankStartX + (idx + 0.5) * counterSpacing;
          c.processingCapacityPerMin = Math.round(60 / Math.max(0.1, c.nominalLatencySec));
        });
      }
    });
  }

  /**
   * Returns calculated vomitory positions and destination stands for connected inner gates.
   */
  public getVomitories(): { gateId: string; standName: string; x: number; y: number }[] {
    const queueAreaLeft = 180;
    const queueAreaWidth = 500;
    const bankWidth = queueAreaWidth / Math.max(1, this.innerGateIds.length);

    return this.innerGateIds.map((gid, idx) => {
      const standSpec = INNER_GATE_STAND_CATALOG[gid];
      const standName = standSpec ? standSpec.standName : gid;
      const bankStartX = queueAreaLeft + idx * bankWidth;
      const vx = bankStartX + bankWidth / 2;
      return {
        gateId: gid,
        standName,
        x: vx,
        y: 65
      };
    });
  }

  public getVomitoryForInnerGate(gateId: string): { x: number; y: number } {
    const vomitories = this.getVomitories();
    const match = vomitories.find((v) => v.gateId === gateId);
    return match ? { x: match.x, y: match.y } : { x: 480, y: 65 };
  }

  /**
   * Simulates hardware scanner malfunction at ticket station.
   */
  public toggleScannerFailure(stationIndex = 0): void {
    if (this.scanStations[stationIndex]) {
      const s = this.scanStations[stationIndex];
      s.status = s.status === 'FAILED' ? 'IDLE' : 'FAILED';
      this.log('ALERT', `Ticket Scanner ${s.id} status changed to ${s.status}`, this.outerGateId);
    }
  }

  /**
   * Simulates turnstile counter breakdown or recovery.
   */
  public toggleTurnstileFailure(counterIndexOrId: number | string = 0): void {
    let t: MicroTurnstileCounterState | undefined;
    if (typeof counterIndexOrId === 'number') {
      t = this.turnstileCounters[counterIndexOrId];
    } else {
      t = this.turnstileCounters.find((c) => c.counterId === counterIndexOrId);
    }
    if (t) {
      const willFail = t.status !== 'FAILED';
      t.status = willFail ? 'FAILED' : 'IDLE';

      if (willFail) {
        // Redistribute any waiting queue to remaining operational counters
        if (t.assignedQueue && t.assignedQueue.length > 0) {
          const operational = this.turnstileCounters.filter(
            (c) => c.gateId === t!.gateId && c.status !== 'FAILED' && c.counterId !== t!.counterId
          );
          if (operational.length > 0) {
            t.assignedQueue.forEach((agId) => {
              const best = operational.reduce((prev, curr) =>
                (curr.assignedQueue?.length || 0) < (prev.assignedQueue?.length || 0) ? curr : prev
              );
              best.assignedQueue = best.assignedQueue || [];
              best.assignedQueue.push(agId);
              best.queueLength = best.assignedQueue.length;
              const ag = this.agents.find((a) => a.id === agId);
              if (ag) {
                ag.assignedTurnstileCounterId = best.counterId;
                ag.waypoints = [{ x: best.x, y: 175 }, { x: best.x, y: 160 }];
                ag.currentWaypointIndex = 0;
              }
            });
          }
          t.assignedQueue = [];
          t.queueLength = 0;
        }
      }
      this.log('ALERT', `Turnstile Counter ${t.counterId} status toggled to ${t.status}`, t.gateId);
    }
  }

  /**
   * Triggers an immediate burst of arriving spectators (e.g. Metro arrival).
   */
  public triggerArrivalBurst(count = 35): void {
    for (let i = 0; i < count; i++) {
      this.spawnAgent();
    }
    this.log('WARNING', `Metro Arrival Burst: +${count} spectators arrived at Gate ${this.outerGateId}`, this.outerGateId);
  }

  // ─── Synthetic Credential Generation ─────────────────────────────────────

  private generateSyntheticCredentials(): {
    ticket: SyntheticTicket;
    attendeeName: string;
    ticketHolderName: string;
  } {
    const isRestrictedGate =
      GATE_CONNECTIVITY_CATALOG[this.outerGateId]?.accessPermission === 'RESTRICTED_VIP_MEDIA';
    const randomVal = this.prng.nextFloat();
    const authorizedInnerGate =
      this.innerGateIds[Math.floor(this.prng.nextFloat() * this.innerGateIds.length)] || 'G8';
    const standSpec = INNER_GATE_STAND_CATALOG[authorizedInnerGate];
    const authorizedStand = standSpec ? standSpec.standName : 'C Stand';

    const ticketId = `TKT-${Math.floor(100000 + this.prng.nextFloat() * 900000)}`;

    const nameIdx = Math.floor(this.prng.nextFloat() * SAMPLE_ATTENDEE_NAMES.length);
    const ticketHolderName = SAMPLE_ATTENDEE_NAMES[nameIdx];
    const hasMismatch = this.prng.nextFloat() < this.personMismatchRate;
    const attendeeName = hasMismatch
      ? SAMPLE_ATTENDEE_NAMES[(nameIdx + 3) % SAMPLE_ATTENDEE_NAMES.length]
      : ticketHolderName;

    // Rejection simulation based on configured rate
    if (isRestrictedGate) {
      return {
        ticket: {
          ticketId,
          isValid: false,
          authorizedStand,
          authorizedInnerGate,
          isDuplicate: false,
          isExpired: false,
          status: 'WRONG_GATE'
        },
        attendeeName,
        ticketHolderName
      };
    }

    if (randomVal < this.rejectionRate) {
      const rType = this.prng.nextFloat();
      if (rType < 0.3) {
        return {
          ticket: {
            ticketId,
            isValid: false,
            authorizedStand,
            authorizedInnerGate,
            isDuplicate: false,
            isExpired: false,
            status: 'INVALID_QR'
          },
          attendeeName,
          ticketHolderName
        };
      } else if (rType < 0.6) {
        return {
          ticket: {
            ticketId,
            isValid: false,
            authorizedStand,
            authorizedInnerGate,
            isDuplicate: true,
            isExpired: false,
            status: 'DUPLICATE'
          },
          attendeeName,
          ticketHolderName
        };
      } else if (rType < 0.8) {
        return {
          ticket: {
            ticketId,
            isValid: false,
            authorizedStand: 'P Terrace (South)',
            authorizedInnerGate: 'G1',
            isDuplicate: false,
            isExpired: false,
            status: 'WRONG_STAND'
          },
          attendeeName,
          ticketHolderName
        };
      } else {
        return {
          ticket: {
            ticketId,
            isValid: false,
            authorizedStand,
            authorizedInnerGate,
            isDuplicate: false,
            isExpired: true,
            status: 'EXPIRED'
          },
          attendeeName,
          ticketHolderName
        };
      }
    }

    return {
      ticket: {
        ticketId,
        isValid: true,
        authorizedStand,
        authorizedInnerGate,
        isDuplicate: false,
        isExpired: false,
        status: 'VALID'
      },
      attendeeName,
      ticketHolderName
    };
  }

  /**
   * Spawns a new pedestrian agent on the arrival sidewalk.
   */
  public spawnAgent(): boolean {
    const laneIndex = this.selectBalancedLane();
    const lane = this.queueLanes[laneIndex];
    if (!lane) return false;

    const { ticket, attendeeName, ticketHolderName } = this.generateSyntheticCredentials();
    const assignedInnerGateId = ticket.authorizedInnerGate;
    const standSpec = INNER_GATE_STAND_CATALOG[assignedInnerGateId];

    const startX = 200 + this.prng.nextFloat() * 460;
    const startY = 530 + this.prng.nextFloat() * 20;

    const agent: MicroGateAgent = {
      id: this.nextAgentId++,
      x: startX,
      y: startY,
      vx: 0,
      vy: -15,
      desiredSpeed: 1.2 + (this.prng.nextFloat() - 0.5) * 0.2,
      radius: 4.8,
      state: 'ARRIVING',
      ticket,
      attendeeName,
      ticketHolderName,
      assignedLaneIndex: laneIndex,
      assignedScanStationId: null,
      assignedPersonCheckStationId: null,
      assignedTurnstileCounterId: null,
      targetInnerGateId: assignedInnerGateId,
      targetStandName: standSpec ? standSpec.standName : 'C Stand',
      entryTimeSec: performance.now() / 1000,
      timeInCurrentStateSec: 0,
      totalWaitTimeSec: 0,
      isDiverted: false,
      currentWaypointIndex: 0,
      waypoints: [...lane.waypoints]
    };

    this.agents.push(agent);
    this.totalArrivals++;
    lane.occupancy++;
    return true;
  }

  /**
   * Selects least-occupied queue lane for dynamic balancing.
   */
  private selectBalancedLane(): number {
    let minOcc = Infinity;
    let selected = 0;
    for (let i = 0; i < this.queueLanes.length; i++) {
      if (this.queueLanes[i].occupancy < minOcc) {
        minOcc = this.queueLanes[i].occupancy;
        selected = i;
      }
    }
    return selected;
  }

  /**
   * Main Microscopic Engine Timestep.
   */
  public step(dt: number, nowSec: number): MicroGateMetrics {
    // 1. Spawning via Poisson Schedule
    if (this.arrivalRatePerMin > 0) {
      const spawnRatePerSec = this.arrivalRatePerMin / 60;
      this.spawnAccumulator += spawnRatePerSec * dt;

      while (this.spawnAccumulator >= 1.0) {
        this.spawnAccumulator -= 1.0;
        this.spawnAgent();
      }
    }

    // 2. Step Stations (Scan, Person Check, Turnstiles)
    this.stepScanStations(dt);
    this.stepPersonCheckStations(dt);
    this.stepTurnstiles(dt);

    // 3. Step Agents & State Transitions
    this.stepAgents(dt, nowSec);

    // 4. Update Queue Lane Metrics
    this.updateLaneMetrics();

    // 5. Throughput Tracking
    if (nowSec - this.lastThroughputSampleTime >= 5.0) {
      this.lastThroughputSampleTime = nowSec;
      const rate = this.recentAdmittedCount * 12; // admitted in 5s scaled to p/min
      this.throughputHistory.push(rate);
      if (this.throughputHistory.length > 12) this.throughputHistory.shift();
      this.recentAdmittedCount = 0;
    }

    return this.calculateMetrics();
  }

  // ─── Station Processing Logic ────────────────────────────────────────────

  private stepScanStations(dt: number): void {
    this.scanStations.forEach((station) => {
      if (station.status === 'FAILED') return;

      if (station.status === 'SCANNING' && station.currentAgentId !== null) {
        station.scanRemainingSec -= dt;
        if (station.scanRemainingSec <= 0) {
          // Stage 1 Validation Completed!
          const agent = this.agents.find((a) => a.id === station.currentAgentId);
          if (agent) {
            this.finalizeTicketValidation(agent, station);
          }
          station.status = 'IDLE';
          station.currentAgentId = null;
        }
      }
    });
  }

  private finalizeTicketValidation(agent: MicroGateAgent, station: TicketScanStationState): void {
    station.totalScanned++;
    this.ticketsScanned++;

    // Check duplicate in registry
    if (this.usedTicketRegistry.has(agent.ticket.ticketId)) {
      agent.ticket.isDuplicate = true;
      agent.ticket.status = 'DUPLICATE';
    }

    if (
      agent.ticket.isValid &&
      !agent.ticket.isDuplicate &&
      !agent.ticket.isExpired &&
      agent.ticket.status === 'VALID'
    ) {
      // Stage 1 Accepted -> Proceed to Stage 2 (Person Check)
      station.totalAccepted++;
      this.ticketsAccepted++;
      this.usedTicketRegistry.add(agent.ticket.ticketId);

      agent.state = 'TICKET_VALIDATED';
      agent.timeInCurrentStateSec = 0;
      agent.currentWaypointIndex = 0;
      agent.waypoints = [{ x: station.x, y: 215 }, { x: station.x, y: 195 }];
    } else {
      // Stage 1 Rejected -> Divert to lateral recovery corridor
      station.totalRejected++;
      this.ticketsRejected++;
      agent.state = 'REJECTED';
      agent.isDiverted = true;
      agent.timeInCurrentStateSec = 0;

      // Lateral path to right-side recovery corridor
      const divertX = 860;
      agent.waypoints = [
        { x: station.x, y: 240 },
        { x: divertX, y: 240 },
        { x: divertX, y: 380 },
        { x: divertX, y: 530 }
      ];
      agent.currentWaypointIndex = 0;

      this.log(
        'WARNING',
        `Ticket Rejected: ID ${agent.ticket.ticketId} (${agent.ticket.status}) -> Diverted to Recovery Lane`,
        this.outerGateId
      );
    }
  }

  private stepPersonCheckStations(dt: number): void {
    this.personCheckStations.forEach((station) => {
      if (station.status === 'FAILED') return;

      if (station.status === 'CHECKING' && station.currentAgentId !== null) {
        station.checkRemainingSec -= dt;
        if (station.checkRemainingSec <= 0) {
          // Stage 2 Verification Completed!
          const agent = this.agents.find((a) => a.id === station.currentAgentId);
          if (agent) {
            station.totalChecked++;
            this.personsChecked++;

            const isMatch = agent.attendeeName === agent.ticketHolderName;
            if (isMatch) {
              // Match Verified!
              station.totalVerified++;
              this.personsVerified++;
              agent.personCheckStatus = 'VERIFIED';
              agent.state = 'PERSON_VERIFIED';
              agent.timeInCurrentStateSec = 0;

              // Assign to matching operational inner turnstile bank
              const counter = this.findBestTurnstile(agent.targetInnerGateId);
              if (counter) {
                counter.assignedQueue = counter.assignedQueue || [];
                counter.assignedQueue.push(agent.id);
                counter.queueLength = counter.assignedQueue.length;
                agent.assignedTurnstileCounterId = counter.counterId;
                agent.state = 'WAITING_FOR_TURNSTILE';

                const queueSlot = counter.assignedQueue.indexOf(agent.id);
                const queueY = Math.min(185, 168 + queueSlot * 6);
                agent.waypoints = [
                  { x: station.x, y: 185 },
                  { x: counter.x, y: 185 },
                  { x: counter.x, y: queueY }
                ];
                agent.currentWaypointIndex = 0;
              }
            } else {
              // Mismatch Detected -> Divert to recovery lane
              station.totalMismatches++;
              this.personMismatches++;
              agent.personCheckStatus = 'MISMATCH';
              agent.state = 'REJECTED';
              agent.isDiverted = true;
              agent.timeInCurrentStateSec = 0;

              const divertX = 860;
              agent.waypoints = [
                { x: station.x, y: 195 },
                { x: divertX, y: 195 },
                { x: divertX, y: 380 },
                { x: divertX, y: 530 }
              ];
              agent.currentWaypointIndex = 0;

              this.log(
                'ALERT',
                `Person Check Mismatch: Attendee "${agent.attendeeName}" ≠ Ticket-Holder "${agent.ticketHolderName}" -> Diverted`,
                this.outerGateId
              );
            }
          }
          station.status = 'IDLE';
          station.currentAgentId = null;
        }
      }
    });
  }

  private findBestTurnstile(gateId: string): MicroTurnstileCounterState | undefined {
    let candidates = this.turnstileCounters.filter((c) => c.gateId === gateId && c.status !== 'FAILED');
    if (candidates.length === 0) {
      candidates = this.turnstileCounters.filter((c) => c.status !== 'FAILED');
    }
    if (candidates.length === 0) return undefined;

    // Pick counter with smallest assigned queue (counting busy as +1)
    let best = candidates[0];
    let minLoad = Infinity;
    for (const c of candidates) {
      const load = (c.assignedQueue?.length || 0) + (c.status === 'BUSY' ? 1 : 0);
      if (load < minLoad) {
        minLoad = load;
        best = c;
      }
    }
    return best;
  }

  private stepTurnstiles(dt: number): void {
    this.turnstileCounters.forEach((counter) => {
      counter.processingCapacityPerMin = Math.round(60 / Math.max(0.1, counter.nominalLatencySec));
      counter.assignedQueue = counter.assignedQueue || [];
      counter.queueLength = counter.assignedQueue.length;

      if (counter.status === 'FAILED') return;

      if (counter.status === 'BUSY' && counter.currentAgentId !== null) {
        counter.serviceRemainingSec -= dt;
        if (counter.serviceRemainingSec <= 0) {
          // Admitted through turnstile!
          counter.processedCount++;
          this.spectatorsAdmitted++;
          this.recentAdmittedCount++;

          const agent = this.agents.find((a) => a.id === counter.currentAgentId);
          if (agent) {
            this.waitTimesHistory.push(agent.totalWaitTimeSec);
            if (this.waitTimesHistory.length > 100) this.waitTimesHistory.shift();

            // Transition: ADMITTED -> VOMITORY_DISPERSAL -> DESTINATION_STAND
            agent.state = 'ADMITTED';
            agent.timeInCurrentStateSec = 0;

            const vomitory = this.getVomitoryForInnerGate(counter.gateId);
            agent.waypoints = [
              { x: counter.x, y: 130 },
              { x: vomitory.x, y: 90 },
              { x: vomitory.x, y: 45 }
            ];
            agent.currentWaypointIndex = 0;
          }
          // Free counter to IDLE
          counter.assignedQueue = counter.assignedQueue.filter((id) => id !== counter.currentAgentId);
          counter.queueLength = counter.assignedQueue.length;
          counter.status = 'IDLE';
          counter.currentAgentId = null;
          counter.serviceRemainingSec = 0;
        }
      }
    });
  }

  // ─── Agent Lifecycle & Waypoint Steering ─────────────────────────────────

  private stepAgents(dt: number, _nowSec: number): void {
    for (let i = this.agents.length - 1; i >= 0; i--) {
      const ag = this.agents[i];
      ag.timeInCurrentStateSec += dt;
      ag.totalWaitTimeSec += dt;

      // 1. ARRIVING -> Move to Queue Entrance
      if (ag.state === 'ARRIVING') {
        const lane = this.queueLanes[ag.assignedLaneIndex];
        const targetX = lane ? lane.startX : 360;
        const targetY = 470;
        this.steerTowards(ag, targetX, targetY, dt);

        if (Math.hypot(ag.x - targetX, ag.y - targetY) < 14) {
          ag.state = 'WAITING_IN_QUEUE';
          ag.currentWaypointIndex = 0;
        }
      }

      // 2. WAITING_IN_QUEUE -> Follow Switchback Waypoints to Ticket Scan line
      else if (ag.state === 'WAITING_IN_QUEUE') {
        if (ag.currentWaypointIndex < ag.waypoints.length) {
          const wp = ag.waypoints[ag.currentWaypointIndex];
          this.steerTowards(ag, wp.x, wp.y, dt, 0.9);

          if (Math.hypot(ag.x - wp.x, ag.y - wp.y) < 12) {
            ag.currentWaypointIndex++;
          }
        } else {
          // Reached end of S-queue: try assign to idle ticket station
          const idleStation = this.scanStations.find((s) => s.status === 'IDLE');
          if (idleStation) {
            idleStation.status = 'SCANNING';
            idleStation.currentAgentId = ag.id;
            idleStation.scanRemainingSec = idleStation.nominalLatencySec;
            ag.state = 'TICKET_SCANNING';
            ag.assignedScanStationId = idleStation.id;
            ag.x = idleStation.x;
            ag.y = idleStation.y + 6;
          } else {
            ag.vy = 0;
            ag.vx = 0;
          }
        }
      }

      // 3. TICKET_SCANNING: Station step handles completion
      else if (ag.state === 'TICKET_SCANNING') {
        ag.vx = 0;
        ag.vy = 0;
      }

      // 4. TICKET_VALIDATED -> Move to Person Check station (Stage 2)
      else if (ag.state === 'TICKET_VALIDATED') {
        if (ag.currentWaypointIndex < ag.waypoints.length) {
          const wp = ag.waypoints[ag.currentWaypointIndex];
          this.steerTowards(ag, wp.x, wp.y, dt, 1.1);
          if (Math.hypot(ag.x - wp.x, ag.y - wp.y) < 10) {
            ag.currentWaypointIndex++;
          }
        } else {
          // Assign to idle person check station
          const idleChk = this.personCheckStations.find((s) => s.status === 'IDLE');
          if (idleChk) {
            idleChk.status = 'CHECKING';
            idleChk.currentAgentId = ag.id;
            idleChk.checkRemainingSec = idleChk.nominalLatencySec;
            ag.state = 'PERSON_CHECKING';
            ag.assignedPersonCheckStationId = idleChk.id;
            ag.x = idleChk.x;
            ag.y = idleChk.y;
          } else {
            ag.vx = 0;
            ag.vy = 0;
          }
        }
      }

      // 5. PERSON_CHECKING: stepPersonCheckStations handles completion
      else if (ag.state === 'PERSON_CHECKING') {
        ag.vx = 0;
        ag.vy = 0;
      }

      // 6. PERSON_VERIFIED / WAITING_FOR_TURNSTILE -> Approach turnstile queue lane without teleporting
      else if (
        ag.state === 'WAITING_FOR_TURNSTILE' ||
        ag.state === 'TURNSTILE_WAITING' ||
        ag.state === 'PERSON_VERIFIED'
      ) {
        const counter = this.turnstileCounters.find((c) => c.counterId === ag.assignedTurnstileCounterId);
        if (counter && counter.status !== 'FAILED') {
          counter.assignedQueue = counter.assignedQueue || [];
          const queueSlot = counter.assignedQueue.indexOf(ag.id);
          const targetSlotY = Math.min(185, 168 + Math.max(0, queueSlot) * 6);

          // If at the head of the queue (slot 0 or <= 0) and reached front position near turnstile (y <= 170)
          if (queueSlot <= 0 && Math.hypot(ag.x - counter.x, ag.y - 168) < 12) {
            if (counter.status === 'IDLE') {
              counter.status = 'BUSY';
              counter.currentAgentId = ag.id;
              counter.serviceRemainingSec = counter.nominalLatencySec;
              ag.state = 'TURNSTILE_PROCESSING';
              ag.x = counter.x;
              ag.y = counter.y;
              ag.vx = 0;
              ag.vy = 0;
            } else {
              // Counter is currently busy: wait at head of line
              ag.vx = 0;
              ag.vy = 0;
            }
          } else {
            // Smoothly steer towards designated queue position
            this.steerTowards(ag, counter.x, targetSlotY, dt, 1.0);
          }
        } else {
          // Reassign if counter failed
          const replacement = this.findBestTurnstile(ag.targetInnerGateId);
          if (replacement) {
            ag.assignedTurnstileCounterId = replacement.counterId;
            replacement.assignedQueue = replacement.assignedQueue || [];
            if (!replacement.assignedQueue.includes(ag.id)) {
              replacement.assignedQueue.push(ag.id);
              replacement.queueLength = replacement.assignedQueue.length;
            }
          }
        }
      }

      // 7. TURNSTILE_PROCESSING: actively processed inside turnstile booth
      else if (ag.state === 'TURNSTILE_PROCESSING') {
        ag.vx = 0;
        ag.vy = 0;
      }

      // 8. ADMITTED -> Walk to vomitory stairs and disperse into destination stand
      else if (
        ag.state === 'ADMITTED' ||
        ag.state === 'VOMITORY_DISPERSAL' ||
        ag.state === 'DESTINATION_STAND'
      ) {
        if (ag.y < 85 && ag.state === 'ADMITTED') {
          ag.state = 'VOMITORY_DISPERSAL';
        }
        if (ag.y < 50 && ag.state === 'VOMITORY_DISPERSAL') {
          ag.state = 'DESTINATION_STAND';
        }

        if (ag.currentWaypointIndex < ag.waypoints.length) {
          const wp = ag.waypoints[ag.currentWaypointIndex];
          this.steerTowards(ag, wp.x, wp.y, dt, 1.3);
          if (Math.hypot(ag.x - wp.x, ag.y - wp.y) < 10) {
            ag.currentWaypointIndex++;
          }
        } else {
          // Reached destination stand inside seating bowl: exit simulation
          ag.state = 'EXITED';
          this.agents.splice(i, 1);
        }
      }

      // 9. REJECTED / DIVERTED -> Walk down dedicated lateral recovery lane
      else if (ag.state === 'REJECTED' || ag.state === 'DIVERTED') {
        if (ag.currentWaypointIndex < ag.waypoints.length) {
          const wp = ag.waypoints[ag.currentWaypointIndex];
          this.steerTowards(ag, wp.x, wp.y, dt, 1.4);
          if (Math.hypot(ag.x - wp.x, ag.y - wp.y) < 12) {
            ag.currentWaypointIndex++;
          }
        } else {
          // Exited corridor via recovery lane
          ag.state = 'EXITED';
          this.agents.splice(i, 1);
        }
      }
    }
  }

  private steerTowards(ag: MicroGateAgent, tx: number, ty: number, dt: number, speedScale = 1.0): void {
    const dx = tx - ag.x;
    const dy = ty - ag.y;
    const dist = Math.hypot(dx, dy) || 1;
    const speedPx = ag.desiredSpeed * 20 * speedScale;

    ag.vx = (dx / dist) * speedPx;
    ag.vy = (dy / dist) * speedPx;

    ag.x += ag.vx * dt;
    ag.y += ag.vy * dt;
  }

  private updateLaneMetrics(): void {
    this.queueLanes.forEach((lane) => {
      let count = 0;
      this.agents.forEach((ag) => {
        if (ag.state === 'WAITING_IN_QUEUE' && ag.assignedLaneIndex === lane.laneIndex) {
          count++;
        }
      });
      lane.occupancy = count;
      lane.isCongested = count >= 20;
    });
  }

  // ─── Telemetry & Metrics Aggregation ─────────────────────────────────────

  private calculateMetrics(): MicroGateMetrics {
    let waitingInQueues = 0;
    let currentlyScanning = 0;
    let currentlyChecking = 0;
    let zone1ApproachCount = 0;
    let zone2HoldingCount = 0;
    let zone3ThroatCount = 0;

    this.agents.forEach((ag) => {
      if (ag.state === 'WAITING_IN_QUEUE' || ag.state === 'WAITING_FOR_TURNSTILE' || ag.state === 'TURNSTILE_WAITING') {
        waitingInQueues++;
      }
      if (ag.state === 'TICKET_SCANNING') currentlyScanning++;
      if (ag.state === 'PERSON_CHECKING') currentlyChecking++;

      // Micro 3-Zone Partitioning
      if (ag.y >= 470) {
        zone1ApproachCount++;
      } else if (ag.y >= 260) {
        zone2HoldingCount++;
      } else if (ag.y >= 130) {
        zone3ThroatCount++;
      }
    });

    const activeTurnstiles = this.turnstileCounters.filter((c) => c.status !== 'FAILED').length;
    const busyTurnstiles = this.turnstileCounters.filter((c) => c.status === 'BUSY').length;
    const idleTurnstiles = this.turnstileCounters.filter((c) => c.status === 'IDLE').length;
    const failedTurnstiles = this.turnstileCounters.filter((c) => c.status === 'FAILED').length;
    const totalTurnstiles = this.turnstileCounters.length;

    const avgWait =
      this.waitTimesHistory.length > 0
        ? this.waitTimesHistory.reduce((a, b) => a + b, 0) / this.waitTimesHistory.length
        : 0;

    const currentThru =
      this.throughputHistory.length > 0
        ? this.throughputHistory[this.throughputHistory.length - 1]
        : this.spectatorsAdmitted * 10;

    // Approximate area: Zone 1 (Approach) ~120m², Zone 2 (Holding) ~250m², Zone 3 (Throats) ~80m²
    const z1Density = Math.round((zone1ApproachCount / 120) * 10) / 10;
    const z2Density = Math.round((zone2HoldingCount / 250) * 10) / 10;
    const z3Density = Math.round((zone3ThroatCount / 80) * 10) / 10;
    const peak = Math.max(z1Density, z2Density, z3Density);

    const utilization = totalTurnstiles > 0 ? Math.round((activeTurnstiles / totalTurnstiles) * 100) : 100;

    // Sequential capacity: C_effective = min(C_scan, C_person, C_turn)
    const scanCap = Math.round(this.scanStations.length * (60 / Math.max(0.1, this.ticketScanLatencySec)));
    const personCap = Math.round(this.personCheckStations.length * (60 / Math.max(0.1, this.personCheckLatencySec)));
    const turnCap = Math.round(activeTurnstiles * (60 / Math.max(0.1, this.turnstileLatencySec)));
    const effectiveCap = Math.min(scanCap, personCap, turnCap);

    return {
      totalArrivals: this.totalArrivals,
      ticketsScanned: this.ticketsScanned,
      ticketsAccepted: this.ticketsAccepted,
      ticketsRejected: this.ticketsRejected,
      personsChecked: this.personsChecked,
      personsVerified: this.personsVerified,
      personMismatches: this.personMismatches,
      securityCleared: this.personsVerified,
      waitingInQueues,
      currentlyScanning,
      currentlyChecking,
      currentlyScreening: currentlyChecking,
      turnstilesOperational: activeTurnstiles,
      turnstilesTotal: totalTurnstiles,
      turnstilesBusy: busyTurnstiles,
      turnstilesIdle: idleTurnstiles,
      turnstilesFailed: failedTurnstiles,
      spectatorsAdmitted: this.spectatorsAdmitted,
      averageWaitTimeSec: Math.round(avgWait * 10) / 10,
      currentThroughputPerMin: currentThru,
      gateUtilizationPercent: utilization,
      ticketScanCapacityPerMin: scanCap,
      personCheckCapacityPerMin: personCap,
      turnstileCapacityPerMin: turnCap,
      effectiveCapacityPerMin: effectiveCap,
      zone1ApproachDensity: z1Density,
      zone1ApproachCount,
      zone2HoldingDensity: z2Density,
      zone2HoldingCount,
      zone3ThroatDensity: z3Density,
      zone3ThroatCount,
      peakMicroDensity: peak
    };
  }

  private log(level: 'INFO' | 'WARNING' | 'ALERT', message: string, gateId: string): void {
    if (this.onLogEvent) {
      this.onLogEvent({
        id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
        level,
        message,
        gateId
      });
    }
  }

  // ─── Getters for Rendering ───────────────────────────────────────────────

  public getAgents(): MicroGateAgent[] {
    return this.agents;
  }

  public getQueueLanes(): QueueLaneState[] {
    return this.queueLanes;
  }

  public getScanStations(): TicketScanStationState[] {
    return this.scanStations;
  }

  public getPersonCheckStations(): PersonCheckStationState[] {
    return this.personCheckStations;
  }

  /**
   * Backwards-compatible alias for existing test suite and legacy bindings.
   */
  public getScreeningStations(): SecurityScreeningStationState[] {
    return this.personCheckStations.map((chk) => ({
      id: chk.id,
      name: chk.name,
      x: chk.x,
      y: chk.y,
      status: chk.status === 'CHECKING' ? 'SCREENING' : chk.status,
      currentAgentId: chk.currentAgentId,
      screeningRemainingSec: chk.checkRemainingSec,
      nominalLatencySec: chk.nominalLatencySec,
      totalInspected: chk.totalChecked,
      totalCleared: chk.totalVerified,
      totalSecondaryReferrals: chk.totalMismatches
    }));
  }

  public getTurnstileCounters(): MicroTurnstileCounterState[] {
    return this.turnstileCounters;
  }

  public getOuterGateId(): string {
    return this.outerGateId;
  }

  public getConnectedInnerGateIds(): string[] {
    return this.innerGateIds;
  }

  public isAuxiliaryBypassActive(): boolean {
    return this.auxiliaryBypassActive;
  }
}
