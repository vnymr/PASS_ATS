import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton, useAuth } from '@clerk/clerk-react';
import { motion } from 'framer-motion';
import {
  Menu, X, CheckCircle, Zap, FileText, Target, Clock,
  Sparkles, ArrowRight, Star, Users, Download, Shield
} from 'lucide-react';
import { trackCTAClick } from '../utils/analytics';

export default function Landing() {
  const navigate = useNavigate();
  const { isSignedIn } = useAuth();
  const [resumeCount, setResumeCount] = useState<number | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Redirect signed-in users to generate page
  useEffect(() => {
    if (isSignedIn) {
      navigate('/generate');
    }
  }, [isSignedIn, navigate]);

  // Fetch resume count for social proof
  useEffect(() => {
    async function fetchResumeCount() {
      try {
        const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:8080').trim();
        const response = await fetch(`${apiUrl}/api/stats/resumes`);
        const data = await response.json();
        setResumeCount(data.totalResumes);
      } catch (error) {
        console.error('Failed to fetch resume count');
      }
    }
    fetchResumeCount();
  }, []);

  const handleGetStarted = () => {
    trackCTAClick('hero', 'Get Started Free');
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-xl tracking-tight">
                Happy<span className="text-teal-600">Resumes</span>
              </span>
            </Link>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-8">
              <Link to="/features" className="text-gray-600 hover:text-gray-900 text-sm font-medium">
                Features
              </Link>
              <Link to="/extension" className="text-gray-600 hover:text-gray-900 text-sm font-medium">
                Extension
              </Link>
              <Link to="/pricing" className="text-gray-600 hover:text-gray-900 text-sm font-medium">
                Pricing
              </Link>
            </div>

            {/* Auth Buttons */}
            <div className="flex items-center gap-3">
              <SignedOut>
                <SignInButton mode="modal">
                  <button className="hidden sm:block text-gray-600 hover:text-gray-900 text-sm font-medium">
                    Sign In
                  </button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button
                    onClick={handleGetStarted}
                    className="bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors"
                  >
                    Get Started Free
                  </button>
                </SignUpButton>
              </SignedOut>
              <SignedIn>
                <button
                  onClick={() => navigate('/generate')}
                  className="bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors"
                >
                  Dashboard
                </button>
                <UserButton afterSignOutUrl="/" />
              </SignedIn>

              {/* Mobile Menu Button */}
              <button
                className="md:hidden p-2"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white">
            <div className="px-4 py-4 space-y-3">
              <Link to="/features" className="block py-2 text-gray-600">Features</Link>
              <Link to="/extension" className="block py-2 text-gray-600">Extension</Link>
              <Link to="/pricing" className="block py-2 text-gray-600">Pricing</Link>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="pt-16 pb-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-teal-50 text-teal-700 rounded-full text-sm font-medium mb-6">
              <Zap className="w-4 h-4" />
              AI-Powered Resume Generator
            </div>

            {/* Main Headline - SEO Optimized */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
              Create ATS-Optimized Resumes{' '}
              <span className="text-teal-600">in Seconds</span>
            </h1>

            {/* Subheadline */}
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto leading-relaxed">
              Paste any job description and get a perfectly tailored resume that passes
              Applicant Tracking Systems. Powered by AI, built for results.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <SignedOut>
                <SignUpButton mode="modal">
                  <button
                    onClick={handleGetStarted}
                    className="inline-flex items-center justify-center gap-2 bg-teal-600 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:bg-teal-700 transition-colors shadow-lg shadow-teal-600/20"
                  >
                    Create Your Resume Free
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </SignUpButton>
              </SignedOut>
              <SignedIn>
                <button
                  onClick={() => navigate('/generate')}
                  className="inline-flex items-center justify-center gap-2 bg-teal-600 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:bg-teal-700 transition-colors shadow-lg shadow-teal-600/20"
                >
                  Go to Generator
                  <ArrowRight className="w-5 h-5" />
                </button>
              </SignedIn>
              <Link
                to="/extension"
                className="inline-flex items-center justify-center gap-2 bg-gray-100 text-gray-700 px-8 py-4 rounded-xl text-lg font-medium hover:bg-gray-200 transition-colors"
              >
                <Download className="w-5 h-5" />
                Get Extension
              </Link>
            </div>

            {/* Social Proof */}
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500">
              {resumeCount && resumeCount > 0 && (
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-teal-600" />
                  <span><strong className="text-gray-900">{resumeCount.toLocaleString()}+</strong> resumes created</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                {[1,2,3,4,5].map(i => <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />)}
                <span className="ml-1">4.9/5 rating</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-teal-600" />
                <span>100% Free to start</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 sm:px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Generate Tailored Resumes in 3 Steps
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              No more generic resumes. Create perfectly matched applications in minutes.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '1',
                icon: FileText,
                title: 'Paste Job Description',
                description: 'Copy any job posting from LinkedIn, Indeed, or company websites and paste it into our generator.'
              },
              {
                step: '2',
                icon: Sparkles,
                title: 'AI Tailors Your Resume',
                description: 'Our AI analyzes the job requirements and optimizes your resume with relevant keywords and skills.'
              },
              {
                step: '3',
                icon: Download,
                title: 'Download & Apply',
                description: 'Get your ATS-optimized PDF resume instantly. Ready to submit and land interviews.'
              }
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center"
              >
                <div className="w-14 h-14 rounded-xl bg-teal-100 flex items-center justify-center mx-auto mb-6">
                  <item.icon className="w-7 h-7 text-teal-600" />
                </div>
                <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-teal-600 text-white text-sm font-bold mb-4">
                  {item.step}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">{item.title}</h3>
                <p className="text-gray-600 leading-relaxed">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Why Job Seekers Choose HappyResumes
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Built specifically to help you pass ATS screening and land more interviews.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Target,
                title: 'ATS-Optimized Format',
                description: 'Clean, parseable formatting that works with all major Applicant Tracking Systems.'
              },
              {
                icon: Zap,
                title: 'Instant Generation',
                description: 'Get your tailored resume in under 30 seconds. No waiting, no manual editing.'
              },
              {
                icon: CheckCircle,
                title: 'Keyword Matching',
                description: 'AI extracts and incorporates relevant keywords from every job description.'
              },
              {
                icon: FileText,
                title: 'Professional Templates',
                description: 'Choose from multiple ATS-friendly templates designed by career experts.'
              },
              {
                icon: Clock,
                title: 'Resume History',
                description: 'Access all your generated resumes anytime. Track what you sent where.'
              },
              {
                icon: Shield,
                title: 'Privacy First',
                description: 'Your data is encrypted and never shared. Delete anytime.'
              }
            ].map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
                className="p-6 rounded-xl border border-gray-100 hover:border-teal-200 hover:shadow-md transition-all"
              >
                <div className="w-12 h-12 rounded-lg bg-teal-50 flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-teal-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 bg-gradient-to-br from-teal-600 to-teal-700">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Ready to Land More Interviews?
          </h2>
          <p className="text-teal-100 text-lg mb-8">
            Join thousands of job seekers who've improved their application success rate with HappyResumes.
          </p>
          <SignedOut>
            <SignUpButton mode="modal">
              <button
                onClick={() => trackCTAClick('bottom_cta', 'Create Free Resume')}
                className="inline-flex items-center gap-2 bg-white text-teal-700 px-8 py-4 rounded-xl text-lg font-semibold hover:bg-gray-50 transition-colors"
              >
                Create Your Free Resume
                <ArrowRight className="w-5 h-5" />
              </button>
            </SignUpButton>
          </SignedOut>
          <SignedIn>
            <button
              onClick={() => navigate('/generate')}
              className="inline-flex items-center gap-2 bg-white text-teal-700 px-8 py-4 rounded-xl text-lg font-semibold hover:bg-gray-50 transition-colors"
            >
              Go to Resume Generator
              <ArrowRight className="w-5 h-5" />
            </button>
          </SignedIn>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 bg-gray-50 border-t border-gray-100">
        <div className="max-w-6xl mx-auto">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold text-lg">Happy<span className="text-teal-600">Resumes</span></span>
              </div>
              <p className="text-gray-600 text-sm">
                AI-powered resume generator that helps you beat ATS screening and land more interviews.
              </p>
            </div>

            {/* Product */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-4">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/features" className="text-gray-600 hover:text-teal-600">Features</Link></li>
                <li><Link to="/pricing" className="text-gray-600 hover:text-teal-600">Pricing</Link></li>
                <li><Link to="/extension" className="text-gray-600 hover:text-teal-600">Chrome Extension</Link></li>
                <li><Link to="/templates" className="text-gray-600 hover:text-teal-600">Templates</Link></li>
              </ul>
            </div>

            {/* Support */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-4">Support</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/support" className="text-gray-600 hover:text-teal-600">Help Center</Link></li>
                <li><a href="mailto:support@happyresumes.com" className="text-gray-600 hover:text-teal-600">Contact Us</a></li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/privacy" className="text-gray-600 hover:text-teal-600">Privacy Policy</Link></li>
                <li><Link to="/terms" className="text-gray-600 hover:text-teal-600">Terms of Service</Link></li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-gray-200">
            <p className="text-center text-gray-500 text-sm">
              &copy; {new Date().getFullYear()} HappyResumes. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
