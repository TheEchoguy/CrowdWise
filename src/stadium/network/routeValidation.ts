/**
 * CROWDWISE — Phase 2: Route Graph Validation Suite
 * M. Chinnaswamy Stadium, Bengaluru
 */

import { GATE_CONNECTIVITY_CATALOG, INNER_GATE_STAND_CATALOG } from './gateConnectivity';
import { INGRESS_ROUTE_TRAJECTORIES } from './routeGeometry';
import { CHINNASWAMY_OUTER_GATES } from '../data/outerGates';
import { CHINNASWAMY_INNER_GATES } from '../data/innerGates';
import { CHINNASWAMY_STANDS } from '../data/stands';

export interface RouteValidationResult {
  isValid: boolean;
  totalConfiguredOuterGates: number;
  totalConfiguredInnerGates: number;
  totalIngressTrajectories: number;
  continuousTrajectoriesCount: number;
  errors: string[];
}

export function validatePedestrianNetwork(): RouteValidationResult {
  const errors: string[] = [];

  const outerIdSet = new Set(CHINNASWAMY_OUTER_GATES.map((g) => g.id));
  const innerIdSet = new Set(CHINNASWAMY_INNER_GATES.map((g) => g.id));
  const standIdSet = new Set(CHINNASWAMY_STANDS.map((s) => s.id));

  // 1. Verify Connectivity Catalog References
  Object.values(GATE_CONNECTIVITY_CATALOG).forEach((spec) => {
    if (!outerIdSet.has(spec.outerGateId)) {
      errors.push(`Gate connectivity catalog has unknown outer gate: ${spec.outerGateId}`);
    }
    spec.connectedInnerGates.forEach((inId) => {
      if (!innerIdSet.has(inId)) {
        errors.push(`Outer gate ${spec.outerGateId} connects to unknown inner gate: ${inId}`);
      }
    });
  });

  // 2. Verify Inner Gate Stand Assignments
  Object.values(INNER_GATE_STAND_CATALOG).forEach((spec) => {
    if (!innerIdSet.has(spec.innerGateId)) {
      errors.push(`Stand catalog has unknown inner gate: ${spec.innerGateId}`);
    }
    if (!standIdSet.has(spec.standId)) {
      errors.push(`Inner gate ${spec.innerGateId} assigns unknown stand: ${spec.standId}`);
    }
  });

  // 3. Verify Route Trajectories Continuity
  let continuousCount = 0;
  Object.values(INGRESS_ROUTE_TRAJECTORIES).forEach((traj) => {
    if (!outerIdSet.has(traj.outerGateId)) {
      errors.push(`Trajectory ${traj.routeKey} has invalid outer gate: ${traj.outerGateId}`);
    }
    if (!innerIdSet.has(traj.innerGateId)) {
      errors.push(`Trajectory ${traj.routeKey} has invalid inner gate: ${traj.innerGateId}`);
    }
    if (!traj.waypoints || traj.waypoints.length < 3) {
      errors.push(`Trajectory ${traj.routeKey} lacks sufficient waypoints for continuous traversal`);
    } else {
      // Check for valid numbers
      for (const wp of traj.waypoints) {
        if (isNaN(wp.x) || isNaN(wp.y) || wp.x <= 0 || wp.y <= 0) {
          errors.push(`Trajectory ${traj.routeKey} has invalid waypoint: (${wp.x}, ${wp.y})`);
          return;
        }
      }
      continuousCount++;
    }
  });

  return {
    isValid: errors.length === 0,
    totalConfiguredOuterGates: Object.keys(GATE_CONNECTIVITY_CATALOG).length,
    totalConfiguredInnerGates: Object.keys(INNER_GATE_STAND_CATALOG).length,
    totalIngressTrajectories: Object.keys(INGRESS_ROUTE_TRAJECTORIES).length,
    continuousTrajectoriesCount: continuousCount,
    errors
  };
}

