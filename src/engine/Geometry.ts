import { Wall, Gate, ScenarioType, ScenarioGeometry } from '../types/simulation';

/**
 * CROWDWISE Pre-configured Geometry Presets
 * Generates walls, gates, and baffles for:
 * 1. Stadium (M. Chinnaswamy Gate A funnel + Gate B bypass + upstream zigzag baffles)
 * 2. Footbridge (Bidirectional horizontal corridor + optional center divider)
 * 3. Reversal (Wide funnel narrowing toward rear emergency exit)
 */
export function getScenarioGeometry(
  scenario: ScenarioType,
  width: number,
  height: number,
  bafflesActive: boolean,
  auxGateActive: boolean,
  dividerActive: boolean
): ScenarioGeometry {
  const walls: Wall[] = [];
  const gates: Gate[] = [];
  const baffles: Wall[] = [];

  if (scenario === 'stadium') {
    // Primary Gate A at (width / 2, 60)
    const gateAX = width / 2;
    const gateAY = 60;
    const gateAWidth = 50;

    gates.push({
      id: 'gate-a',
      name: 'Gate A (Main Turnstile)',
      x: gateAX,
      y: gateAY,
      width: gateAWidth,
      height: 24,
      cooldown: 0,
      active: true,
      totalPassed: 0
    });

    // Funnel Walls converging toward Gate A
    walls.push(
      // Left boundary
      { x1: 50, y1: height - 50, x2: 50, y2: height * 0.5, type: 'boundary', color: '#475569' },
      // Left funnel slope to Gate A collar
      { x1: 50, y1: height * 0.5, x2: gateAX - gateAWidth / 2, y2: gateAY, type: 'funnel', color: '#64748b' },
      // Gate A collar posts
      { x1: gateAX - gateAWidth / 2, y1: gateAY, x2: gateAX - gateAWidth / 2, y2: gateAY - 30, type: 'funnel', color: '#94a3b8' },
      { x1: gateAX + gateAWidth / 2, y1: gateAY, x2: gateAX + gateAWidth / 2, y2: gateAY - 30, type: 'funnel', color: '#94a3b8' }
    );

    if (auxGateActive) {
      // Gate B auxiliary at (width * 0.8, 60)
      const gateBX = width * 0.8;
      const gateBY = 60;
      const gateBWidth = 46;

      gates.push({
        id: 'gate-b',
        name: 'Gate B (Auxiliary Bypass)',
        x: gateBX,
        y: gateBY,
        width: gateBWidth,
        height: 24,
        cooldown: 0,
        active: true,
        totalPassed: 0
      });

      // Right funnel diverted toward Gate B
      walls.push(
        { x1: gateAX + gateAWidth / 2, y1: gateAY, x2: width * 0.65, y2: height * 0.35, type: 'funnel', color: '#0ea5e9' },
        { x1: width * 0.65, y1: height * 0.35, x2: gateBX - gateBWidth / 2, y2: gateBY, type: 'funnel', color: '#0ea5e9' },
        { x1: width - 50, y1: height - 50, x2: width - 50, y2: height * 0.5, type: 'boundary', color: '#475569' },
        { x1: width - 50, y1: height * 0.5, x2: gateBX + gateBWidth / 2, y2: gateBY, type: 'funnel', color: '#0ea5e9' }
      );
    } else {
      // Standard right funnel to Gate A
      walls.push(
        { x1: width - 50, y1: height - 50, x2: width - 50, y2: height * 0.5, type: 'boundary', color: '#475569' },
        { x1: width - 50, y1: height * 0.5, x2: gateAX + gateAWidth / 2, y2: gateAY, type: 'funnel', color: '#64748b' }
      );
    }

    // 2 Horizontal Zigzag Baffles (Chicanes) when bafflesActive is true
    if (bafflesActive) {
      const b1Y = height * 0.68;
      const b2Y = height * 0.52;

      baffles.push(
        {
          x1: width * 0.12,
          y1: b1Y,
          x2: width * 0.62,
          y2: b1Y,
          type: 'baffle',
          color: '#38bdf8',
          label: '40m Upstream Chicane Baffle 1'
        },
        {
          x1: width * 0.38,
          y1: b2Y,
          x2: width * 0.88,
          y2: b2Y,
          type: 'baffle',
          color: '#38bdf8',
          label: '40m Upstream Chicane Baffle 2'
        }
      );
    }
  } else if (scenario === 'bridge') {
    // Footbridge: Horizontal corridor
    const topY = height * 0.32;
    const botY = height * 0.68;

    walls.push(
      { x1: 50, y1: topY, x2: width - 50, y2: topY, type: 'boundary', color: '#475569' },
      { x1: 50, y1: botY, x2: width - 50, y2: botY, type: 'boundary', color: '#475569' }
    );

    // Center divider wall when dividerActive is true
    if (dividerActive) {
      walls.push({
        x1: width * 0.16,
        y1: height * 0.5,
        x2: width * 0.84,
        y2: height * 0.5,
        type: 'divider',
        color: '#06b6d4',
        label: 'Central Anti-Deadlock Divider'
      });
    }

    // Exits at ends
    gates.push(
      {
        id: 'gate-bridge-east',
        name: 'Platform East',
        x: width - 50,
        y: (topY + height * 0.5) / 2,
        width: 20,
        height: 60,
        cooldown: 0,
        active: true,
        totalPassed: 0
      },
      {
        id: 'gate-bridge-west',
        name: 'Concourse West',
        x: 50,
        y: (botY + height * 0.5) / 2,
        width: 20,
        height: 60,
        cooldown: 0,
        active: true,
        totalPassed: 0
      }
    );
  } else if (scenario === 'reversal') {
    // Reversal Preset: Wide funnel narrowing toward a rear emergency exit
    const topY = height * 0.28;
    const botY = height * 0.72;
    const blockX = width - 60;

    // Outer corridor boundaries
    walls.push(
      { x1: 50, y1: topY, x2: blockX, y2: topY, type: 'boundary', color: '#475569' },
      { x1: 50, y1: botY, x2: blockX, y2: botY, type: 'boundary', color: '#475569' },
      // Blocked dead end at front
      { x1: blockX, y1: topY, x2: blockX, y2: botY, type: 'barrier', color: '#ef4444', label: 'BLOCKED INGRESS GATE' }
    );

    // Rear emergency exit gate
    gates.push({
      id: 'gate-emergency-rear',
      name: 'Rear Emergency Egress',
      x: 50,
      y: height * 0.5,
      width: 20,
      height: 70,
      cooldown: 0,
      active: true,
      totalPassed: 0
    });

    if (bafflesActive) {
      baffles.push(
        {
          x1: width * 0.35,
          y1: topY + 20,
          x2: width * 0.35,
          y2: height * 0.55,
          type: 'baffle',
          color: '#38bdf8',
          label: 'Egress Buffer 1'
        },
        {
          x1: width * 0.62,
          y1: height * 0.45,
          x2: width * 0.62,
          y2: botY - 20,
          type: 'baffle',
          color: '#38bdf8',
          label: 'Egress Buffer 2'
        }
      );
    }
  }

  return { walls, gates, baffles };
}
