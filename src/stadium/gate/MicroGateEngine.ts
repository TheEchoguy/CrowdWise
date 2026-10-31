/**
 * CROWDWISE — Phase 2.1: Microscopic Gate Operational Engine
 * M. Chinnaswamy Stadium, Bengaluru
 *
 * Microscopic Gate Simulation:
 * OUTER GATE -> APPROACH -> HOLDING & QUEUE LANES -> TICKET VALIDATION
 * -> SECURITY SCREENING -> INNER TURNSTILES -> VOMITORY -> SEATING STAND
 *
 * Implements:
 * - Sequential operational state machine
 * - Multi-lane queue balancing & switchback geometry
 * - Synthetic credential verification (QR/NFC, duplicate detection, wrong stand)
 * - Independent security screening & secondary inspection
 * - Independent turnstile counter physics (G1–G15)
 * - Lateral diversion corridor for rejected patrons
 * - Gate-specific microscopic 3-zone density monitoring
 */

import { SeededPRNG } from '../../engine/prng';
import {
  SyntheticTicket,
  MicroGateAgent,
  TicketScanStationState,
  SecurityScreeningStationState,
  MicroTurnstileCounterState,
  QueueLaneState,
  MicroGateMetrics,
  GateLogEvent
} from '../types/gateSimulation';
import { GATE_CONNECTIVITY_CATALOG, INNER_GATE_STAND_CATALOG, GateConnectionSpec } from '../network/gateConnectivity';

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
  private screeningStations: SecurityScreeningStationState[] = [];
  private turnstileCounters: MicroTurnstileCounterState[] = [];

  // Operational Configuration
  private arrivalRatePerMin = 360;
  private ticketScanLatencySec = 0.4;
  private securityScreeningLatencySec = 2.0;
  private turnstileLatencySec = 1.0;
  private rejectionRate = 0.05;
  private sQueueActive = true;
  private auxiliaryBypassActive = true;

  // Used ticket registry for duplicate detection
  private usedTicketRegistry: Set<string> = new Set();

  // Metrics
  private totalArrivals = 0;
  private ticketsScanned = 0;
  private ticketsAccepted = 0;
  private ticketsRejected = 0;
  private securityCleared = 0;
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
   * Fully reconfigures queue lanes, scan stations, security checkpoints and turnstiles.
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

    // 2. Ticket Validation Stations (NFC / QR Scanners at y = 240)
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

    // 3. Security Screening Stations (Baggage Inspection / Frisking at y = 195)
    const secCount = 4;
    this.screeningStations = [];
    const secSpacing = queueAreaWidth / secCount;
    for (let i = 0; i < secCount; i++) {
      this.screeningStations.push({
        id: `SEC-${i + 1}`,
        name: `Metal Detector ${i + 1}`,
        x: queueAreaLeft + i * secSpacing + secSpacing / 2,
        y: 195,
        status: 'IDLE',
        currentAgentId: null,
        screeningRemainingSec: 0,
        nominalLatencySec: this.securityScreeningLatencySec,
        totalInspected: 0,
        totalCleared: 0,
        totalSecondaryReferrals: 0
      });
    }

    // 4. Inner Turnstile Counters (G1–G15 at y = 150)
    this.turnstileCounters = [];
    let counterIndex = 1;

    // Distribute turnstiles across connected inner gates
    this.innerGateIds.forEach((gid) => {
      const standSpec = INNER_GATE_STAND_CATALOG[gid];
      const count = standSpec ? Math.min(6, standSpec.turnstileCount) : 4;
      const bankWidth = queueAreaWidth / this.innerGateIds.length;
      const bankStartX = queueAreaLeft + (this.innerGateIds.indexOf(gid)) * bankWidth;
      const counterSpacing = bankWidth / count;

      for (let c = 1; c <= count; c++) {
        this.turnstileCounters.push({
          counterId: `${gid}-${c}`,
          gateId: gid,
          standName: standSpec ? standSpec.standName : 'General Stand',
          laneIndex: counterIndex++,
          x: bankStartX + (c - 0.5) * counterSpacing,
          y: 150,
          status: 'IDLE',
          currentAgentId: null,
          serviceRemainingSec: 0,
          nominalLatencySec: this.turnstileLatencySec,
          processedCount: 0
        });
      }
    });

    if (isRestricted) {
      this.log('WARNING', `Gate ${this.outerGateId} is strictly RESTRICTED (VIP / Media only). Public ticket holders diverted.`, this.outerGateId);
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
    this.securityCleared = 0;
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

  public setSecurityScreeningLatency(sec: number): void {
    this.securityScreeningLatencySec = Math.max(0.5, Math.min(8.0, sec));
    this.screeningStations.forEach((s) => (s.nominalLatencySec = this.securityScreeningLatencySec));
  }

  public setTurnstileLatency(sec: number): void {
    this.turnstileLatencySec = Math.max(0.2, Math.min(3.0, sec));
    this.turnstileCounters.forEach((t) => (t.nominalLatencySec = this.turnstileLatencySec));
  }

  public setRejectionRate(rate: number): void {
    this.rejectionRate = Math.max(0, Math.min(1.0, rate));
  }

  public setSQueueActive(active: boolean): void {
    this.sQueueActive = active;
    this.reconfigureCorridor();
  }

  public setAuxiliaryBypassActive(active: boolean): void {
    this.auxiliaryBypassActive = active;
  }

  /**
   * Simulates hardware scanner malfunction at station.
   */
  public toggleScannerFailure(stationIndex = 0): void {
    if (this.scanStations[stationIndex]) {
      const s = this.scanStations[stationIndex];
      s.status = s.status === 'FAILED' ? 'IDLE' : 'FAILED';
      this.log('ALERT', `Ticket Scanner ${s.id} status changed to ${s.status}`, this.outerGateId);
    }
  }

  /**
   * Simulates turnstile counter breakdown.
   */
  public toggleTurnstileFailure(counterIndex = 0): void {
    if (this.turnstileCounters[counterIndex]) {
      const t = this.turnstileCounters[counterIndex];
      t.status = t.status === 'FAILED' ? 'IDLE' : 'FAILED';
      this.log('ALERT', `Turnstile Counter ${t.counterId} status changed to ${t.status}`, t.gateId);
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

  // ─── Synthetic Ticket Generation ─────────────────────────────────────────

  private generateSyntheticTicket(): SyntheticTicket {
    const isRestrictedGate = (GATE_CONNECTIVITY_CATALOG[this.outerGateId]?.accessPermission === 'RESTRICTED_VIP_MEDIA');
    const randomVal = this.prng.nextFloat();
    const authorizedInnerGate = this.innerGateIds[Math.floor(this.prng.nextFloat() * this.innerGateIds.length)] || 'G8';
    const standSpec = INNER_GATE_STAND_CATALOG[authorizedInnerGate];
    const authorizedStand = standSpec ? standSpec.standName : 'C Stand';

    const ticketId = `TKT-${Math.floor(100000 + this.prng.nextFloat() * 900000)}`;

    // Rejection simulation based on configured rate
    if (isRestrictedGate) {
      return {
        ticketId,
        isValid: false,
        authorizedStand,
        authorizedInnerGate,
        isDuplicate: false,
        isExpired: false,
        status: 'WRONG_GATE'
      };
    }

    if (randomVal < this.rejectionRate) {
      const rType = this.prng.nextFloat();
      if (rType < 0.3) {
        return { ticketId, isValid: false, authorizedStand, authorizedInnerGate, isDuplicate: false, isExpired: false, status: 'INVALID_QR' };
      } else if (rType < 0.6) {
        return { ticketId, isValid: false, authorizedStand, authorizedInnerGate, isDuplicate: true, isExpired: false, status: 'DUPLICATE' };
      } else if (rType < 0.8) {
        return { ticketId, isValid: false, authorizedStand: 'P Terrace (South)', authorizedInnerGate: 'G1', isDuplicate: false, isExpired: false, status: 'WRONG_STAND' };
      } else {
        return { ticketId, isValid: false, authorizedStand, authorizedInnerGate, isDuplicate: false, isExpired: true, status: 'EXPIRED' };
      }
    }

    return {
      ticketId,
      isValid: true,
      authorizedStand,
      authorizedInnerGate,
      isDuplicate: false,
      isExpired: false,
      status: 'VALID'
    };
  }

  /**
   * Spawns a new pedestrian agent on the arrival sidewalk.
   */
  public spawnAgent(): boolean {
    const laneIndex = this.selectBalancedLane();
    const lane = this.queueLanes[laneIndex];
    if (!lane) return false;

    const ticket = this.generateSyntheticTicket();
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
      assignedLaneIndex: laneIndex,
      assignedScanStationId: null,
      assignedScreeningStationId: null,
      assignedTurnstileCounterId: null,
      targetInnerGateId: assignedInnerGateId,
      targetStandName: standSpec ? standSpec.standName : 'C Stand',
      entryTimeSec: performance.now() / 1000,
      timeInCurrentStateSec: 0,
      totalWaitTimeSec: 0,
      isDiverted: false,
      isSecondaryScreening: false,
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

    // 2. Step Stations (Scan, Security, Turnstiles)
    this.stepScanStations(dt);
    this.stepScreeningStations(dt);
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
          // Validation Completed!
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

    if (agent.ticket.isValid && !agent.ticket.isDuplicate && !agent.ticket.isExpired && agent.ticket.status === 'VALID') {
      // Accepted!
      station.totalAccepted++;
      this.ticketsAccepted++;
      this.usedTicketRegistry.add(agent.ticket.ticketId);

      agent.state = 'SECURITY_SCREENING';
      agent.timeInCurrentStateSec = 0;
      agent.currentWaypointIndex = 0;
      agent.waypoints = [{ x: station.x, y: 215 }, { x: station.x, y: 195 }];
    } else {
      // Rejected! Divert to lateral recovery corridor
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

      this.log('WARNING', `Ticket Rejected: ID ${agent.ticket.ticketId} (${agent.ticket.status}) -> Diverted to Recovery Lane`, this.outerGateId);
    }
  }

  private stepScreeningStations(dt: number): void {
    this.screeningStations.forEach((station) => {
      if (station.status === 'FAILED') return;

      if (station.status === 'SCREENING' && station.currentAgentId !== null) {
        station.screeningRemainingSec -= dt;
        if (station.screeningRemainingSec <= 0) {
          // Screening Cleared!
          const agent = this.agents.find((a) => a.id === station.currentAgentId);
          if (agent) {
            station.totalInspected++;
            station.totalCleared++;
            this.securityCleared++;

            agent.state = 'TURNSTILE_WAITING';
            agent.timeInCurrentStateSec = 0;

            // Target appropriate turnstile counter matching authorized gate
            const counter = this.findBestTurnstile(agent.targetInnerGateId);
            if (counter) {
              agent.assignedTurnstileCounterId = counter.counterId;
              agent.waypoints = [{ x: counter.x, y: 168 }, { x: counter.x, y: 152 }];
              agent.currentWaypointIndex = 0;
            }
          }
          station.status = 'IDLE';
          station.currentAgentId = null;
        }
      }
    });
  }

  private findBestTurnstile(gateId: string): MicroTurnstileCounterState | undefined {
    const matching = this.turnstileCounters.filter((c) => c.gateId === gateId && c.status !== 'FAILED');
    if (matching.length > 0) {
      // Pick idle or shortest queue
      const idle = matching.find((c) => c.status === 'IDLE');
      if (idle) return idle;
      return matching[Math.floor(this.prng.nextFloat() * matching.length)];
    }
    return this.turnstileCounters.find((c) => c.status !== 'FAILED');
  }

  private stepTurnstiles(dt: number): void {
    this.turnstileCounters.forEach((counter) => {
      if (counter.status === 'FAILED') return;

      if (counter.status === 'BUSY' && counter.currentAgentId !== null) {
        counter.serviceRemainingSec -= dt;
        if (counter.serviceRemainingSec <= 0) {
          // Admitted through turnstile!
          const agent = this.agents.find((a) => a.id === counter.currentAgentId);
          if (agent) {
            counter.processedCount++;
            this.spectatorsAdmitted++;
            this.recentAdmittedCount++;
            this.waitTimesHistory.push(agent.totalWaitTimeSec);
            if (this.waitTimesHistory.length > 100) this.waitTimesHistory.shift();

            agent.state = 'ADMITTED';
            agent.timeInCurrentStateSec = 0;

            // Direct through concourse to vomitory stairwell
            const vomitoryX = counter.x < 480 ? counter.x - 30 : counter.x + 30;
            agent.waypoints = [
              { x: counter.x, y: 130 },
              { x: vomitoryX, y: 95 },
              { x: vomitoryX, y: 45 }
            ];
            agent.currentWaypointIndex = 0;
          }
          counter.status = 'IDLE';
          counter.currentAgentId = null;
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
            // Wait at scan threshold
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

      // 4. SECURITY_SCREENING -> Move to inspection checkpoint
      else if (ag.state === 'SECURITY_SCREENING') {
        if (ag.currentWaypointIndex < ag.waypoints.length) {
          const wp = ag.waypoints[ag.currentWaypointIndex];
          this.steerTowards(ag, wp.x, wp.y, dt, 1.1);
          if (Math.hypot(ag.x - wp.x, ag.y - wp.y) < 10) {
            ag.currentWaypointIndex++;
          }
        } else {
          // Try assign to idle security booth
          const idleSec = this.screeningStations.find((s) => s.status === 'IDLE');
          if (idleSec) {
            idleSec.status = 'SCREENING';
            idleSec.currentAgentId = ag.id;
            idleSec.screeningRemainingSec = idleSec.nominalLatencySec;
            ag.assignedScreeningStationId = idleSec.id;
            ag.x = idleSec.x;
            ag.y = idleSec.y;
          } else {
            ag.vx = 0;
            ag.vy = 0;
          }
        }
      }

      // 5. TURNSTILE_WAITING -> Approach turnstile counter
      else if (ag.state === 'TURNSTILE_WAITING') {
        const counter = this.turnstileCounters.find((c) => c.counterId === ag.assignedTurnstileCounterId);
        if (counter && counter.status === 'IDLE') {
          counter.status = 'BUSY';
          counter.currentAgentId = ag.id;
          counter.serviceRemainingSec = counter.nominalLatencySec;
          ag.state = 'TURNSTILE_PROCESSING';
          ag.x = counter.x;
          ag.y = counter.y + 4;
        } else if (ag.currentWaypointIndex < ag.waypoints.length) {
          const wp = ag.waypoints[ag.currentWaypointIndex];
          this.steerTowards(ag, wp.x, wp.y, dt, 0.9);
          if (Math.hypot(ag.x - wp.x, ag.y - wp.y) < 10) {
            ag.currentWaypointIndex++;
          }
        } else {
          ag.vx = 0;
          ag.vy = 0;
        }
      }

      // 6. TURNSTILE_PROCESSING: StepTurnstiles handles completion
      else if (ag.state === 'TURNSTILE_PROCESSING') {
        ag.vx = 0;
        ag.vy = 0;
      }

      // 7. ADMITTED -> Walk to vomitory stairs into stand
      else if (ag.state === 'ADMITTED') {
        if (ag.currentWaypointIndex < ag.waypoints.length) {
          const wp = ag.waypoints[ag.currentWaypointIndex];
          this.steerTowards(ag, wp.x, wp.y, dt, 1.3);
          if (Math.hypot(ag.x - wp.x, ag.y - wp.y) < 12) {
            ag.currentWaypointIndex++;
          }
        } else {
          // Reached seating bowl vomitory: exit simulation
          ag.state = 'EXITED';
          this.agents.splice(i, 1);
        }
      }

      // 8. REJECTED / DIVERTED -> Walk down dedicated lateral recovery lane
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
    let currentlyScreening = 0;
    let zone1ApproachCount = 0;
    let zone2HoldingCount = 0;
    let zone3ThroatCount = 0;

    this.agents.forEach((ag) => {
      if (ag.state === 'WAITING_IN_QUEUE') waitingInQueues++;
      if (ag.state === 'TICKET_SCANNING') currentlyScanning++;
      if (ag.state === 'SECURITY_SCREENING') currentlyScreening++;

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

    return {
      totalArrivals: this.totalArrivals,
      ticketsScanned: this.ticketsScanned,
      ticketsAccepted: this.ticketsAccepted,
      ticketsRejected: this.ticketsRejected,
      securityCleared: this.securityCleared,
      waitingInQueues,
      currentlyScanning,
      currentlyScreening,
      turnstilesOperational: activeTurnstiles,
      turnstilesTotal: totalTurnstiles,
      spectatorsAdmitted: this.spectatorsAdmitted,
      averageWaitTimeSec: Math.round(avgWait * 10) / 10,
      currentThroughputPerMin: currentThru,
      gateUtilizationPercent: utilization,
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

  public getScreeningStations(): SecurityScreeningStationState[] {
    return this.screeningStations;
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
