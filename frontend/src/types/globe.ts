export interface MarsRegion {
  id: string;
  name: string;
  featureType: string;
  center: [number, number]; // [lat, lon] in degrees
  bounds: {
    min_lat: number;
    max_lat: number;
    min_lon: number;
    max_lon: number;
  };
  area_km2: number;
  description: string;
  missionContext: string;
  color: string;
}

export const MARS_REGIONS: MarsRegion[] = [
  {
    id: 'SEC-JEZERO-01',
    name: 'Jezero Crater',
    featureType: 'Paleolake Delta & Impact Basin',
    center: [18.38, 77.58],
    bounds: { min_lat: 18.0, max_lat: 19.0, min_lon: 77.0, max_lon: 78.0 },
    area_km2: 3520,
    description: 'Ancient river-lake system with preserved clay-rich delta deposits in northwest Isidis Planitia.',
    missionContext: 'NASA Mars 2020 Perseverance Rover & Ingenuity Helicopter site.',
    color: '#00e5ff',
  },
  {
    id: 'SEC-GALE-01',
    name: 'Gale Crater',
    featureType: 'Stratified Mound & Lakebed',
    center: [-5.4, 137.8],
    bounds: { min_lat: -6.0, max_lat: -5.0, min_lon: 137.0, max_lon: 138.0 },
    area_km2: 3540,
    description: 'Deep impact crater containing Aeolis Mons (Mount Sharp) with miles of layered sedimentary strata.',
    missionContext: 'NASA Mars Science Laboratory (Curiosity Rover) exploration site.',
    color: '#f27036',
  },
  {
    id: 'SEC-OLYMPUS-01',
    name: 'Olympus Mons',
    featureType: 'Giant Shield Volcano',
    center: [18.65, 226.2],
    bounds: { min_lat: 17.5, max_lat: 19.5, min_lon: 225.0, max_lon: 227.5 },
    area_km2: 12500,
    description: 'The highest planetary peak in the solar system, rising 21.9 km above the Mars datum.',
    missionContext: 'Major target of MGS MOLA and Mars Express HRSC topographic surveys.',
    color: '#ffab00',
  },
  {
    id: 'SEC-VALLES-01',
    name: 'Valles Marineris (Candor Chasma)',
    featureType: 'Tectonic Canyon System',
    center: [-6.5, 284.0],
    bounds: { min_lat: -7.5, max_lat: -5.5, min_lon: 283.0, max_lon: 285.0 },
    area_km2: 8900,
    description: 'Enormous rift valley reaching depths of 7 km with canyon walls exposing Mars crustal history.',
    missionContext: 'High-interest orbital study region for sedimentary sulfate deposits and structural rifting.',
    color: '#e04f32',
  },
  {
    id: 'SEC-ARCADIA-01',
    name: 'Arcadia Planitia',
    featureType: 'Smooth Volcanic Plains & Subsurface Ice',
    center: [39.3, 189.7],
    bounds: { min_lat: 38.5, max_lat: 40.5, min_lon: 188.5, max_lon: 191.0 },
    area_km2: 7400,
    description: 'Extensive low-elevation northern plains harboring abundant, shallow subsurface water ice sheets.',
    missionContext: 'Prime candidate landing zone evaluated by NASA for future crewed exploration missions.',
    color: '#00e676',
  },
  {
    id: 'SEC-ELYSIUM-01',
    name: 'Elysium Planitia',
    featureType: 'Young Basaltic Plains',
    center: [4.5, 135.6],
    bounds: { min_lat: 3.5, max_lat: 5.5, min_lon: 134.5, max_lon: 137.0 },
    area_km2: 7100,
    description: 'Flat, young volcanic lava plains near the equator with low boulder and obstacle density.',
    missionContext: 'NASA InSight Lander geophysics and seismological measurement base.',
    color: '#b388ff',
  },
  {
    id: 'SEC-MERIDIANI-01',
    name: 'Meridiani Planum',
    featureType: 'Sedimentary Hematite Plains',
    center: [-0.19, 354.47],
    bounds: { min_lat: -1.0, max_lat: 0.5, min_lon: 353.5, max_lon: 355.5 },
    area_km2: 4800,
    description: 'Equatorial plain with diagnostic gray crystalline hematite spherules ("blueberries") indicative of past groundwater.',
    missionContext: 'NASA Mars Exploration Rover Opportunity landing and 14-year traverse route.',
    color: '#64ffda',
  },
  {
    id: 'SEC-GUSEV-01',
    name: 'Gusev Crater',
    featureType: 'Flooded Impact Basin & Volcanic Floor',
    center: [-14.57, 175.47],
    bounds: { min_lat: -15.5, max_lat: -13.5, min_lon: 174.5, max_lon: 176.5 },
    area_km2: 5200,
    description: 'Crater breached by Ma\'adim Vallis with Columbia Hills exhibiting hydrothermal silica deposits.',
    missionContext: 'NASA Mars Exploration Rover Spirit exploration baseline.',
    color: '#ff5252',
  },
];
