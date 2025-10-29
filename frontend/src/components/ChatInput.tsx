import { useState, useRef, FormEvent } from 'react';

interface ChatInputProps {
  onSearch: (query: string) => void;
}

type TabType = 'natural' | 'similar' | 'description' | 'boolean' | 'manual';

export default function ChatInput({ onSearch }: ChatInputProps) {
  const [value, setValue] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>('natural');
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

  const tabs = [
    { id: 'natural' as TabType, label: 'Who are you looking for?', icon: '✨' },
    { id: 'similar' as TabType, label: 'Find Similar', icon: '👥' },
    { id: 'description' as TabType, label: 'Job Description', icon: '📄' },
    { id: 'boolean' as TabType, label: 'Boolean', icon: '⚡' },
    { id: 'manual' as TabType, label: 'Select Manually', icon: '🔧' },
  ];

  const filters = [
    'Location',
    'Job Title',
    'Years of Experience',
    'Industry',
    'Skills'
  ];

  return (
    <div className="w-full">
      {/* Tabs */}
      <div className="flex gap-0 mb-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="px-6 py-3 text-sm font-medium transition-all border-2 border-b-0 first:rounded-tl-xl last:rounded-tr-xl"
            style={{
              borderColor: activeTab === tab.id ? 'var(--text-950)' : 'transparent',
              backgroundColor: activeTab === tab.id ? 'var(--background)' : 'transparent',
              color: activeTab === tab.id ? 'var(--primary-600)' : 'var(--text-600)',
            }}
          >
            <span className="mr-2">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Input Container */}
      <form onSubmit={handleSubmit} className="w-full">
        <div
          className="flex items-center gap-3 rounded-b-2xl rounded-tr-2xl border-2 p-5 transition-all focus-within:border-primary-600"
          style={{
            borderColor: 'var(--text-950)',
            backgroundColor: 'var(--background)',
            borderTopLeftRadius: activeTab === 'natural' ? '0' : undefined,
          }}
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Software Engineers with 5+ yrs of experience at fintech companies in the Bay Area"
            rows={1}
            className="flex-1 resize-none bg-transparent outline-none text-base"
            style={{
              color: 'var(--text-950)',
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
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </form>

      {/* Filter Pills */}
      <div className="flex gap-2 mt-4 flex-wrap">
        {filters.map((filter) => (
          <button
            key={filter}
            className="px-4 py-2 text-xs font-medium rounded-full border transition-all hover:shadow-sm"
            style={{
              borderColor: 'var(--text-300)',
              backgroundColor: 'var(--background)',
              color: 'var(--text-600)',
            }}
          >
            <span className="mr-1">✓</span>
            {filter}
          </button>
        ))}
      </div>
    </div>
  );
}
