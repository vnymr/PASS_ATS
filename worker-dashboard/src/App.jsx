import { useState, useEffect } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import api from './api/worker';

function App() {
  const [worker, setWorker] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if already logged in
    const token = localStorage.getItem('workerToken');
    if (token) {
      api.getMe()
        .then(data => {
          setWorker(data.worker);
        })
        .catch(() => {
          localStorage.removeItem('workerToken');
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const handleLogin = (workerData, token) => {
    localStorage.setItem('workerToken', token);
    setWorker(workerData);
  };

  const handleLogout = () => {
    localStorage.removeItem('workerToken');
    setWorker(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (!worker) {
    return <Login onLogin={handleLogin} />;
  }

  return <Dashboard worker={worker} onLogout={handleLogout} />;
}

export default App;
