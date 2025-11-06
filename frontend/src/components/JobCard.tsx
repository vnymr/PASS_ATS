import { motion } from 'framer-motion';
import { MapPin, Briefcase, DollarSign, Clock, Users, ExternalLink, Sparkles, Zap, X, Heart, TrendingUp, AlertCircle, CheckCircle2, Building, Calendar } from 'lucide-react';
import { Job } from '../services/api';
import { htmlToPlainText } from '../utils/htmlCleaner';
import CompanyLogo from './CompanyLogo';

interface MatchBreakdown {
  experienceLevel: number;
  skills: number;
  industry: number;
  location?: number;
  education?: number;
}

interface JobCardProps {
  job: Job & {
    relevanceScore?: number;
    matchBreakdown?: MatchBreakdown;
    matchReasons?: string[];
    missingSkills?: string[];
    improvementSuggestions?: string[];
    matchingSkills?: string[];
  };
  onGenerateResume: (job: Job) => void;
  onViewJob: (url: string) => void;
  onAutoApply?: (jobId: string) => void;
  onReject?: (jobId: string) => void;
  onSave?: (jobId: string) => void;
  delay?: number;
  compact?: boolean;
  onClick?: (job: Job) => void;
  showMatchScore?: boolean;
}

export default function JobCard({
  job,
  onGenerateResume,
  onViewJob,
  onAutoApply,
  onReject,
  onSave,
  delay = 0,
  compact = false,
  onClick,
}: JobCardProps) {
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

  const getMatchLabel = (score: number) => {
    if (score >= 90) return 'STRONG MATCH';
    if (score >= 80) return 'GOOD MATCH';
    if (score >= 70) return 'FAIR MATCH';
    return 'POTENTIAL MATCH';
  };

  const getMatchColor = (score: number) => {
    if (score >= 90) return '#10B981';
    if (score >= 80) return '#3B82F6';
    if (score >= 70) return '#F59E0B';
    return '#6B7280';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className={`bg-card rounded-2xl border transition-all duration-300 hover:shadow-xl group relative ${compact ? 'p-4' : 'p-6'}`}
      style={{
        borderColor: 'var(--background-200)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      }}
    >
      <div className="flex gap-6">
        {/* Main Content - Left Side */}
        <div className="flex-1">
          {/* Header with Logo */}
          <div className="flex items-start gap-4 mb-4">
            <CompanyLogo company={job.company} size={56} />

            <div className="flex-1">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      style={{
                        color: 'var(--text-500)',
                        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
                        fontSize: '13px',
                      }}
                    >
                      {formatDate(job.postedDate)}
                    </span>
                    {matchScore >= 85 && (
                      <span
                        className="px-2 py-0.5 rounded-md"
                        style={{
                          backgroundColor: 'rgba(16, 185, 129, 0.1)',
                          color: '#059669',
                          fontSize: '11px',
                          fontWeight: 600,
                        }}
                      >
                        Be an early applicant
                      </span>
                    )}
                  </div>

                  <h3
                    className="mb-2 group-hover:opacity-80 transition-opacity"
                    style={{
                      color: 'var(--text-900)',
                      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
                      fontSize: '20px',
                      fontWeight: 600,
                      lineHeight: '1.3',
                    }}
                  >
                    {job.title || 'Untitled role'}
                  </h3>

                  <div className="flex items-center gap-2 mb-3">
                    <span
                      style={{
                        color: 'var(--text-700)',
                        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
                        fontSize: '15px',
                        fontWeight: 600,
                      }}
                    >
                      {job.company || 'Unknown Company'}
                    </span>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex items-center gap-2 ml-4">
                  {onReject && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onReject(job.id);
                      }}
                      className="p-2 rounded-full hover:bg-black/5 transition-all"
                      style={{ color: 'var(--text-500)' }}
                      title="Not interested"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                  {onSave && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSave(job.id);
                      }}
                      className="p-2 rounded-full hover:bg-black/5 transition-all"
                      style={{ color: 'var(--text-500)' }}
                      title="Save job"
                    >
                      <Heart className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Job Metadata */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 mb-4">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" style={{ color: 'var(--text-500)' }} />
                  <span style={{ color: 'var(--text-600)', fontSize: '14px' }}>
                    {job.location || 'Location not specified'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4" style={{ color: 'var(--text-500)' }} />
                  <span style={{ color: 'var(--text-600)', fontSize: '14px' }}>
                    Full-time
                  </span>
                </div>

                {job.salary && (
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4" style={{ color: 'var(--text-500)' }} />
                    <span style={{ color: 'var(--text-600)', fontSize: '14px' }}>
                      {job.salary}
                    </span>
                  </div>
                )}

                {job._count?.applications && (
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" style={{ color: 'var(--text-500)' }} />
                    <span style={{ color: 'var(--text-600)', fontSize: '14px' }}>
                      {job._count.applications < 50 ? `Less than ${job._count.applications}` : job._count.applications} applicants
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Why This Job Is A Match */}
          {!compact && job.matchReasons && job.matchReasons.length > 0 && (
            <div className="mb-4 p-4 rounded-xl" style={{ backgroundColor: 'var(--background-50)' }}>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4" style={{ color: 'var(--primary-600)' }} />
                <h4
                  style={{
                    color: 'var(--text-900)',
                    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
                    fontSize: '15px',
                    fontWeight: 600,
                  }}
                >
                  Why This Job Is A Match
                </h4>
              </div>

              <p
                className="mb-3"
                style={{
                  color: 'var(--text-700)',
                  fontSize: '14px',
                  lineHeight: '1.6',
                }}
              >
                {job.matchReasons[0]}
              </p>

              {/* Match Breakdown */}
              {job.matchBreakdown && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center">
                    <div
                      className="relative inline-flex items-center justify-center w-16 h-16 mb-2"
                      style={{
                        background: `conic-gradient(${getMatchColor(job.matchBreakdown.experienceLevel)} ${job.matchBreakdown.experienceLevel * 3.6}deg, var(--background-200) ${job.matchBreakdown.experienceLevel * 3.6}deg)`,
                        borderRadius: '50%',
                      }}
                    >
                      <div
                        className="absolute inset-1 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: 'var(--card)' }}
                      >
                        <span
                          style={{
                            color: 'var(--text-900)',
                            fontSize: '15px',
                            fontWeight: 700,
                          }}
                        >
                          {job.matchBreakdown.experienceLevel}%
                        </span>
                      </div>
                    </div>
                    <div style={{ color: 'var(--text-600)', fontSize: '13px', fontWeight: 500 }}>
                      Experience Level
                    </div>
                  </div>

                  <div className="text-center">
                    <div
                      className="relative inline-flex items-center justify-center w-16 h-16 mb-2"
                      style={{
                        background: `conic-gradient(${getMatchColor(job.matchBreakdown.skills)} ${job.matchBreakdown.skills * 3.6}deg, var(--background-200) ${job.matchBreakdown.skills * 3.6}deg)`,
                        borderRadius: '50%',
                      }}
                    >
                      <div
                        className="absolute inset-1 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: 'var(--card)' }}
                      >
                        <span
                          style={{
                            color: 'var(--text-900)',
                            fontSize: '15px',
                            fontWeight: 700,
                          }}
                        >
                          {job.matchBreakdown.skills}%
                        </span>
                      </div>
                    </div>
                    <div style={{ color: 'var(--text-600)', fontSize: '13px', fontWeight: 500 }}>
                      Skills
                    </div>
                  </div>

                  <div className="text-center">
                    <div
                      className="relative inline-flex items-center justify-center w-16 h-16 mb-2"
                      style={{
                        background: `conic-gradient(${getMatchColor(job.matchBreakdown.industry)} ${job.matchBreakdown.industry * 3.6}deg, var(--background-200) ${job.matchBreakdown.industry * 3.6}deg)`,
                        borderRadius: '50%',
                      }}
                    >
                      <div
                        className="absolute inset-1 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: 'var(--card)' }}
                      >
                        <span
                          style={{
                            color: 'var(--text-900)',
                            fontSize: '15px',
                            fontWeight: 700,
                          }}
                        >
                          {job.matchBreakdown.industry}%
                        </span>
                      </div>
                    </div>
                    <div style={{ color: 'var(--text-600)', fontSize: '13px', fontWeight: 500 }}>
                      Industry Experience
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Matching Skills */}
          {!compact && job.matchingSkills && job.matchingSkills.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-4 h-4" style={{ color: '#10B981' }} />
                <span
                  style={{
                    color: 'var(--text-700)',
                    fontSize: '14px',
                    fontWeight: 600,
                  }}
                >
                  Your matching skills:
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {job.matchingSkills.slice(0, 6).map((skill, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1.5 rounded-lg"
                    style={{
                      backgroundColor: 'rgba(16, 185, 129, 0.1)',
                      color: '#059669',
                      fontSize: '13px',
                      fontWeight: 500,
                    }}
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Missing Skills & Improvement */}
          {!compact && job.missingSkills && job.missingSkills.length > 0 && (
            <div className="mb-4 p-4 rounded-xl" style={{ backgroundColor: 'rgba(249, 115, 22, 0.05)' }}>
              <div className="flex items-start gap-2 mb-2">
                <TrendingUp className="w-4 h-4 mt-0.5" style={{ color: '#F97316' }} />
                <div className="flex-1">
                  <h4
                    className="mb-2"
                    style={{
                      color: 'var(--text-900)',
                      fontSize: '14px',
                      fontWeight: 600,
                    }}
                  >
                    Improve your match by adding these skills:
                  </h4>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {job.missingSkills.slice(0, 4).map((skill, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 rounded-lg"
                        style={{
                          backgroundColor: 'rgba(249, 115, 22, 0.1)',
                          color: '#EA580C',
                          fontSize: '12px',
                          fontWeight: 500,
                        }}
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                  <p
                    style={{
                      color: 'var(--text-600)',
                      fontSize: '13px',
                      lineHeight: '1.5',
                    }}
                  >
                    💡 Generate an optimized resume highlighting relevant skills to increase your match score
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t" style={{ borderColor: 'var(--background-200)' }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onGenerateResume(job);
              }}
              className="flex-1 py-3 rounded-xl transition-all duration-200 hover:opacity-90 active:scale-[0.98] flex items-center justify-center gap-2"
              style={{
                backgroundColor: 'var(--primary-600)',
                color: 'white',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
                fontSize: '14px',
                fontWeight: 600,
              }}
            >
              <Sparkles className="w-4 h-4" />
              Generate Optimized Resume
            </button>

            {onAutoApply && job.aiApplyable ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAutoApply(job.id);
                }}
                className="px-6 py-3 rounded-xl transition-all duration-200 hover:opacity-90 active:scale-[0.98] flex items-center gap-2"
                style={{
                  backgroundColor: '#10B981',
                  color: 'white',
                  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
                  fontSize: '14px',
                  fontWeight: 600,
                }}
              >
                <Zap className="w-4 h-4" />
                Apply with Autofill
              </button>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onViewJob(job.applyUrl);
                }}
                className="px-6 py-3 rounded-xl transition-all duration-200 hover:opacity-90 active:scale-[0.98] flex items-center gap-2"
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
            )}
          </div>
        </div>

        {/* Match Score - Right Side */}
        <div
          className="w-32 flex-shrink-0 rounded-xl p-4 flex flex-col items-center justify-center"
          style={{
            backgroundColor: getMatchColor(matchScore),
            color: 'white',
          }}
        >
          <div
            className="relative inline-flex items-center justify-center w-20 h-20 mb-3"
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              borderRadius: '50%',
            }}
          >
            <div
              className="absolute inset-1 rounded-full flex items-center justify-center"
              style={{
                backgroundColor: 'transparent',
                border: '3px solid rgba(255, 255, 255, 0.3)',
              }}
            >
              <span
                style={{
                  fontSize: '24px',
                  fontWeight: 700,
                }}
              >
                {matchScore}%
              </span>
            </div>
          </div>
          <div
            style={{
              fontSize: '13px',
              fontWeight: 700,
              textAlign: 'center',
              letterSpacing: '0.5px',
            }}
          >
            {getMatchLabel(matchScore)}
          </div>
          {matchScore >= 85 && (
            <div
              className="mt-3 pt-3 border-t text-center"
              style={{
                borderColor: 'rgba(255, 255, 255, 0.2)',
                fontSize: '11px',
                opacity: 0.9,
              }}
            >
              ✓ H1B Sponsor Likely
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
