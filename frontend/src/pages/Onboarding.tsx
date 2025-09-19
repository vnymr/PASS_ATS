import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type Profile } from '../api-adapter';
import Icons from '../components/ui/icons';

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeText, setResumeText] = useState('');
  const [parsedData, setParsedData] = useState<Profile | null>(null);
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const navigate = useNavigate();

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    const validTypes = ['application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!validTypes.includes(file.type)) {
      setError('Please upload a PDF, TXT, DOC, or DOCX file');
      return;
    }
    setResumeFile(file);
    setError(null);
  };

  const parseResume = async () => {
    if (!resumeFile) return;

    setLoading(true);
    setError(null);

    try {
      const { text } = await api.uploadResume(resumeFile);
      setResumeText(text);

      const analyzed = await api.analyzeResume(text);
      setParsedData(analyzed);
      setStep(2);
    } catch (err: any) {
      console.error('Parse error:', err);
      setError(err?.message || 'Failed to process resume');
    } finally {
      setLoading(false);
    }
  };

  async function handleComplete() {
    setLoading(true);
    try {
      const profileData = {
        ...parsedData,
        additionalInfo,
        resumeText,
        onboardingCompleted: true,
        isComplete: true
      };

      await api.updateProfile(profileData);
      navigate('/dashboard');
    } catch (err) {
      console.error('Failed to save profile:', err);
      setError('Failed to save profile');
    } finally {
      setLoading(false);
    }
  }

  const skipOnboarding = () => {
    navigate('/dashboard');
  };

  return (
    <div className="onboarding-container">
      {/* Steps indicator */}
      <div className="onboarding-steps">
        <div className={`step ${step >= 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}>
          <span className="step-number">{step > 1 ? <Icons.check size={16} /> : '1'}</span>
          <span className="step-label">Upload Resume</span>
        </div>
        <div className="step-line"></div>
        <div className={`step ${step >= 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}>
          <span className="step-number">{step > 2 ? <Icons.check size={16} /> : '2'}</span>
          <span className="step-label">Review & Edit</span>
        </div>
        <div className="step-line"></div>
        <div className={`step ${step >= 3 ? 'active' : ''}`}>
          <span className="step-number">3</span>
          <span className="step-label">Complete</span>
        </div>
      </div>

      {/* Step 1: Upload */}
      {step === 1 && (
        <div className="onboarding-content-full">
          <h1 className="onboarding-title">Welcome! Let's personalize your experience</h1>
          <p className="onboarding-subtitle">Upload your current resume to get started quickly</p>

          <div
            className={`upload-zone ${dragActive ? 'drag-active' : ''} ${resumeFile ? 'has-file' : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              type="file"
              id="resume-upload"
              className="hidden"
              accept=".pdf,.txt,.doc,.docx"
              onChange={handleFileInput}
            />

            {resumeFile ? (
              <div className="file-preview">
                <Icons.fileText size={48} className="file-icon" />
                <div className="file-details">
                  <p className="file-name">{resumeFile.name}</p>
                  <p className="file-size">{(resumeFile.size / 1024).toFixed(2)} KB</p>
                </div>
                <button onClick={() => setResumeFile(null)} className="btn btn-ghost btn-sm">
                  <Icons.x size={16} />
                  Remove
                </button>
              </div>
            ) : (
              <label htmlFor="resume-upload" className="upload-label">
                <Icons.cloudUpload size={48} className="upload-icon" />
                <p className="upload-text">Drag & drop your resume here</p>
                <p className="upload-subtext">or click to browse</p>
                <div className="file-formats">
                  <span>PDF</span>
                  <span>DOC</span>
                  <span>DOCX</span>
                  <span>TXT</span>
                </div>
              </label>
            )}
          </div>

          {error && (
            <div className="error-message">
              <Icons.alertCircle size={16} />
              {error}
            </div>
          )}

          <div className="onboarding-actions">
            <button onClick={skipOnboarding} className="btn btn-ghost">
              Skip for now
            </button>
            <button
              onClick={parseResume}
              disabled={!resumeFile || loading}
              className="btn btn-primary"
            >
              {loading ? (
                <>
                  <Icons.loader className="animate-spin mr-2" size={18} />
                  Processing...
                </>
              ) : (
                <>
                  Continue
                  <Icons.chevronRight size={18} className="ml-2" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Review & Edit with SPLIT SCREEN */}
      {step === 2 && parsedData && (
        <div className="onboarding-split">
          {/* Left side - Extracted Information */}
          <div className="split-left">
            <h2 className="split-title">Review your information</h2>
            <p className="split-subtitle">We've extracted the following from your resume. Feel free to edit anything.</p>

            <div className="extracted-info">
              <div className="info-section">
                <Icons.user size={18} className="section-icon" />
                <h3>Personal Information</h3>
                <div className="info-grid">
                  <div className="info-item">
                    <label>Name</label>
                    <input type="text" defaultValue={parsedData.name || ''} placeholder="Your name" />
                  </div>
                  <div className="info-item">
                    <label>Email</label>
                    <input
                      type="email"
                      defaultValue={parsedData.email && !parsedData.email.includes('Not extractable') ? parsedData.email : ''}
                      placeholder="your@email.com"
                    />
                  </div>
                  <div className="info-item">
                    <label>Phone</label>
                    <input
                      type="tel"
                      defaultValue={parsedData.phone && !parsedData.phone.includes('Not extractable') ? parsedData.phone : ''}
                      placeholder="+1 (555) 123-4567"
                    />
                  </div>
                  <div className="info-item">
                    <label>Location</label>
                    <input
                      type="text"
                      defaultValue={parsedData.location && !parsedData.location.includes('Not extractable') ? parsedData.location : ''}
                      placeholder="City, State"
                    />
                  </div>
                </div>
              </div>

              <div className="info-section">
                <Icons.fileText size={18} className="section-icon" />
                <h3>Professional Summary</h3>
                <p className="summary-text">{parsedData.summary || 'No summary extracted'}</p>
              </div>

              {parsedData.skills && parsedData.skills.length > 0 && (
                <div className="info-section">
                  <Icons.award size={18} className="section-icon" />
                  <h3>Skills</h3>
                  <div className="skills-tags">
                    {parsedData.skills.map((skill, idx) => (
                      <span key={idx} className="skill-tag">{skill}</span>
                    ))}
                  </div>
                </div>
              )}

              {parsedData.experience && parsedData.experience.length > 0 && (
                <div className="info-section">
                  <Icons.briefcase size={18} className="section-icon" />
                  <h3>Experience ({parsedData.experience.length} positions)</h3>
                  {parsedData.experience.slice(0, 2).map((exp, idx) => (
                    <div key={idx} className="experience-item">
                      <p className="exp-role">{exp.role}</p>
                      <p className="exp-company">{exp.company} • {exp.dates}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right side - Additional Information */}
          <div className="split-right">
            <h2 className="split-title">Tell us more</h2>
            <p className="split-subtitle">Add any additional information you'd like us to know about you. This helps create better tailored resumes.</p>

            <div className="additional-info-container">
              <textarea
                className="additional-info-textarea"
                placeholder="Share anything else about yourself - achievements, certifications, preferences, career goals, specific skills, or any context that would help us create better resumes for you...

Examples:
• I prefer remote positions
• I have a security clearance
• I'm passionate about AI/ML projects
• I led a team of 10+ developers
• I increased sales by 150% in my previous role
• I'm looking to transition into management

Feel free to write as much as you want!"
                value={additionalInfo}
                onChange={(e) => setAdditionalInfo(e.target.value)}
                rows={20}
              />
            </div>

            <div className="onboarding-actions">
              <button onClick={() => setStep(1)} className="btn btn-ghost">
                <Icons.chevronLeft size={18} className="mr-2" />
                Back
              </button>
              <button
                onClick={handleComplete}
                disabled={loading}
                className="btn btn-primary"
              >
                {loading ? (
                  <>
                    <Icons.loader className="animate-spin mr-2" size={18} />
                    Saving...
                  </>
                ) : (
                  <>
                    Complete Setup
                    <Icons.check size={18} className="ml-2" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}