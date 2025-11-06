import { useState } from 'react';
import { Job } from '../services/api';
import { X, MapPin, Clock, DollarSign, Briefcase, ExternalLink, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { htmlToPlainText } from '../utils/htmlCleaner';
import CompanyLogo from './CompanyLogo';

interface JobDetailPanelSimpleProps {
  job: (Job & {
    relevanceScore?: number;
    matchBreakdown?: {
      experienceLevel: number;
      skills: number;
      industry: number;
    };
    matchingSkills?: string[];
    missingSkills?: string[];
  }) | null;
  isOpen: boolean;
  onClose: () => void;
  onGenerateResume: (job: Job) => void;
  onViewJob: (url: string) => void;
  onAutoApply?: (job: Job) => void;
}

export default function JobDetailPanelSimple({
  job,
  isOpen,
  onClose,
  onGenerateResume,
  onViewJob,
  onAutoApply
}: JobDetailPanelSimpleProps) {
  const [isAnalysisExpanded, setIsAnalysisExpanded] = useState(true);

  if (!job || !isOpen) return null;

  const cleanDescription = htmlToPlainText(job.description);
  const cleanRequirements = job.requirements ? htmlToPlainText(job.requirements) : null;

  const matchScore = job.relevanceScore ? Math.round(job.relevanceScore * 100) : null;
  const hasMatchData = matchScore && (job.matchBreakdown || job.matchingSkills || job.missingSkills);

  const getMatchBadgeColor = (score: number) => {
    if (score >= 80) return { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' };
    if (score >= 60) return { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-300' };
    return { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300' };
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'Recently posted';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return 'Recently posted';
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
  };

  return (
    <div className="flex-1 bg-white rounded-xl border border-gray-200 border-b-0 shadow-lg max-h-[85vh] overflow-y-auto">
      <div className="p-6 pb-0 space-y-6">
        {/* Header */}
        <div className="pb-6 border-b border-gray-200">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <CompanyLogo company={job.company} size={56} />
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-gray-900 mb-1 line-clamp-2">
                {job.title}
              </h2>
              <p className="text-base text-gray-600 mb-2">{job.company}</p>
              <span className="text-sm text-teal-600 font-medium">
                {formatDate(job.postedDate)}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Job Metadata & Action Buttons */}
        <div className="flex items-center justify-between">
          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-gray-400" />
              <span>{job.location || 'Remote'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" />
              <span>Full-time</span>
            </div>
            {job.salary && (
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-gray-400" />
                <span>{job.salary}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onGenerateResume(job)}
              className="w-10 h-10 flex items-center justify-center bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
              title="Generate Resume"
            >
              <Sparkles className="w-5 h-5" />
            </button>
            <button
              onClick={() => onViewJob(job.applyUrl)}
              className="w-10 h-10 flex items-center justify-center bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              title="View Job"
            >
              <ExternalLink className="w-5 h-5" />
            </button>
            {onAutoApply && (
              <button
                onClick={() => onAutoApply(job)}
                className="px-6 py-2.5 bg-teal-600 text-white text-sm font-semibold rounded-lg hover:bg-teal-700 transition-colors"
              >
                Auto Apply
              </button>
            )}
          </div>
        </div>
        </div>

        {/* Match Analysis - Collapsible */}
        {hasMatchData && (
          <div className="bg-teal-50 border border-teal-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setIsAnalysisExpanded(!isAnalysisExpanded)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-teal-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-teal-600" />
                <span className="font-semibold text-gray-900">Match Analysis</span>
                {matchScore && (
                  <span className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${getMatchBadgeColor(matchScore).bg} ${getMatchBadgeColor(matchScore).text} ${getMatchBadgeColor(matchScore).border}`}>
                    {matchScore}% Match
                  </span>
                )}
              </div>
              {isAnalysisExpanded ? (
                <ChevronUp className="w-5 h-5 text-gray-600" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-600" />
              )}
            </button>

            {isAnalysisExpanded && (
              <div className="px-4 pb-4 space-y-4">
                {/* Match Breakdown */}
                {job.matchBreakdown && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">Score Breakdown</h4>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-gray-900">{job.matchBreakdown.experienceLevel}%</div>
                        <div className="text-xs text-gray-600">Experience</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-gray-900">{job.matchBreakdown.skills}%</div>
                        <div className="text-xs text-gray-600">Skills</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-gray-900">{job.matchBreakdown.industry}%</div>
                        <div className="text-xs text-gray-600">Industry</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Matching Skills */}
                {job.matchingSkills && job.matchingSkills.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">Your Matching Skills</h4>
                    <div className="flex flex-wrap gap-2">
                      {job.matchingSkills.map((skill, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-lg border border-green-300"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Missing Skills */}
                {job.missingSkills && job.missingSkills.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">Skills to Improve</h4>
                    <div className="flex flex-wrap gap-2">
                      {job.missingSkills.map((skill, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded-lg border border-orange-300"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Job Description */}
        <div>
          <h3 className="text-base font-semibold text-gray-900 mb-3">Job Description</h3>
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
            {cleanDescription}
          </p>
        </div>

        {/* Requirements */}
        {cleanRequirements && (
          <div>
            <h3 className="text-base font-semibold text-gray-900 mb-3">Requirements</h3>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {cleanRequirements}
            </p>
          </div>
        )}

        {/* Skills */}
        {job.extractedSkills && job.extractedSkills.length > 0 && (
          <div>
            <h3 className="text-base font-semibold text-gray-900 mb-3">Required Skills</h3>
            <div className="flex flex-wrap gap-2">
              {job.extractedSkills.map((skill, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1.5 bg-teal-50 text-teal-700 text-sm rounded-lg"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
