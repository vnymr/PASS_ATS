import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Icons from '../components/ui/icons';

export default function CheckoutSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate('/dashboard');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [navigate]);

  const sessionId = searchParams.get('session_id');

  return (
    <div className="modern-checkout-page">
      <div className="modern-checkout-container">
        <div className="modern-checkout-success">
          <div className="modern-success-icon-large">
            <Icons.checkCircle size={80} />
          </div>

          <h1>Payment Successful!</h1>
          <p className="modern-checkout-subtitle">
            Welcome to your upgraded plan. You now have access to all premium features.
          </p>

          <div className="modern-checkout-features">
            <div className="modern-checkout-feature">
              <Icons.zap size={24} />
              <span>More resume generations</span>
            </div>
            <div className="modern-checkout-feature">
              <Icons.sparkles size={24} />
              <span>Advanced ATS optimization</span>
            </div>
            <div className="modern-checkout-feature">
              <Icons.shield size={24} />
              <span>Priority support</span>
            </div>
          </div>

          <div className="modern-checkout-redirect">
            <p>Redirecting to dashboard in {countdown} seconds...</p>
            <div className="modern-countdown-bar">
              <div
                className="modern-countdown-fill"
                style={{ width: `${(countdown / 5) * 100}%` }}
              />
            </div>
          </div>

          <button
            className="modern-checkout-btn primary"
            onClick={() => navigate('/dashboard')}
          >
            <Icons.home size={18} />
            Go to Dashboard Now
          </button>

          {sessionId && (
            <p className="modern-checkout-session">
              Transaction ID: {sessionId.slice(0, 20)}...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
