import React, { useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import Icons from './ui/icons';
import { api } from '../api-clerk';
import logger from '../utils/logger';

interface UpgradeLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  usedCount: number;
  limit: number;
}

export default function UpgradeLimitModal({ isOpen, onClose, usedCount, limit }: UpgradeLimitModalProps) {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  async function handleUpgrade(priceId: string) {
    setLoading(true);

    try {
      const token = await getToken();
      const { sessionUrl } = await api.post('/api/create-checkout-session', { priceId }, token || undefined);
      window.location.href = sessionUrl;
    } catch (err) {
      logger.error('Failed to create checkout session', err);
      setLoading(false);
    }
  }

  function handleViewPlans() {
    onClose();
    window.open('https://happyresumes.com/#pricing', '_blank');
  }

  return (
    <div className="modern-modal-overlay" onClick={onClose}>
      <div className="modern-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modern-modal-close" onClick={onClose} aria-label="Close">
          <Icons.x size={20} />
        </button>

        <div className="modern-limit-modal-header">
          <div className="modern-limit-icon">
            <Icons.alertCircle size={48} />
          </div>
          <h2>Daily Limit Reached</h2>
          <p>You've used all {limit} free resumes today</p>
        </div>

        <div className="modern-limit-usage">
          <div className="modern-limit-progress">
            <div className="modern-limit-bar-full" />
          </div>
          <p className="modern-limit-count">{usedCount} / {limit} resumes used</p>
        </div>

        <div className="modern-limit-options">
          <div className="modern-limit-option pro">
            <div className="modern-limit-option-header">
              <Icons.star size={20} />
              <h3>Upgrade to PRO</h3>
            </div>
            <div className="modern-limit-option-price">
              <span className="price">$10</span>
              <span className="period">/month</span>
            </div>
            <ul className="modern-limit-features">
              <li>
                <Icons.checkCircle size={16} />
                30 resumes per day
              </li>
              <li>
                <Icons.checkCircle size={16} />
                Advanced ATS optimization
              </li>
              <li>
                <Icons.checkCircle size={16} />
                Priority support
              </li>
            </ul>
            <button
              className="modern-limit-btn primary"
              onClick={() => handleUpgrade(import.meta.env.VITE_STRIPE_PRO_PRICE_ID)}
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
                  Upgrade to PRO
                </>
              )}
            </button>
          </div>

          <div className="modern-limit-option unlimited">
            <div className="modern-limit-option-badge">Best Value</div>
            <div className="modern-limit-option-header">
              <Icons.infinity size={20} />
              <h3>Upgrade to UNLIMITED</h3>
            </div>
            <div className="modern-limit-option-price">
              <span className="price">$20</span>
              <span className="period">/month</span>
            </div>
            <ul className="modern-limit-features">
              <li>
                <Icons.checkCircle size={16} />
                Unlimited resumes
              </li>
              <li>
                <Icons.checkCircle size={16} />
                AI cover letters
              </li>
              <li>
                <Icons.checkCircle size={16} />
                Custom templates
              </li>
            </ul>
            <button
              className="modern-limit-btn primary"
              onClick={() => handleUpgrade(import.meta.env.VITE_STRIPE_UNLIMITED_PRICE_ID)}
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
                  Upgrade to UNLIMITED
                </>
              )}
            </button>
          </div>
        </div>

        <div className="modern-limit-footer">
          <button className="modern-limit-link" onClick={handleViewPlans}>
            View all pricing plans
          </button>
          <p className="modern-limit-note">
            Or come back tomorrow for {limit} more free resumes
          </p>
        </div>
      </div>
    </div>
  );
}
