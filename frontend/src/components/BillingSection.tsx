import React, { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import Icons from './ui/icons';
import { api } from '../api-clerk';
import logger from '../utils/logger';

interface Subscription {
  tier: string;
  status: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
}

interface Usage {
  used: number;
  limit: number;
  resetDate?: string;
}

export default function BillingSection() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadBillingData();
  }, []);

  async function loadBillingData() {
    try {
      const token = await getToken();
      const [subData, usageData] = await Promise.all([
        api.get('/api/subscription', token || undefined).catch(() => ({ tier: 'FREE', status: 'active' })),
        api.get('/api/usage', token || undefined).catch(() => ({ used: 0, limit: 5 }))
      ]);

      setSubscription(subData);
      setUsage(usageData);
    } catch (err) {
      logger.error('Failed to load billing data', err);
      setError('Failed to load billing information');
    } finally {
      setLoading(false);
    }
  }

  async function handleManageSubscription() {
    setActionLoading(true);
    setError('');

    try {
      const token = await getToken();
      const { portalUrl } = await api.post('/api/create-portal-session', {}, token || undefined);

      // Redirect to Stripe customer portal
      window.location.href = portalUrl;
    } catch (err: any) {
      setError(err.message || 'Failed to open billing portal');
      setActionLoading(false);
    }
  }

  function getTierPrice(tier: string): string {
    switch (tier) {
      case 'PRO':
        return '$10/month';
      case 'UNLIMITED':
        return '$20/month';
      default:
        return 'Free';
    }
  }

  function getTierColor(tier: string): string {
    switch (tier) {
      case 'UNLIMITED':
        return 'tier-unlimited';
      case 'PRO':
        return 'tier-pro';
      default:
        return 'tier-free';
    }
  }

  if (loading) {
    return (
      <div className="modern-billing-loading">
        <div className="modern-loading-circle">
          <div className="modern-loading-inner"></div>
        </div>
        <p>Loading billing information...</p>
      </div>
    );
  }

  const usagePercent = usage ? (usage.used / usage.limit) * 100 : 0;
  const isNearLimit = usagePercent >= 80;
  const isAtLimit = usagePercent >= 100;

  return (
    <div className="modern-billing-section">
      <div className="modern-billing-header">
        <h2>Billing & Subscription</h2>
        <p>Manage your subscription and view usage statistics</p>
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

      <div className="modern-billing-content">
        {/* Current Plan Card */}
        <div className="modern-billing-card">
          <div className="modern-billing-card-header">
            <Icons.creditCard size={24} />
            <h3>Current Plan</h3>
          </div>

          <div className="modern-billing-tier-info">
            <div className={`modern-tier-badge ${getTierColor(subscription?.tier || 'FREE')}`}>
              {subscription?.tier || 'FREE'}
            </div>
            <div className="modern-tier-price">
              {getTierPrice(subscription?.tier || 'FREE')}
            </div>
          </div>

          {subscription && subscription.tier !== 'FREE' && (
            <div className="modern-billing-details">
              <div className="modern-billing-detail">
                <span className="label">Status</span>
                <span className={`value status-${subscription.status}`}>
                  {subscription.status === 'active' ? (
                    <>
                      <Icons.checkCircle size={14} />
                      Active
                    </>
                  ) : (
                    subscription.status
                  )}
                </span>
              </div>

              {subscription.currentPeriodEnd && (
                <div className="modern-billing-detail">
                  <span className="label">
                    {subscription.cancelAtPeriodEnd ? 'Expires on' : 'Next billing date'}
                  </span>
                  <span className="value">
                    {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                  </span>
                </div>
              )}

              {subscription.cancelAtPeriodEnd && (
                <div className="modern-alert modern-alert-warning">
                  <Icons.alertCircle size={16} />
                  <span>Your subscription will be cancelled at the end of the billing period</span>
                </div>
              )}
            </div>
          )}

          <div className="modern-billing-actions">
            {subscription?.tier === 'FREE' ? (
              <button
                className="modern-billing-btn primary"
                onClick={() => navigate('/pricing')}
              >
                <Icons.zap size={18} />
                Upgrade Plan
              </button>
            ) : (
              <button
                className="modern-billing-btn secondary"
                onClick={handleManageSubscription}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <>
                    <div className="modern-btn-spinner"></div>
                    Loading...
                  </>
                ) : (
                  <>
                    <Icons.settings size={18} />
                    Manage Subscription
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Usage Card */}
        <div className="modern-billing-card">
          <div className="modern-billing-card-header">
            <Icons.barChart size={24} />
            <h3>Usage Statistics</h3>
          </div>

          <div className="modern-usage-stats">
            <div className="modern-usage-numbers">
              <span className="used">{usage?.used || 0}</span>
              <span className="separator">/</span>
              <span className="limit">
                {usage?.limit === -1 ? '∞' : usage?.limit || 5}
              </span>
              <span className="label">resumes today</span>
            </div>

            {usage && usage.limit !== -1 && (
              <div className="modern-usage-progress">
                <div
                  className={`modern-usage-bar ${isAtLimit ? 'at-limit' : isNearLimit ? 'near-limit' : ''}`}
                  style={{ width: `${Math.min(usagePercent, 100)}%` }}
                />
              </div>
            )}

            {isAtLimit && subscription?.tier === 'FREE' && (
              <div className="modern-alert modern-alert-warning">
                <Icons.alertCircle size={16} />
                <span>You've reached your daily limit. Upgrade to continue generating resumes.</span>
              </div>
            )}

            {isNearLimit && !isAtLimit && (
              <div className="modern-alert modern-alert-info">
                <Icons.info size={16} />
                <span>You're approaching your daily limit. Consider upgrading for more generations.</span>
              </div>
            )}
          </div>

          {usage?.resetDate && (
            <div className="modern-usage-reset">
              <Icons.refreshCw size={14} />
              <span>Resets on {new Date(usage.resetDate).toLocaleDateString()}</span>
            </div>
          )}
        </div>
      </div>

      {/* Feature Comparison */}
      {subscription?.tier === 'FREE' && (
        <div className="modern-billing-comparison">
          <h3>Upgrade to unlock more features</h3>
          <div className="modern-comparison-grid">
            <div className="modern-comparison-feature">
              <Icons.zap size={20} />
              <span>30 resumes/day with PRO</span>
            </div>
            <div className="modern-comparison-feature">
              <Icons.infinity size={20} />
              <span>Unlimited with UNLIMITED plan</span>
            </div>
            <div className="modern-comparison-feature">
              <Icons.sparkles size={20} />
              <span>Advanced ATS optimization</span>
            </div>
            <div className="modern-comparison-feature">
              <Icons.download size={20} />
              <span>LaTeX export & custom templates</span>
            </div>
          </div>
          <button
            className="modern-billing-btn primary"
            onClick={() => navigate('/pricing')}
          >
            View All Plans
          </button>
        </div>
      )}
    </div>
  );
}
