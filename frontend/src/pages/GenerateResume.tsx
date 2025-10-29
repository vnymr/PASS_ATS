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
    <div className="w-full bg-background text-text px-4 pt-[88px] pb-8 lg:px-6">
      {/* Header Section */}
      <div className="max-w-[960px] mx-auto mb-6">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-[var(--primary-50)] text-[var(--primary)]">
            <Icons.zap size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Generate Resume</h1>
            <p className="text-sm text-[var(--gray-600)]">
              Tailor your resume to any job description in seconds using AI
            </p>
          </div>
        </div>
      </div>

      {/* Resume Profile Status */}
      {!resumeText && (
        <div className="max-w-[960px] mx-auto mb-4 flex items-center gap-2 rounded-xl border border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.08)] px-4 py-3 text-[13px] text-[#92400e]">
          <Icons.alertCircle size={18} />
          <div className="flex items-center flex-wrap gap-1">
            <span>Please set up your resume text in your</span>
            <button
              className="underline decoration-[var(--primary)] underline-offset-4 text-primary font-semibold"
              onClick={() => navigate('/profile')}
            >
              profile
            </button>
            <span>first.</span>
          </div>
        </div>
      )}

      {/* Status Messages */}
      {error && (
        <div className="max-w-[960px] mx-auto mb-4 flex items-center gap-2 rounded-xl border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.08)] px-4 py-3 text-[13px] text-[#b91c1c]">
          <Icons.alertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="max-w-[960px] mx-auto mb-4 flex items-center gap-2 rounded-xl border border-[rgba(34,197,94,0.35)] bg-[rgba(34,197,94,0.08)] px-4 py-3 text-[13px] text-[#166534]">
          <Icons.checkCircle size={18} />
          <span>Resume generated and downloaded successfully!</span>
        </div>
      )}

      {/* Generation Form */}
      <div className="max-w-[960px] mx-auto">
        <div className="bg-elevated rounded-2xl border border-[rgba(12,19,16,0.06)] shadow-sm p-4 sm:p-5">
          {/* Job Description Section */}
          <div className="space-y-2">
            <label htmlFor="job-description" className="text-sm font-semibold flex items-center gap-2">
              <Icons.fileText size={16} />
              Job Description
            </label>
            <textarea
              id="job-description"
              className="min-h-[220px] w-full rounded-xl border border-[rgba(12,19,16,0.12)] bg-background px-3 py-2 text-sm text-text placeholder:text-[var(--gray-500)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] disabled:opacity-60"
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste the complete job description here..."
              disabled={isGenerating}
              aria-describedby="job-desc-help"
            />
            <p id="job-desc-help" className="text-xs text-[var(--gray-600)]">Include the responsibilities and requirements for the role.</p>
          </div>

          {/* Generation Actions */}
          <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
            <div className="text-xs text-[var(--gray-600)]">Press Enter to generate, Shift+Enter for a new line.</div>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-[var(--background-elevated)] font-semibold h-11 px-5 disabled:opacity-60 disabled:cursor-not-allowed"
              onClick={handleGenerate}
              disabled={isGenerating || !resumeText || !jobDescription}
            >
              {isGenerating ? (
                <>
                  <Icons.loader className="animate-spin" size={18} />
                  Generating…
                </>
              ) : (
                <>
                  <Icons.zap size={18} />
                  Generate Tailored Resume
                </>
              )}
            </button>
          </div>

          {/* Generation Status */}
          {isGenerating && (
            <div className="mt-4 rounded-xl border border-[rgba(12,19,16,0.08)] bg-background p-4">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-lg bg-[var(--primary-50)] text-[var(--primary)] flex items-center justify-center">
                  <Icons.loader className="animate-spin" size={18} />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold">AI is working its magic…</h4>
                  <p className="text-xs text-[var(--gray-600)]">Analyzing job requirements and tailoring your resume</p>
                  <div className="mt-3">
                    <div className="h-2 w-full rounded-full bg-[rgba(28,63,64,0.10)] overflow-hidden">
                      <div className="h-2 w-1/2 rounded-full bg-primary animate-pulse" />
                    </div>
                    <span className="mt-2 block text-[11px] text-[var(--gray-600)]">This usually takes less than 10 seconds</span>
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