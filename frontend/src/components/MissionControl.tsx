import React, { useState } from 'react';
import type { RouteComparisonResponse, RouteResult, Sector } from '../types/api';
import { planMissionRoutes } from '../services/api';

interface MissionControlProps {
  sector: Sector | null;
}

export const MissionControl: React.FC<MissionControlProps> = ({ sector }) => {
  const defaultStartLat = sector ? Number((sector.bounds.max_lat - 0.15).toFixed(2)) : 18.85;
  const defaultStartLon = sector ? Number((sector.bounds.min_lon + 0.15).toFixed(2)) : 77.15;
  const defaultDestLat = sector ? Number((sector.bounds.min_lat + 0.15).toFixed(2)) : 18.15;
  const defaultDestLon = sector ? Number((sector.bounds.max_lon - 0.15).toFixed(2)) : 77.85;

  const [startLat, setStartLat] = useState<number>(defaultStartLat);
  const [startLon, setStartLon] = useState<number>(defaultStartLon);
  const [destLat, setDestLat] = useState<number>(defaultDestLat);
  const [destLon, setDestLon] = useState<number>(defaultDestLon);
  const [maxSlope, setMaxSlope] = useState<number>(15.0);

  const [planning, setPlanning] = useState<boolean>(false);
  const [result, setResult] = useState<RouteComparisonResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePlanRoutes = async () => {
    if (!sector) return;
    setPlanning(true);
    setError(null);
    try {
      const res = await planMissionRoutes({
        sector_id: sector.sector_id,
        start_coords: [startLat, startLon],
        destination_coords: [destLat, destLon],
        max_traversable_slope_deg: maxSlope,
        strategies: ['FASTEST', 'SAFEST'],
      });
      setResult(res);
    } catch (err: any) {
      setError(err.message || 'Route planning failed');
    } finally {
      setPlanning(false);
    }
  };

  const renderElevationChart = (fastest: RouteResult | undefined, safest: RouteResult | undefined) => {
    const fProfile = fastest?.elevation_profile || [];
    const sProfile = safest?.elevation_profile || [];
    if (fProfile.length === 0 && sProfile.length === 0) return null;

    const allVals = [...fProfile, ...sProfile];
    const minElev = Math.min(...allVals);
    const maxElev = Math.max(...allVals);
    const elevRange = Math.max(maxElev - minElev, 10.0);

    const svgWidth = 600;
    const svgHeight = 160;
    const pad = 25;

    const createPathD = (profile: number[]) => {
      if (profile.length < 2) return '';
      return profile
        .map((val, idx) => {
          const x = pad + (idx / (profile.length - 1)) * (svgWidth - 2 * pad);
          const y = svgHeight - pad - ((val - minElev) / elevRange) * (svgHeight - 2 * pad);
          return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
        })
        .join(' ');
    };

    return (
      <div className="chart-wrapper">
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="elevation-chart-svg">
          {/* Axis guides */}
          <line x1={pad} y1={pad} x2={pad} y2={svgHeight - pad} stroke="#444" strokeWidth="1" />
          <line x1={pad} y1={svgHeight - pad} x2={svgWidth - pad} y2={svgHeight - pad} stroke="#444" strokeWidth="1" />

          {/* Grid lines */}
          <line x1={pad} y1={(pad + svgHeight - pad) / 2} x2={svgWidth - pad} y2={(pad + svgHeight - pad) / 2} stroke="#333" strokeDasharray="3 3" />

          {/* Labels */}
          <text x={pad + 5} y={pad + 12} fill="#888" fontSize="10">{maxElev.toFixed(0)}m</text>
          <text x={pad + 5} y={svgHeight - pad - 5} fill="#888" fontSize="10">{minElev.toFixed(0)}m</text>

          {/* Fastest Route Profile (Cyan) */}
          {fProfile.length > 0 && (
            <path d={createPathD(fProfile)} fill="none" stroke="#00e5ff" strokeWidth="2.5" />
          )}

          {/* Safest Route Profile (Emerald Green) */}
          {sProfile.length > 0 && (
            <path d={createPathD(sProfile)} fill="none" stroke="#00e676" strokeWidth="2.5" strokeDasharray="4 2" />
          )}
        </svg>

        <div className="chart-legend">
          <div className="legend-item"><span className="color-bar cyan"></span> FASTEST ROUTE PROFILE</div>
          <div className="legend-item"><span className="color-bar green"></span> SAFEST ROUTE PROFILE</div>
        </div>
      </div>
    );
  };

  if (!sector) {
    return (
      <div className="empty-state">
        <p>No sector selected. Please select a sector from Mars Overview.</p>
      </div>
    );
  }

  const fastest = result?.routes.FASTEST;
  const safest = result?.routes.SAFEST;

  return (
    <div className="mission-container">
      <div className="mission-sidebar">
        <div className="panel-title-bar">
          <h3>MISSION TRAVERSE CONFIG</h3>
          <span className="count-tag">A* ENGINE</span>
        </div>

        <div className="config-form">
          <div className="coords-group">
            <span className="group-label">START POINT (DEGREES)</span>
            <div className="input-row">
              <label>Lat:</label>
              <input
                type="number"
                step="0.05"
                value={startLat}
                onChange={(e) => setStartLat(parseFloat(e.target.value))}
              />
              <label>Lon:</label>
              <input
                type="number"
                step="0.05"
                value={startLon}
                onChange={(e) => setStartLon(parseFloat(e.target.value))}
              />
            </div>
          </div>

          <div className="coords-group">
            <span className="group-label">DESTINATION POINT (DEGREES)</span>
            <div className="input-row">
              <label>Lat:</label>
              <input
                type="number"
                step="0.05"
                value={destLat}
                onChange={(e) => setDestLat(parseFloat(e.target.value))}
              />
              <label>Lon:</label>
              <input
                type="number"
                step="0.05"
                value={destLon}
                onChange={(e) => setDestLon(parseFloat(e.target.value))}
              />
            </div>
          </div>

          <div className="slider-group">
            <div className="slider-label-row">
              <span>MAX TRAVERSABLE SLOPE</span>
              <span className="slider-val">{maxSlope.toFixed(1)}°</span>
            </div>
            <input
              type="range"
              min="5"
              max="30"
              step="1"
              value={maxSlope}
              onChange={(e) => setMaxSlope(parseFloat(e.target.value))}
              className="slider"
            />
            <span className="slider-hint">Hard constraint: Cells steeper than this threshold are blocked.</span>
          </div>

          <button
            className="btn btn-primary full-width"
            disabled={planning}
            onClick={handlePlanRoutes}
          >
            {planning ? 'COMPUTING ROUTES...' : 'CALCULATE MISSION ROUTES'}
          </button>
        </div>

        {error && (
          <div className="error-card">
            <p>⚠️ {error}</p>
          </div>
        )}

        <div className="limitations-card">
          <h4>ENGINEERING CAVEATS</h4>
          <p>
            Routes represent regional navigation paths derived from orbital MOLA topographic grids. Ground-level boulders and sand traps require rover-level visual odometry.
          </p>
        </div>
      </div>

      <div className="mission-main">
        {result ? (
          <div className="results-panel">
            <div className="comparison-banner">
              <h3>MISSION TRADE-OFF EVALUATION</h3>
              <p className="summary-text">{result.summary}</p>
            </div>

            <div className="routes-comparison-grid">
              {/* FASTEST ROUTE */}
              <div className="route-card fastest-card">
                <div className="route-card-header">
                  <span className="strategy-tag cyan">STRATEGY 1: FASTEST</span>
                  <h4>Distance Minimization</h4>
                </div>
                {fastest?.feasible ? (
                  <div className="route-stats">
                    <div className="stat-metric">
                      <span className="metric-label">TOTAL DISTANCE</span>
                      <span className="metric-val">{fastest.total_distance_km} km</span>
                    </div>
                    <div className="stat-metric">
                      <span className="metric-label">AVERAGE SLOPE</span>
                      <span className="metric-val">{fastest.avg_slope_deg}°</span>
                    </div>
                    <div className="stat-metric">
                      <span className="metric-label">MAX SLOPE</span>
                      <span className="metric-val">{fastest.max_slope_deg}°</span>
                    </div>
                    <div className="stat-metric">
                      <span className="metric-label">ELEVATION DELTA</span>
                      <span className="metric-val">{fastest.elevation_change_m} m</span>
                    </div>
                    <p className="route-explanation">{fastest.explanation}</p>
                  </div>
                ) : (
                  <div className="infeasible-msg">
                    <p>⚠️ Infeasible: {fastest?.explanation}</p>
                  </div>
                )}
              </div>

              {/* SAFEST ROUTE */}
              <div className="route-card safest-card">
                <div className="route-card-header">
                  <span className="strategy-tag green">STRATEGY 2: SAFEST</span>
                  <h4>Risk & Hazard Minimization</h4>
                </div>
                {safest?.feasible ? (
                  <div className="route-stats">
                    <div className="stat-metric">
                      <span className="metric-label">TOTAL DISTANCE</span>
                      <span className="metric-val">{safest.total_distance_km} km</span>
                    </div>
                    <div className="stat-metric">
                      <span className="metric-label">AVERAGE SLOPE</span>
                      <span className="metric-val highlight-green">{safest.avg_slope_deg}°</span>
                    </div>
                    <div className="stat-metric">
                      <span className="metric-label">MAX SLOPE</span>
                      <span className="metric-val highlight-green">{safest.max_slope_deg}°</span>
                    </div>
                    <div className="stat-metric">
                      <span className="metric-label">ELEVATION DELTA</span>
                      <span className="metric-val">{safest.elevation_change_m} m</span>
                    </div>
                    <p className="route-explanation">{safest.explanation}</p>
                  </div>
                ) : (
                  <div className="infeasible-msg">
                    <p>⚠️ Infeasible: {safest?.explanation}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="elevation-profile-card">
              <h4>TRANSVERSE ELEVATION PROFILES</h4>
              {renderElevationChart(fastest, safest)}
            </div>

            {safest && safest.waypoints.length > 0 && (
              <div className="waypoints-card">
                <h4>WAYPOINT NAVIGATION LOG (SAFEST TRAVERSE)</h4>
                <div className="table-responsive">
                  <table className="waypoints-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>LATITUDE</th>
                        <th>LONGITUDE</th>
                        <th>ELEVATION</th>
                        <th>SLOPE</th>
                        <th>RISK</th>
                        <th>DISTANCE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {safest.waypoints.slice(0, 15).map((wp, idx) => (
                        <tr key={idx}>
                          <td>{idx + 1}</td>
                          <td>{wp.lat}°N</td>
                          <td>{wp.lon}°E</td>
                          <td>{wp.elevation_m} m</td>
                          <td>{wp.slope_deg}°</td>
                          <td>{wp.risk_score}</td>
                          <td>{wp.cumulative_distance_km} km</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {safest.waypoints.length > 15 && (
                    <p className="table-footnote">Showing first 15 of {safest.waypoints.length} total traverse waypoints.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="empty-state">
            <span className="empty-icon">🛰️</span>
            <h3>MISSION ROUTING ENGINE READY</h3>
            <p>Configure coordinates and maximum slope threshold on the left panel, then click "Calculate Mission Routes".</p>
          </div>
        )}
      </div>
    </div>
  );
};
