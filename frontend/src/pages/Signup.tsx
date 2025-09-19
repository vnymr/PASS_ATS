import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api-adapter';
import { setToken } from '../auth';
import logoImg from '../logo.png';
import Icons from '../components/ui/icons';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.signup(email, password);

      if (response.token) {
        setToken(response.token);
        navigate('/onboarding');
      }
    } catch (err: any) {
      console.error('Signup error:', err);
      setError(err?.message || 'Failed to create account');
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
          <h2 className="auth-title">Create your account</h2>
          <p className="auth-subtitle">Start building ATS-optimized resumes today</p>
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
                placeholder="Create a strong password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Confirm Password</label>
            <div className="input-wrapper">
              <Icons.lock className="input-icon" size={18} />
              <input
                type="password"
                className="input-field with-icon"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
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
                Creating account...
              </>
            ) : (
              'Sign Up'
            )}
          </button>

          <div className="auth-footer">
            <p>
              Already have an account?{' '}
              <Link to="/login" className="link">
                Sign in
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}