interface HtmlPreviewProps {
  html: string;
  className?: string;
}

/**
 * HtmlPreview - Renders resume HTML in an iframe for isolation
 * Used for previewing HTML-based resume templates
 */
export default function HtmlPreview({ html, className = '' }: HtmlPreviewProps) {
  if (!html) {
    return (
      <div className={`html-preview flex items-center justify-center bg-neutral-100 ${className}`}>
        <p className="text-sm text-neutral-500">No preview available</p>
      </div>
    );
  }

  return (
    <div className={`html-preview relative ${className}`} style={{ width: '100%', height: '100%', minHeight: '100%' }}>
      <iframe
        key={html.substring(0, 100)} // Force re-render when content changes
        srcDoc={html}
        className="border-0 bg-white"
        title="Resume Preview"
        sandbox="allow-same-origin allow-scripts"
        style={{ 
          width: '100%', 
          height: '100%',
          minHeight: '100%',
          display: 'block',
          border: 'none',
          pointerEvents: 'none' // Prevent interaction in mini previews
        }}
        loading="lazy"
      />
    </div>
  );
}

/**
 * Detect if content is HTML or LaTeX
 */
export function isHtmlContent(content: string): boolean {
  if (!content) return false;
  const trimmed = content.trim();
  // Check for HTML markers
  return trimmed.startsWith('<!DOCTYPE') ||
         trimmed.startsWith('<html') ||
         trimmed.startsWith('<div') ||
         trimmed.includes('<body');
}
