import { useEffect, useState } from 'react';
import type { Application } from '../services/api';
import { getMyApplications } from '../services/api';

type StatusFilter = 'ALL' | Application['status'];

function formatRelative(dateString?: string) {
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
      return 'Queuing';
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

function statusColorClasses(status: Application['status']) {
  switch (status) {
    case 'QUEUED':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'APPLYING':
      return 'bg-sky-50 text-sky-700 border-sky-200';
    case 'SUBMITTED':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'FAILED':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'CANCELLED':
      return 'bg-slate-50 text-slate-700 border-slate-200';
    case 'RETRYING':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    default:
      return 'bg-slate-50 text-slate-700 border-slate-200';
  }
}

function isInlineScreenshot(url?: string | null) {
  return Boolean(url && url.startsWith('data:image/'));
}

export default function Applications() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        const data = await getMyApplications({ limit: 100 });
        if (cancelled) return;
        setApplications(data.applications || []);
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
    const interval = window.setInterval(fetchData, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [selectedId]);

  const normalizedSearch = search.trim().toLowerCase();

  const filtered = applications
    .filter(app => {
      if (!normalizedSearch) return true;
      const company = app.job?.company?.toLowerCase() ?? '';
      const title = app.job?.title?.toLowerCase() ?? '';
      return company.includes(normalizedSearch) || title.includes(normalizedSearch);
    })
    .filter(app => {
      if (statusFilter === 'ALL') return true;
      return app.status === statusFilter;
    });

  const selected = filtered.find(app => app.id === selectedId) || null;

  return (
    <div className="w-full py-4 md:py-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-[var(--gray-900)]">
            Applications
          </h1>
          <p className="text-sm text-[var(--gray-600)]">
            See what the AI has applied to on your behalf, including status and snapshots.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="relative">
            <input
              type="text"
              placeholder="Search by company or role..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full sm:w-64 rounded-full border border-[rgba(15,23,42,0.12)] bg-white px-3 py-1.5 pr-8 text-xs md:text-sm text-[var(--gray-800)] placeholder:text-[var(--gray-400)] focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--gray-400)] hover:text-[var(--gray-600)]"
              >
                ×
              </button>
            )}
          </div>
          <select
            className="text-xs md:text-sm rounded-full border border-[rgba(15,23,42,0.12)] bg-white px-3 py-1.5 text-[var(--gray-700)] focus:outline-none focus:ring-2 focus:ring-primary/20"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as StatusFilter)}
          >
            <option value="ALL">All statuses</option>
            <option value="QUEUED">Queued</option>
            <option value="APPLYING">Applying</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="FAILED">Failed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.04)] px-4 py-3 text-sm text-[#b91c1c]">
          <div className="font-semibold mb-1">Failed to load applications</div>
          <div className="text-xs">{error}</div>
        </div>
      )}

      {loading && applications.length === 0 && (
        <div className="rounded-xl border border-[rgba(15,23,42,0.06)] bg-white px-4 py-6 text-sm text-[var(--gray-600)]">
          Loading your applications…
        </div>
      )}

      {!loading && filtered.length === 0 && !error && (
        <div className="rounded-xl border border-[rgba(15,23,42,0.06)] bg-white px-4 py-8 text-center">
          <p className="text-sm font-medium text-[var(--gray-800)] mb-1">
            No applications yet
          </p>
          <p className="text-xs text-[var(--gray-500)]">
            Use <span className="font-semibold">Auto-Apply</span> from the Jobs page to start tracking here.
          </p>
        </div>
      )}

      {filtered.length > 0 && (
        <div
          className={
            selected
              ? 'grid grid-cols-1 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1.05fr)] gap-4 lg:gap-6'
              : 'grid grid-cols-1'
          }
        >
          {/* Table-like list */}
          <div className="rounded-2xl border border-[rgba(15,23,42,0.06)] bg-white overflow-hidden">
            <div className="border-b border-[rgba(15,23,42,0.06)] px-4 py-2.5 text-[11px] font-semibold text-[var(--gray-500)] uppercase tracking-wide">
              Recent applications
            </div>

            {/* Header row (desktop) */}
            <div className="hidden md:grid grid-cols-[minmax(0,2.1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)] gap-3 px-4 py-2.5 text-[11px] text-[var(--gray-500)] border-b border-[rgba(15,23,42,0.04)] bg-slate-50/60">
              <span>Company & role</span>
              <span>Status</span>
              <span className="text-right">Applied</span>
            </div>

            <div className="max-h-[560px] overflow-y-auto custom-scrollbar">
              {filtered.map(app => {
                const isSelected = selected?.id === app.id;
                return (
                  <button
                    key={app.id}
                    type="button"
                    onClick={() => setSelectedId(app.id)}
                    className={`w-full text-left border-b border-[rgba(15,23,42,0.04)] hover:bg-[rgba(15,23,42,0.02)] transition-colors ${
                      isSelected ? 'bg-[rgba(34,197,94,0.03)]' : ''
                    }`}
                  >
                    <div className="md:grid md:grid-cols-[minmax(0,2.1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)] md:gap-3 px-4 py-3.5 flex flex-col gap-1.5">
                      {/* Company & role */}
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <div className="text-xs font-semibold text-[var(--gray-900)] truncate">
                          {app.job?.company || 'Unknown company'}
                        </div>
                        <div className="text-xs text-[var(--gray-600)] truncate">
                          {app.job?.title || 'Untitled role'}
                        </div>
                        {app.error && (
                          <div className="text-[11px] text-red-600 line-clamp-1">
                            {app.error}
                          </div>
                        )}
                        {/* Mobile-only status/date row */}
                        <div className="flex md:hidden items-center justify-between gap-2 mt-1">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-[2px] text-[10px] font-semibold border ${statusColorClasses(app.status)}`}
                          >
                            {statusLabel(app.status)}
                          </span>
                          <span className="text-[11px] text-[var(--gray-400)]">
                            {formatRelative(app.createdAt)}
                          </span>
                        </div>
                      </div>

                      {/* Status (desktop) */}
                      <div className="hidden md:flex items-center">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-[2px] text-[10px] font-semibold border ${statusColorClasses(app.status)}`}
                        >
                          {statusLabel(app.status)}
                        </span>
                      </div>

                      {/* Applied date (desktop) */}
                      <div className="hidden md:flex items-center justify-end text-[11px] text-[var(--gray-400)]">
                        {formatRelative(app.createdAt)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Details panel - only render when an application is selected */}
          {selected && (
            <div className="rounded-2xl border border-[rgba(15,23,42,0.06)] bg-white p-4 md:p-5">
              <div className="flex flex-col gap-3 md:gap-4">
                <div>
                  <h2 className="text-base md:text-lg font-semibold text-[var(--gray-900)]">
                    {selected.job?.company || 'Unknown company'}
                  </h2>
                  <p className="text-xs md:text-sm text-[var(--gray-500)]">
                    {selected.job?.title || 'Untitled role'}
                    {selected.job?.location && ` • ${selected.job.location}`}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 md:gap-3 text-[11px] md:text-xs">
                  <div className="rounded-lg bg-slate-50 border border-[rgba(15,23,42,0.06)] px-3 py-2">
                    <div className="text-[10px] text-[var(--gray-500)] mb-0.5">Status</div>
                    <div className="font-semibold text-[var(--gray-800)]">
                      {statusLabel(selected.status)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-50 border border-[rgba(15,23,42,0.06)] px-3 py-2">
                    <div className="text-[10px] text-[var(--gray-500)] mb-0.5">Method</div>
                    <div className="font-semibold text-[var(--gray-800)] truncate">
                      {selected.method || 'AI Auto'}
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-50 border border-[rgba(15,23,42,0.06)] px-3 py-2">
                    <div className="text-[10px] text-[var(--gray-500)] mb-0.5">Applied</div>
                    <div className="font-semibold text-[var(--gray-800)]">
                      {formatRelative(selected.startedAt || selected.createdAt)}
                    </div>
                  </div>
                </div>

                {selected.error && (
                  <div className="rounded-lg bg-[rgba(239,68,68,0.04)] border border-[rgba(239,68,68,0.35)] px-3 py-2.5 text-[11px] md:text-xs text-[#b91c1c]">
                    <div className="font-semibold mb-0.5">Error</div>
                    <div className="break-words">{selected.error}</div>
                  </div>
                )}

                {selected.job?.applyUrl && (
                  <button
                    type="button"
                    onClick={() => window.open(selected.job!.applyUrl, '_blank', 'noopener')}
                    className="inline-flex items-center justify-center rounded-lg border border-[rgba(15,23,42,0.12)] bg-white px-3 py-2 text-xs font-medium text-[var(--gray-800)] hover:bg-[rgba(15,23,42,0.02)] transition-colors w-full md:w-auto"
                  >
                    View job posting
                  </button>
                )}

                {/* Resume info (high-level, user-facing) */}
                <div className="rounded-lg bg-slate-50 border border-[rgba(15,23,42,0.06)] px-3 py-2.5 text-[11px] md:text-xs text-[var(--gray-700)]">
                  <div className="text-[10px] font-semibold text-[var(--gray-500)] mb-0.5 uppercase tracking-wide">
                    Resume used
                  </div>
                  <p>
                    This application used your latest resume and profile data saved in the app. You can update it from your Profile page and future auto-applies will use the updated version.
                  </p>
                </div>

                <div>
                  <div className="text-[10px] font-semibold text-[var(--gray-500)] mb-1.5 uppercase tracking-wide">
                    Application snapshot
                  </div>
                  {isInlineScreenshot(selected.confirmationUrl) ? (
                    <div className="rounded-lg border border-[rgba(15,23,42,0.08)] bg-slate-50 overflow-hidden">
                      <div className="max-h-72 md:max-h-80 overflow-auto bg-black/5">
                        <img
                          src={selected.confirmationUrl as string}
                          alt="Application screenshot"
                          className="w-full object-contain"
                        />
                      </div>
                      <div className="px-3 py-1.5 flex items-center justify-between border-t border-[rgba(15,23,42,0.06)]">
                        <span className="text-[10px] text-[var(--gray-500)]">
                          Captured by AI during the apply flow
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-[rgba(15,23,42,0.12)] bg-slate-50/60 px-3 py-3 text-[11px] md:text-xs text-[var(--gray-500)]">
                      No screenshot captured for this application.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


