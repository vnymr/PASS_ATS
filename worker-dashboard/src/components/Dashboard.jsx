import { useState, useEffect } from 'react';
import api from '../api/worker';
import { useWebSocket } from '../hooks/useWebSocket';
import ActiveJob from './ActiveJob';
import Queue from './Queue';
import Stats from './Stats';

export default function Dashboard({ worker, onLogout }) {
  const [activeSession, setActiveSession] = useState(null);
  const [queue, setQueue] = useState([]);
  const [stats, setStats] = useState({ queued: 0, completedToday: 0 });
  const [loading, setLoading] = useState(false);
  const { connected, lastMessage } = useWebSocket();

  // Fetch initial data
  useEffect(() => {
    fetchQueue();
    fetchStats();
  }, []);

  // Handle WebSocket messages
  useEffect(() => {
    if (!lastMessage) return;

    console.log('Dashboard received message:', lastMessage);

    switch (lastMessage.type) {
      case 'AI_STARTED':
      case 'AI_PROGRESS':
      case 'READY_FOR_SUBMIT':
      case 'AI_ERROR':
        setActiveSession(prev => ({
          ...prev,
          status: lastMessage.status,
          message: lastMessage.message,
          ...lastMessage
        }));
        break;

      case 'SESSION_COMPLETE':
        // Session done, clear and refresh
        setActiveSession(null);
        fetchQueue();
        fetchStats();
        break;
    }
  }, [lastMessage]);

  const fetchQueue = async () => {
    try {
      const data = await api.getQueue();
      setQueue(data.queue || []);
    } catch (err) {
      console.error('Failed to fetch queue:', err);
    }
  };

  const fetchStats = async () => {
    try {
      const data = await api.getQueueStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  const handleStartNext = async () => {
    setLoading(true);
    try {
      const data = await api.startNext();

      if (data.empty) {
        alert('No jobs in queue!');
        return;
      }

      setActiveSession({
        id: data.session.id,
        job: data.session.job,
        status: 'ASSIGNED',
        message: 'Starting...'
      });

      fetchQueue();
    } catch (err) {
      alert('Failed to start: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async (success, notes) => {
    if (!activeSession) return;

    try {
      if (success) {
        await api.completeSession(activeSession.id, notes);
      } else {
        await api.failSession(activeSession.id, 'Worker marked as failed', notes);
      }

      setActiveSession(null);
      fetchQueue();
      fetchStats();
    } catch (err) {
      alert('Failed to update: ' + err.message);
    }
  };

  const handleSkip = async (reason) => {
    if (!activeSession) return;

    try {
      await api.skipSession(activeSession.id, reason, true);
      setActiveSession(null);
      fetchQueue();
    } catch (err) {
      alert('Failed to skip: ' + err.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold">Worker Dashboard</h1>
            <span className={`px-2 py-1 rounded text-xs ${connected ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
              {connected ? '● Connected' : '○ Disconnected'}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-slate-400">
              {worker.name} ({worker.role})
            </span>
            <button onClick={onLogout} className="btn btn-secondary text-sm">
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-6">
        {/* Stats Bar */}
        <Stats stats={stats} worker={worker} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          {/* Queue Panel */}
          <div className="lg:col-span-1">
            <Queue
              queue={queue}
              onStartNext={handleStartNext}
              loading={loading}
              hasActiveJob={!!activeSession}
            />
          </div>

          {/* Active Job Panel */}
          <div className="lg:col-span-2">
            {activeSession ? (
              <ActiveJob
                session={activeSession}
                onComplete={handleComplete}
                onSkip={handleSkip}
              />
            ) : (
              <div className="card h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="text-6xl mb-4">🎯</div>
                  <h2 className="text-xl font-medium mb-2">Ready to Work</h2>
                  <p className="text-slate-400 mb-4">
                    Click "Start Next" to begin processing applications
                  </p>
                  <button
                    onClick={handleStartNext}
                    disabled={loading || queue.length === 0}
                    className="btn btn-primary px-8 py-3 text-lg"
                  >
                    {loading ? 'Starting...' : 'Start Next Job'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
