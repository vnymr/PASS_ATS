import React from 'react';
import { useNavigate } from 'react-router-dom';
import Icons from './ui/icons';

interface ErrorFallbackProps {
  error: Error | null;
  onReset?: () => void;
}

export default function ErrorFallback({ error, onReset }: ErrorFallbackProps) {
  const navigate = useNavigate();
  const isDev = import.meta.env.DEV;

  const handleGoHome = () => {
    navigate('/');
    onReset?.();
  };

  const handleReload = () => {
    window.location.reload();
  };

  const handleRetry = () => {
    onReset?.();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] p-6">
      <div className="bg-[var(--background-elevated)] rounded-2xl max-w-lg w-full shadow-xl border border-[var(--text-200)] p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
            <Icons.alertCircle className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-[var(--text-900)]">
              Something went wrong
            </h1>
            <p className="text-sm text-[var(--text-600)]">
              We encountered an unexpected error
            </p>
          </div>
        </div>

        <p className="text-[var(--text-700)] mb-6">
          Don't worry, your data is safe. Try refreshing the page or going back to the home page.
        </p>

        {isDev && error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm font-medium text-red-800 mb-2">
              Error Details (dev only):
            </p>
            <pre className="text-xs text-red-700 overflow-auto max-h-32 whitespace-pre-wrap">
              {error.message}
              {error.stack && `\n\n${error.stack}`}
            </pre>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          {onReset && (
            <button
              onClick={handleRetry}
              className="flex items-center gap-2 px-4 py-2.5 bg-[var(--primary)] hover:bg-[var(--primary-600)] text-white rounded-lg font-medium transition-colors"
            >
              <Icons.refresh className="w-4 h-4" />
              Try Again
            </button>
          )}
          <button
            onClick={handleReload}
            className="flex items-center gap-2 px-4 py-2.5 bg-[var(--text-200)] hover:bg-[var(--text-300)] text-[var(--text-900)] rounded-lg font-medium transition-colors"
          >
            <Icons.refresh className="w-4 h-4" />
            Reload Page
          </button>
          <button
            onClick={handleGoHome}
            className="flex items-center gap-2 px-4 py-2.5 border border-[var(--text-300)] hover:bg-[var(--text-100)] text-[var(--text-700)] rounded-lg font-medium transition-colors"
          >
            <Icons.home className="w-4 h-4" />
            Go Home
          </button>
        </div>

        <p className="mt-6 text-xs text-[var(--text-500)]">
          If this keeps happening, please contact{' '}
          <a href="/support" className="text-[var(--primary)] hover:underline">
            support
          </a>
          .
        </p>
      </div>
    </div>
  );
}
