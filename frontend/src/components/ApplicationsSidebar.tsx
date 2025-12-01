import { useEffect, useState } from 'react';
import type { Application } from '../services/api';
import { getMyApplications } from '../services/api';

type StatusFilter = 'ALL' | Application['status'];

function formatRelativeDate(dateString?: string) {
  if (!dateString) return 'Just now';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 'Just now';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  if (diffHours < 24) return `${diffHours} hr${diffHours === 1 ? '' : 's'} ago`;
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
}

function statusLabel(status: Application['status']) {
  switch (status) {
    case 'QUEUED':
      return 'Queued';
    case 'APPLYING':
      return 'Applying';
    case 'SUBMITTED':
      return 'Submitted';
    case 'FAILED':
      return 'Failed';
    case 'CANCELLED':
      return 'Cancelled';
    case 'RETRYING':
      return 'Retrying';
    default:
      return status;
  }
}

function statusClasses(status: Application['status']) {
  switch (status) {
    case 'QUEUED':
      return 'bg-[rgba(59,130,246,0.12)] text-blue-600 border border-[rgba(59,130,246,0.25)]';
    case 'APPLYING':
      return 'bg-[rgba(56,189,248,0.12)] text-sky-700 border border-[rgba(56,189,248,0.25)]';
    case 'SUBMITTED':
      return 'bg-[rgba(34,197,94,0.10)] text-emerald-700 border border-[rgba(34,197,94,0.25)]';
    case 'FAILED':
      return 'bg-[rgba(239,68,68,0.10)] text-red-700 border border-[rgba(239,68,68,0.25)]';
    case 'CANCELLED':
      return 'bg-[rgba(148,163,184,0.10)] text-slate-700 border border-[rgba(148,163,184,0.25)]';
    case 'RETRYING':
      return 'bg-[rgba(245,158,11,0.10)] text-amber-700 border border-[rgba(245,158,11,0.25)]';
    default:
      return 'bg-[rgba(148,163,184,0.10)] text-slate-700 border border-[rgba(148,163,184,0.25)]';
  }
}

function isInlineScreenshot(url?: string | null) {
  if (!url) return false;
  return url.startsWith('data:image/');
}

export default function ApplicationsSidebar() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  // Initial load + polling
  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        const data = await getMyApplications({ limit: 20 });
        if (cancelled) return;
        setApplications(data.applications || []);
        if (!selectedId && data.applications?.length) {
          setSelectedId(data.applications[0].id);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load applications');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchData();
    const interval = window.setInterval(fetchData, 10000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [selectedId]);

  const filtered = statusFilter === 'ALL'
    ? applications
    : applications.filter(app => app.status === statusFilter);

  const selected = filtered.find(app => app.id === selectedId) || filtered[0] || null;

  return (
    <aside className="hidden xl:flex xl:flex-col xl:w-[320px] 2xl:w-[360px] border-l border-[rgba(15,23,42,0.06)] bg-[var(--background-elevated)]/80 backdrop-blur-sm">
      <div className="px-4 pt-4 pb-3 border-b border-[rgba(15,23,42,0.06)] flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-[var(--gray-900)]">Applications</h2>
          <p className="text-xs text-[var(--gray-500)]">
            Live view of your AI auto-applies
          </p>
        </div>
        <select
          className="text-[11px] rounded-full border border-[rgba(15,23,42,0.12)] bg-white px-2.5 py-1 text-[var(--gray-700)] focus:outline-none focus:ring-2 focus:ring-primary/20"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as StatusFilter)}
        >
          <option value="ALL">All</option>
          <option value="QUEUED">Queued</option>
          <option value="APPLYING">Applying</option>
          <option value="SUBMITTED">Submitted</option>
          <option value="FAILED">Failed</option>
        </select>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* List */}
        <div className="border-b border-[rgba(15,23,42,0.06)]">
          <div className="max-h-[260px] overflow-y-auto custom-scrollbar">
            {loading && applications.length === 0 && (
              <div className="px-4 py-6 text-xs text-[var(--gray-500)]">
                Loading applications…
              </div>
            )}

            {!loading && filtered.length === 0 && !error && (
              <div className="px-4 py-6 text-xs text-[var(--gray-500)]">
                No applications yet. Use <span className="font-semibold">Auto-Apply</span> on a job to see it here.
              </div>
            )}

            {error && (
              <div className="px-4 py-4">
                <div className="text-[11px] text-red-600 mb-1">Failed to load applications</div>
                <div className="text-[11px] text-[var(--gray-500)] truncate">{error}</div>
              </div>
            )}

            {filtered.map(app => (
              <button
                key={app.id}
                type="button"
                onClick={() => setSelectedId(app.id)}
                className={`w-full text-left px-4 py-3 border-b border-[rgba(15,23,42,0.04)] hover:bg-[rgba(15,23,42,0.02)] transition-colors ${
                  selected?.id === app.id ? 'bg-[rgba(34,197,94,0.03)]' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-[var(--gray-900)] truncate">
                      {app.job?.title || 'Untitled role'}
                    </div>
                    <div className="text-[11px] text-[var(--gray-500)] truncate">
                      {app.job?.company || 'Unknown company'}
                    </div>
                  </div>
                  <span
                    className={`ml-2 inline-flex items-center rounded-full px-2 py-[2px] text-[10px] font-semibold ${statusClasses(app.status)}`}
                  >
                    {statusLabel(app.status)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 text-[10px] text-[var(--gray-500)]">
                  <span>
                    {app.job?.atsType
                      ? app.job.atsType.charAt(0).toUpperCase() + app.job.atsType.slice(1)
                      : 'Unknown ATS'}
                  </span>
                  <span>{formatRelativeDate(app.createdAt)}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Details */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-3">
          {!selected && !loading && (
            <div className="text-xs text-[var(--gray-500)]">
              Select an application above to see full details.
            </div>
          )}

          {selected && (
            <div className="space-y-3">
              <div>
                <div className="text-xs font-semibold text-[var(--gray-900)] truncate">
                  {selected.job?.title || 'Untitled role'}
                </div>
                <div className="text-[11px] text-[var(--gray-500)] truncate">
                  {selected.job?.company || 'Unknown company'}
                  {selected.job?.location && ` • ${selected.job.location}`}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded-lg bg-white border border-[rgba(15,23,42,0.06)] px-2.5 py-2">
                  <div className="text-[10px] text-[var(--gray-500)] mb-0.5">Status</div>
                  <div className="font-semibold text-[var(--gray-800)]">
                    {statusLabel(selected.status)}
                  </div>
                </div>
                <div className="rounded-lg bg-white border border-[rgba(15,23,42,0.06)] px-2.5 py-2">
                  <div className="text-[10px] text-[var(--gray-500)] mb-0.5">Started</div>
                  <div className="font-semibold text-[var(--gray-800)]">
                    {formatRelativeDate(selected.startedAt || selected.createdAt)}
                  </div>
                </div>
                <div className="rounded-lg bg-white border border-[rgba(15,23,42,0.06)] px-2.5 py-2">
                  <div className="text-[10px] text-[var(--gray-500)] mb-0.5">Completed</div>
                  <div className="font-semibold text-[var(--gray-800)]">
                    {selected.completedAt ? formatRelativeDate(selected.completedAt) : 'In progress'}
                  </div>
                </div>
                <div className="rounded-lg bg-white border border-[rgba(15,23,42,0.06)] px-2.5 py-2">
                  <div className="text-[10px] text-[var(--gray-500)] mb-0.5">Method</div>
                  <div className="font-semibold text-[var(--gray-800)] truncate">
                    {selected.method || 'AI Auto'}
                  </div>
                </div>
              </div>

              {selected.error && (
                <div className="rounded-lg bg-[rgba(239,68,68,0.04)] border border-[rgba(239,68,68,0.35)] px-3 py-2.5 text-[11px] text-[#b91c1c]">
                  <div className="font-semibold mb-0.5">Error</div>
                  <div className="line-clamp-3 break-words">{selected.error}</div>
                </div>
              )}

              {selected.job?.applyUrl && (
                <button
                  type="button"
                  onClick={() => window.open(selected.job!.applyUrl, '_blank', 'noopener')}
                  className="w-full inline-flex items-center justify-center rounded-lg border border-[rgba(15,23,42,0.12)] bg-white px-3 py-2 text-[11px] font-medium text-[var(--gray-800)] hover:bg-[rgba(15,23,42,0.02)] transition-colors"
                >
                  View job posting
                </button>
              )}

              <div className="mt-1">
                <div className="text-[10px] font-semibold text-[var(--gray-500)] mb-1.5 uppercase tracking-wide">
                  Application snapshot
                </div>
                {isInlineScreenshot(selected.confirmationUrl) ? (
                  <div className="rounded-lg border border-[rgba(15,23,42,0.08)] bg-white overflow-hidden">
                    <div className="max-h-56 overflow-hidden">
                      <img
                        src={selected.confirmationUrl as string}
                        alt="Application screenshot"
                        className="w-full object-cover"
                      />
                    </div>
                    <div className="px-3 py-1.5 flex items-center justify-between border-t border-[rgba(15,23,42,0.06)]">
                      <span className="text-[10px] text-[var(--gray-500)]">
                        Captured by AI during apply
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-[rgba(15,23,42,0.12)] bg-white/40 px-3 py-3 text-[11px] text-[var(--gray-500)]">
                    No screenshot captured for this application.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}


