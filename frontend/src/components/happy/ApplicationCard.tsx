import { motion } from 'framer-motion';
import { Calendar, MapPin } from 'lucide-react';
import { Badge } from '../../ui/Badge';

interface ApplicationCardProps {
  title: string;
  company: string;
  location: string;
  appliedDate: string;
  status: 'pending' | 'reviewing' | 'interview' | 'rejected' | 'accepted';
  delay?: number;
}

export function ApplicationCard({ title, company, location, appliedDate, status, delay = 0 }: ApplicationCardProps) {
  const statusConfig: Record<ApplicationCardProps['status'], { label: string; color?: string; style?: { backgroundColor: string; color: string } }> = {
    pending: { label: 'Pending', color: 'bg-[#FF9500] text-white' },
    reviewing: { label: 'Under Review', color: 'bg-primary text-primary-foreground' },
    interview: { label: 'Interview', style: { backgroundColor: 'var(--secondary-500)', color: 'white' } },
    rejected: { label: 'Not Selected', style: { backgroundColor: 'var(--text-400)', color: 'white' } },
    accepted: { label: 'Offer Received', style: { backgroundColor: 'var(--secondary-500)', color: 'white' } },
  };

  const config = statusConfig[status];

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
          <p className="mb-2" style={{ color: 'var(--text-600)' }}>{company}</p>
        </div>
        {config.style ? (
          <span
            className="px-2 py-1 rounded-md"
            style={{ ...config.style, fontSize: '12px' }}
          >
            {config.label}
          </span>
        ) : (
          <Badge className={config.color} style={{ fontSize: '12px' }}>
            {config.label}
          </Badge>
        )}
      </div>
      <div className="flex items-center space-x-4" style={{ color: 'var(--text-400)', fontSize: '13px' }}>
        <div className="flex items-center space-x-1.5">
          <MapPin className="w-3.5 h-3.5" />
          <span>{location}</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <Calendar className="w-3.5 h-3.5" />
          <span>{appliedDate}</span>
        </div>
      </div>
    </motion.div>
  );
}
