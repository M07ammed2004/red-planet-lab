import React, { useEffect, useState } from 'react';
import type { Sector } from './types/api';
import { type MarsRegion, MARS_REGIONS } from './types/globe';
import { checkHealth, fetchSectors } from './services/api';
import { Header } from './components/Header';
import { MarsGlobeContainer } from './components/globe/MarsGlobeContainer';
import { SectorExploration } from './components/SectorExploration';
import { MissionControl } from './components/MissionControl';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'exploration' | 'mission'>('overview');
  const [apiHealthy, setApiHealthy] = useState<boolean | null>(null);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<MarsRegion | null>(MARS_REGIONS[0]);

  const loadSectors = async () => {
    try {
      await checkHealth();
      setApiHealthy(true);
      const secs = await fetchSectors();
      setSectors(secs);
    } catch {
      setApiHealthy(false);
    }
  };

  useEffect(() => {
    loadSectors();
    const interval = setInterval(loadSectors, 8000);
    return () => clearInterval(interval);
  }, []);

  // Find backend sector matching current selected region
  const currentSector = sectors.find((s) => s.sector_id === selectedRegion?.id) || null;

  const handleStartAcquisition = (_region: MarsRegion) => {
    setActiveTab('exploration');
  };

  const handleEnterTerrain = (_region: MarsRegion) => {
    setActiveTab('exploration');
  };

  return (
    <div className="app-container">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        apiHealthy={apiHealthy}
        selectedSectorId={selectedRegion ? selectedRegion.id : 'NONE'}
      />

      <main className="main-content-full">
        {activeTab === 'overview' && (
          <MarsGlobeContainer
            sectors={sectors}
            selectedRegion={selectedRegion}
            onSelectRegion={(reg) => setSelectedRegion(reg)}
            onStartAcquisition={handleStartAcquisition}
            onEnterTerrain={handleEnterTerrain}
          />
        )}

        {activeTab === 'exploration' && (
          <div className="tab-padded-content">
            <SectorExploration
              sector={currentSector}
              onNavigateToMission={() => setActiveTab('mission')}
            />
          </div>
        )}

        {activeTab === 'mission' && (
          <div className="tab-padded-content">
            <MissionControl sector={currentSector} />
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
