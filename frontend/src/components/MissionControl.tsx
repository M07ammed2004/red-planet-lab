import React, { useEffect, useState } from 'react';
import type {
  RouteComparisonResponse,
  RouteResult,
  RoverMissionTraverse,
  Sector,
  SectorWeatherCondition,
  StormSeverity,
  TerrainMesh,
} from '../types/api';
import {
  fetchRoverBenchmarkTraverse,
  fetchSectorWeather,
  fetchTerrainMesh,
  planMissionRoutes,
  simulateSectorWeather,
} from '../services/api';
import { ThreeTerrainView, type TerrainLayerMode } from './terrain/ThreeTerrainView';

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

  // 3D Terrain State
  const [terrainMesh, setTerrainMesh] = useState<TerrainMesh | null>(null);
  const [loadingMesh, setLoadingMesh] = useState<boolean>(false);
  const [layerMode, setLayerMode] = useState<TerrainLayerMode>('slope');
  const [verticalExaggeration, setVerticalExaggeration] = useState<number>(1.8);
  const [wireframe, setWireframe] = useState<boolean>(false);
  const [pickingMode, setPickingMode] = useState<'start' | 'dest' | null>(null);
  const [showNasaTraverse, setShowNasaTraverse] = useState<boolean>(true);
  const [nasaBenchmark, setNasaBenchmark] = useState<RoverMissionTraverse | null>(null);
  const [selectedWaypointStrategy, setSelectedWaypointStrategy] = useState<'SCIENTIFIC_EXPLORATION' | 'SAFEST' | 'FASTEST'>('SCIENTIFIC_EXPLORATION');

  // Atmospheric & Storm Simulation State
  const [weather, setWeather] = useState<SectorWeatherCondition | null>(null);
  const [stormSeverity, setStormSeverity] = useState<StormSeverity>('CALM');
  const [showStormLayer, setShowStormLayer] = useState<boolean>(true);
  const [updatingWeather, setUpdatingWeather] = useState<boolean>(false);

  // Load 3D Terrain, NASA Benchmark & Weather when sector changes
  useEffect(() => {
    if (!sector) return;
    setLoadingMesh(true);
    setError(null);
    setResult(null);

    Promise.allSettled([
      fetchTerrainMesh(sector.sector_id),
      fetchRoverBenchmarkTraverse(sector.sector_id),
      fetchSectorWeather(sector.sector_id),
    ])
      .then(([meshRes, benchRes, weatherRes]) => {
        if (meshRes.status === 'fulfilled' && meshRes.value) {
          setTerrainMesh(meshRes.value);
        } else {
          setTerrainMesh(null);
        }
        if (benchRes.status === 'fulfilled' && benchRes.value) {
          setNasaBenchmark(benchRes.value);
        } else {
          setNasaBenchmark(null);
        }
        if (weatherRes.status === 'fulfilled' && weatherRes.value) {
          setWeather(weatherRes.value);
          setStormSeverity(weatherRes.value.storm_severity);
        } else {
          setWeather(null);
        }
      })
      .catch((err) => {
        console.warn('Error loading sector initial data:', err);
      })
      .finally(() => {
        setLoadingMesh(false);
      });
  }, [sector?.sector_id]);

  const handleToggleStorm = async (sev: StormSeverity) => {
    if (!sector) return;
    setUpdatingWeather(true);
    try {
      const updated = await simulateSectorWeather(sector.sector_id, sev);
      setWeather(updated);
      setStormSeverity(sev);

      // Automatically recalculate routes to immediately show storm avoidance
      const res = await planMissionRoutes({
        sector_id: sector.sector_id,
        start_coords: [startLat, startLon],
        destination_coords: [destLat, destLon],
        max_traversable_slope_deg: maxSlope,
        strategies: ['FASTEST', 'SAFEST', 'SCIENTIFIC_EXPLORATION'],
      });
      setResult(res);
    } catch (err: any) {
      console.warn('Weather update or re-routing note:', err);
    } finally {
      setUpdatingWeather(false);
    }
  };

  const handleLoadNasaBenchmark = () => {
    if (!sector) return;
    if (sector.sector_id === 'SEC-JEZERO-01') {
      setStartLat(18.4447);
      setStartLon(77.4508);
      setDestLat(18.4890);
      setDestLon(77.3650);
      setMaxSlope(15.0);
    } else if (sector.sector_id === 'SEC-GALE-01') {
      setStartLat(-4.5895);
      setStartLon(137.4417);
      setDestLat(-4.8120);
      setDestLon(137.3850);
      setMaxSlope(15.0);
    }
  };

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
        strategies: ['FASTEST', 'SAFEST', 'SCIENTIFIC_EXPLORATION'],
      });
      setResult(res);
    } catch (err: any) {
      setError(err.message || 'Route planning failed');
    } finally {
      setPlanning(false);
    }
  };

  const renderElevationChart = (
    fastest: RouteResult | undefined,
    safest: RouteResult | undefined,
    scientific: RouteResult | undefined
  ) => {
    const fProfile = fastest?.elevation_profile || [];
    const sProfile = safest?.elevation_profile || [];
    const sciProfile = scientific?.elevation_profile || [];
    const bProfile = (result?.benchmark_traverse || nasaBenchmark)?.waypoints?.map((w) => w.elevation_m) || [];
    if (fProfile.length === 0 && sProfile.length === 0 && sciProfile.length === 0 && bProfile.length === 0) return null;

    const allVals = [...fProfile, ...sProfile, ...sciProfile, ...bProfile];
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

          {/* NASA Ground Truth Benchmark Profile (Gold) */}
          {bProfile.length > 0 && showNasaTraverse && (
            <path d={createPathD(bProfile)} fill="none" stroke="#ffd700" strokeWidth="3" strokeDasharray="5 3" />
          )}

          {/* Scientific Exploration Route Profile (Amber) */}
          {sciProfile.length > 0 && (
            <path d={createPathD(sciProfile)} fill="none" stroke="#ffa000" strokeWidth="2.5" />
          )}

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
          {bProfile.length > 0 && showNasaTraverse && (
            <div className="legend-item"><span className="color-bar gold"></span> NASA GROUND TRUTH BENCHMARK</div>
          )}
          <div className="legend-item"><span className="color-bar amber"></span> SCIENTIFIC EXPLORATION PROFILE</div>
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
  const scientific = result?.routes.SCIENTIFIC_EXPLORATION;

  return (
    <div className="mission-container">
      {/* Left Sidebar: Controls & Constraints */}
      <div className="mission-sidebar">
        <div className="panel-title-bar">
          <h3>MISSION TRAVERSE CONFIG</h3>
          <span className="count-tag">A* ENGINE</span>
        </div>

        {/* NASA Rover Mission Benchmark Presets */}
        <div className="benchmark-preset-card">
          <span className="preset-tag">NASA DATA BENCHMARK</span>
          <button
            className="btn btn-outline full-width"
            onClick={handleLoadNasaBenchmark}
            title="Load historical coordinates for NASA Curiosity or Perseverance"
          >
            🚀 LOAD NASA ROVER BENCHMARK
          </button>
          <span className="preset-hint">
            {sector.sector_id === 'SEC-JEZERO-01'
              ? 'Perseverance: Octavia E. Butler Landing ➔ Jezero Delta Rim'
              : 'Curiosity: Bradbury Landing ➔ Mount Sharp Ascent'}
          </span>
        </div>

        {/* Martian Atmospheric & Dust Storm Telemetry Simulator */}
        <div className="weather-telemetry-card">
          <div className="weather-card-header">
            <span className="preset-tag weather-tag">ATMOSPHERIC TELEMETRY</span>
            <span className="weather-station-tag">{weather?.sensor_station_name.split('(')[0] || 'MEDA Station'}</span>
          </div>

          <div className="weather-metrics-grid">
            <div className="weather-mini-stat">
              <span className="stat-label">WIND VELOCITY</span>
              <span className="stat-val highlight-amber">
                {weather?.prevailing_wind.speed_ms || 7.5} m/s
              </span>
              <span className="stat-sub">Gusts: {weather?.prevailing_wind.gust_ms || 12.0} m/s</span>
            </div>
            <div className="weather-mini-stat">
              <span className="stat-label">DUST TAU (τ)</span>
              <span className={`stat-val ${stormSeverity !== 'CALM' ? 'highlight-red' : ''}`}>
                {weather?.dust_optical_depth_tau || 0.38}
              </span>
              <span className="stat-sub">{stormSeverity === 'CALM' ? 'Clear Sky' : 'High Opacity'}</span>
            </div>
            <div className="weather-mini-stat">
              <span className="stat-label">AIR TEMP</span>
              <span className="stat-val">{weather?.air_temperature_c || -52}°C</span>
              <span className="stat-sub">Pressure: {weather?.atmospheric_pressure_pa || 740} Pa</span>
            </div>
            <div className="weather-mini-stat">
              <span className="stat-label">WIND BEARING</span>
              <span className="stat-val">{weather?.prevailing_wind.direction_deg || 315}°</span>
              <span className="stat-sub">Azimuth Angle</span>
            </div>
          </div>

          {/* Storm Scenario Injection Selector */}
          <div className="storm-scenario-selector">
            <span className="storm-selector-label">STORM HAZARD SIMULATION:</span>
            <div className="storm-btn-group">
              <button
                type="button"
                className={`btn-storm-toggle ${stormSeverity === 'CALM' ? 'active calm' : ''}`}
                onClick={() => handleToggleStorm('CALM')}
                disabled={updatingWeather}
              >
                🌤️ CALM
              </button>
              <button
                type="button"
                className={`btn-storm-toggle ${stormSeverity === 'MODERATE_DUST' ? 'active moderate' : ''}`}
                onClick={() => handleToggleStorm('MODERATE_DUST')}
                disabled={updatingWeather}
              >
                ⚠️ DUST PLUME
              </button>
              <button
                type="button"
                className={`btn-storm-toggle ${stormSeverity === 'SEVERE_STORM' ? 'active severe' : ''}`}
                onClick={() => handleToggleStorm('SEVERE_STORM')}
                disabled={updatingWeather}
              >
                🌪️ SEVERE GALE
              </button>
            </div>
          </div>

          {weather?.active_storms && weather.active_storms.length > 0 && (
            <div className="active-storm-alert-strip">
              <span className="storm-alert-badge">OBSTACLE DETECTED</span>
              <p>
                <strong>{weather.active_storms[0].name}:</strong> Core radius {weather.active_storms[0].radius_km} km at ({weather.active_storms[0].center_lat.toFixed(2)}°N, {weather.active_storms[0].center_lon.toFixed(2)}°E). Safest route will actively bypass this cell.
              </p>
            </div>
          )}
        </div>

        <div className="config-form">
          {/* Start Point Input with 3D Map Picker */}
          <div className="coords-group">
            <div className="group-header-with-btn">
              <span className="group-label">START POINT (DEGREES)</span>
              <button
                type="button"
                className={`btn-pick-inline ${pickingMode === 'start' ? 'active-picking' : ''}`}
                onClick={() => setPickingMode(pickingMode === 'start' ? null : 'start')}
                title="Click on the 3D terrain to pick start point"
              >
                {pickingMode === 'start' ? 'CANCEL' : '📍 PICK ON 3D MAP'}
              </button>
            </div>
            <div className="input-row">
              <label>Lat:</label>
              <input
                type="number"
                step="0.01"
                value={startLat}
                onChange={(e) => setStartLat(parseFloat(e.target.value))}
              />
              <label>Lon:</label>
              <input
                type="number"
                step="0.01"
                value={startLon}
                onChange={(e) => setStartLon(parseFloat(e.target.value))}
              />
            </div>
          </div>

          {/* Destination Point Input with 3D Map Picker */}
          <div className="coords-group">
            <div className="group-header-with-btn">
              <span className="group-label">DESTINATION TARGET (DEGREES)</span>
              <button
                type="button"
                className={`btn-pick-inline ${pickingMode === 'dest' ? 'active-picking' : ''}`}
                onClick={() => setPickingMode(pickingMode === 'dest' ? null : 'dest')}
                title="Click on the 3D terrain to pick destination point"
              >
                {pickingMode === 'dest' ? 'CANCEL' : '🎯 PICK ON 3D MAP'}
              </button>
            </div>
            <div className="input-row">
              <label>Lat:</label>
              <input
                type="number"
                step="0.01"
                value={destLat}
                onChange={(e) => setDestLat(parseFloat(e.target.value))}
              />
              <label>Lon:</label>
              <input
                type="number"
                step="0.01"
                value={destLon}
                onChange={(e) => setDestLon(parseFloat(e.target.value))}
              />
            </div>
          </div>

          {/* Slope threshold */}
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
            {planning ? 'COMPUTING 3D TRAVERSES...' : 'CALCULATE MISSION ROUTES ➔'}
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

      {/* Main Panel: Interactive 3D Terrain + Evaluation Results */}
      <div className="mission-main">
        {/* 3D Mission Navigation Viewport Card */}
        <div className="mission-3d-card">
          <div className="mission-3d-toolbar">
            <div className="layer-tabs-bar">
              <button
                className={`tab-pill ${layerMode === 'slope' ? 'active' : ''}`}
                onClick={() => setLayerMode('slope')}
                title="View slope gradient hazards"
              >
                📐 SLOPE (HAZARDS)
              </button>
              <button
                className={`tab-pill ${layerMode === 'visible' ? 'active' : ''}`}
                onClick={() => setLayerMode('visible')}
                title="View Mars Trek Viking mosaic"
              >
                🌍 ORBITAL MOSAIC
              </button>
              <button
                className={`tab-pill ${layerMode === 'geology' ? 'active' : ''}`}
                onClick={() => setLayerMode('geology')}
                title="View USGS geologic units"
              >
                🌋 GEOLOGY (USGS)
              </button>
              <button
                className={`tab-pill ${layerMode === 'elevation' ? 'active' : ''}`}
                onClick={() => setLayerMode('elevation')}
                title="View MOLA elevation color gradient"
              >
                🏔️ ELEVATION
              </button>
              {(result?.benchmark_traverse || nasaBenchmark) && (
                <button
                  className={`tab-pill traverse-toggle ${showNasaTraverse ? 'active' : ''}`}
                  onClick={() => setShowNasaTraverse(!showNasaTraverse)}
                  title="Toggle NASA Historical Rover Traverse"
                >
                  🚀 NASA BENCHMARK {showNasaTraverse ? 'ON' : 'OFF'}
                </button>
              )}
              <button
                className={`tab-pill storm-toggle ${showStormLayer ? 'active' : ''}`}
                onClick={() => setShowStormLayer(!showStormLayer)}
                title="Toggle 3D Martian Dust Storm & Wind Shear simulation"
              >
                🌪️ DUST STORM {showStormLayer ? 'ON' : 'OFF'}
              </button>
            </div>

            <div className="view-modifiers-bar">
              <div className="slider-control-group">
                <span className="ctrl-label">RELIEF:</span>
                <input
                  type="range"
                  min="1.0"
                  max="3.0"
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

          {/* Interactive Picking Instruction Banner */}
          {pickingMode && (
            <div className="picking-instruction-banner">
              <span>
                🖱️ <strong>CLICK DIRECTLY ON THE 3D MARS SURFACE</strong> to set{' '}
                {pickingMode === 'start' ? 'MISSION START LOCATION 📍' : 'TARGET DESTINATION 🎯'}
              </span>
              <button className="btn-cancel-pick" onClick={() => setPickingMode(null)}>✕ CANCEL</button>
            </div>
          )}

          {/* Three.js 3D Viewport */}
          <div className="mission-3d-viewport">
            {terrainMesh ? (
              <ThreeTerrainView
                mesh={terrainMesh}
                layerMode={layerMode}
                verticalExaggeration={verticalExaggeration}
                wireframe={wireframe}
                startPoint={[startLat, startLon]}
                destPoint={[destLat, destLon]}
                plannedRoutes={{
                  fastest: fastest?.path_coords,
                  safest: safest?.path_coords,
                  scientific: scientific?.path_coords,
                }}
                roverPath={showNasaTraverse ? (result?.benchmark_traverse?.path_coords || nasaBenchmark?.path_coords || []) : []}
                roverWaypoints={showNasaTraverse ? (result?.benchmark_traverse?.waypoints || nasaBenchmark?.waypoints || []) : []}
                showRoverTraverse={showNasaTraverse}
                stormCells={weather?.active_storms || []}
                showStormLayer={showStormLayer}
                onPickPoint={(coords) => {
                  if (pickingMode === 'start') {
                    setStartLat(coords[0]);
                    setStartLon(coords[1]);
                    setPickingMode(null);
                  } else if (pickingMode === 'dest') {
                    setDestLat(coords[0]);
                    setDestLon(coords[1]);
                    setPickingMode(null);
                  }
                }}
              />
            ) : (
              <div className="mesh-loading-placeholder">
                {loadingMesh
                  ? 'Initializing 3D Martian Topography...'
                  : 'No 3D elevation mesh cached for this sector. Visit Sector Exploration to reconstruct terrain.'}
              </div>
            )}

            {/* 3D Map Route Key Overlay */}
            <div className="route-visual-key-bar">
              <div className="key-item">
                <span className="key-bullet sphere-green"></span>
                <span>START ({startLat.toFixed(2)}°N, {startLon.toFixed(2)}°E)</span>
              </div>
              <div className="key-item">
                <span className="key-bullet cone-red"></span>
                <span>DESTINATION ({destLat.toFixed(2)}°N, {destLon.toFixed(2)}°E)</span>
              </div>
              {scientific?.feasible && (
                <div className="key-item">
                  <span className="key-bullet line-amber"></span>
                  <span>SCIENTIFIC TRAVERSE ({scientific.total_distance_km} km · ROI {((scientific.scientific_roi_score || 0) * 100).toFixed(0)}%)</span>
                </div>
              )}
              {safest?.feasible && (
                <div className="key-item">
                  <span className="key-bullet line-green"></span>
                  <span>SAFEST CORRIDOR ({safest.total_distance_km} km)</span>
                </div>
              )}
              {fastest?.feasible && (
                <div className="key-item">
                  <span className="key-bullet line-cyan"></span>
                  <span>FASTEST ROUTE ({fastest.total_distance_km} km)</span>
                </div>
              )}
              {showNasaTraverse && (result?.benchmark_traverse || nasaBenchmark) && (
                <div className="key-item">
                  <span className="key-bullet line-gold"></span>
                  <span>NASA ROVER TRAVERSE</span>
                </div>
              )}
              {weather?.active_storms && weather.active_storms.length > 0 && showStormLayer && (
                <div className="key-item">
                  <span className="key-bullet ring-red"></span>
                  <span>STORM HAZARD CELL ({weather.active_storms[0].radius_km} km)</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Evaluation Cards & Waypoint Tables */}
        {result ? (
          <div className="results-panel">
            <div className="comparison-banner">
              <h3>MISSION TRADE-OFF EVALUATION</h3>
              <p className="summary-text">{result.summary}</p>
            </div>

            <div className="routes-comparison-grid">
              {/* SCIENTIFIC EXPLORATION ROUTE */}
              <div className="route-card scientific-card">
                <div className="route-card-header">
                  <span className="strategy-tag amber">STRATEGY 3: SCIENTIFIC EXPLORATION</span>
                  <h4>Science ROI & Outcrop Maximization</h4>
                </div>
                {scientific?.feasible ? (
                  <div className="route-stats">
                    <div className="stat-metric">
                      <span className="metric-label">TOTAL DISTANCE</span>
                      <span className="metric-val">{scientific.total_distance_km} km</span>
                    </div>
                    <div className="stat-metric">
                      <span className="metric-label">SCIENTIFIC ROI</span>
                      <span className="metric-val highlight-amber">
                        ⭐ {((scientific.scientific_roi_score || 0) * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="stat-metric">
                      <span className="metric-label">AVERAGE SLOPE</span>
                      <span className="metric-val highlight-amber">{scientific.avg_slope_deg}°</span>
                    </div>
                    <div className="stat-metric">
                      <span className="metric-label">GEOLOGIC TARGETS</span>
                      <span className="metric-val highlight-amber">
                        {scientific.scientific_targets_visited?.length || 0} Targets
                      </span>
                    </div>
                    <div className="stat-metric">
                      <span className="metric-label">STORM STATUS</span>
                      <span className={`metric-val ${scientific.storm_status === 'STORM_PENETRATED' ? 'highlight-red' : 'highlight-amber'}`}>
                        {scientific.storm_status === 'STORM_BYPASSED' ? '🛡️ BYPASSED' : scientific.storm_status || (scientific.storm_hazard_avoided ? 'SAFE' : 'NOMINAL')}
                      </span>
                    </div>
                    <div className="stat-metric">
                      <span className="metric-label">MAX WIND SPEED</span>
                      <span className="metric-val">
                        {scientific.max_wind_speed_ms !== undefined ? `${scientific.max_wind_speed_ms} m/s` : '—'}
                      </span>
                    </div>
                    {scientific.scientific_targets_visited && scientific.scientific_targets_visited.length > 0 && (
                      <div className="scientific-targets-strip">
                        <span className="targets-title">TARGET OUTCROPS & FORMATIONS:</span>
                        <div className="targets-pills">
                          {scientific.scientific_targets_visited.map((tgt, i) => (
                            <span key={i} className="target-pill">🔬 {tgt}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    <p className="route-explanation">{scientific.explanation}</p>
                  </div>
                ) : (
                  <div className="infeasible-msg">
                    <p>⚠️ Infeasible: {scientific?.explanation}</p>
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
                    <div className="stat-metric">
                      <span className="metric-label">STORM EVASION</span>
                      <span className={`metric-val ${safest.storm_status === 'STORM_BYPASSED' ? 'highlight-green' : safest.storm_hazard_avoided ? 'highlight-green' : ''}`}>
                        {safest.storm_status === 'STORM_BYPASSED' ? '🛡️ BYPASSED' : safest.storm_status || (safest.storm_hazard_avoided ? 'SAFE' : 'NOMINAL')}
                      </span>
                    </div>
                    <div className="stat-metric">
                      <span className="metric-label">MAX WIND SHEAR</span>
                      <span className="metric-val highlight-green">
                        {safest.max_wind_speed_ms !== undefined ? `${safest.max_wind_speed_ms} m/s` : '—'}
                      </span>
                    </div>
                    <p className="route-explanation">{safest.explanation}</p>
                  </div>
                ) : (
                  <div className="infeasible-msg">
                    <p>⚠️ Infeasible: {safest?.explanation}</p>
                  </div>
                )}
              </div>

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
                    <div className="stat-metric">
                      <span className="metric-label">STORM EXPOSURE</span>
                      <span className={`metric-val ${fastest.storm_status === 'STORM_PENETRATED' ? 'highlight-red' : ''}`}>
                        {fastest.storm_status === 'STORM_PENETRATED' ? '⚠️ PENETRATED' : fastest.storm_status || 'NOMINAL'}
                      </span>
                    </div>
                    <div className="stat-metric">
                      <span className="metric-label">PEAK ENROUTE WIND</span>
                      <span className={`metric-val ${fastest.max_wind_speed_ms && fastest.max_wind_speed_ms > 20 ? 'highlight-red' : ''}`}>
                        {fastest.max_wind_speed_ms !== undefined ? `${fastest.max_wind_speed_ms} m/s` : '—'}
                      </span>
                    </div>
                    <p className="route-explanation">{fastest.explanation}</p>
                  </div>
                ) : (
                  <div className="infeasible-msg">
                    <p>⚠️ Infeasible: {fastest?.explanation}</p>
                  </div>
                )}
              </div>

              {/* NASA ROVER GROUND TRUTH BENCHMARK CARD */}
              {(result.benchmark_traverse || nasaBenchmark) && (
                <div className="route-card benchmark-card">
                  <div className="route-card-header">
                    <span className="strategy-tag gold">NASA GROUND TRUTH</span>
                    <h4>{(result.benchmark_traverse || nasaBenchmark)!.rover_name}</h4>
                  </div>
                  <div className="route-stats">
                    <div className="stat-metric">
                      <span className="metric-label">TOTAL DISTANCE</span>
                      <span className="metric-val highlight-gold">
                        {(result.benchmark_traverse || nasaBenchmark)!.total_distance_km} km
                      </span>
                    </div>
                    <div className="stat-metric">
                      <span className="metric-label">LANDING SITE</span>
                      <span className="metric-val">{(result.benchmark_traverse || nasaBenchmark)!.landing_site_name}</span>
                    </div>
                    <div className="stat-metric">
                      <span className="metric-label">SCIENCE STOPS</span>
                      <span className="metric-val">{(result.benchmark_traverse || nasaBenchmark)!.waypoints.length} targets</span>
                    </div>
                    <div className="stat-metric">
                      <span className="metric-label">MISSION STATUS</span>
                      <span className="metric-val highlight-gold">ACTIVE ON MARS</span>
                    </div>
                    <p className="route-explanation">{(result.benchmark_traverse || nasaBenchmark)!.scientific_summary}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="elevation-profile-card">
              <h4>TRANSVERSE ELEVATION PROFILES</h4>
              {renderElevationChart(fastest, safest, scientific)}
            </div>

            {/* Waypoint Navigation Log with Strategy Selection */}
            {(() => {
              const activeRoute =
                selectedWaypointStrategy === 'SCIENTIFIC_EXPLORATION' && scientific?.feasible
                  ? scientific
                  : selectedWaypointStrategy === 'SAFEST' && safest?.feasible
                  ? safest
                  : fastest?.feasible
                  ? fastest
                  : safest || scientific;

              if (!activeRoute || activeRoute.waypoints.length === 0) return null;

              return (
                <div className="waypoints-card">
                  <div className="waypoints-header-with-tabs">
                    <h4>WAYPOINT NAVIGATION LOG</h4>
                    <div className="waypoint-tabs">
                      {scientific?.feasible && (
                        <button
                          className={`btn-wp-tab amber ${selectedWaypointStrategy === 'SCIENTIFIC_EXPLORATION' ? 'active' : ''}`}
                          onClick={() => setSelectedWaypointStrategy('SCIENTIFIC_EXPLORATION')}
                        >
                          🔬 SCIENTIFIC ({scientific.waypoints.length} WPs)
                        </button>
                      )}
                      {safest?.feasible && (
                        <button
                          className={`btn-wp-tab green ${selectedWaypointStrategy === 'SAFEST' ? 'active' : ''}`}
                          onClick={() => setSelectedWaypointStrategy('SAFEST')}
                        >
                          🛡️ SAFEST ({safest.waypoints.length} WPs)
                        </button>
                      )}
                      {fastest?.feasible && (
                        <button
                          className={`btn-wp-tab cyan ${selectedWaypointStrategy === 'FASTEST' ? 'active' : ''}`}
                          onClick={() => setSelectedWaypointStrategy('FASTEST')}
                        >
                          ⚡ FASTEST ({fastest.waypoints.length} WPs)
                        </button>
                      )}
                    </div>
                  </div>

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
                          <th>WIND (m/s)</th>
                          <th>DUST (τ)</th>
                          {selectedWaypointStrategy === 'SCIENTIFIC_EXPLORATION' && (
                            <>
                              <th>SCIENCE TARGET / FORMATION</th>
                              <th>SCIENCE ROI</th>
                            </>
                          )}
                          <th>CUMULATIVE DISTANCE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeRoute.waypoints.slice(0, 15).map((wp, idx) => (
                          <tr key={idx}>
                            <td>{idx + 1}</td>
                            <td>{wp.lat}°N</td>
                            <td>{wp.lon}°E</td>
                            <td>{wp.elevation_m} m</td>
                            <td>{wp.slope_deg}°</td>
                            <td>{wp.risk_score}</td>
                            <td className={wp.wind_speed_ms && wp.wind_speed_ms > 20 ? 'highlight-red' : ''}>
                              {wp.wind_speed_ms !== undefined ? `${wp.wind_speed_ms} m/s` : '—'}
                            </td>
                            <td className={wp.dust_tau && wp.dust_tau > 1.0 ? 'highlight-red' : ''}>
                              {wp.dust_tau !== undefined ? wp.dust_tau : '—'}
                            </td>
                            {selectedWaypointStrategy === 'SCIENTIFIC_EXPLORATION' && (
                              <>
                                <td className="highlight-amber">
                                  {wp.science_target_name ? `💎 ${wp.science_target_name}` : '—'}
                                </td>
                                <td className="highlight-amber">
                                  {wp.scientific_value !== undefined ? `${(wp.scientific_value * 100).toFixed(0)}%` : '—'}
                                </td>
                              </>
                            )}
                            <td>{wp.cumulative_distance_km} km</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {activeRoute.waypoints.length > 15 && (
                      <p className="table-footnote">
                        Showing first 15 of {activeRoute.waypoints.length} total waypoints for{' '}
                        {selectedWaypointStrategy.replace('_', ' ')}.
                      </p>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        ) : (
          <div className="mission-prompt-hint">
            <span>💡 Select coordinates by clicking on the 3D terrain or loading the NASA benchmark, then click "CALCULATE MISSION ROUTES" to trace 3D navigational paths.</span>
          </div>
        )}
      </div>
    </div>
  );
};
