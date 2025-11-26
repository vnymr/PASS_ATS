import { useNavigate } from 'react-router-dom';
import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton, useAuth } from '@clerk/clerk-react';
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Check,
  X,
  Zap,
  Shield,
  Target,
  Sparkles,
  FileText,
  MessageSquare,
  Calendar,
  BarChart3,
  ArrowRight,
  Menu,
  Crown
} from "lucide-react";
import logoImg from '../logo.svg';
import { useState } from 'react';
import { api } from '../api-clerk';

export default function Pricing() {
  const navigate = useNavigate();
  const { isSignedIn, getToken } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    if (!isSignedIn) return;

    setLoading(true);
    try {
      const token = await getToken();
      const { sessionUrl } = await api.post(
        '/api/create-checkout-session',
        { priceId: import.meta.env.VITE_STRIPE_PRO_PRICE_ID },
        token || undefined
      );

      if (sessionUrl) {
        window.location.href = sessionUrl;
      }
    } catch (error) {
      console.error('Upgrade error', error);
      alert('Failed to start upgrade process');
    } finally {
      setLoading(false);
    }
  };

  const plans = [
    {
      name: 'Free',
      price: '$0',
      period: 'forever',
      description: 'Perfect for getting started with your job search',
      highlight: false,
      features: [
        { text: '2 job applications per day', included: true, highlight: false },
        { text: 'AI-optimized resumes', included: true, highlight: false },
        { text: 'ATS-friendly formatting', included: true, highlight: false },
        { text: 'Basic job matching', included: true, highlight: false },
        { text: 'PDF downloads', included: true, highlight: false },
        { text: 'AI Career Coach', included: false, highlight: false },
        { text: 'Priority auto-apply', included: false, highlight: false },
        { text: 'Advanced analytics', included: false, highlight: false },
        { text: 'Goal tracking & routines', included: false, highlight: false },
      ],
      cta: 'Get Started Free',
      ctaAction: 'signup'
    },
    {
      name: 'Pro',
      price: '$20',
      period: '/month',
      description: 'For serious job seekers who want to maximize their chances',
      highlight: true,
      badge: 'Most Popular',
      features: [
        { text: '300 job applications per month', included: true, highlight: false },
        { text: 'AI-optimized resumes', included: true, highlight: false },
        { text: 'ATS-friendly formatting', included: true, highlight: false },
        { text: 'Smart job matching & discovery', included: true, highlight: false },
        { text: 'PDF & LaTeX downloads', included: true, highlight: false },
        { text: 'AI Career Coach', included: true, highlight: true },
        { text: 'Priority auto-apply queue', included: true, highlight: true },
        { text: 'Advanced analytics & insights', included: true, highlight: true },
        { text: 'Goal tracking & daily routines', included: true, highlight: true },
      ],
      cta: 'Upgrade to Pro',
      ctaAction: 'upgrade'
    }
  ];

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
              <button onClick={() => navigate('/extension')} className="hover:opacity-70 transition-opacity text-[0.875rem]" style={{ color: '#0c1310' }}>
                Chrome Extension
              </button>
              <button onClick={() => navigate('/pricing')} className="text-[0.875rem]" style={{ color: '#3eaca7', fontWeight: 500 }}>
                Pricing
              </button>
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
              <button onClick={() => { navigate('/extension'); setIsMobileMenuOpen(false); }} className="px-4 py-2 text-[0.875rem] hover:bg-gray-100 rounded-lg text-left" style={{ color: '#0c1310' }}>Chrome Extension</button>
              <button onClick={() => { navigate('/pricing'); setIsMobileMenuOpen(false); }} className="px-4 py-2 text-[0.875rem] hover:bg-gray-100 rounded-lg text-left" style={{ color: '#3eaca7' }}>Pricing</button>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="px-6 pt-20 pb-12 md:pt-28 md:pb-16 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#3eaca7] opacity-[0.02] rounded-full blur-3xl" />

        <div className="max-w-4xl mx-auto text-center relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5 text-[0.8125rem]"
              style={{ backgroundColor: '#3eaca7', color: '#ffffff' }}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Simple, Transparent Pricing</span>
            </div>

            <h1
              className="text-[2.5rem] md:text-[3.5rem] mb-5 leading-[1.1]"
              style={{ fontWeight: 600, color: '#0c1310' }}
            >
              Choose the Plan That Fits Your Goals
            </h1>

            <p
              className="text-[1rem] md:text-[1.125rem] max-w-2xl mx-auto leading-[1.65]"
              style={{ color: '#5a6564' }}
            >
              Start for free with essential features, or unlock the full power of AI-driven job searching with Pro.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="px-6 pb-16 md:pb-24">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-2 gap-6">
            {plans.map((plan, index) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className={`relative rounded-2xl p-8 border ${plan.highlight ? 'shadow-xl' : 'shadow-sm'}`}
                style={{
                  backgroundColor: '#ffffff',
                  borderColor: plan.highlight ? '#3eaca7' : 'rgba(28, 63, 64, 0.08)',
                  borderWidth: plan.highlight ? '2px' : '1px'
                }}
              >
                {plan.badge && (
                  <div
                    className="absolute -top-3 left-1/2 transform -translate-x-1/2 px-4 py-1 rounded-full text-[0.75rem] flex items-center gap-1.5"
                    style={{ backgroundColor: '#3eaca7', color: '#ffffff', fontWeight: 600 }}
                  >
                    <Crown className="w-3.5 h-3.5" />
                    {plan.badge}
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-[1.25rem] mb-2" style={{ color: '#0c1310', fontWeight: 600 }}>
                    {plan.name}
                  </h3>
                  <div className="flex items-baseline gap-1 mb-2">
                    <span className="text-[3rem]" style={{ color: '#0c1310', fontWeight: 700, lineHeight: 1 }}>
                      {plan.price}
                    </span>
                    <span style={{ color: '#5a6564', fontSize: '0.9375rem' }}>
                      {plan.period}
                    </span>
                  </div>
                  <p style={{ color: '#5a6564', fontSize: '0.875rem', lineHeight: 1.5 }}>
                    {plan.description}
                  </p>
                </div>

                <div className="space-y-3 mb-8">
                  {plan.features.map((feature, i) => (
                    <div key={i} className="flex items-start gap-3">
                      {feature.included ? (
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{ backgroundColor: feature.highlight ? '#3eaca7' : 'rgba(62, 172, 167, 0.15)' }}
                        >
                          <Check className="w-3 h-3" style={{ color: feature.highlight ? '#ffffff' : '#3eaca7' }} />
                        </div>
                      ) : (
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{ backgroundColor: 'rgba(90, 101, 100, 0.1)' }}
                        >
                          <X className="w-3 h-3" style={{ color: '#5a6564' }} />
                        </div>
                      )}
                      <span
                        style={{
                          color: feature.included ? '#0c1310' : '#5a6564',
                          fontSize: '0.875rem',
                          fontWeight: feature.highlight ? 500 : 400
                        }}
                      >
                        {feature.text}
                      </span>
                    </div>
                  ))}
                </div>

                {plan.ctaAction === 'signup' ? (
                  <SignedOut>
                    <SignUpButton mode="modal">
                      <Button
                        className="w-full h-11 text-[0.9375rem]"
                        variant={plan.highlight ? 'default' : 'outline'}
                        style={plan.highlight
                          ? { backgroundColor: '#3eaca7', color: '#ffffff' }
                          : { borderColor: 'rgba(28, 63, 64, 0.2)', color: '#0c1310' }
                        }
                      >
                        {plan.cta}
                      </Button>
                    </SignUpButton>
                  </SignedOut>
                ) : (
                  <SignedOut>
                    <SignUpButton mode="modal">
                      <Button
                        className="w-full h-11 text-[0.9375rem] group"
                        style={{ backgroundColor: '#3eaca7', color: '#ffffff' }}
                      >
                        {plan.cta}
                        <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </SignUpButton>
                  </SignedOut>
                )}

                <SignedIn>
                  {plan.ctaAction === 'signup' ? (
                    <Button
                      className="w-full h-11 text-[0.9375rem]"
                      variant="outline"
                      style={{ borderColor: 'rgba(28, 63, 64, 0.2)', color: '#0c1310' }}
                      onClick={() => navigate('/happy')}
                    >
                      Current Plan
                    </Button>
                  ) : (
                    <Button
                      className="w-full h-11 text-[0.9375rem] group"
                      style={{ backgroundColor: '#3eaca7', color: '#ffffff' }}
                      onClick={handleUpgrade}
                      disabled={loading}
                    >
                      {loading ? 'Loading...' : plan.cta}
                      {!loading && <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />}
                    </Button>
                  )}
                </SignedIn>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Comparison */}
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
              What's Included in Pro
            </h2>
            <p style={{ color: '#5a6564', fontSize: '1rem' }}>
              Unlock the full potential of your job search
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                icon: <Zap className="w-6 h-6" />,
                title: '300 Applications/Month',
                description: 'Apply to 10x more jobs with our intelligent auto-apply system that works while you sleep.',
                color: '#3eaca7'
              },
              {
                icon: <MessageSquare className="w-6 h-6" />,
                title: 'AI Career Coach',
                description: 'Get personalized career advice, interview prep, and strategic guidance from your AI assistant.',
                color: '#409677'
              },
              {
                icon: <Target className="w-6 h-6" />,
                title: 'Goal Tracking',
                description: 'Set career objectives and track your progress with actionable daily tasks and milestones.',
                color: '#1c3f40'
              },
              {
                icon: <BarChart3 className="w-6 h-6" />,
                title: 'Advanced Analytics',
                description: 'See detailed insights on your applications, response rates, and areas for improvement.',
                color: '#3eaca7'
              },
              {
                icon: <Calendar className="w-6 h-6" />,
                title: 'Daily Routines',
                description: 'AI-generated daily tasks to keep you on track and maximize your job search efficiency.',
                color: '#409677'
              },
              {
                icon: <Shield className="w-6 h-6" />,
                title: 'Priority Queue',
                description: 'Your applications get processed first with our stealth auto-apply technology.',
                color: '#1c3f40'
              }
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
                viewport={{ once: true }}
                className="flex gap-4 p-5 rounded-xl border"
                style={{ backgroundColor: '#f5f7f7', borderColor: 'rgba(28, 63, 64, 0.08)' }}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: feature.color, color: '#ffffff' }}
                >
                  {feature.icon}
                </div>
                <div>
                  <h3 className="mb-1 text-[1rem]" style={{ color: '#0c1310', fontWeight: 600 }}>
                    {feature.title}
                  </h3>
                  <p style={{ color: '#5a6564', fontSize: '0.875rem', lineHeight: 1.6 }}>
                    {feature.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="px-6 py-16 md:py-20">
        <div className="max-w-3xl mx-auto">
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
              {
                question: 'Can I cancel anytime?',
                answer: 'Yes! You can cancel your Pro subscription at any time. You\'ll continue to have access to Pro features until the end of your billing period.'
              },
              {
                question: 'What happens when I reach my application limit?',
                answer: 'On the Free plan, your daily limit resets every 24 hours. On Pro, your 300 applications reset monthly. You can always upgrade to continue applying.'
              },
              {
                question: 'Is my payment information secure?',
                answer: 'Absolutely. We use Stripe for payment processing, which is PCI-compliant and uses bank-level security to protect your information.'
              },
              {
                question: 'Can I switch plans?',
                answer: 'Yes, you can upgrade from Free to Pro at any time. Your Pro benefits start immediately upon upgrading.'
              }
            ].map((faq, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
                viewport={{ once: true }}
                className="rounded-xl p-5 border"
                style={{ backgroundColor: '#ffffff', borderColor: 'rgba(28, 63, 64, 0.08)' }}
              >
                <h4 className="mb-2 text-[0.9375rem]" style={{ color: '#0c1310', fontWeight: 600 }}>
                  {faq.question}
                </h4>
                <p style={{ color: '#5a6564', fontSize: '0.875rem', lineHeight: 1.6 }}>
                  {faq.answer}
                </p>
              </motion.div>
            ))}
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
            className="rounded-2xl p-10 md:p-14 text-center relative overflow-hidden"
            style={{ backgroundColor: '#1c3f40' }}
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#3eaca7] opacity-10 rounded-full blur-3xl" />

            <div className="relative">
              <h2 className="text-[2rem] md:text-[2.5rem] mb-4 leading-[1.15]" style={{ fontWeight: 600, color: '#ffffff' }}>
                Ready to Land Your Dream Job?
              </h2>

              <p className="text-[1rem] mb-8 max-w-2xl mx-auto leading-[1.65]" style={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                Start free today and see the difference AI-powered job searching can make.
              </p>

              <SignedOut>
                <SignUpButton mode="modal">
                  <Button size="lg" className="px-8 h-12 text-[0.9375rem] group" style={{ backgroundColor: '#3eaca7', color: '#ffffff' }}>
                    Get Started Free
                    <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </SignUpButton>
              </SignedOut>
              <SignedIn>
                <Button size="lg" className="px-8 h-12 text-[0.9375rem] group" style={{ backgroundColor: '#3eaca7', color: '#ffffff' }} onClick={() => navigate('/happy')}>
                  Go to Dashboard
                  <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </SignedIn>
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
