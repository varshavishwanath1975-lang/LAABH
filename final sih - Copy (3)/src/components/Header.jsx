import React from 'react';
import { useAuth } from '../context/AuthContext';

export const Header = ({ activeTab, setActiveTab, reportInfo, onOpenLogin }) => {
  const { user, logout, isAuthenticated } = useAuth();

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'admin': return 'bg-amber-900/60 text-amber-300 border-amber-500/50';
      case 'ministry_officer': return 'bg-blue-900/60 text-blue-300 border-blue-500/50';
      case 'agency_pm': return 'bg-purple-900/60 text-purple-300 border-purple-500/50';
      case 'analyst': return 'bg-emerald-900/60 text-emerald-300 border-emerald-500/50';
      default: return 'bg-gray-800 text-gray-300 border-gray-700';
    }
  };

  const renderNavLinks = () => {
    if (!user) return null;
    const role = user.role;

    const links = [
      { id: 'dashboard', label: 'Dashboard' },
      { id: 'projects', label: 'Projects Registry' },
      { id: 'diagnosis', label: 'Diagnose' },
    ];

    if (['admin', 'ministry_officer', 'agency_pm', 'analyst'].includes(role)) {
      links.push({ id: 'whatif', label: 'What-If Simulation' });
    }

    if (['admin', 'analyst'].includes(role)) {
      links.push({ id: 'admin', label: 'Admin & Coverage' });
    }

    return (
      <ul className="nav-links">
        {links.map((link) => (
          <li key={link.id}>
            <button
              onClick={() => setActiveTab(link.id)}
              className={`nav-link ${activeTab === link.id ? 'active' : ''}`}
            >
              {link.label}
            </button>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <header class="header-nav">
      <div class="nav-container">
        <div className="flex items-center gap-3">
          <a href="#" className="brand-logo" aria-label="LAABH Portal Home">
            <div className="brand-emblem">L</div>
            <div className="brand-text">
              <span className="brand-title">LAABH</span>
              <span className="brand-sub">Built on top of PAIMANA</span>
            </div>
          </a>

          {/* User Scope and Role Badges */}
          {isAuthenticated && user && (
            <div className="user-badge-container flex items-center gap-2 text-xs font-mono">
              <span className={`role-badge ${getRoleBadgeColor(user.role)}`}>
                [{user.role.toUpperCase().replace('_', ' ')}]
              </span>
              <span className="scope-label text-amber-400/90 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/40">
                Scope: {user.ministry || user.agency || 'All Ministries'}
              </span>
            </div>
          )}
        </div>

        <nav aria-label="Main Navigation">
          {renderNavLinks()}
        </nav>

        <div className="nav-actions">
          {/* Dynamic API Dataset Ticker (Replaces hardcoded "Live July 2026") */}
          <div className="status-badge-ticker" aria-live="polite">
            <span className="pulse-dot"></span>
            <span>
              {reportInfo ? `${reportInfo.month} (${reportInfo.totalCount.toLocaleString()} Projects)` : 'Loading API Data...'}
            </span>
          </div>

          {isAuthenticated ? (
            <button onClick={logout} className="btn-secondary btn-sm" aria-label="Logout">
              Logout ({user?.username})
            </button>
          ) : (
            <button onClick={onOpenLogin} className="btn-primary btn-sm" aria-label="Login">
              Login
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
