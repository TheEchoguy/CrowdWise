import { ScenarioPreset } from './types';

/**
 * CROWDWISE Pre-configured Spatial Presets
 * 1. Stadium Ingress: M. Chinnaswamy Stadium Gate A funnel, auxiliary Gate B bypass, and upstream zigzag baffles.
 * 2. Transit Footbridge: Bidirectional high-throughput footbridge with toggleable central anti-deadlock divider.
 * 3. Sudden Shock Reversal: Forward-surging crowd suddenly reversing towards rear exits, modeling compressive shockwaves.
 */

export const STADIUM_INGRESS_PRESET: ScenarioPreset = {
  id: 'stadium',
  name: 'M. Chinnaswamy Stadium Ingress',
  tagline: 'Gate A Bottleneck Funnel & Upstream Shockwave Lab',
  description:
    'Simulates 45,000-seat stadium ingress. High influx converges from open perimeter plaza through a 1.8m turnstile constriction (Gate A). Test impact of 40m upstream zigzag baffles and Auxiliary Gate B bypass.',
  width: 1000,
  height: 600,
  pixelsPerMeter: 20, // 20 px = 1 meter (Arena is 50m x 30m)
  defaultInflowRate: 240, // agents/min
  defaultGateLatency: 2.5, // 2.5s scan time per person
  walls: [
    // Concourse outer perimeter
    { id: 'w-top-outer', x1: 50, y1: 80, x2: 450, y2: 80, type: 'boundary', color: '#334155' },
    { id: 'w-bot-outer', x1: 50, y1: 520, x2: 450, y2: 520, type: 'boundary', color: '#334155' },
    { id: 'w-left-outer', x1: 50, y1: 80, x2: 50, y2: 520, type: 'boundary', color: '#334155' },

    // Primary Gate A Funnel Choke
    { id: 'w-funnel-top', x1: 450, y1: 80, x2: 850, y2: 260, type: 'funnel', color: '#475569' },
    { id: 'w-funnel-bot', x1: 450, y1: 520, x2: 850, y2: 340, type: 'funnel', color: '#475569' },

    // Turnstile Boundary Collars
    { id: 'w-choke-top', x1: 850, y1: 260, x2: 920, y2: 260, type: 'funnel', color: '#64748b' },
    { id: 'w-choke-bot', x1: 850, y1: 340, x2: 920, y2: 340, type: 'funnel', color: '#64748b' },

    // Gate B Bypass Channel Walls
    { id: 'w-bypass-top', x1: 500, y1: 80, x2: 920, y2: 80, type: 'boundary', color: '#38bdf8' },
    { id: 'w-bypass-div', x1: 580, y1: 170, x2: 850, y2: 170, type: 'funnel', color: '#38bdf8' },
    { id: 'w-bypass-collar-top', x1: 850, y1: 130, x2: 920, y2: 130, type: 'funnel', color: '#38bdf8' },
    { id: 'w-bypass-collar-bot', x1: 850, y1: 170, x2: 920, y2: 170, type: 'funnel', color: '#38bdf8' }
  ],
  gates: [
    {
      id: 'gate-a',
      name: 'Gate A (Primary)',
      x: 885,
      y: 300,
      width: 32,
      height: 70,
      cooldown: 0,
      maxCooldown: 2.5,
      active: true,
      color: '#ef4444',
      totalPassed: 0
    },
    {
      id: 'gate-b',
      name: 'Gate B (Auxiliary Bypass)',
      x: 885,
      y: 150,
      width: 32,
      height: 38,
      cooldown: 0,
      maxCooldown: 2.0,
      active: false, // Activated via mitigation control
      color: '#06b6d4',
      totalPassed: 0
    }
  ],
  baffles: [
    // 40m upstream zigzag chicanes to absorb surge waves
    { id: 'baffle-1', x1: 260, y1: 120, x2: 260, y2: 340, active: false, thickness: 4, label: 'Baffle Zone 1' },
    { id: 'baffle-2', x1: 360, y1: 260, x2: 360, y2: 480, active: false, thickness: 4, label: 'Baffle Zone 2' },
    { id: 'baffle-3', x1: 460, y1: 160, x2: 460, y2: 380, active: false, thickness: 4, label: 'Baffle Zone 3' }
  ],
  spawnZones: [
    {
      id: 'spawn-stadium-main',
      x: 70,
      y: 120,
      width: 120,
      height: 360,
      directionX: 1,
      directionY: 0,
      group: 0
    }
  ],
  targetZones: [
    {
      id: 'target-gate-a',
      x: 885,
      y: 300,
      radius: 20,
      group: 0,
      associatedGateId: 'gate-a'
    },
    {
      id: 'target-gate-b',
      x: 885,
      y: 150,
      radius: 20,
      group: 0,
      associatedGateId: 'gate-b'
    }
  ]
};

export const TRANSIT_BRIDGE_PRESET: ScenarioPreset = {
  id: 'bridge',
  name: 'Transit Footbridge Counter-Flow',
  tagline: 'Bidirectional Crowd Corridor & Anti-Deadlock Divider',
  description:
    'High-density bidirectional passenger exchange connecting subway platform and railway concourse. When opposing flows meet without separation, laminar flow breaks down into turbulent locking. Toggle the central physical lane divider.',
  width: 1000,
  height: 600,
  pixelsPerMeter: 20,
  defaultInflowRate: 320,
  defaultGateLatency: 1.0,
  walls: [
    // Corridor boundary walls
    { id: 'w-bridge-top', x1: 60, y1: 190, x2: 940, y2: 190, type: 'boundary', color: '#475569' },
    { id: 'w-bridge-bot', x1: 60, y1: 410, x2: 940, y2: 410, type: 'boundary', color: '#475569' },

    // Central lane divider (Can be toggled on/off)
    { id: 'w-bridge-divider', x1: 180, y1: 300, x2: 820, y2: 300, type: 'divider', color: '#38bdf8' }
  ],
  gates: [
    {
      id: 'gate-bridge-east',
      name: 'Platform East Exit',
      x: 935,
      y: 245,
      width: 20,
      height: 90,
      cooldown: 0,
      maxCooldown: 0.8,
      active: true,
      color: '#10b981',
      totalPassed: 0
    },
    {
      id: 'gate-bridge-west',
      name: 'Concourse West Exit',
      x: 65,
      y: 355,
      width: 20,
      height: 90,
      cooldown: 0,
      maxCooldown: 0.8,
      active: true,
      color: '#10b981',
      totalPassed: 0
    }
  ],
  baffles: [],
  spawnZones: [
    // Westbound Spawn: flows towards East (Group 0)
    {
      id: 'spawn-bridge-west',
      x: 70,
      y: 205,
      width: 70,
      height: 85,
      directionX: 1,
      directionY: 0,
      group: 0
    },
    // Eastbound Spawn: flows towards West (Group 1)
    {
      id: 'spawn-bridge-east',
      x: 860,
      y: 310,
      width: 70,
      height: 85,
      directionX: -1,
      directionY: 0,
      group: 1
    }
  ],
  targetZones: [
    {
      id: 'target-bridge-east',
      x: 940,
      y: 245,
      radius: 30,
      group: 0
    },
    {
      id: 'target-bridge-west',
      x: 60,
      y: 355,
      radius: 30,
      group: 1
    }
  ]
};

export const REVERSAL_SURGE_PRESET: ScenarioPreset = {
  id: 'reversal',
  name: 'Sudden Shock Reversal & Egress Lab',
  tagline: 'Emergency Turnabout & Compressive Shockwave Genesis',
  description:
    'Demonstrates the catastrophic physics of crowd collapse: forward-streaming festival crowd encounters a sudden gate blockage and attempts emergency reversal while upstream inflow continues to press forward.',
  width: 1000,
  height: 600,
  pixelsPerMeter: 20,
  defaultInflowRate: 360,
  defaultGateLatency: 8.0, // High blockage latency
  walls: [
    // Funnel channel leading to dead-end
    { id: 'w-rev-top', x1: 60, y1: 170, x2: 840, y2: 210, type: 'boundary', color: '#475569' },
    { id: 'w-rev-bot', x1: 60, y1: 430, x2: 840, y2: 390, type: 'boundary', color: '#475569' },
    // Blocked front barrier
    { id: 'w-rev-end', x1: 840, y1: 210, x2: 840, y2: 390, type: 'barrier', color: '#ef4444' }
  ],
  gates: [
    {
      id: 'gate-emergency-top',
      name: 'Rear Exit North',
      x: 80,
      y: 130,
      width: 36,
      height: 60,
      cooldown: 0,
      maxCooldown: 1.2,
      active: true,
      color: '#10b981',
      totalPassed: 0
    },
    {
      id: 'gate-emergency-bot',
      name: 'Rear Exit South',
      x: 80,
      y: 470,
      width: 36,
      height: 60,
      cooldown: 0,
      maxCooldown: 1.2,
      active: true,
      color: '#10b981',
      totalPassed: 0
    }
  ],
  baffles: [
    { id: 'baffle-rev-1', x1: 400, y1: 200, x2: 400, y2: 320, active: false, thickness: 4, label: 'Holding Barrier A' },
    { id: 'baffle-rev-2', x1: 580, y1: 280, x2: 580, y2: 400, active: false, thickness: 4, label: 'Holding Barrier B' }
  ],
  spawnZones: [
    {
      id: 'spawn-rev-inflow',
      x: 80,
      y: 200,
      width: 100,
      height: 200,
      directionX: 1,
      directionY: 0,
      group: 0
    }
  ],
  targetZones: [
    {
      id: 'target-rev-deadend',
      x: 810,
      y: 300,
      radius: 40,
      group: 0
    },
    {
      id: 'target-rev-emergency',
      x: 80,
      y: 300,
      radius: 40,
      group: 1
    }
  ]
};

export const SCENARIO_PRESETS: Record<string, ScenarioPreset> = {
  stadium: STADIUM_INGRESS_PRESET,
  bridge: TRANSIT_BRIDGE_PRESET,
  reversal: REVERSAL_SURGE_PRESET
};
