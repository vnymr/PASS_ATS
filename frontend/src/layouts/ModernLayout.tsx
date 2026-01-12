import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { UserButton } from '@clerk/clerk-react';
import MinimalNav from '../components/MinimalNav';
import ProfileCompletionBanner from '../components/ProfileCompletionBanner';
import { motion } from 'framer-motion';
import {
  Briefcase,
  FileText,
  User,
  MessageSquare,
  ListChecks,
} from 'lucide-react';

interface ModernLayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  id: string;
  label: string;
  icon: typeof Briefcase;
  path: string;
}

export default function ModernLayout({ children }: ModernLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const navItems: NavItem[] = [
    { id: 'resume', label: 'Resume', icon: FileText, path: '/generate' },
    { id: 'chat', label: 'Coach', icon: MessageSquare, path: '/happy' },
    { id: 'applications', label: 'Apps', icon: ListChecks, path: '/applications' },
    { id: 'profile', label: 'Profile', icon: User, path: '/profile' },
  ];

  return (
    <div className="h-screen bg-background flex overflow-hidden">
      {/* Minimal Left Navigation - hidden on mobile */}
      <MinimalNav />

      {/* Main Content Column */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Profile Completion Banner */}
        <ProfileCompletionBanner />

        {/* User Button - Top Right within content area (hidden on mobile) */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="hidden lg:flex justify-end px-4 lg:px-8 pt-4 flex-shrink-0"
        >
          <div className="p-1 bg-card rounded-full shadow-[0_2px_12px_rgba(0,0,0,0.08)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.12)] transition-all duration-200">
            <UserButton
              afterSignOutUrl="/"
              appearance={{
                elements: {
                  avatarBox: 'w-9 h-9',
                  userButtonPopoverCard: 'shadow-lg'
                }
              }}
            />
          </div>
        </motion.div>

        {/* Main Content */}
        <main className="w-full flex-1 min-h-0 pb-24 lg:pb-0 overflow-y-auto">
          <div className="max-w-[1200px] mx-auto h-full">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation - only visible on mobile */}
      <motion.nav
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200/60 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] z-50"
      >
        <div className="flex items-center justify-around px-2 py-2 safe-area-inset-bottom">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center justify-center min-w-[56px] py-1.5 px-2 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'text-primary bg-primary/10'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium mt-0.5">{item.label}</span>
              </button>
            );
          })}
          {/* User Avatar in mobile nav */}
          <div className="flex flex-col items-center justify-center min-w-[56px] py-1.5 px-2">
            <UserButton
              afterSignOutUrl="/"
              appearance={{
                elements: {
                  avatarBox: 'w-6 h-6',
                  userButtonPopoverCard: 'shadow-lg'
                }
              }}
            />
            <span className="text-[10px] font-medium mt-0.5 text-slate-500">Account</span>
          </div>
        </div>
      </motion.nav>
    </div>
  );
}
