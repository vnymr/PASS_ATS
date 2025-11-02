import { InputHTMLAttributes, forwardRef } from 'react';

interface MinimalInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const MinimalInput = forwardRef<HTMLInputElement, MinimalInputProps>(
  ({ label, error, className = '', ...props }, ref) => {
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
        <input
          ref={ref}
          className={`w-full bg-transparent border-0 border-b border-[var(--text-200)] px-0 py-2 outline-none transition-all duration-200 focus:border-[var(--primary-600)] ${className}`}
          style={{
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
            fontSize: '15px',
            color: 'var(--text-900)',
            caretColor: 'var(--primary-600)',
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

MinimalInput.displayName = 'MinimalInput';

export default MinimalInput;
