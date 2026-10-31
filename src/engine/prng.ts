/**
 * Seeded Deterministic Pseudo-Random Number Generator (PRNG)
 * Uses SplitMix32 algorithm (Steele et al., 2014) - deterministic across browsers and platforms.
 * Provides uniform float [0, 1), normal Gaussian distribution N(mean, stdDev), and uniform integers.
 */

export class SeededPRNG {
  private state: number;

  constructor(seed: number = 42) {
    this.state = (seed | 0) || 1;
  }

  /**
   * Generates a 32-bit pseudo-random unsigned integer
   */
  public nextInt32(): number {
    this.state = (this.state + 0x9e3779b9) | 0;
    let z = this.state;
    z = Math.imul(z ^ (z >>> 16), 0x21f0aaad);
    z = Math.imul(z ^ (z >>> 15), 0x735a2d97);
    return (z ^ (z >>> 15)) >>> 0;
  }

  /**
   * Generates a float in [0, 1)
   */
  public nextFloat(): number {
    return this.nextInt32() / 4294967296.0;
  }

  /**
   * Generates an integer in [min, max] inclusive
   */
  public nextRangeInt(min: number, max: number): number {
    return min + Math.floor(this.nextFloat() * (max - min + 1));
  }

  /**
   * Generates a float in [min, max)
   */
  public nextRangeFloat(min: number, max: number): number {
    return min + this.nextFloat() * (max - min);
  }

  /**
   * Box-Muller transform to sample from Gaussian distribution N(mean, stdDev)
   */
  public nextGaussian(mean: number = 0.0, stdDev: number = 1.0): number {
    let u1 = this.nextFloat();
    let u2 = this.nextFloat();
    // Avoid log(0)
    while (u1 <= 1e-15) {
      u1 = this.nextFloat();
    }
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return mean + z0 * stdDev;
  }

  /**
   * Get internal state for look-ahead cloning / snapshotting
   */
  public getState(): number {
    return this.state;
  }

  /**
   * Restore internal state
   */
  public setState(state: number): void {
    this.state = state;
  }
}

