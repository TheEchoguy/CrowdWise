/**
 * CROWDWISE Predictive Crowd Digital Twin & Safety Lab
 * Seeded PRNG Utility (Mulberry32)
 *
 * Provides a high-speed, 32-bit pseudo-random number generator
 * ensuring 100% deterministic reproducibility for paired simulation runs.
 * Includes uniform float ranges, integer sampling, and Gaussian sampling via Box-Muller.
 */

export class SeededPRNG {
  private state: number;
  private hasSpareGaussian: boolean = false;
  private spareGaussian: number = 0;

  /**
   * Initializes the PRNG with a 32-bit integer seed.
   * Handles zero, negative, floating-point, or NaN seeds safely.
   */
  constructor(seed: number = 1337) {
    if (typeof seed !== 'number' || isNaN(seed) || !isFinite(seed)) {
      this.state = 1337;
    } else {
      const sanitized = Math.floor(Math.abs(seed)) >>> 0;
      // Guarantee non-zero internal state for robust generator initialization
      this.state = sanitized === 0 ? 0x6D2B79F5 : sanitized;
    }
  }

  /**
   * Returns a deterministic pseudo-random float in the half-open interval [0, 1).
   * Implements the 32-bit Mulberry32 algorithm.
   */
  public next(): number {
    let t = (this.state += 0x6D2B79F5) >>> 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Generates a deterministic float in the interval [min, max).
   * Automatically normalizes inverted bounds (min > max).
   */
  public nextRange(min: number, max: number): number {
    if (min === max) return min;
    const lower = Math.min(min, max);
    const upper = Math.max(min, max);
    return lower + this.next() * (upper - lower);
  }

  /**
   * Generates a deterministic integer in the inclusive interval [min, max].
   */
  public nextInt(min: number, max: number): number {
    if (min === max) return Math.floor(min);
    const lower = Math.floor(Math.min(min, max));
    const upper = Math.floor(Math.max(min, max));
    return Math.floor(lower + this.next() * (upper - lower + 1));
  }

  /**
   * Generates a normally distributed random variable N(mean, stdDev^2)
   * using the polar Box-Muller transform.
   *
   * @param mean Center of the normal distribution
   * @param stdDev Standard deviation (must be non-negative)
   */
  public nextGaussian(mean: number = 0, stdDev: number = 1): number {
    if (stdDev <= 0) return mean;

    // Use cached spare if available from previous pair
    if (this.hasSpareGaussian) {
      this.hasSpareGaussian = false;
      return mean + this.spareGaussian * stdDev;
    }

    // Box-Muller transform: clamp u1 to prevent log(0)
    const u1 = Math.max(1e-12, this.next());
    const u2 = this.next();

    const radius = Math.sqrt(-2.0 * Math.log(u1));
    const theta = 2.0 * Math.PI * u2;

    const z0 = radius * Math.cos(theta);
    const z1 = radius * Math.sin(theta);

    this.spareGaussian = z1;
    this.hasSpareGaussian = true;

    return mean + z0 * stdDev;
  }

  /**
   * Returns current internal state seed for debugging or serialization.
   */
  public getState(): number {
    return this.state;
  }

  /**
   * Resets PRNG to a specified seed.
   */
  public reset(seed: number = 1337): void {
    const sanitized = Math.floor(Math.abs(seed)) >>> 0;
    this.state = sanitized === 0 ? 0x6D2B79F5 : sanitized;
    this.hasSpareGaussian = false;
    this.spareGaussian = 0;
  }
}

