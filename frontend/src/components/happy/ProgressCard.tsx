import { motion } from 'framer-motion';
import { TrendingUp } from 'lucide-react';

interface ProgressCardProps {
  title: string;
  count: number;
  total: number;
  description: string;
  delay?: number;
}

export function ProgressCard({ title, count, total, description, delay = 0 }: ProgressCardProps) {
  const percentage = (count / total) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="bg-card rounded-[16px] p-5 shadow-[0_2px_12px_rgba(0,0,0,0.08)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.12)] transition-shadow duration-300"
    >
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-foreground">{title}</h4>
        <TrendingUp className="w-4 h-4" style={{ color: 'var(--secondary-500)' }} />
      </div>
      <div className="mb-3">
        <div className="flex items-baseline space-x-1 mb-2">
          <span className="text-foreground" style={{ fontSize: '28px', fontWeight: 600 }}>
            {count}
          </span>
          <span style={{ color: 'var(--text-400)', fontSize: '14px' }}>
            / {total}
          </span>
        </div>
        <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--background-100)' }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.8, delay: delay + 0.2 }}
            className="h-full rounded-full"
            style={{ backgroundColor: 'var(--primary-600)' }}
          />
        </div>
      </div>
      <p style={{ color: 'var(--text-600)', fontSize: '14px' }}>
        {description}
      </p>
    </motion.div>
  );
}
