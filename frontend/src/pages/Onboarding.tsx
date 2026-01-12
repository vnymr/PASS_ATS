import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { motion, AnimatePresence } from 'framer-motion';
import Icons from '../components/ui/icons';
import MinimalInput from '../components/MinimalInput';
import MinimalTextareaField from '../components/MinimalTextareaField';
import logger from '../utils/logger';

type ProfileData = {
  name: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  website: string;
  summary: string;
  skills: string[];
  experiences: Array<{ company: string; role: string; location: string; dates: string; bullets: string[] }>;
  education: Array<{ institution: string; degree: string; location: string; dates: string }>;
  resumeText: string;
};

const INITIAL_PROFILE: ProfileData = {
  name: '',
  email: '',
  phone: '',
  location: '',
  linkedin: '',
  website: '',
  summary: '',
  skills: [],
  experiences: [],
  education: [],
  resumeText: '',
};

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8080/api').replace(/\/api$/, '');

export default function Onboarding() {
  const navigate = useNavigate();
  const { getToken, isLoaded, isSignedIn, userId } = useAuth();
  const [showManual, setShowManual] = useState(false);
  const [profileData, setProfileData] = useState<ProfileData>(INITIAL_PROFILE);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [newSkill, setNewSkill] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Redirect if not signed in
  useEffect(() => {
    if (isLoaded && !isSignedIn) navigate('/auth');
  }, [isLoaded, isSignedIn, navigate]);

  // Save profile to API
  const saveProfile = async (data: ProfileData) => {
    const token = await getToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${API_URL}/api/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ ...data, isComplete: true }),
    });

    if (!response.ok) throw new Error('Failed to save profile');
  };

  // Handle file upload - parse and auto-save
  const handleFile = async (file: File) => {
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    if (!allowedTypes.includes(file.type)) {
      setError('Please upload a PDF, DOCX, or TXT file');
      return;
    }

    setLoading(true);
    setError(null);
    setStatus('Parsing your resume...');

    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      // Parse resume
      const formData = new FormData();
      formData.append('resume', file);

      const response = await fetch(`${API_URL}/api/parse-resume`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to parse resume');
      }

      const { extractedData, resumeText } = await response.json();

      // Build profile from extracted data
      const newProfile: ProfileData = {
        name: extractedData.name || '',
        email: extractedData.email || '',
        phone: extractedData.phone || '',
        location: extractedData.location || '',
        linkedin: extractedData.linkedin || '',
        website: extractedData.website || '',
        summary: extractedData.summary || '',
        skills: extractedData.skills || [],
        experiences: extractedData.experience?.map((exp: any) => ({
          company: exp.company || '',
          role: exp.title || '',
          location: exp.location || '',
          dates: `${exp.startDate || ''} - ${exp.endDate || 'Present'}`,
          bullets: Array.isArray(exp.description) ? exp.description : [exp.description || ''],
        })) || [],
        education: extractedData.education?.map((edu: any) => ({
          institution: edu.institution || '',
          degree: `${edu.degree || ''} ${edu.field || ''}`.trim(),
          location: '',
          dates: edu.graduationDate || '',
        })) || [],
        resumeText: resumeText || '',
      };

      setStatus('Saving your profile...');

      // Auto-save and navigate
      await saveProfile(newProfile);

      sessionStorage.setItem(`onboarding_complete_${userId}`, 'true');
      localStorage.removeItem('onboarding_draft');

      navigate('/happy');
    } catch (err) {
      logger.error('Resume upload failed', err);
      setError(err instanceof Error ? err.message : 'Failed to process resume');
      setStatus('');
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  // Handle manual form save
  const handleManualSave = async () => {
    if (!profileData.name.trim() || !profileData.email.trim() || !profileData.phone.trim()) {
      setError('Please fill in name, email, and phone');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await saveProfile(profileData);

      sessionStorage.setItem(`onboarding_complete_${userId}`, 'true');
      localStorage.removeItem('onboarding_draft');

      navigate('/happy');
    } catch (err) {
      logger.error('Profile save failed', err);
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  const addSkill = () => {
    if (newSkill.trim() && !profileData.skills.includes(newSkill.trim())) {
      setProfileData(prev => ({ ...prev, skills: [...prev.skills, newSkill.trim()] }));
      setNewSkill('');
    }
  };

  const removeSkill = (skill: string) => {
    setProfileData(prev => ({ ...prev, skills: prev.skills.filter(s => s !== skill) }));
  };

  const updateField = (field: keyof ProfileData, value: any) => {
    setProfileData(prev => ({ ...prev, [field]: value }));
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <Icons.loader className="w-6 h-6 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col">
      {/* Error toast */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-3 bg-red-500 text-white rounded-xl shadow-lg flex items-center gap-2"
          >
            <span className="text-sm">{error}</span>
            <button onClick={() => setError(null)} className="p-1 hover:bg-white/20 rounded">
              <Icons.x className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <AnimatePresence mode="wait">
          {/* Upload View */}
          {!showManual && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-md"
            >
              {/* Upload zone */}
              <div
                onClick={() => !loading && fileInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`
                  relative cursor-pointer rounded-3xl border-2 border-dashed p-12
                  transition-all duration-300 text-center
                  ${isDragging
                    ? 'border-[var(--primary)] bg-[var(--primary-50)] scale-[1.02]'
                    : 'border-[var(--text-300)] hover:border-[var(--primary)] hover:bg-[var(--primary-50)]/50'
                  }
                  ${loading ? 'pointer-events-none' : ''}
                `}
              >
                {loading ? (
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-[var(--primary-100)] flex items-center justify-center">
                      <Icons.loader className="w-8 h-8 text-[var(--primary)] animate-spin" />
                    </div>
                    <p className="text-[var(--text-600)]">{status}</p>
                  </div>
                ) : (
                  <>
                    <div className="w-20 h-20 rounded-2xl bg-[var(--primary-100)] flex items-center justify-center mx-auto mb-6">
                      <Icons.upload className="w-10 h-10 text-[var(--primary)]" />
                    </div>
                    <p className="text-lg font-medium text-[var(--text-900)] mb-2">
                      Drop your resume here
                    </p>
                    <p className="text-sm text-[var(--text-500)]">
                      or click to browse
                    </p>
                    <p className="text-xs text-[var(--text-400)] mt-4">
                      PDF, DOCX, or TXT
                    </p>
                  </>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt"
                className="hidden"
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
              />

              {/* Manual entry link */}
              <button
                onClick={() => setShowManual(true)}
                disabled={loading}
                className="w-full mt-6 py-3 text-sm text-[var(--text-500)] hover:text-[var(--text-700)] transition-colors disabled:opacity-50"
              >
                or enter manually →
              </button>
            </motion.div>
          )}

          {/* Manual Entry View */}
          {showManual && (
            <motion.div
              key="manual"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-lg"
            >
              <div className="bg-[var(--background-elevated)] rounded-2xl p-6 shadow-sm border border-[var(--text-100)]">
                <div className="space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <MinimalInput
                      label="Name *"
                      value={profileData.name}
                      onChange={e => updateField('name', e.target.value)}
                      placeholder="John Doe"
                    />
                    <MinimalInput
                      label="Email *"
                      type="email"
                      value={profileData.email}
                      onChange={e => updateField('email', e.target.value)}
                      placeholder="john@email.com"
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <MinimalInput
                      label="Phone *"
                      value={profileData.phone}
                      onChange={e => updateField('phone', e.target.value)}
                      placeholder="+1 555 123 4567"
                    />
                    <MinimalInput
                      label="Location"
                      value={profileData.location}
                      onChange={e => updateField('location', e.target.value)}
                      placeholder="San Francisco, CA"
                    />
                  </div>

                  <MinimalInput
                    label="LinkedIn"
                    value={profileData.linkedin}
                    onChange={e => updateField('linkedin', e.target.value)}
                    placeholder="linkedin.com/in/johndoe"
                  />

                  <MinimalTextareaField
                    label="Summary"
                    value={profileData.summary}
                    onChange={e => updateField('summary', e.target.value)}
                    placeholder="Brief professional overview..."
                    rows={3}
                  />

                  {/* Skills */}
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-600)] uppercase tracking-wide mb-2">
                      Skills
                    </label>
                    <div className="flex gap-2 mb-3">
                      <input
                        type="text"
                        value={newSkill}
                        onChange={e => setNewSkill(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSkill())}
                        placeholder="Add skill..."
                        className="flex-1 px-3 py-2 bg-transparent border-b border-[var(--text-200)] text-sm focus:outline-none focus:border-[var(--primary)]"
                      />
                      <button
                        onClick={addSkill}
                        className="px-3 py-2 text-[var(--primary)] hover:bg-[var(--primary-50)] rounded-lg transition-colors"
                      >
                        <Icons.plus className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {profileData.skills.map(skill => (
                        <span
                          key={skill}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-[var(--text-100)] text-[var(--text-700)] rounded-full text-sm"
                        >
                          {skill}
                          <button onClick={() => removeSkill(skill)} className="hover:text-[var(--text-900)]">
                            <Icons.x className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 mt-8">
                  <button
                    onClick={() => setShowManual(false)}
                    disabled={loading}
                    className="px-4 py-2.5 text-[var(--text-600)] hover:text-[var(--text-900)] transition-colors"
                  >
                    ← Back
                  </button>
                  <button
                    onClick={handleManualSave}
                    disabled={loading || !profileData.name || !profileData.email || !profileData.phone}
                    className="flex-1 py-2.5 bg-[var(--primary)] text-white rounded-xl font-medium hover:bg-[var(--primary-600)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Icons.loader className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Continue'
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
