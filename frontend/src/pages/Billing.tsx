import React, { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { api, type Quota } from '../api-clerk';
import Card, { CardHeader, CardTitle, CardDescription, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';

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

  useEffect(() => {
    console.debug('[RUNTIME] Mounted: Billing');
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
      <div className="p-10 text-center">
        <div className="modern-btn-spinner mx-auto"></div>
        <p className="mt-4 text-neutral-500">Loading billing information...</p>
      </div>
    );
  }

  const { subscription, usage } = data;
  const percentage = usage ? (usage.used / usage.limit) * 100 : 0;
  const isNearLimit = percentage >= 80;
  const isFree = subscription.tier === 'FREE';

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <Button variant="outline" onClick={() => navigate('/dashboard')} className="mb-6">← Back to Dashboard</Button>

      <h1 className="mb-2 text-3xl font-bold text-neutral-900 tracking-tight">Subscription & Usage</h1>
      <p className="text-neutral-600 mb-8">Manage your subscription and view your usage statistics</p>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
          <CardDescription>Your active subscription and usage</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-start mb-5 flex-wrap gap-5">
            <div>
              <div className="text-xs text-neutral-500 mb-1 uppercase tracking-wider font-medium">Plan</div>
              <div className="text-2xl font-semibold text-neutral-900">{subscription.tier}</div>
            </div>
            <div className="text-right">
              <div className="text-4xl font-bold leading-none text-neutral-900">{usage.remaining}</div>
              <div className="text-sm text-neutral-500 mt-1">remaining this month</div>
            </div>
          </div>
          <div className="text-sm mb-2 text-neutral-600">{usage.used} of {usage.limit} resumes used this month</div>
          <div className="h-2 w-full rounded-full bg-neutral-200 overflow-hidden">
            {(() => {
              const pct = Math.max(0, Math.min(100, Math.round(percentage)));
              return <div style={{ width: `${pct}%` }} className="h-full bg-primary-600 transition-[width] duration-300" />;
            })()}
          </div>
          {isNearLimit && (
            <div className="mt-2 text-sm text-neutral-600 inline-flex items-center gap-2">
              <span>⚠️</span>
              <span>You're running low on resumes</span>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-3 mb-6 flex-wrap">
        {isFree ? (
          <Button onClick={handleUpgrade} disabled={loading} className="min-w-[250px]">
            {loading ? (
              <>
                <div className="modern-btn-spinner"></div>
                Loading...
              </>
            ) : (
              'Upgrade to Pro or Unlimited'
            )}
          </Button>
        ) : (
          <Button variant="outline" onClick={handleManageSubscription} disabled={loading} className="min-w-[250px]">
            {loading ? (
              <>
                <div className="modern-btn-spinner"></div>
                Loading...
              </>
            ) : (
              'Manage Subscription'
            )}
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>What’s included in {subscription.tier}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-none p-0 m-0 text-neutral-900">
            {subscription.tier === 'FREE' && (
              <>
                <li className="py-2.5 flex gap-3 items-start"><span>✓</span><span>50 AI-generated resumes per month</span></li>
                <li className="py-2.5 flex gap-3 items-start"><span>✓</span><span>ATS-optimized formatting</span></li>
                <li className="py-2.5 flex gap-3 items-start"><span>✓</span><span>Instant PDF downloads</span></li>
                <li className="py-2.5 flex gap-3 items-start"><span>✓</span><span>Job description analysis</span></li>
              </>
            )}
            {subscription.tier === 'PRO' && (
              <>
                <li className="py-2.5 flex gap-3 items-start"><span>✓</span><span>100 AI-generated resumes per month</span></li>
                <li className="py-2.5 flex gap-3 items-start"><span>✓</span><span>Advanced ATS optimization</span></li>
                <li className="py-2.5 flex gap-3 items-start"><span>✓</span><span>LaTeX source code access</span></li>
                <li className="py-2.5 flex gap-3 items-start"><span>✓</span><span>Priority support</span></li>
                <li className="py-2.5 flex gap-3 items-start"><span>✓</span><span>Custom resume templates</span></li>
              </>
            )}
            {subscription.tier === 'UNLIMITED' && (
              <>
                <li className="py-2.5 flex gap-3 items-start"><span>✓</span><span>Unlimited AI-generated resumes</span></li>
                <li className="py-2.5 flex gap-3 items-start"><span>✓</span><span>Advanced ATS optimization</span></li>
                <li className="py-2.5 flex gap-3 items-start"><span>✓</span><span>LaTeX source code access</span></li>
                <li className="py-2.5 flex gap-3 items-start"><span>✓</span><span>Priority 24/7 support</span></li>
                <li className="py-2.5 flex gap-3 items-start"><span>✓</span><span>Custom resume templates</span></li>
                <li className="py-2.5 flex gap-3 items-start"><span>✓</span><span>Early access to new features</span></li>
              </>
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
