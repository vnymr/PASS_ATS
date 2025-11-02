import { TextareaHTMLAttributes, forwardRef, useEffect, useRef } from 'react';

interface MinimalTextareaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  autoResize?: boolean;
}

const MinimalTextareaField = forwardRef<HTMLTextAreaElement, MinimalTextareaFieldProps>(
  ({ label, error, autoResize = true, className = '', ...props }, ref) => {
    const internalRef = useRef<HTMLTextAreaElement>(null);
    const textareaRef = (ref as any) || internalRef;

    // Auto-resize functionality
    useEffect(() => {
      if (autoResize && textareaRef.current) {
        const textarea = textareaRef.current;
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
      }
    }, [props.value, autoResize, textareaRef]);

    return (
      <div className="w-full">
        {label && (
          <label
            className="block mb-2 text-xs font-medium"
            style={{
              color: 'var(--text-700)',
              fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
              letterSpacing: '0.02em',
              textTransform: 'uppercase'
            }}
          >
            {label}
          </label>
        )}
        <textarea
          ref={textareaRef}
          className={`w-full bg-transparent border-0 border-b border-[var(--text-200)] px-0 py-2 outline-none resize-none transition-all duration-200 focus:border-[var(--primary-600)] ${className}`}
          style={{
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
            fontSize: '15px',
            color: 'var(--text-900)',
            caretColor: 'var(--primary-600)',
            lineHeight: '1.6',
            minHeight: '80px',
          }}
          {...props}
        />
        {error && (
          <p
            className="mt-1 text-xs"
            style={{
              color: '#b91c1c',
              fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
            }}
          >
            {error}
          </p>
        )}
      </div>
    );
  }
);

MinimalTextareaField.displayName = 'MinimalTextareaField';

export default MinimalTextareaField;
