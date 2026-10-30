/**
 * CROWDWISE Predictive Crowd Digital Twin & Safety Lab
 * Arrival Distribution Engine
 *
 * Implements Uniform, Truncated Gaussian Peak, and Burst arrival rate models.
 * Guarantees mathematical normalization so that integrated demand equals
 * total population, and generates strictly sorted, bounded spawn timestamps.
 */

import { ArrivalPatternType } from '../types/ScenarioTypes';
import { SeededPRNG } from '../utils/seededRandom';

export interface ArrivalScheduleConfig {
  readonly pattern: ArrivalPatternType;
  readonly totalAgents: number;            // Exact discrete agents to generate (e.g. 1,000 to 2,500)
  readonly durationMinutes: number;        // Total arrival window in minutes (e.g. 60)
  readonly gaussianPeakMin?: number;       // Peak arrival time for Gaussian (default: duration / 2)
  readonly gaussianStdDevMin?: number;     // Standard deviation in minutes
  readonly burstIntervals?: readonly { readonly startMin: number; readonly endMin: number; readonly weight: number }[];
  readonly prng: SeededPRNG;
}

export interface ArrivalRateProfile {
  readonly pattern: ArrivalPatternType;
  readonly peakArrivalRatePerMin: number;  // Maximum theoretical rate in entities/min
  readonly averageArrivalRatePerMin: number; // Mean rate across total duration
  readonly getRateAtMinute: (minute: number) => number;
}

export class ArrivalDistributionEngine {
  /**
   * Evaluates the standard Gauss error function erf(x)
   * using the Chebyshev approximation (maximum error < 1.5e-7).
   */
  public static erf(x: number): number {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    const absX = Math.abs(x);

    const t = 1.0 / (1.0 + p * absX);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);

    return sign * y;
  }

  /**
   * Cumulative distribution function (CDF) for standard normal distribution N(0, 1).
   */
  public static normalCdf(x: number, mean: number = 0, stdDev: number = 1): number {
    if (stdDev <= 0) return x >= mean ? 1 : 0;
    const z = (x - mean) / stdDev;
    return 0.5 * (1.0 + this.erf(z / Math.SQRT2));
  }

  /**
   * Generates an array of exact simulation spawn timestamps (in seconds)
   * normalized to totalAgents and strictly sorted in ascending chronological order.
   */
  public static generateSpawnTimestamps(config: ArrivalScheduleConfig): number[] {
    const { pattern, totalAgents, durationMinutes, prng } = config;

    if (totalAgents <= 0) return [];

    const durationSec = Math.max(1, durationMinutes * 60);

    let timestampsSec: number[] = [];

    switch (pattern) {
      case 'uniform':
        timestampsSec = this.generateUniformTimestamps(totalAgents, durationSec, prng);
        break;

      case 'gaussian_peak':
        timestampsSec = this.generateGaussianTimestamps(
          totalAgents,
          durationSec,
          config.gaussianPeakMin ?? durationMinutes * 0.42,
          config.gaussianStdDevMin ?? Math.max(1, durationMinutes * 0.175),
          prng
        );
        break;

      case 'burst':
        timestampsSec = this.generateBurstTimestamps(
          totalAgents,
          durationSec,
          durationMinutes,
          config.burstIntervals,
          prng
        );
        break;

      default:
        timestampsSec = this.generateUniformTimestamps(totalAgents, durationSec, prng);
    }

    // Ensure strict ascending chronological order
    timestampsSec.sort((a, b) => a - b);

    // Safeguard: clamp all timestamps to [0, durationSec]
    for (let i = 0; i < timestampsSec.length; i++) {
      timestampsSec[i] = Math.max(0, Math.min(durationSec, Math.round(timestampsSec[i] * 100) / 100));
    }

    return timestampsSec;
  }

  /**
   * Generates uniform arrival timestamps with stratified random jitter.
   * Guarantees steady dispersion without artificial clumping.
   */
  private static generateUniformTimestamps(
    totalAgents: number,
    durationSec: number,
    prng: SeededPRNG
  ): number[] {
    const result = new Array<number>(totalAgents);
    const interval = durationSec / totalAgents;

    for (let i = 0; i < totalAgents; i++) {
      const jitter = prng.nextRange(0.05, 0.95);
      result[i] = (i + jitter) * interval;
    }

    return result;
  }

  /**
   * Generates Gaussian-concentrated arrivals truncated to [0, durationSec].
   */
  private static generateGaussianTimestamps(
    totalAgents: number,
    durationSec: number,
    peakMinute: number,
    stdDevMinute: number,
    prng: SeededPRNG
  ): number[] {
    const result = new Array<number>(totalAgents);
    const peakSec = Math.max(0, Math.min(durationSec, peakMinute * 60));
    const stdDevSec = Math.max(10, stdDevMinute * 60);

    let generated = 0;
    let attempts = 0;
    const maxAttempts = totalAgents * 50;

    while (generated < totalAgents && attempts < maxAttempts) {
      attempts++;
      const sample = prng.nextGaussian(peakSec, stdDevSec);
      if (sample >= 0 && sample <= durationSec) {
        result[generated] = sample;
        generated++;
      }
    }

    // Fallback if truncation rejects excessively near boundaries
    while (generated < totalAgents) {
      const fallback = prng.nextRange(0, durationSec);
      result[generated] = fallback;
      generated++;
    }

    return result;
  }

  /**
   * Generates stepped burst arrivals modeling concentrated pulses (e.g., train arrivals).
   */
  private static generateBurstTimestamps(
    totalAgents: number,
    durationSec: number,
    durationMinutes: number,
    customIntervals: readonly { readonly startMin: number; readonly endMin: number; readonly weight: number }[] | undefined,
    prng: SeededPRNG
  ): number[] {
    const intervals = customIntervals && customIntervals.length > 0
      ? customIntervals
      : [
          { startMin: durationMinutes * 0.20, endMin: durationMinutes * 0.28, weight: 0.35 },
          { startMin: durationMinutes * 0.50, endMin: durationMinutes * 0.58, weight: 0.40 },
          { startMin: durationMinutes * 0.75, endMin: durationMinutes * 0.82, weight: 0.20 },
          { startMin: 0, endMin: durationMinutes, weight: 0.05 }
        ];

    const totalWeight = intervals.reduce((acc, curr) => acc + curr.weight, 0);
    const result = new Array<number>(totalAgents);
    let index = 0;

    for (let i = 0; i < intervals.length; i++) {
      const interval = intervals[i];
      const normalizedWeight = interval.weight / totalWeight;
      const count = i === intervals.length - 1
        ? totalAgents - index
        : Math.round(totalAgents * normalizedWeight);

      const startSec = Math.max(0, Math.min(durationSec, interval.startMin * 60));
      const endSec = Math.max(startSec + 1, Math.min(durationSec, interval.endMin * 60));

      for (let c = 0; c < count && index < totalAgents; c++) {
        result[index++] = prng.nextRange(startSec, endSec);
      }
    }

    return result;
  }

  /**
   * Computes the theoretical arrival rate profile $\lambda(t)$ in entities per minute.
   * Guarantees mathematical normalization so that numerical integration over [0, duration]
   * equals totalEntities.
   */
  public static computeArrivalRateProfile(
    pattern: ArrivalPatternType,
    totalEntities: number,
    durationMinutes: number,
    options?: {
      readonly gaussianPeakMin?: number;
      readonly gaussianStdDevMin?: number;
      readonly burstIntervals?: readonly { readonly startMin: number; readonly endMin: number; readonly weight: number }[];
    }
  ): ArrivalRateProfile {
    const duration = Math.max(1, durationMinutes);
    const avgRate = totalEntities / duration;

    let peakRate = avgRate;
    let rateFn: (m: number) => number;

    if (pattern === 'uniform') {
      rateFn = () => avgRate;
      peakRate = avgRate;
    } else if (pattern === 'gaussian_peak') {
      const mu = options?.gaussianPeakMin ?? duration * 0.42;
      const sigma = Math.max(0.5, options?.gaussianStdDevMin ?? duration * 0.175);

      // Area under the normal curve bounded within [0, duration]
      const areaInBounds = Math.max(
        0.001,
        this.normalCdf(duration, mu, sigma) - this.normalCdf(0, mu, sigma)
      );

      // Truncated normal probability density function normalized to totalEntities
      const normFactor = totalEntities / (areaInBounds * sigma * Math.sqrt(2 * Math.PI));

      rateFn = (m: number) => {
        if (m < 0 || m > duration) return 0;
        const exponent = -Math.pow(m - mu, 2) / (2 * Math.pow(sigma, 2));
        return normFactor * Math.exp(exponent);
      };

      // Peak rate occurs at mu (clamped to [0, duration])
      const peakMinute = Math.max(0, Math.min(duration, mu));
      peakRate = rateFn(peakMinute);
    } else {
      // Burst profile
      const intervals = options?.burstIntervals ?? [
        { startMin: duration * 0.20, endMin: duration * 0.28, weight: 0.35 },
        { startMin: duration * 0.50, endMin: duration * 0.58, weight: 0.40 },
        { startMin: duration * 0.75, endMin: duration * 0.82, weight: 0.20 },
        { startMin: 0, endMin: duration, weight: 0.05 }
      ];

      const totalWeight = intervals.reduce((acc, c) => acc + c.weight, 0);

      rateFn = (m: number) => {
        if (m < 0 || m > duration) return 0;
        let rate = 0;
        for (const inter of intervals) {
          if (m >= inter.startMin && m <= inter.endMin) {
            const spanMin = Math.max(0.1, inter.endMin - inter.startMin);
            const allocatedEntities = totalEntities * (inter.weight / totalWeight);
            rate += allocatedEntities / spanMin;
          }
        }
        return rate;
      };

      let maxFound = 0;
      for (let m = 0; m <= duration; m += 0.25) {
        const val = rateFn(m);
        if (val > maxFound) maxFound = val;
      }
      peakRate = maxFound;
    }

    return {
      pattern,
      peakArrivalRatePerMin: Math.round(peakRate * 10) / 10,
      averageArrivalRatePerMin: Math.round(avgRate * 10) / 10,
      getRateAtMinute: rateFn
    };
  }

  /**
   * Numerically integrates the arrival rate profile over [startMin, endMin]
   * using the midpoint Riemann rule to verify total population conservation.
   */
  public static integrateArrivalRate(
    profile: ArrivalRateProfile,
    startMin: number,
    endMin: number,
    steps: number = 2000
  ): number {
    const dt = (endMin - startMin) / steps;
    let sum = 0;

    for (let i = 0; i < steps; i++) {
      const mid = startMin + (i + 0.5) * dt;
      sum += profile.getRateAtMinute(mid);
    }

    return Math.round(sum * dt * 100) / 100;
  }
}
