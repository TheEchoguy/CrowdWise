import { PublicAnnouncement } from '../types';

export const INITIAL_ANNOUNCEMENTS: PublicAnnouncement[] = [
  {
    id: 'ann-1',
    timestamp: 0,
    title: 'Standard Pre-Event Entry Guidance',
    audience: 'PUBLIC_LED',
    category: 'NORMAL',
    text: 'Welcome to M. Chinnaswamy Stadium. Please prepare your digital ticket for scanning. Please proceed calmly to your designated turnstile gate and follow event steward instructions.',
    broadcasted: true,
    editable: true,
  },
  {
    id: 'ann-2',
    timestamp: 30,
    title: 'Gate Congestion Advisory (Gate 1 & 2)',
    audience: 'MEGAPHONE',
    category: 'CONGESTION',
    text: 'Attention attendees at Cubbon Road: Gate 1 and Gate 2 are experiencing high queue volume. Gate 3 and Gate 4 are open with minimal queue wait times. Please proceed east along the marked pedestrian path.',
    broadcasted: false,
    editable: true,
  },
  {
    id: 'ann-3',
    timestamp: 45,
    title: 'Controlled Admission Pause Notice',
    audience: 'PUBLIC_LED',
    category: 'PAUSE',
    text: 'Admissions are temporarily paused for 3 minutes while internal concourse flows clear. Please remain calmly in your designated corral. Do not push against turnstiles.',
    broadcasted: false,
    editable: true,
  },
  {
    id: 'ann-4',
    timestamp: 60,
    title: 'Emergency Vehicle Corridor Clearance',
    audience: 'STAFF_RADIO',
    category: 'EMERGENCY',
    text: 'All ground staff: North Emergency Vehicle Route must remain completely unobstructed. Guide all standing pedestrians off the central roadway towards Plaza Zone A immediately.',
    broadcasted: false,
    editable: true,
  },
];

