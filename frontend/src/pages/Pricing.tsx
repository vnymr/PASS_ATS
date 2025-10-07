import React, { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import Icons from '../components/ui/icons';
import { api } from '../api-clerk';

interface PricingTier {
  name: string;
  price: number;
  period: string;
  limit: string;
  features: string[];
  popular?: boolean;
  priceId?: string;
}

const pricingTiers: PricingTier[] = [
  {
    name: 'FREE',
    price: 0,
    period: 'forever',
    limit: '5 resumes/day',
    features: [
      '5 resume generations per day',
      'Basic ATS optimization',
      'PDF export',
      'Job description matching',
      'Email support'
    ]
  },
  {
    name: 'PRO',
    price: 10,
    period: 'month',
    limit: '30 resumes/day',
    popular: true,
    priceId: import.meta.env.VITE_STRIPE_PRO_PRICE_ID,
    features: [
      '30 resume generations per day',
      'Advanced ATS optimization',
      'PDF & LaTeX export',
      'Priority job matching',
      'Chrome extension access',
      'Priority support',
      'Resume history export'
    ]
  },
  {
    name: 'UNLIMITED',
    price: 20,
    period: 'month',
    limit: 'Unlimited resumes',
    priceId: import.meta.env.VITE_STRIPE_UNLIMITED_PRICE_ID,
    features: [
      'Unlimited resume generations',
      'AI-powered cover letters',
      'Custom resume templates',
      'Bulk resume generation',
      'API access',
      'White-label option',
      '24/7 premium support',
      'Early access to features'
    ]
  }
];

export default function Pricing() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [currentTier, setCurrentTier] = useState<string>('FREE');
  const [error, setError] = useState('');

  useEffect(() => {
    loadSubscription();
  }, []);

  async function loadSubscription() {
    try {
      const token = await getToken();
      const subscription = await api.get('/api/subscription', token || undefined);
      if (subscription && subscription.tier) {
        setCurrentTier(subscription.tier);
      }
    } catch (err) {
      console.error('Failed to load subscription:', err);
    }
  }

  async function handleUpgrade(priceId?: string) {
    if (!priceId) return;

    setLoading(true);
    setError('');

    try {
      const token = await getToken();
      const { sessionUrl } = await api.post('/api/create-checkout-session', { priceId }, token || undefined);

      // Redirect to Stripe checkout
      window.location.href = sessionUrl;
    } catch (err: any) {
      setError(err.message || 'Failed to create checkout session');
      setLoading(false);
    }
  }

  return (
    <div className="modern-pricing-page">
      <div className="modern-pricing-container">
        {/* Header */}
        <div className="modern-pricing-header">
          <button
            className="modern-back-btn"
            onClick={() => navigate('/dashboard')}
            aria-label="Back to dashboard"
          >
            <Icons.arrowLeft size={20} />
          </button>
          <h1>Choose Your Plan</h1>
          <p>Select the perfect plan for your job search journey</p>
        </div>

        {error && (
          <div className="modern-alert modern-alert-error">
            <Icons.alertCircle size={18} />
            <span>{error}</span>
            <button onClick={() => setError('')} className="modern-alert-close">
              <Icons.x size={16} />
            </button>
          </div>
        )}

        {/* Pricing Cards */}
        <div className="modern-pricing-grid">
          {pricingTiers.map((tier) => {
            const isCurrentTier = currentTier === tier.name;

            return (
              <div
                key={tier.name}
                className={`modern-pricing-card ${tier.popular ? 'popular' : ''} ${isCurrentTier ? 'current' : ''}`}
              >
                {tier.popular && (
                  <div className="modern-pricing-badge">
                    <Icons.star size={14} />
                    Most Popular
                  </div>
                )}

                <div className="modern-pricing-card-header">
                  <h3>{tier.name}</h3>
                  <div className="modern-pricing-price">
                    <span className="currency">$</span>
                    <span className="amount">{tier.price}</span>
                    <span className="period">/{tier.period}</span>
                  </div>
                  <p className="modern-pricing-limit">{tier.limit}</p>
                </div>

                <ul className="modern-pricing-features">
                  {tier.features.map((feature, idx) => (
                    <li key={idx}>
                      <Icons.checkCircle size={18} />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="modern-pricing-card-footer">
                  {isCurrentTier ? (
                    <button className="modern-pricing-btn current" disabled>
                      <Icons.checkCircle size={18} />
                      Current Plan
                    </button>
                  ) : tier.price === 0 ? (
                    <button
                      className="modern-pricing-btn secondary"
                      onClick={() => navigate('/dashboard')}
                    >
                      Get Started Free
                    </button>
                  ) : (
                    <button
                      className="modern-pricing-btn primary"
                      onClick={() => handleUpgrade(tier.priceId)}
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <div className="modern-btn-spinner"></div>
                          Loading...
                        </>
                      ) : (
                        <>
                          <Icons.zap size={18} />
                          Upgrade to {tier.name}
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* FAQ or Additional Info */}
        <div className="modern-pricing-footer">
          <p>
            <Icons.shield size={16} />
            Secure payment powered by Stripe • Cancel anytime • No hidden fees
          </p>
        </div>
      </div>
    </div>
  );
}
