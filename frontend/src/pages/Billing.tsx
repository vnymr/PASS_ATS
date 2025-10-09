import React, { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { api, type Quota } from '../api-clerk';

interface BillingData {
  subscription: {
    tier: string;
    status?: string;
  };
  usage: Quota | null;
}

export default function Billing() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<BillingData | null>(null);

  useEffect(() => {
    loadBillingData();
  }, []);

  async function loadBillingData() {
    try {
      const token = await getToken();

      const [subscription, usage] = await Promise.all([
        api.get('/api/subscription', token || undefined),
        api.getQuota(token || undefined)
      ]);

      setData({ subscription, usage });
    } catch (error) {
      console.error('Failed to load billing data:', error);
    }
  }

  async function handleUpgrade() {
    setLoading(true);

    try {
      const token = await getToken();

      // Show simple selection
      const selectedPriceId = window.confirm(
        'Choose your plan:\n\n' +
        'Click OK for PRO ($10/month, 30 resumes/month)\n' +
        'Click Cancel for UNLIMITED ($20/month, unlimited resumes)'
      )
        ? import.meta.env.VITE_STRIPE_PRO_PRICE_ID
        : import.meta.env.VITE_STRIPE_UNLIMITED_PRICE_ID;

      const { sessionUrl } = await api.post(
        '/api/create-checkout-session',
        { priceId: selectedPriceId },
        token || undefined
      );

      if (sessionUrl) {
        window.location.href = sessionUrl; // Redirect to Stripe
      } else {
        alert('Failed to create checkout session');
        setLoading(false);
      }
    } catch (error) {
      console.error('Upgrade error:', error);
      alert('Failed to start upgrade process');
      setLoading(false);
    }
  }

  async function handleManageSubscription() {
    setLoading(true);

    try {
      const token = await getToken();
      const { url } = await api.post(
        '/api/create-portal-session',
        {},
        token || undefined
      );

      if (url) {
        window.location.href = url; // Redirect to Stripe portal
      } else {
        alert('Failed to open billing portal');
        setLoading(false);
      }
    } catch (error) {
      console.error('Portal error:', error);
      alert('Failed to open billing portal');
      setLoading(false);
    }
  }

  if (!data || !data.usage) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div className="modern-btn-spinner" style={{ margin: '0 auto' }}></div>
        <p style={{ marginTop: '15px', color: '#94a3b8' }}>Loading billing information...</p>
      </div>
    );
  }

  const { subscription, usage } = data;
  const percentage = usage ? (usage.used / usage.limit) * 100 : 0;
  const isNearLimit = percentage >= 80;
  const isFree = subscription.tier === 'FREE';

  return (
    <div
      style={{
        background: '#0a0a0a',
        minHeight: '100vh',
        padding: '60px 0'
      }}
    >
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px' }}>
      {/* Back button */}
      <button
        onClick={() => navigate('/dashboard')}
        style={{
          background: 'transparent',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          color: '#ffffff',
          cursor: 'pointer',
          marginBottom: '40px',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 16px',
          borderRadius: '6px',
          transition: 'all 0.2s'
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.4)';
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
          e.currentTarget.style.background = 'transparent';
        }}
      >
        ← Back to Dashboard
      </button>

      <h1 style={{ marginBottom: '12px', fontSize: '2.5rem', fontWeight: '700', color: '#ffffff', letterSpacing: '-0.02em' }}>Subscription & Usage</h1>
      <p style={{ color: '#888', marginBottom: '60px', fontSize: '1.125rem', maxWidth: '600px' }}>
        Manage your subscription and view your usage statistics
      </p>

      {/* Current Plan Card */}
      <div
        style={{
          background: '#0a0a0a',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '0',
          padding: '48px',
          color: '#ffffff',
          marginBottom: '32px'
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '30px',
            flexWrap: 'wrap',
            gap: '20px'
          }}
        >
          <div>
            <div
              style={{
                fontSize: '12px',
                color: '#666',
                marginBottom: '8px',
                textTransform: 'uppercase',
                letterSpacing: '1.5px',
                fontWeight: '500'
              }}
            >
              Current Plan
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: '600', color: '#ffffff' }}>
              {subscription.tier}
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '3rem', fontWeight: '700', lineHeight: 1, color: '#ffffff' }}>
              {usage.remaining}
            </div>
            <div style={{ fontSize: '14px', color: '#888', marginTop: '8px' }}>
              remaining this month
            </div>
          </div>
        </div>

        {/* Usage info */}
        <div
          style={{
            fontSize: '0.95rem',
            marginBottom: '12px',
            color: '#888'
          }}
        >
          {usage.used} of {usage.limit} resumes used this month
        </div>

        {/* Progress bar */}
        <div
          style={{
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '0',
            height: '4px',
            overflow: 'hidden'
          }}
        >
          <div
            style={{
              width: `${percentage}%`,
              height: '100%',
              background: isNearLimit ? '#ffffff' : '#ffffff',
              transition: 'width 0.3s'
            }}
          />
        </div>

        {isNearLimit && (
          <div
            style={{
              marginTop: '12px',
              fontSize: '0.875rem',
              color: '#888',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span>⚠️</span>
            <span>You're running low on resumes</span>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '24px',
          flexWrap: 'wrap'
        }}
      >
        {isFree ? (
          <button
            onClick={handleUpgrade}
            disabled={loading}
            style={{
              flex: 1,
              minWidth: '250px',
              padding: '14px 28px',
              background: '#ffffff',
              color: '#000000',
              border: 'none',
              borderRadius: '6px',
              fontSize: '1rem',
              fontWeight: '500',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.5 : 1,
              transition: 'background 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
            onMouseOver={(e) => {
              if (!loading) {
                e.currentTarget.style.background = '#f0f0f0';
              }
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = '#ffffff';
            }}
          >
            {loading ? (
              <>
                <div className="modern-btn-spinner"></div>
                Loading...
              </>
            ) : (
              'Upgrade to Pro or Unlimited'
            )}
          </button>
        ) : (
          <button
            onClick={handleManageSubscription}
            disabled={loading}
            style={{
              flex: 1,
              minWidth: '250px',
              padding: '14px 28px',
              background: 'transparent',
              color: '#ffffff',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '6px',
              fontSize: '1rem',
              fontWeight: '500',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.5 : 1,
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              if (!loading) {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.4)';
              }
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            }}
          >
            {loading ? (
              <>
                <div className="modern-btn-spinner"></div>
                Loading...
              </>
            ) : (
              'Manage Subscription'
            )}
          </button>
        )}
      </div>

      {/* Plan comparison link */}
      <div style={{ textAlign: 'center', marginTop: '24px' }}>
        <a
          href="https://happyresumes.com/#pricing"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: '#ffffff',
            textDecoration: 'none',
            fontSize: '0.875rem',
            fontWeight: '500'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.textDecoration = 'underline';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.textDecoration = 'none';
          }}
        >
          Compare all plans →
        </a>
      </div>

      {/* Feature list for current tier */}
      <div
        style={{
          marginTop: '40px',
          padding: '32px',
          background: '#0a0a0a',
          borderRadius: '0',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}
      >
        <h3 style={{ marginBottom: '20px', fontSize: '1.125rem', fontWeight: '600', color: '#ffffff' }}>
          What's included in {subscription.tier}
        </h3>

        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0
          }}
        >
          {subscription.tier === 'FREE' && (
            <>
              <li style={{ padding: '10px 0', display: 'flex', gap: '12px', alignItems: 'flex-start', color: '#ffffff', fontSize: '1rem' }}>
                <span style={{ color: '#ffffff', fontSize: '18px' }}>✓</span>
                <span>50 AI-generated resumes per month</span>
              </li>
              <li style={{ padding: '10px 0', display: 'flex', gap: '12px', alignItems: 'flex-start', color: '#ffffff', fontSize: '1rem' }}>
                <span style={{ color: '#ffffff', fontSize: '18px' }}>✓</span>
                <span>ATS-optimized formatting</span>
              </li>
              <li style={{ padding: '10px 0', display: 'flex', gap: '12px', alignItems: 'flex-start', color: '#ffffff', fontSize: '1rem' }}>
                <span style={{ color: '#ffffff', fontSize: '18px' }}>✓</span>
                <span>Instant PDF downloads</span>
              </li>
              <li style={{ padding: '10px 0', display: 'flex', gap: '12px', alignItems: 'flex-start', color: '#ffffff', fontSize: '1rem' }}>
                <span style={{ color: '#ffffff', fontSize: '18px' }}>✓</span>
                <span>Job description analysis</span>
              </li>
            </>
          )}

          {subscription.tier === 'PRO' && (
            <>
              <li style={{ padding: '10px 0', display: 'flex', gap: '12px', alignItems: 'flex-start', color: '#ffffff', fontSize: '1rem' }}>
                <span style={{ color: '#ffffff', fontSize: '18px' }}>✓</span>
                <span>100 AI-generated resumes per month</span>
              </li>
              <li style={{ padding: '10px 0', display: 'flex', gap: '12px', alignItems: 'flex-start', color: '#ffffff', fontSize: '1rem' }}>
                <span style={{ color: '#ffffff', fontSize: '18px' }}>✓</span>
                <span>Advanced ATS optimization</span>
              </li>
              <li style={{ padding: '10px 0', display: 'flex', gap: '12px', alignItems: 'flex-start', color: '#ffffff', fontSize: '1rem' }}>
                <span style={{ color: '#ffffff', fontSize: '18px' }}>✓</span>
                <span>LaTeX source code access</span>
              </li>
              <li style={{ padding: '10px 0', display: 'flex', gap: '12px', alignItems: 'flex-start', color: '#ffffff', fontSize: '1rem' }}>
                <span style={{ color: '#ffffff', fontSize: '18px' }}>✓</span>
                <span>Priority support</span>
              </li>
              <li style={{ padding: '10px 0', display: 'flex', gap: '12px', alignItems: 'flex-start', color: '#ffffff', fontSize: '1rem' }}>
                <span style={{ color: '#ffffff', fontSize: '18px' }}>✓</span>
                <span>Custom resume templates</span>
              </li>
            </>
          )}

          {subscription.tier === 'UNLIMITED' && (
            <>
              <li style={{ padding: '10px 0', display: 'flex', gap: '12px', alignItems: 'flex-start', color: '#ffffff', fontSize: '1rem' }}>
                <span style={{ color: '#ffffff', fontSize: '18px' }}>✓</span>
                <span>Unlimited AI-generated resumes</span>
              </li>
              <li style={{ padding: '10px 0', display: 'flex', gap: '12px', alignItems: 'flex-start', color: '#ffffff', fontSize: '1rem' }}>
                <span style={{ color: '#ffffff', fontSize: '18px' }}>✓</span>
                <span>Advanced ATS optimization</span>
              </li>
              <li style={{ padding: '10px 0', display: 'flex', gap: '12px', alignItems: 'flex-start', color: '#ffffff', fontSize: '1rem' }}>
                <span style={{ color: '#ffffff', fontSize: '18px' }}>✓</span>
                <span>LaTeX source code access</span>
              </li>
              <li style={{ padding: '10px 0', display: 'flex', gap: '12px', alignItems: 'flex-start', color: '#ffffff', fontSize: '1rem' }}>
                <span style={{ color: '#ffffff', fontSize: '18px' }}>✓</span>
                <span>Priority 24/7 support</span>
              </li>
              <li style={{ padding: '10px 0', display: 'flex', gap: '12px', alignItems: 'flex-start', color: '#ffffff', fontSize: '1rem' }}>
                <span style={{ color: '#ffffff', fontSize: '18px' }}>✓</span>
                <span>Custom resume templates</span>
              </li>
              <li style={{ padding: '10px 0', display: 'flex', gap: '12px', alignItems: 'flex-start', color: '#ffffff', fontSize: '1rem' }}>
                <span style={{ color: '#ffffff', fontSize: '18px' }}>✓</span>
                <span>Early access to new features</span>
              </li>
            </>
          )}
        </ul>
      </div>
      </div>
    </div>
  );
}
