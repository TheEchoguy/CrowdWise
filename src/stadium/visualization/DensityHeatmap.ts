/**
 * CROWDWISE — Phase 2.1: Spatial Crowd Density Heatmap Engine
 * M. Chinnaswamy Stadium, Bengaluru
 *
 * Microscopic-to-Macroscopic Density Rasterization:
 * - Continuous Gaussian/Kernel density smoothing over 1600 x 1200 coordinate space
 * - Spatial grid aggregation with 20px = 1m calibration (1 m² per cell)
 * - Calibrated Fruin LOS Color Bands:
 *   GREEN:  < 1.5 p/m² (Free Flow)
 *   YELLOW: 1.5 - 2.2 p/m² (Laminar / Warning)
 *   ORANGE: 2.2 - 3.0 p/m² (Dense Queue / Constrained)
 *   RED:    > 3.0 p/m² (Severe Compression / Hazard)
 */

export interface DensityHotspot {
  x: number;
  y: number;
  peakDensity: number;
  radius: number;
  level: 'MODERATE' | 'HIGH' | 'CRITICAL';
}

export interface FlowVector {
  x: number;
  y: number;
  vx: number;
  vy: number;
  magnitude: number;
  angleRad: number;
}

export class StadiumDensityHeatmap {
  public static readonly WORLD_WIDTH = 1600;
  public static readonly WORLD_HEIGHT = 1200;
  public static readonly CELL_SIZE = 20; // 20px = 1m (1 m² area per cell)

  private cols: number;
  private rows: number;
  private rawCounts: Float32Array;
  private smoothedDensity: Float32Array;
  private flowVx: Float32Array;
  private flowVy: Float32Array;
  private flowCounts: Uint16Array;

  // Gaussian Kernel (5x5 matrix, sigma = 1.2)
  private readonly kernelRadius = 2;
  private kernelWeights: number[][] = [];

  constructor() {
    this.cols = Math.ceil(StadiumDensityHeatmap.WORLD_WIDTH / StadiumDensityHeatmap.CELL_SIZE); // 80 cols
    this.rows = Math.ceil(StadiumDensityHeatmap.WORLD_HEIGHT / StadiumDensityHeatmap.CELL_SIZE); // 60 rows
    const totalCells = this.cols * this.rows;

    this.rawCounts = new Float32Array(totalCells);
    this.smoothedDensity = new Float32Array(totalCells);
    this.flowVx = new Float32Array(totalCells);
    this.flowVy = new Float32Array(totalCells);
    this.flowCounts = new Uint16Array(totalCells);

    this.initKernel();
  }

  private initKernel(): void {
    const sigma = 1.25;
    let sum = 0;
    const r = this.kernelRadius;
    this.kernelWeights = [];

    for (let dy = -r; dy <= r; dy++) {
      const row: number[] = [];
      for (let dx = -r; dx <= r; dx++) {
        const w = Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
        row.push(w);
        sum += w;
      }
      this.kernelWeights.push(row);
    }

    // Normalize weights
    for (let dy = 0; dy <= 2 * r; dy++) {
      for (let dx = 0; dx <= 2 * r; dx++) {
        this.kernelWeights[dy][dx] /= sum;
      }
    }
  }

  /**
   * Resets all spatial aggregation grids.
   */
  public clear(): void {
    this.rawCounts.fill(0);
    this.smoothedDensity.fill(0);
    this.flowVx.fill(0);
    this.flowVy.fill(0);
    this.flowCounts.fill(0);
  }

  /**
   * Aggregates agents into the 1m² spatial grid and performs kernel smoothing.
   */
  public update(agents: { x: number; y: number; vx?: number; vy?: number; active?: boolean }[]): void {
    this.clear();
    const cellSize = StadiumDensityHeatmap.CELL_SIZE;
    const cols = this.cols;
    const rows = this.rows;

    // 1. Bin agents into cells
    for (let i = 0; i < agents.length; i++) {
      const ag = agents[i];
      if (ag.active === false) continue;

      const cx = Math.floor(ag.x / cellSize);
      const cy = Math.floor(ag.y / cellSize);

      if (cx >= 0 && cx < cols && cy >= 0 && cy < rows) {
        const idx = cy * cols + cx;
        this.rawCounts[idx] += 1.0;

        if (ag.vx !== undefined && ag.vy !== undefined) {
          this.flowVx[idx] += ag.vx;
          this.flowVy[idx] += ag.vy;
          this.flowCounts[idx] += 1;
        }
      }
    }

    // 2. Gaussian Kernel Density Smoothing
    const r = this.kernelRadius;
    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        const centerIdx = cy * cols + cx;
        if (this.rawCounts[centerIdx] <= 0) continue;

        const val = this.rawCounts[centerIdx];

        for (let dy = -r; dy <= r; dy++) {
          const ny = cy + dy;
          if (ny < 0 || ny >= rows) continue;

          for (let dx = -r; dx <= r; dx++) {
            const nx = cx + dx;
            if (nx < 0 || nx >= cols) continue;

            const nIdx = ny * cols + nx;
            const weight = this.kernelWeights[dy + r][dx + r];
            this.smoothedDensity[nIdx] += val * weight;
          }
        }
      }
    }
  }

  /**
   * Retrieves peak density observed in the smoothed field.
   */
  public getPeakDensity(): number {
    let max = 0;
    for (let i = 0; i < this.smoothedDensity.length; i++) {
      if (this.smoothedDensity[i] > max) max = this.smoothedDensity[i];
    }
    return Math.round(max * 10) / 10;
  }

  /**
   * Samples smoothed density at world (x, y) coordinates.
   */
  public getDensityAt(x: number, y: number): number {
    const cx = Math.floor(x / StadiumDensityHeatmap.CELL_SIZE);
    const cy = Math.floor(y / StadiumDensityHeatmap.CELL_SIZE);
    if (cx < 0 || cx >= this.cols || cy < 0 || cy >= this.rows) return 0;
    return this.smoothedDensity[cy * this.cols + cx];
  }

  /**
   * Extracts congestion hotspots where smoothed density exceeds 2.2 p/m².
   */
  public getHotspots(): DensityHotspot[] {
    const hotspots: DensityHotspot[] = [];
    const cellSize = StadiumDensityHeatmap.CELL_SIZE;

    for (let cy = 0; cy < this.rows; cy++) {
      for (let cx = 0; cx < this.cols; cx++) {
        const idx = cy * this.cols + cx;
        const d = this.smoothedDensity[idx];

        if (d >= 2.2) {
          const hx = cx * cellSize + cellSize / 2;
          const hy = cy * cellSize + cellSize / 2;

          const isNearby = hotspots.some((h) => Math.hypot(h.x - hx, h.y - hy) < 35);
          if (!isNearby) {
            hotspots.push({
              x: hx,
              y: hy,
              peakDensity: Math.round(d * 10) / 10,
              radius: Math.min(32, 16 + d * 4),
              level: d >= 3.5 ? 'CRITICAL' : d >= 3.0 ? 'HIGH' : 'MODERATE'
            });
          }
        }
      }
    }

    return hotspots.slice(0, 8); // Top 8 hotspots
  }

  /**
   * Extracts coarse directional flow vectors for visualizing crowd velocity streams.
   */
  public getFlowVectors(step = 3): FlowVector[] {
    const vectors: FlowVector[] = [];
    const cellSize = StadiumDensityHeatmap.CELL_SIZE;

    for (let cy = 1; cy < this.rows; cy += step) {
      for (let cx = 1; cx < this.cols; cx += step) {
        const idx = cy * this.cols + cx;
        const count = this.flowCounts[idx];
        const density = this.smoothedDensity[idx];

        if (count >= 2 && density >= 0.8) {
          const vx = this.flowVx[idx] / count;
          const vy = this.flowVy[idx] / count;
          const mag = Math.hypot(vx, vy);

          if (mag > 1.5) {
            vectors.push({
              x: cx * cellSize + cellSize / 2,
              y: cy * cellSize + cellSize / 2,
              vx,
              vy,
              magnitude: mag,
              angleRad: Math.atan2(vy, vx)
            });
          }
        }
      }
    }

    return vectors;
  }

  /**
   * Renders the continuous density field to an HTML5 Canvas.
   */
  public renderToCanvas(
    ctx: CanvasRenderingContext2D,
    width = StadiumDensityHeatmap.WORLD_WIDTH,
    height = StadiumDensityHeatmap.WORLD_HEIGHT,
    alphaMultiplier = 0.85
  ): void {
    ctx.clearRect(0, 0, width, height);

    const scaleX = width / StadiumDensityHeatmap.WORLD_WIDTH;
    const scaleY = height / StadiumDensityHeatmap.WORLD_HEIGHT;
    const cellW = StadiumDensityHeatmap.CELL_SIZE * scaleX;
    const cellH = StadiumDensityHeatmap.CELL_SIZE * scaleY;

    // Render cells with color interpolation based on threshold bands
    for (let cy = 0; cy < this.rows; cy++) {
      for (let cx = 0; cx < this.cols; cx++) {
        const idx = cy * this.cols + cx;
        const rho = this.smoothedDensity[idx];

        if (rho < 0.2) continue; // Skip negligible density

        const x = cx * cellW;
        const y = cy * cellH;

        // Color coding by Fruin LOS thresholds
        if (rho < 1.5) {
          // GREEN: Free Flow (< 1.5 p/m²)
          const norm = Math.min(1.0, rho / 1.5);
          ctx.fillStyle = `rgba(16, 185, 129, ${(0.25 + norm * 0.35) * alphaMultiplier})`;
        } else if (rho < 2.2) {
          // YELLOW: Moderate Laminar Flow (1.5 - 2.2 p/m²)
          const norm = (rho - 1.5) / 0.7;
          ctx.fillStyle = `rgba(234, 179, 8, ${(0.55 + norm * 0.25) * alphaMultiplier})`;
        } else if (rho < 3.0) {
          // ORANGE: Dense Queue / Compression (2.2 - 3.0 p/m²)
          const norm = (rho - 2.2) / 0.8;
          ctx.fillStyle = `rgba(249, 115, 22, ${(0.75 + norm * 0.2) * alphaMultiplier})`;
        } else {
          // RED / CRITICAL: Severe Crush Hazard (>= 3.0 p/m²)
          const norm = Math.min(1.0, (rho - 3.0) / 2.0);
          ctx.fillStyle = `rgba(239, 68, 68, ${(0.85 + norm * 0.15) * alphaMultiplier})`;
        }

        ctx.fillRect(x - 2, y - 2, cellW + 4, cellH + 4);
      }
    }
  }
}
