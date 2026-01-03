import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Briefcase,
  FileText,
  User,
  MessageSquare,
  ListChecks,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
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
  const [collapsed, setCollapsed] = useState(false);

  const navItems: NavItem[] = [
    { id: 'resume', label: 'Resume', icon: FileText, path: '/generate' },
    { id: 'chat', label: 'AI Coach', icon: MessageSquare, path: '/happy' },
    { id: 'applications', label: 'Applications', icon: ListChecks, path: '/applications' },
    { id: 'profile', label: 'Profile', icon: User, path: '/profile' },
    { id: 'jobs', label: 'Jobs', icon: Briefcase, path: '/find-jobs' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: -24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="hidden lg:flex sticky top-0 h-screen"
    >
      <motion.aside
        animate={{ width: collapsed ? 64 : 220 }}
        transition={{ type: 'spring', stiffness: 180, damping: 20 }}
        className="h-full bg-white/90 backdrop-blur-sm rounded-r-3xl border-r border-white/60 shadow-[0_10px_40px_rgba(15,23,42,0.08)] flex flex-col p-3"
      >
        <div className="flex items-center justify-end mb-8">
          <button
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            onClick={() => setCollapsed((prev) => !prev)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        <nav className="flex-1 flex flex-col gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
            const activeStyles = isActive
              ? 'bg-primary/10 text-primary shadow-[inset_0_0_0_1px_rgba(61,172,167,0.3)]'
              : 'text-slate-500 hover:bg-slate-50';

          return (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
                className={`group relative flex items-center gap-1 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all duration-200 overflow-hidden ${activeStyles}`}
            >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span
                  className={`flex items-center gap-1 whitespace-nowrap transition-all duration-200 ${
                    collapsed ? 'opacity-0 -translate-x-2' : 'opacity-100 translate-x-0'
                  }`}
                >
                  {item.label}
                  {item.id === 'chat' && !collapsed && (
                    <span className="text-[9px] font-semibold uppercase tracking-wide text-primary/80 bg-primary/10 rounded-full px-1.5 py-[1px]">
                      Beta
                    </span>
                  )}
                </span>
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                    className="absolute inset-0 rounded-2xl bg-primary/10 -z-10"
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
        </nav>

        <div className="mt-auto pt-4 border-t border-white/60">
          <div
            className={`text-xs text-slate-400 transition-opacity duration-200 ${
              collapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'
            }`}
          >
            Stay on top of your job hunt.
          </div>
        </div>
      </motion.aside>
    </motion.div>
  );
}
