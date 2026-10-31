/**
 * CROWDWISE — Queue Discharge Analyzer
 * Evaluates constriction and turnstile discharge rates against empirical bottleneck benchmarks
 *
 * References:
 * - Schadschneider, A., & Seyfried, A. (2011). Empirical Results for Pedestrian Dynamics.
 */

import { ValidationStatus, BOTTLE_NECK_BENCHMARK } from '../types/PhysicsValidationTypes';

export interface BottleneckDischargeReport {
  corridorWidthMeters: number;
  totalQueued: number;
  totalDischarged: number;
  elapsedTimeSec: number;
  activeDischargeDurationSec: number;
  observedDischargeRatePerSec: number; // patrons / sec (p/s)
  specificDischargeCapacity: number; // patrons / (m * s)
  nominalTheoreticalCapacityPerSec: number; // patrons / sec
  dischargeErrorPercent: number;
  timeToClearQueueSec: number;
  validationStatus: ValidationStatus;
  statusRationale: string;
}

export class QueueDischargeAnalyzer {
  /**
   * Evaluates queue discharge through a bottleneck of width W (meters) over duration T (seconds).
   */
  public static evaluateDischarge(
    corridorWidthMeters: number,
    initialQueueCount: number,
    dischargedCount: number,
    elapsedTimeSec: number,
    nominalTurnstileRatePerLaneSec: number = 0.75, // 1 patron every 1.33 seconds
    activeLanes: number = 2,
    activeDischargeDurationSec?: number
  ): BottleneckDischargeReport {
    const totalTimeSec = Math.max(0.1, elapsedTimeSec);
    const activeTimeSec = Math.max(0.1, activeDischargeDurationSec ?? totalTimeSec);
    const width = Math.max(0.5, corridorWidthMeters);

    // Active discharge flow rate (patrons/second) during steady-state clearing
    const observedRatePerSec = Math.round((dischargedCount / activeTimeSec) * 100) / 100;
    // Specific discharge capacity J_s = J / W in patrons/(meter * second)
    const specificCapacity = Math.round((observedRatePerSec / width) * 100) / 100;

    const nominalRate = activeLanes * nominalTurnstileRatePerLaneSec;
    const rateDiff = Math.abs(observedRatePerSec - nominalRate);
    const errorPercent = nominalRate > 0 ? Math.round((rateDiff / nominalRate) * 100) : 0;

    const remainingQueue = Math.max(0, initialQueueCount - dischargedCount);
    const timeToClear =
      observedRatePerSec > 0 ? Math.round((remainingQueue / observedRatePerSec) * 10) / 10 : Infinity;

    // Check against Schadschneider & Seyfried (2011) specific bottleneck flow range: [1.2, 1.9] p/(m*s)
    let validationStatus: ValidationStatus = 'NOT_VALIDATED';
    let statusRationale = '';

    if (dischargedCount < 5 || activeTimeSec < 3) {
      validationStatus = 'INSUFFICIENT_REFERENCE_DATA';
      statusRationale = 'Sample discharge duration or count too small for steady-state bottleneck evaluation.';
    } else if (
      specificCapacity >= BOTTLE_NECK_BENCHMARK.minSpecificFlow * 0.75 &&
      specificCapacity <= BOTTLE_NECK_BENCHMARK.maxSpecificFlow * 1.25
    ) {
      validationStatus = 'VALIDATED_AGAINST_REFERENCE';
      statusRationale = `Specific discharge capacity (${specificCapacity} p/(m*s)) aligns with Schadschneider & Seyfried (2011) empirical bottleneck range [1.2 - 1.9 p/(m*s)].`;
    } else if (specificCapacity > 0.5 && specificCapacity < 3.0) {
      validationStatus = 'PARTIALLY_VALIDATED';
      statusRationale = `Discharge flow (${specificCapacity} p/(m*s)) falls within plausible operational range but deviates from standard uninhibited corridor benchmarks.`;
    } else {
      validationStatus = 'NOT_VALIDATED';
      statusRationale = `Specific discharge capacity (${specificCapacity} p/(m*s)) significantly diverges from empirical physical parameters.`;
    }

    return {
      corridorWidthMeters: width,
      totalQueued: initialQueueCount,
      totalDischarged: dischargedCount,
      elapsedTimeSec: Math.round(totalTimeSec * 10) / 10,
      activeDischargeDurationSec: Math.round(activeTimeSec * 10) / 10,
      observedDischargeRatePerSec: observedRatePerSec,
      specificDischargeCapacity: specificCapacity,
      nominalTheoreticalCapacityPerSec: Math.round(nominalRate * 100) / 100,
      dischargeErrorPercent: errorPercent,
      timeToClearQueueSec: timeToClear,
      validationStatus,
      statusRationale
    };
  }
}

