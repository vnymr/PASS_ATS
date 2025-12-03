export default function Queue({ queue, onStartNext, loading, hasActiveJob }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">Queue</h2>
        <span className="text-sm text-slate-400">{queue.length} pending</span>
      </div>

      {/* Start Button */}
      <button
        onClick={onStartNext}
        disabled={loading || queue.length === 0 || hasActiveJob}
        className="w-full btn btn-primary mb-4 py-3"
      >
        {loading ? '⏳ Starting...' : hasActiveJob ? 'Complete current job first' : '▶ Start Next'}
      </button>

      {/* Queue List */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {queue.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <div className="text-4xl mb-2">📭</div>
            <p>No jobs in queue</p>
          </div>
        ) : (
          queue.map((session, index) => (
            <div
              key={session.id}
              className="bg-slate-700 rounded-lg p-3 hover:bg-slate-600 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">
                    {session.autoApplication?.job?.title || 'Untitled'}
                  </div>
                  <div className="text-sm text-slate-400 truncate">
                    {session.autoApplication?.job?.company || 'Unknown'}
                  </div>
                </div>
                <span className="text-xs text-slate-500 ml-2">
                  #{index + 1}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
