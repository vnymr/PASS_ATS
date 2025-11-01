import { motion } from 'framer-motion';
import { Check, Loader2 } from 'lucide-react';

interface ProcessingStepProps {
  tool: string;
  status: 'processing' | 'complete';
  delay?: number;
}

export function ProcessingStep({ tool, status, delay = 0 }: ProcessingStepProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay }}
      className="flex items-center space-x-3 py-2"
    >
      {status === 'processing' ? (
        <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--text-600)' }} />
      ) : (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.2 }}
        >
          <Check className="w-4 h-4" style={{ color: 'var(--secondary-500)' }} />
        </motion.div>
      )}
      <span
        style={{
          color: status === 'processing' ? 'var(--text-600)' : 'var(--text-400)',
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
          fontSize: '14px',
        }}
      >
        {tool}
      </span>
    </motion.div>
  );
}
