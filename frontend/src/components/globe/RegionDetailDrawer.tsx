import React from 'react';
import type { MarsRegion } from '../../types/globe';
import type { Sector } from '../../types/api';

interface RegionDetailDrawerProps {
  region: MarsRegion | null;
  sectorState: Sector | null;
  onClose: () => void;
  onStartAcquisition: (region: MarsRegion) => void;
  onEnterTerrain: (region: MarsRegion) => void;
}

export const RegionDetailDrawer: React.FC<RegionDetailDrawerProps> = ({
  region,
  sectorState,
  onClose,
  onStartAcquisition,
  onEnterTerrain,
}) => {
  if (!region) return null;

  const isDiscovered = sectorState?.state === 'DISCOVERED';
  const isPartially = sectorState?.state === 'PARTIALLY_DISCOVERED';
  const hasDataFound = sectorState?.state === 'DATA_FOUND';

  return (
    <div className="region-drawer">
      <div className="drawer-header">
        <div>
          <span className="drawer-tag">ORBITAL SECTOR SPECIFICATION</span>
          <h2 className="drawer-title">{region.name}</h2>
          <span className="drawer-type" style={{ color: region.color }}>
            {region.featureType}
          </span>
        </div>
        <button className="drawer-close-btn" onClick={onClose} title="Deselect region">
          ✕
        </button>
      </div>

      <div className="drawer-body">
        {/* State Status Banner */}
        <div className="drawer-status-box">
          <span className="box-label">SECTOR STATE</span>
          <div className="status-row">
            <span
              className="status-dot"
              style={{
                backgroundColor: isDiscovered
                  ? '#00e676'
                  : isPartially
                  ? '#ffab00'
                  : hasDataFound
                  ? '#00e5ff'
                  : '#8892b0',
              }}
            ></span>
            <span className="status-text">
              {sectorState ? sectorState.state.replace('_', ' ') : 'UNSCOUTED (RAW ARCHIVES)'}
            </span>
          </div>
        </div>

        {/* Geographic Coordinates Grid */}
        <div className="drawer-coords-grid">
          <div className="coord-box">
            <span className="c-label">CENTER LATITUDE</span>
            <span className="c-val">{region.center[0].toFixed(2)}° N</span>
          </div>
          <div className="coord-box">
            <span className="c-label">CENTER LONGITUDE</span>
            <span className="c-val">{region.center[1].toFixed(2)}° E</span>
          </div>
          <div className="coord-box">
            <span className="c-label">LATITUDE BOUNDS</span>
            <span className="c-val">[{region.bounds.min_lat.toFixed(1)}°, {region.bounds.max_lat.toFixed(1)}°]</span>
          </div>
          <div className="coord-box">
            <span className="c-label">LONGITUDE BOUNDS</span>
            <span className="c-val">[{region.bounds.min_lon.toFixed(1)}°, {region.bounds.max_lon.toFixed(1)}°]</span>
          </div>
          <div className="coord-box">
            <span className="c-label">SURFACE EXTENT</span>
            <span className="c-val">{region.area_km2.toLocaleString()} km²</span>
          </div>
          <div className="coord-box">
            <span className="c-label">COORDINATE SYSTEM</span>
            <span className="c-val">IAU2000:49900</span>
          </div>
        </div>

        {/* Science & Mission Context */}
        <div className="drawer-section">
          <h4>SCIENTIFIC CONTEXT</h4>
          <p className="section-text">{region.description}</p>
        </div>

        <div className="drawer-section">
          <h4>MISSION & SATELLITE HISTORY</h4>
          <p className="section-text">{region.missionContext}</p>
        </div>

        {/* Pipeline Guidance Note */}
        {!isDiscovered && (
          <div className="archive-notice">
            <span className="notice-icon">🛰️</span>
            <div>
              <span className="notice-title">DATA STATUS: UNPROCESSED</span>
              <p className="notice-desc">
                Scientific DEM terrain and high-resolution slope layers have not been loaded yet.
                Clicking below will initiate the automated selective retrieval for this bounding sector only.
              </p>
            </div>
          </div>
        )}

        {/* Action Controls */}
        <div className="drawer-actions">
          {isDiscovered ? (
            <button className="btn btn-glow full-width" onClick={() => onEnterTerrain(region)}>
              ENTER 3D LOCAL TERRAIN ➔
            </button>
          ) : (
            <button
              className="btn btn-primary full-width"
              onClick={() => onStartAcquisition(region)}
            >
              INITIALIZE ORBITAL RETRIEVAL
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
