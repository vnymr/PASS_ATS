import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutGrid } from 'lucide-react';
import { UserButton } from '@clerk/clerk-react';
import MinimalNav from './MinimalNav';
import { ProcessingStep } from './happy/ProcessingStep';
import { JobCard } from './happy/JobCard';
import { SectionHeader } from './happy/SectionHeader';
import { ActionCard } from './happy/ActionCard';
import { RoutineCard } from './happy/RoutineCard';
import { ProgressCard } from './happy/ProgressCard';
import { ApplicationCard } from './happy/ApplicationCard';
import { RoutinesPanel } from './happy/RoutinesPanel';

export type ContentType = 'jobs' | 'routines' | 'progress' | 'actions' | 'applications' | 'overview' | 'resume' | 'general';

export interface ProcessingTool {
  name: string;
  status: 'processing' | 'complete';
}

export interface Message {
  type: 'user' | 'ai';
  content: string;
  contentType?: ContentType;
  jobs?: Array<{ title: string; company: string; location: string }>;
  routines?: Array<{ title: string; time: string; description: string; completed?: boolean }>;
  progress?: Array<{ title: string; count: number; total: number; description: string }>;
  actions?: Array<{ title: string; description: string; actionLabel: string; priority?: 'high' | 'medium' | 'low' }>;
  applications?: Array<{ title: string; company: string; location: string; appliedDate: string; status: 'pending' | 'reviewing' | 'interview' | 'rejected' | 'accepted' }>;
  processing?: ProcessingTool[];
  resumeText?: string;
}

interface ChatInterfaceProps {
  title?: string;
  onSubmit: (message: string) => Promise<Message>;
  placeholder?: string;
  analyzeQuery?: (query: string) => ContentType;
  showDashboard?: boolean;
}

export default function ChatInterface({
  title = "Ask me anything",
  onSubmit,
  placeholder = "",
  analyzeQuery,
  showDashboard = true
}: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentProcessing, setCurrentProcessing] = useState<ProcessingTool[]>([]);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages, isLoading, currentProcessing]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInput(value);
    if (value.length > 0 && !isTyping) {
      setIsTyping(true);
    } else if (value.length === 0) {
      setIsTyping(false);
    }
  };

  const simulateProcessing = async (steps: string[]) => {
    for (let i = 0; i < steps.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 400));
      setCurrentProcessing(prev => [
        ...prev.map(p => ({ ...p, status: 'complete' as const })),
        { name: steps[i], status: 'processing' as const }
      ]);
    }

    await new Promise(resolve => setTimeout(resolve, 400));
    setCurrentProcessing(prev => prev.map(p => ({ ...p, status: 'complete' as const })));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: Message = { type: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    const userQuery = input;
    setInput('');
    setIsTyping(false);
    setIsLoading(true);
    setCurrentProcessing([]);

    // Analyze query if function provided
    const contentType = analyzeQuery ? analyzeQuery(userQuery) : 'general';

    // Default processing steps
    const defaultSteps = ['Processing your request', 'Analyzing context', 'Generating response'];
    await simulateProcessing(defaultSteps);

    // Call the provided onSubmit handler
    const aiResponse = await onSubmit(userQuery);
    aiResponse.processing = currentProcessing;

    setMessages((prev) => [...prev, aiResponse]);
    setIsLoading(false);
    setCurrentProcessing([]);
  };

  const handleContainerClick = () => {
    inputRef.current?.focus();
  };

  return (
    <>
      {/* Minimal Left Navigation */}
      <MinimalNav />

      {/* Top Right - User Button and Dashboard Button */}
      <div className="fixed top-6 right-6 md:top-8 md:right-8 z-40 flex items-center gap-3">
        {showDashboard && (
          <motion.button
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            onClick={(e) => {
              e.stopPropagation();
              setIsPanelOpen(true);
            }}
            className="p-3 bg-card rounded-[12px] shadow-[0_2px_12px_rgba(0,0,0,0.08)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.12)] transition-all duration-200 cursor-pointer"
            style={{
              color: 'var(--text-900)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--background-100)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--card)'}
          >
            <LayoutGrid className="w-5 h-5" />
          </motion.button>
        )}

        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <div className="p-1 bg-card rounded-full shadow-[0_2px_12px_rgba(0,0,0,0.08)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.12)] transition-all duration-200">
            <UserButton
              afterSignOutUrl="/"
              appearance={{
                elements: {
                  avatarBox: 'w-9 h-9',
                  userButtonPopoverCard: 'shadow-lg'
                }
              }}
            />
          </div>
        </motion.div>
      </div>

      <div
        ref={containerRef}
        onClick={handleContainerClick}
        className="min-h-screen bg-background overflow-y-auto cursor-text"
      >
        <div className="max-w-[780px] mx-auto px-8 py-16">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            className="mb-8"
          >
            <motion.h1
              animate={{
                fontSize: messages.length > 0 || isTyping ? '18px' : '24px',
                marginBottom: messages.length > 0 || isTyping ? '32px' : '8px',
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

          <div className="space-y-8 mb-6">
            {messages.map((message, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                {message.type === 'user' ? (
                  <div
                    className="text-foreground"
                    style={{
                      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
                    }}
                  >
                    {message.content}
                  </div>
                ) : (
                  <div className="space-y-6">
                    {message.processing && message.processing.length > 0 && (
                      <div className="rounded-[12px] p-4 mb-4" style={{ backgroundColor: 'var(--background-50)' }}>
                        {message.processing.map((tool, toolIndex) => (
                          <ProcessingStep
                            key={toolIndex}
                            tool={tool.name}
                            status={tool.status}
                            delay={0}
                          />
                        ))}
                      </div>
                    )}

                    {message.content && (
                      <div
                        className="text-foreground whitespace-pre-wrap"
                        style={{
                          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
                        }}
                      >
                        {message.content}
                      </div>
                    )}

                    {message.resumeText && (
                      <div className="rounded-[12px] p-6 font-mono text-sm" style={{ backgroundColor: 'var(--background-50)' }}>
                        <pre className="whitespace-pre-wrap">{message.resumeText}</pre>
                      </div>
                    )}

                    {message.jobs && (
                      <div>
                        <SectionHeader title="Available Jobs" count={message.jobs.length} />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {message.jobs.map((job, jobIndex) => (
                            <JobCard
                              key={jobIndex}
                              title={job.title}
                              company={job.company}
                              location={job.location}
                              delay={jobIndex * 0.1}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {message.routines && (
                      <div>
                        <SectionHeader title="Daily Routine" count={message.routines.length} />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {message.routines.map((routine, routineIndex) => (
                            <RoutineCard
                              key={routineIndex}
                              title={routine.title}
                              time={routine.time}
                              description={routine.description}
                              completed={routine.completed}
                              delay={routineIndex * 0.1}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {message.progress && (
                      <div>
                        <SectionHeader title="Your Progress" />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {message.progress.map((prog, progIndex) => (
                            <ProgressCard
                              key={progIndex}
                              title={prog.title}
                              count={prog.count}
                              total={prog.total}
                              description={prog.description}
                              delay={progIndex * 0.1}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {message.actions && (
                      <div>
                        <SectionHeader title="Recommended Actions" count={message.actions.length} />
                        <div className="grid grid-cols-1 gap-4">
                          {message.actions.map((action, actionIndex) => (
                            <ActionCard
                              key={actionIndex}
                              title={action.title}
                              description={action.description}
                              actionLabel={action.actionLabel}
                              priority={action.priority}
                              delay={actionIndex * 0.1}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {message.applications && (
                      <div>
                        <SectionHeader title="Recent Applications" count={message.applications.length} />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {message.applications.map((app, appIndex) => (
                            <ApplicationCard
                              key={appIndex}
                              title={app.title}
                              company={app.company}
                              location={app.location}
                              appliedDate={app.appliedDate}
                              status={app.status}
                              delay={appIndex * 0.1}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            ))}
          </div>

          <AnimatePresence>
            {isLoading && currentProcessing.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-[12px] p-4 mb-6"
                style={{ backgroundColor: 'var(--background-50)' }}
              >
                {currentProcessing.map((tool, toolIndex) => (
                  <ProcessingStep
                    key={toolIndex}
                    tool={tool.name}
                    status={tool.status}
                    delay={0}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit}>
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={input}
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
              {!input && !isTyping && messages.length === 0 && !placeholder && (
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

      {/* Routines Panel */}
      {showDashboard && (
        <AnimatePresence>
          {isPanelOpen && (
            <RoutinesPanel
              isOpen={isPanelOpen}
              onClose={() => setIsPanelOpen(false)}
            />
          )}
        </AnimatePresence>
      )}
    </>
  );
}
