import React from 'react';
import { useNavigate } from 'react-router-dom';
import Icons from '../components/ui/icons';

export default function CheckoutCancel() {
  const navigate = useNavigate();

  return (
    <div className="modern-checkout-page">
      <div className="modern-checkout-container">
        <div className="modern-checkout-cancel">
          <div className="modern-cancel-icon-large">
            <Icons.x size={80} />
          </div>

          <h1>Payment Cancelled</h1>
          <p className="modern-checkout-subtitle">
            No charges have been made. Your subscription remains unchanged.
          </p>

          <div className="modern-checkout-info">
            <Icons.info size={20} />
            <p>
              If you encountered any issues during checkout, please contact our support team
              or try again later.
            </p>
          </div>

          <div className="modern-checkout-actions">
            <button
              className="modern-checkout-btn primary"
              onClick={() => navigate('/pricing')}
            >
              <Icons.arrowLeft size={18} />
              Back to Pricing
            </button>

            <button
              className="modern-checkout-btn secondary"
              onClick={() => navigate('/dashboard')}
            >
              <Icons.home size={18} />
              Go to Dashboard
            </button>
          </div>

          <div className="modern-checkout-help">
            <p>Need help?</p>
            <a href="mailto:support@resumegen.com" className="modern-checkout-link">
              <Icons.mail size={16} />
              Contact Support
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
