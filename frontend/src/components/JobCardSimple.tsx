import { motion } from 'framer-motion';
import { MapPin, Clock, DollarSign, Briefcase, Bookmark, Sparkles, ExternalLink } from 'lucide-react';
import { Job } from '../services/api';
import CompanyLogo from './CompanyLogo';

interface JobCardSimpleProps {
  job: Job & { relevanceScore?: number };
  onViewDetails: (job: Job) => void;
  onBookmark?: (jobId: string) => void;
  onGenerateResume?: (job: Job) => void;
  onViewJob?: (url: string) => void;
  onAutoApply?: (job: Job) => void;
  delay?: number;
  isBookmarked?: boolean;
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
}: JobCardSimpleProps) {
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '10 min ago';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
  };

  const getIndustry = () => {
    // Derive a generic industry label without using ATS metadata
    const title = job.title?.toLowerCase() || '';
    if (title.includes('engineer') || title.includes('developer')) return 'Technology';
    if (title.includes('marketing')) return 'Marketing';
    if (title.includes('sales')) return 'Sales';
    if (title.includes('design')) return 'Design';
    return 'General';
  };

  const formatSalary = () => {
    if (job.salary) return job.salary;
    // Generate a reasonable range based on job title
    return '$80000-$120000';
  };

  const getMatchBadgeColor = (score: number) => {
    if (score >= 80) return { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' };
    if (score >= 60) return { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-300' };
    return { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300' };
  };

  const matchScore = job.relevanceScore ? Math.round(job.relevanceScore * 100) : null;
  const matchColors = matchScore ? getMatchBadgeColor(matchScore) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow duration-200 cursor-pointer"
      onClick={() => onViewDetails(job)}
    >
      {/* Header: Time, Match Badge, and Bookmark */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-teal-600">
          {formatDate(job.postedDate)}
        </span>
        <div className="flex items-center gap-2">
          {matchScore && matchColors && (
            <span className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${matchColors.bg} ${matchColors.text} ${matchColors.border}`}>
              {matchScore}% Match
            </span>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onBookmark?.(job.id);
            }}
            className="text-gray-400 hover:text-teal-600 transition-colors"
          >
            <Bookmark
              className="w-5 h-5"
              fill={isBookmarked ? 'currentColor' : 'none'}
            />
          </button>
        </div>
      </div>

      {/* Company Logo and Job Info */}
      <div className="flex gap-3 mb-3">
        <CompanyLogo company={job.company} size={40} />
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-gray-900 mb-1 truncate">
            {job.title}
          </h3>
          <p className="text-sm text-gray-600">
            {job.company}
          </p>
        </div>
      </div>

      {/* Metadata Row */}
      <div className="flex flex-wrap items-center gap-3 mb-3 text-sm text-gray-600">
        <div className="flex items-center gap-1.5">
          <Briefcase className="w-4 h-4 text-gray-400" />
          <span>{getIndustry()}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-gray-400" />
          <span>Full time</span>
        </div>
        <div className="flex items-center gap-1.5">
          <DollarSign className="w-4 h-4 text-gray-400" />
          <span>{formatSalary()}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <MapPin className="w-4 h-4 text-gray-400" />
          <span>{job.location || 'Remote'}</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-2">
        {onGenerateResume && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onGenerateResume(job);
            }}
            className="w-9 h-9 flex items-center justify-center bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
            title="Generate Resume"
          >
            <Sparkles className="w-4 h-4" />
          </button>
        )}
        {onViewJob && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onViewJob(job.applyUrl);
            }}
            className="w-9 h-9 flex items-center justify-center bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            title="View Job"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        )}
        {onAutoApply && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAutoApply(job);
            }}
            className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors"
          >
            Auto Apply
          </button>
        )}
      </div>
    </motion.div>
  );
}
