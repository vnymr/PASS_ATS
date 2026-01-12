import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { api, type ApplicationQuestions } from '../api-clerk';
import Icons from './ui/icons';
import Card, { CardHeader, CardTitle, CardDescription, CardContent } from '../ui/Card';
import { Label } from '../ui/Label';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import logger from '../utils/logger';

const API_BASE_URL = (import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080').trim();
const buildUrl = (path: string) => (API_BASE_URL ? `${API_BASE_URL}${path}` : path);

// Color scheme
const colors = {
  text: '#0c1310',
  background: '#ffffff',
  primary: '#3eaca7',
  secondary: '#409677',
  accent: '#1c3f40',
};

// Reusable select component
const StyledSelect: React.FC<{
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}> = ({ value, onChange, options, placeholder = 'Select...' }) => (
  <select
    className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 transition"
    style={{
      backgroundColor: colors.background,
      borderColor: '#d1d5db',
      color: colors.text,
    }}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    onFocus={(e) => e.target.style.borderColor = colors.primary}
    onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
  >
    <option value="">{placeholder}</option>
    {options.map(opt => (
      <option key={opt.value} value={opt.value}>{opt.label}</option>
    ))}
  </select>
);

export default function JobApplicationQuestions() {
  const { getToken } = useAuth();
  const [questions, setQuestions] = useState<ApplicationQuestions>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Resume upload state
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [currentResume, setCurrentResume] = useState<{
    filename: string;
    uploadedAt: string;
    size: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadQuestions();
  }, []);

  const loadQuestions = async () => {
    try {
      const token = await getToken();
      const profile = await api.getProfile(token || undefined);
      if (profile?.applicationQuestions) {
        setQuestions(profile.applicationQuestions);
      }
      // Load current resume info if exists
      if (profile?.uploadedResume) {
        setCurrentResume({
          filename: profile.uploadedResume.filename || 'resume.pdf',
          uploadedAt: profile.uploadedResume.uploadedAt || '',
          size: profile.uploadedResume.size || 0,
        });
      }
    } catch (err) {
      logger.error('Failed to load application questions', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const token = await getToken();
      const currentProfile = await api.getProfile(token || undefined);

      await api.postProfile(
        {
          ...currentProfile,
          applicationQuestions: questions
        },
        token || undefined
      );

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      logger.error('Failed to save application questions', err);
      alert('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const updateQuestion = (field: keyof ApplicationQuestions, value: string) => {
    setQuestions({
      ...questions,
      [field]: value
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (file.type !== 'application/pdf') {
      setUploadError('Only PDF files are supported');
      setSelectedFile(null);
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File size must be less than 10MB');
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    setUploadError(null);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadError('Please select a file');
      return;
    }

    setUploading(true);
    setUploadError(null);
    setUploadSuccess(false);

    try {
      const token = await getToken();
      if (!token) {
        setUploadError('Please sign in again');
        return;
      }

      const formData = new FormData();
      formData.append('resume', selectedFile);

      const response = await fetch(buildUrl('/api/profile/upload-resume'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(errorData.error || 'Failed to upload resume');
      }

      const result = await response.json();

      if (result.success) {
        // Update current resume display
        setCurrentResume({
          filename: selectedFile.name,
          uploadedAt: new Date().toISOString(),
          size: selectedFile.size,
        });
        setUploadSuccess(true);
        setSelectedFile(null);
        // Clear file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        setTimeout(() => setUploadSuccess(false), 3000);
      } else {
        throw new Error('Upload failed');
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to upload resume');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full px-4 lg:px-8 pt-[88px] pb-8 min-h-screen" style={{ backgroundColor: colors.background }}>
        <div className="max-w-4xl mx-auto flex items-center justify-center py-12">
          <Icons.loader className="w-6 h-6 animate-spin" style={{ color: colors.primary }} />
          <span className="ml-2" style={{ color: colors.text }}>Loading questions...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-4 lg:px-8 pt-[88px] pb-8 min-h-screen" style={{ backgroundColor: colors.background }}>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center shadow-lg"
              style={{ background: `linear-gradient(to bottom right, ${colors.primary}, ${colors.secondary})` }}
            >
              <Icons.fileText size={20} className="text-white" />
            </div>
            <h1 className="text-3xl font-bold" style={{ color: colors.text }}>Job Application Questions</h1>
          </div>
          <p className="ml-[52px]" style={{ color: colors.text, opacity: 0.7 }}>
            Pre-answer common application questions to speed up auto-apply. Essay questions will be AI-generated for each specific role.
          </p>
        </div>

        {/* Info Banner */}
        <Card className="border" style={{ backgroundColor: '#f0fffe', borderColor: colors.primary }}>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Icons.info size={20} className="mt-0.5 flex-shrink-0" style={{ color: colors.primary }} />
              <div className="text-sm" style={{ color: colors.text }}>
                <p className="font-medium mb-2">How it works:</p>
                <ul className="space-y-1" style={{ opacity: 0.8 }}>
                  <li>• <strong>Factual questions</strong> (legal status, salary, preferences) - Use your answers</li>
                  <li>• <strong>Essay questions</strong> (why this job, tell us about yourself) - AI generates custom responses per company</li>
                  <li>• Fill out once, use automatically across all applications</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Legal & Authorization */}
        <Card className="border" style={{ backgroundColor: colors.background, borderColor: '#e5e7eb' }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2" style={{ color: colors.text }}>
              <Icons.shield size={20} style={{ color: colors.primary }} />
              Legal & Work Authorization
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label style={{ color: colors.text }}>Are you legally authorized to work in the country you reside?</Label>
                <StyledSelect
                  value={questions.legallyAuthorized || ''}
                  onChange={(val) => updateQuestion('legallyAuthorized', val)}
                  options={[
                    { value: 'Yes', label: 'Yes' },
                    { value: 'No', label: 'No' }
                  ]}
                />
              </div>

              <div className="space-y-2">
                <Label style={{ color: colors.text }}>Will you now or in the future require visa sponsorship?</Label>
                <StyledSelect
                  value={questions.requiresVisaSponsorship || ''}
                  onChange={(val) => updateQuestion('requiresVisaSponsorship', val)}
                  options={[
                    { value: 'Yes', label: 'Yes' },
                    { value: 'No', label: 'No' }
                  ]}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Work Preferences */}
        <Card className="border" style={{ backgroundColor: colors.background, borderColor: '#e5e7eb' }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2" style={{ color: colors.text }}>
              <Icons.briefcase size={20} style={{ color: colors.primary }} />
              Work Preferences
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label style={{ color: colors.text }}>Are you willing to relocate?</Label>
                <StyledSelect
                  value={questions.willingToRelocate || ''}
                  onChange={(val) => updateQuestion('willingToRelocate', val)}
                  options={[
                    { value: 'Yes', label: 'Yes' },
                    { value: 'No', label: 'No' },
                    { value: 'Depends on location', label: 'Depends on location' }
                  ]}
                />
              </div>

              <div className="space-y-2">
                <Label style={{ color: colors.text }}>Do you have a valid driver's license?</Label>
                <StyledSelect
                  value={questions.hasDriversLicense || ''}
                  onChange={(val) => updateQuestion('hasDriversLicense', val)}
                  options={[
                    { value: 'Yes', label: 'Yes' },
                    { value: 'No', label: 'No' }
                  ]}
                />
              </div>

              <div className="space-y-2">
                <Label style={{ color: colors.text }}>When can you start?</Label>
                <Input
                  style={{
                    backgroundColor: colors.background,
                    borderColor: '#d1d5db',
                    color: colors.text
                  }}
                  value={questions.availableStartDate || ''}
                  onChange={(e) => updateQuestion('availableStartDate', e.target.value)}
                  placeholder="e.g., Immediately, 2 weeks notice, 1 month"
                  onFocus={(e) => e.currentTarget.style.borderColor = colors.primary}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#d1d5db'}
                />
              </div>

              <div className="space-y-2">
                <Label style={{ color: colors.text }}>What is your notice period?</Label>
                <Input
                  style={{
                    backgroundColor: colors.background,
                    borderColor: '#d1d5db',
                    color: colors.text
                  }}
                  value={questions.noticePeriod || ''}
                  onChange={(e) => updateQuestion('noticePeriod', e.target.value)}
                  placeholder="e.g., 2 weeks, 1 month, 3 months"
                  onFocus={(e) => e.currentTarget.style.borderColor = colors.primary}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#d1d5db'}
                />
              </div>

              <div className="space-y-2">
                <Label style={{ color: colors.text }}>Preferred work arrangement</Label>
                <StyledSelect
                  value={questions.workArrangement || ''}
                  onChange={(val) => updateQuestion('workArrangement', val)}
                  options={[
                    { value: 'Remote', label: 'Remote' },
                    { value: 'Hybrid', label: 'Hybrid' },
                    { value: 'Onsite', label: 'Onsite' },
                    { value: 'Flexible', label: 'Flexible' }
                  ]}
                />
              </div>

              <div className="space-y-2">
                <Label style={{ color: colors.text }}>Are you willing to travel for work?</Label>
                <Input
                  style={{
                    backgroundColor: colors.background,
                    borderColor: '#d1d5db',
                    color: colors.text
                  }}
                  value={questions.willingToTravel || ''}
                  onChange={(e) => updateQuestion('willingToTravel', e.target.value)}
                  placeholder="e.g., Yes, up to 25%, No, Occasionally"
                  onFocus={(e) => e.currentTarget.style.borderColor = colors.primary}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#d1d5db'}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label style={{ color: colors.text }}>Salary expectation (optional but recommended)</Label>
                <Input
                  style={{
                    backgroundColor: colors.background,
                    borderColor: '#d1d5db',
                    color: colors.text
                  }}
                  value={questions.salaryExpectation || ''}
                  onChange={(e) => updateQuestion('salaryExpectation', e.target.value)}
                  placeholder="e.g., $120,000 - $150,000, €80k - €100k"
                  onFocus={(e) => e.currentTarget.style.borderColor = colors.primary}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#d1d5db'}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Additional Information */}
        <Card className="border" style={{ backgroundColor: colors.background, borderColor: '#e5e7eb' }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2" style={{ color: colors.text }}>
              <Icons.helpCircle size={20} style={{ color: colors.primary }} />
              Additional Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label style={{ color: colors.text }}>How did you hear about us? (most common source)</Label>
                <Input
                  style={{
                    backgroundColor: colors.background,
                    borderColor: '#d1d5db',
                    color: colors.text
                  }}
                  value={questions.howDidYouHear || ''}
                  onChange={(e) => updateQuestion('howDidYouHear', e.target.value)}
                  placeholder="e.g., LinkedIn, Indeed, Referral, Company website"
                  onFocus={(e) => e.currentTarget.style.borderColor = colors.primary}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#d1d5db'}
                />
              </div>

              <div className="space-y-2">
                <Label style={{ color: colors.text }}>Do you have relatives working at companies you apply to?</Label>
                <StyledSelect
                  value={questions.hasRelativesAtCompany || ''}
                  onChange={(val) => updateQuestion('hasRelativesAtCompany', val)}
                  options={[
                    { value: 'No', label: 'No' },
                    { value: 'Yes', label: 'Yes' }
                  ]}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label style={{ color: colors.text }}>Are you comfortable with background checks?</Label>
                <StyledSelect
                  value={questions.comfortableWithBackgroundCheck || ''}
                  onChange={(val) => updateQuestion('comfortableWithBackgroundCheck', val)}
                  options={[
                    { value: 'Yes', label: 'Yes' },
                    { value: 'No', label: 'No' }
                  ]}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* EEO Information */}
        <Card className="border" style={{ backgroundColor: colors.background, borderColor: '#e5e7eb' }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2" style={{ color: colors.text }}>
              <Icons.users size={20} style={{ color: colors.primary }} />
              EEO Information (Optional)
            </CardTitle>
            <CardDescription style={{ color: colors.text, opacity: 0.7 }}>
              These questions are for Equal Employment Opportunity compliance reporting only. They are not used in hiring decisions and you may decline to answer.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label style={{ color: colors.text }}>Gender</Label>
                <StyledSelect
                  value={questions.gender || ''}
                  onChange={(val) => updateQuestion('gender', val)}
                  options={[
                    { value: 'Male', label: 'Male' },
                    { value: 'Female', label: 'Female' },
                    { value: 'Non-binary', label: 'Non-binary' },
                    { value: 'Decline to answer', label: 'Decline to answer' }
                  ]}
                />
              </div>

              <div className="space-y-2">
                <Label style={{ color: colors.text }}>Race/Ethnicity</Label>
                <StyledSelect
                  value={questions.race || ''}
                  onChange={(val) => updateQuestion('race', val)}
                  options={[
                    { value: 'Decline to answer', label: 'Decline to answer' },
                    { value: 'Hispanic or Latino', label: 'Hispanic or Latino' },
                    { value: 'White', label: 'White' },
                    { value: 'Black or African American', label: 'Black or African American' },
                    { value: 'Native American or Alaska Native', label: 'Native American or Alaska Native' },
                    { value: 'Asian', label: 'Asian' },
                    { value: 'Native Hawaiian or Pacific Islander', label: 'Native Hawaiian or Pacific Islander' },
                    { value: 'Two or more races', label: 'Two or more races' }
                  ]}
                />
              </div>

              <div className="space-y-2">
                <Label style={{ color: colors.text }}>Veteran Status</Label>
                <StyledSelect
                  value={questions.veteranStatus || ''}
                  onChange={(val) => updateQuestion('veteranStatus', val)}
                  options={[
                    { value: 'I am not a protected veteran', label: 'I am not a protected veteran' },
                    { value: 'I identify as one or more classifications of protected veteran', label: 'I identify as one or more classifications of protected veteran' },
                    { value: "I don't wish to answer", label: "I don't wish to answer" }
                  ]}
                />
              </div>

              <div className="space-y-2">
                <Label style={{ color: colors.text }}>Disability Status</Label>
                <StyledSelect
                  value={questions.disabilityStatus || ''}
                  onChange={(val) => updateQuestion('disabilityStatus', val)}
                  options={[
                    { value: 'No, I do not have a disability', label: 'No, I do not have a disability' },
                    { value: 'Yes, I have a disability', label: 'Yes, I have a disability' },
                    { value: "I don't wish to answer", label: "I don't wish to answer" }
                  ]}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Resume Upload */}
        <Card className="border" style={{ backgroundColor: colors.background, borderColor: '#e5e7eb' }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2" style={{ color: colors.text }}>
              <Icons.fileText size={20} style={{ color: colors.primary }} />
              Resume Upload
            </CardTitle>
            <CardDescription style={{ color: colors.text, opacity: 0.7 }}>
              Upload your resume PDF to use for auto-apply. This resume will be used for all job applications.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Current Resume Status */}
            {currentResume && (
              <div
                className="p-4 rounded-lg border"
                style={{
                  backgroundColor: '#e6f7f5',
                  borderColor: colors.primary
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <Icons.check size={20} className="mt-0.5" style={{ color: colors.secondary }} />
                    <div>
                      <p className="font-medium text-sm" style={{ color: colors.text }}>
                        Current Resume: {currentResume.filename}
                      </p>
                      <p className="text-xs mt-1" style={{ color: colors.text, opacity: 0.7 }}>
                        Uploaded: {new Date(currentResume.uploadedAt).toLocaleDateString()} • {(currentResume.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* File Upload Area */}
            <div
              className="border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer"
              style={{
                borderColor: uploadError ? '#ef4444' : '#d1d5db'
              }}
              onClick={() => fileInputRef.current?.click()}
              onMouseEnter={(e) => {
                if (!uploadError) e.currentTarget.style.borderColor = colors.primary;
              }}
              onMouseLeave={(e) => {
                if (!uploadError) e.currentTarget.style.borderColor = '#d1d5db';
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                onChange={handleFileSelect}
                className="hidden"
              />

              <div className="flex flex-col items-center gap-3">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: colors.primary + '20' }}
                >
                  <Icons.upload size={24} style={{ color: colors.primary }} />
                </div>

                {selectedFile ? (
                  <div>
                    <p className="text-sm font-medium" style={{ color: colors.text }}>
                      {selectedFile.name}
                    </p>
                    <p className="text-xs mt-1" style={{ color: colors.text, opacity: 0.6 }}>
                      {(selectedFile.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-medium" style={{ color: colors.text }}>
                      Click to upload or drag and drop
                    </p>
                    <p className="text-xs mt-1" style={{ color: colors.text, opacity: 0.6 }}>
                      PDF only, max 10MB
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Error Message */}
            {uploadError && (
              <div
                className="p-3 rounded-lg border"
                style={{
                  backgroundColor: '#fef2f2',
                  borderColor: '#ef4444'
                }}
              >
                <p className="text-sm" style={{ color: '#dc2626' }}>
                  {uploadError}
                </p>
              </div>
            )}

            {/* Success Message */}
            {uploadSuccess && (
              <div
                className="p-3 rounded-lg border flex items-center gap-2"
                style={{
                  backgroundColor: '#e6f7f5',
                  borderColor: colors.secondary
                }}
              >
                <Icons.check size={16} style={{ color: colors.secondary }} />
                <p className="text-sm font-medium" style={{ color: colors.secondary }}>
                  Resume uploaded successfully!
                </p>
              </div>
            )}

            {/* Upload Button */}
            {selectedFile && (
              <Button
                onClick={handleUpload}
                disabled={uploading}
                className="w-full py-2.5 rounded-lg font-medium transition text-white"
                style={{
                  backgroundColor: colors.primary,
                }}
                onMouseEnter={(e) => !uploading && (e.currentTarget.style.backgroundColor = colors.secondary)}
                onMouseLeave={(e) => !uploading && (e.currentTarget.style.backgroundColor = colors.primary)}
              >
                {uploading ? (
                  <>
                    <Icons.loader className="animate-spin mr-2" size={16} />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Icons.upload size={16} className="mr-2" />
                    Upload Resume
                  </>
                )}
              </Button>
            )}

            {/* Info Text */}
            <div
              className="p-3 rounded-lg"
              style={{
                backgroundColor: '#eff6ff'
              }}
            >
              <p className="text-xs" style={{ color: '#1e40af' }}>
                <strong>Tip:</strong> Make sure your resume is up-to-date and formatted properly. This will be automatically submitted with all auto-apply jobs.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex items-center gap-4 sticky bottom-8 z-10">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="px-8 py-3 rounded-lg font-medium shadow-lg transition text-white"
            style={{
              backgroundColor: colors.primary,
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.secondary}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.primary}
          >
            {saving ? (
              <>
                <Icons.loader className="animate-spin mr-2" size={16} />
                Saving...
              </>
            ) : (
              <>
                <Icons.save size={16} className="mr-2" />
                Save Questions
              </>
            )}
          </Button>

          {saved && (
            <div
              className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg"
              style={{
                color: colors.secondary,
                backgroundColor: '#e6f7f5'
              }}
            >
              <Icons.check size={16} />
              <span>Saved successfully!</span>
            </div>
          )}
        </div>

        {/* Help Text */}
        <Card className="border" style={{ backgroundColor: '#f9fafb', borderColor: '#e5e7eb' }}>
          <CardContent className="pt-6">
            <p className="text-sm" style={{ color: colors.text, opacity: 0.8 }}>
              <strong style={{ color: colors.text }}>💡 Tip:</strong> The more questions you pre-answer, the faster and more accurate your auto-applications will be. You can always come back and update these later.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
