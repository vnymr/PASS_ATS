import { motion } from 'framer-motion';
import { X, Calendar, TrendingUp } from 'lucide-react';
import { RoutineCard } from './RoutineCard';
import { ProgressCard } from './ProgressCard';

interface RoutinesPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const mockRoutines = [
  { title: 'Morning Job Search', time: '9:00 AM', description: 'Review new job postings and update applications', completed: true },
  { title: 'LinkedIn Networking', time: '11:00 AM', description: 'Connect with 5 professionals in your field', completed: true },
  { title: 'Skill Development', time: '2:00 PM', description: 'Complete one course module or tutorial', completed: false },
  { title: 'Evening Follow-ups', time: '5:00 PM', description: 'Send thank you emails and check application status', completed: false },
];

const mockProgress = [
  { title: 'Applications Sent', count: 24, total: 50, description: 'You\'re making great progress!' },
  { title: 'Profile Completion', count: 85, total: 100, description: 'Almost there, add 2 more skills' },
  { title: 'Interview Success', count: 3, total: 8, description: 'Keep practicing your responses' },
];

export function RoutinesPanel({ isOpen, onClose }: RoutinesPanelProps) {
  const completedRoutines = mockRoutines.filter(r => r.completed).length;

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/20 z-40"
        />
      )}

      {/* Panel */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: isOpen ? 0 : '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed top-0 right-0 h-full w-full md:w-[440px] bg-background shadow-2xl z-50 overflow-y-auto"
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2
                className="text-foreground mb-1"
                style={{
                  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
                  fontSize: '20px',
                  fontWeight: 600,
                }}
              >
                Your Dashboard
              </h2>
              <p
                style={{
                  color: 'var(--text-600)',
                  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
                  fontSize: '14px',
                }}
              >
                Track your job search journey
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-[8px] transition-colors duration-200"
              style={{
                backgroundColor: 'transparent',
                color: 'var(--text-600)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--background-100)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Daily Routines Section */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-foreground" />
                <h3
                  className="text-foreground"
                  style={{
                    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
                    fontSize: '16px',
                    fontWeight: 600,
                  }}
                >
                  Today's Routine
                </h3>
              </div>
              <span
                style={{
                  color: 'var(--text-600)',
                  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
                  fontSize: '13px',
                }}
              >
                {completedRoutines}/{mockRoutines.length} completed
              </span>
            </div>

            <div className="space-y-3">
              {mockRoutines.map((routine, index) => (
                <RoutineCard
                  key={index}
                  title={routine.title}
                  time={routine.time}
                  description={routine.description}
                  completed={routine.completed}
                  delay={0}
                />
              ))}
            </div>
          </div>

          {/* Progress Section */}
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <TrendingUp className="w-4 h-4 text-foreground" />
              <h3
                className="text-foreground"
                style={{
                  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
                  fontSize: '16px',
                  fontWeight: 600,
                }}
              >
                Your Progress
              </h3>
            </div>

            <div className="space-y-3">
              {mockProgress.map((progress, index) => (
                <ProgressCard
                  key={index}
                  title={progress.title}
                  count={progress.count}
                  total={progress.total}
                  description={progress.description}
                  delay={0}
                />
              ))}
            </div>
          </div>

          {/* Daily Tip */}
          <div className="mt-8 rounded-[16px] p-5" style={{ backgroundColor: 'var(--background-50)' }}>
            <h4
              className="text-foreground mb-2"
              style={{
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
                fontSize: '14px',
                fontWeight: 600,
              }}
            >
              💡 Tip of the Day
            </h4>
            <p
              style={{
                color: 'var(--text-600)',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
                fontSize: '13px',
                lineHeight: '1.5',
              }}
            >
              Personalize your job applications! Mention specific projects from the company that excite you.
            </p>
          </div>
        </div>
      </motion.div>
    </>
  );
}
