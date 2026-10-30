import { AgentData } from '../types/simulation';

/**
 * 2D Spatial Hash Grid
 * Cell Size = 32px
 * Optimizes pairwise agent neighbor lookups from O(N²) to O(N).
 */
export class SpatialGrid {
  public cellSize: number;
  private grid: Map<string, AgentData[]> = new Map();
  private neighborBuffer: AgentData[] = [];

  constructor(cellSize: number = 32) {
    this.cellSize = cellSize;
  }

  private getKey(cx: number, cy: number): string {
    return `${cx}:${cy}`;
  }

  /**
   * Clears all agent bins
   */
  public clear(): void {
    this.grid.clear();
  }

  /**
   * Inserts an agent into the spatial grid hash bin
   */
  public insert(agent: AgentData): void {
    if (agent.active === false) return;

    const cx = Math.floor(agent.x / this.cellSize);
    const cy = Math.floor(agent.y / this.cellSize);
    const key = this.getKey(cx, cy);

    let cell = this.grid.get(key);
    if (!cell) {
      cell = [];
      this.grid.set(key, cell);
    }
    cell.push(agent);
  }

  /**
   * Retrieves all neighboring agents within the specified pixel radius
   */
  public getNeighbors(agent: AgentData, radius: number): AgentData[] {
    this.neighborBuffer.length = 0;
    const rSq = radius * radius;

    const minCx = Math.floor((agent.x - radius) / this.cellSize);
    const maxCx = Math.floor((agent.x + radius) / this.cellSize);
    const minCy = Math.floor((agent.y - radius) / this.cellSize);
    const maxCy = Math.floor((agent.y + radius) / this.cellSize);

    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const key = this.getKey(cx, cy);
        const cell = this.grid.get(key);
        if (!cell) continue;

        const len = cell.length;
        for (let i = 0; i < len; i++) {
          const other = cell[i];
          if (other.id === agent.id) continue;

          const dx = other.x - agent.x;
          const dy = other.y - agent.y;
          const distSq = dx * dx + dy * dy;

          if (distSq <= rSq) {
            this.neighborBuffer.push(other);
          }
        }
      }
    }

    return this.neighborBuffer;
  }

  /**
   * Estimates Fruin crowd density in pedestrians / m²
   */
  public estimateDensity(agent: AgentData, radiusMeters: number = 1.25, pixelsPerMeter: number = 20): number {
    const radiusPx = radiusMeters * pixelsPerMeter;
    const neighbors = this.getNeighbors(agent, radiusPx);
    const count = neighbors.length + 1; // Include self
    const areaM2 = Math.PI * radiusMeters * radiusMeters;
    return count / areaM2;
  }
}
