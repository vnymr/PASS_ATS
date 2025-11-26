import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton, useAuth } from '@clerk/clerk-react';
import { Menu, CheckCircle, Zap, Shield, FileText, MousePointer, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HeroSection, FeatureSection, CareerCoachSection, CTASection } from '@/components/landing';
import logoImg from '../logo.svg';
import { trackCTAClick } from '../utils/analytics';
import logger from '../utils/logger';

export default function Landing() {
  const navigate = useNavigate();
  const { isSignedIn } = useAuth();
  const [resumeCount, setResumeCount] = useState<number | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

  const handleGetStarted = () => {
    trackCTAClick('hero', 'Start Your Free Trial');
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f5f7f7' }}>
      {/* Navigation */}
      <nav
        className="sticky top-0 z-50 px-6 py-3.5 backdrop-blur-md border-b"
        style={{ backgroundColor: 'rgba(245, 247, 247, 0.8)', borderColor: 'rgba(28, 63, 64, 0.06)' }}
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-10">
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="flex items-center gap-2"
            >
              <img src={logoImg} alt="HappyResume Logo" className="h-8 w-auto" />
            </button>

            <div className="hidden md:flex items-center gap-7">
              <button
                onClick={() => navigate('/features')}
                className="hover:opacity-70 transition-opacity text-[0.875rem]"
                style={{ color: '#0c1310' }}
              >
                Features
              </button>
              <button
                onClick={() => navigate('/extension')}
                className="hover:opacity-70 transition-opacity text-[0.875rem]"
                style={{ color: '#0c1310' }}
              >
                Chrome Extension
              </button>
              <button
                onClick={() => navigate('/pricing')}
                className="hover:opacity-70 transition-opacity text-[0.875rem]"
                style={{ color: '#0c1310' }}
              >
                Pricing
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <SignedOut>
              <SignInButton mode="modal">
                <Button
                  variant="ghost"
                  className="hidden md:inline-flex h-9 px-4 text-[0.875rem]"
                  style={{ color: '#0c1310' }}
                >
                  Sign In
                </Button>
              </SignInButton>

              <SignUpButton mode="modal">
                <Button
                  className="h-9 px-4 text-[0.875rem]"
                  style={{
                    backgroundColor: '#3eaca7',
                    color: '#ffffff'
                  }}
                  onClick={handleGetStarted}
                >
                  Get Started
                </Button>
              </SignUpButton>
            </SignedOut>

            <SignedIn>
              <Button
                className="h-9 px-4 text-[0.875rem]"
                style={{
                  backgroundColor: '#3eaca7',
                  color: '#ffffff'
                }}
                onClick={() => navigate('/happy')}
              >
                Go to Dashboard
              </Button>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>

            <Button
              variant="ghost"
              size="icon"
              className="md:hidden h-9 w-9"
              style={{ color: '#0c1310' }}
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              <Menu className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden mt-4 pb-4 border-t" style={{ borderColor: 'rgba(28, 63, 64, 0.08)' }}>
            <div className="flex flex-col gap-3 pt-4">
              <button
                onClick={() => { navigate('/features'); setIsMobileMenuOpen(false); }}
                className="px-4 py-2 text-[0.875rem] hover:bg-gray-100 rounded-lg text-left"
                style={{ color: '#0c1310' }}
              >
                Features
              </button>
              <button
                onClick={() => { navigate('/extension'); setIsMobileMenuOpen(false); }}
                className="px-4 py-2 text-[0.875rem] hover:bg-gray-100 rounded-lg text-left"
                style={{ color: '#0c1310' }}
              >
                Chrome Extension
              </button>
              <button
                onClick={() => { navigate('/pricing'); setIsMobileMenuOpen(false); }}
                className="px-4 py-2 text-[0.875rem] hover:bg-gray-100 rounded-lg text-left"
                style={{ color: '#0c1310' }}
              >
                Pricing
              </button>
              <SignedOut>
                <SignInButton mode="modal">
                  <button
                    className="px-4 py-2 text-[0.875rem] hover:bg-gray-100 rounded-lg text-left"
                    style={{ color: '#0c1310' }}
                  >
                    Sign In
                  </button>
                </SignInButton>
              </SignedOut>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <SignedOut>
        <SignUpButton mode="modal">
          <div>
            <HeroSection
              onGetStarted={handleGetStarted}
              onWatchDemo={() => {}}
              resumeCount={resumeCount}
            />
          </div>
        </SignUpButton>
      </SignedOut>
      <SignedIn>
        <HeroSection
          onGetStarted={() => navigate('/happy')}
          onWatchDemo={() => {}}
          resumeCount={resumeCount}
        />
      </SignedIn>

      {/* Features Section */}
      <div id="features">
        {/* AI Resume Generator Section */}
        <FeatureSection
          badge="AI Resume Generator"
          title="AI Resume Generator That Beats the Bots"
          description="Our AI doesn't just fill in a template. It analyzes your profile and the job description to generate a professionally designed, ATS-optimized resume in seconds. Built on LaTeX, our resumes are flawless by design."
          features={[
            {
              icon: <CheckCircle className="w-5 h-5" />,
              title: "ATS-Optimized",
              description: "Keywords and formatting designed to pass through any applicant tracking system."
            },
            {
              icon: <FileText className="w-5 h-5" />,
              title: "LaTeX Precision",
              description: "Get a pixel-perfect, professional resume that stands out."
            },
            {
              icon: <Zap className="w-5 h-5" />,
              title: "AI-Tailored Content",
              description: "Generate unique summaries and bullet points for every application."
            }
          ]}
          visualContent={
            <div
              className="rounded-xl p-6 shadow-sm border"
              style={{ backgroundColor: '#ffffff', borderColor: 'rgba(28, 63, 64, 0.08)' }}
            >
              <div className="space-y-4">
                {/* Resume preview */}
                <div className="space-y-2.5">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full" style={{ backgroundColor: '#e5e9e9' }} />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 rounded" style={{ backgroundColor: '#e5e9e9', width: '55%' }} />
                      <div className="h-2 rounded" style={{ backgroundColor: '#e5e9e9', width: '35%' }} />
                    </div>
                  </div>

                  <div className="h-px" style={{ backgroundColor: 'rgba(28, 63, 64, 0.08)' }} />

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#3eaca7' }} />
                      <div className="h-2 rounded flex-1" style={{ backgroundColor: '#e5e9e9' }} />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#409677' }} />
                      <div className="h-2 rounded flex-1" style={{ backgroundColor: '#e5e9e9', width: '85%' }} />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#3eaca7' }} />
                      <div className="h-2 rounded flex-1" style={{ backgroundColor: '#e5e9e9', width: '70%' }} />
                    </div>
                  </div>
                </div>

                <div className="h-px" style={{ backgroundColor: 'rgba(28, 63, 64, 0.08)' }} />

                <div className="space-y-3">
                  <div className="h-3 rounded" style={{ backgroundColor: '#3eaca7', opacity: 0.15, width: '45%' }} />
                  <div className="space-y-1.5">
                    <div className="h-2 rounded" style={{ backgroundColor: '#e5e9e9' }} />
                    <div className="h-2 rounded" style={{ backgroundColor: '#e5e9e9', width: '90%' }} />
                    <div className="h-2 rounded" style={{ backgroundColor: '#e5e9e9', width: '95%' }} />
                  </div>
                </div>
              </div>
            </div>
          }
        />

        {/* AI Job Application Filler Section */}
        <FeatureSection
          badge="Auto-Apply Technology"
          title="Apply to Hundreds of Jobs, Automatically"
          description="Why waste hours on repetitive forms? Our AI job application filler, powered by our stealth browser technology, applies to jobs on your behalf. It's smart, silent, and effective."
          features={[
            {
              icon: <Shield className="w-5 h-5" />,
              title: "Undetectable Auto-Apply",
              description: "Our Camoufox engine mimics human behavior, avoiding CAPTCHAs and bot detectors."
            },
            {
              icon: <MousePointer className="w-5 h-5" />,
              title: "Smart Form Filling",
              description: "Intelligently handles even the most complex and custom application forms."
            },
            {
              icon: <Clock className="w-5 h-5" />,
              title: "Works Everywhere",
              description: "Seamlessly applies on Workday, Greenhouse, Lever, and more."
            }
          ]}
          visualContent={
            <div
              className="rounded-xl p-6 shadow-sm space-y-3 border"
              style={{ backgroundColor: '#ffffff', borderColor: 'rgba(28, 63, 64, 0.08)' }}
            >
              {/* Application forms animation */}
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="rounded-lg p-4 border"
                  style={{
                    backgroundColor: '#f5f7f7',
                    borderColor: 'rgba(28, 63, 64, 0.08)'
                  }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="h-2 rounded" style={{ backgroundColor: '#e5e9e9', width: '35%' }} />
                    <div
                      className="w-4 h-4 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: '#3eaca7' }}
                    >
                      <CheckCircle className="w-2.5 h-2.5" style={{ color: '#ffffff' }} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="h-1.5 rounded" style={{ backgroundColor: '#e5e9e9', width: '85%' }} />
                    <div className="h-1.5 rounded" style={{ backgroundColor: '#e5e9e9', width: '70%' }} />
                  </div>
                </div>
              ))}

              <div
                className="text-center py-2.5 rounded-lg text-[0.8125rem]"
                style={{
                  backgroundColor: '#3eaca7',
                  color: '#ffffff'
                }}
              >
                3 Applications Submitted
              </div>
            </div>
          }
          reverse
        />
      </div>

      {/* AI Career Coach Section */}
      <CareerCoachSection />

      {/* CTA Section */}
      <SignedOut>
        <SignUpButton mode="modal">
          <div>
            <CTASection
              onGetStarted={() => trackCTAClick('cta_section', 'Get Started Now')}
            />
          </div>
        </SignUpButton>
      </SignedOut>
      <SignedIn>
        <CTASection
          onGetStarted={() => {
            trackCTAClick('cta_section', 'Get Started Now');
            navigate('/happy');
          }}
        />
      </SignedIn>

      {/* Footer */}
      <footer className="px-6 py-10" style={{ backgroundColor: '#ffffff', borderTop: '1px solid rgba(28, 63, 64, 0.08)' }}>
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <img src={logoImg} alt="HappyResume Logo" className="h-7 w-auto" />
              </div>
              <p style={{ color: '#5a6564', fontSize: '0.8125rem', lineHeight: 1.6 }}>
                The smarter way to get hired with AI.
              </p>
            </div>

            <div>
              <h4 className="mb-3 text-[0.875rem]" style={{ color: '#0c1310', fontWeight: 500 }}>Product</h4>
              <ul className="space-y-2">
                <li>
                  <button
                    onClick={() => navigate('/features')}
                    className="hover:opacity-70 transition-opacity text-left"
                    style={{ color: '#5a6564', fontSize: '0.8125rem' }}
                  >
                    Features
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => navigate('/pricing')}
                    className="hover:opacity-70 transition-opacity text-left"
                    style={{ color: '#5a6564', fontSize: '0.8125rem' }}
                  >
                    Pricing
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => navigate('/extension')}
                    className="hover:opacity-70 transition-opacity text-left"
                    style={{ color: '#5a6564', fontSize: '0.8125rem' }}
                  >
                    Chrome Extension
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="mb-3 text-[0.875rem]" style={{ color: '#0c1310', fontWeight: 500 }}>Support</h4>
              <ul className="space-y-2">
                <li>
                  <button
                    onClick={() => navigate('/support')}
                    className="hover:opacity-70 transition-opacity text-left"
                    style={{ color: '#5a6564', fontSize: '0.8125rem' }}
                  >
                    Help Center
                  </button>
                </li>
                <li>
                  <a href="mailto:support@happyresumes.com" className="hover:opacity-70 transition-opacity" style={{ color: '#5a6564', fontSize: '0.8125rem' }}>
                    Contact Us
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="mb-3 text-[0.875rem]" style={{ color: '#0c1310', fontWeight: 500 }}>Legal</h4>
              <ul className="space-y-2">
                <li>
                  <button
                    onClick={() => navigate('/privacy')}
                    className="hover:opacity-70 transition-opacity text-left"
                    style={{ color: '#5a6564', fontSize: '0.8125rem' }}
                  >
                    Privacy Policy
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => navigate('/terms')}
                    className="hover:opacity-70 transition-opacity text-left"
                    style={{ color: '#5a6564', fontSize: '0.8125rem' }}
                  >
                    Terms of Service
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-6" style={{ borderTop: '1px solid rgba(28, 63, 64, 0.08)' }}>
            <p className="text-center" style={{ color: '#5a6564', fontSize: '0.8125rem' }}>
              2025 HappyResume. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
