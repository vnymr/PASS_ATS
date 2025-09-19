import React, { useState, useEffect } from 'react';
import { api, type Profile } from '../api-adapter';
import Icons from '../components/ui/icons';

export default function MemoryProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [resumeText, setResumeText] = useState('');
  const [activeTab, setActiveTab] = useState<'profile' | 'additional' | 'resume'>('profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

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
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      const data = await api.getProfile();
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

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const updatedProfile: any = { ...profile };

      // Update with form data
      updatedProfile.name = formData.name;
      updatedProfile.email = formData.email;
      updatedProfile.phone = formData.phone;
      updatedProfile.location = formData.location;
      updatedProfile.linkedin = formData.linkedin;
      updatedProfile.website = formData.website;
      updatedProfile.summary = formData.summary;
      updatedProfile.skills = formData.skills;
      updatedProfile.experiences = formData.experiences;
      updatedProfile.projects = formData.projects;
      updatedProfile.education = formData.education;

      // Save additional info and resume text
      updatedProfile.additionalInfo = additionalInfo;
      updatedProfile.resumeText = resumeText;

      await api.updateProfile(updatedProfile);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error('Failed to save profile:', err);
      setError(err?.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="loading-container">
        <Icons.loader className="animate-spin" size={48} />
        <p>Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="profile-container">
      {/* Header Section */}
      <div className="profile-header">
        <div className="profile-header-content">
          <div className="profile-header-icon">
            <Icons.user size={32} />
          </div>
          <div className="profile-header-text">
            <h1 className="profile-title">Memory & Profile</h1>
            <p className="profile-subtitle">
              Manage your professional information and additional context to create better resumes
            </p>
          </div>
        </div>
        <div className="profile-actions">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn btn-primary btn-save"
          >
            {saving ? (
              <>
                <Icons.loader className="animate-spin mr-2" size={18} />
                Saving...
              </>
            ) : (
              <>
                <Icons.check size={18} className="mr-2" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="status-message error-message">
          <Icons.alertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="status-message success-message">
          <Icons.checkCircle size={20} />
          <span>Profile saved successfully!</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="profile-tabs">
        <button
          className={`profile-tab ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          <Icons.user size={20} />
          <span>Profile Information</span>
        </button>
        <button
          className={`profile-tab ${activeTab === 'additional' ? 'active' : ''}`}
          onClick={() => setActiveTab('additional')}
        >
          <Icons.fileText size={20} />
          <span>Additional Notes</span>
        </button>
        <button
          className={`profile-tab ${activeTab === 'resume' ? 'active' : ''}`}
          onClick={() => setActiveTab('resume')}
        >
          <Icons.file size={20} />
          <span>Original Resume</span>
        </button>
      </div>

      {/* Content Area */}
      <div className="profile-content">
        {activeTab === 'profile' ? (
          <div className="profile-form-container">
            {/* Personal Information Card */}
            <div className="form-card">
              <div className="form-card-header">
                <Icons.user size={24} />
                <h3 className="form-card-title">Personal Information</h3>
              </div>
              <div className="form-card-content">
                <div className="form-grid">
                  <div className="form-field">
                    <label className="form-label">
                      <Icons.user size={16} />
                      Full Name
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      placeholder="Enter your full name"
                    />
                  </div>
                  <div className="form-field">
                    <label className="form-label">
                      <Icons.mail size={16} />
                      Email Address
                    </label>
                    <input
                      type="email"
                      className="form-input"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      placeholder="your@email.com"
                    />
                  </div>
                  <div className="form-field">
                    <label className="form-label">
                      <Icons.phone size={16} />
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      className="form-input"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      placeholder="+1 (555) 123-4567"
                    />
                  </div>
                  <div className="form-field">
                    <label className="form-label">
                      <Icons.mapPin size={16} />
                      Location
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.location}
                      onChange={(e) => setFormData({...formData, location: e.target.value})}
                      placeholder="City, State"
                    />
                  </div>
                  <div className="form-field">
                    <label className="form-label">
                      <Icons.linkedin size={16} />
                      LinkedIn Profile
                    </label>
                    <input
                      type="url"
                      className="form-input"
                      value={formData.linkedin}
                      onChange={(e) => setFormData({...formData, linkedin: e.target.value})}
                      placeholder="https://linkedin.com/in/yourprofile"
                    />
                  </div>
                  <div className="form-field">
                    <label className="form-label">
                      <Icons.globe size={16} />
                      Website
                    </label>
                    <input
                      type="url"
                      className="form-input"
                      value={formData.website}
                      onChange={(e) => setFormData({...formData, website: e.target.value})}
                      placeholder="https://yourwebsite.com"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Professional Summary Card */}
            <div className="form-card">
              <div className="form-card-header">
                <Icons.fileText size={24} />
                <h3 className="form-card-title">Professional Summary</h3>
              </div>
              <div className="form-card-content">
                <div className="form-field">
                  <label className="form-label">
                    <Icons.edit size={16} />
                    Summary
                  </label>
                  <textarea
                    className="form-textarea"
                    value={formData.summary}
                    onChange={(e) => setFormData({...formData, summary: e.target.value})}
                    placeholder="Write a compelling professional summary that highlights your key strengths and career objectives..."
                    rows={4}
                  />
                </div>
              </div>
            </div>

            {/* Skills Card */}
            <div className="form-card">
              <div className="form-card-header">
                <Icons.award size={24} />
                <h3 className="form-card-title">Skills & Expertise</h3>
              </div>
              <div className="form-card-content">
                <div className="form-field">
                  <label className="form-label">
                    <Icons.plus size={16} />
                    Add Skills
                  </label>
                  <div className="skills-input-container">
                    <input
                      type="text"
                      className="form-input skills-input"
                      placeholder="Type a skill and press Enter to add it"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const skill = e.currentTarget.value.trim();
                          if (skill && !formData.skills.includes(skill)) {
                            setFormData({...formData, skills: [...formData.skills, skill]});
                            e.currentTarget.value = '';
                          }
                        }
                      }}
                    />
                    <div className="skills-tags">
                      {formData.skills.map((skill, index) => (
                        <div key={index} className="skill-tag">
                          <span className="skill-tag-text">{skill}</span>
                          <button
                            onClick={() => setFormData({
                              ...formData,
                              skills: formData.skills.filter((_, i) => i !== index)
                            })}
                            className="skill-tag-remove"
                            type="button"
                          >
                            <Icons.x size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Work Experience Card */}
            <div className="form-card">
              <div className="form-card-header">
                <Icons.briefcase size={24} />
                <h3 className="form-card-title">Work Experience</h3>
              </div>
              <div className="form-card-content">
                <div className="experience-list">
                  {formData.experiences.map((exp, index) => (
                    <div key={index} className="experience-item">
                      <div className="experience-item-header">
                        <h4 className="experience-item-title">Experience #{index + 1}</h4>
                        <button
                          onClick={() => setFormData({
                            ...formData,
                            experiences: formData.experiences.filter((_, i) => i !== index)
                          })}
                          className="btn btn-ghost btn-sm experience-remove"
                          type="button"
                        >
                          <Icons.trash size={16} />
                          Remove
                        </button>
                      </div>
                      <div className="form-grid">
                        <div className="form-field">
                          <label className="form-label">Job Title</label>
                          <input
                            type="text"
                            className="form-input"
                            value={exp.role || ''}
                            onChange={(e) => {
                              const newExp = [...formData.experiences];
                              newExp[index] = {...newExp[index], role: e.target.value};
                              setFormData({...formData, experiences: newExp});
                            }}
                            placeholder="e.g. Software Engineer"
                          />
                        </div>
                        <div className="form-field">
                          <label className="form-label">Company</label>
                          <input
                            type="text"
                            className="form-input"
                            value={exp.company || ''}
                            onChange={(e) => {
                              const newExp = [...formData.experiences];
                              newExp[index] = {...newExp[index], company: e.target.value};
                              setFormData({...formData, experiences: newExp});
                            }}
                            placeholder="e.g. Tech Corp"
                          />
                        </div>
                        <div className="form-field">
                          <label className="form-label">Duration</label>
                          <input
                            type="text"
                            className="form-input"
                            value={exp.dates || ''}
                            onChange={(e) => {
                              const newExp = [...formData.experiences];
                              newExp[index] = {...newExp[index], dates: e.target.value};
                              setFormData({...formData, experiences: newExp});
                            }}
                            placeholder="e.g. Jan 2020 - Present"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setFormData({
                    ...formData,
                    experiences: [...formData.experiences, {role: '', company: '', dates: ''}]
                  })}
                  className="btn btn-outline btn-add-experience"
                  type="button"
                >
                  <Icons.plus size={18} />
                  Add Work Experience
                </button>
              </div>
            </div>
          </div>
        ) : activeTab === 'additional' ? (
          <div className="text-content-card">
            <div className="text-content-header">
              <Icons.fileText size={24} />
              <h3 className="text-content-title">Additional Notes</h3>
              <p className="text-content-subtitle">
                Add any additional context about yourself that will help us create better resumes
              </p>
            </div>
            <textarea
              className="text-content-textarea"
              value={additionalInfo}
              onChange={(e) => setAdditionalInfo(e.target.value)}
              placeholder="Additional information about yourself...

You can include:
• Personal information (name, email, phone, location)
• Professional summary
• Skills and expertise
• Work experience
• Education
• Certifications
• Achievements
• Career goals
• Preferences (remote work, specific industries, etc.)
• Projects you've worked on
• Languages you speak
• Hobbies and interests
• Anything else you think is relevant

The more you share, the better we can customize your resumes for each job application.

This is any additional context you provided during onboarding or want to add now."
            />
          </div>
        ) : (
          <div className="text-content-card">
            <div className="text-content-header">
              <Icons.file size={24} />
              <h3 className="text-content-title">Original Resume</h3>
              <p className="text-content-subtitle">
                This is the content extracted from your uploaded resume
              </p>
            </div>
            <textarea
              className="text-content-textarea"
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              placeholder="Your original resume content will appear here...

This is the full text from your uploaded resume that we extracted and use as the base for generating tailored resumes."
            />
          </div>
        )}
      </div>
    </div>
  );
}