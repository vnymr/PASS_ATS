import { useState, useEffect, useCallback, useRef } from 'react';
import LatexPreview from './LatexPreview';

interface PdfPreviewProps {
  templateId?: string;
  latex?: string;
  className?: string;
  scale?: 'thumbnail' | 'medium' | 'full';
  onError?: (error: string) => void;
  debounceMs?: number;
  fallbackLatex?: string; // LaTeX to render if PDF fails
}

export default function PdfPreview({
  templateId,
  latex,
  className = '',
  scale = 'medium',
  onError,
  debounceMs = 2000,
  fallbackLatex
}: PdfPreviewProps) {
  const [pdfData, setPdfData] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [useFallback, setUseFallback] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const lastLatexRef = useRef<string | null>(null);

  // Scale configurations
  const scaleConfig = {
    thumbnail: { width: '100%', height: '200px' },
    medium: { width: '100%', height: '500px' },
    full: { width: '100%', height: '800px' }
  };

  const fetchPreview = useCallback(async (latexContent?: string) => {
    setLoading(true);
    setError(null);
    setUseFallback(false);

    try {
      let response;

      if (latexContent) {
        // Compile custom latex (for customize mode)
        response = await fetch('/api/templates/preview', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ latex: latexContent })
        });
      } else if (templateId) {
        // Get cached preview for template
        response = await fetch(`/api/templates/${templateId}/preview-image`, {
          credentials: 'include'
        });
      } else {
        throw new Error('Either templateId or latex must be provided');
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to generate preview');
      }

      setPdfData(data.pdf);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to load preview';
      setError(errorMessage);
      // If we have fallback latex, use the HTML renderer instead
      if (fallbackLatex || latex) {
        setUseFallback(true);
      }
      onError?.(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [templateId, onError, fallbackLatex, latex]);

  // Effect for templateId changes (immediate fetch)
  useEffect(() => {
    if (templateId && !latex) {
      fetchPreview();
    }
  }, [templateId, latex, fetchPreview]);

  // Effect for latex changes (debounced fetch)
  useEffect(() => {
    if (!latex) return;

    // Skip if latex hasn't changed
    if (latex === lastLatexRef.current) return;
    lastLatexRef.current = latex;

    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Set loading state immediately for visual feedback
    setLoading(true);

    // Debounce the actual fetch
    debounceRef.current = setTimeout(() => {
      fetchPreview(latex);
    }, debounceMs);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [latex, debounceMs, fetchPreview]);

  // Manual refresh function
  const refresh = useCallback(() => {
    if (latex) {
      fetchPreview(latex);
    } else if (templateId) {
      fetchPreview();
    }
  }, [latex, templateId, fetchPreview]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center bg-neutral-100 ${className}`} style={scaleConfig[scale]}>
        <div className="text-center">
          <div className="w-8 h-8 border-3 border-neutral-300 border-t-orange-500 rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm text-neutral-500">Compiling PDF...</p>
        </div>
      </div>
    );
  }

  // Fallback to HTML rendering if PDF compilation fails
  if (useFallback && (fallbackLatex || latex)) {
    const latexToRender = fallbackLatex || latex || '';
    return (
      <div className={`relative bg-white ${className}`} style={scaleConfig[scale]}>
        <LatexPreview latex={latexToRender} className="w-full h-full" />
        <div className="absolute bottom-2 left-2 right-2 text-xs text-amber-600 bg-amber-50/90 px-2 py-1 rounded text-center">
          HTML preview (PDF compiler not available)
        </div>
      </div>
    );
  }

  if (error && !useFallback) {
    return (
      <div className={`flex items-center justify-center bg-red-50 ${className}`} style={scaleConfig[scale]}>
        <div className="text-center p-4">
          <div className="text-red-500 mb-2">
            <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-sm text-red-600 mb-2">{error}</p>
          <button
            onClick={refresh}
            className="text-xs px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!pdfData) {
    return (
      <div className={`flex items-center justify-center bg-neutral-100 ${className}`} style={scaleConfig[scale]}>
        <p className="text-sm text-neutral-500">No preview available</p>
      </div>
    );
  }

  const pdfUrl = `data:application/pdf;base64,${pdfData}`;

  return (
    <div className={`relative bg-white ${className}`} style={scaleConfig[scale]}>
      <embed
        src={pdfUrl}
        type="application/pdf"
        width="100%"
        height="100%"
        style={{ border: 'none' }}
      />
    </div>
  );
}

// Export a hook for manual control
export function usePdfPreview() {
  const [pdfData, setPdfData] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generatePreview = useCallback(async (latex: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/templates/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ latex })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to generate preview');
      }

      setPdfData(data.pdf);
      return data.pdf;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { pdfData, loading, error, generatePreview };
}
