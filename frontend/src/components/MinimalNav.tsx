import { motion } from 'framer-motion';
import { Briefcase, FileText, User, MessageSquare } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

interface NavItem {
  icon: React.ReactNode;
  path: string;
  label: string;
}

export default function MinimalNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems: NavItem[] = [
    { icon: <Briefcase className="w-5 h-5" />, path: '/find-jobs', label: 'Jobs' },
    { icon: <FileText className="w-5 h-5" />, path: '/generate', label: 'Resume' },
    { icon: <User className="w-5 h-5" />, path: '/profile', label: 'Profile' },
    { icon: <MessageSquare className="w-5 h-5" />, path: '/happy', label: 'Chat' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4 }}
      className="fixed left-6 top-6 md:left-8 md:top-8 z-40 flex flex-col gap-3"
    >
      {navItems.map((item, index) => {
        const isActive = location.pathname === item.path;
        return (
          <motion.button
            key={item.path}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            onClick={() => navigate(item.path)}
            className="p-3 rounded-[12px] shadow-[0_2px_12px_rgba(0,0,0,0.08)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.12)] transition-all duration-200 cursor-pointer relative group"
            style={{
              backgroundColor: isActive ? 'var(--primary-600)' : 'var(--card)',
              color: isActive ? 'white' : 'var(--text-900)',
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.backgroundColor = 'var(--background-100)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.backgroundColor = 'var(--card)';
              }
            }}
            title={item.label}
          >
            {item.icon}

            {/* Tooltip */}
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              whileHover={{ opacity: 1, x: 0 }}
              className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              style={{
                backgroundColor: 'var(--text-900)',
                color: 'white',
                fontSize: '13px',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
              }}
            >
              {item.label}
            </motion.div>
          </motion.button>
        );
      })}
    </motion.div>
  );
}
