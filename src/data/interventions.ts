import { Intervention } from '../types';

export const DEFAULT_INTERVENTIONS: Intervention[] = [
  {
    id: 'int-regulate-admission',
    name: 'Admission Flow Metering',
    description:
      'Pace entrance admissions based on downstream concourse density. Prevents corridor crowding by releasing batches of attendees in controlled intervals.',
    category: 'REGULATE_ADMISSION',
    isActive: false,
    params: {
      batchIntervalSecs: 15,
      maxBatchSize: 25,
      densityHaltThreshold: 2.4,
    },
  },
  {
    id: 'int-open-holding-area',
    name: 'Activate Auxiliary Holding Zone',
    description:
      'Open designated external overflow staging zone (e.g., Cubbon Park Annexe) to corral waiting crowds away from arterial vehicular roadways.',
    category: 'OPEN_HOLDING_AREA',
    isActive: false,
    params: {
      holdingZoneId: 'zone-holding-overflow',
      holdingCapacity: 4500,
    },
  },
  {
    id: 'int-stagger-inflow',
    name: 'Upstream Transit Coordination & Staggering',
    description:
      'Coordinate with Metro and arterial traffic management to stagger train headways and bus arrivals into 8-10 minute pulses rather than continuous surges.',
    category: 'STAGGER_INFLOW',
    isActive: false,
    params: {
      reductionFactor: 0.65, // Reduces peak arrival spike by 35% by flattening over time
      extendedDurationMinutes: 20,
    },
  },
  {
    id: 'int-reroute-approach',
    name: 'Route-Aware Gate Redistribution',
    description:
      'Direct incoming crowds from congested gates towards adjacent under-utilized entrances, verifying downstream concourse corridor capacity first.',
    category: 'REROUTE_APPROACH',
    isActive: false,
    params: {
      sourceGateIds: ['gate-1', 'gate-2'],
      targetGateIds: ['gate-3', 'gate-4'],
      maxDiversionRatio: 0.5,
    },
  },
  {
    id: 'int-admission-pause',
    name: 'Tactical Controlled Admission Pause',
    description:
      'Temporarily halt perimeter turnstile entries for a 3-5 minute cooling interval when internal concourse density exceeds 2.8 p/m².',
    category: 'ADMISSION_PAUSE',
    isActive: false,
    params: {
      pauseDurationSecs: 180,
      notifyExternalQueues: true,
    },
  },
  {
    id: 'int-spare-scanners',
    name: 'Deploy Mobile Backup Scanners',
    description:
      'Mobilize rapid-response handheld wireless scanners to restore processing capacity at gates experiencing hardware or network failures.',
    category: 'SPARE_SCANNERS',
    isActive: false,
    params: {
      backupScannersPerGate: 3,
      deploymentDelaySecs: 20,
    },
  },
  {
    id: 'int-phased-departure',
    name: 'Phased Stand-by-Stand Departure',
    description:
      'Egress attendees sequentially by stadium section (Upper Gallery -> Lower Tiers -> Pavilion) to eliminate simultaneous corridor jamming at event close.',
    category: 'PHASED_DEPARTURE',
    isActive: false,
    params: {
      phaseIntervalMinutes: 5,
      sectionsCount: 3,
    },
  },
  {
    id: 'int-public-comm',
    name: 'Proactive Public Wayfinding Announcements',
    description:
      'Deploy targeted real-time announcements across external LED screens and PA audio advising attendees of low-queue gates and queue expectations.',
    category: 'EARLY_PUBLIC_COMMUNICATION',
    isActive: false,
    params: {
      complianceRate: 0.65, // 65% of uncommitted arrivals follow guidance
    },
  },
];

