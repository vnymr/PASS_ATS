import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@clerk/clerk-react';
import Icons from '../components/ui/icons';
import BillingSection from '../components/BillingSection';
import { Tabs } from '../ui/Tabs';
import Card, { CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../ui/Card';
import { Label } from '../ui/Label';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Button } from '../ui/Button';
import logger from '../utils/logger';

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
    <div className="max-w-5xl mx-auto px-4 py-8">
      {(error || success) && (
        <div className="mb-4">
          {error && (
            <div className="mb-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 inline-flex items-center gap-2">
              <span>✕</span>
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 inline-flex items-center gap-2">
              <span>✓</span>
              <span>Profile saved successfully!</span>
            </div>
          )}
        </div>
      )}

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
          { value: 'billing', label: 'Billing' },
        ]}
        className="mb-6"
      />

      {activeTab === 'personal' && (
        <Card>
          <CardHeader>
            <CardTitle>Personal</CardTitle>
            <CardDescription>Your basic contact details</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Full Name</Label>
                <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="John Doe" />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="john.doe@example.com" />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="+1 (555) 123-4567" />
              </div>
              <div>
                <Label>Location</Label>
                <Input value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} placeholder="San Francisco, CA" />
              </div>
              <div>
                <Label>LinkedIn</Label>
                <Input value={formData.linkedin} onChange={(e) => setFormData({ ...formData, linkedin: e.target.value })} placeholder="https://linkedin.com/in/johndoe" />
              </div>
              <div>
                <Label>Website</Label>
                <Input value={formData.website} onChange={(e) => setFormData({ ...formData, website: e.target.value })} placeholder="https://johndoe.com" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'summary' && (
        <Card>
          <CardHeader>
            <CardTitle>Professional Summary</CardTitle>
            <CardDescription>Brief overview of your professional background and career objectives</CardDescription>
          </CardHeader>
          <CardContent>
            <div>
              <Label>Summary</Label>
              <Textarea
                value={formData.summary}
                onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                placeholder={
                  'Write a compelling summary of your professional experience, key achievements, technical skills, and career objectives.'
                }
                rows={12}
              />
              <div className="mt-3 flex items-center gap-2 text-neutral-600 text-sm">
                <Icons.info size={14} />
                <span>Tip: Write 3-5 sentences highlighting your experience, skills, and what makes you unique.</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'skills' && (
        <Card>
          <CardHeader>
            <CardTitle>Skills & Expertise</CardTitle>
            <CardDescription>Your technical and professional skills</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
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
            <div className="mt-4 flex flex-wrap gap-2">
              {formData.skills.map((skill) => (
                <span key={skill} className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 text-neutral-700 px-3 py-1 text-sm">
                  {skill}
                  <button onClick={() => removeSkill(skill)} aria-label={`Remove ${skill}`} className="text-neutral-500 hover:text-neutral-700">
                    <Icons.x size={14} />
                  </button>
                </span>
              ))}
              {formData.skills.length === 0 && (
                <p className="text-sm text-neutral-600">No skills added yet. Start adding your skills above or upload a resume to auto-fill.</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'experience' && (
        <Card>
          <CardHeader>
            <CardTitle>Work Experience</CardTitle>
            <CardDescription>Your professional work history</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              {formData.experiences.map((exp, index) => (
                <div key={index} className="rounded-xl border border-neutral-200 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{exp.role}</h3>
                      <p className="text-sm text-neutral-600">{exp.company}</p>
                    </div>
                    <div className="text-sm text-neutral-500">{exp.dates}</div>
                  </div>
                  {exp.location && <div className="text-xs text-neutral-500 mt-1">{exp.location}</div>}
                  {exp.bullets && exp.bullets.length > 0 && (
                    <ul className="mt-3 list-disc pl-5 text-sm text-neutral-700">
                      {exp.bullets.map((bullet: string, idx: number) => (
                        <li key={idx}>{bullet}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
              {formData.experiences.length === 0 && (
                <p className="text-sm text-neutral-600">No experiences added yet. Upload a resume to auto-fill your work history.</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'additional' && (
        <Card>
          <CardHeader>
            <CardTitle>Additional Information</CardTitle>
            <CardDescription>Any other relevant details or notes</CardDescription>
          </CardHeader>
          <CardContent>
            <div>
              <Label>Additional Information</Label>
              <Textarea value={additionalInfo} onChange={(e) => setAdditionalInfo(e.target.value)} placeholder="Add any additional information, certifications, awards, or notes..." rows={10} />
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'resume' && (
        <Card>
          <CardHeader>
            <CardTitle>Resume Text</CardTitle>
            <CardDescription>Raw text content of your resume</CardDescription>
          </CardHeader>
          <CardContent>
            <div>
              <Label>Resume Content</Label>
              <Textarea className="font-mono" value={resumeText} onChange={(e) => setResumeText(e.target.value)} placeholder="Paste your resume content here or upload a file to auto-fill..." rows={16} />
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'billing' && <BillingSection />}

      {activeTab !== 'billing' && (
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
  );
}