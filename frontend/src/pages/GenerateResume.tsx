import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api-adapter';
import Icons from '../components/ui/icons';
import logger from '../utils/logger';
import MinimalTextArea from '../components/MinimalTextArea';
import { motion, AnimatePresence } from 'framer-motion';

export default function GenerateResume() {
  const navigate = useNavigate();
  const [resumeText, setResumeText] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [generatedResume, setGeneratedResume] = useState('');
  const [jobId, setJobId] = useState('');
  const [tailoringDetails, setTailoringDetails] = useState<string[]>([]);

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
      logger.error('Failed to load profile', err);
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
    setGeneratedResume('');

    try {
      // Show initial tailoring steps
      setTailoringDetails([
        'Analyzing job requirements and key skills',
        'Matching your experience to job description',
        'Optimizing keywords for ATS compatibility'
      ]);

      // Use api-adapter.ts signature: generateResume(jobUrl, jobDetails)
      const result = await api.generateResume('', {
        description: jobDescription,
        role: '',
        company: '',
        matchMode: 'balanced'
      });

      if (result.jobId) {
        setJobId(result.jobId);
        setSuccess(true);
        setGeneratedResume('Your tailored resume has been generated successfully!');

        // Add completion details
        setTailoringDetails([
          'Job requirements analyzed',
          'Experience matched and optimized',
          'ATS keywords integrated',
          'Resume formatted and ready for download'
        ]);

        // Show success message
        setTimeout(() => setSuccess(false), 5000);
      } else {
        setError('Failed to generate resume');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate resume');
      setTailoringDetails([]);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex-1 w-full bg-background min-h-screen text-text font-sans">
      {/* Minimal Text Area Input */}
      <MinimalTextArea
        value={jobDescription}
        onChange={setJobDescription}
        onSubmit={handleGenerate}
        title="Generate your perfect resume"
        placeholder="Paste the job description here..."
        disabled={isGenerating}
      />

      {/* Content Area */}
      <div className="max-w-[780px] mx-auto px-8 pb-8">
        {/* Resume Profile Status */}
        <AnimatePresence>
          {!resumeText && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 flex items-center gap-2 rounded-xl border border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.08)] px-4 py-3 text-[13px] text-[#92400e]"
            >
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
            </motion.div>
          )}
        </AnimatePresence>

        {/* Status Messages */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 flex items-center gap-2 rounded-xl border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.08)] px-4 py-3 text-[13px] text-[#b91c1c]"
            >
              <Icons.alertCircle size={18} />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {success && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 flex items-center gap-2 rounded-xl border border-[rgba(34,197,94,0.35)] bg-[rgba(34,197,94,0.08)] px-4 py-3 text-[13px] text-[#166534]"
            >
              <Icons.checkCircle size={18} />
              <span>Resume generated and downloaded successfully!</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Generation Status */}
        <AnimatePresence>
          {isGenerating && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="rounded-[12px] p-4 mb-6"
              style={{ backgroundColor: 'var(--background-50)' }}
            >
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-lg bg-[var(--primary-50)] text-[var(--primary)] flex items-center justify-center">
                  <Icons.loader className="animate-spin" size={18} />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold" style={{ color: 'var(--text-900)' }}>
                    AI is working its magic…
                  </h4>
                  <p className="text-xs mb-3" style={{ color: 'var(--text-600)' }}>
                    Analyzing job requirements and tailoring your resume
                  </p>

                  {/* Tailoring Details */}
                  {tailoringDetails.length > 0 && (
                    <div className="mb-3 space-y-1.5">
                      {tailoringDetails.map((detail, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.2 }}
                          className="flex items-center gap-2 text-xs"
                          style={{ color: 'var(--text-700)' }}
                        >
                          <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                          {detail}
                        </motion.div>
                      ))}
                    </div>
                  )}

                  <div className="mt-3">
                    <div className="h-2 w-full rounded-full overflow-hidden" style={{ backgroundColor: 'var(--background-100)' }}>
                      <motion.div
                        initial={{ width: '0%' }}
                        animate={{ width: '100%' }}
                        transition={{ duration: 10, ease: 'linear' }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: 'var(--primary-600)' }}
                      />
                    </div>
                    <span className="mt-2 block text-[11px]" style={{ color: 'var(--text-600)' }}>
                      This usually takes less than 10 seconds
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Generated Resume Display */}
        <AnimatePresence>
          {generatedResume && !isGenerating && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="rounded-[12px] p-6 border border-[rgba(34,197,94,0.2)]"
              style={{ backgroundColor: 'var(--background-50)' }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Icons.checkCircle size={20} style={{ color: 'var(--secondary-500)' }} />
                <h3
                  className="font-semibold"
                  style={{
                    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
                    fontSize: '16px',
                    color: 'var(--text-900)',
                  }}
                >
                  Resume Generated Successfully
                </h3>
              </div>
              <p
                className="mb-4"
                style={{
                  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
                  fontSize: '14px',
                  color: 'var(--text-600)',
                  lineHeight: '1.5',
                }}
              >
                {generatedResume}
              </p>

              {/* What was tailored section */}
              {tailoringDetails.length > 0 && (
                <div className="mb-4 p-3 rounded-lg" style={{ backgroundColor: 'var(--background-100)' }}>
                  <h4 className="text-xs font-semibold mb-2" style={{ color: 'var(--text-700)' }}>
                    What we optimized:
                  </h4>
                  <div className="space-y-1">
                    {tailoringDetails.map((detail, index) => (
                      <div key={index} className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-600)' }}>
                        <Icons.checkCircle size={14} style={{ color: 'var(--secondary-500)' }} />
                        {detail}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    if (jobId) {
                      window.open(`${api.base}/api/job/${jobId}/download/pdf`, '_blank');
                    }
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl font-semibold h-11 px-6 transition-all duration-200"
                  style={{
                    backgroundColor: 'var(--primary-600)',
                    color: 'white',
                    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
                  }}
                >
                  <Icons.download size={18} />
                  Download PDF
                </button>
                <button
                  onClick={() => navigate('/history')}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl font-semibold h-11 px-6 transition-all duration-200 border"
                  style={{
                    backgroundColor: 'white',
                    color: 'var(--text-700)',
                    borderColor: 'var(--border-color)',
                    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
                  }}
                >
                  <Icons.fileText size={18} />
                  View All Resumes
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Helper Text */}
        {!isGenerating && !generatedResume && jobDescription && resumeText && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center"
          >
            <p
              className="text-sm"
              style={{
                color: 'var(--text-600)',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
              }}
            >
              Ready to generate your tailored resume. Press Cmd/Ctrl + Enter or click below.
            </p>
            <button
              onClick={handleGenerate}
              disabled={!resumeText || !jobDescription}
              className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl font-semibold h-11 px-6 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: 'var(--primary-600)',
                color: 'white',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
              }}
            >
              <Icons.zap size={18} />
              Generate Tailored Resume
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
