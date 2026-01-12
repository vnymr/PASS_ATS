import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutGrid, Briefcase } from 'lucide-react';
import { UserButton } from '@clerk/clerk-react';
import { ProcessingStep } from './happy/ProcessingStep';
import { JobCard } from './happy/JobCard';
import { SectionHeader } from './happy/SectionHeader';
import { ActionCard } from './happy/ActionCard';
import { RoutineCard } from './happy/RoutineCard';
import { ProgressCard } from './happy/ProgressCard';
import { ApplicationCard } from './happy/ApplicationCard';
import { RoutinesPanel } from './happy/RoutinesPanel';
import { DashboardPanel } from './happy/DashboardPanel';
import { PromptBox } from './ui/chatgpt-prompt-input';

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

export interface StreamingCallbacks {
  onTextChunk?: (chunk: string) => void;
  onToolExecuted?: (toolName: string, payload: any) => void;
  onComplete?: (message: Message) => void;
  onError?: (error: string) => void;
}

interface ChatInterfaceProps {
  title?: string;
  onSubmit?: (message: string) => Promise<Message>;
  onSubmitStreaming?: (message: string, callbacks: StreamingCallbacks) => Promise<void>;
  placeholder?: string;
  analyzeQuery?: (query: string) => ContentType;
  showDashboard?: boolean;
}

export default function ChatInterface({
  title = "Ask me anything",
  onSubmit,
  onSubmitStreaming,
  placeholder = "",
  analyzeQuery,
  showDashboard = true
}: ChatInterfaceProps) {
  const isDev = import.meta.env.DEV;
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentProcessing, setCurrentProcessing] = useState<ProcessingTool[]>([]);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isDashboardPanelOpen, setIsDashboardPanelOpen] = useState(false);
  const [streamingMessageIndex, setStreamingMessageIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const streamingContentRef = useRef<HTMLDivElement>(null);
  const accumulatedContentRef = useRef<string>('');

  // Debug: Log messages when they change
  useEffect(() => {
    if (isDev) {
      console.log('[ChatInterface] Messages state changed:', {
        count: messages.length,
        messages: messages.map(m => ({ type: m.type, contentLength: m.content?.length || 0, hasContent: !!m.content })),
        streamingIndex: streamingMessageIndex,
        isLoading
      });
    }
  }, [messages, streamingMessageIndex, isLoading]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages, isLoading, currentProcessing]);

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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Get the message from form data (for the new ChatGPT-style PromptBox)
    const formData = new FormData(e.currentTarget);
    const formMessage = formData.get('message') as string || '';
    const messageContent = formMessage.trim() || input.trim();

    if (isDev) {
      console.log('[ChatInterface] handleSubmit called, input:', messageContent, 'isLoading:', isLoading);
    }
    if (!messageContent || isLoading) return;

    const userMessage: Message = { type: 'user', content: messageContent };
    const userQuery = messageContent;
    setInput('');
    setIsTyping(false);

    // Reset the form (clears the PromptBox internal state)
    e.currentTarget.reset();
    setIsLoading(true);
    setCurrentProcessing([]);
    setError(null);

    // Create empty AI message for streaming
    const aiMessage: Message = {
      type: 'ai',
      content: '',
      contentType: 'general',
      processing: []
    };

    // Reset accumulated content for new message
    accumulatedContentRef.current = '';

    // Calculate AI message index based on current state
    const aiMessageIndex = messages.length + 1;
    
    setMessages((prev) => {
      if (isDev) {
        console.log('[ChatInterface] Previous messages:', prev.length);
      }
      const newMessages = [...prev, userMessage, aiMessage];
      if (isDev) {
        console.log('[ChatInterface] New messages after adding both:', newMessages.length, 'AI index:', aiMessageIndex);
      }
      return newMessages;
    });

    // Set streaming index
    setStreamingMessageIndex(aiMessageIndex);
    if (isDev) {
      console.log('[ChatInterface] 🚀 Streaming started for message at index:', aiMessageIndex);
    }

    try {
      // Use streaming callback if available
      if (onSubmitStreaming) {
        if (isDev) {
          console.log('[ChatInterface] 📡 Calling onSubmitStreaming with query:', userQuery.substring(0, 30));
        }
        await onSubmitStreaming(userQuery, {
          onTextChunk: (chunk: string) => {
            if (isDev) {
              console.log('[ChatInterface] ✅ Text chunk received:', chunk.substring(0, 50));
            }
            // Accumulate content in ref to avoid stale closures
            accumulatedContentRef.current += chunk;

            // Capture the current accumulated content to avoid closure issues
            const currentContent = accumulatedContentRef.current;

            // Use regular state update - React 18's automatic batching handles optimization
            // The 30ms delay between chunks in the backend ensures visible streaming
            setMessages((prev) => {
              const updated = [...prev];
              const lastIndex = updated.length - 1;
              if (updated[lastIndex] && updated[lastIndex].type === 'ai') {
                // Use the captured content, not the ref (which might be reset)
                updated[lastIndex] = {
                  ...updated[lastIndex],
                  content: currentContent
                };
                if (isDev) {
                  console.log('[ChatInterface] 🔄 Updated content, length:', currentContent.length);
                }
              }
              return updated;
            });
          },
          onToolExecuted: (toolName: string, payload: any) => {
            if (isDev) {
              console.log('[ChatInterface] onToolExecuted called:', toolName, payload);
            }
            // Add to processing steps
            setCurrentProcessing((prev) => [
              ...prev,
              { name: toolName, status: 'complete' }
            ]);

            // Update message with tool results
            setMessages((prev) => {
              const updated = [...prev];
              const lastIndex = updated.length - 1;
              if (updated[lastIndex] && updated[lastIndex].type === 'ai') {
                const msg = updated[lastIndex];
                if (isDev) {
                  console.log('[ChatInterface] Updating message with tool result:', toolName);
                }

                // Map tool results to message properties
                if (toolName === 'search_jobs' && payload?.items) {
                  if (isDev) {
                    console.log('[ChatInterface] Setting jobs:', payload.items.length);
                  }
                  msg.jobs = payload.items;
                  msg.contentType = 'jobs';
                } else if (toolName === 'track_applications' && payload?.applications) {
                  if (isDev) {
                    console.log('[ChatInterface] Setting applications:', payload.applications.length);
                  }
                  msg.applications = payload.applications;
                  msg.contentType = 'applications';
                } else if (toolName === 'create_goal' && payload) {
                  msg.content += `\n\n✅ Created goal: "${payload.title}"`;
                } else if (toolName === 'create_routine' && payload) {
                  msg.content += `\n\n📅 Set up routine: "${payload.title}"`;
                }

                msg.processing = currentProcessing;
              }
              return updated;
            });
          },
          onComplete: (finalMessage: Message) => {
            if (isDev) {
              console.log('[ChatInterface] onComplete called, final content length:', accumulatedContentRef.current.length);
            }
            // Ensure final content is in state (should already be there from onTextChunk)
            setMessages((prev) => {
              const updated = [...prev];
              const lastIndex = updated.length - 1;
              if (updated[lastIndex] && updated[lastIndex].type === 'ai') {
                // Make sure content is set (use ref in case state didn't capture last chunk)
                const finalContent = accumulatedContentRef.current || updated[lastIndex].content;
                if (finalContent !== updated[lastIndex].content) {
                  updated[lastIndex] = {
                    ...updated[lastIndex],
                    content: finalContent
                  };
                  if (isDev) {
                    console.log('[ChatInterface] Synced final content on complete, length:', finalContent.length);
                  }
                }
              }
              return updated;
            });
            // Reset ref after ensuring state is updated
            accumulatedContentRef.current = '';
          },
          onError: (errorMsg: string) => {
            if (isDev) {
              console.error('[ChatInterface] onError called:', errorMsg);
            }
            setError(errorMsg);
            setMessages((prev) => {
              const updated = [...prev];
              const lastIndex = updated.length - 1;
              if (updated[lastIndex] && updated[lastIndex].type === 'ai') {
                updated[lastIndex].content = `Error: ${errorMsg}`;
              }
              return updated;
            });
          }
        });
      } else if (onSubmit) {
        // Fallback to promise-based submit
        const defaultSteps = ['Processing your request', 'Analyzing context', 'Generating response'];
        await simulateProcessing(defaultSteps);

        const aiResponse = await onSubmit(userQuery);
        aiResponse.processing = currentProcessing;

        setMessages((prev) => {
          const updated = [...prev];
          const lastIndex = updated.length - 1;
          updated[lastIndex] = aiResponse;
          return updated;
        });
      }
    } catch (error) {
      if (isDev) {
        console.error('Error in handleSubmit:', error);
      }
      setError(error instanceof Error ? error.message : 'Unknown error');
      setMessages((prev) => {
        const updated = [...prev];
        const lastIndex = updated.length - 1;
        if (updated[lastIndex] && updated[lastIndex].type === 'ai') {
          updated[lastIndex].content = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
        return updated;
      });
    } finally {
      setIsLoading(false);
      setCurrentProcessing([]);
      setStreamingMessageIndex(null);
    }
  };

  return (
    <>
      {/* Top Right - User Button and Panel Buttons */}
      <div className="fixed top-6 right-6 md:top-8 md:right-8 z-40 flex items-center gap-3">
        {showDashboard && (
          <>
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
              title="Routines"
            >
              <LayoutGrid className="w-5 h-5" />
            </motion.button>

            <motion.button
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.25 }}
              onClick={(e) => {
                e.stopPropagation();
                setIsDashboardPanelOpen(true);
              }}
              className="p-3 bg-card rounded-[12px] shadow-[0_2px_12px_rgba(0,0,0,0.08)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.12)] transition-all duration-200 cursor-pointer"
              style={{
                color: 'var(--text-900)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--background-100)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--card)'}
              title="Applications Dashboard"
            >
              <Briefcase className="w-5 h-5" />
            </motion.button>
          </>
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
        className="min-h-screen bg-background"
      >
        <div className="max-w-[780px] mx-auto px-4 sm:px-8 py-8 sm:py-16">
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
                    style={{
                      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
                      color: 'var(--text-900, #1a1a1a)',
                      fontSize: '16px',
                      lineHeight: '1.6',
                      fontWeight: 600
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

                    {/* Show AI message content - always render if it's the streaming message or has content */}
                    {(streamingMessageIndex === index || message.content) && (
                      <div
                        ref={streamingMessageIndex === index ? streamingContentRef : null}
                        className="whitespace-pre-wrap"
                        style={{
                          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
                          color: 'var(--text-900, #1a1a1a)',
                          fontSize: '16px',
                          lineHeight: '1.6',
                          minHeight: streamingMessageIndex === index && isLoading ? '1em' : 'auto'
                        }}
                      >
                        {message.content || ''}
                        {streamingMessageIndex === index && isLoading && !message.content && (
                          <span style={{ color: '#666' }}>...</span>
                        )}
                        {streamingMessageIndex === index && isLoading && (
                          <motion.span
                            animate={{ opacity: [1, 0] }}
                            transition={{ duration: 0.8, repeat: Infinity, repeatType: 'reverse' }}
                            style={{ color: 'var(--primary-600, #2563eb)', marginLeft: '2px' }}
                          >
                            ▋
                          </motion.span>
                        )}
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

          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-[12px] p-4 mb-6"
              style={{ backgroundColor: 'var(--accent-100)', borderLeft: '3px solid var(--accent-600)' }}
            >
              <div className="flex items-start gap-3">
                <span style={{ color: 'var(--accent-700)', fontSize: '14px' }}>⚠️</span>
                <div style={{ flex: 1 }}>
                  <p style={{ color: 'var(--accent-900)', fontSize: '14px', marginBottom: '8px' }}>{error}</p>
                  <button
                    onClick={() => {
                      setError(null);
                    }}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--accent-600)',
                      color: 'white',
                      fontSize: '13px',
                      fontWeight: 500,
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="w-full">
            <PromptBox
              name="message"
              placeholder={placeholder || "Message Resume Tailor..."}
              disabled={isLoading}
              className="w-full"
            />
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

      {/* Dashboard Panel */}
      {showDashboard && (
        <AnimatePresence>
          {isDashboardPanelOpen && (
            <DashboardPanel
              isOpen={isDashboardPanelOpen}
              onClose={() => setIsDashboardPanelOpen(false)}
            />
          )}
        </AnimatePresence>
      )}
    </>
  );
}
