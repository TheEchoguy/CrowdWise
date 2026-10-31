/**
 * Geometry & Connectivity Validation Suite
 * M. Chinnaswamy Stadium Digital Blueprint
 */

import { CHINNASWAMY_OUTER_GATES } from '../data/outerGates';
import { CHINNASWAMY_INNER_GATES } from '../data/innerGates';
import { CHINNASWAMY_STANDS } from '../data/stands';
import { CHINNASWAMY_PEDESTRIAN_ROUTES } from '../data/pedestrianRoutes';

export interface ValidationSummary {
  isValid: boolean;
  totalOuterGates: number;
  totalInnerGates: number;
  totalStands: number;
  totalRoutes: number;
  verifiedOuterGates: number;
  unverifiedOuterGates: number;
  restrictedOuterGates: number;
  verifiedRoutes: number;
  unverifiedRoutes: number;
  restrictedRoutes: number;
  errors: string[];
}

export function validateStadiumGeometry(): ValidationSummary {
  const errors: string[] = [];
  const outerIds = new Set<string>();
  const innerIds = new Set<string>();
  const standIds = new Set<string>();

  // 1. Verify Outer Gates Uniqueness
  CHINNASWAMY_OUTER_GATES.forEach((og) => {
    if (outerIds.has(og.id)) {
      errors.push(`Duplicate outer gate ID detected: ${og.id}`);
    }
    outerIds.add(og.id);
  });

  // 2. Verify Inner Gates Uniqueness
  CHINNASWAMY_INNER_GATES.forEach((ig) => {
    if (innerIds.has(ig.id)) {
      errors.push(`Duplicate inner gate ID detected: ${ig.id}`);
    }
    innerIds.add(ig.id);
  });

  // 3. Verify Stands Uniqueness
  CHINNASWAMY_STANDS.forEach((stand) => {
    if (standIds.has(stand.id)) {
      errors.push(`Duplicate stand ID detected: ${stand.id}`);
    }
    standIds.add(stand.id);
  });

  // 4. Verify Route Connectivity References
  CHINNASWAMY_PEDESTRIAN_ROUTES.forEach((route) => {
    if (!outerIds.has(route.outerGateId)) {
      errors.push(`Route ${route.id} references non-existent outer gate ${route.outerGateId}`);
    }
    if (!innerIds.has(route.innerGateId)) {
      errors.push(`Route ${route.id} references non-existent inner gate ${route.innerGateId}`);
    }
  });

  // 5. Verification status breakdown
  const verifiedOuterGates = CHINNASWAMY_OUTER_GATES.filter(
    (g) => g.verificationStatus === 'VERIFIED'
  ).length;
  const unverifiedOuterGates = CHINNASWAMY_OUTER_GATES.filter(
    (g) => g.verificationStatus === 'UNVERIFIED'
  ).length;
  const restrictedOuterGates = CHINNASWAMY_OUTER_GATES.filter(
    (g) => g.verificationStatus === 'RESTRICTED'
  ).length;

  const verifiedRoutes = CHINNASWAMY_PEDESTRIAN_ROUTES.filter(
    (r) => r.verificationStatus === 'VERIFIED'
  ).length;
  const unverifiedRoutes = CHINNASWAMY_PEDESTRIAN_ROUTES.filter(
    (r) => r.verificationStatus === 'UNVERIFIED'
  ).length;
  const restrictedRoutes = CHINNASWAMY_PEDESTRIAN_ROUTES.filter(
    (r) => r.verificationStatus === 'RESTRICTED'
  ).length;

  return {
    isValid: errors.length === 0,
    totalOuterGates: CHINNASWAMY_OUTER_GATES.length,
    totalInnerGates: CHINNASWAMY_INNER_GATES.length,
    totalStands: CHINNASWAMY_STANDS.length,
    totalRoutes: CHINNASWAMY_PEDESTRIAN_ROUTES.length,
    verifiedOuterGates,
    unverifiedOuterGates,
    restrictedOuterGates,
    verifiedRoutes,
    unverifiedRoutes,
    restrictedRoutes,
    errors
  };
}

