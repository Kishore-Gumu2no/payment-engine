/**
 * App Layout
 * Main layout wrapper with navigation
 */

import { Outlet, Link, useLocation, NavLink } from 'react-router-dom';
import { Activity, Settings, History, FileText, TerminalSquare, PlusSquare } from 'lucide-react';
import { MODE_LABEL, MODE_BADGE_COLOR } from '../../config/mode.js';
import './AppLayout.css';

export function AppLayout() {
  const location = useLocation();

  const navigation = [
    { path: '/', label: 'Dashboard', icon: Activity },
    { path: '/builder', label: 'Scenario Builder', icon: PlusSquare },
    { path: '/execute', label: 'Execute', icon: TerminalSquare },
    { path: '/history', label: 'History', icon: History },
    { path: '/reports', label: 'Reports', icon: FileText },
    { path: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="header-content">
          <div className="header-left">
            <Link to="/" className="logo" aria-label="Payment Gateway QA Dashboard">
              <svg className="logo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="2" width="20" height="20" rx="4" />
                <path d="M8 12h8M12 8v8" />
              </svg>
              <span className="logo-text">Payment Gateway QA</span>
            </Link>
          </div>

          <nav className="header-nav" aria-label="Main navigation">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive: active }) =>
                    `nav-item ${active ? 'nav-item--active' : ''}`
                  }
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className="nav-icon" size={16} />
                  <span className="nav-label">{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          <div className="header-right">
            <span className={`mode-badge mode-badge--${MODE_BADGE_COLOR}`}>
              {MODE_LABEL}
            </span>
          </div>
        </div>
      </header>

      <main className="app-main" role="main">
        <div className="container">
          <Outlet />
        </div>
      </main>

      <footer className="app-footer">
        <div className="container">
          <p className="footer-text">
            Stateful AI-Driven Payment Engine — QA Failure Simulation Platform
          </p>
        </div>
      </footer>
    </div>
  );
}