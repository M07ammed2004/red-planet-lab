import React from 'react';

interface HeaderProps {
  activeTab: 'overview' | 'exploration' | 'mission';
  setActiveTab: (tab: 'overview' | 'exploration' | 'mission') => void;
  apiHealthy: boolean | null;
  selectedSectorId: string;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  apiHealthy,
  selectedSectorId,
}) => {
  return (
    <header className="header">
      <div className="header-left">
        <div className="logo-badge">
          <span className="planet-icon">🔴</span>
          <div className="logo-text">
            <span className="logo-title">RED PLANET LAB</span>
            <span className="logo-sub">Multi-Mission Data Fusion & Exploration Planning</span>
          </div>
        </div>
      </div>

      <nav className="header-nav">
        <button
          className={`nav-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <span className="nav-num">01</span> MARS OVERVIEW
        </button>
        <button
          className={`nav-btn ${activeTab === 'exploration' ? 'active' : ''}`}
          onClick={() => setActiveTab('exploration')}
        >
          <span className="nav-num">02</span> SECTOR EXPLORATION
        </button>
        <button
          className={`nav-btn ${activeTab === 'mission' ? 'active' : ''}`}
          onClick={() => setActiveTab('mission')}
        >
          <span className="nav-num">03</span> MISSION CONTROL
        </button>
      </nav>

      <div className="header-right">
        <div className="target-badge">
          <span className="badge-label">TARGET:</span>
          <span className="badge-val">{selectedSectorId}</span>
        </div>
        <div className={`status-indicator ${apiHealthy ? 'online' : 'offline'}`}>
          <span className="dot"></span>
          <span>{apiHealthy ? 'TELEMETRY LIVE' : 'CONNECTING'}</span>
        </div>
      </div>
    </header>
  );
};
