import React from 'react';
import { useNavigate } from 'react-router-dom';
import logoImg from '../logo.png';

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="landing-hero">
      <div className="geometric-bg">
        <div className="geometric-shape shape-1"></div>
        <div className="geometric-shape shape-2"></div>
        <div className="geometric-shape shape-3"></div>
      </div>

      <nav className="landing-nav">
        <div className="nav-container">
          <div className="logo">
            <img src={logoImg} alt="" className="logo-img" />
          </div>
          <div className="nav-buttons">
            <button onClick={() => navigate('/login')} className="btn btn-ghost">
              Sign In
            </button>
            <button onClick={() => navigate('/signup')} className="btn btn-primary">
              Get Started
            </button>
          </div>
        </div>
      </nav>

      <div className="hero-content">
        <h1 className="hero-title">Make Every Application Count</h1>
        <p className="hero-subtitle">
          Turn your profile + any job post into a one-page, ATS-ready resume.
          Every time in under 20 seconds.
        </p>
        <div className="hero-buttons">
          <button onClick={() => navigate('/signup')} className="btn btn-primary btn-large">
            Start Building Your Resume
          </button>
          <button className="btn btn-outline btn-large">
            Download Extension
          </button>
        </div>
      </div>
    </div>
  );
}