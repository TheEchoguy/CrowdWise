import { CrowdAgent, Vector2D } from '../types';

export class SpatialHashGrid {
  private cellSize: number;
  private grid: Map<string, CrowdAgent[]>;

  constructor(cellSize: number = 3.0) {
    this.cellSize = cellSize;
    this.grid = new Map();
  }

  private key(cellX: number, cellY: number): string {
    return `${cellX}:${cellY}`;
  }

  public clear(): void {
    this.grid.clear();
  }

  public insert(agent: CrowdAgent): void {
    const cx = Math.floor(agent.x / this.cellSize);
    const cy = Math.floor(agent.y / this.cellSize);
    const k = this.key(cx, cy);

    let cell = this.grid.get(k);
    if (!cell) {
      cell = [];
      this.grid.set(k, cell);
    }
    cell.push(agent);
  }

  public query(pos: Vector2D, radius: number): CrowdAgent[] {
    const results: CrowdAgent[] = [];
    const minCx = Math.floor((pos.x - radius) / this.cellSize);
    const maxCx = Math.floor((pos.x + radius) / this.cellSize);
    const minCy = Math.floor((pos.y - radius) / this.cellSize);
    const maxCy = Math.floor((pos.y + radius) / this.cellSize);
    const radSq = radius * radius;

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const cell = this.grid.get(this.key(cx, cy));
        if (cell) {
          for (let i = 0; i < cell.length; i++) {
            const agent = cell[i];
            const dx = agent.x - pos.x;
            const dy = agent.y - pos.y;
            if (dx * dx + dy * dy <= radSq) {
              results.push(agent);
            }
          }
        }
      }
    }
    return results;
  }
}

