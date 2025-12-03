import { useState } from 'react';

export default function ActiveJob({ session, onComplete, onSkip }) {
  const [notes, setNotes] = useState('');

  const statusConfig = {
    ASSIGNED: { label: 'Starting...', color: 'blue', icon: '🚀' },
    AI_PROCESSING: { label: 'AI Processing', color: 'yellow', icon: '🤖' },
    READY_FOR_SUBMIT: { label: 'Ready for Submit', color: 'green', icon: '✅' }
  };

  const config = statusConfig[session.status] || statusConfig.ASSIGNED;
  const isReady = session.status === 'READY_FOR_SUBMIT';

  return (
    <div className="card">
      {/* Job Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold">{session.job?.title || 'Application'}</h2>
          <p className="text-slate-400">{session.job?.company}</p>
        </div>
        <span className={`status-badge ${session.status?.toLowerCase()}`}>
          {config.icon} {config.label}
        </span>
      </div>

      {/* Status Message */}
      <div className="bg-slate-700 rounded-lg p-4 mb-4">
        <p className="text-lg">{session.message || 'Processing...'}</p>

        {session.fieldsFilled !== undefined && (
          <p className="text-sm text-slate-400 mt-2">
            Fields filled: {session.fieldsFilled} / {session.fieldsExtracted || '?'}
          </p>
        )}
      </div>

      {/* Browser View Placeholder */}
      <div className="mb-4">
        <div className="bg-slate-950 rounded-lg p-8 text-center border-2 border-slate-700">
          {isReady ? (
            <>
              <div className="text-4xl mb-4">🖥️</div>
              <h3 className="text-lg font-medium mb-2">Browser Window Active</h3>
              <p className="text-slate-400 mb-4">
                The form is filled. Check your browser window, solve any CAPTCHA, and click SUBMIT.
              </p>
              {session.job?.url && (
                <a
                  href={session.job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline"
                >
                  Open job page in new tab →
                </a>
              )}
            </>
          ) : (
            <>
              <div className="text-4xl mb-4 animate-pulse">⏳</div>
              <h3 className="text-lg font-medium mb-2">AI is Working...</h3>
              <p className="text-slate-400">
                Please wait while the AI fills out the application form.
              </p>
            </>
          )}
        </div>
      </div>

      {/* Screenshot Preview */}
      {session.screenshot && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-slate-400 mb-2">Form Preview:</h4>
          <img
            src={session.screenshot}
            alt="Form preview"
            className="w-full rounded-lg border border-slate-700"
          />
        </div>
      )}

      {/* Instructions */}
      {isReady && (
        <div className="bg-green-900/30 border border-green-700 rounded-lg p-4 mb-4">
          <h4 className="font-medium text-green-300 mb-2">Instructions:</h4>
          <ol className="list-decimal list-inside text-sm text-green-200 space-y-1">
            <li>Check the browser window with the filled form</li>
            <li>Solve the CAPTCHA if one appears</li>
            <li>Click the SUBMIT button in the browser</li>
            <li>Wait for confirmation page</li>
            <li>Click "Mark Complete" below</li>
          </ol>
        </div>
      )}

      {/* Notes Input */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-400 mb-1">
          Notes (optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any issues or observations..."
          className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg resize-none h-20"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={() => onComplete(true, notes)}
          disabled={!isReady}
          className="flex-1 btn btn-success py-3"
        >
          ✓ Mark Complete
        </button>
        <button
          onClick={() => onComplete(false, notes)}
          className="btn btn-danger py-3"
        >
          ✗ Failed
        </button>
        <button
          onClick={() => onSkip('Worker skipped')}
          className="btn btn-secondary py-3"
        >
          Skip
        </button>
      </div>
    </div>
  );
}
