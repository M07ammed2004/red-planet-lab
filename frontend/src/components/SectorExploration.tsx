import React, { useEffect, useState } from 'react';
import type { LayerData, LayerType, Sector } from '../types/api';
import { fetchLayerData, getLayerPreviewUrl } from '../services/api';

interface SectorExplorationProps {
  sector: Sector | null;
  onNavigateToMission: () => void;
}

export const SectorExploration: React.FC<SectorExplorationProps> = ({
  sector,
  onNavigateToMission,
}) => {
  const [activeLayer, setActiveLayer] = useState<LayerType>('elevation');
  const [layerData, setLayerData] = useState<LayerData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredCell, setHoveredCell] = useState<{
    x: number;
    y: number;
    val: number | null;
    lat: number;
    lon: number;
  } | null>(null);

  useEffect(() => {
    if (!sector) return;
    loadLayer(activeLayer);
  }, [sector?.sector_id, activeLayer]);

  const loadLayer = async (type: LayerType) => {
    if (!sector) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchLayerData(sector.sector_id, type);
      setLayerData(data);
    } catch (err: any) {
      setError(`Layer '${type}' is not yet available for this sector. Process the sector first.`);
      setLayerData(null);
    } finally {
      setLoading(false);
    }
  };

  const previewUrl = sector ? getLayerPreviewUrl(sector.sector_id, activeLayer) : '';

  const handleRasterMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!layerData || !sector) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(Math.max(0, e.clientX - rect.left), rect.width);
    const y = Math.min(Math.max(0, e.clientY - rect.top), rect.height);

    const normX = x / rect.width;
    const normY = y / rect.height;

    // Lat: Top is max_lat, Bottom is min_lat
    const lat = sector.bounds.max_lat - normY * (sector.bounds.max_lat - sector.bounds.min_lat);
    // Lon: Left is min_lon, Right is max_lon
    const lon = sector.bounds.min_lon + normX * (sector.bounds.max_lon - sector.bounds.min_lon);

    // Map to 32x32 grid
    const grid = layerData.resampled_grid_32x32 || layerData.grid;
    const rows = grid.length;
    const cols = grid[0]?.length || 1;
    const r = Math.min(Math.floor(normY * rows), rows - 1);
    const c = Math.min(Math.floor(normX * cols), cols - 1);
    const val = grid[r] ? grid[r][c] : null;

    setHoveredCell({ x, y, val, lat, lon });
  };

  if (!sector) {
    return (
      <div className="empty-state">
        <p>No sector selected. Please choose a sector from Mars Overview.</p>
      </div>
    );
  }

  return (
    <div className="exploration-container">
      <div className="exploration-header-bar">
        <div>
          <span className="detail-tag">TERRAIN & SENSOR SYNTHESIS</span>
          <h2>{sector.name} — Scientific Layer Inspector</h2>
        </div>
        <button className="btn btn-accent" onClick={onNavigateToMission}>
          PLAN EXPLORATION ROUTE ➔
        </button>
      </div>

      <div className="exploration-layout">
        <div className="raster-panel">
          <div className="layer-tabs-bar">
            <button
              className={`tab-pill ${activeLayer === 'elevation' ? 'active' : ''}`}
              onClick={() => setActiveLayer('elevation')}
            >
              🏔️ ELEVATION (MOLA)
            </button>
            <button
              className={`tab-pill ${activeLayer === 'slope' ? 'active' : ''}`}
              onClick={() => setActiveLayer('slope')}
            >
              📐 SLOPE (DEGREES)
            </button>
            <button
              className={`tab-pill ${activeLayer === 'roughness' ? 'active' : ''}`}
              onClick={() => setActiveLayer('roughness')}
            >
              🌊 ROUGHNESS (STD DEV)
            </button>
          </div>

          <div className="raster-viewport-card">
            {loading ? (
              <div className="raster-loading">
                <span className="spinner">⚙️</span>
                <p>Loading {activeLayer.toUpperCase()} synthesis...</p>
              </div>
            ) : error ? (
              <div className="raster-error">
                <p>⚠️ {error}</p>
              </div>
            ) : (
              <div
                className="raster-frame"
                onMouseMove={handleRasterMouseMove}
                onMouseLeave={() => setHoveredCell(null)}
              >
                <img
                  src={previewUrl}
                  alt={`${activeLayer} raster`}
                  className="raster-image"
                />

                <div className="raster-overlay-coords">
                  <span className="corner tl">{sector.bounds.max_lat.toFixed(2)}°N, {sector.bounds.min_lon.toFixed(2)}°E</span>
                  <span className="corner tr">{sector.bounds.max_lat.toFixed(2)}°N, {sector.bounds.max_lon.toFixed(2)}°E</span>
                  <span className="corner bl">{sector.bounds.min_lat.toFixed(2)}°N, {sector.bounds.min_lon.toFixed(2)}°E</span>
                  <span className="corner br">{sector.bounds.min_lat.toFixed(2)}°N, {sector.bounds.max_lon.toFixed(2)}°E</span>
                </div>

                {hoveredCell && hoveredCell.val !== null && (
                  <div className="cell-tooltip" style={{ left: hoveredCell.x + 15, top: hoveredCell.y - 15 }}>
                    <div className="tooltip-title">GEOSPATIAL PROBE</div>
                    <div>Lat: {hoveredCell.lat.toFixed(4)}°N</div>
                    <div>Lon: {hoveredCell.lon.toFixed(4)}°E</div>
                    <div className="tooltip-val">
                      {activeLayer.toUpperCase()}: {hoveredCell.val.toFixed(2)} {layerData?.units}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="raster-legend-bar">
              {activeLayer === 'elevation' && (
                <div className="legend-row">
                  <span>Low Basin (-3000m)</span>
                  <div className="legend-gradient elev-grad"></div>
                  <span>High Peak (0m+)</span>
                </div>
              )}
              {activeLayer === 'slope' && (
                <div className="legend-row">
                  <span>Traversable (0°-5°)</span>
                  <div className="legend-gradient slope-grad"></div>
                  <span>Hazard / Impassable (&gt;25°)</span>
                </div>
              )}
              {activeLayer === 'roughness' && (
                <div className="legend-row">
                  <span>Smooth Surface</span>
                  <div className="legend-gradient elev-grad"></div>
                  <span>Rugged Terrain</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="stats-panel">
          <div className="stats-card">
            <h3>LAYER METRICS & TELEMETRY</h3>
            {layerData ? (
              <div className="stats-body">
                <div className="stat-item">
                  <span className="stat-label">LAYER TYPE</span>
                  <span className="stat-val">{layerData.layer_type.toUpperCase()}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">UNITS</span>
                  <span className="stat-val">{layerData.units}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">MINIMUM</span>
                  <span className="stat-val highlight">{layerData.stats.min.toFixed(2)} {layerData.units}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">MAXIMUM</span>
                  <span className="stat-val highlight">{layerData.stats.max.toFixed(2)} {layerData.units}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">MEAN VALUE</span>
                  <span className="stat-val">{layerData.stats.mean.toFixed(2)} {layerData.units}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">STANDARD DEV</span>
                  <span className="stat-val">{layerData.stats.std.toFixed(2)} {layerData.units}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">GRID SHAPE</span>
                  <span className="stat-val">{layerData.dimensions[0]} × {layerData.dimensions[1]} cells</span>
                </div>
              </div>
            ) : (
              <p className="dim-text">Select or process layer to view telemetry.</p>
            )}
          </div>

          <div className="provenance-card">
            <h3>PROVENANCE & METHODOLOGY</h3>
            <div className="prov-item">
              <span className="prov-title">SOURCE INSTRUMENT:</span>
              <p>MGS MOLA (Mars Orbiter Laser Altimeter), MEGDR topography release.</p>
            </div>
            <div className="prov-item">
              <span className="prov-title">GEODETIC DATUM:</span>
              <p>Mars Areoid equipotential surface (GMM3 / mgm1025 gravity model).</p>
            </div>
            <div className="prov-item">
              <span className="prov-title">DERIVATION FORMULA:</span>
              <p className="code-text">Slope = arctan( sqrt( (dz/dx)² + (dz/dy)² ) )</p>
              <p className="sub-note">Adjusted for latitude-dependent meridian spacing.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
