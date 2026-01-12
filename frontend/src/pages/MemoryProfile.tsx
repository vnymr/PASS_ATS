import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@clerk/clerk-react';
import Icons from '../components/ui/icons';
import BillingSection from '../components/BillingSection';
import { Tabs } from '../ui/Tabs';
import { MinimalCard, MinimalCardHeader, MinimalCardTitle, MinimalCardDescription, MinimalCardContent } from '../components/MinimalCard';
import MinimalInput from '../components/MinimalInput';
import MinimalTextareaField from '../components/MinimalTextareaField';
import { Button } from '../ui/Button';
import logger from '../utils/logger';
import { motion, AnimatePresence } from 'framer-motion';

// Define the profile type with all fields
type Profile = {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  website?: string;
  summary?: string;
  skills?: string[];
  experiences?: Array<{ company?: string; role?: string; location?: string; dates?: string; bullets?: string[] }>;
  projects?: Array<{ name?: string; summary?: string; bullets?: string[] }>;
  education?: Array<{ institution?: string; degree?: string; location?: string; dates?: string }>;
  resumeText?: string;
  additionalInfo?: string;
};

type TabType = 'personal' | 'summary' | 'skills' | 'experience' | 'additional' | 'resume' | 'accounts' | 'billing';

// Gmail connection status type
type GmailStatus = {
  connected: boolean;
  email?: string;
  isActive?: boolean;
  lastUsed?: string;
  connectedAt?: string;
};

// API base URL
const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8080/api').replace(/\/api$/, '');

export default function MemoryProfile() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [resumeText, setResumeText] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('personal');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [newSkill, setNewSkill] = useState('');
  const [uploadingResume, setUploadingResume] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [autoSaving, setAutoSaving] = useState(false);

  // Gmail connection state
  const [gmailStatus, setGmailStatus] = useState<GmailStatus>({ connected: false });
  const [gmailLoading, setGmailLoading] = useState(false);
  const [gmailConfigured, setGmailConfigured] = useState(true); // Assume configured until checked

  // Form fields for structured profile data
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    location: '',
    linkedin: '',
    website: '',
    summary: '',
    skills: [] as string[],
    experiences: [] as any[],
    projects: [] as any[],
    education: [] as any[]
  });

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      loadProfile();
      loadGmailStatus();
      checkGmailUrlParams();
    } else if (isLoaded && !isSignedIn) {
      setError('Please sign in to view your profile');
      setLoading(false);
    }
  }, [isLoaded, isSignedIn]);

  // Check URL params from Gmail OAuth redirect
  function checkGmailUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const gmailConnected = params.get('gmail_connected');
    const gmailError = params.get('gmail_error');
    const gmailEmail = params.get('email');

    if (gmailConnected === 'true' && gmailEmail) {
      setGmailStatus({ connected: true, email: decodeURIComponent(gmailEmail), isActive: true });
      setSuccess(true);
      setActiveTab('accounts');
      // Clean URL params
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (gmailError) {
      setError(`Gmail connection failed: ${decodeURIComponent(gmailError)}`);
      setActiveTab('accounts');
      // Clean URL params
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }

  // Load Gmail connection status
  async function loadGmailStatus() {
    try {
      const token = await getToken();
      if (!token) return;

      // Check if Gmail is configured on server
      const configResponse = await fetch(`${API_URL}/api/gmail/configured`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const configData = await configResponse.json();
      setGmailConfigured(configData.configured);

      if (!configData.configured) return;

      // Get connection status
      const statusResponse = await fetch(`${API_URL}/api/gmail/status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const statusData = await statusResponse.json();
      setGmailStatus(statusData);
    } catch (err) {
      logger.error('Failed to load Gmail status', err);
    }
  }

  // Connect Gmail
  async function connectGmail() {
    setGmailLoading(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_URL}/api/gmail/auth-url`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();

      if (data.authUrl) {
        // Redirect to Google OAuth
        window.location.href = data.authUrl;
      } else {
        throw new Error(data.error || 'Failed to get auth URL');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to connect Gmail');
      setGmailLoading(false);
    }
  }

  // Disconnect Gmail
  async function disconnectGmail() {
    setGmailLoading(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_URL}/api/gmail/disconnect`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();

      if (data.success) {
        setGmailStatus({ connected: false });
        setSuccess(true);
      } else {
        throw new Error(data.error || 'Failed to disconnect Gmail');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to disconnect Gmail');
    } finally {
      setGmailLoading(false);
    }
  }

  useEffect(() => {
    logger.debug('[RUNTIME] Mounted: MemoryProfile');
  }, []);

  // Auto-dismiss error and success messages after 3 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Auto-save when form data changes (debounced to 2 seconds)
  useEffect(() => {
    // Skip auto-save if we're already saving or loading
    if (saving || loading) return;

    // Clear existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Set new timeout for auto-save (2 seconds after user stops typing)
    autoSaveTimeoutRef.current = setTimeout(() => {
      autoSave();
    }, 2000);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [formData, additionalInfo, resumeText]);

  async function autoSave() {
    // Skip if no data to save
    if (!formData.name && !formData.email && !additionalInfo && !resumeText) {
      return;
    }

    setAutoSaving(true);

    try {
      const token = await getToken();
      if (!token) return;

      const profileData = {
        ...formData,
        additionalInfo,
        resumeText
      };

      await fetch(`${API_URL}/api/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(profileData)
      });
    } catch (err) {
      // Silent fail for auto-save
    } finally {
      setAutoSaving(false);
    }
  }

  async function loadProfile() {
    try {
      const token = await getToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      const response = await fetch(`${API_URL}/api/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 404) {
        // Profile doesn't exist yet, that's okay
        logger.info('No profile found, user can create one');
        setLoading(false);
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch profile');
      }

      const data = await response.json();
      logger.info('Loaded profile data', { hasProfile: !!data });

      if (data) {
        setProfile(data);

        // Helper function to extract skills from different formats
        const extractSkills = (skills: any): string[] => {
          if (Array.isArray(skills)) {
            return skills;
          } else if (typeof skills === 'object' && skills !== null) {
            // If skills is an object with categories, flatten all values
            const allSkills: string[] = [];
            Object.values(skills).forEach((category: any) => {
              if (Array.isArray(category)) {
                allSkills.push(...category);
              }
            });
            return allSkills;
          }
          return [];
        };

        // Populate form data with structured fields
        const formDataToSet = {
          name: data.name || '',
          email: data.email || '',
          phone: data.phone || '',
          location: data.location || '',
          linkedin: data.linkedin || '',
          website: data.website || '',
          summary: data.summary || '',
          skills: extractSkills(data.skills),
          experiences: Array.isArray(data.experiences) ? data.experiences : [],
          projects: Array.isArray(data.projects) ? data.projects : [],
          education: Array.isArray(data.education) ? data.education : []
        };

        logger.debug('Setting form data', { skillsCount: formDataToSet.skills.length, experiencesCount: formDataToSet.experiences.length });
        setFormData(formDataToSet);

        // Set additional info if it exists
        if (data.additionalInfo) {
          setAdditionalInfo(data.additionalInfo as string);
        }

        // Set resume text if it exists
        if (data.resumeText) {
          setResumeText(data.resumeText as string);
        }
      }
    } catch (err) {
      logger.error('Failed to load profile', err);
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  }

  async function handleResumeUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    if (!allowedTypes.includes(file.type)) {
      setError('Please upload a PDF, DOCX, or TXT file');
      return;
    }

    setUploadingResume(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      const formData = new FormData();
      formData.append('resume', file);

      const response = await fetch(`${API_URL}/api/parse-resume`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to parse resume');
      }

      const { extractedData, resumeText } = await response.json();

      // Auto-fill the form fields with extracted data
      setFormData(prev => ({
        ...prev,
        name: extractedData.name || prev.name,
        email: extractedData.email || prev.email,
        phone: extractedData.phone || prev.phone,
        location: extractedData.location || prev.location,
        linkedin: extractedData.linkedin || prev.linkedin,
        website: extractedData.website || prev.website,
        summary: extractedData.summary || prev.summary,
        skills: extractedData.skills?.length > 0 ? extractedData.skills : prev.skills,
        experiences: extractedData.experience?.length > 0 ?
          extractedData.experience.map((exp: any) => ({
            company: exp.company,
            role: exp.title,
            location: exp.location,
            dates: `${exp.startDate} - ${exp.endDate}`,
            bullets: exp.description ? [exp.description] : []
          })) : prev.experiences,
        education: extractedData.education?.length > 0 ?
          extractedData.education.map((edu: any) => ({
            institution: edu.institution,
            degree: `${edu.degree} in ${edu.field}`,
            location: '',
            dates: edu.graduationDate
          })) : prev.education,
        projects: extractedData.projects?.length > 0 ?
          extractedData.projects.map((proj: any) => ({
            name: proj.name,
            summary: proj.description,
            bullets: proj.technologies || []
          })) : prev.projects
      }));

      // Set resume text
      if (resumeText) {
        setResumeText(resumeText);
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      logger.error('Failed to parse resume', err);
      setError('Failed to parse resume. You can still fill in the information manually.');
    } finally {
      setUploadingResume(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const token = await getToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      // Combine all data
      const profileData = {
        ...formData,
        additionalInfo,
        resumeText
      };

      const response = await fetch(`${API_URL}/api/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(profileData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        logger.error('Profile save error', { status: response.status, error: errorData });
        throw new Error(errorData.error || 'Failed to update profile');
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      logger.error('Failed to save profile', err);
      setError('Failed to save profile');
    } finally {
      setSaving(false);
    }
  }

  function addSkill() {
    if (newSkill.trim() && !formData.skills.includes(newSkill.trim())) {
      setFormData({
        ...formData,
        skills: [...formData.skills, newSkill.trim()]
      });
      setNewSkill('');
    }
  }

  function removeSkill(skill: string) {
    setFormData({
      ...formData,
      skills: formData.skills.filter(s => s !== skill)
    });
  }

  if (!isLoaded) {
    return (
      <div className="modern-profile-loading">
        <div className="modern-profile-spinner">
          <div className="modern-profile-spinner-inner"></div>
        </div>
        <p className="modern-profile-loading-text">Initializing...</p>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="modern-profile-error">
        <Icons.alertCircle size={48} />
        <h2>Authentication Required</h2>
        <p>Please sign in to access your profile</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="modern-profile-loading">
        <div className="modern-profile-spinner">
          <div className="modern-profile-spinner-inner"></div>
        </div>
        <p className="modern-profile-loading-text">Loading your profile...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full bg-background min-h-screen text-text font-sans">
      {/* Minimalist Header */}
      <div className="w-full">
        <div className="max-w-[780px] mx-auto px-8 py-8">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            className="mb-6"
          >
            <motion.h1
              initial={{ fontSize: '24px' }}
              style={{
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
                fontWeight: 500,
                color: 'var(--text-900)',
                letterSpacing: '-0.01em',
                marginBottom: '8px'
              }}
            >
              Your Profile
            </motion.h1>
            <p
              className="text-sm"
              style={{
                color: 'var(--text-600)',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
              }}
            >
              {autoSaving ? 'Auto-saving...' : 'Manage your professional information'}
            </p>
          </motion.div>
        </div>
      </div>

      {/* Content Area */}
      <div className="max-w-[780px] mx-auto px-8 pb-8">
        {/* Status Messages */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 flex items-center gap-2 rounded-xl border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.08)] px-4 py-3 text-[13px] text-[#b91c1c]"
            >
              <Icons.alertCircle size={18} />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {success && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 flex items-center gap-2 rounded-xl border border-[rgba(34,197,94,0.35)] bg-[rgba(34,197,94,0.08)] px-4 py-3 text-[13px] text-[#166534]"
            >
              <Icons.checkCircle size={18} />
              <span>Profile saved successfully!</span>
            </motion.div>
          )}
        </AnimatePresence>

      <Tabs
        value={activeTab}
        onChange={(t) => setActiveTab(t)}
        tabs={[
          { value: 'personal', label: 'Personal' },
          { value: 'summary', label: 'Summary' },
          { value: 'skills', label: 'Skills' },
          { value: 'experience', label: 'Experience' },
          { value: 'additional', label: 'Notes' },
          { value: 'resume', label: 'Resume' },
          { value: 'accounts', label: 'Accounts' },
          { value: 'billing', label: 'Billing' },
        ]}
        className="mb-6"
      />

      {activeTab === 'personal' && (
        <MinimalCard>
          <MinimalCardHeader>
            <MinimalCardTitle>Personal</MinimalCardTitle>
            <MinimalCardDescription>Your basic contact details</MinimalCardDescription>
          </MinimalCardHeader>
          <MinimalCardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <MinimalInput
                label="Full Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="John Doe"
              />
              <MinimalInput
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="john.doe@example.com"
              />
              <MinimalInput
                label="Phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+1 (555) 123-4567"
              />
              <MinimalInput
                label="Location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="San Francisco, CA"
              />
              <MinimalInput
                label="LinkedIn"
                value={formData.linkedin}
                onChange={(e) => setFormData({ ...formData, linkedin: e.target.value })}
                placeholder="https://linkedin.com/in/johndoe"
              />
              <MinimalInput
                label="Website"
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                placeholder="https://johndoe.com"
              />
            </div>
          </MinimalCardContent>
        </MinimalCard>
      )}

      {activeTab === 'summary' && (
        <MinimalCard>
          <MinimalCardHeader>
            <MinimalCardTitle>Professional Summary</MinimalCardTitle>
            <MinimalCardDescription>Brief overview of your professional background and career objectives</MinimalCardDescription>
          </MinimalCardHeader>
          <MinimalCardContent>
            <MinimalTextareaField
              label="Summary"
              value={formData.summary}
              onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
              placeholder="Write a compelling summary of your professional experience, key achievements, technical skills, and career objectives."
              rows={12}
            />
            <div className="mt-3 flex items-center gap-2 text-sm" style={{ color: 'var(--text-600)' }}>
              <Icons.info size={14} />
              <span>Tip: Write 3-5 sentences highlighting your experience, skills, and what makes you unique.</span>
            </div>
          </MinimalCardContent>
        </MinimalCard>
      )}

      {activeTab === 'skills' && (
        <MinimalCard>
          <MinimalCardHeader>
            <MinimalCardTitle>Skills & Expertise</MinimalCardTitle>
            <MinimalCardDescription>Your technical and professional skills</MinimalCardDescription>
          </MinimalCardHeader>
          <MinimalCardContent>
            <div className="flex gap-2">
              <MinimalInput
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addSkill()}
                placeholder="Add a skill..."
              />
              <Button onClick={addSkill} variant="outline">
                <Icons.plus size={18} />
                Add
              </Button>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {formData.skills.map((skill) => (
                <span
                  key={skill}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-all duration-200 hover:bg-[var(--text-100)]"
                  style={{
                    backgroundColor: 'var(--text-50)',
                    color: 'var(--text-900)',
                    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
                  }}
                >
                  {skill}
                  <button
                    onClick={() => removeSkill(skill)}
                    aria-label={`Remove ${skill}`}
                    className="transition-colors duration-200"
                    style={{ color: 'var(--text-500)' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-700)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-500)'}
                  >
                    <Icons.x size={14} />
                  </button>
                </span>
              ))}
              {formData.skills.length === 0 && (
                <p className="text-sm" style={{ color: 'var(--text-600)' }}>
                  No skills added yet. Start adding your skills above or upload a resume to auto-fill.
                </p>
              )}
            </div>
          </MinimalCardContent>
        </MinimalCard>
      )}

      {activeTab === 'experience' && (
        <MinimalCard>
          <MinimalCardHeader>
            <MinimalCardTitle>Work Experience</MinimalCardTitle>
            <MinimalCardDescription>Your professional work history</MinimalCardDescription>
          </MinimalCardHeader>
          <MinimalCardContent>
            <div className="flex flex-col gap-6">
              {formData.experiences.map((exp, index) => (
                <div key={index} className="pb-6" style={{ borderBottom: index < formData.experiences.length - 1 ? '1px solid var(--text-100)' : 'none' }}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold" style={{ color: 'var(--text-900)', fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif' }}>
                        {exp.role}
                      </h3>
                      <p className="text-sm mt-0.5" style={{ color: 'var(--text-600)' }}>{exp.company}</p>
                    </div>
                    <div className="text-sm" style={{ color: 'var(--text-500)' }}>{exp.dates}</div>
                  </div>
                  {exp.location && <div className="text-xs mb-2" style={{ color: 'var(--text-500)' }}>{exp.location}</div>}
                  {exp.bullets && exp.bullets.length > 0 && (
                    <ul className="mt-3 space-y-1.5 list-disc pl-5 text-sm" style={{ color: 'var(--text-700)' }}>
                      {exp.bullets.map((bullet: string, idx: number) => (
                        <li key={idx}>{bullet}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
              {formData.experiences.length === 0 && (
                <p className="text-sm" style={{ color: 'var(--text-600)' }}>
                  No experiences added yet. Upload a resume to auto-fill your work history.
                </p>
              )}
            </div>
          </MinimalCardContent>
        </MinimalCard>
      )}

      {activeTab === 'additional' && (
        <MinimalCard>
          <MinimalCardHeader>
            <MinimalCardTitle>Additional Information</MinimalCardTitle>
            <MinimalCardDescription>Any other relevant details or notes</MinimalCardDescription>
          </MinimalCardHeader>
          <MinimalCardContent>
            <MinimalTextareaField
              label="Additional Information"
              value={additionalInfo}
              onChange={(e) => setAdditionalInfo(e.target.value)}
              placeholder="Add any additional information, certifications, awards, or notes..."
              rows={10}
            />
          </MinimalCardContent>
        </MinimalCard>
      )}

      {activeTab === 'resume' && (
        <MinimalCard>
          <MinimalCardHeader>
            <MinimalCardTitle>Resume Text</MinimalCardTitle>
            <MinimalCardDescription>Raw text content of your resume</MinimalCardDescription>
          </MinimalCardHeader>
          <MinimalCardContent>
            <MinimalTextareaField
              label="Resume Content"
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              placeholder="Paste your resume content here or upload a file to auto-fill..."
              rows={16}
              className="font-mono"
            />
          </MinimalCardContent>
        </MinimalCard>
      )}

      {activeTab === 'accounts' && (
        <MinimalCard>
          <MinimalCardHeader>
            <MinimalCardTitle>Connected Accounts</MinimalCardTitle>
            <MinimalCardDescription>Connect your email for auto-apply verification</MinimalCardDescription>
          </MinimalCardHeader>
          <MinimalCardContent>
            <div className="space-y-6">
              {/* Gmail Connection */}
              <div className="flex items-start gap-4 p-4 rounded-lg" style={{ backgroundColor: 'var(--text-50)', border: '1px solid var(--text-100)' }}>
                <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: gmailStatus.connected ? 'rgba(34, 197, 94, 0.1)' : 'var(--text-100)' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M22 6C22 4.9 21.1 4 20 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6ZM20 6L12 11L4 6H20ZM20 18H4V8L12 13L20 8V18Z" fill={gmailStatus.connected ? '#22c55e' : '#6b7280'}/>
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium" style={{ color: 'var(--text-900)' }}>Gmail</h3>
                    {gmailStatus.connected && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#16a34a' }}>
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                        Connected
                      </span>
                    )}
                  </div>
                  <p className="text-sm mt-1" style={{ color: 'var(--text-600)' }}>
                    {gmailStatus.connected
                      ? `Connected as ${gmailStatus.email}`
                      : 'Connect your Gmail to automatically verify job applications during auto-apply'}
                  </p>
                  {gmailStatus.connected && gmailStatus.lastUsed && (
                    <p className="text-xs mt-1" style={{ color: 'var(--text-500)' }}>
                      Last used: {new Date(gmailStatus.lastUsed).toLocaleDateString()}
                    </p>
                  )}
                  {!gmailConfigured && (
                    <p className="text-xs mt-2" style={{ color: '#b91c1c' }}>
                      Gmail integration is not configured on this server. Contact administrator.
                    </p>
                  )}
                </div>
                <div className="flex-shrink-0">
                  {gmailStatus.connected ? (
                    <Button
                      variant="outline"
                      onClick={disconnectGmail}
                      disabled={gmailLoading}
                      className="text-sm"
                    >
                      {gmailLoading ? (
                        <Icons.loader className="animate-spin" size={16} />
                      ) : (
                        'Disconnect'
                      )}
                    </Button>
                  ) : (
                    <Button
                      onClick={connectGmail}
                      disabled={gmailLoading || !gmailConfigured}
                      className="text-sm"
                    >
                      {gmailLoading ? (
                        <>
                          <Icons.loader className="animate-spin" size={16} />
                          Connecting...
                        </>
                      ) : (
                        <>
                          <Icons.link size={16} />
                          Connect Gmail
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>

              {/* Privacy Notice */}
              <div className="flex items-start gap-3 p-4 rounded-lg" style={{ backgroundColor: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                <Icons.shield size={20} style={{ color: '#3b82f6' }} />
                <div>
                  <h4 className="font-medium text-sm" style={{ color: 'var(--text-900)' }}>Privacy & Security</h4>
                  <ul className="text-xs mt-2 space-y-1" style={{ color: 'var(--text-600)' }}>
                    <li>We only read emails from job application senders (Greenhouse, Lever, etc.)</li>
                    <li>We never store your email content - only extract verification codes</li>
                    <li>Access is limited to the last 10 minutes during auto-apply</li>
                    <li>You can disconnect at any time</li>
                  </ul>
                </div>
              </div>
            </div>
          </MinimalCardContent>
        </MinimalCard>
      )}

      {activeTab === 'billing' && <BillingSection />}

      {activeTab !== 'billing' && activeTab !== 'accounts' && (
        <div className="flex items-center gap-3 mt-6">
          <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt" onChange={handleResumeUpload} className="hidden" />
          <Button onClick={() => fileInputRef.current?.click()} variant="outline" disabled={uploadingResume}>
            {uploadingResume ? (
              <>
                <div className="modern-btn-spinner" />
                Parsing...
              </>
            ) : (
              <>
                <Icons.upload size={18} />
                Upload Resume
              </>
            )}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <div className="modern-btn-spinner" />
                Saving...
              </>
            ) : (
              <>
                <Icons.check size={18} />
                Save Profile
              </>
            )}
          </Button>
          {autoSaving && (
            <span className="text-sm text-neutral-600 inline-flex items-center gap-2">
              <Icons.loader className="animate-spin" size={14} />
              Auto-saving...
            </span>
          )}
        </div>
      )}
      </div>
    </div>
  );
}