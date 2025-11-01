import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

interface ActionCardProps {
  title: string;
  description: string;
  actionLabel: string;
  priority?: 'high' | 'medium' | 'low';
  delay?: number;
}

export function ActionCard({ title, description, actionLabel, priority = 'medium', delay = 0 }: ActionCardProps) {
  const priorityColors = {
    high: '#FF3B30',
    medium: '#FF9500',
    low: 'var(--secondary-500)',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="bg-card rounded-[16px] p-5 shadow-[0_2px_12px_rgba(0,0,0,0.08)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.12)] transition-shadow duration-300"
    >
      <div className="flex items-start justify-between mb-3">
        <h4 className="text-foreground flex-1">{title}</h4>
        <div
          className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
          style={{ backgroundColor: priorityColors[priority] }}
        />
      </div>
      <p className="mb-4" style={{ color: 'var(--text-600)', fontSize: '14px', lineHeight: '1.5' }}>
        {description}
      </p>
      <button
        className="flex items-center space-x-2 text-foreground transition-opacity duration-200 hover:opacity-70"
      >
        <span style={{ fontSize: '14px', fontWeight: 500 }}>{actionLabel}</span>
        <ArrowRight className="w-4 h-4" />
      </button>
    </motion.div>
  );
}
