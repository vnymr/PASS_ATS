import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton, useAuth } from '@clerk/clerk-react';
// import { api } from '../api-clerk'; // ONBOARDING DISABLED: API not needed without profile check
import logoImg from '../logo.svg';
import { DottedSurface } from '@/components/ui/dotted-surface';
import ExtensionComingSoonModal from '../components/ExtensionComingSoonModal';
import { trackCTAClick, trackExtensionClick } from '../utils/analytics';
import logger from '../utils/logger';
import './Landing.css';

export default function Landing() {
  const navigate = useNavigate();
  const { isSignedIn } = useAuth();
  const [isExtensionModalOpen, setIsExtensionModalOpen] = useState(false);
  const [resumeCount, setResumeCount] = useState<number | null>(null);

  // Redirect signed-in users directly to happy page
  useEffect(() => {
    if (isSignedIn) {
      navigate('/happy');
    }
  }, [isSignedIn, navigate]);

  // Fetch resume count
  useEffect(() => {
    async function fetchResumeCount() {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/stats/resumes`);
        const data = await response.json();
        setResumeCount(data.totalResumes);
      } catch (error) {
        logger.error('Failed to fetch resume count', error);
      }
    }
    fetchResumeCount();
  }, []);
  // ONBOARDING DISABLED: Profile check bypassed - all users go directly to dashboard
  // Original logic checked profile status to show different CTAs
  // To re-enable: Uncomment the profile check code below and update the SignedIn button logic
  /*
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  // Check if user has completed onboarding
  useEffect(() => {
    async function checkProfile() {
      if (!isSignedIn) {
        setHasProfile(null);
        return;
      }

      setLoading(true);
      try {
        const token = await getToken();
        const profile = await api.getProfile(token || undefined);
        setHasProfile(!!profile);
      } catch (err: any) {
        // 404 means no profile (onboarding not completed)
        if (err?.response?.status === 404 || err?.status === 404) {
          setHasProfile(false);
        } else {
          // Other error - assume profile exists
          logger.error('Profile check error', err);
          setHasProfile(true);
        }
      } finally {
        setLoading(false);
      }
    }

    checkProfile();
  }, [isSignedIn, getToken]);
  */

  return (
    <>
      <header className="landing-hero">
        <DottedSurface />

        <nav className="landing-nav" role="navigation" aria-label="Main navigation">
          <div className="nav-container">
            <div className="logo fade-in">
              <img src={logoImg} alt="HappyResumes - AI-Powered ATS Resume Builder Logo" className="logo-img" />
            </div>
            <div className="nav-buttons">
              <SignedOut>
                <SignInButton mode="modal">
                  <button className="btn btn-ghost" aria-label="Sign in to your account">
                    Sign In
                  </button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button className="btn btn-primary" aria-label="Create a free account">Get Started</button>
                </SignUpButton>
              </SignedOut>
              <SignedIn>
                <UserButton afterSignOutUrl="/" />
              </SignedIn>
            </div>
          </div>
        </nav>

        <div className="hero-content">
          <div className="badge fade-in-up">
            <span className="badge-dot"></span>
            AI-Powered Resume Builder
          </div>
          <h1 className="hero-title fade-in-up">
            <em>Free AI Resume Builder</em>
            <br />
            <span className="title-subline">Create ATS-Optimized Resumes in 20 Seconds</span>
          </h1>
          <p className="hero-subtitle fade-in-up">
            Paste any job posting + your info = professional resume in <span className="highlight">20 seconds</span>. No more getting rejected by bots.
          </p>
          <div className="hero-buttons fade-in-up">
            <SignedOut>
              <SignUpButton mode="modal">
                <button
                  className="btn btn-primary btn-large btn-glow"
                  aria-label="Start building your resume for free"
                  onClick={() => trackCTAClick('hero', 'Start Building Your Resume')}
                >
                  <span>Start Building Your Resume</span>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M7.5 15L12.5 10L7.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </SignUpButton>
            </SignedOut>
            <SignedIn>
              <button
                onClick={() => {
                  trackCTAClick('hero', 'Go to Chat');
                  navigate('/happy');
                }}
                className="btn btn-primary btn-large btn-glow"
                aria-label="Navigate to chat"
              >
                <span>Go to Chat</span>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M7.5 15L12.5 10L7.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </SignedIn>
            <button
              className="btn btn-outline btn-large"
              aria-label="Download Chrome extension"
              onClick={() => {
                trackExtensionClick();
                setIsExtensionModalOpen(true);
              }}
            >
              Download Extension
            </button>
          </div>
          <div className="social-proof fade-in-up">
            <div className="avatars">
              <div className="avatar">👤</div>
              <div className="avatar">👤</div>
              <div className="avatar">👤</div>
              <div className="avatar-count">+{resumeCount ? Math.floor(resumeCount / 100) * 100 : '2.5k'}</div>
            </div>
            <p>{resumeCount ? `${resumeCount.toLocaleString()} resumes generated` : 'Join thousands landing their dream jobs'}</p>
          </div>
        </div>
      </header>

      <main>
        <section className="features-section">
          <div className="container">
            <div className="section-header">
              <h2 className="section-title">Why Choose Our Free AI Resume Builder?</h2>
              <p className="section-subtitle">The most advanced ATS-optimized resume generator that helps you land more interviews</p>
            </div>
            <div className="features-grid">
              <article className="feature-card">
                <div className="feature-icon lightning">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <h3 className="feature-title">Lightning Fast AI Resume Generation</h3>
                <p className="feature-description">
                  Our advanced AI resume builder creates ATS-optimized resumes in under 20 seconds. No more spending hours formatting and tailoring your resume for each job application. Get professional results instantly.
                </p>
              </article>
              <article className="feature-card">
                <div className="feature-icon ai">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <h3 className="feature-title">Advanced AI-Powered Resume Optimization</h3>
                <p className="feature-description">
                  Our sophisticated AI technology analyzes job descriptions and automatically optimizes your resume with relevant keywords, skills, and formatting to beat applicant tracking systems used by 99% of companies.
                </p>
              </article>
              <article className="feature-card">
                <div className="feature-icon ats">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22 11.08V12C21.9988 14.1564 21.3005 16.2547 20.0093 17.9818C18.7182 19.7088 16.9033 20.9725 14.8354 21.5839C12.7674 22.1953 10.5573 22.1219 8.53447 21.3746C6.51168 20.6273 4.78465 19.2461 3.61096 17.4371C2.43727 15.628 1.87979 13.4881 2.02168 11.3363C2.16356 9.18455 2.99721 7.13631 4.39828 5.49706C5.79935 3.85781 7.69279 2.71537 9.79619 2.24013C11.8996 1.76489 14.1003 1.98232 16.07 2.86" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M22 4L12 14.01L9 11.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <h3 className="feature-title">ATS-Optimized</h3>
                <p className="feature-description">
                  Every resume is formatted to pass applicant tracking systems used by 99% of Fortune 500 companies, ensuring your resume gets seen by recruiters.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="how-it-works-section">
          <div className="container">
            <div className="section-header">
              <h2 className="section-title">How It Works</h2>
              <p className="section-subtitle">Get your tailored resume in 3 simple steps</p>
            </div>
            <div className="steps-grid">
              <div className="step-card">
                <div className="step-number">01</div>
                <div className="step-icon">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M12 11C14.2091 11 16 9.20914 16 7C16 4.79086 14.2091 3 12 3C9.79086 3 8 4.79086 8 7C8 9.20914 9.79086 11 12 11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <h3 className="step-title">Create Your Profile</h3>
                <p className="step-description">Add your experience, skills, and education once. Our smart system saves it for future use.</p>
              </div>
              <div className="step-connector"></div>
              <div className="step-card">
                <div className="step-number">02</div>
                <div className="step-icon">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <h3 className="step-title">Paste Job Description</h3>
                <p className="step-description">Copy any job posting you want to apply for. Our AI will analyze the requirements.</p>
              </div>
              <div className="step-connector"></div>
              <div className="step-card">
                <div className="step-number">03</div>
                <div className="step-icon">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M7 10L12 15L17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M12 15V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <h3 className="step-title">Get Your Resume</h3>
                <p className="step-description">Download your tailored, ATS-ready PDF in seconds. Ready to submit instantly.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="faq-section">
          <div className="container-narrow">
            <div className="section-header">
              <h2 className="section-title">Frequently Asked Questions</h2>
              <p className="section-subtitle">Everything you need to know</p>
            </div>
            <div className="faq-grid">
              <details className="faq-item">
                <summary className="faq-question">
                  <span>What is an ATS-optimized resume?</span>
                  <svg className="faq-icon" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </summary>
                <p className="faq-answer">
                  An ATS (Applicant Tracking System) optimized resume is formatted to be easily read by the software that 99% of companies use to filter job applications. HappyResumes ensures your resume has the right keywords, formatting, and structure to pass these systems.
                </p>
              </details>
              <details className="faq-item">
                <summary className="faq-question">
                  <span>Is HappyResumes really free?</span>
                  <svg className="faq-icon" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </summary>
                <p className="faq-answer">
                  Yes! You can create unlimited ATS-optimized resumes for free. Our mission is to help job seekers land their dream jobs without financial barriers.
                </p>
              </details>
              <details className="faq-item">
                <summary className="faq-question">
                  <span>How does the AI optimize my resume for each job?</span>
                  <svg className="faq-icon" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </summary>
                <p className="faq-answer">
                  Our AI analyzes the job description to identify key skills, requirements, and keywords. It then intelligently highlights relevant experience from your profile and incorporates the right terminology to match what recruiters are looking for.
                </p>
              </details>
              <details className="faq-item">
                <summary className="faq-question">
                  <span>Can I edit the generated resume?</span>
                  <svg className="faq-icon" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </summary>
                <p className="faq-answer">
                  Yes! While our AI creates an optimized resume, you have full control to review and edit the content before downloading your PDF.
                </p>
              </details>
              <details className="faq-item">
                <summary className="faq-question">
                  <span>How long does it take to create a resume?</span>
                  <svg className="faq-icon" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </summary>
                <p className="faq-answer">
                  After you've created your profile once, generating a new tailored resume takes under 20 seconds. Just paste the job description and click generate!
                </p>
              </details>
            </div>
          </div>
        </section>

        <section className="cta-section">
          <div className="container">
            <div className="cta-card">
              <h2 className="cta-title">Ready to Land Your Dream Job?</h2>
              <p className="cta-subtitle">Join thousands of job seekers who are getting more interviews with ATS-optimized resumes</p>
              <SignedOut>
                <SignUpButton mode="modal">
                  <button
                    className="btn btn-primary btn-large btn-glow"
                    aria-label="Create your free account now"
                    onClick={() => trackCTAClick('cta_section', 'Get Started Free')}
                  >
                    <span>Get Started Free</span>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M7.5 15L12.5 10L7.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </SignUpButton>
              </SignedOut>
              <SignedIn>
                <button
                  onClick={() => {
                    trackCTAClick('cta_section', 'Go to Chat');
                    navigate('/happy');
                  }}
                  className="btn btn-primary btn-large btn-glow"
                >
                  <span>Go to Chat</span>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M7.5 15L12.5 10L7.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </SignedIn>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-section">
              <h4>Product</h4>
              <ul>
                <li><a onClick={() => navigate('/happy')}>Chat</a></li>
                <li><a onClick={() => navigate('/billing')}>Pricing</a></li>
                <li><a href="https://chromewebstore.google.com" target="_blank" rel="noopener noreferrer">Chrome Extension</a></li>
              </ul>
            </div>
            <div className="footer-section">
              <h4>Support</h4>
              <ul>
                <li><a onClick={() => navigate('/support')}>Help Center</a></li>
                <li><a href="mailto:support@happyresumes.com">Contact Us</a></li>
              </ul>
            </div>
            <div className="footer-section">
              <h4>Legal</h4>
              <ul>
                <li><a onClick={() => navigate('/privacy')}>Privacy Policy</a></li>
                <li><a onClick={() => navigate('/terms')}>Terms of Service</a></li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; 2025 HappyResumes. All rights reserved.</p>
          </div>
        </div>
      </footer>

      <ExtensionComingSoonModal 
        isOpen={isExtensionModalOpen}
        onClose={() => setIsExtensionModalOpen(false)}
      />
    </>
  );
}