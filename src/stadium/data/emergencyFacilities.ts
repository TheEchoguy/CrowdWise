import { EmergencyFacility } from '../types/stadium';

/**
 * Emergency Medical Bays, Dedicated Ambulances & Security Watchtowers
 * M. Chinnaswamy Stadium, Bengaluru
 *
 * Positioned in exact accordance with official KSCA emergency layout markers.
 */

export const CHINNASWAMY_EMERGENCY_FACILITIES: EmergencyFacility[] = [
  // ─── AMBULANCE DEPLOYMENT POSTS (MATCHING OFFICIAL BLUEPRINT) ──────
  {
    id: 'AMB_NORTH_1',
    type: 'AMBULANCE',
    x: 820,
    y: 230,
    rotation: 0,
    label: 'North Sector Rapid Response Ambulance 1',
    sector: 'NORTH_CUBBON',
    notes: 'Parked along North holding concourse between Gate G8 and G9 with direct access to Cubbon Road.'
  },
  {
    id: 'AMB_NORTH_2',
    type: 'AMBULANCE',
    x: 855,
    y: 230,
    rotation: 0,
    label: 'North Sector Rapid Response Ambulance 2',
    sector: 'NORTH_CUBBON',
    notes: 'Secondary emergency medical transport unit for C Stand and Platinum Lounge.'
  },
  {
    id: 'AMB_SOUTH_CARPARK',
    type: 'AMBULANCE',
    x: 610,
    y: 950,
    rotation: -25,
    label: 'KSCA Car Park Trauma Ambulance',
    sector: 'SOUTH_MG',
    notes: 'Stationed at official KSCA VIP car park with rapid evacuation corridor to Bowring and Lady Curzon Hospital.'
  },
  {
    id: 'AMB_EAST_LINK',
    type: 'AMBULANCE',
    x: 1190,
    y: 970,
    rotation: 45,
    label: 'Gate E11 / Link Road Evacuation Ambulance',
    sector: 'EAST_LINK',
    notes: 'Stationed at the southern apex near Gate E11 to handle mass transit medical incidents.'
  },

  // ─── FIRST AID & EMERGENCY MEDICAL CROSS POSTS ─────────────────────
  {
    id: 'MED_NORTH_G8',
    type: 'MEDICAL_POST',
    x: 775,
    y: 215,
    label: 'North First Aid & Triage Center (G8)',
    sector: 'NORTH_CUBBON',
    notes: 'Permanent first-aid post equipped with defibrillators and oxygen supply for C Stand.'
  },
  {
    id: 'MED_EAST_G14',
    type: 'MEDICAL_POST',
    x: 1130,
    y: 690,
    label: 'East Grandstand Medical Post (G14-G15)',
    sector: 'EAST_LINK',
    notes: 'East concourse medical station serving M Stands and lower terraces.'
  },
  {
    id: 'MED_SOUTH_CARPARK',
    type: 'MEDICAL_POST',
    x: 670,
    y: 920,
    label: 'South-West Field Hospital Tent',
    sector: 'SOUTH_MG',
    notes: 'Equipped emergency tent located inside the KSCA car park enclosure.'
  },

  // ─── PERIMETER SECURITY WATCHTOWERS ─────────────────────────────────
  {
    id: 'TOWER_CUBBON_WEST',
    type: 'WATCHTOWER',
    x: 410,
    y: 185,
    label: 'Security Tower 1 (Cubbon West / B-Ground)',
    sector: 'NORTH_CUBBON',
    notes: 'Elevated CCTV and security vantage monitoring B-Ground and Gate E3 queue ingress.'
  },
  {
    id: 'TOWER_CUBBON_EAST',
    type: 'WATCHTOWER',
    x: 990,
    y: 185,
    label: 'Security Tower 2 (Cubbon East / E18)',
    sector: 'NORTH_CUBBON',
    notes: 'Perimeter watchtower overseeing Minsk Square / BRV ingress lines.'
  },
  {
    id: 'TOWER_LINK_NORTH',
    type: 'WATCHTOWER',
    x: 1240,
    y: 270,
    label: 'Security Tower 3 (Link Road North / E17)',
    sector: 'EAST_LINK',
    notes: 'Surveillance tower commanding the northern approach on Link Road.'
  },
  {
    id: 'TOWER_LINK_MID',
    type: 'WATCHTOWER',
    x: 1240,
    y: 600,
    label: 'Security Tower 4 (Link Road Mid / E13-E14)',
    sector: 'EAST_LINK',
    notes: 'Mid-sector vantage overlooking the high-density M Stand queue corrals.'
  },
  {
    id: 'TOWER_LINK_SOUTH',
    type: 'WATCHTOWER',
    x: 1195,
    y: 1010,
    label: 'Security Tower 5 (E11 Apex / Metro Promenade)',
    sector: 'EAST_LINK',
    notes: 'Controls crowd flow from MG Road Metro plaza into Link Road.'
  },
  {
    id: 'TOWER_QUEENS_NORTH',
    type: 'WATCHTOWER',
    x: 345,
    y: 280,
    label: 'Security Tower 6 (Queens Road North / E5)',
    sector: 'WEST_QUEENS',
    notes: 'Enforces restricted access barrier against unauthorized pedestrian ingress from Queens Road.'
  },
  {
    id: 'TOWER_QUEENS_MID',
    type: 'WATCHTOWER',
    x: 440,
    y: 730,
    label: 'Security Tower 7 (Queens Road Mid / E8)',
    sector: 'WEST_QUEENS',
    notes: 'Monitors VIP shuttle drop-off area along Queens Road.'
  }
];

