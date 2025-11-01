import { motion } from 'framer-motion';

interface SectionHeaderProps {
  title: string;
  count?: number;
  delay?: number;
}

export function SectionHeader({ title, count, delay = 0 }: SectionHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="flex items-center space-x-2 mb-4"
    >
      <h3
        className="text-foreground"
        style={{
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
          fontSize: '16px',
          fontWeight: 600,
        }}
      >
        {title}
      </h3>
      {count !== undefined && (
        <span
          style={{
            color: 'var(--text-400)',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
            fontSize: '14px',
          }}
        >
          ({count})
        </span>
      )}
    </motion.div>
  );
}
