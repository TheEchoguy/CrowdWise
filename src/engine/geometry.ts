import { Vector2D } from '../types';

export function distance(a: Vector2D, b: Vector2D): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function distanceSq(a: Vector2D, b: Vector2D): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function add(a: Vector2D, b: Vector2D): Vector2D {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function sub(a: Vector2D, b: Vector2D): Vector2D {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function scale(v: Vector2D, s: number): Vector2D {
  return { x: v.x * s, y: v.y * s };
}

export function normalize(v: Vector2D): Vector2D {
  const len = Math.sqrt(v.x * v.x + v.y * v.y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

export function length(v: Vector2D): number {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

export function angle(from: Vector2D, to: Vector2D): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

export function pointInPolygon(pt: Vector2D, polygon: Vector2D[]): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x,
      yi = polygon[i].y;
    const xj = polygon[j].x,
      yj = polygon[j].y;

    const intersect =
      yi > pt.y !== yj > pt.y &&
      pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function polygonArea(polygon: Vector2D[]): number {
  let area = 0;
  const n = polygon.length;
  if (n < 3) return 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += polygon[i].x * polygon[j].y;
    area -= polygon[j].x * polygon[i].y;
  }
  return Math.abs(area) / 2;
}

export function closestPointOnSegment(p: Vector2D, a: Vector2D, b: Vector2D): Vector2D {
  const ab = sub(b, a);
  const abLenSq = ab.x * ab.x + ab.y * ab.y;
  if (abLenSq === 0) return a;
  const ap = sub(p, a);
  let t = (ap.x * ab.x + ap.y * ab.y) / abLenSq;
  t = Math.max(0, Math.min(1, t));
  return { x: a.x + t * ab.x, y: a.y + t * ab.y };
}

export function distanceToSegment(p: Vector2D, a: Vector2D, b: Vector2D): number {
  const closest = closestPointOnSegment(p, a, b);
  return distance(p, closest);
}

export function polygonCentroid(polygon: Vector2D[]): Vector2D {
  let cx = 0;
  let cy = 0;
  for (const p of polygon) {
    cx += p.x;
    cy += p.y;
  }
  return { x: cx / polygon.length, y: cy / polygon.length };
}

