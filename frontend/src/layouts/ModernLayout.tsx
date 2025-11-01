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
    <div className="min-h-screen bg-background">
      {/* Minimal Left Navigation */}
      <MinimalNav />

      {/* User Button - Top Right */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="fixed top-6 right-6 md:top-8 md:right-8 z-40"
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
      <main className="w-full min-h-screen px-4 lg:px-8 pt-8 pb-8 md:pl-32">
        <div className="max-w-[1200px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
