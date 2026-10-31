/**
 * CROWDWISE — Phase 2: Route Graph & Network Traversal
 * M. Chinnaswamy Stadium, Bengaluru
 */

import { GATE_CONNECTIVITY_CATALOG, INNER_GATE_STAND_CATALOG, InnerGateStandSpec } from './gateConnectivity';
import { INGRESS_ROUTE_TRAJECTORIES, IngressRoutePath } from './routeGeometry';

export class PedestrianRouteGraph {
  /**
   * Retrieves the specific waypoint trajectory connecting an outer gate to an inner gate.
   */
  public static getRoute(outerGateId: string, innerGateId: string): IngressRoutePath | null {
    const key = `${outerGateId}_${innerGateId}`;
    if (INGRESS_ROUTE_TRAJECTORIES[key]) {
      return INGRESS_ROUTE_TRAJECTORIES[key];
    }

    // Fallback: Check if generic trajectory exists
    const match = Object.values(INGRESS_ROUTE_TRAJECTORIES).find(
      (r) => r.outerGateId === outerGateId && r.innerGateId === innerGateId
    );
    return match || null;
  }

  /**
   * Returns all inner gate IDs accessible from a given outer gate.
   */
  public static getConnectedInnerGates(outerGateId: string): string[] {
    const conn = GATE_CONNECTIVITY_CATALOG[outerGateId];
    return conn ? conn.connectedInnerGates : [];
  }

  /**
   * Returns all outer gates that feed into a specific inner gate.
   */
  public static getFeedingOuterGates(innerGateId: string): string[] {
    const outers: string[] = [];
    Object.values(GATE_CONNECTIVITY_CATALOG).forEach((conn) => {
      if (conn.connectedInnerGates.includes(innerGateId)) {
        outers.push(conn.outerGateId);
      }
    });
    return outers;
  }

  /**
   * Resolves the assigned destination stand for an inner gate.
   */
  public static getStandForInnerGate(innerGateId: string): InnerGateStandSpec | undefined {
    return INNER_GATE_STAND_CATALOG[innerGateId];
  }

  /**
   * Checks whether an outer gate permits general public spectator arrivals.
   */
  public static isSpectatorAllowed(outerGateId: string): boolean {
    const conn = GATE_CONNECTIVITY_CATALOG[outerGateId];
    return conn ? conn.accessPermission === 'SPECTATOR_PERMITTED' : false;
  }

  /**
   * Resolves a complete verified route for a new pedestrian agent,
   * selecting the least congested connected inner gate if multiple options exist.
   */
  public static selectBestRouteForAgent(
    outerGateId: string,
    preferredInnerGateId?: string
  ): IngressRoutePath | null {
    const conn = GATE_CONNECTIVITY_CATALOG[outerGateId];
    if (!conn || conn.connectedInnerGates.length === 0) return null;

    let targetInner = preferredInnerGateId;
    if (!targetInner || !conn.connectedInnerGates.includes(targetInner)) {
      // Pick first connected inner gate (or round-robin)
      targetInner = conn.connectedInnerGates[0];
    }

    return this.getRoute(outerGateId, targetInner);
  }
}

