import React from 'react';

interface ExtensionComingSoonModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ExtensionComingSoonModal({ isOpen, onClose }: ExtensionComingSoonModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        
        <div className="modal-header">
          <div className="rocket-emoji">🚀</div>
          <h2 className="modal-title">Extension Coming Soon!</h2>
        </div>
        
        <div className="modal-body">
          <div className="coming-soon-badge">
            <span className="badge-dot"></span>
            Available at 1,000 users
          </div>
          
          <p className="modal-description">
            We're building something <strong>amazing</strong>! Once we hit 1,000 users, 
            you'll be able to generate resumes in just <span className="highlight">30 seconds</span> 
            with a simple keyboard shortcut.
          </p>
          
          <div className="feature-preview">
            <div className="keyboard-shortcut">
              <kbd>⌘</kbd>
              <kbd>⇧</kbd>
              <kbd>Y</kbd>
              <span className="shortcut-label">= Instant Resume</span>
            </div>
          </div>
          
          <div className="call-to-action">
            <p className="share-message">
              <span className="sparkle">✨</span>
              <strong>Share with your friends</strong> to help us reach 1,000 users faster!
            </p>
            
            <div className="share-buttons">
              <button 
                className="share-btn twitter"
                onClick={() => {
                  const text = "Just discovered this amazing AI resume builder! 🚀 Generate ATS-optimized resumes in 20 seconds. Can't wait for the browser extension! #ResumeBuilder #AI";
                  const url = window.location.origin;
                  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                </svg>
                Share on Twitter
              </button>
              
              <button 
                className="share-btn linkedin"
                onClick={() => {
                  const text = "Just discovered this amazing AI resume builder! Generate ATS-optimized resumes in 20 seconds. Can't wait for the browser extension!";
                  const url = window.location.origin;
                  window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}&summary=${encodeURIComponent(text)}`, '_blank');
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
                Share on LinkedIn
              </button>
            </div>
          </div>
        </div>
        
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onClose}>
            Got it! 🎉
          </button>
        </div>
      </div>
    </div>
  );
}
