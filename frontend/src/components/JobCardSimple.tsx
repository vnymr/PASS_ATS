import { motion } from 'framer-motion';
import { MapPin, Bookmark, Sparkles, ExternalLink, Loader2, Download, Zap, Clock } from 'lucide-react';
import { Job } from '../services/api';
import CompanyLogo from './CompanyLogo';
import { api } from '../api-clerk';

interface JobCardSimpleProps {
  job: Job;
  onViewDetails: (job: Job) => void;
  onBookmark?: (jobId: string) => void;
  onGenerateResume?: (job: Job) => void;
  onViewJob?: (url: string) => void;
  onAutoApply?: (job: Job) => void;
  delay?: number;
  isBookmarked?: boolean;
  isGenerating?: boolean;
  resumeJobId?: string;
}

export default function JobCardSimple({
  job,
  onViewDetails,
  onBookmark,
  onGenerateResume,
  onViewJob,
  onAutoApply,
  delay = 0,
  isBookmarked = false,
  isGenerating = false,
  resumeJobId,
}: JobCardSimpleProps) {

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'Recently';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    const weeks = Math.floor(diffDays / 7);
    return `${weeks}w ago`;
  };

  const getExperience = () => {
    const extractYears = (text: string) => {
      if (!text) return null;
      const lower = text.toLowerCase();
      let match = lower.match(/(\d+)\s*(?:-|to)\s*(\d+)\s*(?:years?|yrs?)/i);
      if (match) return `${match[1]}-${match[2]} yrs`;
      match = lower.match(/(\d+)\+?\s*(?:years?|yrs?)/i);
      if (match) return `${match[1]}+ yrs`;
      return null;
    };

    if (job.extractedExperience) {
      const years = extractYears(job.extractedExperience);
      if (years) return years;
    }

    const searchText = `${job.description || ''} ${job.requirements || ''}`;
    const years = extractYears(searchText);
    if (years) return years;

    return null;
  };

  // Always show match score - use 0 as fallback if not available
  const matchScore = job.relevanceScore !== undefined && job.relevanceScore !== null
    ? Math.round(job.relevanceScore * 100)
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay }}
      className="group bg-white rounded-xl border border-gray-200 hover:border-teal-300 transition-all duration-200 cursor-pointer"
      onClick={() => onViewDetails(job)}
    >
      <div className="p-4">
        {/* Header Row */}
        <div className="flex items-start gap-3">
          <CompanyLogo company={job.company} size={40} />

          <div className="flex-1 min-w-0">
            <h3
              className="text-sm font-semibold text-gray-900 truncate group-hover:text-teal-700 transition-colors"
              style={{ fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif' }}
            >
              {job.title}
            </h3>
            <p
              className="text-sm text-gray-500 truncate"
              style={{ fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif' }}
            >
              {job.company}
            </p>
          </div>

          {/* Match Score Badge - Always Show */}
          <div
            className={`px-2 py-0.5 rounded-md text-xs font-semibold ${
              matchScore === null
                ? 'bg-gray-100 text-gray-500'
                : matchScore >= 80
                  ? 'bg-teal-50 text-teal-700'
                  : matchScore >= 60
                    ? 'bg-amber-50 text-amber-700'
                    : matchScore >= 40
                      ? 'bg-orange-50 text-orange-600'
                      : 'bg-red-50 text-red-600'
            }`}
            title={matchScore !== null ? `${matchScore}% match with your profile` : 'Match score not available'}
          >
            {matchScore !== null ? `${matchScore}%` : '--'}
          </div>
        </div>

        {/* Meta Row */}
        <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatDate(job.postedDate)}
          </span>
          {getExperience() && (
            <span>{getExperience()}</span>
          )}
          <span className="flex items-center gap-1 truncate">
            <MapPin className="w-3 h-3" />
            {job.location || 'Remote'}
          </span>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
          {/* Left: AI Ready badge */}
          <div>
            {job.aiApplyable && (
              <span className="inline-flex items-center gap-1 text-xs text-purple-600 font-medium">
                <Zap className="w-3 h-3" />
                AI Ready
              </span>
            )}
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1.5">
            {onGenerateResume && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (resumeJobId) {
                    window.open(`${api.base}/api/job/${resumeJobId}/download/pdf`, '_blank');
                  } else if (!isGenerating) {
                    onGenerateResume(job);
                  }
                }}
                disabled={isGenerating}
                className={`p-1.5 rounded-lg transition-colors ${
                  resumeJobId
                    ? 'text-teal-600 hover:bg-teal-50'
                    : 'text-gray-400 hover:text-teal-600 hover:bg-gray-50'
                } disabled:opacity-50`}
                title={resumeJobId ? 'Download Resume' : isGenerating ? 'Generating...' : 'Generate Resume'}
              >
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : resumeJobId ? (
                  <Download className="w-4 h-4" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
              </button>
            )}

            {onViewJob && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onViewJob(job.applyUrl);
                }}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
                title="View Job"
              >
                <ExternalLink className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={(e) => {
                e.stopPropagation();
                onBookmark?.(job.id);
              }}
              className={`p-1.5 rounded-lg transition-colors ${
                isBookmarked
                  ? 'text-teal-600 bg-teal-50'
                  : 'text-gray-400 hover:text-teal-600 hover:bg-gray-50'
              }`}
              title={isBookmarked ? 'Bookmarked' : 'Bookmark'}
            >
              <Bookmark className="w-4 h-4" fill={isBookmarked ? 'currentColor' : 'none'} />
            </button>

            {onAutoApply && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAutoApply(job);
                }}
                className="ml-1 px-3 py-1.5 bg-teal-600 text-white text-xs font-medium rounded-lg hover:bg-teal-700 transition-colors"
              >
                Apply
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
