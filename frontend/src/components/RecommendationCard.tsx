import { motion } from 'framer-motion';
import { MapPin, Briefcase, DollarSign, Users, Calendar, X, ExternalLink, Sparkles } from 'lucide-react';
import { Job } from '../services/api';

interface RecommendationCardProps {
  job: Job & {
    relevanceScore?: number;
    matchReasons?: string[];
    missingSkills?: string[];
    requiredSkills?: string[];
    yourSkills?: string[];
  };
  delay?: number;
  onNotInterested?: (jobId: string) => void;
  onGenerateResume?: (job: Job) => void;
  onViewJob?: (url: string) => void;
}

export function RecommendationCard({
  job,
  delay = 0,
  onNotInterested,
  onGenerateResume,
  onViewJob
}: RecommendationCardProps) {
  const matchScore = job.relevanceScore ? Math.round(job.relevanceScore * 100) : 0;

  const formatDate = (dateString: string | null | undefined) => {
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="bg-card rounded-2xl p-6 border transition-all duration-300 hover:shadow-lg group relative"
      style={{
        borderColor: 'var(--background-200)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <h3
                className="mb-2 group-hover:opacity-80 transition-opacity"
                style={{
                  color: 'var(--text-900)',
                  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
                  fontSize: '18px',
                  fontWeight: 600,
                  lineHeight: '1.4',
                }}
              >
                {job.title || 'Untitled role'}
              </h3>

              <div className="flex items-center gap-3 mb-2">
                <div className="flex items-center gap-1.5">
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

              <div className="flex items-center gap-3 text-sm">
                {job.salary && (
                  <div className="flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5" style={{ color: 'var(--text-500)' }} />
                    <span style={{ color: 'var(--text-600)', fontSize: '13px' }}>
                      {job.salary}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" style={{ color: 'var(--text-500)' }} />
                  <span style={{ color: 'var(--text-600)', fontSize: '13px' }}>
                    {formatDate(job.postedDate)}
                  </span>
                </div>
              </div>
            </div>

            {/* Match Score */}
            {matchScore > 0 && (
              <div className="ml-4">
                <div
                  className="px-4 py-2 rounded-xl"
                  style={{
                    backgroundColor: matchScore >= 90 ? '#10B981' : matchScore >= 80 ? '#3B82F6' : matchScore >= 70 ? '#F59E0B' : '#6B7280',
                    color: 'white',
                  }}
                >
                  <div className="text-center">
                    <div
                      style={{
                        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
                        fontSize: '20px',
                        fontWeight: 700,
                        lineHeight: '1',
                      }}
                    >
                      {matchScore}%
                    </div>
                    <div
                      style={{
                        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
                        fontSize: '11px',
                        fontWeight: 500,
                        opacity: 0.9,
                        marginTop: '2px',
                      }}
                    >
                      match
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Not Interested Button */}
        {onNotInterested && (
          <button
            onClick={() => onNotInterested(job.id)}
            className="ml-2 p-2 rounded-lg hover:bg-black/5 transition-all duration-200"
            style={{ color: 'var(--text-500)' }}
            title="Not interested"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Match Reasons */}
      {job.matchReasons && job.matchReasons.length > 0 && (
        <div className="mb-4">
          <div
            className="mb-2"
            style={{
              color: 'var(--text-700)',
              fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            Why you're a good fit:
          </div>
          <ul className="space-y-1">
            {job.matchReasons.slice(0, 3).map((reason, idx) => (
              <li
                key={idx}
                style={{
                  color: 'var(--text-600)',
                  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
                  fontSize: '13px',
                  paddingLeft: '16px',
                  position: 'relative',
                }}
              >
                <span style={{ position: 'absolute', left: '0' }}>•</span>
                {reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Missing Skills */}
      {job.missingSkills && job.missingSkills.length > 0 && (
        <div className="mb-4">
          <div
            className="mb-2"
            style={{
              color: 'var(--text-700)',
              fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            Skills to learn:
          </div>
          <div className="flex flex-wrap gap-2">
            {job.missingSkills.map((skill, idx) => (
              <span
                key={idx}
                className="px-3 py-1 rounded-lg"
                style={{
                  backgroundColor: 'var(--background-100)',
                  color: 'var(--text-700)',
                  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
                  fontSize: '12px',
                  fontWeight: 500,
                }}
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 mt-5 pt-4 border-t" style={{ borderColor: 'var(--background-200)' }}>
        <button
          onClick={() => onGenerateResume?.(job)}
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
          AI Resume
        </button>

        <button
          onClick={() => onViewJob?.(job.applyUrl)}
          className="px-4 py-2.5 rounded-xl transition-all duration-200 hover:opacity-90 active:scale-[0.98] flex items-center gap-2"
          style={{
            backgroundColor: 'var(--background-100)',
            color: 'var(--text-700)',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
            fontSize: '14px',
            fontWeight: 600,
          }}
        >
          <ExternalLink className="w-4 h-4" />
          View Job
        </button>
      </div>
    </motion.div>
  );
}
