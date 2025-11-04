import { motion } from 'framer-motion';
import { Briefcase, FileText, User, MessageSquare } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

interface NavItem {
  id: string;
  label: string;
  icon: typeof Briefcase;
  path: string;
}

export default function MinimalNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems: NavItem[] = [
    { id: 'jobs', label: 'Jobs', icon: Briefcase, path: '/find-jobs' },
    { id: 'resume', label: 'Resume', icon: FileText, path: '/generate' },
    { id: 'profile', label: 'Profile', icon: User, path: '/profile' },
    { id: 'chat', label: 'Chat', icon: MessageSquare, path: '/happy' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="fixed top-6 left-6 md:top-8 md:left-8 z-30"
    >
      <div
        className="flex flex-col gap-1 bg-white/80 backdrop-blur-sm rounded-2xl p-1.5"
        style={{
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        }}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className="relative p-2.5 rounded-xl transition-all duration-200"
              style={{
                backgroundColor: isActive ? 'rgba(0,0,0,0.04)' : 'transparent',
                color: isActive ? 'var(--text-900)' : 'var(--text-500)',
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
                  transition={{
                    type: 'spring',
                    bounce: 0.2,
                    duration: 0.6,
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
