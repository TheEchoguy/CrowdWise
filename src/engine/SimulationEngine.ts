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
} from '../types';
import { PRNG } from './random';
import { distance, normalize, sub, add, scale, pointInPolygon } from './geometry';
import { SpatialHashGrid } from './spatialHash';
import { NavigationGraph } from './pathfinding';

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
  public gateEntryHistory: GateEntrySnapshot[] = [];
  private gateProcessingAccumulators: Map<string, number> = new Map();
  private gateArrivalAccumulator: number = 0;

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
        estimatedAttendance: initialVenue.planningCapacity || 35000,
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
      g.maxQueueRecorded = g.maxQueueRecorded || 0;
      g.spillbackCount = g.spillbackCount || 0;
      g.initialQueue = g.initialQueue || 0;
      g.queueAreaCapacity = g.queueAreaCapacity || 80;
    });

    this.buildNavigationGraph();
    this.recordMetricsSnapshot();
    this.gateEntryHistory = [];
  }

  public setVenue(venue: Venue): void {
    this.state.venue = JSON.parse(JSON.stringify(venue));
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

    if (config.processingRatePerSec !== undefined) {
      const rateSec = config.processingRatePerSec;
      const rateMin = Math.round(rateSec * 60);
      const targetGates = this.state.venue.gates.filter((g) =>
        this.gateSideConfig.selectedGateIds.includes(g.id)
      );
      targetGates.forEach((g) => {
        g.scannerProcessingRatePerSec = rateSec;
        g.scannerProcessingRatePerMin = rateMin;
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
        g.operationalScanners = Math.min(g.scannerCount, Math.max(0, config.operationalScannersOverride!));
      });
    }
  }

  public logGateSideEvent(type: GateSideEvent['type'], message: string): void {
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
    this.gateSideEvents.unshift(evt);
    if (this.gateSideEvents.length > 60) {
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
      const lanes = Math.max(1, g.scannerCount);

      for (let k = 0; k < visualCount; k++) {
        const lane = k % lanes;
        const depth = Math.floor(k / lanes);
        const offsetT = ((lane - (lanes - 1) / 2) / lanes) * (g.width * 0.75);
        const distBack = 1.8 + depth * 0.9;

        const posX = g.position.x + nx * distBack + tx * offsetT;
        const posY = g.position.y + ny * distBack + ty * offsetT;
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
          state: depth === 0 && lane < g.operationalScanners ? 'PROCESSING' : 'QUEUING',
          targetGateId: g.id,
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

    // Gate nodes (exterior & interior portals)
    v.gates.forEach((g) => {
      this.navGraph.addNode({ id: `nav-gate-${g.id}`, position: g.position, gateId: g.id });
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

    // Connect approach routes to nearest gates
    v.approachRoutes.forEach((ar) => {
      ar.entryGateIds.forEach((gid) => {
        this.navGraph.addEdge(`nav-app-${ar.id}`, `nav-gate-${gid}`, ar.width);
      });
    });

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
    const config = this.state.inflowConfig;
    const simMins = this.state.simTimeSecs / 60;

    // Base rate in people per second
    // For demonstration, map ~35,000 attendance into an observable simulated visual population
    // 1 physical simulated agent represents e.g. 10 aggregate attendees
    const agentRatio = 10;
    const targetAgentsToSpawn = (config.estimatedAttendance + config.unexpectedCrowdAddition) / agentRatio;
    const durationSecs = config.arrivalDurationMinutes * 60;

    let currentRatePerSec = targetAgentsToSpawn / durationSecs;

    // Apply Arrival Pattern
    if (config.pattern === 'PEAK_SURGE') {
      // Bell curve peaking near event start
      const peakTime = config.eventStartTimeMinutes * 60 * 0.7;
      const sigma = durationSecs * 0.25;
      const gaussian = Math.exp(-Math.pow(this.state.simTimeSecs - peakTime, 2) / (2 * sigma * sigma));
      currentRatePerSec *= 0.5 + gaussian * config.burstIntensity;
    } else if (config.pattern === 'TRANSPORT_PULSE') {
      // Pulse bursts every N minutes
      const pulsePeriod = config.transportPulseIntervalMinutes * 60;
      const phase = this.state.simTimeSecs % pulsePeriod;
      if (phase < 60) {
        currentRatePerSec *= config.burstIntensity * 2.2;
      } else {
        currentRatePerSec *= 0.4;
      }
    } else if (config.pattern === 'BURST') {
      if (simMins >= 10 && simMins <= 25) {
        currentRatePerSec *= config.burstIntensity * 2.5;
      }
    }

    // Apply Interventions
    const staggerIntervention = this.state.interventions.find((i) => i.category === 'STAGGER_INFLOW' && i.isActive);
    if (staggerIntervention) {
      const factor = Number(staggerIntervention.params.reductionFactor) || 0.7;
      currentRatePerSec *= factor; // Flattens peak surge
    }

    this.spawnAccumulator += currentRatePerSec * dt;

    // Limit maximum active in-flight visual agents to preserve high FPS (target: up to 1,500 active agents)
    const MAX_VISUAL_AGENTS = 1200;

    while (this.spawnAccumulator >= 1.0) {
      this.spawnAccumulator -= 1.0;

      if (this.state.agents.length >= MAX_VISUAL_AGENTS) {
        // If capped, remove one of the already seated/inside agents that reached destination
        const finishedIdx = this.state.agents.findIndex(
          (a) => a.state === 'INSIDE' && a.currentWaypointIdx >= a.pathWaypoints.length - 1
        );
        if (finishedIdx >= 0) {
          this.state.agents.splice(finishedIdx, 1);
        } else {
          continue;
        }
      }

      this.spawnSingleAgent();
    }

    // Dedicated Gate-Side Inflow Spawner
    if (this.gateSideConfig.selectedGateIds.length > 0) {
      let gateInflowPerSec = this.gateSideConfig.inflowRatePerMin / 60;

      if (this.gateSideConfig.arrivalPattern === 'PEAK_SURGE') {
        const peakTime = Math.min(120, this.gateSideConfig.durationSecs * 0.5);
        const sigma = Math.max(30, this.gateSideConfig.durationSecs * 0.2);
        const gaussian = Math.exp(-Math.pow(this.state.simTimeSecs - peakTime, 2) / (2 * sigma * sigma));
        gateInflowPerSec *= 0.5 + gaussian * 2.0;
      } else if (this.gateSideConfig.arrivalPattern === 'BURST') {
        const cycle = this.state.simTimeSecs % 60;
        if (cycle < 20) {
          gateInflowPerSec *= 2.0;
        } else {
          gateInflowPerSec *= 0.5;
        }
      } else if (this.gateSideConfig.arrivalPattern === 'TRANSPORT_PULSE') {
        const cycle = this.state.simTimeSecs % 90;
        if (cycle < 30) {
          gateInflowPerSec *= 2.4;
        } else {
          gateInflowPerSec *= 0.3;
        }
      }

      this.gateArrivalAccumulator += gateInflowPerSec * dt;

      while (this.gateArrivalAccumulator >= 1.0) {
        this.gateArrivalAccumulator -= 1.0;
        this.spawnGateSideAgent();
      }
    }
  }

  private spawnGateSideAgent(): void {
    const v = this.state.venue;
    const selectedGates = v.gates.filter((g) => this.gateSideConfig.selectedGateIds.includes(g.id));
    if (selectedGates.length === 0) return;

    // Filter operational gates
    const operationalGates = selectedGates.filter(
      (g) => g.direction !== 'CLOSED' && g.status !== 'TEMPORARILY_CLOSED' && g.status !== 'UNAVAILABLE'
    );

    let targetGate: Gate = selectedGates[0];

    if (operationalGates.length > 0) {
      if (this.gateSideConfig.routingPolicy === 'SHORTEST_QUEUE') {
        targetGate = [...operationalGates].sort((a, b) => a.currentQueue - b.currentQueue)[0];
      } else if (this.gateSideConfig.routingPolicy === 'LEAST_WAIT_TIME') {
        targetGate = [...operationalGates].sort((a, b) => a.queueWaitTimeSecs - b.queueWaitTimeSecs)[0];
      } else if (this.gateSideConfig.routingPolicy === 'ROUTE_AWARE') {
        // Route-aware: penalize gates with blocked downstream corridor or congested concourse
        targetGate = [...operationalGates].sort((a, b) => {
          const cA = v.corridors.find((c) => c.id === a.downstreamCorridorId);
          const cB = v.corridors.find((c) => c.id === b.downstreamCorridorId);
          const scoreA = a.currentQueue + (cA?.isBlocked ? 2000 : 0);
          const scoreB = b.currentQueue + (cB?.isBlocked ? 2000 : 0);
          return scoreA - scoreB;
        })[0];
      } else {
        // FIXED_ALLOCATION: uniform random or round-robin
        targetGate = this.prng.choice(operationalGates);
      }
    } else {
      // All gates closed: held at entrance
      targetGate = selectedGates[0];
    }

    this.totalGeneratedArrivals++;
    targetGate.totalArrivalsCount = (targetGate.totalArrivalsCount || 0) + 1;

    // Spawn point along gate's approach route
    const route =
      v.approachRoutes.find((ar) => ar.entryGateIds.includes(targetGate.id)) || v.approachRoutes[0];
    const jitterX = this.prng.range(-route.width * 0.4, route.width * 0.4);
    const jitterY = this.prng.range(-2, 2);
    const spawnX = route.startPoint.x + jitterX;
    const spawnY = route.startPoint.y + jitterY;

    const path = this.navGraph.findPath({ x: spawnX, y: spawnY }, targetGate.position);

    const agent: CrowdAgent = {
      id: this.nextAgentId++,
      x: spawnX,
      y: spawnY,
      vx: 0,
      vy: 0,
      targetX: targetGate.position.x,
      targetY: targetGate.position.y,
      preferredSpeed: this.prng.range(1.15, 1.45),
      radius: 0.32,
      state: 'APPROACHING',
      targetGateId: targetGate.id,
      pathWaypoints: path,
      currentWaypointIdx: 0,
      shirtColor: this.prng.choice(SHIRT_COLORS),
      skinColor: this.prng.choice(SKIN_TONES),
      stridePhase: this.prng.range(0, Math.PI * 2),
      facingAngle: 0,
      arrivalTime: this.state.simTimeSecs,
      waitDurationSecs: 0,
    };

    this.state.agents.push(agent);
  }

  private spawnSingleAgent(): void {
    const v = this.state.venue;
    if (v.approachRoutes.length === 0) return;

    // Pick approach route according to configured share percentages
    let r = this.prng.range(0, 100);
    let chosenRoute = v.approachRoutes[0];
    let cumulative = 0;
    for (const ar of v.approachRoutes) {
      cumulative += ar.sharePercentage;
      if (r <= cumulative) {
        chosenRoute = ar;
        break;
      }
    }

    // Spawn point with slight lateral jitter across route width
    const jitterX = this.prng.range(-chosenRoute.width * 0.4, chosenRoute.width * 0.4);
    const jitterY = this.prng.range(-3, 3);
    const spawnX = chosenRoute.startPoint.x + jitterX;
    const spawnY = chosenRoute.startPoint.y + jitterY;

    // Choose target gate among entry gates associated with route
    const entryGates = v.gates.filter(
      (g) =>
        chosenRoute.entryGateIds.includes(g.id) &&
        (g.direction === 'ENTRY' || g.direction === 'BIDIRECTIONAL') &&
        g.status !== 'TEMPORARILY_CLOSED' &&
        g.status !== 'UNAVAILABLE'
    );

    let targetGate = entryGates.length > 0 ? this.prng.choice(entryGates) : v.gates[0];

    // Check REROUTE_APPROACH intervention
    const rerouteIntervention = this.state.interventions.find(
      (i) => i.category === 'REROUTE_APPROACH' && i.isActive
    );
    if (rerouteIntervention && targetGate) {
      const sourceIds = (rerouteIntervention.params.sourceGateIds as any as string[]) || [];
      const targetIds = (rerouteIntervention.params.targetGateIds as any as string[]) || [];
      const ratio = Number(rerouteIntervention.params.maxDiversionRatio) || 0.6;
      if (sourceIds.includes(targetGate.id) && targetIds.length > 0 && this.prng.next() <= ratio) {
        const altGate = v.gates.find((g) => targetIds.includes(g.id) && g.status === 'OPERATIONAL');
        if (altGate) {
          targetGate = altGate;
        }
      }
    }

    // Check OPEN_HOLDING_AREA intervention: redirect approaching agents if gate is congested
    const holdingIntervention = this.state.interventions.find(
      (i) => i.category === 'OPEN_HOLDING_AREA' && i.isActive
    );
    let targetPos = targetGate.position;
    let isHoldingRedirect = false;
    if (
      holdingIntervention &&
      (targetGate.currentQueue > 35 || targetGate.warningLevel === 'HIGH' || targetGate.warningLevel === 'CRITICAL')
    ) {
      const holdingZone = v.zones.find(
        (z) => z.id === 'zone-holding-overflow' || z.category === 'HOLDING_AREA'
      );
      if (holdingZone && this.prng.next() < 0.45) {
        let cx = 0, cy = 0;
        holdingZone.polygon.forEach((p) => { cx += p.x; cy += p.y; });
        targetPos = {
          x: cx / holdingZone.polygon.length + this.prng.range(-6, 6),
          y: cy / holdingZone.polygon.length + this.prng.range(-6, 6),
        };
        isHoldingRedirect = true;
      }
    }

    // Compute navigation path from spawn to target
    const path = this.navGraph.findPath({ x: spawnX, y: spawnY }, targetPos);

    this.totalGeneratedArrivals++;
    const agent: CrowdAgent = {
      id: this.nextAgentId++,
      x: spawnX,
      y: spawnY,
      vx: 0,
      vy: 0,
      targetX: targetPos.x,
      targetY: targetPos.y,
      preferredSpeed: this.prng.range(1.1, 1.45),
      radius: 0.32,
      state: isHoldingRedirect ? 'DIVERTED' : 'APPROACHING',
      targetGateId: isHoldingRedirect ? undefined : targetGate.id,
      targetZoneId: isHoldingRedirect ? 'zone-holding-overflow' : undefined,
      pathWaypoints: path,
      currentWaypointIdx: 0,
      shirtColor: this.prng.choice(SHIRT_COLORS),
      skinColor: this.prng.choice(SKIN_TONES),
      stridePhase: this.prng.range(0, Math.PI * 2),
      facingAngle: 0,
      arrivalTime: this.state.simTimeSecs,
      waitDurationSecs: 0,
    };

    this.state.agents.push(agent);
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

          // Find agent position in queue line
          const gateQueuers = agents.filter(
            (ag) => (ag.state === 'QUEUING' || ag.state === 'PROCESSING') && ag.targetGateId === gate.id
          );
          const k = Math.max(0, gateQueuers.indexOf(a));
          const lanes = Math.max(1, gate.scannerCount);
          const lane = k % lanes;
          const depth = Math.floor(k / lanes);

          const offsetT = ((lane - (lanes - 1) / 2) / lanes) * (gate.width * 0.75);
          const distBack = 1.6 + depth * 0.85;

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
          }
          a.x += a.vx * dt;
          a.y += a.vy * dt;
          a.facingAngle = Math.atan2(-ny, -nx);

          if (depth === 0 && lane < gate.operationalScanners) {
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
              a.state = 'QUEUING';
              const gate = v.gates.find((g) => g.id === a.targetGateId);
              if (gate) {
                gate.currentQueue++;
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
      }

      // Smooth velocity interpolation
      a.vx = a.vx * 0.7 + (desiredVx + repulseX) * 0.3;
      a.vy = a.vy * 0.7 + (desiredVy + repulseY) * 0.3;

      // Apply movement
      a.x += a.vx * dt;
      a.y += a.vy * dt;

      // Keep within venue bounds
      a.x = Math.max(2, Math.min(v.dimensions.width - 2, a.x));
      a.y = Math.max(2, Math.min(v.dimensions.height - 2, a.y));
    }
  }

  private updateGates(dt: number): void {
    const v = this.state.venue;
    const isPausedGlobally = this.activeAdmissionPauseUntil > this.state.simTimeSecs;

    for (const g of v.gates) {
      if (g.direction === 'CLOSED' || g.status === 'TEMPORARILY_CLOSED' || g.status === 'UNAVAILABLE') {
        g.queueWaitTimeSecs = 9999;
        g.effectiveCapacityPerMin = 0;
        g.actualProcessingRatePerMin = 0;
        continue;
      }

      // Effective processing rate per second
      let ratePerSec = 0;
      if (!isPausedGlobally) {
        const ratePerScanner =
          g.scannerProcessingRatePerSec !== undefined
            ? g.scannerProcessingRatePerSec
            : g.scannerProcessingRatePerMin / 60;
        ratePerSec = g.operationalScanners * ratePerScanner;
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

      // Process queuing agents using exact mass-balance accumulator
      let acc = this.gateProcessingAccumulators.get(g.id) || 0;
      if (g.currentQueue > 0 && ratePerSec > 0) {
        acc += ratePerSec * dt;
        const toProcess = Math.min(g.currentQueue, Math.floor(acc));
        acc -= toProcess;

        if (toProcess > 0) {
          const queuingAgents = this.state.agents.filter(
            (a) => (a.state === 'QUEUING' || a.state === 'PROCESSING') && a.targetGateId === g.id
          );
          // Sort queuingAgents so that agents in 'PROCESSING' state (front lanes) are admitted first
          queuingAgents.sort((a, b) => (a.state === 'PROCESSING' ? -1 : (b.state === 'PROCESSING' ? 1 : 0)));

          for (let i = 0; i < toProcess; i++) {
            g.currentQueue = Math.max(0, g.currentQueue - 1);
            g.totalProcessedCount = (g.totalProcessedCount || 0) + 1;
            g.admittedCount = g.totalProcessedCount;
            this.totalAdmittedCount = (this.totalAdmittedCount || 0) + 1;

            if (i < queuingAgents.length) {
              const agent = queuingAgents[i];
              agent.state = 'ADMITTED';
              agent.enteredTime = this.state.simTimeSecs;
              agent.vx = 0;
              agent.vy = 0;
              agent.pathWaypoints = [];
            }
          }
        }
      }

      this.gateProcessingAccumulators.set(g.id, acc);

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

      // Update Gate Warning Level
      if (g.currentQueue > 250 || g.queueWaitTimeSecs > 1200) {
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
        if (g.status === 'BUSY' || g.status === 'HIGH_CONGESTION') {
          g.status = 'OPERATIONAL';
        }
      }

      // Update Gate-Wise Entry and Rate Metrics
      const scannerRate =
        g.scannerProcessingRatePerSec !== undefined
          ? g.scannerProcessingRatePerSec
          : (g.scannerProcessingRatePerMin ? g.scannerProcessingRatePerMin / 60 : 1.0);
      g.effectiveCapacityPerMin = Math.round(g.operationalScanners * scannerRate * 60);
      g.actualProcessingRatePerMin =
        g.currentQueue > 0
          ? g.effectiveCapacityPerMin
          : 0;
      g.counterUtilizationPercent =
        g.scannerCount > 0 ? Math.round((g.operationalScanners / g.scannerCount) * 100) : 0;
      g.admittedCount = g.totalProcessedCount || 0;

      if (this.gateSideConfig.selectedGateIds.includes(g.id)) {
        g.currentArrivalRatePerMin = Math.round(
          this.gateSideConfig.inflowRatePerMin / Math.max(1, this.gateSideConfig.selectedGateIds.length)
        );
      } else {
        const simMins = Math.max(0.1, this.state.simTimeSecs / 60);
        g.currentArrivalRatePerMin = Math.round((g.totalArrivalsCount || 0) / simMins);
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
      const g2 = v.gates.find((g) => g.id === 'gate-2');
      const g7 = v.gates.find((g) => g.id === 'gate-7');
      if (g2) {
        g2.operationalScanners = 1;
        g2.status = 'SCANNER_FAILURE';
        g2.warningLevel = 'HIGH';
      }
      if (g7) {
        g7.operationalScanners = 1;
        g7.status = 'SCANNER_FAILURE';
        g7.warningLevel = 'HIGH';
      }
      this.logEvent({
        type: 'CRITICAL',
        location: 'Gate 2 & Gate 7',
        description: 'Optical ticket scanner failure: 75% of lanes offline. Throughput reduced from 72/min to 12/min.',
      });
    } else if (scenarioId === 'complete-gate-closure') {
      const g1 = v.gates.find((g) => g.id === 'gate-1');
      if (g1) {
        g1.status = 'TEMPORARILY_CLOSED';
        g1.direction = 'CLOSED';
        g1.warningLevel = 'CRITICAL';
      }
      this.logEvent({
        type: 'CRITICAL',
        location: 'Gate 1 Main Portal',
        description: 'Gate 1 completely closed due to barrier obstruction. Route unavailable.',
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
    this.gateArrivalAccumulator = 0;
    this.prng.reset(this.state.randomSeed);

    this.totalAdmittedCount = 0;
    this.totalGeneratedArrivals = 0;
    this.gateEntryHistory = [];

    // Reset gates & zones
    this.state.venue.gates.forEach((g) => {
      g.currentQueue = 0;
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
      if (g.direction !== 'CLOSED' && g.direction !== 'EMERGENCY_ONLY') {
        g.status = 'OPERATIONAL';
        g.operationalScanners = g.scannerCount;
      }
    });

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
      else if (a.state === 'ADMITTED' || a.state === 'INSIDE') admitted++;
      else if (a.state === 'DIVERTED') diverted++;

      if (a.state === 'APPROACHING' || a.state === 'QUEUING' || a.state === 'PROCESSING') {
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

    const snapshot: SimulationMetricsSummary = {
      simTimeSecs: Math.floor(this.state.simTimeSecs),
      totalArrived: this.totalGeneratedArrivals || (this.nextAgentId - 1),
      totalInside: effectiveTotalAdmitted * 10,
      totalOutside: (approaching + queuing + processing) * 10,
      totalAdmitted: effectiveTotalAdmitted,
      totalWaitingOutside: approaching + queuing,
      totalProcessing: processing,
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
      arrivalRatePerMin: Math.round((outside > 0 ? 300 : 0) * (this.state.inflowConfig.burstIntensity || 1.5)),
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
    };
  }
  public getAccountingAudit() {
    const agents = this.state.agents;
    const approaching = agents.filter((a) => a.state === 'APPROACHING').length;
    const queuing = agents.filter((a) => a.state === 'QUEUING').length;
    const processing = agents.filter((a) => a.state === 'PROCESSING').length;
    const admitted = agents.filter((a) => a.state === 'ADMITTED' || a.state === 'INSIDE').length;
    const diverted = agents.filter((a) => a.state === 'DIVERTED').length;
    const waitingOutside = approaching + queuing;
    const totalGenerated = this.totalGeneratedArrivals || agents.length;
    const sumStates = waitingOutside + processing + admitted + diverted;

    return {
      totalGenerated,
      waitingOutside,
      processing,
      admitted,
      diverted,
      isConserved: totalGenerated === sumStates,
    };
  }

  public getGateEntryHistory(): GateEntrySnapshot[] {
    return this.gateEntryHistory;
  }

  public getTotalAdmittedCount(): number {
    return this.state.venue.gates.reduce((sum, g) => sum + (g.admittedCount || g.totalProcessedCount || 0), 0);
  }
}
