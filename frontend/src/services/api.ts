import type {
  JobInfo,
  LayerData,
  LayerType,
  RouteComparisonResponse,
  RouteStrategy,
  RoverMissionTraverse,
  Sector,
  SectorWeatherCondition,
  StorageStatus,
  StormSeverity,
  SurfacePhoto,
  TerrainMesh,
} from '../types/api';

const API_BASE = '/api';

export async function checkHealth(): Promise<{ status: string; version: string }> {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error('Health check failed');
  return res.json();
}

export async function fetchSectors(): Promise<Sector[]> {
  const res = await fetch(`${API_BASE}/sectors`);
  if (!res.ok) throw new Error('Failed to fetch sectors');
  return res.json();
}

export async function fetchSector(sectorId: string): Promise<Sector> {
  const res = await fetch(`${API_BASE}/sectors/${sectorId}`);
  if (!res.ok) throw new Error(`Failed to fetch sector ${sectorId}`);
  return res.json();
}

export async function scanSector(sectorId: string): Promise<Sector> {
  const res = await fetch(`${API_BASE}/sectors/${sectorId}/scan`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`Failed to scan sector ${sectorId}`);
  return res.json();
}

export async function downloadSectorDem(sectorId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/sectors/${sectorId}/download-dem`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`Failed to download DEM for ${sectorId}`);
  return res.json();
}

export async function processSectorDem(sectorId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/sectors/${sectorId}/process`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`Failed to process DEM for ${sectorId}`);
  return res.json();
}

export async function fetchLayerData(
  sectorId: string,
  layerType: LayerType
): Promise<LayerData> {
  const res = await fetch(`${API_BASE}/sectors/${sectorId}/layers/${layerType}`);
  if (!res.ok) throw new Error(`Failed to fetch layer ${layerType} for ${sectorId}`);
  return res.json();
}

export function getLayerPreviewUrl(sectorId: string, layerType: LayerType): string {
  return `${API_BASE}/sectors/${sectorId}/layers/${layerType}/preview`;
}

export async function planMissionRoutes(params: {
  sector_id: string;
  start_coords: [number, number];
  destination_coords: [number, number];
  max_traversable_slope_deg: number;
  strategies: RouteStrategy[];
}): Promise<RouteComparisonResponse> {
  const res = await fetch(`${API_BASE}/routes/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Route planning failed' }));
    throw new Error(err.detail || 'Route planning failed');
  }
  return res.json();
}

export async function fetchTerrainMesh(sectorId: string): Promise<TerrainMesh> {
  const res = await fetch(`${API_BASE}/sectors/${sectorId}/terrain-mesh`);
  if (!res.ok) throw new Error(`Failed to fetch terrain mesh for sector ${sectorId}`);
  return res.json();
}

export async function startSectorExploration(sectorId: string): Promise<{
  status: 'READY' | 'PROCESSING';
  sector_id: string;
  job_id?: string;
  estimated_bytes?: number;
  job?: JobInfo;
  message?: string;
}> {
  const res = await fetch(`${API_BASE}/sectors/${sectorId}/explore`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`Failed to initiate exploration for sector ${sectorId}`);
  return res.json();
}

export async function fetchJobStatus(jobId: string): Promise<JobInfo> {
  const res = await fetch(`${API_BASE}/jobs/${jobId}`);
  if (!res.ok) throw new Error(`Failed to query job ${jobId}`);
  return res.json();
}

export async function cancelJob(jobId: string): Promise<{ cancelled: boolean; current_status: string }> {
  const res = await fetch(`${API_BASE}/jobs/${jobId}/cancel`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`Failed to cancel job ${jobId}`);
  return res.json();
}

export function getSectorTextureUrl(sectorId: string): string {
  return `${API_BASE}/sectors/${sectorId}/texture`;
}

export async function fetchStorageStatus(): Promise<StorageStatus> {
  const res = await fetch(`${API_BASE}/storage/status`);
  if (!res.ok) throw new Error('Failed to fetch storage status');
  return res.json();
}

export async function purgeSectorCache(
  sectorId: string,
  purgeRaw: boolean = true,
  purgeProcessed: boolean = false
): Promise<{ status: string; freed_mb: number; deleted_paths: string[] }> {
  const res = await fetch(
    `${API_BASE}/storage/cache/${sectorId}?purge_raw=${purgeRaw}&purge_processed=${purgeProcessed}`,
    {
      method: 'DELETE',
    }
  );
  if (!res.ok) throw new Error(`Failed to purge cache for ${sectorId}`);
  return res.json();
}

export async function fetchRoverBenchmarkTraverse(sectorId: string): Promise<RoverMissionTraverse | null> {
  const res = await fetch(`${API_BASE}/routes/benchmarks/${sectorId}`);
  if (!res.ok) return null;
  return res.json();
}

export async function fetchGroundImagery(sectorId: string): Promise<SurfacePhoto[]> {
  const res = await fetch(`${API_BASE}/sectors/${sectorId}/ground-imagery`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.photos || [];
}

export async function fetchSectorWeather(sectorId: string): Promise<SectorWeatherCondition> {
  const res = await fetch(`${API_BASE}/weather/sector/${sectorId}`);
  if (!res.ok) throw new Error(`Failed to fetch weather for sector ${sectorId}`);
  return res.json();
}

export async function simulateSectorWeather(
  sectorId: string,
  severity: StormSeverity,
  customCoords?: { lat?: number; lon?: number; radius_km?: number }
): Promise<SectorWeatherCondition> {
  const res = await fetch(`${API_BASE}/weather/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sector_id: sectorId,
      severity,
      custom_storm_lat: customCoords?.lat,
      custom_storm_lon: customCoords?.lon,
      custom_radius_km: customCoords?.radius_km,
    }),
  });
  if (!res.ok) throw new Error(`Failed to configure storm simulation for sector ${sectorId}`);
  return res.json();
}
