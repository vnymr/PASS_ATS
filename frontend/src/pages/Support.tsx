import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from '@clerk/clerk-react';
import logoImg from '../logo.svg';
import { DottedSurface } from '@/components/ui/dotted-surface';
import './Support.css';

export default function Support() {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const faqs = [
    {
      category: "Getting Started",
      questions: [
        {
          q: "How do I create my first resume?",
          a: "Simply sign up for a free account, complete your profile with your work experience and skills, then paste any job description and click 'Generate Resume'. Your ATS-optimized resume will be ready in 20 seconds."
        },
        {
          q: "Do I need to download anything?",
          a: "No downloads required! HappyResumes works entirely in your browser. However, we do offer a Chrome extension for even faster resume generation directly from job postings."
        },
        {
          q: "Is HappyResumes really free?",
          a: "Yes! Our free tier includes 5 resume generations per month. For unlimited resumes and premium features, check out our Pro plan."
        }
      ]
    },
    {
      category: "Using the Service",
      questions: [
        {
          q: "What is ATS optimization?",
          a: "ATS (Applicant Tracking System) optimization ensures your resume passes the automated screening software used by 99% of Fortune 500 companies. Our AI formats your resume with proper keywords, structure, and formatting to maximize your chances of getting past the bots and reaching human recruiters."
        },
        {
          q: "How does the AI resume builder work?",
          a: "Our AI analyzes the job description you provide, matches it with your profile information, and generates a tailored resume highlighting the most relevant skills and experiences. It automatically optimizes keywords, formats sections, and ensures ATS compatibility."
        },
        {
          q: "Can I edit my generated resume?",
          a: "Currently, resumes are generated as optimized PDFs. We recommend updating your profile information before generating to ensure accuracy. Manual editing features are coming soon!"
        },
        {
          q: "How long does resume generation take?",
          a: "Most resumes are generated in 15-30 seconds. Complex job descriptions with many requirements may take up to 1 minute."
        }
      ]
    },
    {
      category: "Chrome Extension",
      questions: [
        {
          q: "How do I install the Chrome extension?",
          a: "Click 'Download Extension' on our homepage, which will redirect you to the Chrome Web Store. Click 'Add to Chrome' and follow the installation prompts. Once installed, sign in using the same account credentials from our website."
        },
        {
          q: "How does the extension sync with my account?",
          a: "After signing in on happyresumes.com, the extension automatically syncs your authentication. Just stay on the dashboard for 3-5 seconds after signing in, and the extension will be ready to use."
        },
        {
          q: "Which job sites does the extension support?",
          a: "The extension works on LinkedIn, Indeed, Glassdoor, Monster, ZipRecruiter, and 100+ other job sites. It can detect job postings on most career websites automatically."
        },
        {
          q: "What's the keyboard shortcut?",
          a: "Press Alt+Shift+R (Windows/Linux) or ⌘+Shift+Y (Mac) on any job posting page to instantly start resume generation. You can customize this shortcut in chrome://extensions/shortcuts."
        }
      ]
    },
    {
      category: "Account & Billing",
      questions: [
        {
          q: "How do I upgrade to Pro?",
          a: "Go to your Dashboard, click on the 'Billing' or 'Upgrade' button in the navigation menu, and select your preferred plan. We accept all major credit cards."
        },
        {
          q: "Can I cancel my subscription anytime?",
          a: "Yes! You can cancel your Pro subscription at any time from the Billing page. You'll continue to have Pro access until the end of your current billing period."
        },
        {
          q: "What happens if I exceed my free tier limit?",
          a: "Once you've used your 5 free resumes for the month, you'll be prompted to upgrade to Pro for unlimited generations, or wait until the next month when your limit resets."
        }
      ]
    },
    {
      category: "Technical Issues",
      questions: [
        {
          q: "My resume generation failed. What should I do?",
          a: "First, try refreshing the page and generating again. Make sure your profile is complete with at least 2-3 work experiences. If the issue persists, contact us at support@happyresumes.com with the job description you were using."
        },
        {
          q: "The extension isn't detecting jobs. Help!",
          a: "Make sure you've signed in to your HappyResumes account on the website first. Refresh the job posting page after installing the extension. If issues persist, try disabling and re-enabling the extension."
        },
        {
          q: "I'm not receiving my generated resume PDF.",
          a: "Check your browser's download settings and ensure downloads aren't blocked. Look in your browser's download folder. If you still can't find it, go to Dashboard → History to re-download past resumes."
        },
        {
          q: "Why is authentication failing in the extension?",
          a: "Go to happyresumes.com/dashboard, sign in, and wait 5 seconds for the sync. Then click the extension icon and click 'Check Connection'. If it still fails, sign out and sign back in."
        }
      ]
    },
    {
      category: "Privacy & Security",
      questions: [
        {
          q: "Is my data secure?",
          a: "Yes! We use industry-standard encryption (HTTPS), secure authentication via Clerk, and never share your personal information with third parties. Read our Privacy Policy for full details."
        },
        {
          q: "Do you sell my information?",
          a: "Absolutely not. We never sell, rent, or share your personal data with third parties for marketing purposes."
        },
        {
          q: "How long do you keep my resumes?",
          a: "Generated resumes are stored for 30 days in your account history, after which they are automatically deleted. You can manually delete them anytime from your Dashboard."
        }
      ]
    }
  ];

  return (
    <>
      <header className="support-hero">
        <DottedSurface />

        <nav className="landing-nav" role="navigation" aria-label="Main navigation">
          <div className="nav-container">
            <div className="logo fade-in" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
              <img src={logoImg} alt="HappyResumes Logo" className="logo-img" />
            </div>
            <div className="nav-buttons">
              <button className="btn btn-ghost" onClick={() => navigate('/')}>
                Home
              </button>
              <SignedOut>
                <SignInButton mode="modal">
                  <button className="btn btn-ghost">Sign In</button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button className="btn btn-primary">Get Started</button>
                </SignUpButton>
              </SignedOut>
              <SignedIn>
                <UserButton afterSignOutUrl="/" />
              </SignedIn>
            </div>
          </div>
        </nav>

        <div className="hero-content">
          <h1 className="hero-title fade-in-up">
            How can we help you?
          </h1>
          <p className="hero-subtitle fade-in-up">
            Find answers to common questions or reach out to our support team
          </p>
        </div>
      </header>

      <main className="support-main">
        {/* Quick Links Section */}
        <section className="quick-links-section">
          <div className="container">
            <div className="quick-links-grid">
              <div className="quick-link-card" onClick={() => navigate('/dashboard')}>
                <div className="quick-link-icon">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                    <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <h3>Getting Started</h3>
                <p>Learn how to create your first ATS-optimized resume</p>
              </div>

              <a href="https://chromewebstore.google.com" target="_blank" rel="noopener noreferrer" className="quick-link-card">
                <div className="quick-link-icon">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                    <path d="M21 16V8C21 6.89543 20.1046 6 19 6H5C3.89543 6 3 6.89543 3 8V16C3 17.1046 3.89543 18 5 18H19C20.1046 18 21 17.1046 21 16Z" stroke="currentColor" strokeWidth="2"/>
                    <path d="M7 10L12 13L17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <h3>Chrome Extension</h3>
                <p>Install and use our browser extension</p>
              </a>

              <div className="quick-link-card" onClick={() => navigate('/billing')}>
                <div className="quick-link-icon">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="6" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="2"/>
                    <path d="M3 10H21" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                </div>
                <h3>Billing & Plans</h3>
                <p>Manage your subscription and payments</p>
              </div>

              <div className="quick-link-card" onClick={() => navigate('/privacy')}>
                <div className="quick-link-icon">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                    <path d="M12 22C12 22 20 18 20 12V5L12 2L4 5V12C4 18 12 22 12 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <h3>Privacy & Security</h3>
                <p>Learn how we protect your data</p>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="faq-section">
          <div className="container">
            <div className="section-header">
              <h2 className="section-title">Frequently Asked Questions</h2>
              <p className="section-subtitle">Everything you need to know about HappyResumes</p>
            </div>

            {faqs.map((category, catIndex) => (
              <div key={catIndex} className="faq-category">
                <h3 className="faq-category-title">{category.category}</h3>
                <div className="faq-list">
                  {category.questions.map((faq, qIndex) => {
                    const faqIndex = catIndex * 100 + qIndex;
                    return (
                      <div key={qIndex} className="faq-item">
                        <button
                          className={`faq-question ${openFaq === faqIndex ? 'active' : ''}`}
                          onClick={() => toggleFaq(faqIndex)}
                        >
                          <span>{faq.q}</span>
                          <svg
                            width="20"
                            height="20"
                            viewBox="0 0 20 20"
                            fill="none"
                            className={`faq-icon ${openFaq === faqIndex ? 'rotate' : ''}`}
                          >
                            <path
                              d="M5 7.5L10 12.5L15 7.5"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                        {openFaq === faqIndex && (
                          <div className="faq-answer">
                            <p>{faq.a}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Contact Section */}
        <section className="contact-section">
          <div className="container">
            <div className="contact-card">
              <div className="contact-content">
                <h2>Still need help?</h2>
                <p>Can't find the answer you're looking for? Our support team is here to help.</p>
                <div className="contact-methods">
                  <div className="contact-method">
                    <div className="contact-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path d="M4 4H20C21.1 4 22 4.9 22 6V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6C2 4.9 2.9 4 4 4Z" stroke="currentColor" strokeWidth="2"/>
                        <path d="M22 6L12 13L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <div>
                      <h4>Email Support</h4>
                      <a href="mailto:support@happyresumes.com">support@happyresumes.com</a>
                      <p className="response-time">Response within 24 hours</p>
                    </div>
                  </div>

                  <div className="contact-method">
                    <div className="contact-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <div>
                      <h4>Live Chat</h4>
                      <p>Available Mon-Fri, 9am-6pm PST</p>
                      <button className="btn btn-outline btn-small" style={{ marginTop: '8px' }}>
                        Start Chat
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-section">
              <h4>Product</h4>
              <ul>
                <li><a onClick={() => navigate('/dashboard')}>Dashboard</a></li>
                <li><a onClick={() => navigate('/billing')}>Pricing</a></li>
                <li><a href="https://chromewebstore.google.com" target="_blank" rel="noopener noreferrer">Chrome Extension</a></li>
              </ul>
            </div>
            <div className="footer-section">
              <h4>Support</h4>
              <ul>
                <li><a onClick={() => navigate('/support')}>Help Center</a></li>
                <li><a href="mailto:support@happyresumes.com">Contact Us</a></li>
              </ul>
            </div>
            <div className="footer-section">
              <h4>Legal</h4>
              <ul>
                <li><a onClick={() => navigate('/privacy')}>Privacy Policy</a></li>
                <li><a onClick={() => navigate('/terms')}>Terms of Service</a></li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; 2025 HappyResumes. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </>
  );
}
