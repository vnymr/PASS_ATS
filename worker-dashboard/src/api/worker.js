/**
 * Worker API client
 */

const API_BASE = '/api/worker';

// Get token from localStorage
const getToken = () => localStorage.getItem('workerToken');

// Make authenticated request
async function request(endpoint, options = {}) {
  const token = getToken();

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

// Auth
export const login = (email, password) =>
  request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });

export const getMe = () => request('/auth/me');

// Queue
export const getQueue = () => request('/queue');
export const getQueueStats = () => request('/queue/stats');

// Sessions
export const startNext = () => request('/start-next', { method: 'POST' });

export const getSession = (id) => request(`/session/${id}`);

export const completeSession = (id, notes) =>
  request(`/session/${id}/complete`, {
    method: 'POST',
    body: JSON.stringify({ notes })
  });

export const failSession = (id, reason, notes) =>
  request(`/session/${id}/fail`, {
    method: 'POST',
    body: JSON.stringify({ reason, notes })
  });

export const skipSession = (id, reason, returnToQueue = false) =>
  request(`/session/${id}/skip`, {
    method: 'POST',
    body: JSON.stringify({ reason, returnToQueue })
  });

// Stats
export const getMyStats = () => request('/stats/me');
export const getLeaderboard = () => request('/stats/leaderboard');

export default {
  login,
  getMe,
  getQueue,
  getQueueStats,
  startNext,
  getSession,
  completeSession,
  failSession,
  skipSession,
  getMyStats,
  getLeaderboard
};
