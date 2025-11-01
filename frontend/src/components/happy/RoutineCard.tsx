import { motion } from 'framer-motion';
import { Clock, CheckCircle2 } from 'lucide-react';

interface RoutineCardProps {
  title: string;
  time: string;
  description: string;
  completed?: boolean;
  delay?: number;
}

export function RoutineCard({ title, time, description, completed = false, delay = 0 }: RoutineCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="bg-card rounded-[16px] p-5 shadow-[0_2px_12px_rgba(0,0,0,0.08)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.12)] transition-shadow duration-300"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h4 className="text-foreground mb-1">{title}</h4>
          <div className="flex items-center space-x-2" style={{ color: 'var(--text-600)' }}>
            <Clock className="w-3.5 h-3.5" />
            <span style={{ fontSize: '14px' }}>{time}</span>
          </div>
        </div>
        {completed && (
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--secondary-500)' }} />
        )}
      </div>
      <p style={{ color: 'var(--text-600)', fontSize: '14px', lineHeight: '1.5' }}>
        {description}
      </p>
    </motion.div>
  );
}
