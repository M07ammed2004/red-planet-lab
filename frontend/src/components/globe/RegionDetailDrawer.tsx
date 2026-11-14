import React from 'react';
import type { MarsRegion, UsgsMartianLandmark } from '../../types/globe';
import type { Sector } from '../../types/api';

export type SelectedDrawerItem =
  | { type: 'region'; data: MarsRegion; sector?: Sector | null }
  | { type: 'landmark'; data: UsgsMartianLandmark; sector?: Sector | null };

interface RegionDetailDrawerProps {
  selectedItem: SelectedDrawerItem | null;
  onClose: () => void;
  onStartAcquisition: (region: MarsRegion) => void;
  onEnterTerrain: (region: MarsRegion) => void;
  onSelectSectorById?: (sectorId: string) => void;
}

export const RegionDetailDrawer: React.FC<RegionDetailDrawerProps> = ({
  selectedItem,
  onClose,
  onStartAcquisition,
  onEnterTerrain,
  onSelectSectorById,
}) => {
  if (!selectedItem) return null;

  if (selectedItem.type === 'region') {
    const region = selectedItem.data;
    const sectorState = selectedItem.sector;
    const isDiscovered = sectorState?.state === 'DISCOVERED';
    const isPartially = sectorState?.state === 'PARTIALLY_DISCOVERED';

    return (
      <div className="region-drawer">
        <div className="drawer-header">
          <div>
            <span className="drawer-tag">ORBITAL EXPLORATION SECTOR</span>
            <h2 className="drawer-title">{region.name}</h2>
            <span className="drawer-type" style={{ color: region.color }}>
              {region.featureType}
            </span>
          </div>
          <button className="drawer-close-btn" onClick={onClose} title="Close drawer">✕</button>
        </div>

        <div className="drawer-body">
          {/* Sector State Banner */}
          <div className="drawer-status-box">
            <span className="box-label">RECONNAISSANCE STATE</span>
            <div className="status-row">
              <span
                className="status-dot"
                style={{
                  backgroundColor: isDiscovered
                    ? '#00e676'
                    : isPartially
                    ? '#ffab00'
                    : '#8892b0',
                }}
              ></span>
              <span className="status-text">
                {isDiscovered
                  ? 'SCOUTED / 3D RECONSTRUCTED (MOLA 128 + VIKING)'
                  : 'UNMAPPED / DORMANT VOID (RAW ARCHIVES)'}
              </span>
            </div>
          </div>

          {/* Coordinates Grid */}
          <div className="drawer-coords-grid">
            <div className="coord-box">
              <span className="c-label">CENTER LATITUDE</span>
              <span className="c-val">{region.center[0].toFixed(4)}° N</span>
            </div>
            <div className="coord-box">
              <span className="c-label">CENTER LONGITUDE</span>
              <span className="c-val">{region.center[1].toFixed(4)}° E</span>
            </div>
            <div className="coord-box">
              <span className="c-label">LATITUDE BOUNDS</span>
              <span className="c-val">[{region.bounds.min_lat.toFixed(2)}°, {region.bounds.max_lat.toFixed(2)}°]</span>
            </div>
            <div className="coord-box">
              <span className="c-label">LONGITUDE BOUNDS</span>
              <span className="c-val">[{region.bounds.min_lon.toFixed(2)}°, {region.bounds.max_lon.toFixed(2)}°]</span>
            </div>
            <div className="coord-box">
              <span className="c-label">SURFACE FOOTPRINT</span>
              <span className="c-val">{region.area_km2.toLocaleString()} km²</span>
            </div>
            <div className="coord-box">
              <span className="c-label">USGS QUADRANGLE</span>
              <span className="c-val">{region.usgsQuadrangle || 'IAU Mars 1:5M'}</span>
            </div>
          </div>

          <div className="drawer-section">
            <h4>SCIENTIFIC CONTEXT</h4>
            <p className="section-text">{region.description}</p>
          </div>

          <div className="drawer-section">
            <h4>MISSION & DATA HISTORY</h4>
            <p className="section-text">{region.missionContext}</p>
          </div>

          {!isDiscovered && (
            <div className="archive-notice">
              <span className="notice-icon">🛰️</span>
              <div>
                <span className="notice-title">DATA STATUS: UNMAPPED</span>
                <p className="notice-desc">
                  This sector footprint is currently dormant on the global map. Initiating retrieval will download
                  the 128 px/deg MOLA elevation grid and drape the Viking mosaic into the 3D globe.
                </p>
              </div>
            </div>
          )}

          <div className="drawer-actions">
            {isDiscovered ? (
              <button className="btn btn-glow full-width" onClick={() => onEnterTerrain(region)}>
                EXPLORE 3D LOCAL TERRAIN ➔
              </button>
            ) : (
              <button className="btn btn-primary full-width" onClick={() => onStartAcquisition(region)}>
                INITIATE ORBITAL RETRIEVAL ➔
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Landmark View (USGS IAU Nomenclature)
  const landmark = selectedItem.data;
  return (
    <div className="region-drawer">
      <div className="drawer-header">
        <div>
          <span className="drawer-tag">USGS / IAU GAZETTEER LANDMARK</span>
          <h2 className="drawer-title">{landmark.name}</h2>
          <span className="drawer-type" style={{ color: landmark.color }}>
            {landmark.categoryLabel}
          </span>
        </div>
        <button className="drawer-close-btn" onClick={onClose} title="Close drawer">✕</button>
      </div>

      <div className="drawer-body">
        <div className="drawer-status-box">
          <span className="box-label">FEATURE CATEGORY</span>
          <div className="status-row">
            <span className="status-dot" style={{ backgroundColor: landmark.color }}></span>
            <span className="status-text">{landmark.categoryLabel}</span>
          </div>
        </div>

        <div className="drawer-coords-grid">
          <div className="coord-box">
            <span className="c-label">EXACT IAU LATITUDE</span>
            <span className="c-val highlight">{landmark.center[0].toFixed(4)}° N</span>
          </div>
          <div className="coord-box">
            <span className="c-label">EXACT IAU LONGITUDE</span>
            <span className="c-val highlight">{landmark.center[1].toFixed(4)}° E</span>
          </div>
          {landmark.diameter_km !== undefined && (
            <div className="coord-box">
              <span className="c-label">DIAMETER</span>
              <span className="c-val">{landmark.diameter_km.toLocaleString()} km</span>
            </div>
          )}
          {landmark.length_km !== undefined && (
            <div className="coord-box">
              <span className="c-label">FEATURE LENGTH</span>
              <span className="c-val">{landmark.length_km.toLocaleString()} km</span>
            </div>
          )}
          {landmark.elevation_m !== undefined && (
            <div className="coord-box">
              <span className="c-label">AREOID ELEVATION</span>
              <span className="c-val">
                {landmark.elevation_m > 0 ? `+${landmark.elevation_m.toLocaleString()}` : landmark.elevation_m.toLocaleString()} m
              </span>
            </div>
          )}
          <div className="coord-box">
            <span className="c-label">USGS QUADRANGLE</span>
            <span className="c-val">{landmark.usgsQuadrangle}</span>
          </div>
        </div>

        <div className="drawer-section">
          <h4>GEOLOGICAL MORPHOLOGY</h4>
          <p className="section-text">{landmark.description}</p>
        </div>

        <div className="drawer-section">
          <h4>EXPLORATION & SCIENTIFIC VALUE</h4>
          <p className="section-text">{landmark.scientificContext}</p>
        </div>

        {landmark.sectorId && (
          <div className="archive-notice">
            <span className="notice-icon">🛰️</span>
            <div>
              <span className="notice-title">3D TERRAIN SECTOR AVAILABLE</span>
              <p className="notice-desc">
                This landmark is covered by a high-resolution 3D reconstruction sector. You can explore its elevation and slopes directly.
              </p>
            </div>
          </div>
        )}

        {landmark.sectorId && onSelectSectorById && (
          <div className="drawer-actions">
            <button
              className="btn btn-glow full-width"
              onClick={() => onSelectSectorById(landmark.sectorId!)}
            >
              OPEN HIGH-RES 3D SECTOR ➔
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
