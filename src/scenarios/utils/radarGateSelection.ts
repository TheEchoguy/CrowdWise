/**
 * CROWDWISE — Macro Stadium Radar Gate Selection Utility
 * Pure geometry, coordinate conversion, and hit-testing for 21 Perimeter Gates
 * Venue: M. Chinnaswamy Stadium, Bengaluru (35,000 capacity)
 */

import {
  STADIUM_21_GATES,
  StadiumGateDefinition,
  RADAR_CANVAS_WIDTH,
  RADAR_CANVAS_HEIGHT,
  RADAR_CENTER_X,
  RADAR_CENTER_Y,
  RADAR_OUTER_RADIUS,
  RADAR_GATE_HIT_TOLERANCE_PX
} from '../data/stadium21GateConfig';

export {
  RADAR_CANVAS_WIDTH,
  RADAR_CANVAS_HEIGHT,
  RADAR_CENTER_X,
  RADAR_CENTER_Y,
  RADAR_OUTER_RADIUS,
  RADAR_GATE_HIT_TOLERANCE_PX
};

/**
 * Click tolerance in canvas pixels.
 * Midpoint distance between closest gates (G20 & G21, 12° apart at R=170) is 17.77px.
 * A tolerance of 16px guarantees:
 * 1. Generous click hit target for all 21 gate stanchions and labels.
 * 2. Clicks at the midpoint between any two gates are rejected (min dist >= 17.77px > 16px).
 * 3. Empty radar space (center pitch, outer corners) is rejected.
 */
export const DEFAULT_GATE_CLICK_TOLERANCE_PX = 16;

export interface RadarGateCoordinate {
  readonly gateNumber: number;
  readonly id: string;
  readonly name: string;
  readonly sectorId: string;
  readonly angleDeg: number;
  readonly x: number;
  readonly y: number;
  readonly approachStreet: string;
  readonly gateDefinition: StadiumGateDefinition;
}

export interface DOMRectLike {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface GateHitResult {
  readonly gate: RadarGateCoordinate;
  readonly distancePx: number;
}

/**
 * Computes exact (x, y) coordinates for all 21 perimeter gates on the Macro Stadium Radar.
 */
export function computeRadarGateCoordinates(
  centerX: number = RADAR_CENTER_X,
  centerY: number = RADAR_CENTER_Y,
  outerRadius: number = RADAR_OUTER_RADIUS
): readonly RadarGateCoordinate[] {
  return STADIUM_21_GATES.map((gate) => {
    const rad = (gate.angleDeg * Math.PI) / 180;
    return {
      gateNumber: gate.gateNumber,
      id: gate.id,
      name: gate.displayName,
      sectorId: gate.sectorId,
      angleDeg: gate.angleDeg,
      x: centerX + Math.cos(rad) * outerRadius,
      y: centerY + Math.sin(rad) * outerRadius,
      approachStreet: gate.entryRoadGroup,
      gateDefinition: gate
    };
  });
}

/**
 * Converts browser pointer client coordinates (clientX, clientY) into
 * the internal canvas coordinate space (960x580), accounting for CSS scaling
 * and container bounding box offsets.
 *
 * Returns null if the pointer event occurred outside the canvas DOM element or
 * if bounding box dimensions are non-positive.
 */
export function convertPointerToCanvasCoordinates(
  clientX: number,
  clientY: number,
  canvasBoundingRect: DOMRectLike,
  canvasWidth: number = RADAR_CANVAS_WIDTH,
  canvasHeight: number = RADAR_CANVAS_HEIGHT
): { x: number; y: number } | null {
  if (canvasBoundingRect.width <= 0 || canvasBoundingRect.height <= 0) {
    return null;
  }

  const domX = clientX - canvasBoundingRect.left;
  const domY = clientY - canvasBoundingRect.top;

  // Verify pointer is within the canvas DOM element
  if (
    domX < 0 ||
    domX > canvasBoundingRect.width ||
    domY < 0 ||
    domY > canvasBoundingRect.height
  ) {
    return null;
  }

  const scaleX = canvasWidth / canvasBoundingRect.width;
  const scaleY = canvasHeight / canvasBoundingRect.height;

  return {
    x: domX * scaleX,
    y: domY * scaleY
  };
}

/**
 * Performs Euclidean distance hit-testing against all 21 perimeter gates.
 * Supports clicking both the stanchion dot and the outward gate label.
 *
 * 1. Computes distance to every gate stanchion and outward label.
 * 2. Finds the gate with the minimum distance.
 * 3. Returns the gate only if the minimum distance <= tolerancePx.
 * 4. Returns null if click occurred in empty pitch or exceeds tolerance.
 */
export function findNearestRadarGate(
  canvasX: number,
  canvasY: number,
  tolerancePx: number = DEFAULT_GATE_CLICK_TOLERANCE_PX,
  centerX: number = RADAR_CENTER_X,
  centerY: number = RADAR_CENTER_Y,
  outerRadius: number = RADAR_OUTER_RADIUS
): GateHitResult | null {
  // Reject center field, far outer corners, or off-perimeter clicks immediately
  const distFromCenter = Math.hypot(canvasX - centerX, canvasY - centerY);
  if (distFromCenter < outerRadius - 45 || distFromCenter > outerRadius + 55) {
    return null;
  }

  const gateCoords = computeRadarGateCoordinates(centerX, centerY, outerRadius);

  let nearestGate: RadarGateCoordinate | null = null;
  let minDistance = Infinity;

  for (const gate of gateCoords) {
    const rad = (gate.angleDeg * Math.PI) / 180;
    // Distance to stanchion dot
    const dStanchion = Math.hypot(canvasX - gate.x, canvasY - gate.y);
    // Distance to gate label
    const lx = centerX + Math.cos(rad) * (outerRadius + 22);
    const ly = centerY + Math.sin(rad) * (outerRadius + 22);
    const dLabel = Math.hypot(canvasX - lx, canvasY - ly);

    const effectiveDist = Math.min(dStanchion, dLabel);
    if (effectiveDist < minDistance) {
      minDistance = effectiveDist;
      nearestGate = gate;
    }
  }

  if (nearestGate && minDistance <= tolerancePx) {
    return {
      gate: nearestGate,
      distancePx: Math.round(minDistance * 100) / 100
    };
  }

  return null;
}
