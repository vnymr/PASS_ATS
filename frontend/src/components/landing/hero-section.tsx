import { Button } from "../ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

interface HeroSectionProps {
  onGetStarted?: () => void;
  onWatchDemo?: () => void;
  resumeCount?: number | null;
}

export function HeroSection({ onGetStarted, onWatchDemo, resumeCount }: HeroSectionProps) {
  return (
    <section className="relative overflow-hidden px-6 pt-16 pb-20 md:pt-24 md:pb-28">
      {/* Subtle background decorations */}
      <div className="absolute top-20 right-0 w-[500px] h-[500px] bg-[#3eaca7] opacity-[0.03] rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[#409677] opacity-[0.02] rounded-full blur-3xl" />

      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-16 items-center">
          {/* Left column - Text content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#3eaca7]/10 mb-6 text-[0.8125rem]">
              <Sparkles className="w-3.5 h-3.5" style={{ color: '#3eaca7' }} />
              <span style={{ color: '#409677', fontWeight: 500 }}>AI-Powered Job Search Platform</span>
            </div>

            <h1
              className="text-[2.75rem] md:text-[3.5rem] lg:text-[4rem] tracking-tight mb-6 leading-[1.08]"
              style={{
                fontWeight: 600,
                color: '#0c1310'
              }}
            >
              The Smarter, Faster Way to{' '}
              <span
                className="relative inline-block"
                style={{ color: '#3eaca7' }}
              >
                Get Hired
                <svg
                  className="absolute -bottom-2 left-0 w-full"
                  height="8"
                  viewBox="0 0 200 8"
                  style={{ opacity: 0.3 }}
                >
                  <path
                    d="M0 4 Q50 0, 100 4 T200 4"
                    stroke="#3eaca7"
                    strokeWidth="2"
                    fill="none"
                  />
                </svg>
              </span>
            </h1>

            <p
              className="text-[1.0625rem] md:text-[1.125rem] mb-8 max-w-xl leading-[1.65]"
              style={{
                color: '#5a6564'
              }}
            >
              Stop manually tailoring resumes and filling out endless applications. Our AI-powered platform builds winning resumes and applies to top jobs for you—undetected.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mb-12">
              <Button
                size="lg"
                className="group px-7 h-12 text-[0.9375rem] shadow-sm hover:shadow-md transition-all"
                style={{
                  backgroundColor: '#3eaca7',
                  color: '#ffffff'
                }}
                onClick={onGetStarted}
              >
                Start Your Free Trial
                <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>

              <Button
                variant="outline"
                size="lg"
                className="px-7 h-12 text-[0.9375rem] hover:bg-white transition-colors"
                style={{
                  borderColor: 'rgba(28, 63, 64, 0.15)',
                  color: '#0c1310'
                }}
                onClick={onWatchDemo}
              >
                Watch Demo
              </Button>
            </div>

            <div className="flex items-center gap-8 flex-wrap">
              <div>
                <div
                  className="text-[1.875rem] mb-0.5 leading-none"
                  style={{
                    fontWeight: 600,
                    color: '#3eaca7'
                  }}
                >
                  {resumeCount ? `${Math.floor(resumeCount / 1000)}k+` : '10k+'}
                </div>
                <div style={{ color: '#5a6564', fontSize: '0.8125rem' }}>
                  Resumes Generated
                </div>
              </div>

              <div className="w-px h-10" style={{ backgroundColor: 'rgba(28, 63, 64, 0.1)' }} />

              <div>
                <div
                  className="text-[1.875rem] mb-0.5 leading-none"
                  style={{
                    fontWeight: 600,
                    color: '#3eaca7'
                  }}
                >
                  98%
                </div>
                <div style={{ color: '#5a6564', fontSize: '0.8125rem' }}>
                  ATS Pass Rate
                </div>
              </div>

              <div className="w-px h-10" style={{ backgroundColor: 'rgba(28, 63, 64, 0.1)' }} />

              <div>
                <div
                  className="text-[1.875rem] mb-0.5 leading-none"
                  style={{
                    fontWeight: 600,
                    color: '#3eaca7'
                  }}
                >
                  500+
                </div>
                <div style={{ color: '#5a6564', fontSize: '0.8125rem' }}>
                  Job Boards
                </div>
              </div>
            </div>
          </motion.div>

          {/* Right column - Enhanced visual element */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="hidden lg:block relative"
          >
            {/* Main card */}
            <div
              className="relative rounded-2xl p-7 shadow-lg border"
              style={{
                backgroundColor: '#ffffff',
                borderColor: 'rgba(28, 63, 64, 0.08)'
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full" style={{ backgroundColor: '#e5e9e9' }} />
                  <div>
                    <div className="h-2.5 rounded mb-1.5" style={{ backgroundColor: '#e5e9e9', width: '80px' }} />
                    <div className="h-2 rounded" style={{ backgroundColor: '#e5e9e9', width: '60px' }} />
                  </div>
                </div>
                <div
                  className="px-3 py-1.5 rounded-full text-[0.75rem]"
                  style={{ backgroundColor: '#3eaca7', color: '#ffffff' }}
                >
                  Optimized
                </div>
              </div>

              <div className="h-px mb-4" style={{ backgroundColor: 'rgba(28, 63, 64, 0.08)' }} />

              {/* Content sections */}
              <div className="space-y-4">
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

                <div className="h-px" style={{ backgroundColor: 'rgba(28, 63, 64, 0.08)' }} />

                <div className="space-y-2.5">
                  <div className="h-3 rounded" style={{ backgroundColor: '#3eaca7', opacity: 0.15, width: '50%' }} />
                  <div className="space-y-1.5">
                    <div className="h-2 rounded" style={{ backgroundColor: '#e5e9e9' }} />
                    <div className="h-2 rounded" style={{ backgroundColor: '#e5e9e9', width: '90%' }} />
                    <div className="h-2 rounded" style={{ backgroundColor: '#e5e9e9', width: '95%' }} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div
                    className="h-16 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: '#f5f7f7' }}
                  >
                    <div className="text-center">
                      <div className="h-2 rounded mx-auto mb-2" style={{ backgroundColor: '#e5e9e9', width: '40px' }} />
                      <div className="h-1.5 rounded mx-auto" style={{ backgroundColor: '#e5e9e9', width: '30px' }} />
                    </div>
                  </div>
                  <div
                    className="h-16 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: '#f5f7f7' }}
                  >
                    <div className="text-center">
                      <div className="h-2 rounded mx-auto mb-2" style={{ backgroundColor: '#e5e9e9', width: '40px' }} />
                      <div className="h-1.5 rounded mx-auto" style={{ backgroundColor: '#e5e9e9', width: '30px' }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating stat cards */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="absolute -bottom-4 -left-4 rounded-xl p-4 shadow-md border"
              style={{ backgroundColor: '#ffffff', borderColor: 'rgba(28, 63, 64, 0.08)' }}
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#409677' }}>
                  <span style={{ color: '#ffffff', fontSize: '1rem' }}>⚡</span>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#5a6564' }}>Generation Time</div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0c1310' }}>2.3s</div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.8 }}
              className="absolute -top-4 -right-4 rounded-xl p-4 shadow-md border"
              style={{ backgroundColor: '#ffffff', borderColor: 'rgba(28, 63, 64, 0.08)' }}
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#3eaca7' }}>
                  <span style={{ color: '#ffffff', fontSize: '1rem' }}>✓</span>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#5a6564' }}>ATS Score</div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0c1310' }}>98/100</div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
