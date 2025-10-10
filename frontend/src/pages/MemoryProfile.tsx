import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@clerk/clerk-react';
import Icons from '../components/ui/icons';
import BillingSection from '../components/BillingSection';

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

type TabType = 'personal' | 'summary' | 'skills' | 'experience' | 'additional' | 'resume' | 'billing';

// API base URL
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

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
    } else if (isLoaded && !isSignedIn) {
      setError('Please sign in to view your profile');
      setLoading(false);
    }
  }, [isLoaded, isSignedIn]);

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
        console.log('No profile found, user can create one');
        setLoading(false);
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch profile');
      }

      const data = await response.json();
      console.log('🔍 Loaded profile data:', data);

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

        console.log('📝 Setting form data:', formDataToSet);
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
      console.error('Failed to load profile:', err);
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
      console.error('Failed to parse resume:', err);
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
        console.error('Profile save error:', response.status, errorData);
        throw new Error(errorData.error || 'Failed to update profile');
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save profile:', err);
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
    <>
      {/* Toast Notifications */}
      {(error || success) && (
        <div className="toast-container">
          {error && (
            <div className="toast error">
              <div className="toast-icon">✕</div>
              <div className="toast-message">{error}</div>
            </div>
          )}
          {success && (
            <div className="toast success">
              <div className="toast-icon">✓</div>
              <div className="toast-message">Profile saved successfully!</div>
            </div>
          )}
        </div>
      )}

      {/* Sidebar Layout */}
      <div className="profile-layout">
        {/* Sidebar Navigation */}
        <aside className="profile-sidebar">
          <nav className="profile-sidebar-nav">
            <button
              className={`profile-sidebar-item ${activeTab === 'personal' ? 'active' : ''}`}
              onClick={() => setActiveTab('personal')}
            >
              <Icons.user size={18} />
              <span>Personal</span>
            </button>
            <button
              className={`profile-sidebar-item ${activeTab === 'summary' ? 'active' : ''}`}
              onClick={() => setActiveTab('summary')}
            >
              <Icons.fileText size={18} />
              <span>Summary</span>
            </button>
            <button
              className={`profile-sidebar-item ${activeTab === 'skills' ? 'active' : ''}`}
              onClick={() => setActiveTab('skills')}
            >
              <Icons.award size={18} />
              <span>Skills</span>
            </button>
            <button
              className={`profile-sidebar-item ${activeTab === 'experience' ? 'active' : ''}`}
              onClick={() => setActiveTab('experience')}
            >
              <Icons.briefcase size={18} />
              <span>Experience</span>
            </button>
            <button
              className={`profile-sidebar-item ${activeTab === 'additional' ? 'active' : ''}`}
              onClick={() => setActiveTab('additional')}
            >
              <Icons.fileText size={18} />
              <span>Notes</span>
            </button>
            <button
              className={`profile-sidebar-item ${activeTab === 'resume' ? 'active' : ''}`}
              onClick={() => setActiveTab('resume')}
            >
              <Icons.file size={18} />
              <span>Resume</span>
            </button>
            <button
              className={`profile-sidebar-item ${activeTab === 'billing' ? 'active' : ''}`}
              onClick={() => setActiveTab('billing')}
            >
              <Icons.creditCard size={18} />
              <span>Billing</span>
            </button>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="profile-main">

        {/* Tab Content */}
        <div className="modern-profile-content">
          {activeTab === 'personal' ? (
            <div className="profile-section">
              <h1 className="profile-section-title">Personal</h1>
              <p className="profile-section-subtitle">Your basic contact details</p>

              <div className="profile-form-grid">
                <div className="profile-form-field">
                  <label className="profile-form-label">Full Name</label>
                  <input
                    type="text"
                    className="profile-form-input"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="John Doe"
                  />
                </div>

                <div className="profile-form-field">
                  <label className="profile-form-label">Email</label>
                  <input
                    type="email"
                    className="profile-form-input"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    placeholder="john.doe@example.com"
                  />
                </div>

                <div className="profile-form-field">
                  <label className="profile-form-label">Phone</label>
                  <input
                    type="tel"
                    className="profile-form-input"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    placeholder="+1 (555) 123-4567"
                  />
                </div>

                <div className="profile-form-field">
                  <label className="profile-form-label">Location</label>
                  <input
                    type="text"
                    className="profile-form-input"
                    value={formData.location}
                    onChange={(e) => setFormData({...formData, location: e.target.value})}
                    placeholder="San Francisco, CA"
                  />
                </div>

                <div className="profile-form-field">
                  <label className="profile-form-label">LinkedIn</label>
                  <input
                    type="url"
                    className="profile-form-input"
                    value={formData.linkedin}
                    onChange={(e) => setFormData({...formData, linkedin: e.target.value})}
                    placeholder="https://linkedin.com/in/johndoe"
                  />
                </div>

                <div className="profile-form-field">
                  <label className="profile-form-label">Website</label>
                  <input
                    type="url"
                    className="profile-form-input"
                    value={formData.website}
                    onChange={(e) => setFormData({...formData, website: e.target.value})}
                    placeholder="https://johndoe.com"
                  />
                </div>
              </div>
            </div>
          ) : activeTab === 'summary' ? (
            <div className="profile-section">
              <h1 className="profile-section-title">Professional Summary</h1>
              <p className="profile-section-subtitle">Brief overview of your professional background and career objectives</p>

              <div className="profile-form-field full-width">
                <label className="profile-form-label">Summary</label>
                <textarea
                  className="profile-form-textarea"
                  value={formData.summary}
                  onChange={(e) => setFormData({...formData, summary: e.target.value})}
                  placeholder="Write a compelling summary of your professional experience, key achievements, technical skills, and career objectives. This summary will be tailored for each job application.

Example: Experienced Software Engineer with 5+ years of expertise in full-stack development, specializing in React, Node.js, and cloud technologies. Proven track record of delivering scalable solutions..."
                  rows={12}
                />
                <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '14px' }}>
                  <Icons.info size={14} />
                  <span>Tip: Write 3-5 sentences highlighting your experience, skills, and what makes you unique.</span>
                </div>
              </div>
            </div>
          ) : activeTab === 'skills' ? (
            <div className="profile-section">
              <h1 className="profile-section-title">Skills & Expertise</h1>
              <p className="profile-section-subtitle">Your technical and professional skills</p>

              <div className="modern-profile-skills">
                <div className="modern-profile-skill-input-group">
                  <input
                    type="text"
                    className="modern-profile-input"
                    value={newSkill}
                    onChange={(e) => setNewSkill(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addSkill()}
                    placeholder="Add a skill..."
                  />
                  <button onClick={addSkill} className="modern-profile-add-btn">
                    <Icons.plus size={20} />
                    Add
                  </button>
                </div>
                <div className="modern-profile-skills-list">
                  {formData.skills.map((skill) => (
                    <span key={skill} className="modern-profile-skill-tag">
                      {skill}
                      <button
                        onClick={() => removeSkill(skill)}
                        className="modern-profile-skill-remove"
                        aria-label={`Remove ${skill}`}
                      >
                        <Icons.x size={14} />
                      </button>
                    </span>
                  ))}
                  {formData.skills.length === 0 && (
                    <p className="modern-profile-empty-state">
                      No skills added yet. Start adding your skills above or upload a resume to auto-fill.
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : activeTab === 'experience' ? (
            <div className="profile-section">
              <h1 className="profile-section-title">Work Experience</h1>
              <p className="profile-section-subtitle">Your professional work history</p>

              <div className="modern-profile-experiences">
                {formData.experiences.map((exp, index) => (
                  <div key={index} className="modern-profile-experience-card">
                    <div className="modern-profile-experience-header">
                      <h3 className="modern-profile-experience-title">{exp.role}</h3>
                      <span className="modern-profile-experience-company">{exp.company}</span>
                    </div>
                    <div className="modern-profile-experience-meta">
                      <span className="modern-profile-experience-date">{exp.dates}</span>
                      {exp.location && <span className="modern-profile-experience-location">{exp.location}</span>}
                    </div>
                    {exp.bullets && exp.bullets.length > 0 && (
                      <ul className="modern-profile-experience-bullets">
                        {exp.bullets.map((bullet: string, idx: number) => (
                          <li key={idx}>{bullet}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
                {formData.experiences.length === 0 && (
                  <p className="modern-profile-empty-state">
                    No experiences added yet. Upload a resume to auto-fill your work history.
                  </p>
                )}
              </div>
            </div>
          ) : activeTab === 'additional' ? (
            <div className="profile-section">
              <h1 className="profile-section-title">Additional Information</h1>
              <p className="profile-section-subtitle">Any other relevant details or notes</p>

              <div className="profile-form-field full-width">
                <label className="profile-form-label">Additional Information</label>
                <textarea
                  className="profile-form-textarea"
                  value={additionalInfo}
                  onChange={(e) => setAdditionalInfo(e.target.value)}
                  placeholder="Add any additional information, certifications, awards, or notes..."
                  rows={12}
                />
              </div>
            </div>
          ) : activeTab === 'resume' ? (
            <div className="profile-section">
              <h1 className="profile-section-title">Resume Text</h1>
              <p className="profile-section-subtitle">Raw text content of your resume</p>

              <div className="profile-form-field full-width">
                <label className="profile-form-label">Resume Content</label>
                <textarea
                  className="profile-form-textarea"
                  style={{ fontFamily: 'ui-monospace, monospace' }}
                  value={resumeText}
                  onChange={(e) => setResumeText(e.target.value)}
                  placeholder="Paste your resume content here or upload a file to auto-fill..."
                  rows={20}
                />
              </div>
            </div>
          ) : activeTab === 'billing' ? (
            <BillingSection />
          ) : null}
        </div>

        {/* Action Buttons */}
        {activeTab !== 'billing' && (
            <div className="profile-actions">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt"
                onChange={handleResumeUpload}
                style={{ display: 'none' }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingResume}
                className="modern-btn-secondary"
              >
                {uploadingResume ? (
                  <>
                    <div className="modern-btn-spinner"></div>
                    Parsing...
                  </>
                ) : (
                  <>
                    <Icons.upload size={18} />
                    Upload Resume
                  </>
                )}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="modern-btn-primary"
              >
                {saving ? (
                  <>
                    <div className="modern-btn-spinner"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Icons.check size={18} />
                    Save Profile
                  </>
                )}
              </button>
              {autoSaving && (
                <span className="auto-save-indicator">
                  <Icons.loader className="animate-spin" size={14} />
                  Auto-saving...
                </span>
              )}
            </div>
          )}
        </main>
      </div>
    </>
  );
}