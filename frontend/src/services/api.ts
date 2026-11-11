import type {
  LayerData,
  LayerType,
  RouteComparisonResponse,
  RouteStrategy,
  Sector,
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
