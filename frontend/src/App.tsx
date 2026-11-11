import React, { useEffect, useState } from 'react';
import type { Sector } from './types/api';
import { checkHealth, fetchSectors } from './services/api';
import { Header } from './components/Header';
import { MarsOverview } from './components/MarsOverview';
import { SectorExploration } from './components/SectorExploration';
import { MissionControl } from './components/MissionControl';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'exploration' | 'mission'>('overview');
  const [apiHealthy, setApiHealthy] = useState<boolean | null>(null);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [selectedSector, setSelectedSector] = useState<Sector | null>(null);

  const loadData = async () => {
    try {
      await checkHealth();
      setApiHealthy(true);
      const secs = await fetchSectors();
      setSectors(secs);
      if (secs.length > 0 && !selectedSector) {
        setSelectedSector(secs[0]);
      } else if (selectedSector) {
        // Keep updated state for selected sector
        const updated = secs.find((s) => s.sector_id === selectedSector.sector_id);
        if (updated) setSelectedSector(updated);
      }
    } catch {
      setApiHealthy(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [selectedSector?.sector_id]);

  return (
    <div className="app-container">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        apiHealthy={apiHealthy}
        selectedSectorId={selectedSector ? selectedSector.sector_id : 'NONE'}
      />

      <main className="main-content">
        {activeTab === 'overview' && (
          <MarsOverview
            sectors={sectors}
            selectedSector={selectedSector}
            onSelectSector={(sec) => setSelectedSector(sec)}
            onRefreshSectors={loadData}
            onNavigateToExploration={() => setActiveTab('exploration')}
          />
        )}

        {activeTab === 'exploration' && (
          <SectorExploration
            sector={selectedSector}
            onNavigateToMission={() => setActiveTab('mission')}
          />
        )}

        {activeTab === 'mission' && (
          <MissionControl sector={selectedSector} />
        )}
      </main>
    </div>
  );
};

export default App;
