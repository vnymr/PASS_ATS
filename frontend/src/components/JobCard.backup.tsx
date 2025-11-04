import { Job } from '../services/api';
import { MapPin, Briefcase, DollarSign, Clock, ExternalLink, Sparkles, Zap } from 'lucide-react';
import { htmlToPlainText } from '../utils/htmlCleaner';
import { motion } from 'framer-motion';

interface JobCardProps {
  job: Job & { relevanceScore?: number };
  onGenerateResume: (job: Job) => void;
  onViewJob: (url: string) => void;
  onAutoApply?: (jobId: string) => void;
  compact?: boolean;
  onClick?: (job: Job) => void;
  showMatchScore?: boolean;
  delay?: number;
}

export default function JobCard({ job, onGenerateResume, onViewJob, onAutoApply, compact = false, onClick, showMatchScore = false, delay = 0 }: JobCardProps) {
  // Format date to relative time
  const formatDate = (dateString: string) => {
    if (!dateString) return 'Recently posted';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return 'Recently posted';
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    const months = Math.floor(diffDays / 30);
    return `${months}mo ago`;
  };

  const matchScore = job.relevanceScore ? Math.round(job.relevanceScore * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      onClick={() => onClick?.(job)}
      className={`group relative rounded-2xl cursor-pointer transition-all duration-300 hover:shadow-lg bg-card border ${
        compact ? 'p-4' : 'p-5'
      }`}
      style={{
        borderColor: 'var(--background-200)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}
    >
      {/* Header Section */}
      <div className="mb-4">
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1">
            <h3
              className="mb-2 group-hover:opacity-80 transition-opacity"
              style={{
                color: 'var(--text-900)',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
                fontSize: compact ? '15px' : '17px',
                fontWeight: 600,
                lineHeight: '1.4',
              }}
            >
              {job.title || 'Untitled role'}
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
                {job.company || 'Unknown Company'}
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
                {job.location || 'Location not specified'}
              </span>
            </div>
          </div>

          {/* Match Score Badge */}
          {matchScore > 0 && (
            <div
              className="px-3 py-1.5 rounded-xl ml-3"
              style={{
                backgroundColor: matchScore >= 90 ? '#10B981' : matchScore >= 80 ? '#3B82F6' : matchScore >= 70 ? '#F59E0B' : '#6B7280',
                color: 'white',
              }}
            >
              <div
                style={{
                  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
                  fontSize: '14px',
                  fontWeight: 700,
                }}
              >
                {matchScore}%
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Metadata Row */}
      {!compact && (
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          {job.salary && (
            <div className="flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5" style={{ color: 'var(--text-500)' }} />
              <span style={{ color: 'var(--text-600)', fontSize: '13px' }}>
                {job.salary}
              </span>
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" style={{ color: 'var(--text-500)' }} />
            <span style={{ color: 'var(--text-600)', fontSize: '13px' }}>
              {formatDate(job.postedDate)}
            </span>
          </div>
        </div>
      )}

      {/* Description */}
      {!compact && job.description && (
        <p
          className="mb-4 line-clamp-2"
          style={{
            color: 'var(--text-600)',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
            fontSize: '14px',
            lineHeight: '1.6',
          }}
        >
          {htmlToPlainText(job.description)}
        </p>
      )}

      {/* Action Buttons */}
      {!compact && (
        <div className="flex gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onGenerateResume(job);
            }}
            className="flex-1 py-2.5 rounded-xl transition-all duration-200 hover:opacity-90 active:scale-[0.98] flex items-center justify-center gap-2"
            style={{
              backgroundColor: 'var(--primary-600)',
              color: 'white',
              fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
              fontSize: '14px',
              fontWeight: 600,
            }}
          >
            <Sparkles className="w-4 h-4" />
            <span>AI Resume</span>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onViewJob(job.applyUrl);
            }}
            className="px-4 py-2.5 rounded-xl transition-all duration-200 hover:opacity-90 active:scale-[0.98] flex items-center justify-center gap-2"
            style={{
              backgroundColor: 'var(--background-100)',
              color: 'var(--text-700)',
              fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
              fontSize: '14px',
              fontWeight: 600,
            }}
          >
            <ExternalLink className="w-4 h-4" />
            <span>View</span>
          </button>

          {onAutoApply && job.aiApplyable && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAutoApply(job.id);
              }}
              className="px-4 py-2.5 rounded-xl transition-all duration-200 hover:opacity-90 active:scale-[0.98] flex items-center justify-center gap-2"
              style={{
                backgroundColor: 'var(--secondary-600)',
                color: 'white',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
                fontSize: '14px',
                fontWeight: 600,
              }}
            >
              <Zap className="w-4 h-4" />
              <span>Auto Apply</span>
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}
