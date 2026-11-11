import React, { useEffect, useRef, useState } from 'react';
import { type MarsRegion, MARS_REGIONS } from '../../types/globe';
import type { Sector } from '../../types/api';
import { ThreeMarsGlobe } from './ThreeMarsGlobe';
import { RegionDetailDrawer } from './RegionDetailDrawer';

interface MarsGlobeContainerProps {
  sectors: Sector[];
  selectedRegion: MarsRegion | null;
  onSelectRegion: (region: MarsRegion | null) => void;
  onStartAcquisition: (region: MarsRegion) => void;
  onEnterTerrain: (region: MarsRegion) => void;
}

export const MarsGlobeContainer: React.FC<MarsGlobeContainerProps> = ({
  sectors,
  selectedRegion,
  onSelectRegion,
  onStartAcquisition,
  onEnterTerrain,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const globeInstanceRef = useRef<ThreeMarsGlobe | null>(null);

  const [hoveredRegion, setHoveredRegion] = useState<MarsRegion | null>(null);
  const [hoverScreenPos, setHoverScreenPos] = useState<{ x: number; y: number } | null>(null);
  const [labels, setLabels] = useState<{ region: MarsRegion; x: number; y: number; visible: boolean }[]>([]);

  useEffect(() => {
    if (!mountRef.current) return;

    // Initialize Three.js Mars Globe
    const globe = new ThreeMarsGlobe(mountRef.current, {
      onHoverRegion: (region, screenPos) => {
        setHoveredRegion(region);
        if (screenPos) setHoverScreenPos(screenPos);
      },
      onSelectRegion: (region) => {
        onSelectRegion(region);
      },
    });

    globeInstanceRef.current = globe;

    // Periodically update projected 2D label positions (every 40ms)
    const labelTimer = setInterval(() => {
      if (globeInstanceRef.current) {
        setLabels(globeInstanceRef.current.getScreenPositions());
      }
    }, 40);

    return () => {
      clearInterval(labelTimer);
      globe.destroy();
      globeInstanceRef.current = null;
    };
  }, []);

  // When selectedRegion changes from outside, tell the globe to rotate to it
  useEffect(() => {
    if (selectedRegion && globeInstanceRef.current) {
      globeInstanceRef.current.selectRegion(selectedRegion);
    }
  }, [selectedRegion]);

  const handleResetCamera = () => {
    if (globeInstanceRef.current) {
      globeInstanceRef.current.resetRotation();
      onSelectRegion(null);
    }
  };

  // Find backend sector matching the selected region (if existing)
  const currentSector = sectors.find((s) => s.sector_id === selectedRegion?.id) || null;

  return (
    <div className="globe-viewport">
      {/* 3D Canvas Mount Point */}
      <div ref={mountRef} className="three-canvas-mount" />

      {/* Dynamic 2D Projected Region Labels floating on the surface */}
      <div className="globe-labels-overlay">
        {labels.map(({ region, x, y, visible }) => {
          if (!visible) return null;
          const isSelected = selectedRegion?.id === region.id;
          const isHovered = hoveredRegion?.id === region.id;

          return (
            <div
              key={region.id}
              className={`globe-region-pin ${isSelected ? 'selected' : ''} ${isHovered ? 'hovered' : ''}`}
              style={{
                left: `${x}px`,
                top: `${y}px`,
                borderColor: region.color,
              }}
              onClick={() => onSelectRegion(region)}
            >
              <div className="pin-dot" style={{ backgroundColor: region.color }} />
              <div className="pin-label-box">
                <span className="pin-name">{region.name}</span>
                <span className="pin-coords">
                  {region.center[0].toFixed(1)}°N, {region.center[1].toFixed(1)}°E
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Mouse hover probe tooltip */}
      {hoveredRegion && hoverScreenPos && (
        <div
          className="globe-hover-tooltip"
          style={{
            left: `${hoverScreenPos.x + 18}px`,
            top: `${hoverScreenPos.y - 18}px`,
          }}
        >
          <div className="tooltip-tag" style={{ color: hoveredRegion.color }}>
            {hoveredRegion.featureType.toUpperCase()}
          </div>
          <div className="tooltip-title">{hoveredRegion.name}</div>
          <div className="tooltip-coords">
            Lat: {hoveredRegion.center[0].toFixed(2)}°N | Lon: {hoveredRegion.center[1].toFixed(2)}°E
          </div>
          <div className="tooltip-hint">Click to inspect orbital parameters</div>
        </div>
      )}

      {/* Viewport HUD Overlays */}
      <div className="globe-hud-controls">
        <div className="hud-title-box">
          <span className="hud-badge">GEOCENTRIC SENSOR GRID</span>
          <h2>MARS 3D GLOBAL OVERVIEW</h2>
          <span className="hud-datum">DATUM: GMM3 AREOID (R = 3,396,000 m) | EQUIDISTANT CYLINDRICAL</span>
        </div>

        <div className="hud-btn-row">
          <button className="hud-btn" onClick={handleResetCamera} title="Reset camera to default view">
            ⟲ FREE ROTATION
          </button>
        </div>
      </div>

      {/* Quick Region Selector Bar at the bottom */}
      <div className="globe-quick-regions-bar">
        <span className="bar-label">FEATURE SITES:</span>
        <div className="region-chips-scroll">
          {MARS_REGIONS.map((r) => {
            const isSel = selectedRegion?.id === r.id;
            return (
              <button
                key={r.id}
                className={`region-chip ${isSel ? 'active' : ''}`}
                style={{ borderColor: isSel ? r.color : undefined }}
                onClick={() => onSelectRegion(r)}
              >
                <span className="chip-indicator" style={{ backgroundColor: r.color }} />
                <span>{r.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Slide-in Detail Drawer for the selected region */}
      <RegionDetailDrawer
        region={selectedRegion}
        sectorState={currentSector}
        onClose={() => onSelectRegion(null)}
        onStartAcquisition={onStartAcquisition}
        onEnterTerrain={onEnterTerrain}
      />
    </div>
  );
};
