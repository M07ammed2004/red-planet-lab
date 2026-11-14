import React, { useEffect, useState } from 'react';
import type { RoverMissionTraverse, Sector, SurfacePhoto, TerrainMesh } from '../types/api';
import {
  fetchGroundImagery,
  fetchRoverBenchmarkTraverse,
  fetchTerrainMesh,
  purgeSectorCache,
  startSectorExploration,
} from '../services/api';
import {
  ThreeTerrainView,
  type TerrainLayerMode,
} from './terrain/ThreeTerrainView';
import { AcquisitionModal } from './acquisition/AcquisitionModal';

interface SectorExplorationProps {
  sector: Sector | null;
  autoStart?: boolean;
  onAutoStartConsumed?: () => void;
  onNavigateToMission: () => void;
}

export const SectorExploration: React.FC<SectorExplorationProps> = ({
  sector,
  autoStart,
  onAutoStartConsumed,
  onNavigateToMission,
}) => {
  const [terrainMesh, setTerrainMesh] = useState<TerrainMesh | null>(null);
  const [layerMode, setLayerMode] = useState<TerrainLayerMode>('visible');
  const [verticalExaggeration, setVerticalExaggeration] = useState<number>(1.6);
  const [wireframe, setWireframe] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // In-situ ground photography & rover traverse state
  const [photos, setPhotos] = useState<SurfacePhoto[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<SurfacePhoto | null>(null);
  const [benchmark, setBenchmark] = useState<RoverMissionTraverse | null>(null);
  const [showRoverTraverse, setShowRoverTraverse] = useState<boolean>(true);

  // Background Acquisition State
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [isAcquiring, setIsAcquiring] = useState<boolean>(false);
  const [purgeNotice, setPurgeNotice] = useState<string | null>(null);

  const loadTerrainMesh = async (sectorId: string) => {
    setLoading(true);
    setError(null);
    try {
      const [meshRes, photoRes, benchRes] = await Promise.allSettled([
        fetchTerrainMesh(sectorId),
        fetchGroundImagery(sectorId),
        fetchRoverBenchmarkTraverse(sectorId),
      ]);

      if (meshRes.status === 'fulfilled' && meshRes.value) {
        setTerrainMesh(meshRes.value);
      } else {
        setTerrainMesh(null);
      }

      if (photoRes.status === 'fulfilled' && photoRes.value) {
        setPhotos(photoRes.value);
      } else {
        setPhotos([]);
      }

      if (benchRes.status === 'fulfilled' && benchRes.value) {
        setBenchmark(benchRes.value);
      } else {
        setBenchmark(null);
      }
    } catch {
      setTerrainMesh(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!sector) return;
    loadTerrainMesh(sector.sector_id);
  }, [sector?.sector_id]);

  useEffect(() => {
    if (autoStart && sector && !terrainMesh && !isAcquiring && !loading) {
      if (onAutoStartConsumed) onAutoStartConsumed();
      handleStartExploration();
    }
  }, [autoStart, sector, terrainMesh, isAcquiring, loading]);

  const handleStartExploration = async () => {
    if (!sector) return;
    setError(null);
    try {
      const res = await startSectorExploration(sector.sector_id);
      if (res.status === 'READY') {
        await loadTerrainMesh(sector.sector_id);
      } else if (res.job_id) {
        setActiveJobId(res.job_id);
        setIsAcquiring(true);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to start automated exploration');
    }
  };

  const handleAcquisitionComplete = async () => {
    setIsAcquiring(false);
    setActiveJobId(null);
    if (sector) {
      await loadTerrainMesh(sector.sector_id);
    }
  };

  const handlePurgeCache = async () => {
    if (!sector) return;
    const confirm = window.confirm(
      `Purge local raw download cache for ${sector.name}? Processed 3D layers will remain accessible.`
    );
    if (!confirm) return;

    try {
      const res = await purgeSectorCache(sector.sector_id, true, false);
      setPurgeNotice(`Freed ${res.freed_mb} MB from cache.`);
      setTimeout(() => setPurgeNotice(null), 5000);
    } catch (err: any) {
      setPurgeNotice(`Purge error: ${err.message}`);
    }
  };

  if (!sector) {
    return (
      <div className="empty-state">
        <p>No exploration sector selected. Please choose a region from Mars Overview.</p>
      </div>
    );
  }

  return (
    <div className="exploration-container">
      {/* Header Bar */}
      <div className="exploration-header-bar">
        <div>
          <span className="detail-tag">SCIENTIFIC 3D TERRAIN RECONSTRUCTION</span>
          <h2>{sector.name}</h2>
          <span className="sub-coords">
            Bounding Box: [{sector.bounds.min_lat.toFixed(1)}°N to {sector.bounds.max_lat.toFixed(1)}°N,{' '}
            {sector.bounds.min_lon.toFixed(1)}°E to {sector.bounds.max_lon.toFixed(1)}°E]
          </span>
        </div>
        <div className="header-actions-group">
          {purgeNotice && <span className="purge-feedback-pill">{purgeNotice}</span>}
          <button
            className="btn btn-secondary-outline btn-sm"
            onClick={handlePurgeCache}
            title="Clean raw files to save disk space"
          >
            🧹 PURGE CACHE
          </button>
          <button className="btn btn-accent" onClick={onNavigateToMission}>
            PLAN MISSION ROUTE ➔
          </button>
        </div>
      </div>

      {/* Main Exploration Body */}
      {terrainMesh ? (
        <div className="exploration-layout">
          {/* Left / Center: Interactive 3D Terrain Viewer */}
          <div className="raster-panel">
            {/* Layer Switching & Viewport Controls Toolbar */}
            <div className="layer-controls-toolbar">
              <div className="layer-tabs-bar">
                <button
                  className={`tab-pill ${layerMode === 'visible' ? 'active' : ''}`}
                  onClick={() => setLayerMode('visible')}
                >
                  🌍 ORBITAL MOSAIC
                </button>
                <button
                  className={`tab-pill ${layerMode === 'elevation' ? 'active' : ''}`}
                  onClick={() => setLayerMode('elevation')}
                >
                  🏔️ ELEVATION (MOLA)
                </button>
                <button
                  className={`tab-pill ${layerMode === 'slope' ? 'active' : ''}`}
                  onClick={() => setLayerMode('slope')}
                >
                  📐 SLOPE (DEGREES)
                </button>
                <button
                  className={`tab-pill ${layerMode === 'roughness' ? 'active' : ''}`}
                  onClick={() => setLayerMode('roughness')}
                >
                  🌊 ROUGHNESS
                </button>
                <button
                  className={`tab-pill ${layerMode === 'geology' ? 'active' : ''}`}
                  onClick={() => setLayerMode('geology')}
                >
                  🌋 GEOLOGY (USGS)
                </button>
                {benchmark && (
                  <button
                    className={`tab-pill traverse-toggle ${showRoverTraverse ? 'active' : ''}`}
                    onClick={() => setShowRoverTraverse(!showRoverTraverse)}
                    title="Toggle NASA Historical Rover Traverse on 3D Terrain"
                  >
                    🚀 NASA TRAVERSE {showRoverTraverse ? 'ON' : 'OFF'}
                  </button>
                )}
              </div>

              {/* Viewport Display Modifiers */}
              <div className="view-modifiers-bar">
                <div className="slider-control-group">
                  <span className="ctrl-label">VERTICAL EXAGGERATION:</span>
                  <input
                    type="range"
                    min="1.0"
                    max="3.5"
                    step="0.1"
                    value={verticalExaggeration}
                    onChange={(e) => setVerticalExaggeration(parseFloat(e.target.value))}
                    className="slider-input"
                  />
                  <span className="slider-value-badge">{verticalExaggeration.toFixed(1)}×</span>
                </div>

                <label className="checkbox-toggle">
                  <input
                    type="checkbox"
                    checked={wireframe}
                    onChange={(e) => setWireframe(e.target.checked)}
                  />
                  <span>WIREFRAME</span>
                </label>
              </div>
            </div>

            {/* Ground-to-Orbit Fusion In-Situ Photo Strip */}
            {photos.length > 0 && (
              <div className="ground-fusion-toolbar">
                <div className="fusion-tag-group">
                  <span className="fusion-pulse-dot"></span>
                  <span className="fusion-label">GROUND-TO-ORBIT FUSION:</span>
                  <span className="fusion-count">{photos.length} IN-SITU SURFACE PHOTOGRAPHS</span>
                  <span className="fusion-hint">(Click any thumbnail or 3D beacon to inspect)</span>
                </div>
                <div className="fusion-thumbnails-strip">
                  {photos.map((photo) => (
                    <div
                      key={photo.photo_id}
                      className="fusion-thumb-card"
                      onClick={() => setSelectedPhoto(photo)}
                      title={`Click to view in-situ Mastcam/Navcam observation: ${photo.target_name}`}
                    >
                      <img src={photo.image_url} alt={photo.target_name} className="fusion-thumb-img" />
                      <div className="fusion-thumb-info">
                        <span className="thumb-target">{photo.target_name}</span>
                        <span className="thumb-meta">{photo.rover_name} • Sol {photo.sol}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3D Terrain Viewport Card */}
            <div className="raster-viewport-card terrain-3d-card">
              <ThreeTerrainView
                mesh={terrainMesh}
                layerMode={layerMode}
                verticalExaggeration={verticalExaggeration}
                wireframe={wireframe}
                photos={photos}
                onSelectPhoto={(p) => setSelectedPhoto(p)}
                showRoverTraverse={showRoverTraverse}
                roverPath={benchmark?.path_coords || []}
                roverWaypoints={benchmark?.waypoints || []}
              />

              {/* Bottom Layer Dynamic Legend Bar */}
              <div className="raster-legend-bar">
                {layerMode === 'visible' && (
                  <div className="legend-row">
                    <span>Low Albedo (Basalt / Regolith)</span>
                    <div className="legend-gradient visible-grad"></div>
                    <span>High Albedo (Dust / Quartz / Sulfates)</span>
                  </div>
                )}
                {layerMode === 'elevation' && (
                  <div className="legend-row">
                    <span>
                      Basin ({terrainMesh.elevation_stats.min.toFixed(0)} m)
                    </span>
                    <div className="legend-gradient elev-grad"></div>
                    <span>
                      Crater Rim ({terrainMesh.elevation_stats.max.toFixed(0)} m)
                    </span>
                  </div>
                )}
                {layerMode === 'slope' && (
                  <div className="legend-row">
                    <span>Traversable (&lt;5°)</span>
                    <div className="legend-gradient slope-grad"></div>
                    <span>Hazard / Wall (&gt;20°)</span>
                  </div>
                )}
                {layerMode === 'roughness' && (
                  <div className="legend-row">
                    <span>Smooth Regolith Floor</span>
                    <div className="legend-gradient elev-grad"></div>
                    <span>Rugged Boulder Field</span>
                  </div>
                )}
                {layerMode === 'geology' && (
                  <div className="legend-row geology-legend">
                    <span className="geol-chip" style={{ backgroundColor: '#eb8c28' }}>Delta Fan (Sedimentary Clay/Sandstone)</span>
                    <span className="geol-chip" style={{ backgroundColor: '#784b91' }}>Basalt Plain (Olivine Volcanic)</span>
                    <span className="geol-chip" style={{ backgroundColor: '#4ba596' }}>Mound Strata (Sulfate/Clay Bedding)</span>
                    <span className="geol-chip" style={{ backgroundColor: '#b97355' }}>Noachian Rim Basement</span>
                    <span className="geol-chip" style={{ backgroundColor: '#dcb94b' }}>Active Eolian Dunes</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Panel: Telemetry & Provenance */}
          <div className="stats-panel">
            <div className="stats-card">
              <h3>SCIENTIFIC TELEMETRY & RECONSTRUCTION</h3>
              <div className="stats-body">
                <div className="stat-item">
                  <span className="stat-label">GRID SHAPE</span>
                  <span className="stat-val highlight">
                    {terrainMesh.dimensions[0]} × {terrainMesh.dimensions[1]} cells
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">N-S / E-W RESOLUTION</span>
                  <span className="stat-val highlight">
                    {(terrainMesh.resolution_lat_m_per_px ?? terrainMesh.resolution_m_per_px).toFixed(1)} ×{' '}
                    {(terrainMesh.resolution_lon_m_per_px ?? terrainMesh.resolution_m_per_px).toFixed(1)} m/px
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">PHYSICAL ASPECT RATIO</span>
                  <span className="stat-val highlight">
                    {terrainMesh.aspect_ratio ? `${terrainMesh.aspect_ratio.toFixed(4)} (E-W scaled)` : '1.0000'}
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">MIN ELEVATION</span>
                  <span className="stat-val">
                    {terrainMesh.elevation_stats.min.toFixed(1)} m
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">MAX ELEVATION</span>
                  <span className="stat-val">
                    {terrainMesh.elevation_stats.max.toFixed(1)} m
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">ELEVATION RELIEF</span>
                  <span className="stat-val highlight">
                    {(
                      terrainMesh.elevation_stats.max - terrainMesh.elevation_stats.min
                    ).toFixed(1)}{' '}
                    m
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">MAX SLOPE</span>
                  <span className="stat-val" style={{ color: '#ff5252' }}>
                    {terrainMesh.slope_stats.max.toFixed(1)}°
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">MEAN SLOPE</span>
                  <span className="stat-val">
                    {terrainMesh.slope_stats.mean.toFixed(1)}°
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">COORDINATE SYSTEM</span>
                  <span className="stat-val">{terrainMesh.coordinate_system}</span>
                </div>
              </div>
            </div>

            <div className="provenance-card">
              <h3>DATA FUSION & PROVENANCE</h3>
              <div className="prov-item">
                <span className="prov-title">3D GEOMETRY ELEVATION SOURCE:</span>
                <p>
                  NASA Mars Global Surveyor (MGS) MOLA MEGDR 128 px/deg Topography release.
                  Referenced to the Mars Areoid gravity datum (GMM3).
                </p>
              </div>
              <div className="prov-item">
                <span className="prov-title">SURFACE TEXTURE DRAPING:</span>
                <p>
                  NASA Mars Trek Viking Color Mosaic MDIM 2.1 (232 m/px) georeferenced to the
                  exact sector bounding coordinates.
                </p>
              </div>
              <div className="prov-item">
                <span className="prov-title">SLOPE DERIVATION ALGORITHM:</span>
                <p className="code-text">
                  Slope = arctan( sqrt( (dz/dx)² + (dz/dy)² ) )
                </p>
                <p className="sub-note">
                  Adjusted for latitude-dependent meridian convergence on Mars.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Empty / Unacquired State Card */
        <div className="unacquired-exploration-card">
          <div className="unacquired-hero">
            <span className="unacquired-icon">🛰️</span>
            <h3>HIGH-RESOLUTION 3D TERRAIN RECONSTRUCTION REQUIRED</h3>
            <p>
              This sector currently has no local 3D elevation mesh or georeferenced surface
              texture generated. With one click, RED PLANET LAB will automatically search the
              NASA Planetary Data System (PDS) archives, download the 128 px/deg MOLA elevation
              model and Viking surface mosaic for this bounding box, and reconstruct the
              scientific 3D terrain environment.
            </p>
            <div className="unacquired-meta-pills">
              <span className="meta-pill">MOLA MEGDR 128 px/deg (463 m/px)</span>
              <span className="meta-pill">Viking MDIM 2.1 Color Mosaic (232 m/px)</span>
              <span className="meta-pill">Targeted Sector Size: ~3.2 MB</span>
            </div>
            {error && <div className="error-banner">⚠️ {error}</div>}
            <button
              className="btn btn-glow btn-lg"
              onClick={handleStartExploration}
              disabled={loading}
            >
              {loading ? 'INITIALIZING LINK...' : 'INITIATE ON-DEMAND ACQUISITION & 3D RECONSTRUCTION ➔'}
            </button>
          </div>
        </div>
      )}

      {/* Background Acquisition Telemetry HUD Modal */}
      {isAcquiring && activeJobId && (
        <AcquisitionModal
          jobId={activeJobId}
          sectorName={sector.name}
          onComplete={handleAcquisitionComplete}
          onCancel={() => {
            setIsAcquiring(false);
            setActiveJobId(null);
          }}
        />
      )}

      {/* In-Situ NASA Surface Photo Modal (Ground-to-Orbit Fusion) */}
      {selectedPhoto && (
        <div className="surface-photo-modal-overlay" onClick={() => setSelectedPhoto(null)}>
          <div className="surface-photo-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-group">
                <span className="modal-tag">NASA IN-SITU SURFACE OBSERVATION</span>
                <h3>{selectedPhoto.target_name}</h3>
                <span className="photo-coords">
                  {selectedPhoto.lat.toFixed(4)}°N, {selectedPhoto.lon.toFixed(4)}°E • Sol {selectedPhoto.sol} ({selectedPhoto.earth_date})
                </span>
              </div>
              <button className="modal-close-btn" onClick={() => setSelectedPhoto(null)}>✕</button>
            </div>
            <div className="modal-photo-container">
              <img src={selectedPhoto.image_url} alt={selectedPhoto.target_name} className="surface-photo-img" />
            </div>
            <div className="modal-caption-bar">
              <div className="cap-meta">
                <span>ROVER: <strong>{selectedPhoto.rover_name}</strong></span>
                <span>INSTRUMENT: <strong>{selectedPhoto.instrument}</strong></span>
                <span>OPTICS: <strong>{selectedPhoto.filter_or_camera}</strong></span>
              </div>
              <p className="cap-text">{selectedPhoto.caption}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
