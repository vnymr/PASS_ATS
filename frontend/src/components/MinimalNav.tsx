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
    { id: 'resume', label: 'Resume', icon: FileText, path: '/generate' },
    { id: 'chat', label: 'AI Coach', icon: MessageSquare, path: '/happy' },
    { id: 'profile', label: 'Profile', icon: User, path: '/profile' },
    { id: 'jobs', label: 'Jobs', icon: Briefcase, path: '/find-jobs' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="fixed top-6 left-6 md:top-8 md:left-8 z-30"
    >
      <div
        className="flex flex-col gap-1 bg-white/90 backdrop-blur-sm rounded-2xl p-2"
        style={{
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        }}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className="relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-left"
              style={{
                backgroundColor: isActive ? 'rgba(62, 172, 167, 0.1)' : 'transparent',
                color: isActive ? 'var(--primary)' : 'var(--text-500)',
              }}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-medium whitespace-nowrap">{item.label}</span>

              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 rounded-xl"
                  style={{
                    backgroundColor: 'rgba(62, 172, 167, 0.1)',
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
