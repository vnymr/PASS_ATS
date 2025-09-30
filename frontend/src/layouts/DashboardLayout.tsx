import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { UserButton } from '@clerk/clerk-react';
import logoImg from '../logo.png';
import Icons from '../components/ui/icons';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const location = useLocation();

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-header">
          <img src={logoImg} alt="Resume AI" className="sidebar-logo" />
        </div>

        <nav className="sidebar-nav">
          <Link
            to="/dashboard"
            className={`sidebar-item ${location.pathname === '/dashboard' ? 'active' : ''}`}
          >
            <Icons.barChart2 className="sidebar-icon" size={18} /> Dashboard
          </Link>
          <Link
            to="/profile"
            className={`sidebar-item ${location.pathname === '/profile' ? 'active' : ''}`}
          >
            <Icons.user className="sidebar-icon" size={18} /> Memory & Profile
          </Link>
          <Link
            to="/generate"
            className={`sidebar-item ${location.pathname === '/generate' ? 'active' : ''}`}
          >
            <Icons.zap className="sidebar-icon" size={18} /> Generate Resume
          </Link>
          <Link
            to="/history"
            className={`sidebar-item ${location.pathname === '/history' ? 'active' : ''}`}
          >
            <Icons.clock className="sidebar-icon" size={18} /> History
          </Link>
          <Link
            to="/extension"
            className={`sidebar-item ${location.pathname === '/extension' ? 'active' : ''}`}
          >
            <Icons.settings className="sidebar-icon" size={18} /> Extension
          </Link>
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-item">
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </aside>

      <main className="main-content">
        {children}
      </main>
    </div>
  );
}