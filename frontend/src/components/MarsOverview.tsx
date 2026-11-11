import React, { useState } from 'react';
import type { Sector } from '../types/api';
import { downloadSectorDem, processSectorDem, scanSector } from '../services/api';

interface MarsOverviewProps {
  sectors: Sector[];
  selectedSector: Sector | null;
  onSelectSector: (sector: Sector) => void;
  onRefreshSectors: () => Promise<void>;
  onNavigateToExploration: () => void;
}

export const MarsOverview: React.FC<MarsOverviewProps> = ({
  sectors,
  selectedSector,
  onSelectSector,
  onRefreshSectors,
  onNavigateToExploration,
}) => {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'info' | 'error' | 'success'; text: string } | null>(null);

  const handleScan = async (sectorId: string) => {
    setLoadingAction('scan');
    setFeedbackMessage({ type: 'info', text: 'Scanning NASA PDS & ODE archives for orbital products...' });
    try {
      await scanSector(sectorId);
      await onRefreshSectors();
      setFeedbackMessage({ type: 'success', text: 'Archive discovery complete! Suitable orbital products identified.' });
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Scan failed' });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDownload = async (sectorId: string) => {
    setLoadingAction('download');
    setFeedbackMessage({ type: 'info', text: 'Retrieving MOLA MEGDR elevation raster and PDS labels...' });
    try {
      await downloadSectorDem(sectorId);
      await onRefreshSectors();
      setFeedbackMessage({ type: 'success', text: 'Elevation dataset downloaded and validated into raw partitioned cache.' });
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Download failed' });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleProcess = async (sectorId: string) => {
    setLoadingAction('process');
    setFeedbackMessage({ type: 'info', text: 'Calculating slope, roughness, and exporting visual layers...' });
    try {
      await processSectorDem(sectorId);
      await onRefreshSectors();
      setFeedbackMessage({ type: 'success', text: 'Sector fully discovered! Slope and elevation layers generated.' });
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Processing failed' });
    } finally {
      setLoadingAction(null);
    }
  };

  const getStateBadgeClass = (state: string) => {
    switch (state) {
      case 'DISCOVERED':
        return 'badge-discovered';
      case 'PARTIALLY_DISCOVERED':
        return 'badge-partially';
      case 'DATA_FOUND':
        return 'badge-data-found';
      case 'SCANNING':
      case 'DOWNLOADING':
      case 'PROCESSING':
        return 'badge-active';
      case 'FAILED':
        return 'badge-failed';
      default:
        return 'badge-unscouted';
    }
  };

  return (
    <div className="overview-container">
      <div className="overview-sidebar">
        <div className="section-title-bar">
          <h3>ORBITAL SECTOR GRID</h3>
          <span className="count-tag">{sectors.length} REGIONS</span>
        </div>

        <div className="sector-list">
          {sectors.map((sec) => (
            <div
              key={sec.sector_id}
              className={`sector-card ${selectedSector?.sector_id === sec.sector_id ? 'selected' : ''}`}
              onClick={() => onSelectSector(sec)}
            >
              <div className="card-top">
                <span className="sector-id">{sec.sector_id}</span>
                <span className={`state-badge ${getStateBadgeClass(sec.state)}`}>
                  {sec.state.replace('_', ' ')}
                </span>
              </div>
              <h4 className="sector-name">{sec.name}</h4>
              <div className="card-details">
                <span>Coord: {sec.center[0].toFixed(2)}°N, {sec.center[1].toFixed(2)}°E</span>
                <span>Area: {sec.area_km2.toLocaleString()} km²</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="overview-main">
        {selectedSector ? (
          <div className="sector-detail-panel">
            <div className="detail-header">
              <div>
                <span className="detail-tag">TARGET SPECIFICATION</span>
                <h2>{selectedSector.name}</h2>
                <span className="detail-crs">CRS: {selectedSector.coordinate_reference_system} (Mars Sphere R=3,396 km)</span>
              </div>
              <div className="state-large-badge">
                <span className="label">STATUS</span>
                <span className={`badge-pill ${getStateBadgeClass(selectedSector.state)}`}>
                  {selectedSector.state.replace('_', ' ')}
                </span>
              </div>
            </div>

            {feedbackMessage && (
              <div className={`feedback-alert ${feedbackMessage.type}`}>
                <span className="alert-icon">
                  {feedbackMessage.type === 'error' ? '⚠️' : feedbackMessage.type === 'success' ? '✅' : 'ℹ️'}
                </span>
                <span>{feedbackMessage.text}</span>
              </div>
            )}

            <div className="grid-meta-row">
              <div className="meta-box">
                <span className="label">BOUNDING LATITUDE</span>
                <span className="val">[{selectedSector.bounds.min_lat.toFixed(2)}°, {selectedSector.bounds.max_lat.toFixed(2)}°]</span>
              </div>
              <div className="meta-box">
                <span className="label">BOUNDING LONGITUDE</span>
                <span className="val">[{selectedSector.bounds.min_lon.toFixed(2)}°, {selectedSector.bounds.max_lon.toFixed(2)}°]</span>
              </div>
              <div className="meta-box">
                <span className="label">ACTIVE LAYERS</span>
                <span className="val">
                  {selectedSector.available_layers.length > 0
                    ? selectedSector.available_layers.join(', ').toUpperCase()
                    : 'NONE'}
                </span>
              </div>
              <div className="meta-box">
                <span className="label">DOWNLOAD FOOTPRINT</span>
                <span className="val">
                  {(selectedSector.estimated_download_bytes / (1024 * 1024)).toFixed(2)} MB
                </span>
              </div>
            </div>

            <div className="pipeline-actions-card">
              <h4>AUTOMATED PIPELINE CONTROLS</h4>
              <p className="pipeline-desc">
                Execute end-to-end data acquisition and terrain synthesis without manual file operations.
              </p>

              <div className="action-buttons-group">
                <button
                  className="btn btn-primary"
                  disabled={loadingAction !== null}
                  onClick={() => handleScan(selectedSector.sector_id)}
                >
                  {loadingAction === 'scan' ? 'SCANNING ARCHIVES...' : '1. SCAN ORBITAL ARCHIVES'}
                </button>

                <button
                  className="btn btn-secondary"
                  disabled={
                    loadingAction !== null ||
                    (selectedSector.state === 'UNSCOUTED' && selectedSector.source_products.length === 0)
                  }
                  onClick={() => handleDownload(selectedSector.sector_id)}
                >
                  {loadingAction === 'download' ? 'DOWNLOADING...' : '2. RETRIEVE TOPOGRAPHY DEM'}
                </button>

                <button
                  className="btn btn-accent"
                  disabled={
                    loadingAction !== null ||
                    !['DATA_FOUND', 'PARTIALLY_DISCOVERED', 'DISCOVERED'].includes(selectedSector.state)
                  }
                  onClick={() => handleProcess(selectedSector.sector_id)}
                >
                  {loadingAction === 'process' ? 'PROCESSING...' : '3. PROCESS SCIENTIFIC LAYERS'}
                </button>
              </div>
            </div>

            {selectedSector.source_products && selectedSector.source_products.length > 0 && (
              <div className="products-table-card">
                <h4>DISCOVERED ORBITAL ARCHIVE PRODUCTS</h4>
                <div className="table-responsive">
                  <table className="products-table">
                    <thead>
                      <tr>
                        <th>PRODUCT ID</th>
                        <th>MISSION / INSTRUMENT</th>
                        <th>TYPE</th>
                        <th>RESOLUTION</th>
                        <th>EST. SIZE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedSector.source_products.map((p) => (
                        <tr key={p.product_id}>
                          <td className="mono">{p.product_id}</td>
                          <td>{p.mission} / {p.instrument}</td>
                          <td><span className="tag-type">{p.product_type}</span></td>
                          <td>{p.pixel_scale_meters ? `${p.pixel_scale_meters} m/px` : 'N/A'}</td>
                          <td>{(p.estimated_download_bytes / 1024).toFixed(0)} KB</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {selectedSector.state === 'DISCOVERED' && (
              <div className="ready-banner">
                <div className="banner-text">
                  <h3>✅ Sector Terrain Synthesis Ready</h3>
                  <p>Elevation and slope layers are fully processed and ready for interactive exploration and mission routing.</p>
                </div>
                <button className="btn btn-glow" onClick={onNavigateToExploration}>
                  LAUNCH SECTOR EXPLORATION ➔
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="empty-state">
            <p>Select an exploration sector from the left panel to begin.</p>
          </div>
        )}
      </div>
    </div>
  );
};
