import { Agent } from './types';

/**
 * High-performance 2D Spatial Hash Grid
 * Reduces pairwise agent neighbor search from O(N²) to O(N).
 * Specifically engineered to handle 2,000+ agents at 60 FPS with minimal GC pressure.
 */
export class SpatialGrid {
  public cellSize: number;
  public cols: number;
  public rows: number;
  public width: number;
  public height: number;

  // Pre-allocated cell buckets
  private grid: Agent[][];
  private queryBuffer: Agent[] = [];

  constructor(width: number, height: number, cellSize: number = 32) {
    this.cellSize = cellSize;
    this.width = Math.max(width, cellSize);
    this.height = Math.max(height, cellSize);
    this.cols = Math.ceil(this.width / cellSize);
    this.rows = Math.ceil(this.height / cellSize);

    const totalCells = this.cols * this.rows;
    this.grid = new Array(totalCells);
    for (let i = 0; i < totalCells; i++) {
      this.grid[i] = [];
    }
  }

  /**
   * Resize the grid dimensions if canvas bounds change
   */
  public resize(width: number, height: number, cellSize: number = 32): void {
    this.cellSize = cellSize;
    this.width = Math.max(width, cellSize);
    this.height = Math.max(height, cellSize);
    this.cols = Math.ceil(this.width / cellSize);
    this.rows = Math.ceil(this.height / cellSize);

    const totalCells = this.cols * this.rows;
    this.grid = new Array(totalCells);
    for (let i = 0; i < totalCells; i++) {
      this.grid[i] = [];
    }
  }

  /**
   * Clear all cell buckets without re-allocating array shells
   */
  public clear(): void {
    const totalCells = this.cols * this.rows;
    for (let i = 0; i < totalCells; i++) {
      this.grid[i].length = 0;
    }
  }

  /**
   * Insert an agent into its spatial hash bucket
   */
  public insert(agent: Agent): void {
    if (!agent.active) return;

    const cx = Math.floor(agent.x / this.cellSize);
    const cy = Math.floor(agent.y / this.cellSize);

    if (cx >= 0 && cx < this.cols && cy >= 0 && cy < this.rows) {
      const idx = cy * this.cols + cx;
      this.grid[idx].push(agent);
    }
  }

  /**
   * Rebuild the entire spatial grid with active agents
   */
  public populate(agents: Agent[]): void {
    this.clear();
    const len = agents.length;
    for (let i = 0; i < len; i++) {
      const agent = agents[i];
      if (agent.active) {
        this.insert(agent);
      }
    }
  }

  /**
   * Fast inline iteration over all neighbors within radius
   * Zero heap allocation per call.
   */
  public forEachNeighbor(
    agent: Agent,
    radius: number,
    callback: (neighbor: Agent, distSq: number, dist: number) => void
  ): void {
    const rSq = radius * radius;
    const minCx = Math.max(0, Math.floor((agent.x - radius) / this.cellSize));
    const maxCx = Math.min(this.cols - 1, Math.floor((agent.x + radius) / this.cellSize));
    const minCy = Math.max(0, Math.floor((agent.y - radius) / this.cellSize));
    const maxCy = Math.min(this.rows - 1, Math.floor((agent.y + radius) / this.cellSize));

    for (let cy = minCy; cy <= maxCy; cy++) {
      const rowOffset = cy * this.cols;
      for (let cx = minCx; cx <= maxCx; cx++) {
        const cell = this.grid[rowOffset + cx];
        const cellLen = cell.length;
        for (let i = 0; i < cellLen; i++) {
          const other = cell[i];
          if (other.id === agent.id) continue;

          const dx = other.x - agent.x;
          const dy = other.y - agent.y;
          const distSq = dx * dx + dy * dy;

          if (distSq <= rSq && distSq > 0.00001) {
            callback(other, distSq, Math.sqrt(distSq));
          }
        }
      }
    }
  }

  /**
   * Query all agents within a circular radius and return a reusable buffer
   */
  public queryRadius(x: number, y: number, radius: number): Agent[] {
    this.queryBuffer.length = 0;
    const rSq = radius * radius;
    const minCx = Math.max(0, Math.floor((x - radius) / this.cellSize));
    const maxCx = Math.min(this.cols - 1, Math.floor((x + radius) / this.cellSize));
    const minCy = Math.max(0, Math.floor((y - radius) / this.cellSize));
    const maxCy = Math.min(this.rows - 1, Math.floor((y + radius) / this.cellSize));

    for (let cy = minCy; cy <= maxCy; cy++) {
      const rowOffset = cy * this.cols;
      for (let cx = minCx; cx <= maxCx; cx++) {
        const cell = this.grid[rowOffset + cx];
        const cellLen = cell.length;
        for (let i = 0; i < cellLen; i++) {
          const agent = cell[i];
          const dx = agent.x - x;
          const dy = agent.y - y;
          if (dx * dx + dy * dy <= rSq) {
            this.queryBuffer.push(agent);
          }
        }
      }
    }

    return this.queryBuffer;
  }

  /**
   * Estimate local pedestrian density in agents / m² around an agent
   * Uses a standard safety observation circle (radius ~1.25m)
   */
  public estimateDensity(agent: Agent, pixelsPerMeter: number): number {
    const sampleRadiusMeters = 1.25; // standard Fruin observation disc
    const sampleRadiusPx = sampleRadiusMeters * pixelsPerMeter;
    const discAreaM2 = Math.PI * sampleRadiusMeters * sampleRadiusMeters;

    let count = 1; // Include self

    this.forEachNeighbor(agent, sampleRadiusPx, () => {
      count++;
    });

    return count / discAreaM2;
  }
}
