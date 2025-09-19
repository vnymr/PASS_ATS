import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api-adapter';
import { setToken } from '../auth';
import logoImg from '../logo.png';
import Icons from '../components/ui/icons';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await api.login(email, password);
      console.log('Login response:', response);

      if (response.token) {
        setToken(response.token);
        console.log('Token set, checking onboarding status');

        if (response.onboardingCompleted === false) {
          navigate('/onboarding');
        } else {
          navigate('/dashboard');
        }
      } else {
        setError('Invalid response from server');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err?.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-container">
      <div className="geometric-bg">
        <div className="geometric-shape shape-1"></div>
        <div className="geometric-shape shape-2"></div>
        <div className="geometric-shape shape-3"></div>
      </div>

      <div className="auth-card">
        <div className="auth-header">
          <img src={logoImg} alt="" className="auth-logo" />
          <h2 className="auth-title">Welcome back</h2>
          <p className="auth-subtitle">Sign in to continue building amazing resumes</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="input-group">
            <label className="input-label">Email</label>
            <div className="input-wrapper">
              <Icons.mail className="input-icon" size={18} />
              <input
                type="email"
                className="input-field with-icon"
                placeholder="Enter your email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Password</label>
            <div className="input-wrapper">
              <Icons.lock className="input-icon" size={18} />
              <input
                type="password"
                className="input-field with-icon"
                placeholder="Enter your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          {error && (
            <div className="error-message">
              <Icons.alertCircle size={16} />
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn btn-primary btn-full">
            {loading ? (
              <>
                <Icons.loader className="animate-spin mr-2" size={18} />
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>

          <div className="auth-footer">
            <p>
              Don't have an account?{' '}
              <Link to="/signup" className="link">
                Sign up
              </Link>
            </p>
            <Link to="/forgot-password" className="link text-sm">
              Forgot password?
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}