import React, { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import Icons from './ui/icons';
import { api } from '../api-clerk';

interface UsageData {
  used: number;
  limit: number;
  tier: string;
}

export default function UsageCard() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUsage();
  }, []);

  async function loadUsage() {
    try {
      const token = await getToken();
      const [usageData, subData] = await Promise.all([
        api.get('/api/usage', token || undefined).catch(() => ({ used: 0, limit: 5 })),
        api.get('/api/subscription', token || undefined).catch(() => ({ tier: 'FREE' }))
      ]);

      setUsage({
        used: usageData.used || 0,
        limit: usageData.limit || 5,
        tier: subData.tier || 'FREE'
      });
    } catch (err) {
      console.error('Failed to load usage:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return null;
  }

  if (!usage) return null;

  const usagePercent = usage.limit === -1 ? 0 : (usage.used / usage.limit) * 100;
  const isNearLimit = usagePercent >= 80;
  const isAtLimit = usagePercent >= 100;

  return (
    <div className={`modern-usage-card ${isAtLimit ? 'at-limit' : isNearLimit ? 'near-limit' : ''}`}>
      <div className="modern-usage-card-header">
        <div className="modern-usage-icon">
          <Icons.barChart size={20} />
        </div>
        <h3>Today's Usage</h3>
      </div>

      <div className="modern-usage-display">
        <div className="modern-usage-count">
          <span className="used">{usage.used}</span>
          <span className="separator">/</span>
          <span className="limit">
            {usage.limit === -1 ? '∞' : usage.limit}
          </span>
        </div>
        <p className="modern-usage-label">resumes generated</p>
      </div>

      {usage.limit !== -1 && (
        <div className="modern-usage-progress-container">
          <div className="modern-usage-progress-bar">
            {(() => {
              const pct = Math.max(0, Math.min(100, Math.round(Math.min(usagePercent, 100))));
              const widthClass = `w-[${pct}%]`;
              return (
                <div
                  className={`modern-usage-fill ${isAtLimit ? 'full' : isNearLimit ? 'warning' : ''} ${widthClass}`}
                />
              );
            })()}
          </div>
        </div>
      )}

      {isAtLimit && usage.tier === 'FREE' && (
        <div className="modern-usage-limit-warning">
          <Icons.alertCircle size={16} />
          <span>Daily limit reached</span>
          <button
            className="modern-usage-upgrade-btn"
            onClick={() => navigate('/pricing')}
          >
            <Icons.zap size={14} />
            Upgrade
          </button>
        </div>
      )}

      {isNearLimit && !isAtLimit && usage.tier === 'FREE' && (
        <div className="modern-usage-warning">
          <Icons.info size={14} />
          <span>Only {usage.limit - usage.used} left today</span>
        </div>
      )}

      {usage.tier === 'FREE' && !isAtLimit && (
        <button
          className="modern-usage-view-plans"
          onClick={() => navigate('/pricing')}
        >
          View Plans
        </button>
      )}
    </div>
  );
}
