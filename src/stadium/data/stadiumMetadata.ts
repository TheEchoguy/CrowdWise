import { StadiumMetadata } from '../types/stadium';

export const CHINNASWAMY_METADATA: StadiumMetadata = {
  venueName: 'M. Chinnaswamy Stadium',
  shortName: 'KSCA Stadium',
  city: 'Bengaluru, Karnataka, India',
  sanctionedCapacity: 35000,
  pitchOrientation: 'North-South (Pavilion End ──► BEML/Cubbon End)',
  fieldDimensionsMeters: {
    length: 137, // ~150 yards
    width: 128   // ~140 yards
  },
  viewBox: {
    width: 1600,
    height: 1200
  },
  center: {
    x: 800,
    y: 580
  },
  scalePixelsPerMeter: 3.2
};

export const SECTION_VIEWPORTS = {
  ALL: { x: 0, y: 0, width: 1600, height: 1200, label: 'Full Stadium Overview' },
  NORTH_CUBBON: { x: 250, y: 50, width: 1100, height: 750, label: 'Cubbon Road / North Sector' },
  EAST_LINK: { x: 650, y: 150, width: 920, height: 950, label: 'Link Road & St. Marks / East Sector' },
  SOUTH_MG: { x: 450, y: 450, width: 1000, height: 720, label: 'MG Road / South Sector' },
  WEST_QUEENS: { x: 100, y: 150, width: 950, height: 950, label: "Queens Road / West Sector (Restricted)" }
};

