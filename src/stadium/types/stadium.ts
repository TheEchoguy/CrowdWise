/**
 * CROWDWISE — Phase 1: Authentic Chinnaswamy Stadium Digital Blueprint
 * Strongly-Typed Geospatial and Architectural Entities
 */

export type VerificationStatus = 'VERIFIED' | 'UNVERIFIED' | 'RESTRICTED' | 'EMERGENCY_ONLY';

export type AccessPermission =
  | 'SPECTATOR_PERMITTED'
  | 'RESTRICTED_VIP_MEDIA'
  | 'EMERGENCY_SERVICE_ONLY';

export type StadiumRoad =
  | 'CUBBON_ROAD'
  | 'LINK_ROAD'
  | 'ST_MARKS_ROAD'
  | 'MG_ROAD'
  | 'QUEENS_ROAD';

export type StadiumSection =
  | 'ALL'
  | 'NORTH_CUBBON'
  | 'EAST_LINK'
  | 'SOUTH_MG'
  | 'WEST_QUEENS';

export interface StadiumMetadata {
  venueName: string;
  shortName: string;
  city: string;
  sanctionedCapacity: number;
  pitchOrientation: string;
  fieldDimensionsMeters: { length: number; width: number };
  viewBox: { width: number; height: number };
  center: { x: number; y: number };
  scalePixelsPerMeter: number;
}

export interface StadiumStand {
  id: string;
  name: string;
  tierLabel?: string;
  startAngleDeg: number;
  endAngleDeg: number;
  innerRadius: number;
  outerRadius: number;
  fillColor: string;
  strokeColor: string;
  labelPosition: { x: number; y: number };
  capacity: number;
  associatedInnerGates: string[];
  description: string;
}

export interface OuterGate {
  id: string; // 'E1' to 'E23'
  label: string;
  road: StadiumRoad;
  section: StadiumSection;
  x: number;
  y: number;
  approachVector: { dx: number; dy: number }; // Direction arrow pointing into stadium
  accessPermission: AccessPermission;
  verificationStatus: VerificationStatus;
  connectedInnerGates: string[];
  holdingAreaLabel?: string;
  notes: string;
}

export interface InnerGate {
  id: string; // 'G1' to 'G15'
  label: string;
  section: StadiumSection;
  x: number;
  y: number;
  standId: string;
  standName: string;
  turnstileCount: number;
  baseCapacityPerMin: number;
  verificationStatus: VerificationStatus;
  connectedOuterGates: string[];
  notes: string;
}

export interface PedestrianRoute {
  id: string;
  outerGateId: string;
  innerGateId: string;
  points: { x: number; y: number }[];
  verificationStatus: VerificationStatus;
  holdingAreaId?: string;
  flowDirection: 'INBOUND' | 'BIDIRECTIONAL' | 'EMERGENCY_EGRESS';
  description: string;
}

export interface RoadSegment {
  id: string;
  name: string;
  roadType: 'PRIMARY_ARTERIAL' | 'SECONDARY_CORRIDOR' | 'RESTRICTED_ACCESS';
  points: { x: number; y: number }[];
  width: number;
  label: string;
  labelPosition: { x: number; y: number; rotation?: number };
  isSpectatorPermitted: boolean;
  notes: string;
}

export interface Landmark {
  id: string;
  name: string;
  type: 'PARK' | 'TRAINING_GROUND' | 'PARKING' | 'METRO_STATION' | 'JUNCTION';
  bounds: { x: number; y: number; width?: number; height?: number; path?: string };
  labelPosition: { x: number; y: number };
  color: string;
  description: string;
}

export interface EmergencyFacility {
  id: string;
  type: 'AMBULANCE' | 'MEDICAL_POST' | 'WATCHTOWER';
  x: number;
  y: number;
  rotation?: number;
  label: string;
  sector: StadiumSection;
  notes: string;
}

export interface HoldingArea {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  targetGates: string[];
  label: string;
}

export interface LayerVisibilityState {
  outerGates: boolean;
  innerGates: boolean;
  pedestrianRoutes: boolean;
  roads: boolean;
  stands: boolean;
  medicalFacilities: boolean;
  ambulanceLocations: boolean;
  parkingAndLandmarks: boolean;
  holdingAreas: boolean;
  securityWatchtowers: boolean;
}

