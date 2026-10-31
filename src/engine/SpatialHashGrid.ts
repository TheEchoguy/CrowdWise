/**
 * Uniform Spatial Hash Grid with Counting-Sort Rebuild
 * SI Units: Metres
 * Zero memory allocation per step. O(N) linear time neighbor querying.
 */

export class SpatialHashGrid {
  public readonly cellSize: number;
  public readonly originX: number;
  public readonly originY: number;
  public readonly cols: number;
  public readonly rows: number;
  public readonly totalCells: number;

  private readonly cellCounts: Int32Array;
  private readonly cellOffsets: Int32Array;
  private readonly cellInsertPtr: Int32Array;
  private readonly agentIndices: Int32Array;
  private readonly maxAgents: number;

  constructor(
    originX: number,
    originY: number,
    widthMeters: number,
    heightMeters: number,
    cellSize: number = 1.5,
    maxAgents: number = 20000
  ) {
    this.originX = originX;
    this.originY = originY;
    this.cellSize = cellSize;
    this.cols = Math.max(1, Math.ceil(widthMeters / cellSize));
    this.rows = Math.max(1, Math.ceil(heightMeters / cellSize));
    this.totalCells = this.cols * this.rows;
    this.maxAgents = maxAgents;

    this.cellCounts = new Int32Array(this.totalCells);
    this.cellOffsets = new Int32Array(this.totalCells + 1);
    this.cellInsertPtr = new Int32Array(this.totalCells);
    this.agentIndices = new Int32Array(maxAgents);
  }

  /**
   * Rebuilds the spatial hash grid using counting sort.
   * O(N + totalCells) execution with zero garbage collection.
   */
  public rebuild(
    count: number,
    posX: Float32Array,
    posY: Float32Array,
    active: Uint8Array
  ): void {
    const totalCells = this.totalCells;
    const cols = this.cols;
    const rows = this.rows;
    const invCell = 1.0 / this.cellSize;
    const ox = this.originX;
    const oy = this.originY;

    // 1. Clear counts
    this.cellCounts.fill(0);

    // 2. Count agents per cell
    for (let i = 0; i < count; i++) {
      if (active[i] === 0) continue;
      const cx = Math.floor((posX[i] - ox) * invCell);
      const cy = Math.floor((posY[i] - oy) * invCell);
      if (cx >= 0 && cx < cols && cy >= 0 && cy < rows) {
        const cell = cy * cols + cx;
        this.cellCounts[cell]++;
      }
    }

    // 3. Prefix sum to calculate cell offsets
    let sum = 0;
    for (let c = 0; c < totalCells; c++) {
      this.cellOffsets[c] = sum;
      this.cellInsertPtr[c] = sum;
      sum += this.cellCounts[c];
    }
    this.cellOffsets[totalCells] = sum;

    // 4. Scatter agent indices into bucket array
    for (let i = 0; i < count; i++) {
      if (active[i] === 0) continue;
      const cx = Math.floor((posX[i] - ox) * invCell);
      const cy = Math.floor((posY[i] - oy) * invCell);
      if (cx >= 0 && cx < cols && cy >= 0 && cy < rows) {
        const cell = cy * cols + cx;
        const dest = this.cellInsertPtr[cell]++;
        if (dest < this.maxAgents) {
          this.agentIndices[dest] = i;
        }
      }
    }
  }

  /**
   * Queries neighboring agent indices within a 3x3 cell neighborhood around (x, y).
   * Calls the provided consumer callback for each candidate neighbor.
   */
  public query(
    x: number,
    y: number,
    consumer: (neighborIdx: number) => void
  ): void {
    const invCell = 1.0 / this.cellSize;
    const cx = Math.floor((x - this.originX) * invCell);
    const cy = Math.floor((y - this.originY) * invCell);
    const cols = this.cols;
    const rows = this.rows;

    const minX = Math.max(0, cx - 1);
    const maxX = Math.min(cols - 1, cx + 1);
    const minY = Math.max(0, cy - 1);
    const maxY = Math.min(rows - 1, cy + 1);

    for (let ny = minY; ny <= maxY; ny++) {
      const rowOffset = ny * cols;
      for (let nx = minX; nx <= maxX; nx++) {
        const cell = rowOffset + nx;
        const start = this.cellOffsets[cell];
        const end = this.cellOffsets[cell + 1];
        for (let idx = start; idx < end; idx++) {
          consumer(this.agentIndices[idx]);
        }
      }
    }
  }
}

