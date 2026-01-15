import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { UserButton } from '@clerk/clerk-react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, User, Sparkles, Clock, Layout } from 'lucide-react';
import type { Quota } from '../api-adapter';

export default function Navbar({ quota }: { quota: Quota | null }) {
  const used = quota?.used ?? 0;
  const limit = quota?.limit ?? 0;
  const location = useLocation();

  const navItems = [
    { id: 'generate', label: 'Generate', icon: FileText, path: '/generate' },
    { id: 'templates', label: 'Templates', icon: Layout, path: '/templates' },
    { id: 'history', label: 'History', icon: Clock, path: '/history' },
    { id: 'profile', label: 'Profile', icon: User, path: '/profile' },
  ];

  return (
    <div className="nav">
      <div className="hstack">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 mr-4 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight text-gray-900 hidden sm:block">
            PASS<span className="text-teal-600">ATS</span>
          </span>
        </Link>

        {/* Main Navigation */}
        <motion.nav
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="flex items-center gap-0.5 bg-gray-100/80 backdrop-blur-sm rounded-xl p-1"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path ||
              (item.path !== '/' && location.pathname.startsWith(item.path));

            return (
              <Link
                key={item.id}
                to={item.path}
                className={`relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'text-teal-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
                }`}
              >
                <AnimatePresence>
                  {isActive && (
                    <motion.div
                      layoutId="navActiveBackground"
                      className="absolute inset-0 bg-white rounded-lg shadow-sm"
                      style={{ zIndex: -1 }}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                    />
                  )}
                </AnimatePresence>
                <Icon className="w-4 h-4" />
                <span className="hidden md:inline">{item.label}</span>
              </Link>
            );
          })}
        </motion.nav>

      </div>

      <div className="right flex items-center gap-2">
        {/* Usage/Plan Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="hidden sm:flex items-center gap-2 bg-gray-100/80 backdrop-blur-sm rounded-lg px-3 py-1.5"
        >
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
            <span className="text-xs font-medium text-gray-600">Free</span>
          </div>
          {limit > 0 && (
            <>
              <div className="w-px h-3 bg-gray-300" />
              <span className="text-xs font-medium text-gray-900">{used}/{limit}</span>
            </>
          )}
        </motion.div>

        {/* User Button */}
        <UserButton
          afterSignOutUrl="/"
          appearance={{
            elements: {
              avatarBox: "w-8 h-8 ring-2 ring-white shadow-sm"
            }
          }}
        />
      </div>
    </div>
  );
}

