/**
 * CROWDWISE Predictive Crowd Digital Twin & Safety Lab
 * Synthetic Demand Generator Engine
 *
 * Generates calibrated synthetic event metadata, calculates population scaling ratios,
 * and pre-computes immutable arrival schedules for deterministic simulation execution.
 */

import {
  ConfigValidationResult,
  GateLaneConfig,
  PreGeneratedAgentDescriptor,
  PreGeneratedArrivalSchedule,
  SyntheticEventConfigInput,
  SyntheticEventData
} from '../types/ScenarioTypes';
import { SeededPRNG } from '../utils/seededRandom';
import { ArrivalDistributionEngine } from './ArrivalDistribution';

export class SyntheticDemandGenerator {
  public static readonly MAX_SIMULATION_AGENTS = 2500;
  public static readonly MIN_SIMULATION_AGENTS = 50;
  public static readonly DEFAULT_VENUE_CAPACITY = 35000;
  public static readonly CANVAS_WIDTH = 960;
  public static readonly CANVAS_HEIGHT = 580;

  /**
   * Validates event configuration inputs against physical and computational boundaries.
   */
  public static validateConfig(input: SyntheticEventConfigInput): ConfigValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Venue capacity
    if (input.venueCapacity <= 0) {
      errors.push('Venue capacity must be greater than zero.');
    }
    if (input.venueCapacity > 150000) {
      warnings.push('Venue capacity exceeds 150,000; scaling will be very high.');
    }

    // 2. Ticket sales & attendance percentages
    if (input.ticketSalesPercentage < 0 || input.ticketSalesPercentage > 1.0) {
      errors.push('Ticket sales percentage must be between 0.0 and 1.0 (0% - 100%).');
    }
    if (input.attendancePercentage !== undefined && (input.attendancePercentage < 0 || input.attendancePercentage > 1.0)) {
      errors.push('Attendance percentage must be between 0.0 and 1.0 (0% - 100%).');
    }

    // 3. Simulation agent cap
    const simLimit = input.maxSimulatedAgents ?? this.MAX_SIMULATION_AGENTS;
    if (simLimit <= 0) {
      errors.push('Simulated agent limit must be greater than zero.');
    }
    if (simLimit > this.MAX_SIMULATION_AGENTS) {
      warnings.push(`Simulated agent limit ${simLimit} exceeds recommended 60 FPS cap of ${this.MAX_SIMULATION_AGENTS}.`);
    }

    // 4. Gate shares
    const sumShares = input.gateAShare + input.gateBShare;
    if (Math.abs(sumShares - 1.0) > 0.001) {
      errors.push(`Gate shares must sum to 1.0 (current sum: ${sumShares.toFixed(3)}).`);
    }
    if (input.gateAShare < 0 || input.gateBShare < 0) {
      errors.push('Gate shares cannot be negative.');
    }

    // 5. Gate lane configurations
    for (const [key, gate] of Object.entries(input.gates)) {
      if (gate.totalLanes < 0) {
        errors.push(`Gate '${key}' total lanes cannot be negative.`);
      }
      if (gate.operationalLanes < 0) {
        errors.push(`Gate '${key}' operational lanes cannot be negative.`);
      }
      if (gate.operationalLanes > gate.totalLanes) {
        errors.push(`Gate '${key}' operational lanes (${gate.operationalLanes}) exceeds total installed lanes (${gate.totalLanes}).`);
      }
      if (gate.turnstileLatencySec <= 0) {
        errors.push(`Gate '${key}' latency must be strictly positive.`);
      }
    }

    // 6. Gate routing to closed gates warning
    if (input.gateBShare > 0 && input.gates['gate-b'] && input.gates['gate-b'].operationalLanes === 0) {
      warnings.push(`Gate B is allocated ${Math.round(input.gateBShare * 100)}% of demand but has 0 operational lanes; pedestrians will accumulate at closed turnstiles.`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Generates a fully populated SyntheticEventData record from input parameters.
   * Performs capacity scaling, arrival rate calculation, and assigns unique synthetic IDs.
   *
   * ATTENDANCE CALCULATION:
   * tickets_sold = venue_capacity * ticketSalesPercentage
   * expected_attendance = tickets_sold * (attendancePercentage ?? 1.0)
   */
  public static generateSyntheticEvent(input: SyntheticEventConfigInput): SyntheticEventData {
    const validation = this.validateConfig(input);
    if (!validation.isValid) {
      throw new Error(`Invalid scenario configuration: ${validation.errors.join('; ')}`);
    }

    const venueCapacity = Math.max(1, Math.round(input.venueCapacity));
    const ticketSalesPct = Math.max(0, Math.min(1.0, input.ticketSalesPercentage));
    // Default attendance percentage is 1.0 (100% of ticket holders show up)
    const attendancePct = input.attendancePercentage !== undefined
      ? Math.max(0, Math.min(1.0, input.attendancePercentage))
      : 1.0;

    // Calculate real attendance quantities
    const ticketsSold = Math.min(venueCapacity, Math.round(venueCapacity * ticketSalesPct));
    const expectedAttendance = input.expectedAttendanceOverride !== undefined
      ? Math.min(venueCapacity, Math.round(input.expectedAttendanceOverride))
      : Math.min(ticketsSold, Math.round(ticketsSold * attendancePct));

    // Calculate simulation agent population (capped at 2,500)
    const agentBudget = Math.min(
      this.MAX_SIMULATION_AGENTS,
      Math.max(this.MIN_SIMULATION_AGENTS, input.maxSimulatedAgents ?? this.MAX_SIMULATION_AGENTS)
    );

    const simulatedAgents = Math.min(agentBudget, Math.max(this.MIN_SIMULATION_AGENTS, expectedAttendance));

    // Calculate representative population scaling ratio S_pop
    const populationScalingRatio = expectedAttendance > 0
      ? Math.round((expectedAttendance / simulatedAgents) * 1000) / 1000
      : 1.0;

    const arrivalStartMin = input.arrivalStartTimeMin ?? 0;
    const arrivalEndMin = Math.max(arrivalStartMin + 1, input.arrivalEndTimeMin ?? 60);
    const durationMin = arrivalEndMin - arrivalStartMin;

    // If targetPeakArrivalRateReal is provided for gaussian_peak, dynamically solve for exact sigma accounting for bounds
    let effectiveGaussianStdDev = input.gaussianStdDevMin;
    if (input.arrivalDistribution === 'gaussian_peak' && input.targetPeakArrivalRateReal && input.targetPeakArrivalRateReal > 0) {
      const mu = input.gaussianPeakMin ?? durationMin * 0.42;
      let s = expectedAttendance / (input.targetPeakArrivalRateReal * Math.sqrt(2 * Math.PI));
      for (let iter = 0; iter < 5; iter++) {
        const area = Math.max(0.001, ArrivalDistributionEngine.normalCdf(durationMin, mu, s) - ArrivalDistributionEngine.normalCdf(0, mu, s));
        s = expectedAttendance / (input.targetPeakArrivalRateReal * Math.sqrt(2 * Math.PI) * area);
      }
      effectiveGaussianStdDev = s;
    }

    // Calculate peak and average arrival rates (Real and Sim)
    const arrivalProfile = ArrivalDistributionEngine.computeArrivalRateProfile(
      input.arrivalDistribution,
      expectedAttendance,
      durationMin,
      {
        gaussianPeakMin: input.gaussianPeakMin,
        gaussianStdDevMin: effectiveGaussianStdDev,
        burstIntervals: input.burstIntervals
      }
    );

    const peakRateReal = arrivalProfile.peakArrivalRatePerMin;
    const peakRateSim = Math.round((peakRateReal / populationScalingRatio) * 10) / 10;

    const eventId = input.eventId ?? `SYN-EVENT-${Math.abs(input.randomSeed).toString(16).toUpperCase()}-${Date.now().toString().slice(-4)}`;
    const eventName = input.eventName ?? `Synthetic Event (${Math.round(ticketSalesPct * 100)}% Capacity)`;

    return {
      event_id: eventId,
      event_name: eventName,
      venue_capacity: venueCapacity,
      tickets_sold: ticketsSold,
      attendance_percentage: attendancePct,
      expected_attendance: expectedAttendance,
      simulated_agent_population: simulatedAgents,
      population_scaling_ratio: populationScalingRatio,
      arrival_start_time_min: arrivalStartMin,
      arrival_end_time_min: arrivalEndMin,
      arrival_distribution: input.arrivalDistribution,
      peak_arrival_rate_real: peakRateReal,
      peak_arrival_rate_sim: peakRateSim,
      gate_A_share: input.gateAShare,
      gate_B_share: input.gateBShare,
      gates: input.gates,
      random_seed: input.randomSeed,
      routing_mode: input.routingMode ?? 'fixed',
      density_thresholds: input.densityThresholds ?? {
        frictionThreshold: 4.5,
        criticalCrushThreshold: 5.0
      },
      corridor_assumptions: input.corridorAssumptions ?? {
        downstreamCorridorWidthMeters: 15.0,
        specificFlowRatePerMeterMin: 75.0
      },
      is_synthetic: true
    };
  }

  /**
   * Pre-generates an immutable arrival schedule of individual agent descriptors.
   * Guarantees 100% identical pedestrian arrivals for paired counterfactual experiments.
   */
  public static generateArrivalSchedule(
    event: SyntheticEventData,
    customSeed?: number
  ): PreGeneratedArrivalSchedule {
    const seed = customSeed ?? event.random_seed;
    const prng = new SeededPRNG(seed);

    const totalAgents = event.simulated_agent_population;
    const durationMin = event.arrival_end_time_min - event.arrival_start_time_min;

    // Calculate effective gaussian std dev matching event peak rate
    let effectiveGaussianStdDev: number | undefined;
    if (event.arrival_distribution === 'gaussian_peak' && event.peak_arrival_rate_real > 0) {
      const mu = durationMin * 0.42;
      let s = event.expected_attendance / (event.peak_arrival_rate_real * Math.sqrt(2 * Math.PI));
      for (let iter = 0; iter < 5; iter++) {
        const area = Math.max(0.001, ArrivalDistributionEngine.normalCdf(durationMin, mu, s) - ArrivalDistributionEngine.normalCdf(0, mu, s));
        s = event.expected_attendance / (event.peak_arrival_rate_real * Math.sqrt(2 * Math.PI) * area);
      }
      effectiveGaussianStdDev = s;
    }

    // 1. Generate normalized, sorted arrival timestamps
    const timestampsSec = ArrivalDistributionEngine.generateSpawnTimestamps({
      pattern: event.arrival_distribution,
      totalAgents,
      durationMinutes: durationMin,
      gaussianStdDevMin: effectiveGaussianStdDev,
      prng
    });

    // 2. Pre-compute deterministic simultaneous gate assignments
    // Pre-compute exact gate distribution matching gate_A_share and gate_B_share
    const gateACount = Math.round(totalAgents * event.gate_A_share);
    const gateTargets: ('gate-a' | 'gate-b')[] = new Array(totalAgents);
    for (let i = 0; i < totalAgents; i++) {
      gateTargets[i] = i < gateACount ? 'gate-a' : 'gate-b';
    }

    // Deterministic seeded Fisher-Yates shuffle across chronological timestamps
    // Ensures both streams operate concurrently throughout the arrival period (e.g. 75/25 in each time quartile)
    for (let i = totalAgents - 1; i > 0; i--) {
      const j = Math.floor(prng.next() * (i + 1));
      const temp = gateTargets[i];
      gateTargets[i] = gateTargets[j];
      gateTargets[j] = temp;
    }

    const descriptors: PreGeneratedAgentDescriptor[] = new Array(totalAgents);

    for (let i = 0; i < totalAgents; i++) {
      const defaultGateTarget = gateTargets[i];

      // Initial concourse coordinates (Approach from lower concourse)
      const concourseMarginX = 80;
      const concourseSpanX = this.CANVAS_WIDTH - 160;

      // Seeded lateral and longitudinal concourse position
      const initialConcourseX = concourseMarginX + prng.next() * concourseSpanX;
      const initialConcourseY = this.CANVAS_HEIGHT - 65 + prng.nextRange(5, 45);

      // Desired walking speed: Gaussian distribution centered at 1.3 m/s (stdDev: 0.14 m/s)
      const walkingSpeedMps = Math.max(0.7, Math.min(2.1, prng.nextGaussian(1.3, 0.14)));

      // Pedestrian circular collision radius: 5.0px to 6.2px (mean 5.6px = ~0.28m)
      const physicalRadiusPx = Math.round((5.0 + prng.next() * 1.2) * 10) / 10;

      descriptors[i] = {
        agentIndex: i + 1,
        spawnTimeSimSec: timestampsSec[i],
        initialConcourseX: Math.round(initialConcourseX * 10) / 10,
        initialConcourseY: Math.round(initialConcourseY * 10) / 10,
        defaultGateTarget,
        walkingSpeedMps: Math.round(walkingSpeedMps * 100) / 100,
        physicalRadiusPx
      };
    }

    // Sort descriptors by spawnTimeSimSec to guarantee chronological playback
    descriptors.sort((a, b) => a.spawnTimeSimSec - b.spawnTimeSimSec);

    return {
      eventId: event.event_id,
      seed,
      populationScalingRatio: event.population_scaling_ratio,
      totalAgentsToSpawn: totalAgents,
      schedule: Object.freeze(descriptors)
    };
  }

  /**
   * Calculates theoretical gate discharge capacity for a given gate configuration.
   *
   * @param gate Configured gate lanes and latency
   * @param populationScalingRatio Real spectators represented per agent
   * @returns Simulated capacity (agents/min) and Represented capacity (people/min)
   */
  public static calculateTheoreticalGateCapacity(
    gate: GateLaneConfig,
    populationScalingRatio: number = 1.0
  ): {
    readonly simCapacityPerMin: number;
    readonly repCapacityPerMin: number;
    readonly operationalRatio: number;
  } {
    if (gate.totalLanes <= 0 || gate.operationalLanes <= 0 || gate.turnstileLatencySec <= 0) {
      return {
        simCapacityPerMin: 0,
        repCapacityPerMin: 0,
        operationalRatio: 0
      };
    }

    const operationalRatio = Math.min(1.0, gate.operationalLanes / gate.totalLanes);
    const simCapacity = (gate.operationalLanes * 60) / gate.turnstileLatencySec;
    const repCapacity = simCapacity * populationScalingRatio;

    return {
      simCapacityPerMin: Math.round(simCapacity * 10) / 10,
      repCapacityPerMin: Math.round(repCapacity * 10) / 10,
      operationalRatio: Math.round(operationalRatio * 100) / 100
    };
  }

  /**
   * Calculates the authoritative demand-to-capacity overload ratio dynamically.
   */
  public static calculateDemandCapacityRatio(
    peakArrivalRateReal: number,
    gates: Record<string, GateLaneConfig>,
    populationScalingRatio: number
  ): {
    readonly totalTheoreticalRepCapacityPerMin: number;
    readonly demandCapacityRatio: number;
    readonly isOverloaded: boolean;
    readonly overloadPercentage: number;
  } {
    let totalRepCapacity = 0;
    for (const gate of Object.values(gates)) {
      const cap = this.calculateTheoreticalGateCapacity(gate, populationScalingRatio);
      totalRepCapacity += cap.repCapacityPerMin;
    }

    if (totalRepCapacity <= 0) {
      return {
        totalTheoreticalRepCapacityPerMin: 0,
        demandCapacityRatio: Infinity,
        isOverloaded: true,
        overloadPercentage: 100
      };
    }

    const ratio = peakArrivalRateReal / totalRepCapacity;
    const isOverloaded = ratio > 1.0;
    const overloadPercentage = Math.round(Math.max(0, (ratio - 1.0) * 100) * 10) / 10;

    return {
      totalTheoreticalRepCapacityPerMin: Math.round(totalRepCapacity * 10) / 10,
      demandCapacityRatio: Math.round(ratio * 1000) / 1000,
      isOverloaded,
      overloadPercentage
    };
  }
}
