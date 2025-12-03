import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Hook for WebSocket connection to worker server
 */
export function useWebSocket() {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [lastMessage, setLastMessage] = useState(null);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  const connect = useCallback(() => {
    const token = localStorage.getItem('workerToken');
    if (!token) {
      console.log('No token, skipping WebSocket connection');
      return;
    }

    // Determine WebSocket URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/worker?token=${token}`;

    console.log('Connecting to WebSocket:', wsUrl);

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
      setConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('WebSocket message:', data);
        setLastMessage(data);
        setMessages(prev => [...prev.slice(-50), data]); // Keep last 50 messages
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setConnected(false);
      wsRef.current = null;

      // Reconnect after 3 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        console.log('Attempting to reconnect...');
        connect();
      }, 3000);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnected(false);
  }, []);

  const sendMessage = useCallback((data) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  // Connect when component mounts
  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  // Reconnect when token changes
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'workerToken') {
        disconnect();
        if (e.newValue) {
          setTimeout(connect, 100);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [connect, disconnect]);

  return {
    connected,
    messages,
    lastMessage,
    sendMessage,
    connect,
    disconnect
  };
}

export default useWebSocket;
