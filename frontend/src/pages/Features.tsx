import { useNavigate } from 'react-router-dom';
import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from '@clerk/clerk-react';
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  CheckCircle,
  FileText,
  Zap,
  Shield,
  Clock,
  Target,
  TrendingUp,
  Sparkles,
  Brain,
  Layers,
  Globe,
  Settings,
  MessageSquare,
  Calendar,
  BarChart3,
  ArrowRight,
  Search,
  Star,
  Filter,
  Briefcase,
  Menu
} from "lucide-react";
import logoImg from '../logo.svg';
import { useState } from 'react';

export default function Features() {
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
              <button
                onClick={() => navigate('/features')}
                className="text-[0.875rem]"
                style={{ color: '#3eaca7', fontWeight: 500 }}
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
              <button onClick={() => { navigate('/features'); setIsMobileMenuOpen(false); }} className="px-4 py-2 text-[0.875rem] hover:bg-gray-100 rounded-lg text-left" style={{ color: '#3eaca7' }}>Features</button>
              <button onClick={() => { navigate('/extension'); setIsMobileMenuOpen(false); }} className="px-4 py-2 text-[0.875rem] hover:bg-gray-100 rounded-lg text-left" style={{ color: '#0c1310' }}>Chrome Extension</button>
              <a href="#pricing" className="px-4 py-2 text-[0.875rem] hover:bg-gray-100 rounded-lg" style={{ color: '#0c1310' }} onClick={() => setIsMobileMenuOpen(false)}>Pricing</a>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="px-6 pt-20 pb-16 md:pt-28 md:pb-20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#3eaca7] opacity-[0.02] rounded-full blur-3xl" />

        <div className="max-w-4xl mx-auto text-center relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div
              className="inline-block px-3 py-1.5 rounded-full mb-5 text-[0.8125rem]"
              style={{ backgroundColor: '#3eaca7', color: '#ffffff' }}
            >
              Platform Features
            </div>

            <h1
              className="text-[2.5rem] md:text-[3.5rem] mb-5 leading-[1.1]"
              style={{ fontWeight: 600, color: '#0c1310' }}
            >
              A Smarter Way to Build Your Career
            </h1>

            <p
              className="text-[1rem] md:text-[1.125rem] max-w-3xl mx-auto leading-[1.65]"
              style={{ color: '#5a6564' }}
            >
              Go beyond the application. Our platform combines a world-class resume builder, an undetectable auto-apply system, and a personal AI career coach to give you an unmatched advantage in your job search.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Feature 1: AI Resume & Cover Letter Builder */}
      <section className="px-6 py-16 md:py-20">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <div
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5 text-[0.8125rem]"
                style={{ backgroundColor: '#409677', color: '#ffffff' }}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>AI Resume Builder</span>
              </div>

              <h2
                className="text-[2rem] md:text-[2.5rem] mb-5 leading-[1.15]"
                style={{ fontWeight: 600, color: '#0c1310' }}
              >
                Create Resumes That Get Noticed
              </h2>

              <p
                className="text-[0.9375rem] mb-8 leading-[1.65]"
                style={{ color: '#5a6564' }}
              >
                Stop struggling with templates and guessing what recruiters want. Our AI-powered builder crafts perfectly tailored, ATS-optimized resumes and cover letters in seconds.
              </p>

              <div className="space-y-5">
                {[
                  { icon: <CheckCircle className="w-5 h-5" />, title: "Beat the Robots (ATS)", description: "Keywords and formatting designed to sail through any Applicant Tracking System." },
                  { icon: <Layers className="w-5 h-5" />, title: "Professional Designs, Instantly", description: "Powered by LaTeX, our builder creates pixel-perfect, elegant documents." },
                  { icon: <Brain className="w-5 h-5" />, title: "AI-Powered Writing Assistant", description: "Generate compelling profile summaries and persuasive cover letters." },
                  { icon: <Settings className="w-5 h-5" />, title: "Unlimited Customization", description: "Quickly create and manage multiple versions of your resume." }
                ].map((item, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#3eaca7', color: '#ffffff' }}>
                      {item.icon}
                    </div>
                    <div>
                      <h4 className="mb-1 text-[0.9375rem]" style={{ color: '#0c1310', fontWeight: 500 }}>{item.title}</h4>
                      <p style={{ color: '#5a6564', fontSize: '0.875rem', lineHeight: 1.6 }}>{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[0.75rem] mb-2" style={{ color: '#5a6564' }}>Before</div>
                  <div className="rounded-lg p-4 border" style={{ backgroundColor: '#ffffff', borderColor: 'rgba(28, 63, 64, 0.08)' }}>
                    <div className="space-y-2">
                      <div className="h-2 rounded" style={{ backgroundColor: '#e5e9e9', width: '70%' }} />
                      <div className="h-2 rounded" style={{ backgroundColor: '#e5e9e9', width: '50%' }} />
                      <div className="h-px my-2" style={{ backgroundColor: 'rgba(28, 63, 64, 0.08)' }} />
                      <div className="h-2 rounded" style={{ backgroundColor: '#e5e9e9', width: '90%' }} />
                      <div className="h-2 rounded" style={{ backgroundColor: '#e5e9e9', width: '85%' }} />
                    </div>
                  </div>
                </div>
                <div>
                  <div className="text-[0.75rem] mb-2 flex items-center gap-1" style={{ color: '#3eaca7' }}>
                    After <Sparkles className="w-3 h-3" />
                  </div>
                  <div className="rounded-lg p-4 border shadow-md" style={{ backgroundColor: '#ffffff', borderColor: 'rgba(62, 172, 167, 0.2)' }}>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-full" style={{ backgroundColor: '#3eaca7', opacity: 0.2 }} />
                        <div className="flex-1">
                          <div className="h-2 rounded mb-1" style={{ backgroundColor: '#e5e9e9', width: '60%' }} />
                          <div className="h-1.5 rounded" style={{ backgroundColor: '#e5e9e9', width: '40%' }} />
                        </div>
                      </div>
                      <div className="h-px my-2" style={{ backgroundColor: 'rgba(28, 63, 64, 0.08)' }} />
                      <div className="space-y-1.5">
                        {[1, 2, 3].map((_, j) => (
                          <div key={j} className="flex items-start gap-1.5">
                            <div className="w-1 h-1 rounded-full mt-1" style={{ backgroundColor: j % 2 === 0 ? '#3eaca7' : '#409677' }} />
                            <div className="h-1.5 rounded flex-1" style={{ backgroundColor: '#e5e9e9', width: `${90 - j * 5}%` }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                viewport={{ once: true }}
                className="mt-4 rounded-xl p-4 border"
                style={{ backgroundColor: '#ffffff', borderColor: 'rgba(28, 63, 64, 0.08)' }}
              >
                <div className="flex items-center justify-between mb-3">
                  <span style={{ fontSize: '0.8125rem', color: '#0c1310', fontWeight: 500 }}>Keyword Match</span>
                  <span style={{ fontSize: '0.875rem', color: '#3eaca7', fontWeight: 600 }}>95%</span>
                </div>
                <div className="h-2 rounded-full" style={{ backgroundColor: '#e5e9e9' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: '95%' }}
                    transition={{ duration: 1, delay: 0.6 }}
                    viewport={{ once: true }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: '#3eaca7' }}
                  />
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {['React', 'TypeScript', 'Leadership', 'Agile'].map((tag, i) => (
                    <span key={i} className="px-2 py-1 rounded text-[0.6875rem]" style={{ backgroundColor: '#3eaca7', color: '#ffffff', opacity: 0.8 }}>{tag}</span>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Feature 2: Auto-Apply System */}
      <section className="px-6 py-16 md:py-20" style={{ backgroundColor: '#ffffff' }}>
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="lg:order-1"
            >
              <div className="rounded-xl p-6 border" style={{ backgroundColor: '#f5f7f7', borderColor: 'rgba(28, 63, 64, 0.08)' }}>
                <div className="space-y-3">
                  {[
                    { platform: 'Workday', company: 'Tech Corp', status: 'complete', time: '0.8s' },
                    { platform: 'Greenhouse', company: 'StartupXYZ', status: 'complete', time: '1.2s' },
                    { platform: 'Lever', company: 'InnovateCo', status: 'processing', time: '...' },
                  ].map((app, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.4, delay: i * 0.2 }}
                      viewport={{ once: true }}
                      className="rounded-lg p-4 border"
                      style={{ backgroundColor: '#ffffff', borderColor: 'rgba(28, 63, 64, 0.08)' }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded flex items-center justify-center" style={{ backgroundColor: '#e5e9e9' }}>
                            <Globe className="w-3 h-3" style={{ color: '#5a6564' }} />
                          </div>
                          <div>
                            <div style={{ fontSize: '0.8125rem', color: '#0c1310', fontWeight: 500 }}>{app.company}</div>
                            <div style={{ fontSize: '0.6875rem', color: '#5a6564' }}>{app.platform}</div>
                          </div>
                        </div>
                        {app.status === 'complete' ? (
                          <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: '#3eaca7' }}>
                            <CheckCircle className="w-3 h-3" style={{ color: '#ffffff' }} />
                          </div>
                        ) : (
                          <div className="flex gap-1">
                            {[0, 1, 2].map((dot) => (
                              <motion.div
                                key={dot}
                                animate={{ opacity: [0.3, 1, 0.3] }}
                                transition={{ duration: 1, repeat: Infinity, delay: dot * 0.2 }}
                                className="w-1 h-1 rounded-full"
                                style={{ backgroundColor: '#3eaca7' }}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-[0.6875rem]">
                        <span style={{ color: '#5a6564' }}>{app.status === 'complete' ? 'Applied' : 'Processing...'}</span>
                        <span style={{ color: '#3eaca7', fontWeight: 500 }}>{app.time}</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
                <div className="mt-4 rounded-lg p-4 flex items-center justify-between" style={{ backgroundColor: '#3eaca7' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.8)' }}>Time Saved Today</div>
                    <div style={{ fontSize: '1.25rem', color: '#ffffff', fontWeight: 600 }}>4.5 hours</div>
                  </div>
                  <Clock className="w-8 h-8" style={{ color: 'rgba(255, 255, 255, 0.5)' }} />
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              viewport={{ once: true }}
              className="lg:order-2"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5 text-[0.8125rem]" style={{ backgroundColor: '#3eaca7', color: '#ffffff' }}>
                <Zap className="w-3.5 h-3.5" />
                <span>Auto-Apply System</span>
              </div>

              <h2 className="text-[2rem] md:text-[2.5rem] mb-5 leading-[1.15]" style={{ fontWeight: 600, color: '#0c1310' }}>
                Apply to Jobs While You Sleep
              </h2>

              <p className="text-[0.9375rem] mb-8 leading-[1.65]" style={{ color: '#5a6564' }}>
                The most time-consuming part of the job search is the application itself. Our intelligent automation system applies to jobs on your behalf across any platform.
              </p>

              <div className="space-y-5">
                {[
                  { icon: <Shield className="w-5 h-5" />, title: "Stay Undetected", description: "Our proprietary Camoufox browser engine mimics human behavior." },
                  { icon: <Brain className="w-5 h-5" />, title: "Intelligent Form Filling", description: "The AI understands the context of each field." },
                  { icon: <Globe className="w-5 h-5" />, title: "Works Everywhere", description: "Our system can navigate and apply on virtually any career site." },
                  { icon: <Settings className="w-5 h-5" />, title: "You're in Control", description: "Set your preferences, choose the jobs, and monitor progress." }
                ].map((item, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#409677', color: '#ffffff' }}>
                      {item.icon}
                    </div>
                    <div>
                      <h4 className="mb-1 text-[0.9375rem]" style={{ color: '#0c1310', fontWeight: 500 }}>{item.title}</h4>
                      <p style={{ color: '#5a6564', fontSize: '0.875rem', lineHeight: 1.6 }}>{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Feature 3: AI Job Discovery */}
      <section className="px-6 py-16 md:py-20">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5 text-[0.8125rem]" style={{ backgroundColor: '#409677', color: '#ffffff' }}>
                <Search className="w-3.5 h-3.5" />
                <span>AI Job Discovery</span>
              </div>

              <h2 className="text-[2rem] md:text-[2.5rem] mb-5 leading-[1.15]" style={{ fontWeight: 600, color: '#0c1310' }}>
                Find Your Perfect Fit, Faster
              </h2>

              <p className="text-[0.9375rem] mb-8 leading-[1.65]" style={{ color: '#5a6564' }}>
                Stop scrolling through endless, irrelevant job postings. Our AI-powered discovery engine learns your profile and preferences to bring the right opportunities directly to you.
              </p>

              <div className="space-y-5">
                {[
                  { icon: <Sparkles className="w-5 h-5" />, title: "Intelligent Recommendations", description: "Get a curated feed of jobs that truly align with your experience." },
                  { icon: <Star className="w-5 h-5" />, title: "See Your Match Score", description: "Get an instant match score for every job." },
                  { icon: <Briefcase className="w-5 h-5" />, title: "Discover Hidden Gems", description: "We scan everything from major job boards to niche industry sites." },
                  { icon: <Filter className="w-5 h-5" />, title: "Smart Search & Filters", description: "Filter by seniority, remote work policies, company size, and more." }
                ].map((item, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#409677', color: '#ffffff' }}>
                      {item.icon}
                    </div>
                    <div>
                      <h4 className="mb-1 text-[0.9375rem]" style={{ color: '#0c1310', fontWeight: 500 }}>{item.title}</h4>
                      <p style={{ color: '#5a6564', fontSize: '0.875rem', lineHeight: 1.6 }}>{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              viewport={{ once: true }}
              className="space-y-4"
            >
              <div className="rounded-xl p-5 border" style={{ backgroundColor: '#ffffff', borderColor: 'rgba(28, 63, 64, 0.08)' }}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: '#3eaca7', opacity: 0.2 }}>
                    <span style={{ fontSize: '1.125rem' }}>👤</span>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.875rem', color: '#0c1310', fontWeight: 500 }}>Your Profile</div>
                    <div style={{ fontSize: '0.6875rem', color: '#5a6564' }}>Senior Developer • 5 years exp</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {['React', 'TypeScript', 'Node.js', 'AWS', 'Leadership'].map((skill, i) => (
                    <span key={i} className="px-2 py-1 rounded text-[0.6875rem]" style={{ backgroundColor: '#f5f7f7', color: '#0c1310' }}>{skill}</span>
                  ))}
                </div>
              </div>

              <div className="space-y-2.5">
                {[
                  { title: 'Senior Frontend Engineer', company: 'TechCorp', match: 95, skills: ['React', 'TypeScript', 'AWS'], salary: '$140k-$180k', remote: 'Remote' },
                  { title: 'Full Stack Developer', company: 'StartupXYZ', match: 88, skills: ['React', 'Node.js', 'Leadership'], salary: '$120k-$160k', remote: 'Hybrid' },
                  { title: 'Tech Lead', company: 'InnovateCo', match: 82, skills: ['TypeScript', 'Leadership'], salary: '$150k-$200k', remote: 'Remote' }
                ].map((job, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.3 + (i * 0.1) }}
                    viewport={{ once: true }}
                    className="rounded-xl p-4 border hover:shadow-sm transition-shadow cursor-pointer"
                    style={{ backgroundColor: '#ffffff', borderColor: 'rgba(28, 63, 64, 0.08)' }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div style={{ fontSize: '0.875rem', color: '#0c1310', fontWeight: 500, marginBottom: '2px' }}>{job.title}</div>
                        <div style={{ fontSize: '0.75rem', color: '#5a6564' }}>{job.company} • {job.salary} • {job.remote}</div>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <div className="relative w-12 h-12 rounded-full flex items-center justify-center" style={{ background: `conic-gradient(#3eaca7 ${job.match * 3.6}deg, #e5e9e9 ${job.match * 3.6}deg)` }}>
                          <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: '#ffffff' }}>
                            <span style={{ fontSize: '0.6875rem', color: '#3eaca7', fontWeight: 600 }}>{job.match}%</span>
                          </div>
                        </div>
                        <span style={{ fontSize: '0.625rem', color: '#5a6564' }}>Match</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {job.skills.map((skill, j) => (
                        <span key={j} className="px-2 py-0.5 rounded text-[0.6875rem]" style={{ backgroundColor: '#3eaca7', color: '#ffffff', opacity: 0.9 }}>{skill}</span>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>

              <Button className="w-full h-10 text-[0.8125rem]" style={{ backgroundColor: '#409677', color: '#ffffff' }}>
                <Search className="mr-2 w-4 h-4" />
                View All Matches
              </Button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Feature 4: AI Career Coach */}
      <section className="px-6 py-16 md:py-20" style={{ backgroundColor: '#ffffff' }}>
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5 text-[0.8125rem]" style={{ backgroundColor: '#1c3f40', color: '#ffffff' }}>
                <MessageSquare className="w-3.5 h-3.5" />
                <span>AI Career Coach</span>
              </div>

              <h2 className="text-[2rem] md:text-[2.5rem] mb-5 leading-[1.15]" style={{ fontWeight: 600, color: '#0c1310' }}>
                Get a Strategy, Not Just a Tool
              </h2>

              <p className="text-[0.9375rem] mb-8 leading-[1.65]" style={{ color: '#5a6564' }}>
                A successful job search requires a strategy. Our conversational AI assistant acts as your personal career coach, helping you set goals, stay on track, and make smarter decisions.
              </p>

              <div className="space-y-5">
                {[
                  { icon: <Target className="w-5 h-5" />, title: "Set & Track Career Goals", description: "Tell the AI your ambition and it will help you track progress." },
                  { icon: <TrendingUp className="w-5 h-5" />, title: "Get Proactive Recommendations", description: "The AI analyzes your profile and market trends to suggest relevant jobs." },
                  { icon: <Calendar className="w-5 h-5" />, title: "Automate Your Routines", description: "Set up daily or weekly routines. The AI will keep you organized." },
                  { icon: <BarChart3 className="w-5 h-5" />, title: "All Your Data, In One Place", description: "Your AI has full context of your profile for truly personalized advice." }
                ].map((item, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#1c3f40', color: '#ffffff' }}>
                      {item.icon}
                    </div>
                    <div>
                      <h4 className="mb-1 text-[0.9375rem]" style={{ color: '#0c1310', fontWeight: 500 }}>{item.title}</h4>
                      <p style={{ color: '#5a6564', fontSize: '0.875rem', lineHeight: 1.6 }}>{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              viewport={{ once: true }}
            >
              <div className="rounded-xl p-5 border" style={{ backgroundColor: '#ffffff', borderColor: 'rgba(28, 63, 64, 0.08)' }}>
                <div className="flex items-center gap-3 pb-4 mb-4" style={{ borderBottom: '1px solid rgba(28, 63, 64, 0.08)' }}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: '#3eaca7' }}>
                    <Sparkles className="w-5 h-5" style={{ color: '#ffffff' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.875rem', color: '#0c1310', fontWeight: 500 }}>AI Career Coach</div>
                    <div style={{ fontSize: '0.6875rem', color: '#5a6564' }}>Online • Ready to help</div>
                  </div>
                </div>

                <div className="space-y-3 mb-4">
                  <div className="flex gap-2">
                    <div className="rounded-2xl rounded-bl-sm px-4 py-2.5 max-w-[85%] text-[0.8125rem]" style={{ backgroundColor: '#f5f7f7', color: '#0c1310' }}>
                      My goal is to get an interview this month
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <div className="rounded-2xl rounded-br-sm px-4 py-2.5 max-w-[85%] text-[0.8125rem]" style={{ backgroundColor: '#3eaca7', color: '#ffffff' }}>
                      Perfect! I've set your goal. Based on your profile, here's your action plan:
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <div className="rounded-xl p-4 max-w-[85%] border" style={{ backgroundColor: '#ffffff', borderColor: 'rgba(62, 172, 167, 0.2)' }}>
                      <div style={{ fontSize: '0.75rem', color: '#3eaca7', fontWeight: 500, marginBottom: '8px' }}>Recommended Actions</div>
                      <div className="space-y-2">
                        {['Tailor your resume for 3 new jobs', 'Prepare for your interview', 'Update your LinkedIn profile'].map((action, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: '#3eaca7', opacity: 0.2 }}>
                              <span style={{ fontSize: '0.625rem', color: '#3eaca7', fontWeight: 600 }}>{i + 1}</span>
                            </div>
                            <span style={{ fontSize: '0.8125rem', color: '#0c1310', lineHeight: 1.4 }}>{action}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#f5f7f7' }}>
                  <input type="text" placeholder="Ask your coach anything..." className="flex-1 bg-transparent outline-none text-[0.8125rem]" style={{ color: '#0c1310' }} />
                  <Button size="sm" className="h-7 w-7 p-0" style={{ backgroundColor: '#3eaca7', color: '#ffffff' }}>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-6 py-16 md:py-20">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <h2 className="text-[2rem] md:text-[2.5rem] mb-4 leading-[1.15]" style={{ fontWeight: 600, color: '#0c1310' }}>
              Ready to Transform Your Job Search?
            </h2>

            <p className="text-[0.9375rem] md:text-[1rem] mb-8 leading-[1.65]" style={{ color: '#5a6564' }}>
              Join thousands of professionals who are landing their dream jobs faster with AI.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <SignedOut>
                <SignUpButton mode="modal">
                  <Button size="lg" className="group px-7 h-12 text-[0.9375rem]" style={{ backgroundColor: '#3eaca7', color: '#ffffff' }}>
                    Start Your Free Trial
                    <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </SignUpButton>
              </SignedOut>
              <SignedIn>
                <Button size="lg" className="group px-7 h-12 text-[0.9375rem]" style={{ backgroundColor: '#3eaca7', color: '#ffffff' }} onClick={() => navigate('/happy')}>
                  Go to Dashboard
                  <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </SignedIn>

              <Button variant="outline" size="lg" className="px-7 h-12 text-[0.9375rem]" style={{ borderColor: 'rgba(28, 63, 64, 0.15)', color: '#0c1310' }} onClick={() => navigate('/pricing')}>
                View Pricing
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
