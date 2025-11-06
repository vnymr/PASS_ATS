import React from 'react';
import { useNavigate } from 'react-router-dom';
import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from '@clerk/clerk-react';
import logoImg from '../logo.svg';
import { DottedSurface } from '@/components/ui/dotted-surface';
// Removed legacy CSS import in favor of Tailwind

export default function Privacy() {
  const navigate = useNavigate();

  return (
    <>
      <header className="privacy-hero">
        <DottedSurface />

        <nav className="landing-nav" role="navigation" aria-label="Main navigation">
          <div className="nav-container">
            <div className="logo fade-in cursor-pointer" onClick={() => navigate('/') }>
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
          <h1 className="hero-title fade-in-up">Privacy Policy</h1>
          <p className="hero-subtitle fade-in-up">
            Last Updated: January 2025
          </p>
        </div>
      </header>

      <main className="privacy-main">
        <div className="container">
          <div className="privacy-content">

            {/* Introduction */}
            <section className="privacy-section">
              <p className="intro-text">
                At HappyResumes, we take your privacy seriously. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our website and Chrome extension (collectively, the "Service"). Please read this privacy policy carefully. If you do not agree with the terms of this privacy policy, please do not access the Service.
              </p>
            </section>

            {/* Information We Collect */}
            <section className="privacy-section">
              <h2>1. Information We Collect</h2>

              <h3>1.1 Personal Information You Provide</h3>
              <p>We collect information that you voluntarily provide to us when you:</p>
              <ul>
                <li><strong>Register for an account:</strong> Email address, name, and password (managed securely by Clerk authentication)</li>
                <li><strong>Create your profile:</strong> Work experience, education, skills, certifications, and other career-related information</li>
                <li><strong>Generate resumes:</strong> Job descriptions you paste or extract from job sites</li>
                <li><strong>Contact us:</strong> Name, email address, and message content when you reach out for support</li>
              </ul>

              <h3>1.2 Automatically Collected Information</h3>
              <p>When you use our Service, we automatically collect certain information:</p>
              <ul>
                <li><strong>Usage Data:</strong> Pages visited, features used, resume generation timestamps, and Service interaction data</li>
                <li><strong>Device Information:</strong> Browser type, operating system, IP address, and device identifiers</li>
                <li><strong>Chrome Extension Data:</strong> Job site URLs (only when you activate the extension), extension version, and authentication tokens stored locally</li>
              </ul>

              <h3>1.3 Information We Do NOT Collect</h3>
              <p>We want to be clear about what we don't collect:</p>
              <ul>
                <li>We do NOT track your browsing history or activity on other websites</li>
                <li>We do NOT access your browser data unless you explicitly activate our extension on a job posting</li>
                <li>We do NOT collect sensitive personal information (race, religion, health data, etc.)</li>
                <li>We do NOT use cookies for advertising or tracking purposes</li>
              </ul>
            </section>

            {/* How We Use Your Information */}
            <section className="privacy-section">
              <h2>2. How We Use Your Information</h2>
              <p>We use the information we collect to:</p>
              <ul>
                <li><strong>Provide the Service:</strong> Generate AI-optimized resumes, store your profile, and manage your account</li>
                <li><strong>Improve the Service:</strong> Analyze usage patterns to enhance features, fix bugs, and optimize performance</li>
                <li><strong>Communicate with you:</strong> Send service updates, respond to support requests, and provide customer service</li>
                <li><strong>Security and fraud prevention:</strong> Protect against unauthorized access, maintain data security, and prevent abuse</li>
                <li><strong>Legal compliance:</strong> Comply with applicable laws, regulations, and legal processes</li>
              </ul>
              <p className="emphasis">
                We will NEVER sell your personal information to third parties or use it for purposes other than those described in this policy without your explicit consent.
              </p>
            </section>

            {/* How We Share Your Information */}
            <section className="privacy-section">
              <h2>3. How We Share Your Information</h2>
              <p>We may share your information only in the following circumstances:</p>

              <h3>3.1 Service Providers</h3>
              <ul>
                <li><strong>Authentication:</strong> Clerk (for secure user authentication and session management)</li>
                <li><strong>AI Processing:</strong> OpenAI (for resume generation - only job descriptions and your profile data)</li>
                <li><strong>Hosting:</strong> Railway (for secure cloud infrastructure)</li>
                <li><strong>Database:</strong> PostgreSQL on Railway (for storing your profile and resume history)</li>
              </ul>
              <p>All service providers are contractually obligated to protect your data and use it only for providing services to us.</p>

              <h3>3.2 Legal Requirements</h3>
              <p>We may disclose your information if required by law, court order, or legal process, or to:</p>
              <ul>
                <li>Comply with legal obligations</li>
                <li>Protect our rights, property, or safety</li>
                <li>Prevent fraud or security issues</li>
                <li>Respond to government requests</li>
              </ul>

              <h3>3.3 Business Transfers</h3>
              <p>If HappyResumes is involved in a merger, acquisition, or asset sale, your information may be transferred. We will notify you before your information is transferred and becomes subject to a different privacy policy.</p>
            </section>

            {/* Data Retention */}
            <section className="privacy-section">
              <h2>4. Data Retention</h2>
              <p>We retain your information for as long as necessary to provide the Service and fulfill the purposes outlined in this policy:</p>
              <ul>
                <li><strong>Account Information:</strong> Retained until you delete your account</li>
                <li><strong>Generated Resumes:</strong> Stored for 30 days, then automatically deleted (unless you manually delete them sooner)</li>
                <li><strong>Profile Data:</strong> Retained until you delete your account</li>
                <li><strong>Usage Logs:</strong> Retained for 90 days for security and analytics purposes</li>
              </ul>
              <p>After account deletion, all your personal data is permanently removed from our systems within 30 days, except where we are required to retain it for legal compliance.</p>
            </section>

            {/* Your Privacy Rights */}
            <section className="privacy-section">
              <h2>5. Your Privacy Rights</h2>
              <p>Depending on your location, you may have the following rights:</p>

              <h3>5.1 For All Users</h3>
              <ul>
                <li><strong>Access:</strong> Request a copy of your personal data</li>
                <li><strong>Correction:</strong> Update or correct inaccurate information via your profile settings</li>
                <li><strong>Deletion:</strong> Request deletion of your account and all associated data</li>
                <li><strong>Download:</strong> Export your profile data and resume history</li>
              </ul>

              <h3>5.2 California Residents (CCPA/CPRA Rights)</h3>
              <p>If you are a California resident, you have additional rights:</p>
              <ul>
                <li><strong>Right to Know:</strong> Request details about the categories and specific pieces of personal information we collect</li>
                <li><strong>Right to Delete:</strong> Request deletion of your personal information (with certain exceptions)</li>
                <li><strong>Right to Opt-Out:</strong> We do not sell personal information, so there is nothing to opt out of</li>
                <li><strong>Right to Non-Discrimination:</strong> We will not discriminate against you for exercising your privacy rights</li>
              </ul>

              <h3>5.3 European Residents (GDPR Rights)</h3>
              <p>If you are in the European Economic Area (EEA), UK, or Switzerland, you have rights under GDPR:</p>
              <ul>
                <li><strong>Right to Access:</strong> Obtain confirmation of data processing and access to your data</li>
                <li><strong>Right to Rectification:</strong> Correct inaccurate or incomplete data</li>
                <li><strong>Right to Erasure:</strong> Request deletion ("right to be forgotten")</li>
                <li><strong>Right to Restriction:</strong> Limit how we use your data</li>
                <li><strong>Right to Data Portability:</strong> Receive your data in a structured, machine-readable format</li>
                <li><strong>Right to Object:</strong> Object to processing based on legitimate interests</li>
                <li><strong>Right to Withdraw Consent:</strong> Withdraw consent at any time (does not affect prior processing)</li>
              </ul>

              <h3>5.4 How to Exercise Your Rights</h3>
              <p>To exercise any of these rights, please contact us at <a href="mailto:privacy@happyresumes.com">privacy@happyresumes.com</a>. We will respond to your request within 30 days (or as required by applicable law).</p>
            </section>

            {/* Data Security */}
            <section className="privacy-section">
              <h2>6. Data Security</h2>
              <p>We implement industry-standard security measures to protect your information:</p>
              <ul>
                <li><strong>Encryption:</strong> All data transmitted between your browser and our servers uses HTTPS/TLS encryption</li>
                <li><strong>Authentication:</strong> Secure authentication via Clerk with industry-standard protocols</li>
                <li><strong>Access Controls:</strong> Limited access to personal data on a need-to-know basis</li>
                <li><strong>Regular Security Audits:</strong> Ongoing monitoring and security assessments</li>
                <li><strong>Secure Infrastructure:</strong> Data stored on secure, encrypted servers</li>
              </ul>
              <p className="emphasis">
                However, no method of transmission over the internet is 100% secure. While we strive to use commercially acceptable means to protect your data, we cannot guarantee absolute security.
              </p>
            </section>

            {/* Chrome Extension Specific */}
            <section className="privacy-section">
              <h2>7. Chrome Extension Privacy</h2>
              <p>Our Chrome extension is designed with privacy in mind:</p>

              <h3>7.1 What the Extension Accesses</h3>
              <ul>
                <li><strong>Job Posting Pages Only:</strong> The extension only activates when you click the button on a job posting</li>
                <li><strong>Authentication Sync:</strong> Syncs your login token from happyresumes.com to enable seamless resume generation</li>
                <li><strong>Local Storage:</strong> Stores authentication tokens securely in your browser's local storage</li>
              </ul>

              <h3>7.2 What the Extension Does NOT Do</h3>
              <ul>
                <li>Does NOT track your browsing history</li>
                <li>Does NOT access data from other websites or tabs</li>
                <li>Does NOT run in the background unless you activate it</li>
                <li>Does NOT collect or transmit data without your explicit action</li>
              </ul>

              <h3>7.3 Required Permissions Explained</h3>
              <ul>
                <li><strong>activeTab:</strong> Access the current job page content when you click the extension button</li>
                <li><strong>storage:</strong> Store your authentication token and preferences locally</li>
                <li><strong>downloads:</strong> Download generated resume PDFs to your computer</li>
                <li><strong>notifications:</strong> Show status updates during resume generation</li>
              </ul>
            </section>

            {/* Children's Privacy */}
            <section className="privacy-section">
              <h2>8. Children's Privacy</h2>
              <p>
                Our Service is not intended for children under the age of 16. We do not knowingly collect personal information from children under 16. If you are a parent or guardian and believe your child has provided us with personal information, please contact us at <a href="mailto:privacy@happyresumes.com">privacy@happyresumes.com</a>, and we will delete such information.
              </p>
            </section>

            {/* International Data Transfers */}
            <section className="privacy-section">
              <h2>9. International Data Transfers</h2>
              <p>
                Your information may be transferred to and processed in countries other than your country of residence, including the United States. These countries may have different data protection laws than your country.
              </p>
              <p>
                When we transfer your data internationally, we ensure appropriate safeguards are in place, such as standard contractual clauses approved by the European Commission for transfers from the EEA.
              </p>
            </section>

            {/* Third-Party Links */}
            <section className="privacy-section">
              <h2>10. Third-Party Links</h2>
              <p>
                Our Service may contain links to third-party websites or services (e.g., job sites you visit). We are not responsible for the privacy practices of these third parties. We encourage you to read their privacy policies.
              </p>
            </section>

            {/* Do Not Track */}
            <section className="privacy-section">
              <h2>11. Do Not Track Signals</h2>
              <p>
                We do not track users across third-party websites and therefore do not respond to Do Not Track (DNT) signals. Our extension only activates when you explicitly use it on a job posting page.
              </p>
            </section>

            {/* Changes to This Policy */}
            <section className="privacy-section">
              <h2>12. Changes to This Privacy Policy</h2>
              <p>
                We may update this Privacy Policy from time to time. We will notify you of any material changes by:
              </p>
              <ul>
                <li>Posting the new Privacy Policy on this page</li>
                <li>Updating the "Last Updated" date at the top of this policy</li>
                <li>Sending you an email notification (for significant changes)</li>
              </ul>
              <p>
                Your continued use of the Service after changes become effective constitutes acceptance of the updated policy.
              </p>
            </section>

            {/* Contact Us */}
            <section className="privacy-section">
              <h2>13. Contact Us</h2>
              <p>If you have questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:</p>
              <div className="contact-info">
                <p><strong>Email:</strong> <a href="mailto:privacy@happyresumes.com">privacy@happyresumes.com</a></p>
                <p><strong>Support:</strong> <a href="mailto:support@happyresumes.com">support@happyresumes.com</a></p>
                <p><strong>Website:</strong> <a href="https://happyresumes.com" target="_blank" rel="noopener noreferrer">https://happyresumes.com</a></p>
              </div>
            </section>

            {/* Data Processing Lawful Basis */}
            <section className="privacy-section">
              <h2>14. Lawful Basis for Processing (GDPR)</h2>
              <p>For users in the EEA, UK, or Switzerland, we process your personal data based on the following legal grounds:</p>
              <ul>
                <li><strong>Contract Performance:</strong> To provide the Service you requested (resume generation, account management)</li>
                <li><strong>Consent:</strong> When you provide explicit consent for specific processing activities</li>
                <li><strong>Legitimate Interests:</strong> To improve our Service, prevent fraud, and ensure security (where not overridden by your rights)</li>
                <li><strong>Legal Obligations:</strong> To comply with applicable laws and regulations</li>
              </ul>
            </section>

            {/* Summary */}
            <section className="privacy-section highlight-section">
              <h2>Summary: Our Commitment to Your Privacy</h2>
              <ul className="summary-list">
                <li>✅ We only collect data necessary to provide our Service</li>
                <li>✅ We NEVER sell your personal information</li>
                <li>✅ We use industry-standard security measures</li>
                <li>✅ You can access, correct, or delete your data anytime</li>
                <li>✅ Our extension only works when you activate it</li>
                <li>✅ We're transparent about how we use your data</li>
                <li>✅ We comply with GDPR, CCPA, and other privacy laws</li>
              </ul>
            </section>

          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-section">
              <h4>Product</h4>
              <ul>
                <li><a onClick={() => navigate('/happy')}>Chat</a></li>
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
