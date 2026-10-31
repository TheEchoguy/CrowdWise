/**
 * CROWDWISE — Ticket-Aware Spectator Allocation Engine
 * Venue: M. Chinnaswamy Stadium, Bengaluru (35,000 Capacity)
 *
 * Generates calibrated, ticket-entitled spectator records for the 21-gate stadium network:
 * 1. Allocates exact requested population N (e.g. 10,000 spectators) with unique IDs.
 * 2. Assigns immutable stand entitlements based on stadium seating distribution.
 * 3. Maps each spectator to an authorized primary gate and alternative gates.
 * 4. Strictly bars ordinary public demand from the 4 reserved gates (G4, G9, G13, G20).
 * 5. Synthesizes deterministic chronological arrival schedules using seeded PRNG.
 */

import {
  CHINNASWAMY_STANDS,
  PUBLIC_STADIUM_GATES,
  RESERVED_STADIUM_GATES,
  STADIUM_21_GATES_BY_ID,
  StadiumGateDefinition,
  StadiumStandDefinition,
  TicketCategory
} from '../data/stadium21GateConfig';
import { SeededPRNG } from '../utils/seededRandom';
import { ArrivalDistributionEngine } from './ArrivalDistribution';
import { ArrivalPatternType } from '../types/ScenarioTypes';

export interface StadiumSpectatorRecord {
  readonly spectatorId: string;           // Unique stable ID: e.g. 'SPEC-000001'
  readonly ticketCategory: TicketCategory;// 'general' | 'premium' | 'hospitality' | 'vip' | 'members'
  readonly assignedStandId: string;       // Immutable entitlement: e.g. 'stand-A', 'stand-E'
  readonly assignedGateId: string;        // Primary nominal access gate: e.g. 'gate-1'
  readonly authorizedGateIds: readonly string[]; // All gates authorized for this stand & ticket
  readonly arrivalTimeSimSec: number;     // Physical arrival timestamp
  currentGateId: string;                  // Active target gate (may change only via valid diversion)
  currentZoneId: 'zone-3' | 'zone-2' | 'zone-1' | 'admitted';
  currentRouteId: string;
  isRerouted: boolean;
}

export interface TicketAllocationResult {
  readonly totalSpectators: number;
  readonly spectators: readonly StadiumSpectatorRecord[];
  readonly gateAllocations: Record<string, {
    readonly gate: StadiumGateDefinition;
    readonly assignedCount: number;
    readonly percentage: number;
  }>;
  readonly reservedGateCounts: Record<string, number>;
  readonly seed: number;
}

export interface TicketAllocationOptions {
  readonly totalSpectators: number;        // e.g. 10,000 or 33,250
  readonly durationMinutes?: number;       // Default: 60 minutes
  readonly arrivalDistribution?: ArrivalPatternType; // Default: 'gaussian_peak'
  readonly randomSeed: number;
  readonly customGateWeights?: Record<string, number>; // Optional gate demand overrides
}

export class TicketAllocationEngine {
  /**
   * Generates a fully ticket-entitled, deterministic spectator population.
   *
   * Invariant: Total generated spectators == options.totalSpectators exactly.
   * Invariant: Reserved gates (G4, G9, G13, G20) receive exactly 0 public spectators.
   */
  public static allocateTickets(options: TicketAllocationOptions): TicketAllocationResult {
    const N = Math.max(1, Math.round(options.totalSpectators));
    const seed = options.randomSeed;
    const prng = new SeededPRNG(seed);
    const durationMin = options.durationMinutes ?? 60;
    const arrivalDist = options.arrivalDistribution ?? 'gaussian_peak';

    // 1. Generate normalized chronological arrival timestamps
    const arrivalTimestampsSec = ArrivalDistributionEngine.generateSpawnTimestamps({
      pattern: arrivalDist,
      totalAgents: N,
      durationMinutes: durationMin,
      prng
    });

    // 2. Identify all public stands (stands served by public gates)
    const allStands = Object.values(CHINNASWAMY_STANDS);
    const publicStands = allStands.filter((stand: StadiumStandDefinition) =>
      stand.primaryGateIds.some((gId: string) => {
        const g = STADIUM_21_GATES_BY_ID[gId];
        return g && g.publicEntryEligible;
      })
    );

    // Compute cumulative capacity thresholds for stand selection
    const totalPublicStandCapacity = publicStands.reduce((sum, s) => sum + s.capacity, 0);

    // 3. Normalize gate weights across public gates
    const publicGates = PUBLIC_STADIUM_GATES;
    const gateWeightMap: Record<string, number> = {};
    let totalWeight = 0;

    for (const gate of publicGates) {
      const weight = options.customGateWeights?.[gate.id] ?? gate.nominalDemandWeight;
      gateWeightMap[gate.id] = weight;
      totalWeight += weight;
    }

    // Fallback if weights sum to 0
    if (totalWeight <= 0) {
      for (const gate of publicGates) {
        gateWeightMap[gate.id] = 1 / publicGates.length;
      }
      totalWeight = 1.0;
    } else {
      for (const gate of publicGates) {
        gateWeightMap[gate.id] /= totalWeight;
      }
    }

    // 4. Allocate spectators
    const spectators: StadiumSpectatorRecord[] = new Array(N);
    const gateCounts: Record<string, number> = {};
    for (const g of publicGates) {
      gateCounts[g.id] = 0;
    }

    for (let i = 0; i < N; i++) {
      const spectatorId = `SPEC-${String(i + 1).padStart(6, '0')}`;
      const arrivalTimeSimSec = arrivalTimestampsSec[i];

      // Sample stand weighted by stand capacity
      let standRoll = prng.next() * totalPublicStandCapacity;
      let chosenStand = publicStands[0];
      for (const stand of publicStands) {
        if (standRoll < stand.capacity) {
          chosenStand = stand;
          break;
        }
        standRoll -= stand.capacity;
      }

      // Sample ticket category supported by this stand
      const categories = chosenStand.allowedTicketCategories;
      const categoryIdx = Math.floor(prng.next() * categories.length);
      const ticketCategory = categories[categoryIdx];

      // Identify eligible public gates for this stand
      const eligiblePrimary = chosenStand.primaryGateIds
        .map((id: string) => STADIUM_21_GATES_BY_ID[id])
        .filter((g?: StadiumGateDefinition): g is StadiumGateDefinition => !!g && g.publicEntryEligible);

      const eligibleAlternatives = chosenStand.alternativeGateIds
        .map((id: string) => STADIUM_21_GATES_BY_ID[id])
        .filter((g?: StadiumGateDefinition): g is StadiumGateDefinition => !!g && g.publicEntryEligible);

      const allAuthorizedGates = [...eligiblePrimary, ...eligibleAlternatives];

      // If no valid public gate found, fallback to public gate 1 (safe placeholder)
      let primaryGate = eligiblePrimary[0] || allAuthorizedGates[0] || publicGates[0];

      // If multiple primary gates serve this stand, sample based on relative gate weights
      if (eligiblePrimary.length > 1) {
        let gateWeightSum = eligiblePrimary.reduce((s, g) => s + (gateWeightMap[g.id] || 0.01), 0);
        let gRoll = prng.next() * gateWeightSum;
        for (const g of eligiblePrimary) {
          const w = gateWeightMap[g.id] || 0.01;
          if (gRoll < w) {
            primaryGate = g;
            break;
          }
          gRoll -= w;
        }
      }

      gateCounts[primaryGate.id] = (gateCounts[primaryGate.id] || 0) + 1;

      spectators[i] = {
        spectatorId,
        ticketCategory,
        assignedStandId: chosenStand.id,
        assignedGateId: primaryGate.id,
        authorizedGateIds: Array.from(new Set([primaryGate.id, ...allAuthorizedGates.map((g) => g.id)])),
        arrivalTimeSimSec,
        currentGateId: primaryGate.id,
        currentZoneId: 'zone-3',
        currentRouteId: `route-${primaryGate.id}-direct`,
        isRerouted: false
      };
    }

    // 5. Build summary result
    const gateAllocations: Record<string, { gate: StadiumGateDefinition; assignedCount: number; percentage: number }> = {};
    for (const gate of publicGates) {
      const count = gateCounts[gate.id] || 0;
      gateAllocations[gate.id] = {
        gate,
        assignedCount: count,
        percentage: Math.round((count / N) * 1000) / 10
      };
    }

    const reservedGateCounts: Record<string, number> = {};
    for (const g of RESERVED_STADIUM_GATES) {
      reservedGateCounts[g.id] = 0; // Guaranteed 0 public demand
    }

    return {
      totalSpectators: N,
      spectators: Object.freeze(spectators),
      gateAllocations,
      reservedGateCounts,
      seed
    };
  }
}
