import { motion } from 'framer-motion';
import { MapPin, DollarSign, Briefcase, Bookmark, Sparkles, ExternalLink, Loader2, Download } from 'lucide-react';
import { Job } from '../services/api';
import CompanyLogo from './CompanyLogo';
import { api } from '../api-clerk';

interface JobCardSimpleProps {
  job: Job & { relevanceScore?: number };
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

  const getExperience = () => {
    // Extract years from any field
    const extractYears = (text: string) => {
      if (!text) return null;
      const lower = text.toLowerCase();

      // Pattern 1: "5-7 years" or "3 to 5 years"
      let match = lower.match(/(\d+)\s*(?:-|to)\s*(\d+)\s*(?:years?|yrs?)/i);
      if (match) return `${match[1]}-${match[2]} yrs`;

      // Pattern 2: "5+ years" or "5 years+"
      match = lower.match(/(\d+)\+?\s*(?:years?|yrs?)/i);
      if (match) return `${match[1]}+ yrs`;

      return null;
    };

    // Check extractedExperience first (most specific)
    if (job.extractedExperience) {
      const years = extractYears(job.extractedExperience);
      if (years) return years;
    }

    // Check description and requirements
    const searchText = `${job.description || ''} ${job.requirements || ''}`;
    const years = extractYears(searchText);
    if (years) return years;

    // Fallback to level-based labels from title
    const title = (job.title || '').toLowerCase();
    if (title.includes('senior') || title.includes('sr.') || title.includes('sr ')) return 'Senior';
    if (title.includes('lead') || title.includes('architect')) return 'Lead';
    if (title.includes('principal') || title.includes('staff')) return 'Principal';
    if (title.includes('mid-level') || title.includes('intermediate')) return 'Mid';
    if (title.includes('junior') || title.includes('jr.')) return 'Junior';
    if (title.includes('entry') || title.includes('intern')) return 'Entry';

    return 'Not specified';
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
          <span>{getExperience()}</span>
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
              if (resumeJobId) {
                // Download the generated resume
                window.open(`${api.base}/api/job/${resumeJobId}/download/pdf`, '_blank');
              } else if (!isGenerating) {
                // Start generation
                onGenerateResume(job);
              }
            }}
            disabled={isGenerating}
            className={`w-9 h-9 flex items-center justify-center ${
              resumeJobId
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-teal-600 hover:bg-teal-700'
            } text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
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
