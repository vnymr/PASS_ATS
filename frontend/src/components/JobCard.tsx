import { Job } from '../services/api';
import Icons from './ui/icons';
import { htmlToPlainText } from '../utils/htmlCleaner';

interface JobCardProps {
  job: Job;
  onGenerateResume: (job: Job) => void;
  onViewJob: (url: string) => void;
  onAutoApply?: (jobId: string) => void;
  compact?: boolean;
  onClick?: (job: Job) => void;
}

export default function JobCard({ job, onGenerateResume, onViewJob, onAutoApply, compact = false, onClick }: JobCardProps) {
  const Icon = (name: keyof typeof Icons) => {
    const Component = Icons[name];
    return <Component className="w-4 h-4" />;
  };

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

  return (
    <div
      onClick={() => onClick?.(job)}
      className={`group relative rounded-2xl transition-all hover:scale-[1.01] cursor-pointer bg-elevated shadow border border-[rgba(28,63,64,0.12)] hover:border-primary ${
        compact ? 'p-4' : 'p-6'
      }`}
    >
      {/* Header Section */}
      <div className={`flex justify-between items-start ${compact ? 'mb-3' : 'mb-4'}`}>
        <div className="flex-1">
          <div className={`flex items-start ${compact ? 'gap-2' : 'gap-3'}`}>
            {/* Company Logo Placeholder */}
            {!compact && (
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold flex-shrink-0 bg-[var(--primary-100)] text-[var(--primary)]"
              >
                {job.company.charAt(0).toUpperCase()}
              </div>
            )}

            <div className="flex-1 min-w-0">
              <h3
                className={`font-bold mb-1 line-clamp-1 ${compact ? 'text-base' : 'text-xl'} text-text`}
              >
                {job.title || 'Untitled role'}
              </h3>
              <div className={`flex items-center gap-2 flex-wrap ${compact ? 'text-xs' : 'text-sm'}`}>
                <span className="font-semibold text-primary">
                  {job.company || 'Unknown Company'}
                </span>
                <span className="text-gray-400">•</span>
                <span className="text-gray-600 flex items-center gap-1">
                  {Icon('mapPin')}
                  {job.location || 'Location not specified'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* AI Badge */}
        {job.aiApplyable && (
          <div
            className={`rounded-full font-bold flex items-center gap-1.5 ml-2 flex-shrink-0 ${
              compact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-xs'
            }`}
            style={{
              backgroundColor: 'var(--primary)',
              color: 'var(--background-elevated)',
            }}
          >
            {Icon('zap')}
            {!compact && <span>AI Apply</span>}
          </div>
        )}
      </div>

      {/* Metadata Row */}
      {!compact && (
        <div className="flex items-center gap-4 mb-4 text-sm flex-wrap">
          {job.salary && (
            <div className="flex items-center gap-1.5 font-medium text-secondary">
              {Icon('dollarSign')}
              <span>{job.salary}</span>
            </div>
          )}

          <div className="flex items-center gap-1.5 text-gray-500">
            {Icon('clock')}
            <span>{formatDate(job.postedDate)}</span>
          </div>

          {job.source && (
            <div className="flex items-center gap-1.5 text-gray-500">
              {Icon('briefcase')}
              <span className="capitalize">{job.source}</span>
            </div>
          )}

          {job._count?.applications && job._count.applications > 0 && (
            <div className="flex items-center gap-1.5 text-gray-500">
              {Icon('users')}
              <span>{job._count.applications} applied</span>
            </div>
          )}
        </div>
      )}

      {/* Description */}
      <p className={`text-gray-600 leading-relaxed ${compact ? 'text-xs mb-3 line-clamp-2' : 'text-sm mb-4 line-clamp-2'}`}>
        {htmlToPlainText(job.description)}
      </p>

      {/* Compact metadata */}
      {compact && (
        <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
          {job.salary && (
            <span className="font-medium text-secondary">
              {job.salary}
            </span>
          )}
          <span>•</span>
          <span>{formatDate(job.postedDate)}</span>
        </div>
      )}

      {/* Action Buttons */}
      {!compact && (
        <div className="flex gap-3">
        {/* AI Generate Resume - Primary Action */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onGenerateResume(job);
          }}
          className="flex-1 px-4 py-2.5 rounded-xl font-semibold transition-all hover:opacity-90 flex items-center justify-center gap-2 bg-primary text-[var(--background-elevated)]"
        >
          {Icon('sparkles')}
          <span>AI Resume</span>
        </button>

        {/* View Job */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onViewJob(job.applyUrl);
          }}
          className="px-4 py-2.5 rounded-xl font-semibold transition-all hover:opacity-90 flex items-center justify-center gap-2 bg-background text-text ring-1 ring-black/10"
        >
          {Icon('externalLink')}
          <span>View</span>
        </button>

        {/* Auto Apply (if available) */}
        {job.aiApplyable && onAutoApply && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAutoApply(job.id);
            }}
            className="px-4 py-2.5 rounded-xl font-semibold transition-all hover:opacity-90 flex items-center justify-center gap-2 bg-secondary text-[var(--background-elevated)]"
          >
            {Icon('zap')}
            <span>Auto Apply</span>
          </button>
        )}
        </div>
      )}

      {/* Hover Effect Overlay */}
      <div
        className="absolute inset-0 rounded-2xl pointer-events-none transition-opacity opacity-0 group-hover:opacity-100 [box-shadow:0_8px_16px_rgba(62,172,167,0.12)]"
      />
    </div>
  );
}
