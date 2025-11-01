import { motion } from 'framer-motion';
import { MapPin, Briefcase } from 'lucide-react';

interface JobCardProps {
  title: string;
  company: string;
  location: string;
  delay?: number;
}

export function JobCard({ title, company, location, delay = 0 }: JobCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="bg-card rounded-2xl p-5 border transition-all duration-300 hover:shadow-lg group cursor-pointer"
      style={{
        borderColor: 'var(--background-200)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}
    >
      <div className="mb-4">
        <h3
          className="mb-2 group-hover:opacity-80 transition-opacity"
          style={{
            color: 'var(--text-900)',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
            fontSize: '17px',
            fontWeight: 600,
            lineHeight: '1.4',
          }}
        >
          {title}
        </h3>

        <div className="flex items-center gap-1.5 mb-2">
          <Briefcase className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--text-600)' }} />
          <span
            style={{
              color: 'var(--text-700)',
              fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
              fontSize: '14px',
              fontWeight: 500,
            }}
          >
            {company}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--text-500)' }} />
          <span
            style={{
              color: 'var(--text-600)',
              fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
              fontSize: '13px',
              fontWeight: 400,
            }}
          >
            {location}
          </span>
        </div>
      </div>

      <button
        className="w-full py-2.5 rounded-xl transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
        style={{
          backgroundColor: 'var(--primary-600)',
          color: 'white',
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
          fontSize: '14px',
          fontWeight: 600,
        }}
        onClick={(e) => {
          e.stopPropagation();
          // Handle apply action
        }}
      >
        Apply Now
      </button>
    </motion.div>
  );
}
