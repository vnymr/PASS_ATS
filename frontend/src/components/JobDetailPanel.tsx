import { Job } from '../services/api';
import Icons from './ui/icons';
import { htmlToPlainText } from '../utils/htmlCleaner';
import { calculateSkillMatch, getMatchCategory, extractUserSkills } from '../utils/skillMatcher';
import { useState, useEffect } from 'react';

interface JobDetailPanelProps {
  job: Job | null;
  isOpen: boolean;
  onClose: () => void;
  onGenerateResume: (job: Job) => void;
  onApply: (url: string) => void;
  onAutoApply?: (job: Job) => void;
}

export default function JobDetailPanel({ job, isOpen, onClose, onGenerateResume, onApply, onAutoApply }: JobDetailPanelProps) {
  if (!job) return null;

  const [userProfile, setUserProfile] = useState<any>(null);
  const [skillMatch, setSkillMatch] = useState<{ matchPercentage: number; matchedSkills: string[]; missingSkills: string[] } | null>(null);
  const [autoApplying, setAutoApplying] = useState(false);

  // Load user profile from localStorage
  useEffect(() => {
    try {
      const profileStr = localStorage.getItem('userProfile');
      if (profileStr) {
        const profile = JSON.parse(profileStr);
        setUserProfile(profile);
      }
    } catch (error) {
      console.error('Failed to load user profile:', error);
    }
  }, []);

  // Calculate skill match when job or profile changes
  useEffect(() => {
    if (job?.extractedSkills && job.extractedSkills.length > 0 && userProfile) {
      const userSkills = extractUserSkills(userProfile.data || userProfile);
      const match = calculateSkillMatch(userSkills, job.extractedSkills);
      setSkillMatch(match);
    } else {
      setSkillMatch(null);
    }
  }, [job, userProfile]);

  const Icon = (name: keyof typeof Icons) => {
    const Component = Icons[name];
    return <Component className="w-5 h-5" />;
  };

  // Format date
  const formatDate = (dateString: string) => {
    if (!dateString) return 'Recently posted';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return 'Recently posted';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Use extracted metadata from backend, with fallback to basic extraction
  const cleanDescription = htmlToPlainText(job.description);
  const cleanRequirements = job.requirements ? htmlToPlainText(job.requirements) : null;

  // Use AI-extracted data if available, otherwise fall back to empty/default
  const skills = job.extractedSkills && job.extractedSkills.length > 0
    ? job.extractedSkills
    : [];

  const experience = job.extractedExperience || 'Not specified';

  const perks = job.extractedBenefits && job.extractedBenefits.length > 0
    ? job.extractedBenefits
    : [];

  return (
    <div
      className={`fixed top-0 right-0 h-full w-full md:w-[600px] lg:w-[700px] transform transition-transform duration-300 ease-in-out z-50 bg-elevated shadow-[-4px_0_20px_rgba(0,0,0,0.15)] ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      {/* Header - Sticky */}
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-elevated">
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-start gap-4 flex-1">
              {/* Company Logo */}
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center text-xl font-bold flex-shrink-0 bg-[var(--primary-100)] text-[var(--primary)]"
              >
                {job.company.charAt(0).toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold mb-1 line-clamp-2 text-text">
                  {job.title || 'Untitled role'}
                </h2>
                <div className="flex items-center gap-2 flex-wrap text-sm">
                  <span className="font-semibold text-primary">
                    {job.company || 'Unknown Company'}
                  </span>
                  <span className="text-gray-400">•</span>
                  <span className="text-gray-600">{job.location || 'Location not specified'}</span>
                  <span className="text-gray-400">•</span>
                  <span className="text-gray-500 text-xs">{formatDate(job.postedDate)}</span>
                </div>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-gray-100 transition-colors flex-shrink-0"
            >
              {Icon('x')}
            </button>
          </div>

          {/* Tags */}
          <div className="flex items-center gap-2 flex-wrap">
            {job.aiApplyable && (
              <span
                className="px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 bg-primary text-[var(--background-elevated)]"
              >
                {Icon('zap')}
                AI Apply
              </span>
            )}
            {job.source && (
              <span
                className="px-3 py-1 rounded-full text-xs font-semibold capitalize bg-[var(--gray-100)] text-[var(--gray-600)]"
              >
                {job.source}
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons - Sticky under header */}
        <div className="px-6 pb-4 flex gap-3 border-t border-gray-100 pt-4">
          {/* Show Auto-Apply button if job is AI-applyable */}
          {job.aiApplyable && onAutoApply ? (
            <>
              <button
                onClick={async () => {
                  setAutoApplying(true);
                  try {
                    await onAutoApply(job);
                  } finally {
                    setAutoApplying(false);
                  }
                }}
                disabled={autoApplying}
                className="flex-1 px-4 py-2.5 rounded-xl font-semibold transition-all hover:opacity-90 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed bg-primary text-[var(--background-elevated)]"
              >
                {autoApplying ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    <span>Queueing...</span>
                  </>
                ) : (
                  <>
                    {Icon('zap')}
                    <span>Auto-Apply</span>
                  </>
                )}
              </button>

              <button
                onClick={() => {
                  onGenerateResume(job);
                  onClose();
                }}
                className="px-4 py-2.5 rounded-xl font-semibold transition-all hover:opacity-90 flex items-center justify-center gap-2 bg-background text-text ring-1 ring-black/10"
              >
                {Icon('sparkles')}
                <span>Resume</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  onGenerateResume(job);
                  onClose();
                }}
                className="flex-1 px-4 py-2.5 rounded-xl font-semibold transition-all hover:opacity-90 flex items-center justify-center gap-2 bg-primary text-[var(--background-elevated)]"
              >
                {Icon('sparkles')}
                <span>AI Resume</span>
              </button>

              <button
                onClick={() => onApply(job.applyUrl)}
                className="px-4 py-2.5 rounded-xl font-semibold transition-all hover:opacity-90 flex items-center justify-center gap-2 bg-background text-text ring-1 ring-black/10"
              >
                {Icon('externalLink')}
                <span>Apply</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="overflow-y-auto h-[calc(100%-240px)] custom-scrollbar">
        <div className="p-6 space-y-6">
          {/* Skill Match Banner */}
          {skillMatch && skillMatch.matchPercentage > 0 && (
            <div
              className={`p-4 rounded-xl border-2 ${
                skillMatch.matchPercentage >= 80
                  ? 'bg-green-50 border-green-500'
                  : skillMatch.matchPercentage >= 50
                  ? 'bg-[rgba(62,172,167,0.08)] border-primary'
                  : 'bg-gray-50 border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6">{Icon('checkCircle')}</div>
                  <span className="font-bold text-sm">{getMatchCategory(skillMatch.matchPercentage).label}</span>
                </div>
                <span className={`text-2xl font-bold ${
                  skillMatch.matchPercentage >= 80 ? 'text-green-600' : skillMatch.matchPercentage >= 50 ? 'text-primary' : 'text-gray-600'
                }`}>
                  {skillMatch.matchPercentage}%
                </span>
              </div>
              <p className="text-xs text-gray-600 mb-2">{getMatchCategory(skillMatch.matchPercentage).description}</p>
              <div className="flex gap-2 text-xs">
                <span className="text-gray-600">
                  ✓ {skillMatch.matchedSkills.length} matched
                </span>
                {skillMatch.missingSkills.length > 0 && (
                  <span className="text-gray-500">
                    • {skillMatch.missingSkills.length} to learn
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Quick Info Grid */}
          <div className="grid grid-cols-3 gap-3">
            {/* Salary */}
            {job.salary && (
              <div className="p-3 rounded-xl bg-background">
                <div className="flex items-center gap-1.5 mb-1 text-secondary">
                  <div className="w-4 h-4">{Icon('dollarSign')}</div>
                </div>
                <p className="font-bold text-sm text-text">
                  {job.salary}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">Salary</p>
              </div>
            )}

            {/* Experience */}
            <div className="p-3 rounded-xl bg-background">
              <div className="flex items-center gap-1.5 mb-1 text-primary">
                <div className="w-4 h-4">{Icon('briefcase')}</div>
              </div>
              <p className="font-bold text-sm text-text">
                {experience}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">Experience</p>
            </div>

            {/* Applications */}
            {job._count?.applications !== undefined && (
              <div className="p-3 rounded-xl bg-background">
                <div className="flex items-center gap-1.5 mb-1 text-gray-600">
                  <div className="w-4 h-4">{Icon('users')}</div>
                </div>
                <p className="font-bold text-sm text-text">
                  {job._count.applications}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">Applied</p>
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <h3 className="text-base font-bold mb-3 text-text">
              About the role
            </h3>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
              {cleanDescription}
            </p>
          </div>

          {/* Requirements */}
          {cleanRequirements && cleanRequirements.length > 10 && (
            <div>
              <h3 className="text-base font-bold mb-3 text-text">
                Requirements
              </h3>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                {cleanRequirements}
              </p>
            </div>
          )}

          {/* Skills */}
          {skills.length > 0 && (
            <div>
              <h3 className="text-base font-bold mb-3 text-text">
                Skills & Technologies
                {skillMatch && (
                  <span className="text-xs font-normal text-gray-500 ml-2">
                    ({skillMatch.matchedSkills.length}/{skills.length} matched)
                  </span>
                )}
              </h3>
              <div className="flex flex-wrap gap-2">
                {skills.map((skill, index) => {
                  const isMatched = skillMatch?.matchedSkills.includes(skill);
                  return (
                    <span
                      key={index}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize flex items-center gap-1.5 ${isMatched ? 'bg-[var(--primary-100)] text-[var(--primary)]' : 'bg-[var(--gray-100)] text-[var(--gray-600)] opacity-60'}`}
                    >
                      {isMatched && <span className="text-green-500">✓</span>}
                      {skill}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Perks & Benefits */}
          {perks.length > 0 && (
            <div>
              <h3 className="text-base font-bold mb-3 text-text">
                Perks & Benefits
              </h3>
              <div className="space-y-2">
                {perks.map((perk, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 p-2.5 rounded-lg bg-background"
                  >
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-secondary" />
                    <span className="text-sm font-medium text-gray-700">{perk}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
