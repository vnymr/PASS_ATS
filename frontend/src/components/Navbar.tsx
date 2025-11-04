import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { UserButton } from '@clerk/clerk-react';
import { motion } from 'framer-motion';
import { FileText, User, Download, Home, CreditCard, History, Briefcase } from 'lucide-react';
import type { Quota } from '../api-adapter';

export default function Navbar({ quota }: { quota: Quota | null }) {
  const used = quota?.used ?? 0;
  const limit = quota?.limit ?? 0;
  const location = useLocation();

  const navItems = [
    { id: 'home', label: 'Home', icon: Home, path: '/' },
    { id: 'generate', label: 'Generate', icon: FileText, path: '/generate' },
    { id: 'jobs', label: 'Jobs', icon: Briefcase, path: '/find-jobs' },
    { id: 'profile', label: 'Profile', icon: User, path: '/profile' },
    { id: 'history', label: 'History', icon: History, path: '/history' },
  ];

  return (
    <div className="nav">
      <div className="hstack">
        <Link to="/" className="title" style={{ marginRight: '1.5rem' }}>
          PASS ATS
        </Link>

        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="flex items-center gap-1 bg-white/80 backdrop-blur-sm rounded-2xl p-1.5"
          style={{
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
          }}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <Link
                key={item.id}
                to={item.path}
                className="relative p-2.5 rounded-xl transition-all duration-200"
                style={{
                  backgroundColor: isActive ? 'rgba(0,0,0,0.04)' : 'transparent',
                  color: isActive ? 'var(--text-900, #1a1a1a)' : 'var(--text-500, #666)',
                }}
                title={item.label}
              >
                <Icon className="w-4.5 h-4.5" />

                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 rounded-xl"
                    style={{
                      backgroundColor: 'rgba(0,0,0,0.04)',
                      zIndex: -1,
                    }}
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
              </Link>
            );
          })}
        </motion.div>

        <a
          className="muted flex items-center gap-2 ml-3 px-3 py-2 rounded-xl hover:bg-black/5 transition-all duration-200"
          href="https://chrome.google.com/webstore"
          target="_blank"
          rel="noreferrer"
        >
          <Download className="w-4 h-4" />
          <span className="hidden lg:inline">Extension</span>
        </a>
      </div>

      <div className="right flex items-center gap-3">
        <div className="flex items-center gap-3 bg-white/80 backdrop-blur-sm rounded-2xl px-4 py-2" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-gray-500" />
            <span className="muted text-sm">Free Plan</span>
          </div>
          {limit ? (
            <div className="flex items-center gap-2 border-l border-gray-200 pl-3">
              <span className="muted text-sm">{used}/{limit}</span>
            </div>
          ) : null}
        </div>
        <UserButton afterSignOutUrl="/" />
      </div>
    </div>
  );
}

