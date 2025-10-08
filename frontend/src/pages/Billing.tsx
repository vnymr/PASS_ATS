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
        maxWidth: '800px',
        margin: '0 auto',
        padding: '40px 20px'
      }}
    >
      {/* Back button */}
      <button
        onClick={() => navigate('/dashboard')}
        style={{
          background: 'none',
          border: 'none',
          color: '#94a3b8',
          cursor: 'pointer',
          marginBottom: '20px',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '5px'
        }}
      >
        ← Back to Dashboard
      </button>

      <h1 style={{ marginBottom: '10px', fontSize: '32px' }}>Subscription & Usage</h1>
      <p style={{ color: '#94a3b8', marginBottom: '30px' }}>
        Manage your subscription and view your usage statistics
      </p>

      {/* Current Plan Card */}
      <div
        style={{
          background: '#000000',
          borderRadius: '16px',
          padding: '40px',
          color: '#ffffff',
          marginBottom: '30px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
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
                fontSize: '14px',
                opacity: 0.9,
                marginBottom: '5px',
                textTransform: 'uppercase',
                letterSpacing: '1px'
              }}
            >
              Current Plan
            </div>
            <div style={{ fontSize: '32px', fontWeight: '700' }}>
              {subscription.tier}
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '48px', fontWeight: '700', lineHeight: 1 }}>
              {usage.remaining}
            </div>
            <div style={{ fontSize: '14px', opacity: 0.9, marginTop: '5px' }}>
              remaining this month
            </div>
          </div>
        </div>

        {/* Usage info */}
        <div
          style={{
            fontSize: '16px',
            marginBottom: '15px',
            opacity: 0.95
          }}
        >
          {usage.used} of {usage.limit} resumes used this month
        </div>

        {/* Progress bar */}
        <div
          style={{
            background: 'rgba(255,255,255,0.2)',
            borderRadius: '10px',
            height: '12px',
            overflow: 'hidden'
          }}
        >
          <div
            style={{
              width: `${percentage}%`,
              height: '100%',
              background: isNearLimit ? '#cd0000' : '#ffffff',
              transition: 'width 0.3s',
              borderRadius: '10px'
            }}
          />
        </div>

        {isNearLimit && (
          <div
            style={{
              marginTop: '15px',
              fontSize: '14px',
              opacity: 0.95,
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
          gap: '15px',
          marginBottom: '30px',
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
              padding: '16px 24px',
              background: '#000000',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              fontSize: '16px',
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
                e.currentTarget.style.background = '#333333';
              }
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = '#000000';
            }}
          >
            {loading ? (
              <>
                <div className="modern-btn-spinner"></div>
                Loading...
              </>
            ) : (
              <>
                <span>⚡</span>
                Upgrade to Pro or Unlimited
              </>
            )}
          </button>
        ) : (
          <button
            onClick={handleManageSubscription}
            disabled={loading}
            style={{
              flex: 1,
              minWidth: '250px',
              padding: '16px 24px',
              background: '#1a1a1a',
              color: 'white',
              border: '1px solid #333',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.5 : 1,
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              if (!loading) {
                e.currentTarget.style.background = '#252525';
                e.currentTarget.style.borderColor = '#444';
              }
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = '#1a1a1a';
              e.currentTarget.style.borderColor = '#333';
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
      <div style={{ textAlign: 'center', marginTop: '30px' }}>
        <a
          href="https://happyresumes.com/#pricing"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: '#000000',
            textDecoration: 'none',
            fontSize: '14px',
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
          padding: '30px',
          background: '#1a1a1a',
          borderRadius: '12px',
          border: '1px solid #333'
        }}
      >
        <h3 style={{ marginBottom: '20px', fontSize: '18px', fontWeight: '600' }}>
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
              <li style={{ padding: '10px 0', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <span style={{ color: '#4CAF50', fontSize: '18px' }}>✓</span>
                <span>10 AI-generated resumes per month</span>
              </li>
              <li style={{ padding: '10px 0', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <span style={{ color: '#4CAF50', fontSize: '18px' }}>✓</span>
                <span>ATS optimization</span>
              </li>
              <li style={{ padding: '10px 0', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <span style={{ color: '#4CAF50', fontSize: '18px' }}>✓</span>
                <span>PDF download</span>
              </li>
            </>
          )}

          {subscription.tier === 'PRO' && (
            <>
              <li style={{ padding: '10px 0', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <span style={{ color: '#4CAF50', fontSize: '18px' }}>✓</span>
                <span>30 AI-generated resumes per month</span>
              </li>
              <li style={{ padding: '10px 0', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <span style={{ color: '#4CAF50', fontSize: '18px' }}>✓</span>
                <span>Advanced ATS optimization</span>
              </li>
              <li style={{ padding: '10px 0', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <span style={{ color: '#4CAF50', fontSize: '18px' }}>✓</span>
                <span>LaTeX source code</span>
              </li>
              <li style={{ padding: '10px 0', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <span style={{ color: '#4CAF50', fontSize: '18px' }}>✓</span>
                <span>Priority support</span>
              </li>
            </>
          )}

          {subscription.tier === 'UNLIMITED' && (
            <>
              <li style={{ padding: '10px 0', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <span style={{ color: '#4CAF50', fontSize: '18px' }}>✓</span>
                <span>Unlimited AI-generated resumes</span>
              </li>
              <li style={{ padding: '10px 0', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <span style={{ color: '#4CAF50', fontSize: '18px' }}>✓</span>
                <span>Advanced ATS optimization</span>
              </li>
              <li style={{ padding: '10px 0', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <span style={{ color: '#4CAF50', fontSize: '18px' }}>✓</span>
                <span>LaTeX source code</span>
              </li>
              <li style={{ padding: '10px 0', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <span style={{ color: '#4CAF50', fontSize: '18px' }}>✓</span>
                <span>Priority support</span>
              </li>
              <li style={{ padding: '10px 0', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <span style={{ color: '#4CAF50', fontSize: '18px' }}>✓</span>
                <span>Early access to new features</span>
              </li>
            </>
          )}
        </ul>
      </div>
    </div>
  );
}
