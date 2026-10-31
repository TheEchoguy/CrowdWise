/**
 * Coordinate Transformations & SVG Path Generators
 * M. Chinnaswamy Stadium, Bengaluru
 */

import { CHINNASWAMY_METADATA, SECTION_VIEWPORTS } from '../data/stadiumMetadata';
import { StadiumSection } from '../types/stadium';
import { CHINNASWAMY_OUTER_GATES } from '../data/outerGates';
import { CHINNASWAMY_INNER_GATES } from '../data/innerGates';

/**
 * Converts polar angle in degrees and radius into Cartesian SVG coordinates
 * centered at stadium pitch center.
 */
export function polarToCartesian(
  angleDeg: number,
  radius: number,
  center = CHINNASWAMY_METADATA.center
): { x: number; y: number } {
  const rad = ((angleDeg - 0) * Math.PI) / 180;
  return {
    x: center.x + radius * Math.cos(rad),
    y: center.y + radius * Math.sin(rad)
  };
}

/**
 * Generates an SVG path data string (`d`) for an annular sector / curved stadium stand block.
 */
export function createAnnularSectorPath(
  startAngleDeg: number,
  endAngleDeg: number,
  innerRadius: number,
  outerRadius: number,
  center = CHINNASWAMY_METADATA.center
): string {
  const p1 = polarToCartesian(startAngleDeg, outerRadius, center);
  const p2 = polarToCartesian(endAngleDeg, outerRadius, center);
  const p3 = polarToCartesian(endAngleDeg, innerRadius, center);
  const p4 = polarToCartesian(startAngleDeg, innerRadius, center);

  const angleDiff = (endAngleDeg - startAngleDeg + 360) % 360;
  const largeArcFlag = angleDiff > 180 ? 1 : 0;

  return [
    `M ${p1.x.toFixed(2)},${p1.y.toFixed(2)}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`,
    `L ${p3.x.toFixed(2)},${p3.y.toFixed(2)}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${p4.x.toFixed(2)},${p4.y.toFixed(2)}`,
    'Z'
  ].join(' ');
}

/**
 * Returns the target SVG viewBox rectangle for a given stadium section.
 */
export function getSectionViewBox(section: StadiumSection): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  return SECTION_VIEWPORTS[section] || SECTION_VIEWPORTS.ALL;
}

/**
 * Returns an authentic zoomed viewBox focused on an individual outer gate's
 * pedestrian corridor, holding pen, and turnstile entrance.
 */
export function getGateViewBox(outerGateId: string): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const og = CHINNASWAMY_OUTER_GATES.find((g) => g.id === outerGateId) || CHINNASWAMY_OUTER_GATES[0];
  const connectedInnerIds = og.connectedInnerGates;
  const connectedInners = CHINNASWAMY_INNER_GATES.filter((ig) => connectedInnerIds.includes(ig.id));

  let minX = og.x;
  let maxX = og.x;
  let minY = og.y;
  let maxY = og.y;

  connectedInners.forEach((ig) => {
    minX = Math.min(minX, ig.x);
    maxX = Math.max(maxX, ig.x);
    minY = Math.min(minY, ig.y);
    maxY = Math.max(maxY, ig.y);
  });

  const padX = 140;
  const padY = 110;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const w = Math.max(480, (maxX - minX) + padX * 2);
  const h = Math.max(360, (maxY - minY) + padY * 2);

  return {
    x: Math.max(0, cx - w / 2),
    y: Math.max(0, cy - h / 2),
    width: w,
    height: h
  };
}

