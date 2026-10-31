/**
 * CROWDWISE — Phase 2: Unified Stadium Pedestrian Ingress Network
 * M. Chinnaswamy Stadium, Bengaluru
 */

import { CHINNASWAMY_OUTER_GATES } from '../data/outerGates';
import { CHINNASWAMY_INNER_GATES } from '../data/innerGates';
import { CHINNASWAMY_STANDS } from '../data/stands';
import { GATE_CONNECTIVITY_CATALOG, INNER_GATE_STAND_CATALOG } from './gateConnectivity';
import { INGRESS_ROUTE_TRAJECTORIES, IngressRoutePath } from './routeGeometry';
import { PedestrianRouteGraph } from './routeGraph';
import { OuterGate, InnerGate, StadiumStand } from '../types/stadium';

export class PedestrianIngressNetwork {
  public static getAllOuterGates(): OuterGate[] {
    return CHINNASWAMY_OUTER_GATES;
  }

  public static getAllInnerGates(): InnerGate[] {
    return CHINNASWAMY_INNER_GATES;
  }

  public static getAllStands(): StadiumStand[] {
    return CHINNASWAMY_STANDS;
  }

  public static getSpectatorOuterGates(): OuterGate[] {
    return CHINNASWAMY_OUTER_GATES.filter(
      (g) => g.accessPermission === 'SPECTATOR_PERMITTED'
    );
  }

  public static getOuterGatesForRoad(roadName: string): OuterGate[] {
    return CHINNASWAMY_OUTER_GATES.filter((g) => g.road === roadName);
  }

  public static getOuterGateById(gateId: string): OuterGate | undefined {
    return CHINNASWAMY_OUTER_GATES.find((g) => g.id === gateId);
  }

  public static getInnerGateById(gateId: string): InnerGate | undefined {
    return CHINNASWAMY_INNER_GATES.find((g) => g.id === gateId);
  }

  public static getStandById(standId: string): StadiumStand | undefined {
    return CHINNASWAMY_STANDS.find((s) => s.id === standId);
  }

  public static getTrajectories(): Record<string, IngressRoutePath> {
    return INGRESS_ROUTE_TRAJECTORIES;
  }

  public static getConnectivityCatalog() {
    return GATE_CONNECTIVITY_CATALOG;
  }

  public static getStandCatalog() {
    return INNER_GATE_STAND_CATALOG;
  }

  public static getGraph() {
    return PedestrianRouteGraph;
  }
}

