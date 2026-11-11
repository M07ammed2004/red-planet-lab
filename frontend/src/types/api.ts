export type SectorState =
  | 'UNSCOUTED'
  | 'SCANNING'
  | 'DATA_FOUND'
  | 'DOWNLOADING'
  | 'PROCESSING'
  | 'DISCOVERED'
  | 'PARTIALLY_DISCOVERED'
  | 'FAILED';

export type LayerType =
  | 'imagery'
  | 'elevation'
  | 'slope'
  | 'roughness'
  | 'thermal'
  | 'mineral'
  | 'risk'
  | 'scientific_interest';

export type LayerStatus =
  | 'NOT_CHECKED'
  | 'SEARCHING'
  | 'AVAILABLE'
  | 'DOWNLOADING'
  | 'PROCESSING'
  | 'READY'
  | 'UNAVAILABLE'
  | 'FAILED';

export interface LayerState {
  layer_type: LayerType;
  status: LayerStatus;
  source_product_id?: string | null;
  file_path?: string | null;
  resolution_m?: number | null;
  last_updated?: string | null;
  error_message?: string | null;
}

export interface SectorBounds {
  min_lat: number;
  max_lat: number;
  min_lon: number;
  max_lon: number;
}

export interface NormalizedProduct {
  product_id: string;
  source_archive: string;
  mission: string;
  instrument: string;
  product_type: string;
  description?: string | null;
  pixel_scale_meters?: number | null;
  estimated_download_bytes: number;
}

export interface Sector {
  sector_id: string;
  name: string;
  bounds: SectorBounds;
  center: [number, number];
  area_km2: number;
  coordinate_reference_system: string;
  state: SectorState;
  created_at: string;
  updated_at: string;
  last_scan_at?: string | null;
  available_layers: LayerType[];
  missing_layers: LayerType[];
  layers: Record<LayerType, LayerState>;
  source_products: NormalizedProduct[];
  estimated_download_bytes: number;
  processing_version: string;
  error_message?: string | null;
}

export interface LayerData {
  sector_id: string;
  layer_type: LayerType;
  units: string;
  dimensions: [number, number];
  stats: {
    min: number;
    max: number;
    mean: number;
    std: number;
  };
  lats: number[];
  lons: number[];
  grid: number[][];
  resampled_grid_32x32: number[][];
  metadata: Record<string, unknown>;
  exported_at: string;
}

export type RouteStrategy = 'FASTEST' | 'SAFEST' | 'SCIENTIFIC_EXPLORATION';

export interface Waypoint {
  lat: number;
  lon: number;
  elevation_m: number;
  slope_deg: number;
  risk_score: number;
  cumulative_distance_km: number;
}

export interface RouteResult {
  strategy: RouteStrategy;
  feasible: boolean;
  total_distance_km: number;
  total_cost: number;
  avg_slope_deg: number;
  max_slope_deg: number;
  elevation_change_m: number;
  elevation_profile: number[];
  path_coords: [number, number][];
  waypoints: Waypoint[];
  explanation: string;
  limitations_note: string;
}

export interface RouteComparisonResponse {
  sector_id: string;
  start_coords: [number, number];
  destination_coords: [number, number];
  routes: Record<RouteStrategy, RouteResult>;
  summary: string;
}

export interface TerrainMesh {
  sector_id: string;
  bounds: SectorBounds;
  dimensions: [number, number];
  resolution_m_per_px: number;
  coordinate_system: string;
  elevation_stats: {
    min: number;
    max: number;
    mean: number;
    std: number;
  };
  slope_stats: {
    min: number;
    max: number;
    mean: number;
    std: number;
  };
  roughness_stats: {
    min: number;
    max: number;
    mean: number;
    std: number;
  };
  texture_url: string;
  elevation_colormap_url: string;
  slope_colormap_url: string;
  roughness_colormap_url: string;
  elevation_grid: number[][];
  slope_grid: number[][];
  roughness_grid: number[][];
  created_at: string;
}

export interface JobInfo {
  job_id: string;
  sector_id: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  stage: string;
  progress_pct: number;
  downloaded_bytes: number;
  total_bytes: number;
  current_file: string;
  detail_message: string;
  error_message?: string | null;
  is_cancelled: boolean;
  created_at: string;
  updated_at: string;
}

export interface StorageStatus {
  disk: {
    total_bytes: number;
    free_bytes: number;
    used_bytes: number;
    free_gb: number;
    used_gb: number;
  };
  tiers: {
    raw_bytes: number;
    raw_mb: number;
    processed_bytes: number;
    processed_mb: number;
    cache_bytes: number;
    cache_mb: number;
    metadata_bytes: number;
    metadata_mb: number;
  };
}
