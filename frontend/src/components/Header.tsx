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
          <div className="logo-emblem-frame">
            <img src="/assets/team-logo.png" alt="Red Planet Lab Logo" className="logo-img" />
          </div>
          <div className="logo-text">
            <h1 className="logo-title">
              Red Planet <b>Lab</b>
            </h1>
            <span className="logo-sub">Plan a rover road trip across Mars! · Multi-Mission Data Fusion</span>
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

      <div className="header-right chips">
        <div className="chip">
          <span className="live-bullet">●</span> Rover connected
        </div>
        <div className="chip o">
          Mars day <b>Sol 54,342</b>
        </div>
        <div className="chip">
          Target <b>{selectedSectorId}</b>
        </div>
        <div className={`chip status-indicator ${apiHealthy ? 'online' : 'offline'}`}>
          <span className="dot"></span>
          <b>{apiHealthy ? 'TELEMETRY LIVE' : 'CONNECTING'}</b>
        </div>
      </div>
    </header>
  );
};
