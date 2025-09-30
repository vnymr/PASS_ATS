// ONBOARDING TEMPORARILY DISABLED
// This component is currently bypassed in the user flow.
// Backend endpoints (/api/profile, /api/upload/resume, /api/analyze/public) remain intact and functional.
// To re-enable: Set ONBOARDING_ENABLED=true in ProtectedRoute.tsx and uncomment the route in App.tsx

// Completely redesigned onboarding component with improved data flow

import React, { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { useOnboarding } from '../contexts/OnboardingContext';
import { OnboardingService, setClerkGetToken } from '../services/onboardingService-clerk';
import Icons from '../components/ui/icons';

export default function OnboardingNew() {
  const navigate = useNavigate();
  const {
    state,
    dispatch,
    validation,
    progress,
    loadFromStorage,
    clearStorage,
    canProceed,
    getStepStatus
  } = useOnboarding();
  const { getToken } = useAuth();

  // Set up Clerk token getter for the service
  useEffect(() => {
    setClerkGetToken(getToken);
  }, [getToken]);

  // Load saved data on mount
  useEffect(() => {
    loadFromStorage();
  }, []); // Empty dependency array to run only once on mount

  // Handle file selection
  const handleFileSelect = useCallback((file: File) => {
    const validTypes = [
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (!validTypes.includes(file.type)) {
      dispatch({
        type: 'SET_UPLOAD_ERROR',
        payload: 'Please upload a PDF, TXT, DOC, or DOCX file'
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      dispatch({
        type: 'SET_UPLOAD_ERROR',
        payload: 'File size must be less than 5MB'
      });
      return;
    }

    dispatch({ type: 'SET_FILE', payload: file });
  }, [dispatch]);

  // Handle file upload and analysis
  const handleUploadAndAnalyze = useCallback(async () => {
    if (!state.fileUpload.file) return;

    try {
      dispatch({ type: 'SET_UPLOADING', payload: true });
      dispatch({ type: 'SET_UPLOAD_ERROR', payload: null });

      // Upload file
      const uploadResult = await OnboardingService.uploadResume(
        state.fileUpload.file,
        (progress) => dispatch({ type: 'SET_UPLOAD_PROGRESS', payload: progress })
      );

      dispatch({ type: 'SET_UPLOADING', payload: false });

      // Analyze resume
      dispatch({ type: 'SET_ANALYZING', payload: true });
      dispatch({ type: 'SET_ANALYSIS_ERROR', payload: null });

      const analysisResult = await OnboardingService.analyzeResume(uploadResult.text);

      // Ensure resumeText is carried forward for saving
      const enriched = { ...analysisResult.data, resumeText: uploadResult.text } as any;
      dispatch({ type: 'SET_ANALYSIS_RESULT', payload: enriched });
      dispatch({ type: 'SET_STEP', payload: 2 });

    } catch (error) {
      console.error('Upload/Analysis error:', error);
      const errorMessage = OnboardingService.getErrorMessage(error);
      
      if (state.fileUpload.isUploading) {
        dispatch({ type: 'SET_UPLOAD_ERROR', payload: errorMessage });
      } else {
        dispatch({ type: 'SET_ANALYSIS_ERROR', payload: errorMessage });
      }
    }
  }, [state.fileUpload.file, dispatch]);

  // Handle additional info processing
  const handleAdditionalInfoChange = useCallback((text: string) => {
    dispatch({ type: 'SET_ADDITIONAL_INFO', payload: text });
  }, [dispatch]);

  // Handle profile completion
  const handleComplete = useCallback(async () => {
    if (!state.parsedData) return;

    try {
      dispatch({ type: 'SET_COMPLETING', payload: true });
      dispatch({ type: 'SET_COMPLETION_ERROR', payload: null });

      // Process additional info if provided
      let finalProfile = state.parsedData;
      if (state.additionalInfo.text.trim()) {
        finalProfile = await OnboardingService.processAdditionalInfo(
          state.parsedData,
          state.additionalInfo.text
        );
      }

      // Update profile
      await OnboardingService.updateProfile(finalProfile);

      // Clear local storage and navigate
      clearStorage();
      
      // Check if there was an intended destination
      const intendedDestination = sessionStorage.getItem('intendedDestination');
      if (intendedDestination) {
        sessionStorage.removeItem('intendedDestination');
        navigate(intendedDestination);
      } else {
        navigate('/dashboard');
      }

    } catch (error) {
      console.error('Completion error:', error);
      const errorMessage = OnboardingService.getErrorMessage(error);
      dispatch({ type: 'SET_COMPLETION_ERROR', payload: errorMessage });
    }
  }, [state.parsedData, state.additionalInfo.text, dispatch, clearStorage, navigate]);

  // Handle step navigation
  const handleNext = useCallback(() => {
    if (state.currentStep < 3 && canProceed()) {
      dispatch({ type: 'SET_STEP', payload: state.currentStep + 1 });
    }
  }, [state.currentStep, canProceed, dispatch]);

  const handlePrevious = useCallback(() => {
    if (state.currentStep > 1) {
      dispatch({ type: 'SET_STEP', payload: state.currentStep - 1 });
    }
  }, [state.currentStep, dispatch]);

  const handleSkip = useCallback(() => {
    clearStorage();
    
    // Check if there was an intended destination
    const intendedDestination = sessionStorage.getItem('intendedDestination');
    if (intendedDestination) {
      sessionStorage.removeItem('intendedDestination');
      navigate(intendedDestination);
    } else {
      navigate('/dashboard');
    }
  }, [clearStorage, navigate]);

  // Render step indicator
  const renderStepIndicator = () => (
    <div className="onboarding-steps">
      {state.steps.map((step, index) => {
        const status = getStepStatus(step.id);
        return (
          <React.Fragment key={step.id}>
            <div className={`step ${status}`}>
              <span className="step-number">
                {status === 'completed' ? <Icons.check size={16} /> : step.id}
              </span>
              <span className="step-label">{step.title}</span>
            </div>
            {index < state.steps.length - 1 && <div className="step-line" />}
          </React.Fragment>
        );
      })}
    </div>
  );

  // Render progress bar
  const renderProgressBar = () => {
    if (!progress) return null;

    return (
      <div className="progress-container">
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ width: `${progress.percentage}%` }}
          />
        </div>
        <div className={`progress-message ${progress.isError ? 'error' : ''}`}>
          {progress.message}
        </div>
      </div>
    );
  };

  // Render step 1: File upload
  const renderStep1 = () => (
    <div className="onboarding-content-full">
      <h1 className="onboarding-title">Welcome! Let's get started</h1>
      <p className="onboarding-subtitle">
        Upload your current resume to quickly populate your profile
      </p>

      <div className="upload-zone-container">
        <div
          className={`upload-zone ${state.fileUpload.file ? 'has-file' : ''}`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file) handleFileSelect(file);
          }}
        >
          <input
            type="file"
            id="resume-upload"
            className="hidden"
            accept=".pdf,.txt,.doc,.docx"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelect(file);
            }}
          />

          {state.fileUpload.file ? (
            <div className="file-preview">
              <Icons.fileText size={48} className="file-icon" />
              <div className="file-details">
                <p className="file-name">{state.fileUpload.file.name}</p>
                <p className="file-size">
                  {(state.fileUpload.file.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <button
                onClick={() => dispatch({ type: 'SET_FILE', payload: null })}
                className="btn btn-ghost btn-sm"
              >
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

        {state.fileUpload.error && (
          <div className="error-message">
            <Icons.alertCircle size={16} />
            {state.fileUpload.error}
          </div>
        )}

        {renderProgressBar()}
      </div>

      <div className="onboarding-actions">
        <button onClick={handleSkip} className="btn btn-ghost">
          Skip for now
        </button>
        <button
          onClick={handleUploadAndAnalyze}
          disabled={!state.fileUpload.file || state.fileUpload.isUploading || state.resumeAnalysis.isAnalyzing}
          className="btn btn-primary"
        >
          {state.fileUpload.isUploading || state.resumeAnalysis.isAnalyzing ? (
            <>
              <Icons.loader className="animate-spin mr-2" size={18} />
              {state.fileUpload.isUploading ? 'Uploading...' : 'Analyzing...'}
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
  );

  // Render step 2: Review and edit
  const renderStep2 = () => {
    if (!state.parsedData) return null;

    return (
      <div className="onboarding-split">
        <div className="split-left">
          <h2 className="split-title">Review your information</h2>
          <p className="split-subtitle">
            We've extracted the following from your resume. Review and edit as needed.
          </p>

          {validation && (
            <div className={`validation-summary ${validation.isValid ? 'valid' : 'invalid'}`}>
              <div className="validation-header">
                <Icons.checkCircle size={20} className="validation-icon" />
                <span>Profile Quality: {validation.qualityScore}/100</span>
              </div>
              {validation.errors.length > 0 && (
                <div className="validation-errors">
                  {validation.errors.slice(0, 3).map((error, idx) => (
                    <div key={idx} className={`validation-error ${error.severity}`}>
                      {error.message}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="extracted-info">
            <div className="info-section">
              <Icons.user size={18} className="section-icon" />
              <h3>Personal Information</h3>
              <div className="info-grid">
                <div className="info-item">
                  <label>Name</label>
                  <input
                    type="text"
                    value={state.parsedData.name || ''}
                    onChange={(e) => dispatch({
                      type: 'UPDATE_PARSED_DATA',
                      payload: { name: e.target.value }
                    })}
                    placeholder="Your name"
                  />
                </div>
                <div className="info-item">
                  <label>Email</label>
                  <input
                    type="email"
                    value={state.parsedData.email || ''}
                    onChange={(e) => dispatch({
                      type: 'UPDATE_PARSED_DATA',
                      payload: { email: e.target.value }
                    })}
                    placeholder="your@email.com"
                  />
                </div>
                <div className="info-item">
                  <label>Phone</label>
                  <input
                    type="tel"
                    value={state.parsedData.phone || ''}
                    onChange={(e) => dispatch({
                      type: 'UPDATE_PARSED_DATA',
                      payload: { phone: e.target.value }
                    })}
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
                <div className="info-item">
                  <label>Location</label>
                  <input
                    type="text"
                    value={state.parsedData.location || ''}
                    onChange={(e) => dispatch({
                      type: 'UPDATE_PARSED_DATA',
                      payload: { location: e.target.value }
                    })}
                    placeholder="City, State"
                  />
                </div>
              </div>
            </div>

            <div className="info-section">
              <Icons.fileText size={18} className="section-icon" />
              <h3>Professional Summary</h3>
              <textarea
                value={state.parsedData.summary || ''}
                onChange={(e) => dispatch({
                  type: 'UPDATE_PARSED_DATA',
                  payload: { summary: e.target.value }
                })}
                placeholder="Your professional summary..."
                rows={4}
              />
            </div>

            {state.parsedData.skills && state.parsedData.skills.length > 0 && (
              <div className="info-section">
                <Icons.award size={18} className="section-icon" />
                <h3>Skills ({state.parsedData.skills.length})</h3>
                <div className="skills-tags">
                  {state.parsedData.skills.map((skill, idx) => (
                    <span key={idx} className="skill-tag">{skill}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="split-right">
          <h2 className="split-title">Tell us more</h2>
          <p className="split-subtitle">
            Add any additional information to help us create better tailored resumes.
          </p>

          <div className="additional-info-container">
            <textarea
              className="additional-info-textarea"
              placeholder="Share anything else about yourself - achievements, certifications, preferences, career goals, specific skills, or any context that would help us create better resumes for you..."
              value={state.additionalInfo.text}
              onChange={(e) => handleAdditionalInfoChange(e.target.value)}
              rows={20}
            />
          </div>

          {state.resumeAnalysis.error && (
            <div className="error-message">
              <Icons.alertCircle size={16} />
              {state.resumeAnalysis.error}
            </div>
          )}

          <div className="onboarding-actions">
            <button onClick={handlePrevious} className="btn btn-ghost">
              <Icons.chevronLeft size={18} className="mr-2" />
              Back
            </button>
            <button
              onClick={handleNext}
              disabled={!canProceed()}
              className="btn btn-primary"
            >
              Continue
              <Icons.chevronRight size={18} className="ml-2" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Render step 3: Complete
  const renderStep3 = () => (
    <div className="onboarding-content-full">
      <h1 className="onboarding-title">Almost done!</h1>
      <p className="onboarding-subtitle">
        Review your profile and complete the setup
      </p>

      {validation && (
        <div className="final-validation">
          <div className="validation-card">
            <h3>Profile Summary</h3>
            <div className="validation-stats">
              <div className="stat">
                <span className="stat-label">Quality Score</span>
                <span className="stat-value">{validation.qualityScore}/100</span>
              </div>
              <div className="stat">
                <span className="stat-label">Skills</span>
                <span className="stat-value">{state.parsedData?.skills?.length || 0}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Experience</span>
                <span className="stat-value">{state.parsedData?.experiences?.length || 0}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {state.completionError && (
        <div className="error-message">
          <Icons.alertCircle size={16} />
          {state.completionError}
        </div>
      )}

      {renderProgressBar()}

      <div className="onboarding-actions">
        <button onClick={handlePrevious} className="btn btn-ghost">
          <Icons.chevronLeft size={18} className="mr-2" />
          Back
        </button>
        <button
          onClick={handleComplete}
          disabled={state.isCompleting || !canProceed()}
          className="btn btn-primary"
        >
          {state.isCompleting ? (
            <>
              <Icons.loader className="animate-spin mr-2" size={18} />
              Completing...
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
  );

  return (
    <div className="onboarding-container">
      {renderStepIndicator()}
      
      {state.currentStep === 1 && renderStep1()}
      {state.currentStep === 2 && renderStep2()}
      {state.currentStep === 3 && renderStep3()}
    </div>
  );
}


