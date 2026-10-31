/**
 * CROWDWISE — Multi-Gate Risk Correlation & Dependency Graph Engine
 * Phase 4: Network Risk Propagation & Cascading Failure Analysis
 * M. Chinnaswamy Stadium, Bengaluru
 *
 * Models stadium-wide topological dependencies:
 * - Outer Gate to Inner Bank Mappings
 * - Shared Holding Areas & Shared Destination Stands
 * - Cascading Failure Assessment (e.g. if G7 chokes, impact on G8 and Gate E23)
 * - Network Bottleneck Identification
 */

import {
  GATE_CONNECTIVITY_CATALOG,
  INNER_GATE_STAND_CATALOG,
  getConnectedOuterGates
} from '../stadium/network/gateConnectivity';

export interface GateDependencyNode {
  id: string;
  label: string;
  type: 'OUTER_GATE' | 'INNER_BANK' | 'HOLDING_AREA' | 'STAND';
  sectorRoad: string;
  currentDemand: number;
  capacity: number;
  utilization: number;
  isBottleneck: boolean;
  cascadingRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface GateDependencyLink {
  source: string;
  target: string;
  flowVolume: number;
  isShared: boolean;
  isCongested: boolean;
}

export interface CascadingFailureSimulationResult {
  failedGateId: string;
  primaryImpactSector: string;
  immediateCapacityLossPerMin: number;
  directlyConnectedInnerGates: string[];
  alternativeOuterGates: string[];
  cascadingRiskScore: number; // 0 to 100
  cascadingWarning: string;
  recommendedNetworkAdjustment: string;
  sharedTurnstileLoad: {
    innerGateId: string;
    standName: string;
    currentDemandPerMin: number;
    combinedDemandIfReroutedPerMin: number;
    availableCapacityPerMin: number;
    willChoke: boolean;
  }[];
}

export interface StadiumDependencyGraph {
  nodes: GateDependencyNode[];
  links: GateDependencyLink[];
  sectorLoadBalancing: Record<
    string,
    {
      totalSectorInflow: number;
      totalSectorCapacity: number;
      sectorUtilization: number;
      activeOuterGates: string[];
      activeInnerBanks: string[];
    }
  >;
  criticalNetworkBottlenecks: string[];
}

export class MultiGateRiskCorrelation {
  /**
   * Constructs the full stadium dependency graph connecting Outer Gates,
   * Holding Areas, Inner Turnstiles, and Destination Stands.
   */
  public static buildDependencyGraph(
    gateInflowRates: Record<string, number> = {},
    failedGates: string[] = []
  ): StadiumDependencyGraph {
    const nodes: GateDependencyNode[] = [];
    const links: GateDependencyLink[] = [];
    const bottlenecks: string[] = [];

    const sectorAggregates: Record<
      string,
      {
        totalSectorInflow: number;
        totalSectorCapacity: number;
        sectorUtilization: number;
        activeOuterGates: string[];
        activeInnerBanks: string[];
      }
    > = {};

    // 1. Build Outer Gate Nodes
    Object.entries(GATE_CONNECTIVITY_CATALOG).forEach(([ogId, spec]) => {
      const demand = gateInflowRates[ogId] || 360;
      const connectedInners = spec.connectedInnerGates;
      const combinedCapacity = connectedInners.reduce((acc, igId) => {
        const isFailed = failedGates.includes(ogId) || failedGates.includes(igId);
        const nominal = INNER_GATE_STAND_CATALOG[igId]?.nominalThroughputPerMin || 240;
        return acc + (isFailed ? 0 : nominal);
      }, 0);

      const utilization = combinedCapacity > 0 ? Math.round((demand / combinedCapacity) * 100) : 100;
      const isBottleneck = utilization >= 95 || failedGates.includes(ogId);

      let cascadingRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
      if (failedGates.includes(ogId)) cascadingRisk = 'CRITICAL';
      else if (utilization >= 120) cascadingRisk = 'HIGH';
      else if (utilization >= 90) cascadingRisk = 'MEDIUM';

      if (isBottleneck) bottlenecks.push(ogId);

      nodes.push({
        id: ogId,
        label: `Gate ${ogId} (${spec.road.replace('_', ' ')})`,
        type: 'OUTER_GATE',
        sectorRoad: spec.road,
        currentDemand: demand,
        capacity: combinedCapacity,
        utilization,
        isBottleneck,
        cascadingRiskLevel: cascadingRisk
      });

      // Initialize sector tracking
      if (!sectorAggregates[spec.road]) {
        sectorAggregates[spec.road] = {
          totalSectorInflow: 0,
          totalSectorCapacity: 0,
          sectorUtilization: 0,
          activeOuterGates: [],
          activeInnerBanks: []
        };
      }
      sectorAggregates[spec.road].totalSectorInflow += demand;
      sectorAggregates[spec.road].totalSectorCapacity += combinedCapacity;
      sectorAggregates[spec.road].activeOuterGates.push(ogId);

      // Links: Outer Gate ──► Inner Gates
      connectedInners.forEach((igId) => {
        const share = Math.round(demand / connectedInners.length);
        links.push({
          source: ogId,
          target: igId,
          flowVolume: share,
          isShared: getConnectedOuterGates(igId).length > 1,
          isCongested: utilization >= 95
        });
      });
    });

    // 2. Build Inner Gate Bank Nodes
    Object.entries(INNER_GATE_STAND_CATALOG).forEach(([igId, spec]) => {
      const outerFeeders = getConnectedOuterGates(igId);
      const isFailed = failedGates.includes(igId);
      const capacity = isFailed ? 0 : spec.nominalThroughputPerMin;

      const totalDemand = outerFeeders.reduce((acc, ogId) => {
        const ogDemand = gateInflowRates[ogId] || 360;
        const totalConn = GATE_CONNECTIVITY_CATALOG[ogId]?.connectedInnerGates.length || 1;
        return acc + Math.round(ogDemand / totalConn);
      }, 0);

      const utilization = capacity > 0 ? Math.round((totalDemand / capacity) * 100) : 100;
      const isBottleneck = utilization >= 95 || isFailed;

      let cascadingRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
      if (isFailed) cascadingRisk = 'CRITICAL';
      else if (utilization >= 120) cascadingRisk = 'HIGH';
      else if (utilization >= 90) cascadingRisk = 'MEDIUM';

      if (isBottleneck && !bottlenecks.includes(igId)) bottlenecks.push(igId);

      nodes.push({
        id: igId,
        label: `Bank ${igId} (${spec.standName})`,
        type: 'INNER_BANK',
        sectorRoad: spec.section,
        currentDemand: totalDemand,
        capacity,
        utilization,
        isBottleneck,
        cascadingRiskLevel: cascadingRisk
      });

      // Link: Inner Bank ──► Stand
      links.push({
        source: igId,
        target: spec.standId,
        flowVolume: totalDemand,
        isShared: false,
        isCongested: utilization >= 95
      });
    });

    // Calculate sector utilizations
    Object.keys(sectorAggregates).forEach((sec) => {
      const s = sectorAggregates[sec];
      s.sectorUtilization = s.totalSectorCapacity > 0
        ? Math.round((s.totalSectorInflow / s.totalSectorCapacity) * 100)
        : 100;
    });

    return {
      nodes,
      links,
      sectorLoadBalancing: sectorAggregates,
      criticalNetworkBottlenecks: bottlenecks
    };
  }

  /**
   * Simulates a cascading failure when a gate or inner turnstile bank fails.
   * Investigates alternative gates, shared banks, and verifies whether rerouting
   * will overload adjacent turnstiles.
   */
  public static simulateCascadingRisk(
    failedGateId: string,
    gateInflowRates: Record<string, number> = {}
  ): CascadingFailureSimulationResult {
    const isOuter = failedGateId.startsWith('E');
    const ogSpec = isOuter ? GATE_CONNECTIVITY_CATALOG[failedGateId] : null;
    const igSpec = !isOuter ? INNER_GATE_STAND_CATALOG[failedGateId] : null;

    const sectorRoad = ogSpec?.road || igSpec?.section || 'CUBBON_ROAD';
    const demand = gateInflowRates[failedGateId] || 360;

    let connectedInners: string[] = [];
    let altOuterGates: string[] = [];
    let capacityLoss = 0;

    if (isOuter && ogSpec) {
      connectedInners = ogSpec.connectedInnerGates;
      capacityLoss = connectedInners.reduce(
        (sum, ig) => sum + (INNER_GATE_STAND_CATALOG[ig]?.nominalThroughputPerMin || 240),
        0
      );

      // Find authorized alternative outer gates in the same sector (strictly excluding VIP)
      altOuterGates = Object.entries(GATE_CONNECTIVITY_CATALOG)
        .filter(
          ([gId, s]) =>
            gId !== failedGateId &&
            s.road === ogSpec.road &&
            s.accessPermission === 'SPECTATOR_PERMITTED' &&
            s.verificationStatus === 'VERIFIED'
        )
        .map(([gId]) => gId);
    } else if (igSpec) {
      connectedInners = [failedGateId];
      capacityLoss = igSpec.nominalThroughputPerMin;
      altOuterGates = getConnectedOuterGates(failedGateId);
    }

    // Evaluate shared turnstile impact
    const sharedTurnstileLoad = connectedInners.map((igId) => {
      const stand = INNER_GATE_STAND_CATALOG[igId];
      const nominalCap = stand?.nominalThroughputPerMin || 240;
      const currentDemand = Math.round(demand / Math.max(1, connectedInners.length));

      // What if rerouted to the other connected outer gates?
      const siblingOuter = getConnectedOuterGates(igId).filter((og) => og !== failedGateId);
      const extraLoad = siblingOuter.length > 0 ? Math.round(demand * 0.8) : demand;
      const combined = currentDemand + extraLoad;
      const willChoke = combined > nominalCap;

      return {
        innerGateId: igId,
        standName: stand?.standName || 'Stand',
        currentDemandPerMin: currentDemand,
        combinedDemandIfReroutedPerMin: combined,
        availableCapacityPerMin: nominalCap,
        willChoke
      };
    });

    const chokingBanks = sharedTurnstileLoad.filter((b) => b.willChoke);
    const riskScore = Math.min(
      100,
      Math.round((chokingBanks.length / Math.max(1, sharedTurnstileLoad.length)) * 60 + (capacityLoss > 300 ? 40 : 20))
    );

    let cascadingWarning = `Failure of ${failedGateId} removes ${capacityLoss} p/min capacity from ${sectorRoad}.`;
    if (chokingBanks.length > 0) {
      cascadingWarning += ` WARNING: Direct diversion will overload shared Bank(s) ${chokingBanks
        .map((b) => b.innerGateId)
        .join(', ')} exceeding capacity by +${chokingBanks[0].combinedDemandIfReroutedPerMin - chokingBanks[0].availableCapacityPerMin} p/min.`;
    }

    const recommendedAdjustment =
      altOuterGates.length > 0
        ? `Distribute excess spectators across authorized alternatives (${altOuterGates.slice(0, 2).join(', ')}) with upstream dynamic metering to prevent turnstile throat choke.`
        : `Activate emergency holding pens on public approach and initiate pulsed metering.`;

    return {
      failedGateId,
      primaryImpactSector: sectorRoad,
      immediateCapacityLossPerMin: capacityLoss,
      directlyConnectedInnerGates: connectedInners,
      alternativeOuterGates: altOuterGates,
      cascadingRiskScore: riskScore,
      cascadingWarning,
      recommendedNetworkAdjustment: recommendedAdjustment,
      sharedTurnstileLoad
    };
  }
}
