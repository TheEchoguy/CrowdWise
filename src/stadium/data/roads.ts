import { RoadSegment } from '../types/stadium';

/**
 * Arterial Road Network Surrounding M. Chinnaswamy Stadium
 * Bengaluru, Karnataka
 *
 * Configured with official venue access rules and traffic corridors.
 */

export const CHINNASWAMY_ROADS: RoadSegment[] = [
  {
    id: 'ROAD_CUBBON',
    name: 'Cubbon Road',
    roadType: 'PRIMARY_ARTERIAL',
    points: [
      { x: 180, y: 140 },
      { x: 650, y: 140 },
      { x: 1050, y: 140 },
      { x: 1420, y: 140 }
    ],
    width: 52,
    label: 'CUBBON ROAD (Minsk Square ──► BRV Junction)',
    labelPosition: { x: 800, y: 135 },
    isSpectatorPermitted: true,
    notes: 'Major 6-lane northern vehicular and mass pedestrian arterial. Primary spectator ingress corridor for Gates E18-E23 and E1-E4.'
  },
  {
    id: 'ROAD_LINK',
    name: 'Link Road',
    roadType: 'PRIMARY_ARTERIAL',
    points: [
      { x: 1300, y: 140 },
      { x: 1300, y: 550 },
      { x: 1300, y: 880 },
      { x: 1240, y: 1020 }
    ],
    width: 44,
    label: 'LINK ROAD',
    labelPosition: { x: 1300, y: 560, rotation: 90 },
    isSpectatorPermitted: true,
    notes: 'Direct 4-lane eastern approach connecting Cubbon Road and MG Road. Houses major public turnstiles E12-E17.'
  },
  {
    id: 'ROAD_ST_MARKS',
    name: 'St. Marks Road',
    roadType: 'SECONDARY_CORRIDOR',
    points: [
      { x: 1420, y: 220 },
      { x: 1420, y: 600 },
      { x: 1420, y: 1060 }
    ],
    width: 40,
    label: 'ST. MARKS ROAD',
    labelPosition: { x: 1420, y: 620, rotation: 90 },
    isSpectatorPermitted: true,
    notes: 'Parallel eastern corridor feeding spectator spillover and bus staging from MG Road.'
  },
  {
    id: 'ROAD_MG',
    name: 'MG Road',
    roadType: 'PRIMARY_ARTERIAL',
    points: [
      { x: 550, y: 1080 },
      { x: 900, y: 1080 },
      { x: 1220, y: 1080 },
      { x: 1460, y: 1080 }
    ],
    width: 56,
    label: 'MG ROAD & ANIL KUMBLE CIRCLE (Purple Line Metro Corridor)',
    labelPosition: { x: 1020, y: 1085 },
    isSpectatorPermitted: true,
    notes: 'Primary mass transit corridor carrying ~40% of stadium arrivals from MG Road Metro station to Gate E11.'
  },
  {
    id: 'ROAD_QUEENS',
    name: "Queens Road (NO SPECTATOR ENTRY)",
    roadType: 'RESTRICTED_ACCESS',
    points: [
      { x: 220, y: 180 },
      { x: 280, y: 380 },
      { x: 370, y: 660 },
      { x: 480, y: 920 },
      { x: 550, y: 1080 }
    ],
    width: 48,
    label: "QUEENS ROAD ⛔ RESTRICTED ACCESS (MEDIA, TEAM & VIP ONLY)",
    labelPosition: { x: 320, y: 550, rotation: -70 },
    isSpectatorPermitted: false,
    notes: 'STRICT VENUE RESTRICTION: No public spectator ingress permitted. Dedicated to authorized shuttles, police escort, players, and media broadcast vans.'
  }
];

