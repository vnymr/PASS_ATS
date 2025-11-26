import { useNavigate } from 'react-router-dom';
import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from '@clerk/clerk-react';
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Chrome,
  Command,
  Zap,
  Download,
  Bell,
  Globe,
  Shield,
  CheckCircle,
  ArrowRight,
  Sparkles,
  Users,
  Menu
} from "lucide-react";
import logoImg from '../logo.svg';
import { useState } from 'react';

const CHROME_EXTENSION_URL = 'https://chromewebstore.google.com/detail/happyresumes-ai-resume-bu/enddmomfdfphcppmhbpbnpmkfjekiled';

export default function Extension() {
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f5f7f7' }}>
      {/* Navigation */}
      <nav
        className="sticky top-0 z-50 px-6 py-3.5 backdrop-blur-md border-b"
        style={{ backgroundColor: 'rgba(245, 247, 247, 0.8)', borderColor: 'rgba(28, 63, 64, 0.06)' }}
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-10">
            <button onClick={() => navigate('/')} className="flex items-center gap-2">
              <img src={logoImg} alt="HappyResume Logo" className="h-8 w-auto" />
            </button>
            <div className="hidden md:flex items-center gap-7">
              <button onClick={() => navigate('/features')} className="hover:opacity-70 transition-opacity text-[0.875rem]" style={{ color: '#0c1310' }}>
                Features
              </button>
              <button onClick={() => navigate('/extension')} className="text-[0.875rem]" style={{ color: '#3eaca7', fontWeight: 500 }}>
                Chrome Extension
              </button>
              <a href="#pricing" className="hover:opacity-70 transition-opacity text-[0.875rem]" style={{ color: '#0c1310' }}>
                Pricing
              </a>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <SignedOut>
              <SignInButton mode="modal">
                <Button variant="ghost" className="hidden md:inline-flex h-9 px-4 text-[0.875rem]" style={{ color: '#0c1310' }}>
                  Sign In
                </Button>
              </SignInButton>
              <SignUpButton mode="modal">
                <Button className="h-9 px-4 text-[0.875rem]" style={{ backgroundColor: '#3eaca7', color: '#ffffff' }}>
                  Get Started
                </Button>
              </SignUpButton>
            </SignedOut>
            <SignedIn>
              <Button className="h-9 px-4 text-[0.875rem]" style={{ backgroundColor: '#3eaca7', color: '#ffffff' }} onClick={() => navigate('/happy')}>
                Go to Dashboard
              </Button>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
            <Button variant="ghost" size="icon" className="md:hidden h-9 w-9" style={{ color: '#0c1310' }} onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
              <Menu className="w-4 h-4" />
            </Button>
          </div>
        </div>
        {isMobileMenuOpen && (
          <div className="md:hidden mt-4 pb-4 border-t" style={{ borderColor: 'rgba(28, 63, 64, 0.08)' }}>
            <div className="flex flex-col gap-3 pt-4">
              <button onClick={() => { navigate('/features'); setIsMobileMenuOpen(false); }} className="px-4 py-2 text-[0.875rem] hover:bg-gray-100 rounded-lg text-left" style={{ color: '#0c1310' }}>Features</button>
              <button onClick={() => { navigate('/extension'); setIsMobileMenuOpen(false); }} className="px-4 py-2 text-[0.875rem] hover:bg-gray-100 rounded-lg text-left" style={{ color: '#3eaca7' }}>Chrome Extension</button>
              <a href="#pricing" className="px-4 py-2 text-[0.875rem] hover:bg-gray-100 rounded-lg" style={{ color: '#0c1310' }} onClick={() => setIsMobileMenuOpen(false)}>Pricing</a>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="px-6 pt-20 pb-16 md:pt-28 md:pb-24 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-[#3eaca7] opacity-[0.03] rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-[#409677] opacity-[0.02] rounded-full blur-3xl" />

        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5 text-[0.8125rem]" style={{ backgroundColor: '#3eaca7', color: '#ffffff' }}>
                <Chrome className="w-3.5 h-3.5" />
                <span>Chrome Extension</span>
              </div>

              <h1 className="text-[2.5rem] md:text-[3.5rem] mb-5 leading-[1.1]" style={{ fontWeight: 600, color: '#0c1310' }}>
                Your AI Co-pilot for the Job Hunt
              </h1>

              <p className="text-[1rem] md:text-[1.125rem] mb-8 leading-[1.65] max-w-xl" style={{ color: '#5a6564' }}>
                Bring the power of HappyResume to every job board. Our browser extension lets you generate a tailored, ATS-optimized resume for any job posting with a single click.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 mb-10">
                <Button
                  size="lg"
                  className="group px-7 h-12 text-[0.9375rem] shadow-sm"
                  style={{ backgroundColor: '#3eaca7', color: '#ffffff' }}
                  onClick={() => window.open(CHROME_EXTENSION_URL, '_blank')}
                >
                  <Chrome className="mr-2 w-5 h-5" />
                  Add to Chrome - It's Free
                  <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>

              <div className="flex items-center gap-6 flex-wrap">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" style={{ color: '#3eaca7' }} />
                  <span style={{ fontSize: '0.875rem', color: '#5a6564' }}>Free to use</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" style={{ color: '#3eaca7' }} />
                  <span style={{ fontSize: '0.875rem', color: '#5a6564' }}>Works everywhere</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" style={{ color: '#3eaca7' }} />
                  <span style={{ fontSize: '0.875rem', color: '#5a6564' }}>Secure & private</span>
                </div>
              </div>
            </motion.div>

            {/* Extension demo visual */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
            >
              {/* Browser window mockup */}
              <div className="rounded-xl overflow-hidden shadow-lg border" style={{ backgroundColor: '#ffffff', borderColor: 'rgba(28, 63, 64, 0.08)' }}>
                <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ backgroundColor: '#f5f7f7', borderColor: 'rgba(28, 63, 64, 0.08)' }}>
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#ff5f57' }} />
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#ffbd2e' }} />
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#28ca42' }} />
                  </div>
                  <div className="flex-1 ml-3 px-3 py-1 rounded text-[0.6875rem]" style={{ backgroundColor: '#ffffff', color: '#5a6564' }}>
                    careers.company.com/jobs/senior-developer
                  </div>
                  <div className="w-6 h-6 rounded flex items-center justify-center" style={{ backgroundColor: '#3eaca7' }}>
                    <Sparkles className="w-3.5 h-3.5" style={{ color: '#ffffff' }} />
                  </div>
                </div>

                <div className="p-5 space-y-3">
                  <div className="h-4 rounded" style={{ backgroundColor: '#e5e9e9', width: '70%' }} />
                  <div className="h-3 rounded" style={{ backgroundColor: '#e5e9e9', width: '40%' }} />
                  <div className="h-px my-3" style={{ backgroundColor: 'rgba(28, 63, 64, 0.08)' }} />
                  <div className="space-y-2">
                    <div className="h-2 rounded" style={{ backgroundColor: '#e5e9e9' }} />
                    <div className="h-2 rounded" style={{ backgroundColor: '#e5e9e9', width: '95%' }} />
                    <div className="h-2 rounded" style={{ backgroundColor: '#e5e9e9', width: '90%' }} />
                  </div>
                </div>
              </div>

              {/* Keyboard shortcut overlay */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.8 }}
                className="absolute -bottom-6 -left-6 rounded-xl p-4 shadow-lg border"
                style={{ backgroundColor: '#ffffff', borderColor: 'rgba(28, 63, 64, 0.08)' }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Command className="w-4 h-4" style={{ color: '#3eaca7' }} />
                  <span style={{ fontSize: '0.75rem', color: '#5a6564' }}>Press shortcut</span>
                </div>
                <div className="flex items-center gap-2">
                  {['⌘', 'Shift', 'Y'].map((key, i) => (
                    <div
                      key={i}
                      className="px-2.5 py-1.5 rounded text-[0.75rem] min-w-[2rem] text-center"
                      style={{ backgroundColor: '#f5f7f7', color: '#0c1310', fontWeight: 500, border: '1px solid rgba(28, 63, 64, 0.1)' }}
                    >
                      {key}
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Download notification */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 1.2 }}
                className="absolute -top-6 -right-6 rounded-xl p-4 shadow-lg border"
                style={{ backgroundColor: '#ffffff', borderColor: 'rgba(28, 63, 64, 0.08)' }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: '#3eaca7' }}>
                    <CheckCircle className="w-4 h-4" style={{ color: '#ffffff' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8125rem', color: '#0c1310', fontWeight: 500 }}>Resume Ready!</div>
                    <div style={{ fontSize: '0.6875rem', color: '#5a6564' }}>resume.pdf downloaded</div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="px-6 py-16 md:py-20" style={{ backgroundColor: '#ffffff' }}>
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-[2rem] md:text-[2.5rem] mb-4 leading-[1.15]" style={{ fontWeight: 600, color: '#0c1310' }}>
              Three Steps to Your Perfect Resume
            </h2>
            <p style={{ color: '#5a6564', fontSize: '1rem' }}>
              It's incredibly simple. No copying, no pasting, no hassle.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '01', icon: <Globe className="w-6 h-6" />, title: 'Find a Job You Love', description: 'Browse any job site, from LinkedIn to a company\'s career page. Our extension works everywhere.', color: '#3eaca7' },
              { step: '02', icon: <Command className="w-6 h-6" />, title: 'Press a Shortcut', description: 'Use a simple keyboard command (⌘+Shift+Y) to activate the AI. No clicking, no copying, no pasting.', color: '#409677' },
              { step: '03', icon: <Download className="w-6 h-6" />, title: 'Get Your Resume', description: 'Our AI reads the job description and generates a perfectly tailored resume, automatically downloaded for you.', color: '#1c3f40' }
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
                viewport={{ once: true }}
                className="relative"
              >
                <div className="rounded-xl p-6 border h-full" style={{ backgroundColor: '#f5f7f7', borderColor: 'rgba(28, 63, 64, 0.08)' }}>
                  <div className="inline-block px-2.5 py-1 rounded-full text-[0.75rem] mb-4" style={{ backgroundColor: item.color, color: '#ffffff', fontWeight: 500 }}>
                    {item.step}
                  </div>

                  <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: '#ffffff', color: item.color }}>
                    {item.icon}
                  </div>

                  <h3 className="text-[1.125rem] mb-2" style={{ color: '#0c1310', fontWeight: 600 }}>{item.title}</h3>
                  <p style={{ color: '#5a6564', fontSize: '0.875rem', lineHeight: 1.6 }}>{item.description}</p>
                </div>

                {i < 2 && (
                  <div className="hidden md:block absolute top-1/2 -right-4 transform -translate-y-1/2 z-10">
                    <ArrowRight className="w-5 h-5" style={{ color: '#3eaca7', opacity: 0.3 }} />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Breakdown */}
      <section className="px-6 py-16 md:py-20">
        <div className="max-w-6xl mx-auto space-y-16">
          {/* Feature 1 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="grid lg:grid-cols-2 gap-12 items-center"
          >
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4 text-[0.8125rem]" style={{ backgroundColor: '#3eaca7', color: '#ffffff' }}>
                <Zap className="w-3.5 h-3.5" />
                <span>The Ultimate Shortcut</span>
              </div>

              <h3 className="text-[1.75rem] md:text-[2rem] mb-4 leading-[1.2]" style={{ fontWeight: 600, color: '#0c1310' }}>
                Apply Faster Than Ever
              </h3>

              <p className="text-[0.9375rem] leading-[1.65]" style={{ color: '#5a6564' }}>
                Stop wasting time copying job descriptions and switching between tabs. Our extension lives in your browser and is always ready. Activate it with a keyboard shortcut, and let the AI do all the heavy lifting.
              </p>
            </div>

            <div className="rounded-xl p-6 border" style={{ backgroundColor: '#ffffff', borderColor: 'rgba(28, 63, 64, 0.08)' }}>
              <div className="space-y-4">
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#5a6564', marginBottom: '8px' }}>Keyboard Shortcuts</div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: '#f5f7f7' }}>
                      <span style={{ fontSize: '0.8125rem', color: '#0c1310' }}>Mac</span>
                      <div className="flex items-center gap-1.5">
                        {['⌘', 'Shift', 'Y'].map((key, i) => (
                          <div key={i} className="px-2 py-1 rounded text-[0.75rem]" style={{ backgroundColor: '#ffffff', color: '#0c1310', fontWeight: 500 }}>{key}</div>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: '#f5f7f7' }}>
                      <span style={{ fontSize: '0.8125rem', color: '#0c1310' }}>Windows</span>
                      <div className="flex items-center gap-1.5">
                        {['Alt', 'Shift', 'R'].map((key, i) => (
                          <div key={i} className="px-2 py-1 rounded text-[0.75rem]" style={{ backgroundColor: '#ffffff', color: '#0c1310', fontWeight: 500 }}>{key}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-lg flex items-center gap-3" style={{ backgroundColor: 'rgba(62, 172, 167, 0.1)' }}>
                  <Zap className="w-5 h-5" style={{ color: '#3eaca7' }} />
                  <span style={{ fontSize: '0.8125rem', color: '#0c1310', fontWeight: 500 }}>Instant activation from any job page</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Feature 2 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="grid lg:grid-cols-2 gap-12 items-center"
          >
            <div className="rounded-xl p-6 border lg:order-1" style={{ backgroundColor: '#ffffff', borderColor: 'rgba(28, 63, 64, 0.08)' }}>
              <div className="space-y-3">
                {[
                  { name: 'LinkedIn', icon: '💼', supported: true },
                  { name: 'Indeed', icon: '🔍', supported: true },
                  { name: 'Company Sites', icon: '🏢', supported: true },
                  { name: 'Startup Boards', icon: '🚀', supported: true },
                  { name: 'Any Job Page', icon: '🌐', supported: true }
                ].map((site, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: '#f5f7f7' }}>
                    <div className="flex items-center gap-3">
                      <span style={{ fontSize: '1.25rem' }}>{site.icon}</span>
                      <span style={{ fontSize: '0.875rem', color: '#0c1310', fontWeight: 500 }}>{site.name}</span>
                    </div>
                    <CheckCircle className="w-4 h-4" style={{ color: '#3eaca7' }} />
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:order-2">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4 text-[0.8125rem]" style={{ backgroundColor: '#409677', color: '#ffffff' }}>
                <Globe className="w-3.5 h-3.5" />
                <span>Universal Compatibility</span>
              </div>

              <h3 className="text-[1.75rem] md:text-[2rem] mb-4 leading-[1.2]" style={{ fontWeight: 600, color: '#0c1310' }}>
                Your Key to the Entire Web
              </h3>

              <p className="text-[0.9375rem] leading-[1.65]" style={{ color: '#5a6564' }}>
                Don't be limited by platforms that only work on major job boards. Our intelligent scraping technology is designed to understand the structure of any webpage, allowing you to generate a resume from a posting on a niche industry site, a startup's career page, or a global enterprise portal.
              </p>
            </div>
          </motion.div>

          {/* Feature 3 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="grid lg:grid-cols-2 gap-12 items-center"
          >
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4 text-[0.8125rem]" style={{ backgroundColor: '#1c3f40', color: '#ffffff' }}>
                <Bell className="w-3.5 h-3.5" />
                <span>Real-Time Updates</span>
              </div>

              <h3 className="text-[1.75rem] md:text-[2rem] mb-4 leading-[1.2]" style={{ fontWeight: 600, color: '#0c1310' }}>
                Stay in the Loop, Automatically
              </h3>

              <p className="text-[0.9375rem] leading-[1.65]" style={{ color: '#5a6564' }}>
                Wondering what's happening? Just glance at the extension icon. We'll show you the live progress of your resume generation. When it's ready, you'll get a system notification and the file will automatically download.
              </p>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl p-5 border" style={{ backgroundColor: '#ffffff', borderColor: 'rgba(28, 63, 64, 0.08)' }}>
                <div style={{ fontSize: '0.75rem', color: '#5a6564', marginBottom: '12px' }}>Progress Indicator</div>
                <div className="flex items-center gap-4">
                  {[
                    { badge: '...', label: 'Processing', color: '#3eaca7' },
                    { badge: '50%', label: 'Generating', color: '#409677' },
                    { badge: '✓', label: 'Complete', color: '#3eaca7' }
                  ].map((state, i) => (
                    <div key={i} className="flex-1">
                      <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-2 mx-auto relative" style={{ backgroundColor: '#f5f7f7' }}>
                        <Sparkles className="w-6 h-6" style={{ color: state.color, opacity: 0.3 }} />
                        <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[0.625rem]" style={{ backgroundColor: state.color, color: '#ffffff', fontWeight: 600 }}>
                          {state.badge}
                        </div>
                      </div>
                      <div className="text-center" style={{ fontSize: '0.6875rem', color: '#5a6564' }}>{state.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl p-4 border shadow-md" style={{ backgroundColor: '#ffffff', borderColor: 'rgba(28, 63, 64, 0.08)' }}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#3eaca7' }}>
                    <CheckCircle className="w-5 h-5" style={{ color: '#ffffff' }} />
                  </div>
                  <div className="flex-1">
                    <div style={{ fontSize: '0.875rem', color: '#0c1310', fontWeight: 500, marginBottom: '2px' }}>Resume Generated Successfully</div>
                    <div style={{ fontSize: '0.75rem', color: '#5a6564', lineHeight: 1.4 }}>Your tailored resume for "Senior Developer" has been downloaded.</div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="px-6 py-16 md:py-20" style={{ backgroundColor: '#ffffff' }}>
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-[2rem] md:text-[2.5rem] mb-4 leading-[1.15]" style={{ fontWeight: 600, color: '#0c1310' }}>
              Frequently Asked Questions
            </h2>
          </motion.div>

          <div className="space-y-4">
            {[
              { icon: <Shield className="w-5 h-5" />, question: 'Is it safe to use?', answer: 'Yes. The extension only activates when you tell it to and only reads the content of your active tab to analyze the job description. It runs in a secure, isolated environment.' },
              { icon: <Users className="w-5 h-5" />, question: 'Do I need a HappyResume account?', answer: 'Yes, the extension connects securely to your HappyResume account to access your profile information and power the AI generation.' },
              { icon: <Chrome className="w-5 h-5" />, question: 'Which browsers are supported?', answer: 'Currently, our extension is available for Google Chrome. Support for other browsers is coming soon!' }
            ].map((faq, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
                viewport={{ once: true }}
                className="rounded-xl p-5 border"
                style={{ backgroundColor: '#f5f7f7', borderColor: 'rgba(28, 63, 64, 0.08)' }}
              >
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#3eaca7', color: '#ffffff' }}>
                    {faq.icon}
                  </div>
                  <div>
                    <h4 className="mb-2 text-[0.9375rem]" style={{ color: '#0c1310', fontWeight: 600 }}>{faq.question}</h4>
                    <p style={{ color: '#5a6564', fontSize: '0.875rem', lineHeight: 1.6 }}>{faq.answer}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 py-16 md:py-20">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="rounded-2xl p-10 md:p-14 text-center relative overflow-hidden"
            style={{ backgroundColor: '#3eaca7' }}
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white opacity-5 rounded-full blur-3xl" />

            <div className="relative">
              <h2 className="text-[2rem] md:text-[2.5rem] mb-4 leading-[1.15]" style={{ fontWeight: 600, color: '#ffffff' }}>
                Stop Applying. Start Winning.
              </h2>

              <p className="text-[1rem] mb-8 max-w-2xl mx-auto leading-[1.65]" style={{ color: 'rgba(255, 255, 255, 0.9)' }}>
                Install the free Chrome extension today and revolutionize your job search.
              </p>

              <Button
                size="lg"
                className="px-8 h-12 text-[0.9375rem]"
                style={{ backgroundColor: '#ffffff', color: '#3eaca7' }}
                onClick={() => window.open(CHROME_EXTENSION_URL, '_blank')}
              >
                <Chrome className="mr-2 w-5 h-5" />
                Add to Chrome Now
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

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
                <li><button onClick={() => navigate('/features')} className="hover:opacity-70 transition-opacity text-left" style={{ color: '#5a6564', fontSize: '0.8125rem' }}>Features</button></li>
                <li><button onClick={() => navigate('/pricing')} className="hover:opacity-70 transition-opacity text-left" style={{ color: '#5a6564', fontSize: '0.8125rem' }}>Pricing</button></li>
                <li><button onClick={() => navigate('/extension')} className="hover:opacity-70 transition-opacity text-left" style={{ color: '#5a6564', fontSize: '0.8125rem' }}>Chrome Extension</button></li>
              </ul>
            </div>
            <div>
              <h4 className="mb-3 text-[0.875rem]" style={{ color: '#0c1310', fontWeight: 500 }}>Support</h4>
              <ul className="space-y-2">
                <li><button onClick={() => navigate('/support')} className="hover:opacity-70 transition-opacity text-left" style={{ color: '#5a6564', fontSize: '0.8125rem' }}>Help Center</button></li>
                <li><a href="mailto:support@happyresumes.com" className="hover:opacity-70 transition-opacity" style={{ color: '#5a6564', fontSize: '0.8125rem' }}>Contact Us</a></li>
              </ul>
            </div>
            <div>
              <h4 className="mb-3 text-[0.875rem]" style={{ color: '#0c1310', fontWeight: 500 }}>Legal</h4>
              <ul className="space-y-2">
                <li><button onClick={() => navigate('/privacy')} className="hover:opacity-70 transition-opacity text-left" style={{ color: '#5a6564', fontSize: '0.8125rem' }}>Privacy Policy</button></li>
                <li><button onClick={() => navigate('/terms')} className="hover:opacity-70 transition-opacity text-left" style={{ color: '#5a6564', fontSize: '0.8125rem' }}>Terms of Service</button></li>
              </ul>
            </div>
          </div>
          <div className="pt-6" style={{ borderTop: '1px solid rgba(28, 63, 64, 0.08)' }}>
            <p className="text-center" style={{ color: '#5a6564', fontSize: '0.8125rem' }}>2025 HappyResume. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
