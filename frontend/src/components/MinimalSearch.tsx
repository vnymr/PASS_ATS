import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';

interface MinimalSearchProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  title?: string;
}

export default function MinimalSearch({
  value,
  onChange,
  onSubmit,
  placeholder = "",
  title = "Search"
}: MinimalSearchProps) {
  const [isTyping, setIsTyping] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);
    if (val.length > 0 && !isTyping) {
      setIsTyping(true);
    } else if (val.length === 0) {
      setIsTyping(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSubmit) {
      onSubmit();
    }
  };

  const handleContainerClick = () => {
    inputRef.current?.focus();
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

        <form onSubmit={handleSubmit}>
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={handleInputChange}
              className="w-full bg-transparent border-none outline-none text-foreground"
              style={{
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
                caretColor: 'var(--text-900)',
                fontSize: '16px',
                lineHeight: '1.5',
              }}
              autoComplete="off"
              spellCheck="false"
              placeholder={placeholder}
            />
            {!value && !isTyping && !placeholder && (
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
        </form>
      </div>
    </div>
  );
}
