import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';

interface MinimalTextAreaProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  title?: string;
  disabled?: boolean;
}

export default function MinimalTextArea({
  value,
  onChange,
  onSubmit,
  placeholder = "",
  title = "Enter text",
  disabled = false
}: MinimalTextAreaProps) {
  const [isTyping, setIsTyping] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    onChange(val);
    if (val.length > 0 && !isTyping) {
      setIsTyping(true);
    } else if (val.length === 0) {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (onSubmit) {
        onSubmit();
      }
    }
  };

  const handleContainerClick = () => {
    if (!disabled) {
      textareaRef.current?.focus();
    }
  };

  return (
    <div
      onClick={handleContainerClick}
      className="w-full cursor-text"
    >
      <div className="max-w-[780px] mx-auto px-8 py-8">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="mb-6"
        >
          <motion.h1
            animate={{
              fontSize: value.length > 0 || isTyping ? '18px' : '24px',
              marginBottom: value.length > 0 || isTyping ? '24px' : '8px',
            }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            style={{
              fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
              fontWeight: 500,
              color: 'var(--text-900)',
              letterSpacing: '-0.01em',
            }}
          >
            {title}
          </motion.h1>
        </motion.div>

        <div className="relative">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            className="w-full bg-transparent border-none outline-none text-foreground resize-none overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
              caretColor: 'var(--text-900)',
              fontSize: '16px',
              lineHeight: '1.5',
              minHeight: '100px',
            }}
            autoComplete="off"
            spellCheck="false"
            placeholder={placeholder}
          />
          {!value && !isTyping && !placeholder && !disabled && (
            <motion.div
              animate={{ opacity: [1, 0] }}
              transition={{ duration: 1, repeat: Infinity, repeatType: 'reverse' }}
              className="absolute left-0 top-0 text-foreground pointer-events-none"
              style={{
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
                fontSize: '16px',
                lineHeight: '1.5',
              }}
            >
              |
            </motion.div>
          )}
        </div>

        {!disabled && (
          <div className="mt-4 text-xs" style={{ color: 'var(--text-600)' }}>
            Press Cmd/Ctrl + Enter to generate
          </div>
        )}
      </div>
    </div>
  );
}
