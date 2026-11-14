import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  type MarsRegion,
  MARS_REGIONS,
  type UsgsMartianLandmark,
  USGS_MARTIAN_NOMENCLATURE,
  type MartianFeatureCategory,
} from '../../types/globe';
import type { Sector } from '../../types/api';
import { ThreeMarsGlobe } from './ThreeMarsGlobe';
import { RegionDetailDrawer, type SelectedDrawerItem } from './RegionDetailDrawer';

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

  // Active category filter
  const [activeCategory, setActiveCategory] = useState<MartianFeatureCategory | 'ALL' | 'SECTORS'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Hover & selection states
  const [hoveredItem, setHoveredItem] = useState<{
    type: 'landmark' | 'region';
    name: string;
    categoryLabel: string;
    coords: [number, number];
    color: string;
  } | null>(null);
  const [hoverScreenPos, setHoverScreenPos] = useState<{ x: number; y: number } | null>(null);

  const [selectedDrawerItem, setSelectedDrawerItem] = useState<SelectedDrawerItem | null>(
    selectedRegion ? { type: 'region', data: selectedRegion, sector: sectors.find((s) => s.sector_id === selectedRegion.id) } : null
  );

  const [screenLabels, setScreenLabels] = useState<
    { id: string; name: string; color: string; category?: string; x: number; y: number; visible: boolean; isLandmark: boolean }[]
  >([]);

  // Calculate scouted vs unscouted sectors count
  const scoutedCount = useMemo(() => {
    return sectors.filter((s) => s.state === 'DISCOVERED').length;
  }, [sectors]);

  // Filtered landmarks based on search & category
  const filteredLandmarks = useMemo(() => {
    return USGS_MARTIAN_NOMENCLATURE.filter((lm) => {
      const matchesCategory = activeCategory === 'ALL' || lm.category === activeCategory;
      const matchesSearch =
        searchQuery.trim() === '' ||
        lm.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lm.usgsQuadrangle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lm.categoryLabel.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchQuery]);

  // Initialize Three.js Mars Globe
  useEffect(() => {
    if (!mountRef.current) return;

    const globe = new ThreeMarsGlobe(mountRef.current, {
      onHoverItem: (item, screenPos) => {
        if (!item) {
          setHoveredItem(null);
          setHoverScreenPos(null);
          return;
        }

        if (item.type === 'landmark') {
          setHoveredItem({
            type: 'landmark',
            name: item.data.name,
            categoryLabel: item.data.categoryLabel,
            coords: item.data.center,
            color: item.data.color,
          });
        } else {
          setHoveredItem({
            type: 'region',
            name: item.data.name,
            categoryLabel: item.data.featureType,
            coords: item.data.center,
            color: item.data.color,
          });
        }

        if (screenPos) setHoverScreenPos(screenPos);
      },
      onSelectItem: (item) => {
        if (item.type === 'landmark') {
          setSelectedDrawerItem({ type: 'landmark', data: item.data });
        } else {
          setSelectedDrawerItem({ type: 'region', data: item.data, sector: item.sector });
          onSelectRegion(item.data);
        }
      },
    });

    globeInstanceRef.current = globe;
    globe.updateSectors(sectors);

    const labelTimer = setInterval(() => {
      if (globeInstanceRef.current) {
        setScreenLabels(globeInstanceRef.current.getScreenPositions());
      }
    }, 45);

    return () => {
      clearInterval(labelTimer);
      globe.destroy();
      globeInstanceRef.current = null;
    };
  }, []);

  // Update sectors on globe when backend state changes
  useEffect(() => {
    if (globeInstanceRef.current && sectors.length > 0) {
      globeInstanceRef.current.updateSectors(sectors);
    }
  }, [sectors]);

  // Sync category filter changes to Three.js globe
  useEffect(() => {
    if (globeInstanceRef.current) {
      globeInstanceRef.current.setCategoryFilter(activeCategory);
    }
  }, [activeCategory]);

  // Sync selectedRegion from props
  useEffect(() => {
    if (selectedRegion) {
      const matchSector = sectors.find((s) => s.sector_id === selectedRegion.id);
      setSelectedDrawerItem({ type: 'region', data: selectedRegion, sector: matchSector });
      if (globeInstanceRef.current) {
        globeInstanceRef.current.flyTo(selectedRegion.center[0], selectedRegion.center[1]);
      }
    }
  }, [selectedRegion, sectors]);

  const handleSelectLandmarkFromList = (landmark: UsgsMartianLandmark) => {
    setSelectedDrawerItem({ type: 'landmark', data: landmark });
    if (globeInstanceRef.current) {
      globeInstanceRef.current.flyTo(landmark.center[0], landmark.center[1]);
    }
  };

  const handleSelectSectorFromList = (region: MarsRegion) => {
    const sec = sectors.find((s) => s.sector_id === region.id);
    setSelectedDrawerItem({ type: 'region', data: region, sector: sec });
    onSelectRegion(region);
    if (globeInstanceRef.current) {
      globeInstanceRef.current.flyTo(region.center[0], region.center[1]);
    }
  };

  const handleResetCamera = () => {
    if (globeInstanceRef.current) {
      globeInstanceRef.current.resetRotation();
      setSelectedDrawerItem(null);
      onSelectRegion(null);
    }
  };

  return (
    <div className="globe-viewport">
      {/* 3D WebGL Canvas */}
      <div ref={mountRef} className="three-canvas-mount" />

      {/* Top HUD: USGS Nomenclature & Discovery Header */}
      <div className="globe-hud-controls">
        <div className="hud-title-box">
          <div className="hud-badge-row">
            <span className="hud-badge">USGS ASTROGEOLOGY / IAU GAZETTEER</span>
            <span className="discovery-pill">
              SCOUTED: {scoutedCount} / {MARS_REGIONS.length} SECTORS (
              {((scoutedCount / Math.max(MARS_REGIONS.length, 1)) * 100).toFixed(0)}% MAPPED)
            </span>
          </div>
          <h2>MARS 3D GLOBAL OVERVIEW</h2>
          <span className="hud-datum">
            DATUM: IAU 2000 MARS AREOID (R = 3,396,190 m) • OFFICIAL NOMENCLATURE WGPSN
          </span>
        </div>

        {/* IAU Nomenclature Category Filter Bar */}
        <div className="nomenclature-filter-bar">
          <button
            className={`nom-tab ${activeCategory === 'ALL' ? 'active' : ''}`}
            onClick={() => setActiveCategory('ALL')}
          >
            🌐 ALL LANDMARKS ({USGS_MARTIAN_NOMENCLATURE.length})
          </button>
          <button
            className={`nom-tab ${activeCategory === 'SECTORS' ? 'active' : ''}`}
            onClick={() => setActiveCategory('SECTORS')}
          >
            🛰️ EXPLORATION SECTORS ({MARS_REGIONS.length})
          </button>
          <button
            className={`nom-tab ${activeCategory === 'MONS' ? 'active' : ''}`}
            onClick={() => setActiveCategory('MONS')}
          >
            🌋 MONTES / VOLCANOES
          </button>
          <button
            className={`nom-tab ${activeCategory === 'CRATER' ? 'active' : ''}`}
            onClick={() => setActiveCategory('CRATER')}
          >
            💥 CRATERS & BASINS
          </button>
          <button
            className={`nom-tab ${activeCategory === 'VALLIS' ? 'active' : ''}`}
            onClick={() => setActiveCategory('VALLIS')}
          >
            🏜️ VALLES & CANYONS
          </button>
          <button
            className={`nom-tab ${activeCategory === 'PLANITIA' ? 'active' : ''}`}
            onClick={() => setActiveCategory('PLANITIA')}
          >
            🪐 LOWLAND PLAINS
          </button>
          <button
            className={`nom-tab ${activeCategory === 'PLANUM' ? 'active' : ''}`}
            onClick={() => setActiveCategory('PLANUM')}
          >
            ❄️ POLAR & PLATEAUS
          </button>
          <button
            className={`nom-tab ${activeCategory === 'LANDING' ? 'active' : ''}`}
            onClick={() => setActiveCategory('LANDING')}
          >
            🚀 LANDING SITES
          </button>
        </div>

        {/* Search Input Bar */}
        <div className="globe-search-row">
          <div className="search-input-wrapper">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search USGS Martian features (e.g. Olympus Mons, Hellas, Candor, Perseverance)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="globe-search-input"
            />
            {searchQuery && (
              <button className="search-clear-btn" onClick={() => setSearchQuery('')}>✕</button>
            )}
          </div>
          <button className="hud-btn" onClick={handleResetCamera} title="Free spin camera">
            ⟲ FREE SPIN
          </button>
        </div>
      </div>

      {/* Floating 2D Surface Labels Projected from 3D */}
      <div className="globe-labels-overlay">
        {screenLabels.map((lbl) => {
          if (!lbl.visible) return null;
          return (
            <div
              key={lbl.id}
              className={`globe-region-pin ${lbl.isLandmark ? 'landmark-pin' : 'sector-pin'}`}
              style={{
                left: `${lbl.x}px`,
                top: `${lbl.y}px`,
                borderColor: lbl.color,
              }}
              onClick={() => {
                if (lbl.isLandmark) {
                  const match = USGS_MARTIAN_NOMENCLATURE.find((lm) => lm.id === lbl.id);
                  if (match) handleSelectLandmarkFromList(match);
                } else {
                  const match = MARS_REGIONS.find((r) => r.id === lbl.id);
                  if (match) handleSelectSectorFromList(match);
                }
              }}
            >
              <div className="pin-dot" style={{ backgroundColor: lbl.color }} />
              <div className="pin-label-box">
                <span className="pin-name">{lbl.name}</span>
                {lbl.category && <span className="pin-coords">{lbl.category}</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mouse hover probe tooltip */}
      {hoveredItem && hoverScreenPos && (
        <div
          className="globe-hover-tooltip"
          style={{
            left: `${hoverScreenPos.x + 18}px`,
            top: `${hoverScreenPos.y - 18}px`,
          }}
        >
          <div className="tooltip-tag" style={{ color: hoveredItem.color }}>
            {hoveredItem.categoryLabel.toUpperCase()}
          </div>
          <div className="tooltip-title">{hoveredItem.name}</div>
          <div className="tooltip-coords">
            {hoveredItem.coords[0].toFixed(2)}°N | {hoveredItem.coords[1].toFixed(2)}°E
          </div>
          <div className="tooltip-hint">Click to inspect USGS telemetry & orbital data</div>
        </div>
      )}

      {/* Quick Landmark / Sector Drawer Bar at Bottom */}
      <div className="globe-quick-regions-bar">
        <span className="bar-label">
          {activeCategory === 'SECTORS' ? 'EXPLORATION SECTORS:' : 'USGS GAZETTEER SITES:'}
        </span>
        <div className="region-chips-scroll">
          {activeCategory === 'SECTORS'
            ? MARS_REGIONS.map((r) => {
                const isSel = selectedDrawerItem?.type === 'region' && selectedDrawerItem.data.id === r.id;
                const sec = sectors.find((s) => s.sector_id === r.id);
                const isScouted = sec?.state === 'DISCOVERED';
                return (
                  <button
                    key={r.id}
                    className={`region-chip ${isSel ? 'active' : ''} ${isScouted ? 'chip-scouted' : 'chip-void'}`}
                    style={{ borderColor: isSel ? r.color : undefined }}
                    onClick={() => handleSelectSectorFromList(r)}
                  >
                    <span
                      className="chip-indicator"
                      style={{ backgroundColor: isScouted ? '#00e676' : '#64748b' }}
                    />
                    <span>{r.name}</span>
                    <span className="chip-badge">{isScouted ? 'MAPPED' : 'VOID'}</span>
                  </button>
                );
              })
            : filteredLandmarks.slice(0, 15).map((lm) => {
                const isSel = selectedDrawerItem?.type === 'landmark' && selectedDrawerItem.data.id === lm.id;
                return (
                  <button
                    key={lm.id}
                    className={`region-chip ${isSel ? 'active' : ''}`}
                    style={{ borderColor: isSel ? lm.color : undefined }}
                    onClick={() => handleSelectLandmarkFromList(lm)}
                  >
                    <span className="chip-indicator" style={{ backgroundColor: lm.color }} />
                    <span>{lm.name}</span>
                  </button>
                );
              })}
        </div>
      </div>

      {/* Slide-in Detail Drawer */}
      <RegionDetailDrawer
        selectedItem={selectedDrawerItem}
        onClose={() => {
          setSelectedDrawerItem(null);
          onSelectRegion(null);
        }}
        onStartAcquisition={onStartAcquisition}
        onEnterTerrain={onEnterTerrain}
        onSelectSectorById={(secId) => {
          const region = MARS_REGIONS.find((r) => r.id === secId);
          if (region) handleSelectSectorFromList(region);
        }}
      />
    </div>
  );
};
