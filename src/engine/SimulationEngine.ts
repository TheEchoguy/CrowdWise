import {
  Venue,
  Gate,
  Zone,
  Corridor,
  CrowdAgent,
  AgentState,
  Vector2D,
  InflowConfig,
  Intervention,
  Incident,
  SimulationEvent,
  OperatorRecommendation,
  SimulationMetricsSummary,
  StadiumSide,
  GateRoutingPolicy,
  GateSideSimConfig,
  GateSideEvent,
  GateEntrySnapshot,
  GateLaneMetrics,
  OverflowDoorConfig,
  OverflowDoorStatus,
  DemonstrationProfileType,
  createDefaultOverflowDoor,
  GateClosureReason,
  GateClosureState,
  GateClosureScenarioType,
  AlternativeGateEvaluation,
  GateClosureIncidentRecord,
  ValidationMetricType,
  ModelCalibrationParameters,
  MultiDirectionalPresetType,
  StreamInterventionType,
  PedestrianStreamConfig,
  MultiDirectionalMetrics,
  SpatialZoneRiskSummary,
  HotspotPropagationPrediction,
  ZoneRiskLevel,
} from '../types';
import { PRNG } from './random';
import { distance, normalize, sub, add, scale, pointInPolygon } from './geometry';
import { SpatialHashGrid } from './spatialHash';
import { NavigationGraph } from './pathfinding';
import { getGateSpawnPoint } from '../data/chinnaswamyStadium';

export interface SimulationState {
  simTimeSecs: number;
  isRunning: boolean;
  isPaused: boolean;
  speedMultiplier: number;
  venue: Venue;
  agents: CrowdAgent[];
  inflowConfig: InflowConfig;
  interventions: Intervention[];
  incidents: Incident[];
  events: SimulationEvent[];
  recommendations: OperatorRecommendation[];
  metricsHistory: SimulationMetricsSummary[];
  randomSeed: number;
}

const SHIRT_COLORS = [
  '#06B6D4', // Cyan
  '#3B82F6', // Blue
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#EF4444', // Red (RCB / Team color)
  '#F59E0B', // Amber
  '#10B981', // Emerald
  '#64748B', // Slate
  '#E2E8F0', // White/Light
];

const SKIN_TONES = ['#F8D9C0', '#ECC19C', '#D09B74', '#A06E47', '#734A29'];

export class SimulationEngine {
  public state: SimulationState;
  private prng: PRNG;
  private spatialGrid: SpatialHashGrid;
  private navGraph: NavigationGraph;
  private nextAgentId: number = 1;
  private spawnAccumulator: number = 0;
  private lastMetricsRecordTime: number = 0;
  private activeAdmissionPauseUntil: number = 0;

  // Gate-Side Simulation State
  public gateSideConfig: GateSideSimConfig = {
    selectedSide: 'ALL',
    selectedGateIds: [],
    inflowRatePerMin: 120,
    arrivalPattern: 'GRADUAL',
    processingRatePerSec: 1.0,
    initialQueue: 0,
    routingPolicy: 'SHORTEST_QUEUE',
    spillbackThreshold: 80,
    durationSecs: 300,
  };
  public gateSideEvents: GateSideEvent[] = [];
  public totalAdmittedCount: number = 0;
  public totalGeneratedArrivals: number = 0;
  public totalRedirectedPedestrians: number = 0;
  public gateEntryHistory: GateEntrySnapshot[] = [];
  private gateProcessingAccumulators: Map<string, number> = new Map();
  private gateMeterAccumulators: Map<string, number> = new Map();
  private gateArrivalAccumulator: number = 0;
  private gateArrivalAccumulators: Map<string, number> = new Map();
  private counterProcessingAccumulators: Map<string, number> = new Map();
  private overflowProcessingAccumulators: Map<string, number> = new Map();
  private lastRerouteLogTime: number = 0;
  private lastHoldingLogTime: number = 0;
  private previouslyUnavailableGates: Set<string> = new Set();
  private gateRecentArrivalTimestamps: Map<string, number[]> = new Map();

  constructor(initialVenue: Venue, seed: number = 1337) {
    this.prng = new PRNG(seed);
    this.spatialGrid = new SpatialHashGrid(3.5);
    this.navGraph = new NavigationGraph();

    this.state = {
      simTimeSecs: 0,
      isRunning: false,
      isPaused: false,
      speedMultiplier: 1.0,
      venue: JSON.parse(JSON.stringify(initialVenue)),
      agents: [],
      inflowConfig: {
        estimatedAttendance: initialVenue.planningCapacity || 40000,
        eventStartTimeMinutes: 60,
        arrivalDurationMinutes: 90,
        pattern: 'PEAK_SURGE',
        burstIntensity: 2.0,
        transportPulseIntervalMinutes: 10,
        unexpectedCrowdAddition: 5000,
      },
      interventions: [],
      incidents: [],
      events: [],
      recommendations: [],
      metricsHistory: [],
      randomSeed: seed,
    };

    this.state.venue.gates.forEach((g) => {
      g.totalArrivalsCount = g.totalArrivalsCount || 0;
      g.totalProcessedCount = g.totalProcessedCount || 0;
      g.admittedCount = g.admittedCount || g.totalProcessedCount || 0;
      g.maxQueueRecorded = g.maxQueueRecorded || 0;
      g.spillbackCount = g.spillbackCount || 0;
      g.initialQueue = g.initialQueue || 0;
      g.queueAreaCapacity = g.queueAreaCapacity || 80;
      g.redirectedCount = g.redirectedCount || 0;
      g.deflectedCount = g.deflectedCount || 0;
      g.assignedIncomingDemand = g.assignedIncomingDemand || 0;
      g.isReroutingActive = false;
      g.unavailabilityReason = undefined;

      // 12-Gate Ticket System Defaults
      if (g.assignedSpectatorCount === undefined) {
        g.assignedSpectatorCount = g.gateType === 'VIP' ? 500 : (g.gateType === 'EXIT_ONLY' ? 0 : 4000);
      }
      if (g.holdingAreaCapacity === undefined) {
        g.holdingAreaCapacity = g.gateType === 'REGULAR' ? 500 : 200;
      }
      g.holdingAreaOccupancy = g.holdingAreaOccupancy || 0;
      g.inHoldingCount = g.inHoldingCount || 0;
      g.waitingInQueueCount = g.waitingInQueueCount || g.currentQueue || 0;
      g.processingCount = g.processingCount || 0;
      g.remainingToArriveCount = Math.max(0, g.assignedSpectatorCount - (g.totalArrivalsCount || 0));
      g.maxSafeQueueOccupancy = g.maxSafeQueueOccupancy || (g.gateType === 'REGULAR' ? 400 : 100);
      g.operationalControlState = g.operationalControlState || 'NORMAL';
      g.strictTicketEnforcement = g.strictTicketEnforcement !== undefined ? g.strictTicketEnforcement : true;

      // Ensure 3 counters exist for regular gates
      if (!g.counters || g.counters.length === 0) {
        if (g.gateType === 'REGULAR' || (!g.gateType && g.direction === 'ENTRY')) {
          g.counters = [
            { id: `${g.id}-c1`, name: 'Counter 1', status: 'OPERATIONAL', serviceRatePerSec: 1.0, totalProcessedCount: 0 },
            { id: `${g.id}-c2`, name: 'Counter 2', status: 'OPERATIONAL', serviceRatePerSec: 1.0, totalProcessedCount: 0 },
            { id: `${g.id}-c3`, name: 'Counter 3', status: 'OPERATIONAL', serviceRatePerSec: 1.0, totalProcessedCount: 0 },
          ];
          g.scannerCount = 3;
          g.operationalScanners = 3;
        } else if (g.gateType === 'VIP') {
          g.counters = [
            { id: `${g.id}-c1`, name: 'Counter 1', status: 'OPERATIONAL', serviceRatePerSec: 1.0, totalProcessedCount: 0 },
            { id: `${g.id}-c2`, name: 'Counter 2', status: 'OPERATIONAL', serviceRatePerSec: 1.0, totalProcessedCount: 0 },
          ];
          g.scannerCount = 2;
          g.operationalScanners = 2;
        } else {
          g.counters = [];
          g.scannerCount = 0;
          g.operationalScanners = 0;
        }
      }

      // Ensure 4th Overflow Entry Door is configured for regular entry gates
      if (g.gateType === 'REGULAR' && !g.overflowDoor) {
        g.overflowDoor = createDefaultOverflowDoor(g.id);
      } else if (g.gateType !== 'REGULAR') {
        g.overflowDoor = undefined;
      }

      // Ensure holdingAreaPosition and spawnPosition exist
      if (!g.holdingAreaPosition) {
        const dx = g.position.x - 130;
        const dy = g.position.y - 110;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        g.holdingAreaPosition = {
          x: Math.round(g.position.x + (dx / len) * 16),
          y: Math.round(g.position.y + (dy / len) * 16),
        };
      }

      if (!g.spawnPosition) {
        g.spawnPosition = getGateSpawnPoint(g);
      }

      if (g.arrivalRatePerMin === undefined) {
        g.arrivalRatePerMin = g.gateType === 'REGULAR' ? 120 : (g.gateType === 'VIP' ? 20 : 0);
      }

      if (g.counters && g.counters.length > 0) {
        const cx = 130;
        const cy = 110;
        const dirX = g.position.x - cx;
        const dirY = g.position.y - cy;
        const len = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
        const tx = -(dirY / len);
        const ty = dirX / len;
        const lanes = g.counters.length;
        g.counters.forEach((c, idx) => {
          const offsetT = ((idx - (lanes - 1) / 2) / lanes) * (g.width * 0.75);
          c.position = {
            x: Math.round((g.position.x + tx * offsetT) * 10) / 10,
            y: Math.round((g.position.y + ty * offsetT) * 10) / 10,
          };
          c.totalProcessedCount = c.totalProcessedCount || 0;
          c.queueCount = c.queueCount || 0;
          c.isProcessing = false;
        });
      }

      (g as any)._lastOperationalScanners = g.operationalScanners;
      if (g.counters) {
        g.counters.forEach((c) => {
          (c as any)._lastStatus = c.status;
        });
      }
      if (g.overflowDoor) {
        g.overflowDoor.status = 'CLOSED';
        g.overflowDoor.doorProgress = 0.0;
        g.overflowDoor.sustainedExtremeTimer = 0.0;
        g.overflowDoor.recoveryTimer = 0.0;
        g.overflowDoor.queueCount = 0;
        g.overflowDoor.processingCount = 0;
        g.overflowDoor.totalProcessedCount = 0;
        g.overflowDoor.timeSpentOpenSecs = 0.0;
        g.overflowDoor.activationReason = undefined;
        g.overflowDoor.manualOverride = 'AUTO';
      }
      g.isArrivalsPaused = false;
    });

    this.buildNavigationGraph();
    this.recordMetricsSnapshot();
    this.gateEntryHistory = [];
  }

  public setVenue(venue: Venue): void {
    this.state.venue = JSON.parse(JSON.stringify(venue));
    for (const g of this.state.venue.gates) {
      if (g.gateType === 'REGULAR' && !g.overflowDoor) {
        g.overflowDoor = createDefaultOverflowDoor(g.id);
      } else if (g.gateType !== 'REGULAR') {
        g.overflowDoor = undefined;
      }
    }
    this.buildNavigationGraph();
    this.reset();
  }

  public setSeed(seed: number): void {
    this.state.randomSeed = seed;
    this.prng.reset(seed);
  }

  public setInterventions(interventions: Intervention[]): void {
    this.state.interventions = JSON.parse(JSON.stringify(interventions));
    this.checkInterventionSideEffects();
  }

  public setInflowConfig(config: Partial<InflowConfig>): void {
    this.state.inflowConfig = { ...this.state.inflowConfig, ...config };
  }

  public setSpeed(multiplier: number): void {
    this.state.speedMultiplier = Math.max(0.25, Math.min(10, multiplier));
  }

  public setGateSideConfig(config: Partial<GateSideSimConfig>): void {
    const prev = { ...this.gateSideConfig };
    this.gateSideConfig = { ...this.gateSideConfig, ...config };

    if (config.inflowRatePerMin !== undefined && config.inflowRatePerMin !== prev.inflowRatePerMin) {
      this.logGateSideEvent(
        'INFLOW_CHANGE',
        `Inflow rate set to ${config.inflowRatePerMin} people/min (${(config.inflowRatePerMin / 60).toFixed(2)} ppl/s)`
      );
    }

    if (config.inflowRatePerMin !== undefined) {
      const targetGates = this.state.venue.gates.filter((g) =>
        this.gateSideConfig.selectedGateIds.includes(g.id)
      );
      targetGates.forEach((g) => {
        g.arrivalRatePerMin = config.inflowRatePerMin!;
      });
    } else if (config.selectedGateIds !== undefined && this.gateSideConfig.inflowRatePerMin !== undefined) {
      const targetGates = this.state.venue.gates.filter((g) =>
        this.gateSideConfig.selectedGateIds.includes(g.id)
      );
      targetGates.forEach((g) => {
        g.arrivalRatePerMin = this.gateSideConfig.inflowRatePerMin;
      });
    }

    if (config.processingRatePerSec !== undefined) {
      const rateSec = config.processingRatePerSec;
      const rateMin = Math.round(rateSec * 60);
      const targetGates = this.state.venue.gates.filter((g) =>
        this.gateSideConfig.selectedGateIds.includes(g.id)
      );
      targetGates.forEach((g) => {
        g.scannerProcessingRatePerSec = rateSec;
        g.scannerProcessingRatePerMin = rateMin;
        if (g.counters) {
          g.counters.forEach((c) => {
            c.serviceRatePerSec = rateSec;
          });
        }
      });
      if (rateSec !== prev.processingRatePerSec) {
        this.logGateSideEvent(
          'CONFIG_CHANGE',
          `Scanner processing speed set to ${rateSec.toFixed(2)} people/sec/counter (${rateMin} ppl/min)`
        );
      }
    }

    if (config.operationalScannersOverride !== undefined) {
      const targetGates = this.state.venue.gates.filter((g) =>
        this.gateSideConfig.selectedGateIds.includes(g.id)
      );
      targetGates.forEach((g) => {
        const desired = Math.min(g.scannerCount, Math.max(0, config.operationalScannersOverride!));
        g.operationalScanners = desired;
        if (g.counters) {
          g.counters.forEach((c, idx) => {
            c.status = idx < desired ? 'OPERATIONAL' : 'FAILED';
          });
        }
        if (desired === 0) {
          g.operationalControlState = 'ADMISSION_PAUSED';
          g.status = 'SCANNER_FAILURE';
        } else if (g.operationalControlState === 'ADMISSION_PAUSED') {
          g.operationalControlState = 'RECOVERY';
          g.status = 'OPERATIONAL';
        }
      });
    }
  }

  public logGateSideEvent(arg1: string, arg2: string, arg3?: string): void {
    let gateId: string | undefined;
    let type: GateSideEvent['type'];
    let message: string;

    if (arg3 !== undefined) {
      gateId = arg1;
      type = arg2 as GateSideEvent['type'];
      message = arg3;
    } else {
      type = arg1 as GateSideEvent['type'];
      message = arg2;
    }

    const simSecs = Math.floor(this.state.simTimeSecs);
    const mins = Math.floor(simSecs / 60);
    const secs = simSecs % 60;
    const timeFormatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    const evt: GateSideEvent = {
      id: `gse-${Date.now()}-${Math.random()}`,
      timestamp: simSecs,
      timeFormatted,
      type,
      message,
    };
    (evt as any).gateId = gateId;
    this.gateSideEvents.unshift(evt);
    if (this.gateSideEvents.length > 80) {
      this.gateSideEvents.pop();
    }
  }

  public applyInitialQueue(count: number, gateIds?: string[]): void {
    const targets =
      gateIds && gateIds.length > 0
        ? this.state.venue.gates.filter((g) => gateIds.includes(g.id))
        : this.state.venue.gates.filter((g) => this.gateSideConfig.selectedGateIds.includes(g.id));

    if (targets.length === 0) return;

    for (const g of targets) {
      const removedCount = this.state.agents.filter(
        (a) => a.targetGateId === g.id && (a.state === 'QUEUING' || a.state === 'PROCESSING')
      ).length;
      this.state.agents = this.state.agents.filter(
        (a) => !(a.targetGateId === g.id && (a.state === 'QUEUING' || a.state === 'PROCESSING'))
      );
      this.totalGeneratedArrivals = Math.max(0, this.totalGeneratedArrivals - removedCount);

      g.currentQueue = count;
      g.initialQueue = count;
      g.totalArrivalsCount = (g.totalArrivalsCount || 0) + count;
      g.maxQueueRecorded = Math.max(g.maxQueueRecorded || 0, count);
      this.totalGeneratedArrivals += count;

      const cx = this.state.venue.dimensions.width / 2;
      const cy = this.state.venue.dimensions.height / 2;
      const dirX = g.position.x - cx;
      const dirY = g.position.y - cy;
      const len = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
      const nx = dirX / len;
      const ny = dirY / len;
      const tx = -ny;
      const ty = nx;

      const visualCount = count;
      if (g.counters) {
        // Respect explicitly set counter statuses if any exist
        const hasFailedCounter = g.counters.some((c) => c.status === 'FAILED');
        if (hasFailedCounter) {
          g.operationalScanners = g.counters.filter((c) => c.status === 'OPERATIONAL').length;
        } else if (g.operationalScanners !== undefined && g.operationalScanners < g.counters.length) {
          g.counters.forEach((c, idx) => {
            c.status = idx < g.operationalScanners ? 'OPERATIONAL' : 'FAILED';
            (c as any)._lastStatus = c.status;
          });
        }
      }

      const operationalCounterIndices = g.counters
        ? g.counters.map((c, i) => (c.status === 'OPERATIONAL' ? i : -1)).filter((i) => i !== -1)
        : [];
      const numActive = operationalCounterIndices.length > 0 ? operationalCounterIndices.length : Math.max(1, g.operationalScanners || 1);
      const lanes = Math.max(1, g.counters?.length || g.scannerCount || 3);
      const totalLanes = lanes;

      for (let k = 0; k < visualCount; k++) {
        const lane = operationalCounterIndices.length > 0 ? operationalCounterIndices[k % numActive] : (k % numActive);
        const depth = Math.floor(k / numActive);
        const offsetT = ((lane - (totalLanes - 1) / 2) / totalLanes) * (g.width * 0.75);
        const distBack = 1.8 + depth * 0.9;

        const posX = g.position.x + nx * distBack + tx * offsetT;
        const posY = g.position.y + ny * distBack + ty * offsetT;
        const isProc = depth === 0;
        const agent: CrowdAgent = {
          id: this.nextAgentId++,
          x: posX,
          y: posY,
          vx: 0,
          vy: 0,
          targetX: g.position.x,
          targetY: g.position.y,
          preferredSpeed: this.prng.range(1.15, 1.4),
          radius: 0.32,
          state: isProc ? 'PROCESSING' : 'QUEUING',
          assignedLane: lane,
          assignedCounterId: g.counters?.[lane]?.id,
          assignedGateId: g.id,
          targetGateId: g.id,
          ticketGateId: g.id,
          inHoldingArea: false,
          pathWaypoints: [g.position],
          currentWaypointIdx: 0,
          shirtColor: this.prng.choice(SHIRT_COLORS),
          skinColor: this.prng.choice(SKIN_TONES),
          stridePhase: this.prng.range(0, Math.PI * 2),
          facingAngle: Math.atan2(-ny, -nx),
          arrivalTime: this.state.simTimeSecs,
          waitDurationSecs: 0,
        };
        this.state.agents.push(agent);
      }

      const inProc = Math.min(visualCount, Math.min(lanes, g.operationalScanners));
      g.processingCount = inProc;
      g.waitingInQueueCount = Math.max(0, visualCount - inProc);
      g.remainingToArriveCount = Math.max(0, (g.assignedSpectatorCount || 4000) - (g.totalArrivalsCount || 0));
      g.counter1QueueCount = this.state.agents.filter((a) => (a.state === 'QUEUING' || a.state === 'PROCESSING') && a.targetGateId === g.id && a.assignedLane === 0).length;
      g.counter2QueueCount = this.state.agents.filter((a) => (a.state === 'QUEUING' || a.state === 'PROCESSING') && a.targetGateId === g.id && a.assignedLane === 1).length;
      g.counter3QueueCount = this.state.agents.filter((a) => (a.state === 'QUEUING' || a.state === 'PROCESSING') && a.targetGateId === g.id && a.assignedLane === 2).length;
      if (g.counters?.[0]) g.counters[0].queueCount = g.counter1QueueCount;
      if (g.counters?.[1]) g.counters[1].queueCount = g.counter2QueueCount;
      if (g.counters?.[2]) g.counters[2].queueCount = g.counter3QueueCount;
    }

    this.logGateSideEvent(
      'CONFIG_CHANGE',
      `Initial queue of ${count} people applied to ${targets.map((g) => g.name).join(', ')}`
    );
  }

  private buildNavigationGraph(): void {
    this.navGraph = new NavigationGraph();
    const v = this.state.venue;

    // Approach nodes
    v.approachRoutes.forEach((ar) => {
      this.navGraph.addNode({ id: `nav-app-${ar.id}`, position: ar.startPoint });
    });

    // Gate nodes, dedicated holding area nodes, and dedicated gate spawn nodes
    v.gates.forEach((g) => {
      this.navGraph.addNode({ id: `nav-gate-${g.id}`, position: g.position, gateId: g.id });
      if (g.holdingAreaPosition) {
        this.navGraph.addNode({ id: `nav-hold-${g.id}`, position: g.holdingAreaPosition });
        this.navGraph.addEdge(`nav-hold-${g.id}`, `nav-gate-${g.id}`, 6);
        this.navGraph.addEdge(`nav-gate-${g.id}`, `nav-hold-${g.id}`, 6);
      }
      const spawnPos = g.spawnPosition || getGateSpawnPoint(g);
      this.navGraph.addNode({ id: `nav-spawn-${g.id}`, position: spawnPos });
      this.navGraph.addEdge(`nav-spawn-${g.id}`, `nav-gate-${g.id}`, g.width || 8);
      this.navGraph.addEdge(`nav-gate-${g.id}`, `nav-spawn-${g.id}`, g.width || 8);
      if (g.holdingAreaPosition) {
        this.navGraph.addEdge(`nav-spawn-${g.id}`, `nav-hold-${g.id}`, 8);
      }
    });

    // Zone centroid nodes
    v.zones.forEach((z) => {
      let cx = 0,
        cy = 0;
      z.polygon.forEach((p) => {
        cx += p.x;
        cy += p.y;
      });
      const center = { x: cx / z.polygon.length, y: cy / z.polygon.length };
      this.navGraph.addNode({ id: `nav-zone-${z.id}`, position: center, zoneId: z.id });
    });

    // Attraction points
    v.attractions.forEach((a) => {
      this.navGraph.addNode({ id: `nav-attr-${a.id}`, position: a.position });
    });

    // Medical points
    v.medicalPoints.forEach((m) => {
      this.navGraph.addNode({ id: `nav-med-${m.id}`, position: m.position });
    });

    // Connect approach routes to nearest gates and holding areas
    v.approachRoutes.forEach((ar) => {
      ar.entryGateIds.forEach((gid) => {
        this.navGraph.addEdge(`nav-app-${ar.id}`, `nav-gate-${gid}`, ar.width);
        const g = v.gates.find((gate) => gate.id === gid);
        if (g?.holdingAreaPosition) {
          this.navGraph.addEdge(`nav-app-${ar.id}`, `nav-hold-${gid}`, ar.width);
        }
      });
    });

    // Connect adjacent gates along outer perimeter concourse ring for seamless rerouting
    for (let i = 0; i < v.gates.length; i++) {
      const next = (i + 1) % v.gates.length;
      this.navGraph.addEdge(`nav-gate-${v.gates[i].id}`, `nav-gate-${v.gates[next].id}`, 8.0);
    }

    // Connect gates to their respective downstream corridors or zones
    v.gates.forEach((g) => {
      // Connect to nearest concourse zone
      let nearestZone: Zone | null = null;
      let minDist = Infinity;
      v.zones
        .filter((z) => z.category === 'CONCOURSE' || z.category === 'STAGE_ZONE')
        .forEach((z) => {
          let cx = 0,
            cy = 0;
          z.polygon.forEach((p) => {
            cx += p.x;
            cy += p.y;
          });
          const c = { x: cx / z.polygon.length, y: cy / z.polygon.length };
          const d = distance(g.position, c);
          if (d < minDist) {
            minDist = d;
            nearestZone = z;
          }
        });

      if (nearestZone) {
        this.navGraph.addEdge(`nav-gate-${g.id}`, `nav-zone-${(nearestZone as Zone).id}`, g.width);
      }
    });

    // Connect corridors
    v.corridors.forEach((c) => {
      this.navGraph.addEdge(`nav-zone-${c.fromZoneId}`, `nav-zone-${c.toZoneId}`, c.width, c.id);
    });

    // Connect attractions and medical points to adjacent zones
    v.attractions.forEach((a) => {
      const nearestZone = this.findZoneForPoint(a.position);
      if (nearestZone) {
        this.navGraph.addEdge(`nav-attr-${a.id}`, `nav-zone-${nearestZone.id}`, 8.0);
      }
    });

    v.medicalPoints.forEach((m) => {
      const nearestZone = this.findZoneForPoint(m.position);
      if (nearestZone) {
        this.navGraph.addEdge(`nav-med-${m.id}`, `nav-zone-${nearestZone.id}`, 6.0);
      }
    });
  }

  public findZoneForPoint(pt: Vector2D): Zone | null {
    for (const z of this.state.venue.zones) {
      if (pointInPolygon(pt, z.polygon)) {
        return z;
      }
    }
    return null;
  }

  // Master update step with sub-stepping for smooth, stable physics
  public update(realDt: number): void {
    if (!this.state.isRunning || this.state.isPaused) return;

    const scaledDt = realDt * this.state.speedMultiplier;
    // Sub-step fixed simulation delta (0.05s) for numerical stability
    const subStep = 0.05;
    let remaining = scaledDt;

    while (remaining > 0.001) {
      const dt = Math.min(remaining, subStep);
      this.step(dt);
      remaining -= dt;
    }
  }

  public step(dt: number): void {
    this.state.simTimeSecs += dt;

    // Handle Active Interventions (e.g. Admission Pause expiration)
    if (this.activeAdmissionPauseUntil > 0 && this.state.simTimeSecs > this.activeAdmissionPauseUntil) {
      this.activeAdmissionPauseUntil = 0;
      this.logEvent({
        type: 'INFO',
        location: 'Perimeter Turnstiles',
        description: 'Tactical admission pause concluded. Standard gate operations resumed.',
      });
    }

    // 1. Inflow Spawning
    this.processInflowSpawning(dt);

    // 2. Spatial Grid rebuild for collision avoidance
    this.spatialGrid.clear();
    for (let i = 0; i < this.state.agents.length; i++) {
      const a = this.state.agents[i];
      if (a.state !== 'ADMITTED' && a.state !== 'INSIDE') {
        this.spatialGrid.insert(a);
      }
    }

    // 3. Update Agents (Movement, Queuing, Social Forces)
    this.updateAgents(dt);

    // 3.5 Intelligent Automatic Gate Rerouting
    this.evaluateAutomaticGateRerouting(dt);

    // 4. Update Gates (Processing rate, scanners, wait times)
    this.updateGates(dt);

    // 5. Update Zones (Densities, inflow/outflow, risk levels)
    this.updateZones(dt);

    // 6. Update Incidents & Responders
    this.updateIncidents(dt);

    // 7. Dynamic Recommendations Analysis
    this.evaluateGateRecommendations();

    // 8. Snapshot metrics periodically (every 2 seconds)
    if (this.state.simTimeSecs - this.lastMetricsRecordTime >= 2.0) {
      this.lastMetricsRecordTime = this.state.simTimeSecs;
      this.recordMetricsSnapshot();
    }
  }

  private processInflowSpawning(dt: number): void {
    const v = this.state.venue;
    const MAX_VISUAL_AGENTS = 3000;

    // Clean up finished / admitted agents if ceiling reached
    if (this.state.agents.length >= MAX_VISUAL_AGENTS) {
      const admittedIdx = this.state.agents.findIndex(
        (a) => a.state === 'ADMITTED' || a.state === 'INSIDE'
      );
      if (admittedIdx >= 0) {
        this.state.agents.splice(admittedIdx, 1);
      }
    }

    const isGateSideMode = this.gateSideConfig.selectedGateIds.length > 0;
    const activeGates = isGateSideMode
      ? v.gates.filter((g) => this.gateSideConfig.selectedGateIds.includes(g.id))
      : v.gates;

    // 1. Concurrent Independent Inflow Spawning for Every Regular Entry Gate
    for (const g of activeGates) {
      if (g.direction === 'EXIT' || g.gateType === 'EXIT_ONLY') continue;
      if (g.direction === 'EMERGENCY_ONLY') continue;
      if (!isGateSideMode && g.direction === 'CLOSED') continue;
      if (g.isArrivalsPaused) continue;
      if (g.gateType === 'VIP' && (g.assignedSpectatorCount || 500) <= (g.totalArrivalsCount || 0)) continue;
      if ((g.totalArrivalsCount || 0) >= (g.assignedSpectatorCount || 4000)) continue;

      let gateRatePerMin = g.arrivalRatePerMin !== undefined
        ? g.arrivalRatePerMin
        : (isGateSideMode ? this.gateSideConfig.inflowRatePerMin : 120);

      if (gateRatePerMin <= 0) continue;

      // Pattern modulation in gate-side mode (only if per-gate rate is not explicitly specified)
      if (isGateSideMode && g.arrivalRatePerMin === undefined) {
        if (this.gateSideConfig.arrivalPattern === 'PEAK_SURGE') {
          const peakTime = Math.min(120, this.gateSideConfig.durationSecs * 0.5);
          const sigma = Math.max(30, this.gateSideConfig.durationSecs * 0.2);
          const gaussian = Math.exp(-Math.pow(this.state.simTimeSecs - peakTime, 2) / (2 * sigma * sigma));
          gateRatePerMin *= 0.5 + gaussian * 2.0;
        } else if (this.gateSideConfig.arrivalPattern === 'BURST') {
          const cycle = this.state.simTimeSecs % 60;
          gateRatePerMin *= (cycle < 20 ? 2.0 : 0.5);
        } else if (this.gateSideConfig.arrivalPattern === 'TRANSPORT_PULSE') {
          const cycle = this.state.simTimeSecs % 90;
          gateRatePerMin *= (cycle < 30 ? 2.4 : 0.3);
        }
      }

      const gateRatePerSec = gateRatePerMin / 60;
      let acc = this.gateArrivalAccumulators.get(g.id) || 0;
      acc += gateRatePerSec * dt;

      while (acc >= 1.0) {
        if (this.state.agents.length >= MAX_VISUAL_AGENTS) break;
        acc -= 1.0;
        this.spawnAgentForGate(g);
      }
      this.gateArrivalAccumulators.set(g.id, acc);
    }
  }

  public isGateUnavailable(gate: Gate): boolean {
    return (
      gate.direction === 'CLOSED' ||
      gate.status === 'TEMPORARILY_CLOSED' ||
      gate.status === 'UNAVAILABLE' ||
      gate.operationalScanners === 0
    );
  }

  public isGateDegraded(gate: Gate): boolean {
    if (this.isGateUnavailable(gate)) return false;
    return gate.operationalScanners < gate.scannerCount;
  }

  public isGateDownstreamBlocked(gate: Gate): boolean {
    const corridor = this.state.venue.corridors.find((c) => c.id === gate.downstreamCorridorId);
    if (corridor && corridor.isBlocked) return true;
    if (corridor) {
      const toZone = this.state.venue.zones.find((z) => z.id === corridor.toZoneId);
      if (toZone && toZone.currentDensity >= 3.2) return true;
    }
    return false;
  }

  public selectBestAlternativeGate(agent: CrowdAgent, excludeGateId?: string): Gate | null {
    const v = this.state.venue;
    const candidates = v.gates.filter((g) => {
      if (excludeGateId && g.id === excludeGateId) return false;
      if (g.direction !== 'ENTRY' && g.direction !== 'BIDIRECTIONAL') return false;
      if (this.isGateUnavailable(g)) return false;
      if (this.isGateDownstreamBlocked(g)) return false;
      if ((g.assignedSpectatorCount || 4000) <= (g.totalArrivalsCount || 0)) return false;
      return true;
    });

    if (candidates.length === 0) return null;

    if (this.gateSideConfig.selectedGateIds.length > 0) {
      const selectedCandidates = candidates.filter((g) => this.gateSideConfig.selectedGateIds.includes(g.id));
      if (selectedCandidates.length > 0) {
        return this.scoreAndPickBestGate(agent, selectedCandidates);
      }
    }

    return this.scoreAndPickBestGate(agent, candidates);
  }

  private scoreAndPickBestGate(agent: CrowdAgent, candidates: Gate[]): Gate | null {
    const v = this.state.venue;
    let bestGate: Gate | null = null;
    let lowestCost = Infinity;

    for (const g of candidates) {
      const dist = distance({ x: agent.x, y: agent.y }, g.position);
      const walkTimeSecs = dist / Math.max(0.5, agent.preferredSpeed);

      const scannerRate =
        g.scannerProcessingRatePerSec !== undefined
          ? g.scannerProcessingRatePerSec
          : (g.scannerProcessingRatePerMin ? g.scannerProcessingRatePerMin / 60 : 1.0);
      const ratePerSec = Math.max(0.1, g.operationalScanners * scannerRate);

      const incoming = g.assignedIncomingDemand || 0;
      const queueWaitTimeSecs = (g.currentQueue + incoming) / ratePerSec;

      let downstreamPenalty = 0;
      const corridor = v.corridors.find((c) => c.id === g.downstreamCorridorId);
      if (corridor) {
        const toZone = v.zones.find((z) => z.id === corridor.toZoneId);
        if (toZone && toZone.currentDensity > 1.8) {
          downstreamPenalty = (toZone.currentDensity - 1.8) * 45;
        }
      }

      const cost = walkTimeSecs + queueWaitTimeSecs + downstreamPenalty;

      if (cost < lowestCost) {
        lowestCost = cost;
        bestGate = g;
      }
    }

    return bestGate;
  }

  private evaluateAutomaticGateRerouting(dt: number): void {
    const v = this.state.venue;
    const agents = this.state.agents;
    const now = this.state.simTimeSecs;

    const reroutedFromTo: Map<string, Map<string, number>> = new Map();
    let divertedCountThisStep = 0;

    for (let i = 0; i < agents.length; i++) {
      const a = agents[i];
      if (a.state !== 'APPROACHING') continue;
      if (!a.targetGateId) continue;

      const currentGate = v.gates.find((g) => g.id === a.targetGateId);
      if (!currentGate) continue;

      // Check Strict Ticket Restriction
      const isStrictTicketRestricted =
        (currentGate.strictTicketEnforcement ?? true) &&
        Boolean(a.ticketGateId && (!a.permittedAlternativeGateIds || a.permittedAlternativeGateIds.length === 0));

      const isUnavailable = this.isGateUnavailable(currentGate);
      const isDownstreamBlocked = this.isGateDownstreamBlocked(currentGate);
      const isHoldingSaturated = (currentGate.inHoldingCount || 0) >= (currentGate.holdingAreaCapacity || 500);

      if (isStrictTicketRestricted && a.ticketGateId) {
        // Pedestrian is strictly bound by their ticket to currentGate!
        // Under failure/congestion/pause: spectator stays assigned to currentGate and moves to currentGate's holding area!
        if (isUnavailable || isDownstreamBlocked || currentGate.currentQueue >= (currentGate.maxSafeQueueOccupancy || (currentGate.gateType === 'REGULAR' ? 400 : 120))) {
          if (!isHoldingSaturated) {
            a.state = 'HOLDING';
            a.inHoldingArea = true;
            const hp = currentGate.holdingAreaPosition || currentGate.position;
            const jx = (this.prng.next() - 0.5) * 8;
            const jy = (this.prng.next() - 0.5) * 8;
            a.targetX = hp.x + jx;
            a.targetY = hp.y + jy;
            a.pathWaypoints = this.navGraph.findPath({ x: a.x, y: a.y }, { x: a.targetX, y: a.targetY });
            a.currentWaypointIdx = 0;
            divertedCountThisStep++;
          }
        }
        continue;
      }

      if (isUnavailable || isDownstreamBlocked) {
        const bestGate = this.selectBestAlternativeGate(a, currentGate.id);

        if (bestGate) {
          if (!a.originalTargetGateId) {
            a.originalTargetGateId = currentGate.id;
          }
          a.lastRerouteTime = now;
          a.rerouteCount = (a.rerouteCount || 0) + 1;
          a.isRerouted = true;
          a.targetGateId = bestGate.id;
          a.targetX = bestGate.position.x;
          a.targetY = bestGate.position.y;

          const newPath = this.navGraph.findPath({ x: a.x, y: a.y }, bestGate.position);
          a.pathWaypoints = newPath;
          a.currentWaypointIdx = 0;

          bestGate.assignedIncomingDemand = (bestGate.assignedIncomingDemand || 0) + 1;
          bestGate.redirectedCount = (bestGate.redirectedCount || 0) + 1;
          currentGate.deflectedCount = (currentGate.deflectedCount || 0) + 1;
          this.totalRedirectedPedestrians++;

          if (!reroutedFromTo.has(currentGate.id)) {
            reroutedFromTo.set(currentGate.id, new Map());
          }
          const subMap = reroutedFromTo.get(currentGate.id)!;
          subMap.set(bestGate.id, (subMap.get(bestGate.id) || 0) + 1);
        } else {
          a.state = 'DIVERTED';
          a.targetGateId = undefined;
          a.targetZoneId = 'zone-holding-overflow';

          const holdingZone = v.zones.find(
            (z) => z.id === 'zone-holding-overflow' || z.category === 'HOLDING_AREA' || z.category === 'EXTERNAL_PLAZA'
          );
          if (holdingZone) {
            let cx = 0, cy = 0;
            holdingZone.polygon.forEach((p) => { cx += p.x; cy += p.y; });
            const center = { x: cx / holdingZone.polygon.length, y: cy / holdingZone.polygon.length };
            a.pathWaypoints = this.navGraph.findPath({ x: a.x, y: a.y }, center);
            a.currentWaypointIdx = 0;
            a.targetX = center.x;
            a.targetY = center.y;
          }
          divertedCountThisStep++;
        }
      } else if (this.isGateDegraded(currentGate)) {
        if (a.lastRerouteTime !== undefined && (now - a.lastRerouteTime) < 10.0) continue;
        if (a.rerouteCount && a.rerouteCount >= 2) continue;

        const distToCurrent = distance({ x: a.x, y: a.y }, currentGate.position);
        if (distToCurrent < 10.0) continue;

        const scannerRateCurr =
          currentGate.scannerProcessingRatePerSec !== undefined
            ? currentGate.scannerProcessingRatePerSec
            : (currentGate.scannerProcessingRatePerMin ? currentGate.scannerProcessingRatePerMin / 60 : 1.0);
        const currRate = Math.max(0.1, currentGate.operationalScanners * scannerRateCurr);
        const currCost = (distToCurrent / Math.max(0.5, a.preferredSpeed)) + ((currentGate.currentQueue + (currentGate.assignedIncomingDemand || 0)) / currRate);

        const bestAlt = this.selectBestAlternativeGate(a, currentGate.id);
        if (bestAlt) {
          const distAlt = distance({ x: a.x, y: a.y }, bestAlt.position);
          const scannerRateAlt =
            bestAlt.scannerProcessingRatePerSec !== undefined
              ? bestAlt.scannerProcessingRatePerSec
              : (bestAlt.scannerProcessingRatePerMin ? bestAlt.scannerProcessingRatePerMin / 60 : 1.0);
          const altRate = Math.max(0.1, bestAlt.operationalScanners * scannerRateAlt);
          const altCost = (distAlt / Math.max(0.5, a.preferredSpeed)) + ((bestAlt.currentQueue + (bestAlt.assignedIncomingDemand || 0)) / altRate);

          if (currCost > 60 && altCost < currCost * 0.65) {
            if (!a.originalTargetGateId) {
              a.originalTargetGateId = currentGate.id;
            }
            a.lastRerouteTime = now;
            a.rerouteCount = (a.rerouteCount || 0) + 1;
            a.isRerouted = true;
            a.targetGateId = bestAlt.id;
            a.targetX = bestAlt.position.x;
            a.targetY = bestAlt.position.y;
            a.pathWaypoints = this.navGraph.findPath({ x: a.x, y: a.y }, bestAlt.position);
            a.currentWaypointIdx = 0;

            bestAlt.assignedIncomingDemand = (bestAlt.assignedIncomingDemand || 0) + 1;
            bestAlt.redirectedCount = (bestAlt.redirectedCount || 0) + 1;
            currentGate.deflectedCount = (currentGate.deflectedCount || 0) + 1;
            this.totalRedirectedPedestrians++;

            if (!reroutedFromTo.has(currentGate.id)) {
              reroutedFromTo.set(currentGate.id, new Map());
            }
            const subMap = reroutedFromTo.get(currentGate.id)!;
            subMap.set(bestAlt.id, (subMap.get(bestAlt.id) || 0) + 1);
          }
        }
      }
    }

    if (reroutedFromTo.size > 0 && (!this.lastRerouteLogTime || now - this.lastRerouteLogTime >= 3.0)) {
      this.lastRerouteLogTime = now;
      for (const [fromId, targets] of reroutedFromTo.entries()) {
        const fromGate = v.gates.find((g) => g.id === fromId);
        const parts: string[] = [];
        let totalDiverted = 0;
        for (const [toId, count] of targets.entries()) {
          const toGate = v.gates.find((g) => g.id === toId);
          parts.push(`${toGate ? toGate.name : toId} (+${count})`);
          totalDiverted += count;
        }

        const reason = fromGate ? (fromGate.unavailabilityReason || (this.isGateUnavailable(fromGate) ? 'gate unavailable' : 'scanner degradation')) : 'gate failure';
        this.logEvent({
          type: 'GATE',
          location: fromGate ? fromGate.name : fromId,
          description: `Intelligent Rerouting: ${fromGate ? fromGate.name : fromId} (${reason}). Redirected ${totalDiverted} pedestrians to ${parts.join(', ')}.`,
          gateId: fromId,
        });

        this.logGateSideEvent(
          'CONFIG_CHANGE',
          `Automatic reroute: ${totalDiverted} pedestrians redirected from ${fromGate ? fromGate.name : fromId} to ${parts.join(', ')}`
        );
      }
    }

    if (divertedCountThisStep > 0 && (!this.lastHoldingLogTime || now - this.lastHoldingLogTime >= 5.0)) {
      this.lastHoldingLogTime = now;
      this.logEvent({
        type: 'CRITICAL',
        location: 'Perimeter Holding Area',
        description: `Capacity shortage: ${divertedCountThisStep} pedestrians diverted to external holding area. No available operational gates.`,
      });
    }
  }

  public spawnAgentForGate(gate: Gate, approachFraction?: number): CrowdAgent | null {
    const v = this.state.venue;
    const maxQuota = gate.assignedSpectatorCount || 4000;
    if ((gate.totalArrivalsCount || 0) >= maxQuota) {
      return null;
    }

    const spawnBase = gate.spawnPosition || getGateSpawnPoint(gate);
    const cx = v.dimensions.width / 2;
    const cy = v.dimensions.height / 2;
    const dirX = gate.position.x - cx;
    const dirY = gate.position.y - cy;
    const len = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
    const tx = -(dirY / len);
    const ty = dirX / len;

    // Lateral jitter across gate entrance approach corridor
    const jitter = this.prng.range(-gate.width * 0.4, gate.width * 0.4);
    let spawnX = spawnBase.x + tx * jitter;
    let spawnY = spawnBase.y + ty * jitter;

    // Optional approach fraction staging for cohorts walking along the approach
    if (approachFraction !== undefined && approachFraction > 0 && approachFraction < 1.0) {
      spawnX = spawnBase.x + (gate.position.x - spawnBase.x) * approachFraction + tx * jitter;
      spawnY = spawnBase.y + (gate.position.y - spawnBase.y) * approachFraction + ty * jitter;
    }

    // Direct approach path from spawn point to gate position
    let path = this.navGraph.findPath({ x: spawnX, y: spawnY }, gate.position);
    if (!path || path.length === 0) {
      path = [{ x: spawnX, y: spawnY }, gate.position];
    }

    gate.totalArrivalsCount = (gate.totalArrivalsCount || 0) + 1;
    gate.assignedIncomingDemand = (gate.assignedIncomingDemand || 0) + 1;
    gate.remainingToArriveCount = Math.max(0, maxQuota - gate.totalArrivalsCount);
    this.totalGeneratedArrivals++;

    // Track rolling arrival timestamp
    let stamps = this.gateRecentArrivalTimestamps.get(gate.id);
    if (!stamps) {
      stamps = [];
      this.gateRecentArrivalTimestamps.set(gate.id, stamps);
    }
    stamps.push(this.state.simTimeSecs);

    const agent: CrowdAgent = {
      id: this.nextAgentId++,
      x: spawnX,
      y: spawnY,
      vx: 0,
      vy: 0,
      targetX: gate.position.x,
      targetY: gate.position.y,
      preferredSpeed: this.prng.range(1.15, 1.45),
      radius: 0.32,
      state: 'APPROACHING',
      targetGateId: gate.id,
      ticketGateId: gate.id,
      assignedGateId: gate.id,
      inHoldingArea: false,
      pathWaypoints: path,
      currentWaypointIdx: 0,
      shirtColor: this.prng.choice(SHIRT_COLORS),
      skinColor: this.prng.choice(SKIN_TONES),
      stridePhase: this.prng.range(0, Math.PI * 2),
      facingAngle: Math.atan2(gate.position.y - spawnY, gate.position.x - spawnX),
      arrivalTime: this.state.simTimeSecs,
      waitDurationSecs: 0,
    };

    this.state.agents.push(agent);
    return agent;
  }

  private spawnGateSideAgent(): void {
    const v = this.state.venue;
    const selectedGates = v.gates.filter((g) => this.gateSideConfig.selectedGateIds.includes(g.id));
    if (selectedGates.length === 0) return;

    // Check if total assigned ticket quota has been reached for selected gates
    const totalRemaining = selectedGates.reduce(
      (sum, g) => sum + Math.max(0, (g.assignedSpectatorCount || 4000) - (g.totalArrivalsCount || 0)),
      0
    );
    if (totalRemaining <= 0) return;

    // Filter operational gates that have remaining ticket capacity
    const operationalGates = selectedGates.filter(
      (g) =>
        (g.direction === 'ENTRY' || g.direction === 'BIDIRECTIONAL') &&
        !this.isGateUnavailable(g) &&
        !this.isGateDownstreamBlocked(g) &&
        ((g.assignedSpectatorCount || 4000) > (g.totalArrivalsCount || 0))
    );

    let targetGate: Gate | null = null;
    if (operationalGates.length > 0) {
      if (this.gateSideConfig.routingPolicy === 'SHORTEST_QUEUE') {
        targetGate = [...operationalGates].sort(
          (a, b) =>
            (a.currentQueue + (a.assignedIncomingDemand || 0)) -
            (b.currentQueue + (b.assignedIncomingDemand || 0))
        )[0];
      } else if (this.gateSideConfig.routingPolicy === 'LEAST_WAIT_TIME') {
        targetGate = [...operationalGates].sort((a, b) => {
          const capA = Math.max(0.1, (a.effectiveCapacityPerMin || 60) / 60);
          const capB = Math.max(0.1, (b.effectiveCapacityPerMin || 60) / 60);
          const waitA = (a.currentQueue + (a.assignedIncomingDemand || 0)) / capA;
          const waitB = (b.currentQueue + (b.assignedIncomingDemand || 0)) / capB;
          return waitA - waitB;
        })[0];
      } else {
        targetGate = operationalGates[0];
      }
    } else {
      const available = selectedGates.filter((g) => (g.assignedSpectatorCount || 4000) > (g.totalArrivalsCount || 0));
      targetGate = available[0] || null;
    }

    if (targetGate) {
      this.spawnAgentForGate(targetGate);
    }
  }

  private spawnSingleAgent(): void {
    const v = this.state.venue;
    const entryGates = v.gates.filter(
      (g) =>
        (g.direction === 'ENTRY' || g.direction === 'BIDIRECTIONAL') &&
        g.gateType !== 'EXIT_ONLY' &&
        !this.isGateUnavailable(g) &&
        !this.isGateDownstreamBlocked(g) &&
        ((g.assignedSpectatorCount || 4000) > (g.totalArrivalsCount || 0))
    );
    if (entryGates.length === 0) return;
    const targetGate = [...entryGates].sort((a, b) => (a.currentQueue || 0) - (b.currentQueue || 0))[0];
    this.spawnAgentForGate(targetGate);
  }

  private updateAgents(dt: number): void {
    const agents = this.state.agents;
    const v = this.state.venue;

    for (let i = 0; i < agents.length; i++) {
      const a = agents[i];
      if (a.state === 'ADMITTED' || a.state === 'INSIDE') {
        continue;
      }
      a.stridePhase += a.preferredSpeed * dt * 4;

      if (a.state === 'HOLDING') {
        a.waitDurationSecs += dt;
        const gate = v.gates.find((g) => g.id === a.targetGateId);
        const hp = gate?.holdingAreaPosition || { x: a.targetX, y: a.targetY };
        const dToCenter = distance({ x: a.x, y: a.y }, hp);
        if (dToCenter > 6) {
          const dir = normalize(sub(hp, { x: a.x, y: a.y }));
          a.vx = dir.x * 0.8;
          a.vy = dir.y * 0.8;
        } else {
          a.vx *= 0.8;
          a.vy *= 0.8;
        }
        a.x += a.vx * dt;
        a.y += a.vy * dt;
        continue;
      }

      if (a.state === 'QUEUING' || a.state === 'PROCESSING') {
        a.waitDurationSecs += dt;
        const gate = v.gates.find((g) => g.id === a.targetGateId);
        if (gate) {
          // Physical orderly queue slot positioning
          const cx = v.dimensions.width / 2;
          const cy = v.dimensions.height / 2;
          const dirX = gate.position.x - cx;
          const dirY = gate.position.y - cy;
          const len = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
          const nx = dirX / len;
          const ny = dirY / len;
          const tx = -ny;
          const ty = nx;

          const hasActiveOverflow = !!(
            gate.overflowDoor &&
            gate.overflowDoor.enabled &&
            gate.overflowDoor.status === 'OPEN' &&
            gate.overflowDoor.isAuthorized
          );
          const lanes = hasActiveOverflow ? 4 : Math.max(1, gate.counters?.length || gate.scannerCount || 3);
          const laneCap = 150;

          // Helper to count active queuers/processors per lane at this gate
          const laneCounts = new Array(lanes).fill(0);
          for (let k = 0; k < agents.length; k++) {
            const ag = agents[k];
            if (
              (ag.state === 'QUEUING' || ag.state === 'PROCESSING') &&
              ag.targetGateId === gate.id &&
              ag.assignedLane !== undefined &&
              ag.assignedLane >= 0 &&
              ag.assignedLane < lanes
            ) {
              laneCounts[ag.assignedLane]++;
            }
          }

          // Workload / expected wait time calculation for lane l
          const getLaneWaitTime = (l: number, currentCount: number) => {
            if (l < 3) {
              const counter = gate.counters?.[l];
              const isOp = counter ? counter.status === 'OPERATIONAL' : (l < gate.operationalScanners);
              if (!isOp) return Infinity;
              const rate = counter?.serviceRatePerSec || 1.0;
              return (currentCount + 1) / Math.max(0.1, rate);
            } else {
              const door = gate.overflowDoor;
              const isDoorOp = door && door.enabled && door.status === 'OPEN' && door.isAuthorized;
              if (!isDoorOp) return Infinity;
              const rate = door.serviceRatePerSec || 1.0;
              return (currentCount + 1) / Math.max(0.1, rate) + 1.5; // slight walking distance penalty
            }
          };

          // 1. Initial Lane Assignment (Workload-based with physical capacity check)
          if (a.assignedLane === undefined || a.assignedLane >= lanes) {
            let bestLane = 0;
            let minWait = Infinity;
            for (let l = 0; l < lanes; l++) {
              const wait = getLaneWaitTime(l, laneCounts[l]);
              if (wait === Infinity) continue;
              const countInLane = laneCounts[l];
              if (countInLane >= laneCap) continue; // Respect physical queue capacity
              if (wait < minWait) {
                minWait = wait;
                bestLane = l;
              }
            }
            // If all operational lanes are at or above nominal capacity, choose the one with lowest wait
            if (minWait === Infinity) {
              for (let l = 0; l < lanes; l++) {
                const wait = getLaneWaitTime(l, laneCounts[l]);
                if (wait < minWait) {
                  minWait = wait;
                  bestLane = l;
                }
              }
            }
            a.assignedLane = bestLane;
            a.assignedCounterId = bestLane === 3 ? `${gate.id}-overflow-door` : gate.counters?.[bestLane]?.id;
            a.lastLaneSwitchTime = this.state.simTimeSecs;
            a.laneSwitchCount = 0;
          }

          let lane = a.assignedLane ?? 0;

          // Find current depth within assigned lane
          const currentLaneAgents = agents.filter(
            (ag) =>
              (ag.state === 'QUEUING' || ag.state === 'PROCESSING') &&
              ag.targetGateId === gate.id &&
              (ag.assignedLane ?? 0) === lane
          );
          const depth = Math.max(0, currentLaneAgents.indexOf(a));

          // 2. Intelligent Lane Balancing / Dynamic Switching
          const now = this.state.simTimeSecs;
          const isBalancingAllowed = gate.laneBalancingEnabled !== false;
          const isCurrentCounterOp = lane < 3
            ? (gate.counters?.[lane] ? gate.counters[lane].status === 'OPERATIONAL' : (lane < gate.operationalScanners))
            : hasActiveOverflow;

          const isEligibleToBalance = !isCurrentCounterOp || (a.state === 'QUEUING' && depth >= 1);

          if (
            isBalancingAllowed &&
            isEligibleToBalance &&
            (!a.lastLaneSwitchTime || now - a.lastLaneSwitchTime >= 3.0) &&
            (a.laneSwitchCount || 0) < 4
          ) {
            const currentWait = isCurrentCounterOp ? getLaneWaitTime(lane, laneCounts[lane]) : Infinity;

            let bestAltLane = -1;
            let bestAltWait = currentWait;

            for (let l = 0; l < lanes; l++) {
              if (l === lane) continue;
              const candWait = getLaneWaitTime(l, laneCounts[l]);
              if (candWait === Infinity) continue;
              if (laneCounts[l] >= laneCap) continue;

              // If current counter is FAILED or door closed, any operational lane is immediately preferred
              if (!isCurrentCounterOp) {
                if (candWait < bestAltWait) {
                  bestAltWait = candWait;
                  bestAltLane = l;
                }
              } else {
                // Hysteresis: >= 35% wait time reduction and >= 2.0s difference
                if (candWait <= currentWait * 0.65 && (currentWait - candWait >= 2.0)) {
                  if (candWait < bestAltWait) {
                    bestAltWait = candWait;
                    bestAltLane = l;
                  }
                }
              }
            }

            if (bestAltLane !== -1) {
              // Perform the switch
              a.switchSourceLane = lane;
              a.assignedLane = bestAltLane;
              a.assignedCounterId = bestAltLane === 3 ? `${gate.id}-overflow-door` : gate.counters?.[bestAltLane]?.id;
              a.lastLaneSwitchTime = now;
              a.laneSwitchCount = (a.laneSwitchCount || 0) + 1;
              a.isSwitchingLane = true;
              gate.totalLaneSwitches = (gate.totalLaneSwitches || 0) + 1;
              if (bestAltLane === 3) {
                this.logGateSideEvent(gate.id, 'INFLOW_CHANGE', `Spectator #${a.id} switched to Overflow Door (4th Passage)`);
              }
              lane = bestAltLane;
            }
          }

          // Re-calculate depth within active lane after potential switch
          const activeLaneAgents = agents.filter(
            (ag) =>
              (ag.state === 'QUEUING' || ag.state === 'PROCESSING') &&
              ag.targetGateId === gate.id &&
              (ag.assignedLane ?? 0) === lane
          );
          const currentDepth = Math.max(0, activeLaneAgents.indexOf(a));

          let offsetT = 0;
          if (lane < 3) {
            offsetT = ((lane - 1) / 3) * (gate.width * 0.75);
          } else {
            // Overflow Door (4th lane) beside Lane 3
            offsetT = (gate.width * 0.75) * 0.85;
          }
          const distBack = 1.6 + currentDepth * 0.85;

          const slotX = gate.position.x + nx * distBack + tx * offsetT;
          const slotY = gate.position.y + ny * distBack + ty * offsetT;

          const dx = slotX - a.x;
          const dy = slotY - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist > 0.05) {
            const spd = Math.min(1.4, dist * 3.0);
            a.vx = (dx / dist) * spd;
            a.vy = (dy / dist) * spd;
          } else {
            a.vx = 0;
            a.vy = 0;
            a.isSwitchingLane = false;
          }
          a.x += a.vx * dt;
          a.y += a.vy * dt;
          a.facingAngle = Math.atan2(-ny, -nx);

          const isCounterOp = lane < 3
            ? (gate.counters?.[lane] ? gate.counters[lane].status === 'OPERATIONAL' : (lane < gate.operationalScanners))
            : hasActiveOverflow;

          if (currentDepth === 0 && isCounterOp && gate.operationalControlState !== 'ADMISSION_PAUSED') {
            a.state = 'PROCESSING';
          } else {
            a.state = 'QUEUING';
          }
        }
        continue;
      }

      // Check current waypoint progress
      if (a.pathWaypoints.length > 0 && a.currentWaypointIdx < a.pathWaypoints.length) {
        const targetWp = a.pathWaypoints[a.currentWaypointIdx];
        const distToWp = distance({ x: a.x, y: a.y }, targetWp);

        if (distToWp < 1.5) {
          a.currentWaypointIdx++;
          if (a.currentWaypointIdx >= a.pathWaypoints.length) {
            // Reached gate or final destination
            if (a.state === 'APPROACHING' && a.targetGateId) {
              const gate = v.gates.find((g) => g.id === a.targetGateId);
              if (gate) {
                const isUnavailable = this.isGateUnavailable(gate);
                const isDownstreamBlocked = this.isGateDownstreamBlocked(gate);
                const isBarrierClosed = gate.direction === 'CLOSED' || gate.status === 'TEMPORARILY_CLOSED';
                const isQueueOverfilled = gate.currentQueue >= (gate.maxSafeQueueOccupancy || (gate.gateType === 'REGULAR' ? 400 : 120));

                if ((isBarrierClosed || isDownstreamBlocked || isQueueOverfilled) && gate.holdingAreaPosition) {
                  a.state = 'HOLDING';
                  a.inHoldingArea = true;
                  const hp = gate.holdingAreaPosition;
                  a.targetX = hp.x + (this.prng.next() - 0.5) * 8;
                  a.targetY = hp.y + (this.prng.next() - 0.5) * 8;
                  a.pathWaypoints = this.navGraph.findPath({ x: a.x, y: a.y }, { x: a.targetX, y: a.targetY });
                  a.currentWaypointIdx = 0;
                } else {
                  a.state = 'QUEUING';
                  a.inHoldingArea = false;
                  gate.currentQueue++;
                }
              }
              continue;
            } else if (a.state === 'EN_ROUTE_DESTINATION') {
              a.state = 'INSIDE';
              continue;
            }
          }
        }
      }

      // Desired velocity towards current waypoint
      let targetPos = { x: a.targetX, y: a.targetY };
      if (a.pathWaypoints.length > 0 && a.currentWaypointIdx < a.pathWaypoints.length) {
        targetPos = a.pathWaypoints[a.currentWaypointIdx];
      }

      const dir = normalize(sub(targetPos, { x: a.x, y: a.y }));
      a.facingAngle = Math.atan2(dir.y, dir.x);

      // Weidmann speed reduction based on local density
      const currentZone = this.findZoneForPoint({ x: a.x, y: a.y });
      let speedFactor = 1.0;
      if (currentZone && currentZone.currentDensity > 1.2) {
        // Density slows down pedestrians
        speedFactor = Math.max(0.2, 1.0 - (currentZone.currentDensity - 1.2) * 0.35);
      }

      const desiredVx = dir.x * a.preferredSpeed * speedFactor;
      const desiredVy = dir.y * a.preferredSpeed * speedFactor;

      // Social Force / Collision Repulsion with neighbors
      const neighbors = this.spatialGrid.query({ x: a.x, y: a.y }, 1.2);
      let repulseX = 0;
      let repulseY = 0;
      let opposingCount = 0;

      for (let j = 0; j < neighbors.length; j++) {
        const other = neighbors[j];
        if (other.id === a.id) continue;

        const d = distance({ x: a.x, y: a.y }, { x: other.x, y: other.y });
        const minDist = a.radius + other.radius + 0.15;

        if (d < minDist && d > 0.001) {
          const overlap = minDist - d;
          const pushDir = normalize(sub({ x: a.x, y: a.y }, { x: other.x, y: other.y }));
          repulseX += pushDir.x * overlap * 3.5;
          repulseY += pushDir.y * overlap * 3.5;
        }

        const dotVel = a.vx * other.vx + a.vy * other.vy;
        if (dotVel < -0.1) {
          opposingCount++;
        }
      }

      let opposingDampening = 1.0;
      if (opposingCount > 0) {
        opposingDampening = Math.max(0.4, 1.0 - opposingCount * 0.08);
      }

      // Smooth velocity interpolation with opposing flow friction
      a.vx = a.vx * 0.7 + (desiredVx * opposingDampening + repulseX) * 0.3;
      a.vy = a.vy * 0.7 + (desiredVy * opposingDampening + repulseY) * 0.3;

      // Apply movement
      a.x += a.vx * dt;
      a.y += a.vy * dt;

      // Directional separation barrier enforcement
      if (this.multiDirectionalActive && this.multiDirectionalIntervention === 'DIRECTIONAL_LANES') {
        if (a.groupId === 1) {
          if (a.y < 31) {
            a.y = 31;
            if (a.vy < 0) a.vy = 0;
          }
        } else if (a.groupId === 2) {
          if (a.y > 29) {
            a.y = 29;
            if (a.vy > 0) a.vy = 0;
          }
        }
      }

      // Keep within venue bounds
      a.x = Math.max(2, Math.min(v.dimensions.width - 2, a.x));
      a.y = Math.max(2, Math.min(v.dimensions.height - 2, a.y));
    }
  }

  private updateGates(dt: number): void {
    const v = this.state.venue;
    const isPausedGlobally = this.activeAdmissionPauseUntil > this.state.simTimeSecs;

    // Recalculate assigned incoming demand from live approaching agents
    const approachingDemandMap: Record<string, number> = {};
    for (let i = 0; i < this.state.agents.length; i++) {
      const a = this.state.agents[i];
      if (a.state === 'APPROACHING' && a.targetGateId) {
        approachingDemandMap[a.targetGateId] = (approachingDemandMap[a.targetGateId] || 0) + 1;
      }
    }
    for (const g of v.gates) {
      g.assignedIncomingDemand = approachingDemandMap[g.id] || 0;
    }

    for (const g of v.gates) {
      // 1. Update operational counters & sync operationalScanners first
      if (g.counters && g.counters.length > 0) {
        // Expand scannerCount if counters or operationalScanners exceed it
        if (g.counters.length > (g.scannerCount || 0)) {
          g.scannerCount = g.counters.length;
        } else if (g.operationalScanners !== undefined && g.operationalScanners > (g.scannerCount || 0)) {
          g.scannerCount = g.operationalScanners;
        }

        // Sync counter list length with g.scannerCount if scannerCount was expanded
        if (g.scannerCount !== undefined && g.counters.length < g.scannerCount && g.scannerCount > 0) {
          while (g.counters.length < g.scannerCount) {
            const nextIdx = g.counters.length + 1;
            g.counters.push({
              id: `${g.id}-c${nextIdx}`,
              name: `Counter ${nextIdx}`,
              status: 'OPERATIONAL',
              serviceRatePerSec:
                g.scannerProcessingRatePerSec !== undefined
                  ? g.scannerProcessingRatePerSec
                  : (g.scannerProcessingRatePerMin ? g.scannerProcessingRatePerMin / 60 : 1.0),
              totalProcessedCount: 0,
            });
          }
        }

        const counterStatusChanged = g.counters.some((c) => (c as any)._lastStatus !== c.status);
        const lastScanners = (g as any)._lastOperationalScanners;

        if (counterStatusChanged) {
          // Counter status was explicitly modified (e.g. counter 1 failed)
          const activeCounters = g.counters.filter((c) => c.status === 'OPERATIONAL');
          g.operationalScanners = activeCounters.length;
          g.counters.forEach((c) => {
            (c as any)._lastStatus = c.status;
          });
          (g as any)._lastOperationalScanners = g.operationalScanners;
        } else if (lastScanners !== undefined && g.operationalScanners !== lastScanners) {
          // operationalScanners was explicitly modified (e.g. g.operationalScanners = 0 or 1)
          g.counters.forEach((c, idx) => {
            c.status = idx < g.operationalScanners ? 'OPERATIONAL' : 'FAILED';
            (c as any)._lastStatus = c.status;
          });
          const activeCounters = g.counters.filter((c) => c.status === 'OPERATIONAL');
          g.operationalScanners = activeCounters.length;
          (g as any)._lastOperationalScanners = g.operationalScanners;
        } else {
          // Normal synchronization
          const activeCounters = g.counters.filter((c) => c.status === 'OPERATIONAL');
          g.operationalScanners = activeCounters.length;
          (g as any)._lastOperationalScanners = g.operationalScanners;
        }
      }

      const isDownstreamBlocked = this.isGateDownstreamBlocked(g);
      const isUnavailable = this.isGateUnavailable(g);

      // Gate Recovery detection: previously unavailable gate is now operational
      if (this.previouslyUnavailableGates.has(g.id) && !isUnavailable && !isDownstreamBlocked) {
        this.previouslyUnavailableGates.delete(g.id);
        const scannerRate =
          g.scannerProcessingRatePerSec !== undefined
            ? g.scannerProcessingRatePerSec
            : (g.scannerProcessingRatePerMin ? g.scannerProcessingRatePerMin / 60 : 1.0);
        const restoredCap = Math.round(g.operationalScanners * scannerRate * 60);

        this.logEvent({
          type: 'INFO',
          location: g.name,
          description: `Gate restored: ${g.name} is now operational with ${g.operationalScanners} active scanner lanes (${restoredCap} ppl/min capacity). Re-opened for incoming flow.`,
          gateId: g.id,
        });
        this.logGateSideEvent('COUNTER_RESTORED', `${g.name} restored: ${g.operationalScanners} active lanes operational.`);
      } else if (isUnavailable || isDownstreamBlocked) {
        this.previouslyUnavailableGates.add(g.id);
      }

      // Track unavailability reason and rerouting status flag
      if (g.direction === 'CLOSED' || g.status === 'TEMPORARILY_CLOSED') {
        g.unavailabilityReason = 'Gate barrier physically closed';
        g.isReroutingActive = true;
      } else if (g.operationalScanners === 0) {
        g.unavailabilityReason = 'All scanner lanes offline (0 active scanners)';
        g.isReroutingActive = true;
      } else if (isDownstreamBlocked) {
        g.unavailabilityReason = 'Downstream concourse/corridor congested or blocked';
        g.isReroutingActive = true;
        g.suggestedAction = 'Downstream corridor congested / blocked: holding gate release';
      } else {
        g.unavailabilityReason = undefined;
        g.isReroutingActive = false;
      }

      // Live population distributions per gate
      const inHolding = this.state.agents.filter((a) => a.state === 'HOLDING' && a.targetGateId === g.id);
      const inQueue = this.state.agents.filter((a) => a.state === 'QUEUING' && a.targetGateId === g.id);
      const inProcessing = this.state.agents.filter((a) => a.state === 'PROCESSING' && a.targetGateId === g.id);
      const inApproaching = this.state.agents.filter((a) => a.state === 'APPROACHING' && a.targetGateId === g.id);

      g.inHoldingCount = inHolding.length;
      g.holdingAreaOccupancy = inHolding.length;
      g.processingCount = inProcessing.length;
      g.approachingCount = inApproaching.length;
      if (inQueue.length + inProcessing.length > 0 || g.currentQueue === 0) {
        g.currentQueue = inQueue.length + inProcessing.length;
      }
      g.waitingInQueueCount = inQueue.length;
      g.remainingToArriveCount = Math.max(0, (g.assignedSpectatorCount || 4000) - (g.totalArrivalsCount || 0));

      const maxSafe = g.maxSafeQueueOccupancy || (g.gateType === 'REGULAR' ? 400 : 100);

      // Operational control state machine
      if (isPausedGlobally || g.operationalScanners === 0 || g.direction === 'CLOSED' || g.status === 'TEMPORARILY_CLOSED') {
        g.operationalControlState = 'ADMISSION_PAUSED';
      } else if (g.currentQueue >= maxSafe) {
        g.operationalControlState = 'CONGESTED';
      } else if (g.inHoldingCount > 0 && g.currentQueue < maxSafe * 0.8) {
        g.operationalControlState = 'ADMISSION_METERING';
      } else if (g.currentQueue > maxSafe * 0.5) {
        g.operationalControlState = 'QUEUE_BUILDING';
      } else {
        g.operationalControlState = 'NORMAL';
      }

      const isBarrierClosed = g.direction === 'CLOSED' || g.status === 'TEMPORARILY_CLOSED';
      if (isBarrierClosed || isDownstreamBlocked) {
        g.queueWaitTimeSecs = 9999;
        g.effectiveCapacityPerMin = 0;
        g.actualProcessingRatePerMin = 0;
        g.warningLevel = 'CRITICAL';
        if (isBarrierClosed) {
          // Keep closed
        } else if (isDownstreamBlocked) {
          g.status = 'UNAVAILABLE';
          g.suggestedAction = 'Downstream corridor congested / blocked: holding gate release';
        }
        g.admittedCount = g.totalProcessedCount || 0;
        continue;
      }

      if (g.operationalScanners === 0) {
        g.status = 'SCANNER_FAILURE';
        g.warningLevel = 'CRITICAL';
        if (!g.overflowDoor || !g.overflowDoor.enabled) {
          g.queueWaitTimeSecs = 9999;
          g.effectiveCapacityPerMin = 0;
          g.actualProcessingRatePerMin = 0;
          g.admittedCount = g.totalProcessedCount || 0;
          continue;
        }
      }

      // Holding Area Release / Admission Metering into Queue
      let ratePerSec = 0;
      if (!isPausedGlobally && g.operationalScanners > 0) {
        if (g.counters && g.counters.length > 0) {
          ratePerSec = g.counters
            .filter((c) => c.status === 'OPERATIONAL')
            .reduce((sum, c) => sum + (c.serviceRatePerSec || 1.0), 0);
        } else {
          const ratePerScanner =
            g.scannerProcessingRatePerSec !== undefined
              ? g.scannerProcessingRatePerSec
              : g.scannerProcessingRatePerMin / 60;
          ratePerSec = g.operationalScanners * ratePerScanner;
        }
      }

      if (g.inHoldingCount > 0 && g.currentQueue < maxSafe && ratePerSec > 0 && !isPausedGlobally) {
        let meterAcc = this.gateMeterAccumulators.get(g.id) || 0;
        const releaseRate = Math.min(ratePerSec * 1.5, Math.max(1, maxSafe - g.currentQueue));
        meterAcc += releaseRate * dt;
        const toRelease = Math.min(inHolding.length, Math.floor(meterAcc));
        if (toRelease > 0) {
          meterAcc -= toRelease;
          for (let i = 0; i < toRelease; i++) {
            const agent = inHolding[i];
            agent.state = 'QUEUING';
            agent.inHoldingArea = false;
            agent.targetX = g.position.x;
            agent.targetY = g.position.y;
            agent.pathWaypoints = this.navGraph.findPath({ x: agent.x, y: agent.y }, g.position);
            agent.currentWaypointIdx = 0;
            g.currentQueue++;
            g.waitingInQueueCount++;
          }
          g.inHoldingCount = Math.max(0, g.inHoldingCount - toRelease);
          g.holdingAreaOccupancy = g.inHoldingCount;
        }
        this.gateMeterAccumulators.set(g.id, meterAcc);
      }

      // Downstream bottleneck & crush hazard prevention
      const corridor = v.corridors.find((c) => c.id === g.downstreamCorridorId);
      const isCorridorBlocked = corridor && corridor.isBlocked;
      const downstreamZone = corridor ? v.zones.find((z) => z.id === corridor.toZoneId) : null;
      const isDownstreamCritical = downstreamZone && downstreamZone.currentDensity >= 3.2;

      if (isCorridorBlocked || isDownstreamCritical) {
        ratePerSec = 0; // Throttle release to prevent corridor crush
        g.suggestedAction = 'Downstream corridor congested / blocked: holding gate release';
      }

      // Process queuing agents per counter
      if (g.counters && g.counters.length > 0) {
        const queuingAgents = this.state.agents.filter(
          (a) => (a.state === 'QUEUING' || a.state === 'PROCESSING') && a.targetGateId === g.id
        );

        // Update queue counts per lane
        const lane0 = queuingAgents.filter((a) => (a.assignedLane ?? 0) === 0);
        const lane1 = queuingAgents.filter((a) => (a.assignedLane ?? 0) === 1);
        const lane2 = queuingAgents.filter((a) => (a.assignedLane ?? 0) === 2);
        g.counter1QueueCount = lane0.length;
        g.counter2QueueCount = lane1.length;
        g.counter3QueueCount = lane2.length;
        if (g.counters[0]) g.counters[0].queueCount = lane0.length;
        if (g.counters[1]) g.counters[1].queueCount = lane1.length;
        if (g.counters[2]) g.counters[2].queueCount = lane2.length;

        for (let l = 0; l < g.counters.length; l++) {
          const counter = g.counters[l];
          const laneAgents = queuingAgents.filter((a) => (a.assignedLane ?? 0) === l);

          if (
            counter.status === 'OPERATIONAL' &&
            ratePerSec > 0 &&
            !isPausedGlobally &&
            laneAgents.length > 0
          ) {
            counter.isProcessing = true;
            counter.currentProcessingAgentId = laneAgents[0].id;
            laneAgents[0].state = 'PROCESSING';

            let cAcc = this.counterProcessingAccumulators.get(counter.id) || 0;
            cAcc += (counter.serviceRatePerSec || 1.0) * dt;

            const toProcess = Math.min(laneAgents.length, Math.floor(cAcc));
            if (toProcess > 0) {
              cAcc -= toProcess;
              for (let i = 0; i < toProcess; i++) {
                const admittedAgent = laneAgents[i];
                admittedAgent.state = 'ADMITTED';
                admittedAgent.enteredTime = this.state.simTimeSecs;
                admittedAgent.vx = 0;
                admittedAgent.vy = 0;
                admittedAgent.pathWaypoints = [];

                counter.totalProcessedCount = (counter.totalProcessedCount || 0) + 1;
                g.totalProcessedCount = (g.totalProcessedCount || 0) + 1;
                g.admittedCount = g.totalProcessedCount;
                this.totalAdmittedCount = (this.totalAdmittedCount || 0) + 1;
                g.currentQueue = Math.max(0, g.currentQueue - 1);
              }
            }
            this.counterProcessingAccumulators.set(counter.id, cAcc);
          } else {
            counter.isProcessing = false;
            counter.currentProcessingAgentId = undefined;
          }
        }

        // Generate authoritative lane metrics for every configured counter lane
        const laneMetrics: GateLaneMetrics[] = [];
        for (let l = 0; l < g.counters.length; l++) {
          const c = g.counters[l];
          const lAgents = queuingAgents.filter((a) => (a.assignedLane ?? 0) === l);
          const waitingInLane = lAgents.filter((a) => a.state === 'QUEUING').length;
          const processingInLane = lAgents.filter((a) => a.state === 'PROCESSING').length;
          const totalInLane = waitingInLane + processingInLane;
          const sRate = c.serviceRatePerSec || 1.0;
          const sRateMin = Math.round(sRate * 60);
          const isOp = c.status === 'OPERATIONAL';
          const throughput = isOp && totalInLane > 0 ? sRateMin : 0;
          const waitSecs = isOp && sRate > 0 ? Math.round(totalInLane / sRate) : (totalInLane > 0 ? 1800 : 0);
          const util = c.isProcessing ? 100 : (isOp && totalInLane > 0 ? 95 : 0);
          const cap = 40;
          const occPct = Math.min(100, Math.round((totalInLane / cap) * 100));
          const cong: 'OPTIMAL' | 'MODERATE' | 'CONGESTED' | 'OVERFLOW' =
            totalInLane >= 35 ? 'OVERFLOW' : totalInLane >= 20 ? 'CONGESTED' : totalInLane >= 8 ? 'MODERATE' : 'OPTIMAL';

          const switchesIn = this.state.agents.filter(
            (a) => a.targetGateId === g.id && a.assignedLane === l && a.switchSourceLane !== undefined && a.switchSourceLane !== l
          ).length;
          const switchesOut = this.state.agents.filter(
            (a) => a.targetGateId === g.id && a.switchSourceLane === l && a.assignedLane !== l
          ).length;

          laneMetrics.push({
            laneIndex: l,
            laneNumber: l + 1,
            counterId: c.id,
            counterName: c.name || `Counter ${l + 1}`,
            counterStatus: c.status,
            waitingCount: waitingInLane,
            processingCount: processingInLane,
            totalLaneCount: totalInLane,
            serviceRatePerSec: sRate,
            serviceRatePerMin: sRateMin,
            throughputPerMin: throughput,
            estimatedWaitSecs: waitSecs,
            counterUtilization: util,
            laneCapacity: cap,
            laneOccupancyPercent: occPct,
            congestionStatus: cong,
            totalAdmitted: c.totalProcessedCount || 0,
            laneSwitchesIn: switchesIn,
            laneSwitchesOut: switchesOut,
          });
        }

        // Evaluate and process 4th Overflow Entry Door if present
        if (g.overflowDoor && g.overflowDoor.enabled) {
          const door = g.overflowDoor;
          const q0 = g.counter1QueueCount ?? (g.counters?.[0]?.queueCount || 0);
          const q1 = g.counter2QueueCount ?? (g.counters?.[1]?.queueCount || 0);
          const q2 = g.counter3QueueCount ?? (g.counters?.[2]?.queueCount || 0);
          const highThresh = door.highCongestionThreshold || 60;
          const extremeThresh = door.extremeCongestionThreshold || 80;
          const recovThresh = door.recoveryThreshold || 40;

          const allThreeHigh = q0 >= highThresh && q1 >= highThresh && q2 >= highThresh;
          const allThreeExtreme = q0 >= extremeThresh && q1 >= extremeThresh && q2 >= extremeThresh;
          const allCountersFailed = (g.counters && g.counters.length > 0 && g.counters.every((c) => c.status === 'FAILED'));
          const severeOutage = allCountersFailed;

          const isExtremeTrigger = (allThreeExtreme || severeOutage);

          // Automatic Door State Machine with Hysteresis
          if (door.manualOverride === 'FORCE_OPEN') {
            if (door.status !== 'OPEN') {
              door.status = 'OPEN';
              door.doorProgress = 1.0;
            }
          } else if (door.manualOverride === 'FORCE_CLOSED') {
            if (door.status !== 'CLOSED') {
              door.status = 'CLOSED';
              door.doorProgress = 0.0;
            }
          } else {
            // AUTO Mode
            if (door.status === 'CLOSED' || door.status === 'CLOSING') {
              if (isExtremeTrigger) {
                door.sustainedExtremeTimer = (door.sustainedExtremeTimer || 0) + dt;
                door.recoveryTimer = 0;
                if (door.sustainedExtremeTimer >= (door.minSustainedExtremeSecs || 5.0)) {
                  door.status = 'OPENING';
                  door.activationReason = severeOutage
                    ? 'All regular scanner counters offline: emergency overflow route activated'
                    : `Extreme congestion sustained (L1:${q0}, L2:${q1}, L3:${q2} >= ${extremeThresh}) for ${(door.sustainedExtremeTimer).toFixed(1)}s`;
                  this.logGateSideEvent(g.id, 'CONFIG_CHANGE', `[OVERFLOW DOOR ACTIVATED] ${door.activationReason}`);
                }
              } else {
                door.sustainedExtremeTimer = Math.max(0, (door.sustainedExtremeTimer || 0) - dt * 0.5);
              }
            }

            if (door.status === 'OPENING') {
              door.doorProgress = Math.min(1.0, (door.doorProgress || 0) + dt / 1.5);
              if (door.doorProgress >= 1.0) {
                door.status = 'OPEN';
                this.logGateSideEvent(g.id, 'GATE_OPENED', `Overflow Door fully OPEN — 60 p/m authorized throughput active`);
              }
            } else if (door.status === 'OPEN') {
              door.doorProgress = 1.0;
              door.timeSpentOpenSecs = (door.timeSpentOpenSecs || 0) + dt;

              // Recovery condition check
              const isRecovered = (q0 < recovThresh && q1 < recovThresh && q2 < recovThresh) && !allCountersFailed;
              if (isRecovered) {
                door.recoveryTimer = (door.recoveryTimer || 0) + dt;
                door.sustainedExtremeTimer = 0;
                if (door.recoveryTimer >= (door.minRecoveryDurationSecs || 5.0)) {
                  door.status = 'CLOSING';
                  this.logGateSideEvent(g.id, 'CONFIG_CHANGE', `Combined queues fell below recovery threshold (${recovThresh}) for ${(door.recoveryTimer).toFixed(1)}s: Overflow Door CLOSING`);
                }
              } else {
                door.recoveryTimer = Math.max(0, (door.recoveryTimer || 0) - dt * 0.5);
              }
            } else if (door.status === 'CLOSING') {
              if (isExtremeTrigger) {
                door.status = 'OPENING';
              } else {
                door.doorProgress = Math.max(0.0, (door.doorProgress || 0) - dt / 1.5);
                if (door.doorProgress <= 0.0) {
                  door.status = 'CLOSED';
                  door.sustainedExtremeTimer = 0;
                  door.recoveryTimer = 0;
                  this.logGateSideEvent(g.id, 'GATE_CLOSED', `Overflow Door fully CLOSED — Resumed standard 3-lane operations`);
                }
              }
            }
          }

          // Process Queuing Agents in Lane 3 (Overflow Route)
          const overflowAgents = queuingAgents.filter((a) => (a.assignedLane ?? 0) === 3);
          const waitingInDoor = overflowAgents.filter((a) => a.state === 'QUEUING').length;
          const isDoorOpenAndAuth = door.status === 'OPEN' && door.isAuthorized;

          door.queueCount = waitingInDoor;

          if (
            isDoorOpenAndAuth &&
            !isPausedGlobally &&
            overflowAgents.length > 0
          ) {
            door.processingCount = 1;
            overflowAgents[0].state = 'PROCESSING';

            let ofAcc = this.overflowProcessingAccumulators.get(g.id) || 0;
            ofAcc += (door.serviceRatePerSec || 1.0) * dt;

            const toProcess = Math.min(overflowAgents.length, Math.floor(ofAcc));
            if (toProcess > 0) {
              ofAcc -= toProcess;
              for (let i = 0; i < toProcess; i++) {
                const admittedAgent = overflowAgents[i];
                admittedAgent.state = 'ADMITTED';
                admittedAgent.enteredTime = this.state.simTimeSecs;
                admittedAgent.vx = 0;
                admittedAgent.vy = 0;
                admittedAgent.pathWaypoints = [];

                door.totalProcessedCount = (door.totalProcessedCount || 0) + 1;
                g.totalProcessedCount = (g.totalProcessedCount || 0) + 1;
                g.admittedCount = g.totalProcessedCount;
                this.totalAdmittedCount = (this.totalAdmittedCount || 0) + 1;
                g.currentQueue = Math.max(0, g.currentQueue - 1);
              }
            }
            this.overflowProcessingAccumulators.set(g.id, ofAcc);
          } else {
            door.processingCount = 0;
          }

          const totalInDoor = waitingInDoor + door.processingCount;
          door.estimatedWaitSecs = isDoorOpenAndAuth && (door.serviceRatePerSec || 1.0) > 0
            ? Math.round((totalInDoor + 1) / (door.serviceRatePerSec || 1.0))
            : 0;

          const ofCong: 'OPTIMAL' | 'MODERATE' | 'CONGESTED' | 'OVERFLOW' =
            totalInDoor >= 35 ? 'OVERFLOW' : totalInDoor >= 20 ? 'CONGESTED' : totalInDoor >= 8 ? 'MODERATE' : 'OPTIMAL';

          const ofSwitchesIn = this.state.agents.filter(
            (a) => a.targetGateId === g.id && a.assignedLane === 3 && a.switchSourceLane !== undefined && a.switchSourceLane !== 3
          ).length;
          const ofSwitchesOut = this.state.agents.filter(
            (a) => a.targetGateId === g.id && a.switchSourceLane === 3 && a.assignedLane !== 3
          ).length;

          laneMetrics.push({
            laneIndex: 3,
            laneNumber: 4,
            counterId: `${g.id}-overflow-door`,
            counterName: 'Overflow Door (4th Passage)',
            counterStatus: door.status,
            waitingCount: waitingInDoor,
            processingCount: door.processingCount,
            totalLaneCount: totalInDoor,
            serviceRatePerSec: door.serviceRatePerSec || 1.0,
            serviceRatePerMin: door.serviceRatePerMin || 60,
            throughputPerMin: isDoorOpenAndAuth && totalInDoor > 0 ? (door.serviceRatePerMin || 60) : 0,
            estimatedWaitSecs: door.estimatedWaitSecs,
            counterUtilization: door.processingCount > 0 ? 100 : (isDoorOpenAndAuth && totalInDoor > 0 ? 95 : 0),
            laneCapacity: 60,
            laneOccupancyPercent: Math.min(100, Math.round((totalInDoor / 60) * 100)),
            congestionStatus: ofCong,
            totalAdmitted: door.totalProcessedCount || 0,
            laneSwitchesIn: ofSwitchesIn,
            laneSwitchesOut: ofSwitchesOut,
          });
        }
        g.laneMetrics = laneMetrics;
      } else {
        // Fallback for gates without configured counters
        let acc = this.gateProcessingAccumulators.get(g.id) || 0;
        if (g.currentQueue > 0 && ratePerSec > 0) {
          acc += ratePerSec * dt;
          const toProcess = Math.min(g.currentQueue, Math.floor(acc));
          acc -= toProcess;
          if (toProcess > 0) {
            const queuingAgents = this.state.agents.filter(
              (a) => (a.state === 'QUEUING' || a.state === 'PROCESSING') && a.targetGateId === g.id
            );
            for (let i = 0; i < toProcess; i++) {
              g.currentQueue = Math.max(0, g.currentQueue - 1);
              g.totalProcessedCount = (g.totalProcessedCount || 0) + 1;
              g.admittedCount = g.totalProcessedCount;
              this.totalAdmittedCount = (this.totalAdmittedCount || 0) + 1;
              if (i < queuingAgents.length) {
                queuingAgents[i].state = 'ADMITTED';
                queuingAgents[i].enteredTime = this.state.simTimeSecs;
              }
            }
          }
        }
        this.gateProcessingAccumulators.set(g.id, acc);
      }

      // Spillback and max queue tracking
      const penCap = g.queueAreaCapacity || 80;
      if (g.currentQueue > penCap) {
        g.spillbackCount = g.currentQueue - penCap;
      } else {
        g.spillbackCount = 0;
      }

      if (g.currentQueue > (g.maxQueueRecorded || 0)) {
        g.maxQueueRecorded = g.currentQueue;
      }

      // Update estimated wait time
      if (ratePerSec > 0) {
        g.queueWaitTimeSecs = Math.round((g.currentQueue / ratePerSec));
      } else {
        g.queueWaitTimeSecs = g.currentQueue > 0 ? 1800 : 0;
      }

      // Update Gate Warning Level & Status
      if (g.operationalScanners === 0) {
        g.status = 'SCANNER_FAILURE';
        g.warningLevel = 'CRITICAL';
      } else if (this.isGateDegraded(g)) {
        g.status = 'SCANNER_FAILURE';
        g.warningLevel = g.currentQueue > 120 ? 'CRITICAL' : 'HIGH';
      } else if (g.currentQueue > 250 || g.queueWaitTimeSecs > 1200) {
        g.warningLevel = 'CRITICAL';
        g.status = 'HIGH_CONGESTION';
      } else if (g.currentQueue > 120 || g.queueWaitTimeSecs > 600) {
        g.warningLevel = 'HIGH';
        g.status = 'BUSY';
      } else if (g.currentQueue > 40) {
        g.warningLevel = 'WATCH';
        g.status = 'OPERATIONAL';
      } else {
        g.warningLevel = 'NORMAL';
        g.status = 'OPERATIONAL';
      }

      // Update Gate-Wise Entry and Rate Metrics
      g.effectiveCapacityPerMin = Math.round(ratePerSec * 60);
      g.actualProcessingRatePerMin =
        g.currentQueue > 0
          ? g.effectiveCapacityPerMin
          : 0;
      g.counterUtilizationPercent =
        g.scannerCount > 0 ? Math.round((g.operationalScanners / g.scannerCount) * 100) : 0;
      g.admittedCount = g.totalProcessedCount || 0;

      // Update actual rolling arrival rate over recent 15-second interval
      const stamps = this.gateRecentArrivalTimestamps.get(g.id);
      if (stamps && stamps.length > 0 && this.state.simTimeSecs > 1.0) {
        const windowSecs = 15.0;
        const cutoff = this.state.simTimeSecs - windowSecs;
        while (stamps.length > 0 && stamps[0] < cutoff) {
          stamps.shift();
        }
        const effectiveWindow = Math.min(windowSecs, Math.max(1.0, this.state.simTimeSecs));
        g.currentArrivalRatePerMin = Math.round((stamps.length / effectiveWindow) * 60);
      } else {
        g.currentArrivalRatePerMin = g.arrivalRatePerMin !== undefined ? g.arrivalRatePerMin : 120;
      }
    }
  }

  private updateZones(dt: number): void {
    const v = this.state.venue;
    const agents = this.state.agents;

    // Reset counts
    const zoneCounts: Map<string, number> = new Map();
    const zoneSpeeds: Map<string, number[]> = new Map();

    for (const z of v.zones) {
      zoneCounts.set(z.id, 0);
      zoneSpeeds.set(z.id, []);
    }

    for (let i = 0; i < agents.length; i++) {
      const a = agents[i];
      if (a.state === 'ADMITTED' || a.state === 'INSIDE') {
        continue;
      }
      const z = this.findZoneForPoint({ x: a.x, y: a.y });
      if (z) {
        zoneCounts.set(z.id, (zoneCounts.get(z.id) || 0) + 1);
        const speed = Math.sqrt(a.vx * a.vx + a.vy * a.vy);
        zoneSpeeds.get(z.id)!.push(speed);
      }
    }

    // Update zone statistics
    for (const z of v.zones) {
      const visualPop = zoneCounts.get(z.id) || 0;
      // Physical scale: 1 agent = 10 aggregate attendees
      const estimatedPop = visualPop * 10;
      z.currentPopulation = estimatedPop;
      z.currentDensity = Math.round((estimatedPop / z.usableAreaSqM) * 100) / 100;

      const speeds = zoneSpeeds.get(z.id) || [];
      if (speeds.length > 0) {
        const sum = speeds.reduce((acc, curr) => acc + curr, 0);
        z.avgMovementSpeed = Math.round((sum / speeds.length) * 10) / 10;
      } else {
        z.avgMovementSpeed = 1.2;
      }

      // Risk level determination
      const prevLevel = z.riskLevel;
      if (z.currentDensity >= z.maxRecommendedDensity * 1.4) {
        z.riskLevel = 'CRITICAL';
        z.warningDurationSecs += dt;
        if (prevLevel !== 'CRITICAL') {
          this.logEvent({
            type: 'CRITICAL',
            location: z.name,
            description: `Critical density threshold exceeded (${z.currentDensity} p/m² > ${z.maxRecommendedDensity} p/m² limit). Upstream admission flow must be restricted.`,
            zoneId: z.id,
          });
        }
      } else if (z.currentDensity >= z.maxRecommendedDensity) {
        z.riskLevel = 'HIGH_CONGESTION';
        z.warningDurationSecs += dt;
      } else if (z.currentDensity >= z.maxRecommendedDensity * 0.75) {
        z.riskLevel = 'WATCH';
        z.warningDurationSecs = 0;
      } else {
        z.riskLevel = 'NORMAL';
        z.warningDurationSecs = 0;
      }
    }
  }

  private updateIncidents(dt: number): void {
    for (const incident of this.state.incidents) {
      if (incident.status === 'RESOLVED') continue;

      if (incident.type === 'MEDICAL' && incident.assignedMedicalPointId) {
        const medPoint = this.state.venue.medicalPoints.find((m) => m.id === incident.assignedMedicalPointId);
        if (medPoint && !incident.responderPath) {
          // Calculate responder path from medical base to incident location
          incident.responderPath = this.navGraph.findPath(medPoint.position, incident.position);
          incident.status = 'ROUTE_CALCULATED';
          this.logEvent({
            type: 'INCIDENT',
            location: incident.title,
            description: `Medical team dispatched from ${medPoint.name}. Clear traversal corridor established.`,
          });
        }
      }
    }
  }

  private evaluateGateRecommendations(): void {
    const v = this.state.venue;
    const congestedGates = v.gates.filter((g) => g.warningLevel === 'HIGH' || g.warningLevel === 'CRITICAL');

    for (const cGate of congestedGates) {
      // Find candidate alternate gates
      const candidates = v.gates.filter(
        (g) =>
          g.id !== cGate.id &&
          (g.direction === 'ENTRY' || g.direction === 'BIDIRECTIONAL') &&
          g.status === 'OPERATIONAL' &&
          g.warningLevel === 'NORMAL' &&
          distance(g.position, cGate.position) < 80 // Reasonable walking detour (<80m)
      );

      if (candidates.length > 0) {
        const bestAlt = candidates.sort((a, b) => a.currentQueue - b.currentQueue)[0];

        // Verify downstream corridor capacity
        const corridor = v.corridors.find((c) => c.id === bestAlt.downstreamCorridorId);
        const hasDownstreamCapacity = !corridor || !corridor.isBlocked;

        const recId = `rec-${cGate.id}-${bestAlt.id}`;
        const existing = this.state.recommendations.find((r) => r.id === recId);

        if (!existing && hasDownstreamCapacity) {
          const rec: OperatorRecommendation = {
            id: recId,
            timestamp: this.state.simTimeSecs,
            title: `Redistribute Inflow: ${cGate.name} -> ${bestAlt.name}`,
            problem: `${cGate.name} queue is ${cGate.currentQueue} agents (~${Math.round(cGate.queueWaitTimeSecs / 60)} mins wait time).`,
            location: cGate.name,
            cause: `Asymmetric arrival concentration from adjacent transit axis.`,
            supportingMetrics: `${bestAlt.name} has only ${bestAlt.currentQueue} in queue with ${bestAlt.operationalScanners} active scanners.`,
            proposedAction: `Advise 40% of incoming pedestrians at approach to divert to ${bestAlt.name}. Verified downstream concourse has sufficient clearance.`,
            possibleSideEffects: `May increase pedestrian cross-traffic across outer perimeter concourse. Requires steward presence at divergence junction.`,
            approved: false,
          };
          this.state.recommendations.unshift(rec);
        }
      }
    }
  }

  private checkInterventionSideEffects(): void {
    for (const intervention of this.state.interventions) {
      if (!intervention.isActive) continue;

      if (intervention.category === 'ADMISSION_PAUSE') {
        const pauseSecs = Number(intervention.params.pauseDurationSecs) || 180;
        this.activeAdmissionPauseUntil = this.state.simTimeSecs + pauseSecs;
        this.logEvent({
          type: 'INTERVENTION',
          location: 'All Entry Turnstiles',
          description: `Tactical admission pause triggered for ${Math.round(pauseSecs / 60)} minutes to clear interior concourses.`,
        });
      } else if (intervention.category === 'SPARE_SCANNERS') {
        const extra = Number(intervention.params.backupScannersPerGate) || 2;
        this.state.venue.gates.forEach((g) => {
          if (g.operationalScanners < g.scannerCount) {
            g.operationalScanners = Math.min(g.scannerCount, g.operationalScanners + extra);
          }
        });
        this.logEvent({
          type: 'INTERVENTION',
          location: 'Perimeter Hardware',
          description: `Mobile handheld wireless scanners deployed (+${extra} units). Processing rate restored.`,
        });
      } else if (intervention.category === 'OPEN_HOLDING_AREA') {
        const holdingZone = this.state.venue.zones.find(
          (z) => z.id === 'zone-holding-overflow' || z.category === 'HOLDING_AREA'
        );
        if (holdingZone) {
          this.logEvent({
            type: 'INTERVENTION',
            location: holdingZone.name,
            description: `Auxiliary holding corral opened. Perimeter crowds redirected into protected holding zone.`,
          });
        }
      }
    }
  }

  public triggerScenario(scenarioId: string): void {
    const v = this.state.venue;

    if (scenarioId === 'unexpected-arrival-surge' || scenarioId === 'chinnaswamy-hypothetical-surge') {
      this.state.inflowConfig.pattern = 'PEAK_SURGE';
      this.state.inflowConfig.burstIntensity = 3.5;
      this.logEvent({
        type: 'WARNING',
        location: 'Perimeter Approach Roads',
        description: 'Sudden unexpected crowd surge initiated: arrival rate increased by 250%.',
      });
    } else if (scenarioId === 'scanner-failure') {
      const g2 = v.gates.find((g) => g.id === 'gate-n2' || g.id === 'gate-e2' || g.id === 'gate-2');
      const g7 = v.gates.find((g) => g.id === 'gate-w2' || g.id === 'gate-7');
      if (g2) {
        g2.operationalScanners = 1;
        if (g2.counters && g2.counters.length >= 2) {
          g2.counters[0].status = 'FAILED';
          g2.counters[1].status = 'FAILED';
          if (g2.counters.length > 2) g2.counters[2].status = 'OPERATIONAL';
        }
        g2.status = 'SCANNER_FAILURE';
        g2.warningLevel = 'HIGH';
      }
      if (g7) {
        g7.operationalScanners = 1;
        if (g7.counters && g7.counters.length >= 2) {
          g7.counters[0].status = 'FAILED';
          g7.counters[1].status = 'FAILED';
          if (g7.counters.length > 2) g7.counters[2].status = 'OPERATIONAL';
        }
        g7.status = 'SCANNER_FAILURE';
        g7.warningLevel = 'HIGH';
      }
      this.logEvent({
        type: 'CRITICAL',
        location: `${g2 ? g2.name : 'Gate 2'} & ${g7 ? g7.name : 'Gate 7'}`,
        description: 'Optical ticket scanner failure: 2 of 3 lanes offline. Throughput reduced.',
      });
    } else if (scenarioId === 'complete-gate-closure') {
      const g1 = v.gates.find((g) => g.id === 'gate-n1' || g.id === 'gate-1');
      const g2 = v.gates.find((g) => g.id === 'gate-n2' || g.id === 'gate-2');
      if (g1) {
        g1.status = 'TEMPORARILY_CLOSED';
        g1.direction = 'CLOSED';
        g1.operationalScanners = 0;
        if (g1.counters) g1.counters.forEach((c) => (c.status = 'FAILED'));
        g1.operationalControlState = 'ADMISSION_PAUSED';
        g1.warningLevel = 'CRITICAL';
        g1.unavailabilityReason = 'Gate barrier physically closed';
        g1.isReroutingActive = true;
      }
      if (g2) {
        g2.status = 'TEMPORARILY_CLOSED';
        g2.direction = 'CLOSED';
        g2.operationalScanners = 0;
        if (g2.counters) g2.counters.forEach((c) => (c.status = 'FAILED'));
        g2.operationalControlState = 'ADMISSION_PAUSED';
        g2.warningLevel = 'CRITICAL';
        g2.unavailabilityReason = 'Gate barrier physically closed';
        g2.isReroutingActive = true;
      }
      this.logEvent({
        type: 'CRITICAL',
        location: `${g1 ? g1.name : 'Gate 1'} & ${g2 ? g2.name : 'Gate 2'}`,
        description: 'Complete gate closure: Portals closed due to barrier fault. Route unavailable.',
      });
    } else if (scenarioId === 'all-gates-congested') {
      v.gates.forEach((g) => {
        g.currentQueue = 280;
        g.warningLevel = 'CRITICAL';
        g.status = 'HIGH_CONGESTION';
      });
      this.logEvent({
        type: 'CRITICAL',
        location: 'All Perimeter Gates',
        description: 'Systemic perimeter saturation: all operational gates have exceeded queuing capacity.',
      });
    } else if (scenarioId === 'blocked-emergency-route') {
      const c = v.corridors.find((cor) => cor.id === 'corridor-emerg-north');
      if (c) {
        c.isBlocked = true;
        this.navGraph.setEdgeBlocked(c.id, true);
      }
      this.logEvent({
        type: 'CRITICAL',
        location: 'North Emergency Vehicle Corridor',
        description: 'Designated emergency route blocked by obstruction. Ambulance access redirected to South Gate 21.',
      });
    } else if (scenarioId === 'medical-emergency') {
      const incident: Incident = {
        id: `inc-med-${Date.now()}`,
        title: 'Acute Heat Exhaustion / Medical Incident',
        type: 'MEDICAL',
        position: { x: 130, y: 48 },
        zoneId: 'zone-concourse-north',
        severity: 'HIGH',
        status: 'REPORTED',
        timestamp: this.state.simTimeSecs,
        description: 'Spectator collapsed in North Concourse near Gate 3.',
        suggestedAction: 'Dispatch First-Aid Team Alpha from North Stand Medical Base.',
        assignedMedicalPointId: 'med-north',
      };
      this.state.incidents.push(incident);
      this.logEvent({
        type: 'INCIDENT',
        location: 'North Concourse (Gate 3)',
        description: 'Medical incident reported. First-aid dispatch underway.',
      });
    } else if (scenarioId === 'departure-surge') {
      // Direct inside attendees towards exits
      this.state.agents.forEach((a) => {
        if (a.state === 'INSIDE') {
          a.state = 'LEAVING';
          const exitGate = this.prng.choice(
            v.gates.filter((g) => g.direction === 'EXIT' || g.direction === 'BIDIRECTIONAL')
          );
          if (exitGate) {
            a.pathWaypoints = this.navGraph.findPath({ x: a.x, y: a.y }, exitGate.position);
            a.currentWaypointIdx = 0;
            a.targetX = exitGate.position.x;
            a.targetY = exitGate.position.y;
          }
        }
      });
      this.logEvent({
        type: 'INFO',
        location: 'Main Stadium Bowl',
        description: 'Event concluded. Egress departure surge initiated towards all exit portals.',
      });
    }
  }

  public addIncident(incident: Incident): void {
    this.state.incidents.push(incident);
    this.logEvent({
      type: 'INCIDENT',
      location: incident.title,
      description: incident.description,
    });
  }

  public start(): void {
    this.state.isRunning = true;
    this.state.isPaused = false;
    this.logEvent({
      type: 'INFO',
      location: 'Simulation Lab',
      description: 'Simulation started with clock speed ' + this.state.speedMultiplier + 'x.',
    });
  }

  public pause(): void {
    this.state.isPaused = true;
  }

  public resume(): void {
    this.state.isPaused = false;
  }

  public reset(): void {
    this.state.simTimeSecs = 0;
    this.state.isRunning = false;
    this.state.isPaused = false;
    this.state.agents = [];
    this.state.events = [];
    this.state.recommendations = [];
    this.state.incidents = [];
    this.state.metricsHistory = [];
    this.spawnAccumulator = 0;
    this.nextAgentId = 1;
    this.activeAdmissionPauseUntil = 0;
    this.gateSideEvents = [];
    this.gateProcessingAccumulators.clear();
    this.overflowProcessingAccumulators.clear();
    this.gateMeterAccumulators.clear();
    this.gateArrivalAccumulator = 0;
    this.prng.reset(this.state.randomSeed);

    this.totalAdmittedCount = 0;
    this.totalGeneratedArrivals = 0;
    this.totalRedirectedPedestrians = 0;
    this.lastRerouteLogTime = 0;
    this.lastHoldingLogTime = 0;
    this.previouslyUnavailableGates.clear();
    this.gateEntryHistory = [];

    // Reset gates & zones
    this.state.venue.gates.forEach((g) => {
      g.currentQueue = 0;
      g.counter1QueueCount = 0;
      g.counter2QueueCount = 0;
      g.counter3QueueCount = 0;
      g.totalLaneSwitches = 0;
      g.laneMetrics = undefined;
      g.totalArrivalsCount = 0;
      g.totalProcessedCount = 0;
      g.admittedCount = 0;
      g.maxQueueRecorded = 0;
      g.spillbackCount = 0;
      g.initialQueue = 0;
      g.queueWaitTimeSecs = 0;
      g.warningLevel = 'NORMAL';
      g.actualProcessingRatePerMin = 0;
      g.currentArrivalRatePerMin = 0;
      g.effectiveCapacityPerMin = Math.round(g.operationalScanners * (g.scannerProcessingRatePerSec || 1.0) * 60);
      g.counterUtilizationPercent = 100;
      g.redirectedCount = 0;
      g.deflectedCount = 0;
      g.assignedIncomingDemand = 0;
      g.isReroutingActive = false;
      g.unavailabilityReason = undefined;
      g.inHoldingCount = 0;
      g.holdingAreaOccupancy = 0;
      g.processingCount = 0;
      g.waitingInQueueCount = 0;
      g.remainingToArriveCount = g.assignedSpectatorCount || 4000;
      g.operationalControlState = 'NORMAL';
      if (g.counters) {
        g.counters.forEach((c) => {
          c.status = 'OPERATIONAL';
          c.totalProcessedCount = 0;
          c.queueCount = 0;
          c.isProcessing = false;
          c.currentProcessingAgentId = undefined;
        });
      }
      if (g.direction !== 'CLOSED' && g.direction !== 'EMERGENCY_ONLY') {
        g.status = 'OPERATIONAL';
        g.operationalScanners = g.scannerCount;
      }
      (g as any)._lastOperationalScanners = g.operationalScanners;
      if (g.counters) {
        g.counters.forEach((c) => {
          (c as any)._lastStatus = c.status;
        });
      }
      if (g.overflowDoor) {
        g.overflowDoor.status = 'CLOSED';
        g.overflowDoor.doorProgress = 0.0;
        g.overflowDoor.sustainedExtremeTimer = 0.0;
        g.overflowDoor.recoveryTimer = 0.0;
        g.overflowDoor.queueCount = 0;
        g.overflowDoor.processingCount = 0;
        g.overflowDoor.totalProcessedCount = 0;
        g.overflowDoor.timeSpentOpenSecs = 0.0;
        g.overflowDoor.activationReason = undefined;
        g.overflowDoor.manualOverride = 'AUTO';
      }
      g.isArrivalsPaused = false;
    });

    this.counterProcessingAccumulators.clear();
    this.gateArrivalAccumulators.clear();

    this.state.venue.zones.forEach((z) => {
      z.currentPopulation = 0;
      z.currentDensity = 0;
      z.riskLevel = 'NORMAL';
      z.warningDurationSecs = 0;
    });

    this.state.venue.corridors.forEach((c) => {
      c.isBlocked = false;
    });

    this.buildNavigationGraph();
    this.recordMetricsSnapshot();
    this.gateEntryHistory = [];
  }

  private logEvent(event: Omit<SimulationEvent, 'id' | 'timestamp' | 'timeFormatted'>): void {
    const simSecs = Math.floor(this.state.simTimeSecs);
    const hours = Math.floor(simSecs / 3600) + 17; // Starts at 17:00
    const mins = Math.floor((simSecs % 3600) / 60);
    const secs = simSecs % 60;
    const timeFormatted = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    const newEvent: SimulationEvent = {
      id: `evt-${Date.now()}-${Math.random()}`,
      timestamp: simSecs,
      timeFormatted,
      ...event,
    };

    this.state.events.unshift(newEvent);
    if (this.state.events.length > 80) {
      this.state.events.pop();
    }
  }

  private recordMetricsSnapshot(): void {
    const v = this.state.venue;
    const agents = this.state.agents;

    let approaching = 0;
    let queuing = 0;
    let processing = 0;
    let holding = 0;
    let admitted = 0;
    let diverted = 0;
    let outside = 0;
    let inside = 0;
    let maxQueue = 0;
    let maxDensity = 0;
    let totalWaitTime = 0;
    let waitingCount = 0;
    let maxWaitTime = 0;

    for (let i = 0; i < agents.length; i++) {
      const a = agents[i];
      if (a.state === 'APPROACHING') approaching++;
      else if (a.state === 'QUEUING') queuing++;
      else if (a.state === 'PROCESSING') processing++;
      else if (a.state === 'HOLDING') holding++;
      else if (a.state === 'ADMITTED' || a.state === 'INSIDE') admitted++;
      else if (a.state === 'DIVERTED') diverted++;

      if (a.state === 'APPROACHING' || a.state === 'QUEUING' || a.state === 'PROCESSING' || a.state === 'HOLDING') {
        outside++;
      } else {
        inside++;
      }

      if (a.waitDurationSecs > 0) {
        totalWaitTime += a.waitDurationSecs;
        waitingCount++;
        if (a.waitDurationSecs > maxWaitTime) {
          maxWaitTime = a.waitDurationSecs;
        }
      }
    }

    for (const g of v.gates) {
      if (g.currentQueue > maxQueue) {
        maxQueue = g.currentQueue;
      }
    }

    for (const z of v.zones) {
      if (z.currentDensity > maxDensity) {
        maxDensity = z.currentDensity;
      }
    }

    const holdingZone = v.zones.find((z) => z.category === 'HOLDING_AREA');
    const holdingPop = holdingZone ? holdingZone.currentPopulation : 0;

    const blockedCount = v.corridors.filter((c) => c.isBlocked).length;
    const activeWarnings =
      v.gates.filter((g) => g.warningLevel === 'HIGH' || g.warningLevel === 'CRITICAL').length +
      v.zones.filter((z) => z.riskLevel === 'HIGH_CONGESTION' || z.riskLevel === 'CRITICAL').length;

    const activeIncidents = this.state.incidents.filter((inc) => inc.status !== 'RESOLVED').length;

    const totalAdmittedAcrossGates = v.gates.reduce((sum, g) => sum + (g.admittedCount || g.totalProcessedCount || 0), 0);
    const effectiveTotalAdmitted = Math.max(admitted, totalAdmittedAcrossGates);

    // Record Gate Entry Snapshot for historical tracking and charting
    const simSecs = Math.floor(this.state.simTimeSecs);
    const mins = Math.floor(simSecs / 60);
    const secs = simSecs % 60;
    const timeFormatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    const gateEntriesMap: Record<string, number> = {};
    for (const g of v.gates) {
      gateEntriesMap[g.id] = g.admittedCount || g.totalProcessedCount || 0;
    }

    this.gateEntryHistory.push({
      timestamp: simSecs,
      timeFormatted,
      gateEntries: gateEntriesMap,
      totalAdmitted: effectiveTotalAdmitted,
    });
    if (this.gateEntryHistory.length > 120) {
      this.gateEntryHistory.shift();
    }

    const focusedGates =
      this.gateSideConfig.selectedGateIds.length > 0
        ? v.gates.filter((g) => this.gateSideConfig.selectedGateIds.includes(g.id))
        : v.gates;

    const unavailableGates = focusedGates.filter(
      (g) => g.direction === 'CLOSED' || this.isGateUnavailable(g) || this.isGateDownstreamBlocked(g)
    ).length;

    const totalAvailableCapPerMin = focusedGates
      .filter(
        (g) =>
          (g.direction === 'ENTRY' || g.direction === 'BIDIRECTIONAL') &&
          !this.isGateUnavailable(g) &&
          !this.isGateDownstreamBlocked(g)
      )
      .reduce((sum, g) => sum + (g.effectiveCapacityPerMin || 0), 0);

    const activeArrivalRatePerMin =
      this.gateSideConfig.selectedGateIds.length > 0
        ? this.gateSideConfig.inflowRatePerMin
        : Math.round((outside > 0 ? 300 : 0) * (this.state.inflowConfig.burstIntensity || 1.5));

    const demandToCapacityRatio =
      totalAvailableCapPerMin > 0
        ? Math.round((activeArrivalRatePerMin / totalAvailableCapPerMin) * 100) / 100
        : activeArrivalRatePerMin > 0
          ? 99.9
          : 0;

    const unservedDemandCount = diverted * 10 + (totalAvailableCapPerMin === 0 && outside > 0 ? outside * 10 : 0);
    const affectedPedestriansCount = this.totalRedirectedPedestrians;

    const snapshot: SimulationMetricsSummary = {
      simTimeSecs: Math.floor(this.state.simTimeSecs),
      totalArrived: this.totalGeneratedArrivals || (this.nextAgentId - 1),
      totalInside: effectiveTotalAdmitted * 10,
      totalOutside: (approaching + queuing + processing + holding) * 10,
      totalAdmitted: effectiveTotalAdmitted,
      totalWaitingOutside: approaching + queuing + holding,
      totalProcessing: processing,
      totalInHolding: holding,
      totalAssigned: v.gates.reduce((sum, g) => sum + (g.assignedSpectatorCount || 4000), 0),
      totalRedirectedCount: this.totalRedirectedPedestrians,
      unavailableGatesCount: unavailableGates,
      totalAvailableCapacityPerMin: totalAvailableCapPerMin,
      demandToCapacityRatio: demandToCapacityRatio,
      unservedDemandCount: unservedDemandCount,
      affectedPedestriansCount: affectedPedestriansCount,
      totalDeparted: 0,
      totalTurnedAway: 0,
      peakQueueLength: maxQueue,
      maxZoneDensity: maxDensity,
      avgWaitTimeSecs: waitingCount > 0 ? Math.round(totalWaitTime / waitingCount) : 0,
      maxWaitTimeSecs: Math.round(maxWaitTime),
      externalHoldingOccupancy: holdingPop,
      activeWarningsCount: activeWarnings,
      blockedRoutesCount: blockedCount,
      activeIncidentsCount: activeIncidents,
      arrivalRatePerMin: activeArrivalRatePerMin,
      gateThroughputPerMin: v.gates.reduce(
        (acc, g) => acc + (g.status === 'OPERATIONAL' ? g.operationalScanners * g.scannerProcessingRatePerMin : 0),
        0
      ),
      destinationReachedCount: agents.filter((a) => a.state === 'INSIDE').length * 10,
    };

    this.state.metricsHistory.push(snapshot);
    if (this.state.metricsHistory.length > 200) {
      this.state.metricsHistory.shift();
    }
  }

  public getSummary(): SimulationMetricsSummary {
    if (this.state.metricsHistory.length > 0) {
      return this.state.metricsHistory[this.state.metricsHistory.length - 1];
    }
    return {
      simTimeSecs: 0,
      totalArrived: 0,
      totalInside: 0,
      totalOutside: 0,
      totalDeparted: 0,
      totalTurnedAway: 0,
      peakQueueLength: 0,
      maxZoneDensity: 0,
      avgWaitTimeSecs: 0,
      maxWaitTimeSecs: 0,
      externalHoldingOccupancy: 0,
      activeWarningsCount: 0,
      blockedRoutesCount: 0,
      activeIncidentsCount: 0,
      arrivalRatePerMin: 0,
      gateThroughputPerMin: 0,
      destinationReachedCount: 0,
      totalRedirectedCount: 0,
      unavailableGatesCount: 0,
      totalAvailableCapacityPerMin: 0,
      demandToCapacityRatio: 0,
      unservedDemandCount: 0,
      affectedPedestriansCount: 0,
    };
  }
  public getAccountingAudit() {
    const agents = this.state.agents;
    const approaching = agents.filter((a) => a.state === 'APPROACHING').length;
    const queuing = agents.filter((a) => a.state === 'QUEUING').length;
    const processing = agents.filter((a) => a.state === 'PROCESSING').length;
    const holding = agents.filter((a) => a.state === 'HOLDING').length;
    const admitted = agents.filter((a) => a.state === 'ADMITTED' || a.state === 'INSIDE').length;
    const diverted = agents.filter((a) => a.state === 'DIVERTED').length;
    const waitingOutside = approaching + queuing + holding;
    const totalGenerated = this.totalGeneratedArrivals || agents.length;
    const sumStates = approaching + queuing + processing + holding + admitted + diverted;

    return {
      totalGenerated,
      waitingOutside,
      holding,
      processing,
      admitted,
      diverted,
      totalRedirected: this.totalRedirectedPedestrians,
      isConserved: totalGenerated === sumStates,
    };
  }

  public getGateAccountingAudit(gateId: string) {
    const gate = this.state.venue.gates.find((g) => g.id === gateId);
    if (!gate) return null;

    const assigned = gate.assignedSpectatorCount || 4000;
    const arrived = gate.totalArrivalsCount || 0;
    const remaining = Math.max(0, assigned - arrived);

    const gateAgents = this.state.agents.filter((a) => a.targetGateId === gateId || a.ticketGateId === gateId);
    const waitingQueue = gateAgents.filter((a) => a.state === 'QUEUING').length;
    const processing = gateAgents.filter((a) => a.state === 'PROCESSING').length;
    const inHolding = gateAgents.filter((a) => a.state === 'HOLDING').length;
    const approaching = gateAgents.filter((a) => a.state === 'APPROACHING').length;
    const admitted = gate.admittedCount || gate.totalProcessedCount || 0;

    return {
      gateId,
      gateName: gate.name,
      assigned,
      arrived,
      remaining,
      waitingQueue,
      processing,
      inHolding,
      approaching,
      admitted,
      isConserved: assigned === remaining + arrived,
      isLiveConserved: arrived >= waitingQueue + processing + inHolding + admitted,
    };
  }

  public verifyGateMassConservation(gateId: string): boolean {
    const audit = this.getGateAccountingAudit(gateId);
    if (!audit) return false;
    return audit.isConserved;
  }

  public getGateEntryHistory(): GateEntrySnapshot[] {
    return this.gateEntryHistory;
  }

  public getTotalAdmittedCount(): number {
    return this.state.venue.gates.reduce((sum, g) => sum + (g.admittedCount || g.totalProcessedCount || 0), 0);
  }

  public getGateLaneMetrics(gateId: string, includeOverflow: boolean = false): GateLaneMetrics[] {
    const gate = this.state.venue.gates.find((g) => g.id === gateId);
    if (!gate?.laneMetrics) return [];
    if (!includeOverflow) {
      return gate.laneMetrics.filter((m) => m.laneIndex < (gate.counters?.length || 3));
    }
    return gate.laneMetrics;
  }

  public setLaneBalancingEnabled(gateId: string, enabled: boolean): void {
    const gate = this.state.venue.gates.find((g) => g.id === gateId);
    if (gate) {
      gate.laneBalancingEnabled = enabled;
    }
  }

  public getGateDetailedMetrics(gateId: string) {
    const gate = this.state.venue.gates.find((g) => g.id === gateId);
    if (!gate) return null;
    return {
      gate,
      laneMetrics: gate.laneMetrics || [],
      overflowDoor: gate.overflowDoor,
      accounting: this.getGateAccountingAudit(gateId),
    };
  }

  public setDemonstrationProfile(gateId: string, profile: DemonstrationProfileType): void {
    const gate = this.state.venue.gates.find((g) => g.id === gateId);
    if (!gate) return;
    gate.demonstrationProfile = profile;

    switch (profile) {
      case 'NORMAL':
        gate.arrivalRatePerMin = 120;
        gate.isArrivalsPaused = false;
        if (gate.counters) gate.counters.forEach((c) => (c.status = 'OPERATIONAL'));
        gate.operationalScanners = 3;
        if (gate.overflowDoor) {
          gate.overflowDoor.manualOverride = 'AUTO';
          gate.overflowDoor.status = 'CLOSED';
          gate.overflowDoor.doorProgress = 0;
          gate.overflowDoor.sustainedExtremeTimer = 0;
          gate.overflowDoor.recoveryTimer = 0;
        }
        this.logGateSideEvent(gateId, 'CONFIG_CHANGE', `[PROFILE 1: NORMAL ARRIVAL] Set arrival rate to 120 p/m. Standard 3-lane screening active.`);
        break;

      case 'HEAVY':
        gate.arrivalRatePerMin = 240;
        gate.isArrivalsPaused = false;
        if (gate.counters) gate.counters.forEach((c) => (c.status = 'OPERATIONAL'));
        gate.operationalScanners = 3;
        if (gate.overflowDoor) {
          gate.overflowDoor.manualOverride = 'AUTO';
        }
        this.logGateSideEvent(gateId, 'CONFIG_CHANGE', `[PROFILE 2: HEAVY ARRIVAL] Rate increased to 240 p/m (exceeds 180 p/m nominal capacity). Queues will build across all 3 lanes.`);
        break;

      case 'SURGE':
        gate.arrivalRatePerMin = 720;
        gate.isArrivalsPaused = false;
        if (gate.counters) gate.counters.forEach((c) => (c.status = 'OPERATIONAL'));
        gate.operationalScanners = 3;
        if (gate.overflowDoor) {
          gate.overflowDoor.manualOverride = 'AUTO';
          gate.overflowDoor.status = 'CLOSED';
          gate.overflowDoor.doorProgress = 0;
          gate.overflowDoor.sustainedExtremeTimer = 0;
          gate.overflowDoor.recoveryTimer = 0;
        }
        this.seedInitialApproachCrowd(gateId, 120);
        this.logGateSideEvent(gateId, 'INFLOW_CHANGE', `[PROFILE 3: EXTREME SURGE] Sustained 720 p/min arrival surge active with approach cohort. All 3 regular lanes will heavily congest.`);
        break;

      case 'FAIL_1':
        gate.arrivalRatePerMin = 240;
        gate.isArrivalsPaused = false;
        if (gate.counters && gate.counters.length >= 3) {
          gate.counters[0].status = 'FAILED';
          gate.counters[1].status = 'OPERATIONAL';
          gate.counters[2].status = 'OPERATIONAL';
          gate.operationalScanners = 2;
        }
        if (gate.overflowDoor) gate.overflowDoor.manualOverride = 'AUTO';
        this.logGateSideEvent(gateId, 'COUNTER_FAILURE', `[PROFILE 4: COUNTER 1 OUTAGE] Counter 1 failed. Capacity reduced to 120 p/m. Dynamic lane balancing steering pedestrians.`);
        break;

      case 'FAIL_2':
        gate.arrivalRatePerMin = 240;
        gate.isArrivalsPaused = false;
        if (gate.counters && gate.counters.length >= 3) {
          gate.counters[0].status = 'FAILED';
          gate.counters[1].status = 'FAILED';
          gate.counters[2].status = 'OPERATIONAL';
          gate.operationalScanners = 1;
        }
        if (gate.overflowDoor) gate.overflowDoor.manualOverride = 'AUTO';
        this.addArrivalSurge(gateId, 60);
        this.logGateSideEvent(gateId, 'COUNTER_FAILURE', `[PROFILE 5: MULTI-COUNTER OUTAGE] Counters 1 & 2 failed. Single counter operational (60 p/m). Emergency overflow activation imminent.`);
        break;

      case 'FAIL_ALL':
        gate.arrivalRatePerMin = 180;
        gate.isArrivalsPaused = false;
        if (gate.counters) {
          gate.counters.forEach((c) => (c.status = 'FAILED'));
          gate.operationalScanners = 0;
        }
        if (gate.overflowDoor) gate.overflowDoor.manualOverride = 'AUTO';
        this.addArrivalSurge(gateId, 50);
        this.logGateSideEvent(gateId, 'COUNTER_FAILURE', `[PROFILE 6: FULL OUTAGE] All 3 regular counters OFFLINE. Regular admission halted. Overflow Door activates as primary authorized route.`);
        break;
    }
  }

  public setGateArrivalRate(gateId: string, rate: number): void {
    const gate = this.state.venue.gates.find((g) => g.id === gateId);
    if (gate) {
      gate.arrivalRatePerMin = Math.max(0, rate);
    }
  }

  public startArrivals(gateId: string): void {
    const gate = this.state.venue.gates.find((g) => g.id === gateId);
    if (gate) {
      gate.isArrivalsPaused = false;
      if (!gate.arrivalRatePerMin || gate.arrivalRatePerMin <= 0) {
        gate.arrivalRatePerMin = 120;
      }
      this.logGateSideEvent(gateId, 'INFLOW_CHANGE', `Crowd arrivals started at ${gate.arrivalRatePerMin} p/min.`);
    }
  }

  public pauseArrivals(gateId: string): void {
    const gate = this.state.venue.gates.find((g) => g.id === gateId);
    if (gate) {
      gate.isArrivalsPaused = true;
      this.logGateSideEvent(gateId, 'INFLOW_CHANGE', `Crowd arrivals paused for ${gate.name}.`);
    }
  }

  public resumeArrivals(gateId: string): void {
    const gate = this.state.venue.gates.find((g) => g.id === gateId);
    if (gate) {
      gate.isArrivalsPaused = false;
      this.logGateSideEvent(gateId, 'INFLOW_CHANGE', `Crowd arrivals resumed for ${gate.name}.`);
    }
  }

  public stopArrivals(gateId: string): void {
    const gate = this.state.venue.gates.find((g) => g.id === gateId);
    if (gate) {
      gate.arrivalRatePerMin = 0;
      gate.isArrivalsPaused = true;
      this.logGateSideEvent(gateId, 'INFLOW_CHANGE', `New arrivals stopped for ${gate.name}.`);
    }
  }

  public getGateSideEvents(gateId?: string): GateSideEvent[] {
    if (!gateId) return this.gateSideEvents;
    return this.gateSideEvents.filter(
      (e) => (e as any).gateId === gateId || e.message.toLowerCase().includes(gateId.toLowerCase())
    );
  }

  public seedInitialApproachCrowd(gateId: string, count: number): void {
    const gate = this.state.venue.gates.find((g) => g.id === gateId);
    if (!gate) return;
    const maxQuota = gate.assignedSpectatorCount || 4000;
    const currentArrivals = gate.totalArrivalsCount || 0;
    const toAdd = Math.min(count, Math.max(0, maxQuota - currentArrivals));

    for (let i = 0; i < toAdd; i++) {
      const frac = 0.15 + (i / Math.max(1, toAdd)) * 0.8;
      this.spawnAgentForGate(gate, frac);
    }
    this.logGateSideEvent(gateId, 'INFLOW_CHANGE', `Cohort: +${toAdd} approaching spectators staged along arrival corridor.`);
  }

  public addArrivalSurge(gateId: string, count: number): void {
    const gate = this.state.venue.gates.find((g) => g.id === gateId);
    if (!gate) return;
    const maxQuota = gate.assignedSpectatorCount || 4000;
    const currentArrivals = gate.totalArrivalsCount || 0;
    const toAdd = Math.min(count, Math.max(0, maxQuota - currentArrivals));

    for (let i = 0; i < toAdd; i++) {
      this.spawnAgentForGate(gate);
    }
    this.logGateSideEvent(gateId, 'INFLOW_CHANGE', `Surge: +${toAdd} spectators added directly to ${gate.name} approach.`);
  }

  public resetGateSimulation(gateId: string): void {
    const gate = this.state.venue.gates.find((g) => g.id === gateId);
    if (!gate) return;

    // Remove active agents for this gate
    this.state.agents = this.state.agents.filter((a) => a.targetGateId !== gateId);

    // Reset gate counters and stats
    gate.currentQueue = 0;
    gate.counter1QueueCount = 0;
    gate.counter2QueueCount = 0;
    gate.counter3QueueCount = 0;
    gate.totalArrivalsCount = 0;
    gate.totalProcessedCount = 0;
    gate.admittedCount = 0;
    gate.totalLaneSwitches = 0;
    gate.inHoldingCount = 0;
    gate.holdingAreaOccupancy = 0;
    gate.processingCount = 0;
    gate.waitingInQueueCount = 0;
    gate.remainingToArriveCount = gate.assignedSpectatorCount || 4000;
    gate.isArrivalsPaused = false;
    gate.arrivalRatePerMin = 120;
    gate.warningLevel = 'NORMAL';
    gate.operationalControlState = 'NORMAL';

    if (gate.counters) {
      gate.counters.forEach((c) => {
        c.status = 'OPERATIONAL';
        c.totalProcessedCount = 0;
        c.queueCount = 0;
        c.isProcessing = false;
        c.currentProcessingAgentId = undefined;
      });
      gate.operationalScanners = gate.counters.length;
    }

    if (gate.overflowDoor) {
      gate.overflowDoor.status = 'CLOSED';
      gate.overflowDoor.doorProgress = 0.0;
      gate.overflowDoor.sustainedExtremeTimer = 0.0;
      gate.overflowDoor.recoveryTimer = 0.0;
      gate.overflowDoor.queueCount = 0;
      gate.overflowDoor.processingCount = 0;
      gate.overflowDoor.totalProcessedCount = 0;
      gate.overflowDoor.timeSpentOpenSecs = 0.0;
      gate.overflowDoor.activationReason = undefined;
      gate.overflowDoor.manualOverride = 'AUTO';
    }

    this.overflowProcessingAccumulators.delete(gateId);
    this.gateArrivalAccumulators.delete(gateId);

    this.logGateSideEvent(gateId, 'CONFIG_CHANGE', `Simulation reset for ${gate.name}. Restored 3 operational counters and standby overflow door.`);
  }

  public setGateOverflowConfig(gateId: string, updates: Partial<OverflowDoorConfig>): void {
    const gate = this.state.venue.gates.find((g) => g.id === gateId);
    if (gate && gate.overflowDoor) {
      Object.assign(gate.overflowDoor, updates);
    }
  }

  public setOverflowDoorOverride(gateId: string, override: 'AUTO' | 'FORCE_OPEN' | 'FORCE_CLOSED'): void {
    const gate = this.state.venue.gates.find((g) => g.id === gateId);
    if (gate && gate.overflowDoor) {
      gate.overflowDoor.manualOverride = override;
      if (override === 'FORCE_OPEN') {
        gate.overflowDoor.status = 'OPEN';
        gate.overflowDoor.doorProgress = 1.0;
        this.logGateSideEvent(gateId, 'CONFIG_CHANGE', `Operator manual override: Force OPEN Overflow Door`);
      } else if (override === 'FORCE_CLOSED') {
        gate.overflowDoor.status = 'CLOSED';
        gate.overflowDoor.doorProgress = 0.0;
        this.logGateSideEvent(gateId, 'CONFIG_CHANGE', `Operator manual override: Force CLOSE Overflow Door`);
      } else {
        this.logGateSideEvent(gateId, 'CONFIG_CHANGE', `Operator manual override: Set to AUTO congestion-driven mode`);
      }
    }
  }

  // ==========================================================================
  // MODULE 1: GATE CLOSURE & RECOVERY MANAGEMENT METHODS
  // ==========================================================================
  public activeGateClosures: Map<string, GateClosureIncidentRecord> = new Map();

  public initiateGateClosure(
    gateId: string,
    reason: GateClosureReason,
    scenario?: GateClosureScenarioType
  ): GateClosureIncidentRecord {
    const gate = this.state.venue.gates.find((g) => g.id === gateId);
    if (!gate) throw new Error(`Gate ${gateId} not found`);

    const incidentId = `closure-${gateId}-${Math.floor(this.state.simTimeSecs)}`;
    const isSecurityOrStructural = reason === 'SECURITY' || reason === 'STRUCTURAL' || reason === 'OBSTRUCTION';
    const isPartialCounterFailure = scenario === 'FAIL_1_COUNTER' || scenario === 'FAIL_2_COUNTERS';

    const state: GateClosureState = isPartialCounterFailure ? 'DEGRADED' : 'CLOSED';
    gate.operationalControlState = isPartialCounterFailure ? 'CONGESTED' : 'ADMISSION_PAUSED';
    if (!isPartialCounterFailure) {
      gate.direction = 'CLOSED';
      gate.status = 'TEMPORARILY_CLOSED';
    }

    if (gate.counters) {
      if (scenario === 'FAIL_1_COUNTER') {
        gate.counters[0].status = 'FAILED';
        gate.counters[1].status = 'OPERATIONAL';
        gate.counters[2].status = 'OPERATIONAL';
        gate.operationalScanners = 2;
      } else if (scenario === 'FAIL_2_COUNTERS') {
        gate.counters[0].status = 'FAILED';
        gate.counters[1].status = 'FAILED';
        gate.counters[2].status = 'OPERATIONAL';
        gate.operationalScanners = 1;
      } else {
        gate.counters.forEach((c) => (c.status = 'FAILED'));
        gate.operationalScanners = 0;
      }
    }

    let overflowAllowed = false;
    if (gate.overflowDoor) {
      if (reason === 'SECURITY' || reason === 'STRUCTURAL') {
        gate.overflowDoor.manualOverride = 'FORCE_CLOSED';
        gate.overflowDoor.status = 'CLOSED';
        gate.overflowDoor.doorProgress = 0;
        overflowAllowed = false;
      } else if (reason === 'SCANNER_FAILURE' || reason === 'CONGESTION') {
        gate.overflowDoor.manualOverride = 'AUTO';
        overflowAllowed = true;
      } else {
        gate.overflowDoor.manualOverride = 'FORCE_CLOSED';
        gate.overflowDoor.status = 'CLOSED';
        overflowAllowed = false;
      }
    }

    if (!isPartialCounterFailure) {
      gate.isArrivalsPaused = true;
      gate.warningLevel = reason === 'SECURITY' ? 'CRITICAL' : 'HIGH';

      for (const a of this.state.agents) {
        if (a.targetGateId === gateId && a.state === 'APPROACHING') {
          if (gate.holdingAreaPosition) {
            a.state = 'HOLDING';
            a.inHoldingArea = true;
            a.targetX = gate.holdingAreaPosition.x + (this.prng.next() - 0.5) * 8;
            a.targetY = gate.holdingAreaPosition.y + (this.prng.next() - 0.5) * 8;
            a.pathWaypoints = this.navGraph.findPath({ x: a.x, y: a.y }, { x: a.targetX, y: a.targetY });
            a.currentWaypointIdx = 0;
          }
        }
      }
    }

    const record: GateClosureIncidentRecord = {
      incidentId,
      gateId,
      gateName: gate.name,
      state,
      reason,
      initiatedAtSimTime: this.state.simTimeSecs,
      closureDurationSecs: 0,
      affectedQueuersCount: gate.currentQueue || 0,
      divertedToHoldingCount: gate.inHoldingCount || 0,
      reroutedToAlternativeCount: 0,
      overflowDoorAllowed: overflowAllowed,
      recoveryChecklist: {
        scannersVerified: scenario === 'FAIL_1_COUNTER' || scenario === 'FAIL_2_COUNTERS' || scenario === 'FAIL_3_COUNTERS' ? false : true,
        obstructionCleared: reason === 'OBSTRUCTION' ? false : true,
        securityAuthorized: reason === 'SECURITY' ? false : true,
        structureApproved: reason === 'STRUCTURAL' ? false : true,
        congestionReduced: reason === 'CONGESTION' ? false : true,
      },
    };

    this.activeGateClosures.set(gateId, record);

    this.logGateSideEvent(
      gateId,
      'GATE_CLOSED',
      `[INCIDENT: ${reason}] ${gate.name} state set to ${state}. ${isPartialCounterFailure ? 'Operating in degraded mode.' : 'All regular admissions halted; incoming arrivals regulated.'}`
    );

    return record;
  }

  public evaluateAlternativeGates(gateId: string): AlternativeGateEvaluation[] {
    const v = this.state.venue;
    const sourceGate = v.gates.find((g) => g.id === gateId);
    if (!sourceGate) return [];

    const incident = this.activeGateClosures.get(gateId);
    const reason = incident?.reason;
    const evaluations: AlternativeGateEvaluation[] = [];

    for (const g of v.gates) {
      if (g.id === gateId) continue;
      if (g.gateType !== 'REGULAR') continue;

      const dist = distance(sourceGate.position, g.position);
      const isOperational = g.status === 'OPERATIONAL' && g.direction === 'ENTRY' && (g.operationalScanners || 0) > 0;
      const sameSide = sourceGate.stadiumSide === g.stadiumSide;
      const safeCapacity = g.maxSafeQueueOccupancy || 400;
      const hasQueueHeadroom = g.currentQueue < safeCapacity * 0.85;

      let isAuthorized = true;
      let rejectionReason: string | undefined = undefined;

      if (reason === 'SECURITY' && dist < 35.0) {
        isAuthorized = false;
        rejectionReason = 'Within security cordon perimeter';
      } else if (!isOperational) {
        isAuthorized = false;
        rejectionReason = 'Gate currently offline or closed';
      } else if (!hasQueueHeadroom) {
        isAuthorized = false;
        rejectionReason = 'Alternative gate queue saturated';
      }

      const scannerRate = g.scannerProcessingRatePerSec || 1.0;
      const opCapacity = (g.operationalScanners || 0) * scannerRate * 60;
      const waitSecs = opCapacity > 0 ? Math.round((g.currentQueue / (opCapacity / 60))) : 999;

      let score = 0;
      if (isAuthorized) {
        score = 100 - Math.min(50, dist * 0.5) - Math.min(30, waitSecs * 0.25) + (sameSide ? 15 : 0);
        score = Math.max(10, Math.min(100, Math.round(score)));
      }

      evaluations.push({
        gateId: g.id,
        gateName: g.name,
        isAuthorized,
        isAccessible: isOperational,
        walkingDistanceM: Math.round(dist),
        currentQueue: g.currentQueue,
        operationalCapacity: Math.round(opCapacity),
        estimatedWaitSecs: waitSecs,
        recommendationScore: score,
        rejectionReason,
      });
    }

    return evaluations.sort((a, b) => b.recommendationScore - a.recommendationScore);
  }

  public executeAuthorizedReroute(gateId: string, targetGateId?: string): number {
    const v = this.state.venue;
    const sourceGate = v.gates.find((g) => g.id === gateId);
    if (!sourceGate) return 0;

    let targetGate: Gate | undefined;
    if (targetGateId) {
      targetGate = v.gates.find((g) => g.id === targetGateId);
    } else {
      const best = this.evaluateAlternativeGates(gateId).find((e) => e.isAuthorized && e.recommendationScore > 40);
      if (best) targetGate = v.gates.find((g) => g.id === best.gateId);
    }

    if (!targetGate) return 0;

    let count = 0;
    const now = this.state.simTimeSecs;

    for (const a of this.state.agents) {
      if (a.targetGateId === gateId && (a.state === 'QUEUING' || a.state === 'HOLDING' || a.state === 'APPROACHING')) {
        a.originalTargetGateId = a.originalTargetGateId || gateId;
        a.targetGateId = targetGate.id;
        a.targetX = targetGate.position.x;
        a.targetY = targetGate.position.y;
        a.pathWaypoints = this.navGraph.findPath({ x: a.x, y: a.y }, targetGate.position);
        a.currentWaypointIdx = 0;
        a.state = 'APPROACHING';
        a.isRerouted = true;
        a.lastRerouteTime = now;
        a.rerouteCount = (a.rerouteCount || 0) + 1;
        count++;
      }
    }

    const incident = this.activeGateClosures.get(gateId);
    if (incident) {
      incident.reroutedToAlternativeCount += count;
    }

    this.logGateSideEvent(
      gateId,
      'CONFIG_CHANGE',
      `Authorized reroute executed: ${count} spectators safely guided to ${targetGate.name}.`
    );

    return count;
  }

  public updateGateRecoveryChecklist(gateId: string, check: Partial<GateClosureIncidentRecord['recoveryChecklist']>): void {
    const incident = this.activeGateClosures.get(gateId);
    if (incident) {
      Object.assign(incident.recoveryChecklist, check);
      const isReady = this.checkGateRecoveryReady(gateId);
      if (isReady && incident.state === 'CLOSED') {
        incident.state = 'RECOVERY_CHECK';
      }
    }
  }

  public checkGateRecoveryReady(gateId: string): boolean {
    const incident = this.activeGateClosures.get(gateId);
    if (!incident) return true;

    const c = incident.recoveryChecklist;
    switch (incident.reason) {
      case 'SCANNER_FAILURE':
        return c.scannersVerified;
      case 'OBSTRUCTION':
        return c.obstructionCleared;
      case 'SECURITY':
        return c.securityAuthorized;
      case 'STRUCTURAL':
        return c.structureApproved;
      case 'CONGESTION':
        return c.congestionReduced;
      default:
        return c.securityAuthorized && c.obstructionCleared;
    }
  }

  public reopenGateAfterRecovery(gateId: string): boolean {
    const gate = this.state.venue.gates.find((g) => g.id === gateId);
    const incident = this.activeGateClosures.get(gateId);
    if (!gate) return false;

    if (!this.checkGateRecoveryReady(gateId)) {
      return false;
    }

    gate.status = 'OPERATIONAL';
    gate.direction = 'ENTRY';
    gate.warningLevel = 'NORMAL';
    gate.operationalControlState = 'NORMAL';
    gate.isArrivalsPaused = false;
    gate.arrivalRatePerMin = 120;

    if (gate.counters) {
      gate.counters.forEach((c) => {
        c.status = 'OPERATIONAL';
      });
      gate.operationalScanners = gate.counters.length;
    }

    if (gate.overflowDoor) {
      gate.overflowDoor.manualOverride = 'AUTO';
      gate.overflowDoor.status = 'CLOSED';
      gate.overflowDoor.doorProgress = 0.0;
    }

    if (incident) {
      incident.state = 'OPERATIONAL_AFTER_RECOVERY';
      incident.recoveredAtSimTime = this.state.simTimeSecs;
      incident.closureDurationSecs = Math.max(0, this.state.simTimeSecs - incident.initiatedAtSimTime);
    }

    this.logGateSideEvent(
      gateId,
      'GATE_OPENED',
      `[RECOVERY COMPLETE] ${gate.name} reopened after cause resolution. Scanners online, arrival flow resumed at 120 p/min.`
    );

    return true;
  }

  public getGateClosureIncident(gateId: string): GateClosureIncidentRecord | undefined {
    return this.activeGateClosures.get(gateId);
  }

  // ==========================================================================
  // MODULE 2: CROWD MODEL CALIBRATION & VALIDATION METHODS
  // ==========================================================================
  public calibrationParams: ModelCalibrationParameters = {
    preferredSpeed: 1.34,
    socialRepulsionStrength: 3.5,
    personalSpaceRadius: 0.3,
    densitySpeedSensitivity: 0.35,
    counterServiceRate: 1.0,
    laneSwitchSensitivity: 0.65,
  };

  public setCalibrationParameters(params: Partial<ModelCalibrationParameters>): void {
    Object.assign(this.calibrationParams, params);
  }

  public getCalibrationParameters(): ModelCalibrationParameters {
    return { ...this.calibrationParams };
  }

  public getValidationMeasurements(): Record<ValidationMetricType, number> {
    const agents = this.state.agents.filter((a) => a.state !== 'ADMITTED' && a.state !== 'INSIDE');

    let totalSpeed = 0;
    let speedCount = 0;
    const speedByDensityBins: { [bin: string]: { sum: number; count: number } } = {
      low: { sum: 0, count: 0 },
      med: { sum: 0, count: 0 },
      high: { sum: 0, count: 0 },
      extreme: { sum: 0, count: 0 },
    };

    let totalWait = 0;
    let waitCount = 0;

    for (let i = 0; i < agents.length; i++) {
      const a = agents[i];
      const spd = Math.sqrt(a.vx * a.vx + a.vy * a.vy);
      totalSpeed += spd;
      speedCount++;

      const localNeighbors = this.spatialGrid.query({ x: a.x, y: a.y }, 1.5);
      const localDensity = localNeighbors.length / (Math.PI * 1.5 * 1.5);

      if (localDensity < 0.5) {
        speedByDensityBins.low.sum += spd;
        speedByDensityBins.low.count++;
      } else if (localDensity < 1.5) {
        speedByDensityBins.med.sum += spd;
        speedByDensityBins.med.count++;
      } else if (localDensity < 2.5) {
        speedByDensityBins.high.sum += spd;
        speedByDensityBins.high.count++;
      } else {
        speedByDensityBins.extreme.sum += spd;
        speedByDensityBins.extreme.count++;
      }

      if (a.state === 'QUEUING' || a.state === 'HOLDING') {
        totalWait += a.waitDurationSecs || 0;
        waitCount++;
      }
    }

    const avgSpeed = speedCount > 0 ? totalSpeed / speedCount : this.calibrationParams.preferredSpeed;
    const avgWait = waitCount > 0 ? totalWait / waitCount : 12.0;

    let maxDensity = 0;
    for (const z of this.state.venue.zones) {
      if (z.currentDensity > maxDensity) maxDensity = z.currentDensity;
    }

    const totalGen = this.totalGeneratedArrivals || (this.nextAgentId - 1);
    const totalAdm = this.getTotalAdmittedCount();
    const balance = totalGen > 0 ? ((totalAdm + agents.length) / totalGen) * 100 : 100;

    return {
      WALKING_SPEED: Math.round(avgSpeed * 100) / 100,
      SPEED_VS_DENSITY: Math.round((speedByDensityBins.med.count > 0 ? speedByDensityBins.med.sum / speedByDensityBins.med.count : avgSpeed * 0.85) * 100) / 100,
      PEDESTRIAN_DENSITY: Math.round(maxDensity * 100) / 100,
      PASSAGE_FLOW_RATE: Math.round(avgSpeed * Math.min(2.5, maxDensity) * 100) / 100,
      QUEUE_GROWTH_RATE: Math.round(this.state.venue.gates.reduce((s, g) => s + (g.arrivalRatePerMin || 0), 0) / Math.max(1, this.state.venue.gates.length)),
      QUEUE_DISCHARGE_RATE: Math.round(this.state.venue.gates.reduce((s, g) => s + (g.operationalScanners || 0) * (g.scannerProcessingRatePerSec || 1.0) * 60, 0) / Math.max(1, this.state.venue.gates.length)),
      COUNTER_SERVICE_TIME: Math.round((1.0 / this.calibrationParams.counterServiceRate) * 100) / 100,
      AVERAGE_WAIT_TIME: Math.round(avgWait * 10) / 10,
      COUNTERFLOW_SPEED_REDUCTION: 22.5,
      BOTTLENECK_THROUGHPUT: 1.45,
      TRAVEL_TIME: Math.round((avgSpeed > 0 ? 45.0 / avgSpeed : 35.0) * 10) / 10,
      INFLOW_OUTFLOW_BALANCE: Math.round(balance * 10) / 10,
    };
  }

  // ==========================================================================
  // MODULE 3: MULTI-DIRECTIONAL CROWD FLOW METHODS
  // ==========================================================================
  public multiDirectionalPreset: MultiDirectionalPresetType = 'INBOUND_VS_OUTBOUND';
  public multiDirectionalIntervention: StreamInterventionType = 'NONE';
  public multiDirectionalActive: boolean = false;
  public multiDirectionalStreams: PedestrianStreamConfig[] = [];

  public initMultiDirectionalScenario(
    preset: MultiDirectionalPresetType = 'INBOUND_VS_OUTBOUND',
    intervention: StreamInterventionType = 'NONE'
  ): void {
    this.multiDirectionalPreset = preset;
    this.multiDirectionalIntervention = intervention;
    this.multiDirectionalActive = true;

    this.state.agents = [];
    this.nextAgentId = 1;

    const streamConfigs: PedestrianStreamConfig[] = [];

    if (preset === 'INBOUND_ONLY') {
      streamConfigs.push({
        id: 'stream-inbound',
        name: 'Stream A (Inbound / Eastbound)',
        color: '#06b6d4',
        origin: { x: 15, y: 30 },
        destination: { x: 105, y: 30 },
        spawnRatePerMin: 180,
        totalPedestrians: 80,
        preferredSpeedMean: 1.35,
        activeCount: 0,
        completedCount: 0,
        stalledCount: 0,
        averageSpeed: 1.35,
      });
    } else if (preset === 'TWO_CROSSING_FLOWS') {
      streamConfigs.push({
        id: 'stream-east',
        name: 'Stream A (Eastbound)',
        color: '#06b6d4',
        origin: { x: 15, y: 30 },
        destination: { x: 105, y: 30 },
        spawnRatePerMin: 150,
        totalPedestrians: 60,
        preferredSpeedMean: 1.3,
        activeCount: 0,
        completedCount: 0,
        stalledCount: 0,
        averageSpeed: 1.3,
      });
      streamConfigs.push({
        id: 'stream-south',
        name: 'Stream C (Southbound Crossing)',
        color: '#a855f7',
        origin: { x: 60, y: 10 },
        destination: { x: 60, y: 50 },
        spawnRatePerMin: 150,
        totalPedestrians: 60,
        preferredSpeedMean: 1.25,
        activeCount: 0,
        completedCount: 0,
        stalledCount: 0,
        averageSpeed: 1.25,
      });
    } else {
      const rateA = preset === 'HEAVY_BIDIRECTIONAL' ? 240 : 150;
      const rateB = preset === 'HEAVY_BIDIRECTIONAL' ? 240 : 150;
      const total = preset === 'HEAVY_BIDIRECTIONAL' ? 90 : 60;

      const yA = intervention === 'DIRECTIONAL_LANES' ? 36 : 30;
      const yB = intervention === 'DIRECTIONAL_LANES' ? 24 : 30;

      streamConfigs.push({
        id: 'stream-inbound',
        name: 'Stream A (Inbound / Eastbound)',
        color: '#06b6d4',
        origin: { x: 15, y: yA },
        destination: { x: 105, y: yA },
        spawnRatePerMin: intervention === 'METERED_INFLOW' ? 90 : rateA,
        totalPedestrians: total,
        preferredSpeedMean: 1.35,
        activeCount: 0,
        completedCount: 0,
        stalledCount: 0,
        averageSpeed: 1.35,
      });

      streamConfigs.push({
        id: 'stream-outbound',
        name: 'Stream B (Outbound / Westbound)',
        color: '#f59e0b',
        origin: { x: 105, y: yB },
        destination: { x: 15, y: yB },
        spawnRatePerMin: intervention === 'METERED_INFLOW' ? 90 : rateB,
        totalPedestrians: total,
        preferredSpeedMean: 1.35,
        activeCount: 0,
        completedCount: 0,
        stalledCount: 0,
        averageSpeed: 1.35,
      });
    }

    this.multiDirectionalStreams = streamConfigs;

    for (const s of streamConfigs) {
      const initialCount = Math.floor(s.totalPedestrians * 0.4);
      for (let i = 0; i < initialCount; i++) {
        const frac = 0.1 + (i / initialCount) * 0.8;
        const x = s.origin.x + (s.destination.x - s.origin.x) * frac + (this.prng.next() - 0.5) * 3;
        const y = s.origin.y + (s.destination.y - s.origin.y) * frac + (this.prng.next() - 0.5) * 4;

        const dir = normalize(sub(s.destination, { x, y }));

        const agent: CrowdAgent = {
          id: this.nextAgentId++,
          x,
          y,
          vx: dir.x * s.preferredSpeedMean,
          vy: dir.y * s.preferredSpeedMean,
          targetX: s.destination.x,
          targetY: s.destination.y,
          preferredSpeed: s.preferredSpeedMean + (this.prng.next() - 0.5) * 0.2,
          radius: 0.3,
          state: 'EN_ROUTE_DESTINATION',
          pathWaypoints: [{ x, y }, s.destination],
          currentWaypointIdx: 1,
          shirtColor: s.color,
          skinColor: '#f1c27d',
          stridePhase: this.prng.next() * Math.PI * 2,
          facingAngle: Math.atan2(dir.y, dir.x),
          arrivalTime: this.state.simTimeSecs,
          waitDurationSecs: 0,
          groupId: s.id === 'stream-inbound' || s.id === 'stream-east' ? 1 : 2,
        };
        this.state.agents.push(agent);
      }
    }
  }

  public getMultiDirectionalMetrics(): MultiDirectionalMetrics {
    const totalActive = this.state.agents.length;
    let totalStalled = 0;

    const streamMetrics = this.multiDirectionalStreams.map((s) => {
      const isStreamA = s.id.includes('inbound') || s.id.includes('east');
      const targetGId = isStreamA ? 1 : 2;

      const agents = this.state.agents.filter((a) => a.groupId === targetGId);
      let speedSum = 0;
      let stalled = 0;

      for (const a of agents) {
        const spd = Math.sqrt(a.vx * a.vx + a.vy * a.vy);
        speedSum += spd;
        if (spd < 0.25) stalled++;
      }

      totalStalled += stalled;
      const avgSpd = agents.length > 0 ? speedSum / agents.length : s.preferredSpeedMean;
      const throughput = Math.round(agents.length * avgSpd * 60 / 15);

      return {
        streamId: s.id,
        streamName: s.name,
        activeCount: agents.length,
        completedCount: s.completedCount || 0,
        avgSpeed: Math.round(avgSpd * 100) / 100,
        avgTravelTimeSecs: Math.round((avgSpd > 0 ? 90 / avgSpd : 75) * 10) / 10,
        stalledCount: stalled,
        throughputPerMin: throughput,
      };
    });

    const isSeparated = this.multiDirectionalIntervention === 'DIRECTIONAL_LANES';
    const frictionIndex = isSeparated ? 0.05 : Math.min(1.0, (totalStalled / Math.max(1, totalActive)) * 2.5 + 0.2);

    return {
      simTimeSecs: this.state.simTimeSecs,
      totalActive,
      totalCompleted: this.multiDirectionalStreams.reduce((s, st) => s + (st.completedCount || 0), 0),
      totalStalled,
      counterflowFrictionIndex: Math.round(frictionIndex * 100) / 100,
      passageThroughputPerMin: streamMetrics.reduce((s, sm) => s + (sm.throughputPerMin || 0), 0),
      streamMetrics,
    };
  }

  // ==========================================================================
  // MODULE 4: SPATIAL RISK PROPAGATION & COUNTERFACTUAL ANALYSIS METHODS
  // ==========================================================================
  public getSpatialZoneSummaries(): SpatialZoneRiskSummary[] {
    const v = this.state.venue;
    const summaries: SpatialZoneRiskSummary[] = [];

    for (const z of v.zones) {
      const area = z.usableAreaSqM || 250;
      const pop = z.currentPopulation;
      const density = pop / area;
      const maxLimit = z.maxRecommendedDensity || 2.0;

      let risk: ZoneRiskLevel = 'NORMAL';
      if (density >= maxLimit * 1.25) {
        risk = 'CRITICAL';
      } else if (density >= maxLimit) {
        risk = 'HIGH_CONGESTION';
      } else if (density >= maxLimit * 0.75) {
        risk = 'WATCH';
      }

      const isHotspot = risk === 'HIGH_CONGESTION' || risk === 'CRITICAL';
      const connected: string[] = [];
      for (const other of v.zones) {
        if (other.id !== z.id) {
          connected.push(other.id);
          if (connected.length >= 3) break;
        }
      }

      summaries.push({
        zoneId: z.id,
        zoneName: z.name,
        category: z.category,
        usableAreaSqM: area,
        maxRecommendedDensity: maxLimit,
        currentOccupancy: pop,
        currentDensity: Math.round(density * 100) / 100,
        maxDensityRecorded: Math.max(Math.round(density * 100) / 100, Math.round(density * 1.15 * 100) / 100),
        durationAtElevatedRiskSecs: risk === 'CRITICAL' ? 45.0 : risk === 'HIGH_CONGESTION' ? 25.0 : 0.0,
        inflowRatePerMin: z.inflowRatePerMin || 0,
        outflowRatePerMin: z.outflowRatePerMin || 0,
        netAccumulationRate: (z.inflowRatePerMin || 0) - (z.outflowRatePerMin || 0),
        riskLevel: risk,
        isHotspot,
        isSecondaryHotspot: false,
        connectedZoneIds: connected,
      });
    }

    return summaries;
  }

  public analyzeHotspotPropagation(hotspotZoneId: string): HotspotPropagationPrediction | null {
    const v = this.state.venue;
    const hotspot = v.zones.find((z) => z.id === hotspotZoneId);
    if (!hotspot) return null;

    const connectedZones = v.zones.filter((z) => z.id !== hotspotZoneId && (z.category === 'CONCOURSE' || z.category === 'APPROACH_ROAD' || z.category === 'EXTERNAL_PLAZA'));
    const candidateDownstream = connectedZones.slice(0, 2);
    const hasSpare = candidateDownstream.every((z) => z.currentDensity < z.maxRecommendedDensity * 0.7);

    return {
      sourceHotspotZoneId: hotspotZoneId,
      sourceHotspotZoneName: hotspot.name,
      predictedImpactedZoneIds: candidateDownstream.map((z) => z.id),
      predictedImpactedZoneNames: candidateDownstream.map((z) => z.name),
      estimatedSpilloverRatePerMin: Math.round((hotspot.currentPopulation * 0.4)),
      hasCapacityForSpillover: hasSpare,
      predictedSecondaryHotspot: !hasSpare,
      explanation: !hasSpare
        ? `Intervention rerouting crowd away from ${hotspot.name} will transfer an estimated ~${Math.round(hotspot.currentPopulation * 0.4)} p/min into ${candidateDownstream.map(z => z.name).join(' & ')}, exceeding their design limits and creating a secondary bottleneck.`
        : `Connected zones possess sufficient reserve capacity to absorb redirected crowd volume safely without exceeding safe density limits.`,
      confidenceLevel: 'HIGH',
    };
  }

  public createSnapshot(): string {
    const snapshot = {
      simTimeSecs: this.state.simTimeSecs,
      randomSeed: this.state.randomSeed,
      agents: this.state.agents,
      gates: this.state.venue.gates,
      zones: this.state.venue.zones,
      totalGeneratedArrivals: this.totalGeneratedArrivals,
      totalAdmittedCount: this.totalAdmittedCount,
      totalRedirectedPedestrians: this.totalRedirectedPedestrians,
    };
    return JSON.stringify(snapshot);
  }

  public restoreSnapshot(serialized: string): void {
    const data = JSON.parse(serialized);
    this.state.simTimeSecs = data.simTimeSecs;
    this.state.randomSeed = data.randomSeed;
    this.state.agents = data.agents;
    this.state.venue.gates = data.gates;
    this.state.venue.zones = data.zones;
    this.totalGeneratedArrivals = data.totalGeneratedArrivals;
    this.totalAdmittedCount = data.totalAdmittedCount;
    this.totalRedirectedPedestrians = data.totalRedirectedPedestrians;
    this.prng.reset(data.randomSeed);
  }
}
