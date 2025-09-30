import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api-adapter';
import Icons from '../components/ui/icons';

export default function GenerateResume() {
  const navigate = useNavigate();
  const [resumeText, setResumeText] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Load user's resume text from profile
  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const profile = await api.getProfile();
      if (profile?.resumeText) {
        setResumeText(profile.resumeText);
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
    }
  };

  const handleGenerate = async () => {
    if (!resumeText) {
      setError('Please set up your resume text in your profile first');
      return;
    }
    if (!jobDescription) {
      setError('Please provide a job description');
      return;
    }

    setIsGenerating(true);
    setError('');
    setSuccess(false);

    try {
      // Use api-adapter.ts signature: generateResume(jobUrl, jobDetails)
      const result = await api.generateResume('', {
        description: jobDescription,
        role: '',
        company: '',
        matchMode: 'balanced'
      });

      if (result.jobId) {
        setSuccess(true);
        // Clear the job description for next generation
        setJobDescription('');

        // Show success message
        setTimeout(() => setSuccess(false), 5000);
      } else {
        setError('Failed to generate resume');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate resume');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="generate-container">
      {/* Header Section */}
      <div className="generate-header">
        <div className="generate-header-content">
          <div className="generate-header-icon">
            <Icons.zap size={32} />
          </div>
          <div className="generate-header-text">
            <h1 className="generate-title">Generate Resume</h1>
            <p className="generate-subtitle">
              Tailor your resume to any job description in seconds using AI
            </p>
          </div>
        </div>
      </div>

      {/* Resume Profile Status */}
      {!resumeText && (
        <div className="status-message warning-message">
          <Icons.alertCircle size={20} />
          <span>Please set up your resume text in your </span>
          <button 
            className="link-button"
            onClick={() => navigate('/profile')}
          >
            profile
          </button>
          <span> first</span>
        </div>
      )}

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
          <span>Resume generated and downloaded successfully!</span>
        </div>
      )}

      {/* Generation Form */}
      <div className="generate-form-container">
        <div className="generate-form">
          {/* Job Description Section */}
          <div className="form-card">
            <div className="form-card-content">
              <div className="form-field">
                <label className="form-label">
                  <Icons.fileText size={16} />
                  Job Description
                </label>
                <textarea
                  className="form-textarea generate-textarea"
                  rows={12}
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Paste the complete job description here..."
                  disabled={isGenerating}
                />
              </div>
            </div>
          </div>

          {/* Generation Actions */}
          <div className="generate-actions">
            <button
              className="btn btn-primary btn-large btn-generate"
              onClick={handleGenerate}
              disabled={isGenerating || !resumeText || !jobDescription}
            >
              {isGenerating ? (
                <>
                  <Icons.loader className="animate-spin mr-2" size={20} />
                  Generating Resume...
                </>
              ) : (
                <>
                  <Icons.zap size={20} className="mr-2" />
                  Generate Tailored Resume
                </>
              )}
            </button>
          </div>

          {/* Generation Status */}
          {isGenerating && (
            <div className="generation-status">
              <div className="generation-status-content">
                <div className="generation-status-icon">
                  <Icons.loader className="animate-spin" size={24} />
                </div>
                <div className="generation-status-text">
                  <h4 className="generation-status-title">AI is working its magic...</h4>
                  <p className="generation-status-subtitle">
                    Analyzing job requirements and tailoring your resume
                  </p>
                  <div className="generation-progress">
                    <div className="generation-progress-bar">
                      <div className="generation-progress-fill"></div>
                    </div>
                    <span className="generation-progress-text">This usually takes less than 10 seconds</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}