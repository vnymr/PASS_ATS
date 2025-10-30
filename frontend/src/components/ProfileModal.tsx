import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { api, type Profile } from '../api-clerk';
import Icons from './ui/icons';
import logger from '../utils/logger';

interface ProfileModalProps {
  onClose: () => void;
}

export default function ProfileModal({ onClose }: ProfileModalProps) {
  const { getToken } = useAuth();
  const [profile, setProfile] = useState<Profile>({
    name: '',
    email: '',
    phone: '',
    location: '',
    linkedin: '',
    website: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'resume'>('basic');
  const [uploadedResume, setUploadedResume] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [savedResumeUrl, setSavedResumeUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const token = await getToken();
      const data = await api.getProfile(token || undefined);
      if (data) {
        setProfile(data);
        // @ts-ignore
        if (data.savedResumeUrl) {
          // @ts-ignore
          setSavedResumeUrl(data.savedResumeUrl);
        }
      }
    } catch (err) {
      logger.error('Failed to load profile', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // Check if profile has minimum required information
    if (!profile.name || !profile.email) {
      alert('Please provide at least your name and email. You can upload a resume to auto-fill this information.');
      return;
    }

    setSaving(true);
    try {
      const token = await getToken();

      // If there's an uploaded resume, include it in the save
      if (uploadedResume) {
        const formData = new FormData();
        formData.append('resume', uploadedResume);
        formData.append('profile', JSON.stringify(profile));

        const response = await fetch(`${api.base}/api/profile/with-resume`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`
          },
          body: formData
        });

        if (!response.ok) {
          throw new Error('Failed to save profile with resume');
        }
      } else {
        await api.postProfile(profile, token || undefined);
      }

      onClose();
    } catch (err) {
      logger.error('Failed to save profile', err);
      alert('Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleResumeUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    if (!allowedTypes.includes(file.type)) {
      alert('Please upload a PDF, DOCX, or TXT file');
      return;
    }

    setUploadedResume(file);
    setParsing(true);

    try {
      const token = await getToken();
      const formData = new FormData();
      formData.append('resume', file);

      const response = await fetch(`${api.base}/api/parse-resume`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to parse resume');
      }

      const { extractedData, resumeText } = await response.json();

      // Auto-fill the profile fields with extracted data
      setProfile(prev => ({
        ...prev,
        name: extractedData.name || prev.name,
        email: extractedData.email || prev.email,
        phone: extractedData.phone || prev.phone,
        location: extractedData.location || prev.location,
        linkedin: extractedData.linkedin || prev.linkedin,
        website: extractedData.website || prev.website,
        summary: extractedData.summary || prev.summary,
        resumeText: resumeText || prev.resumeText,
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

      alert('Resume parsed successfully! Review and update the auto-filled information.');
    } catch (err) {
      logger.error('Failed to parse resume', err);
      alert('Failed to parse resume. You can still fill in the information manually.');
    } finally {
      setParsing(false);
    }
  };

  const handleDownloadResume = () => {
    if (savedResumeUrl) {
      window.open(savedResumeUrl, '_blank');
    }
  };

  if (loading) {
    return (
      <div className="ai-modal-overlay">
        <div className="ai-modal">
          <div className="ai-loading-inline">
            <Icons.loader className="animate-spin" size={24} />
            <span>Loading profile...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ai-modal-overlay" onClick={onClose}>
      <div className="ai-modal ai-modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="ai-modal-header">
          <h2 className="ai-modal-title">Profile</h2>
          <button
            className="ai-modal-close"
            onClick={onClose}
            aria-label="Close profile"
          >
            <Icons.x size={20} />
          </button>
        </div>

        <div className="ai-modal-tabs">
          <button
            className={`ai-tab ${activeTab === 'basic' ? 'active' : ''}`}
            onClick={() => setActiveTab('basic')}
          >
            Basic Info
          </button>
          <button
            className={`ai-tab ${activeTab === 'resume' ? 'active' : ''}`}
            onClick={() => setActiveTab('resume')}
          >
            Resume Content
          </button>
        </div>

        <div className="ai-modal-body">
          {activeTab === 'basic' ? (
            <>
              <div className="ai-upload-section">
                <div className="ai-upload-header">
                  <h3 className="ai-upload-title">
                    <Icons.upload size={18} />
                    Upload Resume to Auto-Fill
                  </h3>
                  <p className="ai-upload-description">
                    Upload your existing resume (PDF, DOCX, or TXT) to automatically fill in your profile information
                  </p>
                </div>
                <div className="ai-upload-controls">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.txt"
                    onChange={handleResumeUpload}
                    style={{ display: 'none' }}
                  />
                  <button
                    className="ai-btn-secondary"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={parsing}
                  >
                    {parsing ? (
                      <>
                        <Icons.loader className="animate-spin" size={16} />
                        Parsing...
                      </>
                    ) : (
                      <>
                        <Icons.upload size={16} />
                        {uploadedResume ? 'Change File' : 'Choose File'}
                      </>
                    )}
                  </button>
                  {uploadedResume && (
                    <span className="ai-file-name">
                      <Icons.fileText size={16} />
                      {uploadedResume.name}
                    </span>
                  )}
                  {savedResumeUrl && (
                    <button
                      className="ai-btn-link"
                      onClick={handleDownloadResume}
                    >
                      <Icons.download size={16} />
                      Download Saved Resume
                    </button>
                  )}
                </div>
              </div>

              <div className="ai-divider" />

              {(!profile.name || !profile.email) && (
                <div className="ai-alert ai-alert-info">
                  <Icons.info size={20} />
                  <span>Please provide your information below or upload a resume to auto-fill these fields</span>
                </div>
              )}

              <div className="ai-form-grid">
                <div className="ai-form-field">
                  <label className="ai-form-label">
                    <Icons.user size={16} />
                    Name <span className="ai-required">*</span>
                  </label>
                  <input
                    type="text"
                    className="ai-form-input"
                    value={profile.name || ''}
                    onChange={(e) => setProfile({...profile, name: e.target.value})}
                    placeholder="Your full name"
                    required
                  />
                </div>

                <div className="ai-form-field">
                  <label className="ai-form-label">
                    <Icons.mail size={16} />
                    Email <span className="ai-required">*</span>
                  </label>
                  <input
                    type="email"
                    className="ai-form-input"
                    value={profile.email || ''}
                    onChange={(e) => setProfile({...profile, email: e.target.value})}
                    placeholder="your@email.com"
                    required
                  />
                </div>

                <div className="ai-form-field">
                  <label className="ai-form-label">
                    <Icons.phone size={16} />
                    Phone
                  </label>
                  <input
                    type="tel"
                    className="ai-form-input"
                    value={profile.phone || ''}
                    onChange={(e) => setProfile({...profile, phone: e.target.value})}
                    placeholder="+1 (555) 123-4567"
                  />
                </div>

                <div className="ai-form-field">
                  <label className="ai-form-label">
                    <Icons.mapPin size={16} />
                    Location
                  </label>
                  <input
                    type="text"
                    className="ai-form-input"
                    value={profile.location || ''}
                    onChange={(e) => setProfile({...profile, location: e.target.value})}
                    placeholder="City, State"
                  />
                </div>

                <div className="ai-form-field">
                  <label className="ai-form-label">
                    <Icons.linkedin size={16} />
                    LinkedIn
                  </label>
                  <input
                    type="url"
                    className="ai-form-input"
                    value={profile.linkedin || ''}
                    onChange={(e) => setProfile({...profile, linkedin: e.target.value})}
                    placeholder="https://linkedin.com/in/yourprofile"
                  />
                </div>

                <div className="ai-form-field">
                  <label className="ai-form-label">
                    <Icons.globe size={16} />
                    Website
                  </label>
                  <input
                    type="url"
                    className="ai-form-input"
                    value={profile.website || ''}
                    onChange={(e) => setProfile({...profile, website: e.target.value})}
                    placeholder="https://yourwebsite.com"
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="ai-form-full">
              {(!profile.resumeText || profile.resumeText === '') && (
                <div className="ai-alert ai-alert-info">
                  <Icons.info size={20} />
                  <span>Upload a resume in the Basic Info tab to auto-fill this section</span>
                </div>
              )}

              <div className="ai-form-field">
                <label className="ai-form-label">
                  <Icons.fileText size={16} />
                  Resume Text
                </label>
                <textarea
                  className="ai-form-textarea"
                  rows={12}
                  value={profile.resumeText || ''}
                  onChange={(e) => setProfile({...profile, resumeText: e.target.value})}
                  placeholder="Paste your resume content here or upload a file in the Basic Info tab..."
                />
              </div>

              <div className="ai-form-field">
                <label className="ai-form-label">
                  <Icons.briefcase size={16} />
                  Summary
                </label>
                <textarea
                  className="ai-form-textarea"
                  rows={4}
                  value={profile.summary || ''}
                  onChange={(e) => setProfile({...profile, summary: e.target.value})}
                  placeholder="A brief professional summary..."
                />
              </div>
            </div>
          )}
        </div>

        <div className="ai-modal-footer">
          <button className="ai-btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="ai-btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <>
                <Icons.loader className="animate-spin" size={16} />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}