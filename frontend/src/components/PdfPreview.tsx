import { useState, useEffect, useCallback, useRef } from 'react';
import HtmlPreview, { isHtmlContent } from './HtmlPreview';
import LatexPreview from './LatexPreview';

interface PdfPreviewProps {
  templateId?: string;
  latex?: string;
  html?: string; // HTML content for preview
  className?: string;
  scale?: 'thumbnail' | 'medium' | 'full';
  onError?: (error: string) => void;
  debounceMs?: number;
  fallbackLatex?: string; // LaTeX to render if PDF fails
  fallbackHtml?: string; // HTML to render if PDF fails
}

export default function PdfPreview({
  templateId,
  latex,
  html,
  className = '',
  scale = 'medium',
  onError,
  debounceMs = 2000,
  fallbackLatex,
  fallbackHtml
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

  const fetchPreview = useCallback(async (content?: string) => {
    setLoading(true);
    setError(null);
    setUseFallback(false);

    try {
      let response;

      if (content) {
        // Compile custom content (HTML or legacy LaTeX)
        response = await fetch('/api/templates/preview', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ html: content })
        });
      } else if (templateId) {
        // Get cached preview for template
        response = await fetch(`/api/templates/${templateId}/preview-image`, {
          credentials: 'include'
        });
      } else {
        throw new Error('Either templateId, html, or latex must be provided');
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to generate preview');
      }

      setPdfData(data.pdf);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to load preview';
      setError(errorMessage);
      // If we have fallback content, use the HTML renderer instead
      if (fallbackHtml || fallbackLatex || html || latex) {
        setUseFallback(true);
      }
      onError?.(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [templateId, onError, fallbackLatex, fallbackHtml, latex, html]);

  // Effect for templateId changes (immediate fetch)
  useEffect(() => {
    if (templateId && !latex && !html) {
      fetchPreview();
    }
  }, [templateId, latex, html, fetchPreview]);

  // Effect for content changes (debounced fetch)
  const content = html || latex;
  useEffect(() => {
    if (!content) return;

    // Skip if content hasn't changed
    if (content === lastLatexRef.current) return;
    lastLatexRef.current = content;

    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Set loading state immediately for visual feedback
    setLoading(true);

    // Debounce the actual fetch
    debounceRef.current = setTimeout(() => {
      fetchPreview(content);
    }, debounceMs);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [content, debounceMs, fetchPreview]);

  // Manual refresh function
  const refresh = useCallback(() => {
    if (content) {
      fetchPreview(content);
    } else if (templateId) {
      fetchPreview();
    }
  }, [content, templateId, fetchPreview]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center bg-neutral-100 ${className}`} style={scaleConfig[scale]}>
        <div className="text-center">
          <div className="w-8 h-8 border-3 border-neutral-300 border-t-orange-500 rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm text-neutral-500">Generating PDF...</p>
        </div>
      </div>
    );
  }

  // Fallback to HTML/LaTeX rendering if PDF compilation fails
  if (useFallback && (fallbackHtml || fallbackLatex || html || latex)) {
    const contentToRender = fallbackHtml || html || fallbackLatex || latex || '';
    const isHtml = isHtmlContent(contentToRender);
    return (
      <div className={`relative bg-white ${className}`} style={scaleConfig[scale]}>
        {isHtml ? (
          <HtmlPreview html={contentToRender} className="w-full h-full" />
        ) : (
          <LatexPreview latex={contentToRender} className="w-full h-full" />
        )}
        <div className="absolute bottom-2 left-2 right-2 text-xs text-amber-600 bg-amber-50/90 px-2 py-1 rounded text-center">
          HTML preview (PDF generation pending)
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

  const generatePreview = useCallback(async (content: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/templates/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ html: content })
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
