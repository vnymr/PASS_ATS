import { useState, useEffect, useRef } from 'react';
import ChatInterface, { ContentType, StreamingCallbacks } from '../components/ChatInterface';

// Use empty string for development to leverage Vite proxy, or explicit URL for production
const API_BASE_URL = (import.meta.env.VITE_API_URL || '').trim();

export default function Happy() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load conversation ID from localStorage on mount
  useEffect(() => {
    const savedConversationId = localStorage.getItem('conversationId');
    if (savedConversationId) {
      setConversationId(savedConversationId);
    }

    // Cleanup on unmount - cancel any ongoing requests
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const analyzeQuery = (query: string): ContentType => {
    const lowerQuery = query.toLowerCase();
    if (lowerQuery.includes('job') || lowerQuery.includes('position') || lowerQuery.includes('opening')) {
      return 'jobs';
    } else if (lowerQuery.includes('routine') || lowerQuery.includes('schedule') || lowerQuery.includes('daily')) {
      return 'routines';
    } else if (lowerQuery.includes('progress') || lowerQuery.includes('status') || lowerQuery.includes('how am i doing')) {
      return 'progress';
    } else if (lowerQuery.includes('applied') || lowerQuery.includes('application')) {
      return 'applications';
    } else if (lowerQuery.includes('what should i') || lowerQuery.includes('recommend') || lowerQuery.includes('next')) {
      return 'actions';
    }
    return 'general';
  };

  const handleSubmitStreaming = async (message: string, callbacks: StreamingCallbacks): Promise<void> => {
    const isDev = import.meta.env.DEV;

    // Cancel any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new AbortController for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const token = localStorage.getItem('token');

    if (!token) {
      callbacks.onError?.('Please sign in to continue.');
      return;
    }

    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

    try {
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          message,
          conversationId: conversationId || undefined
        }),
        signal: abortController.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Read SSE stream
      reader = response.body?.getReader() || null;
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body reader available');
      }

      let buffer = '';
      let currentEventType: string | null = null;

      while (true) {
        let readResult;

        try {
          readResult = await reader.read();
        } catch (readError) {
          // Handle read errors (network issues, etc.)
          if (readError instanceof Error && readError.name === 'AbortError') {
            // Request was cancelled, don't show error
            if (isDev) console.log('[Happy] Stream cancelled');
            break;
          }
          throw readError;
        }

        const { done, value } = readResult;

        if (done) {
          if (isDev) console.log('[Happy] Stream complete');
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');

        // Keep the last incomplete line in buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          // Handle event type declarations
          if (line.startsWith('event: ')) {
            currentEventType = line.substring(7).trim();
            continue;
          }

          // Handle data lines
          if (line.startsWith('data: ')) {
            const data = line.substring(6).trim();

            // Reset event type after processing data
            const eventType = currentEventType;
            currentEventType = null;

            if (!data || data === '[DONE]') {
              continue;
            }

            try {
              const event = data ? JSON.parse(data) : {};

              // Use event type from SSE event: line if no type in JSON, or use JSON type
              const type = event.type || eventType;

              // Handle ping events (heartbeat) - these come as event: ping with {} data
              if (type === 'ping' || eventType === 'ping' || (eventType === 'ping' && Object.keys(event).length === 0)) {
                continue;
              }

              // Handle different SSE event types
              switch (type) {
                case 'thinking':
                  // Backend received message and is processing
                  if (isDev) console.log('[Happy] AI is thinking...');
                  break;

                case 'text':
                  callbacks.onTextChunk?.(event.content);
                  break;

                case 'action':
                  // Tool execution complete - send payload to callback
                  const toolPayload = {
                    ...event.payload,
                    _toolName: event.name
                  };

                  // Map and normalize data for UI
                  if (event.name === 'search_jobs' && event.payload?.items) {
                    toolPayload.items = event.payload.items.map((job: any) => ({
                      title: job.title,
                      company: job.company,
                      location: job.location,
                      id: job.id,
                      salary: job.salary,
                      applyUrl: job.applyUrl
                    }));
                  } else if (event.name === 'track_applications' && event.payload?.applications) {
                    toolPayload.applications = event.payload.applications.map((app: any) => ({
                      title: app.job?.title || 'Unknown Position',
                      company: app.job?.company || 'Unknown Company',
                      location: app.job?.location || 'Unknown',
                      appliedDate: new Date(app.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                      status: app.status.toLowerCase() === 'submitted' ? 'pending' :
                              app.status.toLowerCase() === 'failed' ? 'rejected' :
                              app.status.toLowerCase() === 'interview' ? 'interview' :
                              app.status.toLowerCase() === 'accepted' ? 'accepted' :
                              'reviewing'
                    }));
                  } else if (event.name === 'create_goal' && event.payload) {
                    // Add formatted notification text
                    const targetDate = event.payload.targetDate
                      ? new Date(event.payload.targetDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                      : '';
                    callbacks.onTextChunk?.(`\n\n✅ Created goal: "${event.payload.title}"${targetDate ? ` (Target: ${targetDate})` : ''}`);
                  } else if (event.name === 'create_routine' && event.payload) {
                    callbacks.onTextChunk?.(`\n\n📅 Set up daily routine: "${event.payload.title}" at ${event.payload.scheduledTime || 'your preferred time'}`);
                  } else if (event.name === 'submit_application' && event.payload) {
                    callbacks.onTextChunk?.(`\n\n✉️ Submitted application to ${event.payload.company || 'company'}`);
                  } else if (event.name === 'get_goals' && event.payload?.goals) {
                    const activeGoals = event.payload.goals.filter((g: any) => g.status === 'ACTIVE');
                    if (activeGoals.length > 0) {
                      callbacks.onTextChunk?.(`\n\nActive goals: ${activeGoals.map((g: any) => g.title).join(', ')}`);
                    }
                  }

                  callbacks.onToolExecuted?.(event.name, toolPayload);
                  break;

                case 'conversationId':
                  // Store conversation ID for future messages
                  if (event.conversationId && !conversationId) {
                    setConversationId(event.conversationId);
                    localStorage.setItem('conversationId', event.conversationId);
                  }
                  break;

                case 'error':
                  callbacks.onError?.(event.message);
                  break;

                case 'connected':
                  // Handle connection confirmation - store conversationId if provided
                  if (event.conversationId && !conversationId) {
                    setConversationId(event.conversationId);
                    localStorage.setItem('conversationId', event.conversationId);
                  }
                  break;

                case 'done':
                  // Stream complete
                  callbacks.onComplete?.({
                    type: 'ai',
                    content: '', // Content already streamed
                    contentType: 'general'
                  });
                  break;

                default:
                  // Silently ignore unknown event types to reduce console noise
                  if (isDev) {
                    console.log('[Happy] Unknown SSE event type:', type || eventType || 'unknown');
                  }
              }
            } catch (parseError) {
              if (isDev) {
                console.error('[Happy] Parse error:', parseError, 'Data:', data);
              }
            }
          }
        }
      }
    } catch (error) {
      // Don't show error if request was aborted
      if (error instanceof Error && error.name === 'AbortError') {
        if (isDev) console.log('[Happy] Request aborted');
        return;
      }

      if (isDev) {
        console.error('[Happy] Error calling backend API:', error);
      }
      callbacks.onError?.(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      // Always cleanup reader
      if (reader) {
        try {
          await reader.cancel();
        } catch (cancelError) {
          // Ignore errors during cleanup
          if (isDev) console.log('[Happy] Reader cleanup error (non-critical):', cancelError);
        }
      }

      // Clear abort controller ref
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
    }
  };

  return (
    <ChatInterface
      title="Ask me anything"
      onSubmitStreaming={handleSubmitStreaming}
      analyzeQuery={analyzeQuery}
      showDashboard={true}
    />
  );
}
