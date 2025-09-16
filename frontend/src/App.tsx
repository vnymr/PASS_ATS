import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate, Link } from 'react-router-dom';
import { api, type Profile, type Quota, type ResumeEntry } from './api';
import { clearAuth, getToken, setToken } from './auth';
import logoImg from './logo.png';
import Icons from './components/ui/icons';
import './styles.css';

// Landing Page Component
function Landing() {
  const navigate = useNavigate();

  return (
    <div className="landing-hero">
      <div className="geometric-bg">
        <div className="geometric-shape shape-1"></div>
        <div className="geometric-shape shape-2"></div>
        <div className="geometric-shape shape-3"></div>
      </div>

      <nav className="landing-nav">
        <div className="nav-container">
          <div className="logo">
            <img src={logoImg} alt="" className="logo-img" />
          </div>
          <div className="nav-buttons">
            <button onClick={() => navigate('/login')} className="btn btn-ghost">
              Sign In
            </button>
            <button onClick={() => navigate('/signup')} className="btn btn-primary">
              Get Started
            </button>
          </div>
        </div>
      </nav>

      <div className="hero-content">
        <h1 className="hero-title">Make Every Application Count</h1>
        <p className="hero-subtitle">
          Turn your profile + any job post into a one-page, ATS-ready resume.
          Every time in under 20 seconds.
        </p>
        <div className="hero-buttons">
          <button onClick={() => navigate('/signup')} className="btn btn-primary btn-large">
            Start Building Your Resume
          </button>
          <button className="btn btn-outline btn-large">
            Download Extension
          </button>
        </div>
      </div>
    </div>
  );
}

// Login Component
function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await api.login(email, password);
      console.log('Login response:', response);

      if (response.token) {
        setToken(response.token);
        console.log('Token set, checking onboarding status');

        if (response.onboardingCompleted === false) {
          navigate('/onboarding');
        } else {
          navigate('/dashboard');
        }
      } else {
        setError('Invalid response from server');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err?.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-container">
      <div className="geometric-bg">
        <div className="geometric-shape shape-1"></div>
        <div className="geometric-shape shape-2"></div>
        <div className="geometric-shape shape-3"></div>
      </div>

      <div className="auth-card">
        <div className="auth-header">
          <img src={logoImg} alt="" className="auth-logo" />
          <h2 className="auth-title">Welcome back</h2>
          <p className="auth-subtitle">Sign in to continue building amazing resumes</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="input-group">
            <label className="input-label">Email</label>
            <div className="input-wrapper">
              <Icons.mail className="input-icon" size={18} />
              <input
                type="email"
                className="input-field with-icon"
                placeholder="Enter your email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Password</label>
            <div className="input-wrapper">
              <Icons.lock className="input-icon" size={18} />
              <input
                type="password"
                className="input-field with-icon"
                placeholder="Enter your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          {error && (
            <div className="error-message">
              <Icons.alertCircle size={16} />
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn btn-primary btn-full">
            {loading ? (
              <>
                <Icons.loader className="animate-spin mr-2" size={18} />
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>

          <div className="auth-footer">
            <p>
              Don't have an account?{' '}
              <Link to="/signup" className="link">
                Sign up
              </Link>
            </p>
            <Link to="/forgot-password" className="link text-sm">
              Forgot password?
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

// Signup Component
function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.signup(email, password);

      if (response.token) {
        setToken(response.token);
        navigate('/onboarding');
      }
    } catch (err: any) {
      console.error('Signup error:', err);
      setError(err?.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-container">
      <div className="geometric-bg">
        <div className="geometric-shape shape-1"></div>
        <div className="geometric-shape shape-2"></div>
        <div className="geometric-shape shape-3"></div>
      </div>

      <div className="auth-card">
        <div className="auth-header">
          <img src={logoImg} alt="" className="auth-logo" />
          <h2 className="auth-title">Create your account</h2>
          <p className="auth-subtitle">Start building ATS-optimized resumes today</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="input-group">
            <label className="input-label">Email</label>
            <div className="input-wrapper">
              <Icons.mail className="input-icon" size={18} />
              <input
                type="email"
                className="input-field with-icon"
                placeholder="Enter your email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Password</label>
            <div className="input-wrapper">
              <Icons.lock className="input-icon" size={18} />
              <input
                type="password"
                className="input-field with-icon"
                placeholder="Create a strong password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Confirm Password</label>
            <div className="input-wrapper">
              <Icons.lock className="input-icon" size={18} />
              <input
                type="password"
                className="input-field with-icon"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
              />
            </div>
          </div>

          {error && (
            <div className="error-message">
              <Icons.alertCircle size={16} />
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn btn-primary btn-full">
            {loading ? (
              <>
                <Icons.loader className="animate-spin mr-2" size={18} />
                Creating account...
              </>
            ) : (
              'Sign Up'
            )}
          </button>

          <div className="auth-footer">
            <p>
              Already have an account?{' '}
              <Link to="/login" className="link">
                Sign in
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}

// NEW Improved Onboarding Component with split-screen
function Onboarding() {
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
                    <input type="email" defaultValue={parsedData.email || ''} placeholder="your@email.com" />
                  </div>
                  <div className="info-item">
                    <label>Phone</label>
                    <input type="tel" defaultValue={parsedData.phone || ''} placeholder="+1 (555) 123-4567" />
                  </div>
                  <div className="info-item">
                    <label>Location</label>
                    <input type="text" defaultValue={parsedData.location || ''} placeholder="City, State" />
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

// Memory & Profile Component with OPEN TEXT AREA
function MemoryProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [memoryText, setMemoryText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      const data = await api.getProfile();
      if (data) {
        setProfile(data);
        // Combine all profile data into memory text
        let memory = '';
        if (data.name) memory += `Name: ${data.name}\n`;
        if (data.email) memory += `Email: ${data.email}\n`;
        if (data.phone) memory += `Phone: ${data.phone}\n`;
        if (data.location) memory += `Location: ${data.location}\n`;
        if (data.linkedin) memory += `LinkedIn: ${data.linkedin}\n`;
        if (data.website) memory += `Website: ${data.website}\n`;
        if (data.summary) memory += `\nSummary:\n${data.summary}\n`;
        if (data.skills && data.skills.length > 0) memory += `\nSkills:\n${data.skills.join(', ')}\n`;
        if (data.resumeText) memory += `\nAdditional Information:\n${data.resumeText}\n`;
        if (data.resumeText) memory += `\n---Resume Content---\n${data.resumeText}`;
        setMemoryText(memory);
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
      // Parse the memory text to extract structured data if possible
      const lines = memoryText.split('\n');
      const updatedProfile: any = { ...profile };

      // Try to extract structured data from the text
      lines.forEach(line => {
        if (line.startsWith('Name:')) updatedProfile.name = line.replace('Name:', '').trim();
        if (line.startsWith('Email:')) updatedProfile.email = line.replace('Email:', '').trim();
        if (line.startsWith('Phone:')) updatedProfile.phone = line.replace('Phone:', '').trim();
        if (line.startsWith('Location:')) updatedProfile.location = line.replace('Location:', '').trim();
        if (line.startsWith('LinkedIn:')) updatedProfile.linkedin = line.replace('LinkedIn:', '').trim();
        if (line.startsWith('Website:')) updatedProfile.website = line.replace('Website:', '').trim();
      });

      // Store the entire memory text as additional info
      updatedProfile.resumeText = memoryText;

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
    <div className="memory-container">
      <div className="page-header">
        <div className="page-header-content">
          <h1 className="page-title">Memory & Profile</h1>
          <p className="page-subtitle">
            This is your personal space. Write anything about yourself - the more information you provide,
            the better we can tailor your resumes. Feel free to update this anytime.
          </p>
        </div>
      </div>

      <div className="memory-content">
        <textarea
          className="memory-textarea"
          value={memoryText}
          onChange={(e) => setMemoryText(e.target.value)}
          placeholder="Tell us everything about yourself...

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

Example format (but feel free to write in any format you prefer):

Name: John Doe
Email: john@example.com
Phone: (555) 123-4567
Location: San Francisco, CA

I'm a seasoned software engineer with 10+ years of experience...
"
        />
      </div>

      {error && (
        <div className="error-message">
          <Icons.alertCircle size={16} />
          {error}
        </div>
      )}

      {success && (
        <div className="success-message">
          <Icons.checkCircle size={16} />
          Profile saved successfully!
        </div>
      )}

      <div className="memory-actions">
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn btn-primary"
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
  );
}

// Dashboard Component with HORIZONTAL LAYOUT
function Dashboard() {
  const [quota, setQuota] = useState<Quota | null>(null);
  const [resumes, setResumes] = useState<ResumeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    try {
      const [quotaData, resumesData] = await Promise.all([
        api.getQuota(),
        api.getResumes()
      ]);
      setQuota(quotaData);
      setResumes(resumesData || []);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  }

  const downloadResume = async (fileName: string) => {
    try {
      const blob = await api.downloadResume(fileName);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download resume:', err);
    }
  };

  const getATSScore = () => {
    return 75 + Math.floor(Math.random() * 20);
  };

  const getStatus = () => {
    const statuses = ['Completed', 'Submitted', 'In Review'];
    return statuses[Math.floor(Math.random() * statuses.length)];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <main className="dashboard-main">
      {/* KPI Cards Row */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div>
            <p className="kpi-label">Resume Credits Left</p>
            <p className="kpi-value">{quota?.remaining || 9}</p>
          </div>
        </div>

        <div className="kpi-card">
          <div>
            <p className="kpi-label">Total Resumes Generated</p>
            <p className="kpi-value">{resumes.length || 1}</p>
          </div>
        </div>

        <div className="kpi-card">
          <div>
            <p className="kpi-label">Average ATS Score</p>
            <p className="kpi-value">85%</p>
          </div>
        </div>
      </div>

      {/* Recent Resumes Table */}
      <div className="table-wrapper">
        <div className="table-header-bar">
          <h2 className="table-title">Recent Resumes</h2>
        </div>

        {resumes.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr className="table-head-row">
                <th className="table-head-cell">Company</th>
                <th className="table-head-cell">Role</th>
                <th className="table-head-cell">Created</th>
                <th className="table-head-cell">ATS Score</th>
                <th className="table-head-cell">Status</th>
                <th className="table-head-cell">Actions</th>
              </tr>
            </thead>
            <tbody>
              {resumes.slice(0, 10).map((resume, idx) => {
                const score = getATSScore();
                const status = getStatus();
                return (
                  <tr key={idx} className="table-body-row">
                    <td className="table-body-cell font-medium">{resume.company || 'Unknown'}</td>
                    <td className="table-body-cell">{resume.role || 'N/A'}</td>
                    <td className="table-body-cell">
                      {resume.createdAt ? new Date(resume.createdAt).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="table-body-cell">
                      <div className="flex items-center gap-2">
                        <div className="ats-bar">
                          <div
                            className="ats-fill"
                            style={{
                              width: `${score}%`,
                              backgroundColor: score >= 80 ? '#10b981' : score >= 60 ? '#ff6b35' : '#ef4444'
                            }}
                          />
                        </div>
                        <span className="text-sm font-medium">{score}</span>
                      </div>
                    </td>
                    <td className="table-body-cell">
                      <span className={`status-tag ${
                        status === 'Completed' ? 'status-completed' :
                        status === 'Submitted' ? 'status-submitted' :
                        'status-review'
                      }`}>
                        {status}
                      </span>
                    </td>
                    <td className="table-body-cell">
                      <button
                        onClick={() => downloadResume(resume.fileName)}
                        className="view-btn"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="empty-container">
            <svg className="empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="empty-title">No resumes yet</h3>
            <p className="empty-text">Generate your first resume to get started</p>
            <button
              onClick={() => navigate('/generate')}
              className="generate-btn"
            >
              Generate Your First Resume
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

// Generate Resume Component with improved job extraction
function GenerateResume() {
  const [jobDescription, setJobDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [pollInterval, setPollInterval] = useState<any>(null);
  const navigate = useNavigate();

  // Extract company name from job description
  const extractCompanyInfo = (description: string) => {
    const companyPatterns = [
      /company:\s*([^\n,]+)/i,
      /employer:\s*([^\n,]+)/i,
      /organization:\s*([^\n,]+)/i,
      /about\s+([^:\n]+):/i,
      /at\s+([A-Z][A-Za-z\s&]+(?:Inc|LLC|Ltd|Corp|Company))/,
    ];

    for (const pattern of companyPatterns) {
      const match = description.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    // Try to extract from the first line
    const firstLine = description.split('\n')[0];
    if (firstLine && firstLine.length < 100) {
      return firstLine.replace(/[^\w\s&]/g, '').trim();
    }

    return '';
  };

  // Extract role/position from job description
  const extractRole = (description: string) => {
    const rolePatterns = [
      /position:\s*([^\n,]+)/i,
      /role:\s*([^\n,]+)/i,
      /title:\s*([^\n,]+)/i,
      /job\s+title:\s*([^\n,]+)/i,
      /seeking\s+(?:a|an)\s+([^\n,]+)/i,
    ];

    for (const pattern of rolePatterns) {
      const match = description.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    return '';
  };

  async function handleGenerate() {
    if (!jobDescription.trim()) {
      setError('Please enter a job description');
      return;
    }

    setLoading(true);
    setError(null);
    setProgress(0);

    try {
      const company = extractCompanyInfo(jobDescription);
      const role = extractRole(jobDescription);

      const response = await api.generateResume('', {
        description: jobDescription,
        company,
        role
      });

      if (!response.jobId) {
        throw new Error('Failed to start job - no jobId received');
      }

      // Use SSE for real-time updates
      const eventSource = new EventSource(`${api.base}/generate/job/${response.jobId}`);

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === 'status') {
          if (data.data?.progress) {
            setProgress(data.data.progress);
          }
          if (data.data?.message) {
            console.log('Job status:', data.data.message);
          }
        } else if (data.type === 'complete') {
          eventSource.close();
          setProgress(100);

          // Download the resume
          if (data.data?.fileName) {
            api.downloadResume(data.data.fileName).then(blob => {
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = data.data.fileName;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              window.URL.revokeObjectURL(url);

              // Navigate to dashboard after a short delay
              setTimeout(() => navigate('/dashboard'), 1000);
            });
          }
        } else if (data.type === 'error') {
          eventSource.close();
          setError(data.data?.error || 'Failed to generate resume');
          setLoading(false);
        }
      };

      eventSource.onerror = (err) => {
        console.error('SSE error:', err);
        eventSource.close();
        setError('Connection lost. Please try again.');
        setLoading(false);
      };

      // Store eventSource for cleanup
      setPollInterval(eventSource as any);
    } catch (err: any) {
      console.error('Generation error:', err);
      setError(err?.message || 'Failed to generate resume');
      setLoading(false);
    }
  }

  // Cleanup SSE connection on unmount
  useEffect(() => {
    return () => {
      if (pollInterval) {
        if (typeof (pollInterval as any).close === 'function') {
          (pollInterval as any).close();
        } else {
          clearInterval(pollInterval);
        }
      }
    };
  }, [pollInterval]);

  return (
    <div className="generate-container">
      <div className="page-header">
        <div className="page-header-content">
          <h1 className="page-title">Generate Resume</h1>
          <p className="page-subtitle">Create an ATS-optimized resume for any job posting</p>
        </div>
      </div>

      <div className="generate-card">
        <div className="input-group">
          <label className="input-label">
            <Icons.briefcase size={18} className="inline mr-2" />
            Job Description
          </label>
          <textarea
            className="job-textarea"
            rows={12}
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste the complete job description here...

Include:
• Company name
• Job title/role
• Responsibilities
• Requirements
• Benefits

The more details you provide, the better tailored your resume will be!"
            disabled={loading}
          />
        </div>

        {loading && (
          <div className="progress-container">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }}></div>
            </div>
            <p className="progress-text">Generating your resume... {progress}%</p>
          </div>
        )}

        {error && (
          <div className="error-message">
            <Icons.alertCircle size={16} />
            {error}
          </div>
        )}

        <div className="generate-actions">
          <button
            onClick={handleGenerate}
            disabled={loading || !jobDescription.trim()}
            className="btn btn-primary"
          >
            {loading ? (
              <>
                <Icons.loader className="animate-spin mr-2" size={18} />
                Generating...
              </>
            ) : (
              <>
                <Icons.zap size={18} className="mr-2" />
                Generate Resume
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Main App Component
export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    setIsAuthenticated(!!token);
    setLoading(false);
  }, []);

  const handleLogout = () => {
    clearAuth();
    setIsAuthenticated(false);
    navigate('/');
  };

  // Protected route wrapper
  const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    if (loading) {
      return (
        <div className="loading-container">
          <Icons.loader className="animate-spin" size={48} />
        </div>
      );
    }

    if (!isAuthenticated) {
      return <Navigate to="/login" />;
    }

    return <>{children}</>;
  };

  // Dashboard layout wrapper
  const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
    return (
      <div className="app-container">
        <aside className="sidebar">
          <div className="sidebar-header">
            <img src={logoImg} alt="Resume AI" className="sidebar-logo" />
          </div>

          <nav className="sidebar-nav">
            <Link
              to="/dashboard"
              className={`sidebar-item ${location.pathname === '/dashboard' ? 'active' : ''}`}
            >
              <Icons.barChart2 className="sidebar-icon" size={18} /> Dashboard
            </Link>
            <Link
              to="/profile"
              className={`sidebar-item ${location.pathname === '/profile' ? 'active' : ''}`}
            >
              <Icons.user className="sidebar-icon" size={18} /> Memory & Profile
            </Link>
            <Link
              to="/generate"
              className={`sidebar-item ${location.pathname === '/generate' ? 'active' : ''}`}
            >
              <Icons.zap className="sidebar-icon" size={18} /> Generate Resume
            </Link>
            <Link
              to="/history"
              className={`sidebar-item ${location.pathname === '/history' ? 'active' : ''}`}
            >
              <Icons.clock className="sidebar-icon" size={18} /> History
            </Link>
            <Link
              to="/extension"
              className={`sidebar-item ${location.pathname === '/extension' ? 'active' : ''}`}
            >
              <Icons.settings className="sidebar-icon" size={18} /> Extension
            </Link>
          </nav>

          <div className="sidebar-footer">
            <button onClick={handleLogout} className="sidebar-item logout">
              <Icons.logOut className="sidebar-icon" size={18} /> Log Out
            </button>
          </div>
        </aside>

        <main className="main-content">
          {children}
        </main>
      </div>
    );
  };

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/onboarding" element={
        <ProtectedRoute>
          <Onboarding />
        </ProtectedRoute>
      } />
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <DashboardLayout>
            <Dashboard />
          </DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/profile" element={
        <ProtectedRoute>
          <DashboardLayout>
            <MemoryProfile />
          </DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/generate" element={
        <ProtectedRoute>
          <DashboardLayout>
            <GenerateResume />
          </DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/history" element={
        <ProtectedRoute>
          <DashboardLayout>
            <div className="page-container">
              <h1 className="page-title">History</h1>
              <p className="page-subtitle">View your resume generation history</p>
            </div>
          </DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/extension" element={
        <ProtectedRoute>
          <DashboardLayout>
            <div className="page-container">
              <h1 className="page-title">Extension</h1>
              <p className="page-subtitle">Download and configure the browser extension</p>
            </div>
          </DashboardLayout>
        </ProtectedRoute>
      } />
    </Routes>
  );
}