import React from 'react';
import { useLocation } from 'react-router-dom';
import { UserButton } from '@clerk/clerk-react';
import MinimalNav from '../components/MinimalNav';
import { motion } from 'framer-motion';

interface ModernLayoutProps {
  children: React.ReactNode;
}

export default function ModernLayout({ children }: ModernLayoutProps) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background flex">
      {/* Minimal Left Navigation - now part of the layout column */}
      <MinimalNav />

      {/* Main Content Column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* User Button - Top Right within content area */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="flex justify-end px-4 lg:px-8 pt-6 md:pt-8"
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
        <main className="w-full flex-1 px-4 lg:px-8 pb-8">
          <div className="max-w-[1200px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
