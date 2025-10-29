import { useState, useRef, FormEvent } from 'react';

interface PromptBoxProps {
  onSearch: (query: string) => void;
}

export default function PromptBox({ onSearch }: PromptBoxProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onSearch(value.trim());
      setValue("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div
        className="flex items-center gap-3 rounded-2xl border-2 p-5 transition-all focus-within:border-primary-600"
        style={{
          borderColor: 'var(--text-950)',
          backgroundColor: 'var(--background)'
        }}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="I'm looking for software engineer roles at Google..."
          rows={1}
          className="flex-1 resize-none bg-transparent outline-none text-base placeholder:text-gray-400"
          style={{
            color: 'var(--text-950)'
          }}
        />
        <button
          type="submit"
          disabled={!value.trim()}
          className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-white transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ backgroundColor: 'var(--primary-500)' }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
          </svg>
        </button>
      </div>
    </form>
  );
}
