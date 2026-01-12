import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { api, type ResumeEntry, type Profile } from '../api-clerk';
import Icons from '../components/ui/icons';
import logger from '../utils/logger';
import MinimalTextArea from '../components/MinimalTextArea';
import { motion, AnimatePresence } from 'framer-motion';
import { SectionHeader } from '../ui/SectionHeader';
import Card, { CardContent } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Layout } from 'lucide-react';

export default function GenerateResume() {
  const navigate = useNavigate();
  const location = useLocation();
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [resumeText, setResumeText] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [generatedResume, setGeneratedResume] = useState('');
  const [jobId, setJobId] = useState('');
  const [tailoringDetails, setTailoringDetails] = useState<string[]>([]);
  const [resumes, setResumes] = useState<ResumeEntry[]>([]);
  const [loadingResumes, setLoadingResumes] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'recent' | 'week'>('all');

  // Load job description from navigation state if available
  useEffect(() => {
    const state = location.state as { jobDescription?: string; jobTitle?: string; company?: string } | null;
    if (state?.jobDescription) {
      setJobDescription(state.jobDescription);
      logger.info('Loaded job description from navigation', {
        title: state.jobTitle,
        company: state.company,
        length: state.jobDescription.length
      });
    }
  }, [location]);

  // Load user's resume text from profile - wait for Clerk to be loaded
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      loadProfile();
      loadResumes();
    }
  }, [isLoaded, isSignedIn]);

  const loadProfile = async () => {
    try {
      const token = await getToken();
      logger.info('Loading profile for generate page', { hasToken: !!token });
      const profile = await api.getProfile(token || undefined);
      logger.info('Profile response', {
        hasProfile: !!profile,
        resumeTextLength: profile?.resumeText?.length || 0,
        keys: profile ? Object.keys(profile) : []
      });
      if (profile?.resumeText) {
        setResumeText(profile.resumeText);
      }
    } catch (err) {
      logger.error('Failed to load profile', err);
    }
  };

  const loadResumes = async () => {
    try {
      setLoadingResumes(true);
      const token = await getToken();
      const data = await api.getResumes(token || undefined);
      let resumesList: ResumeEntry[] = [];
      if (Array.isArray(data)) {
        resumesList = data;
      } else if (data && typeof data === 'object' && 'resumes' in data) {
        resumesList = (data as any).resumes || [];
      }
      setResumes(resumesList);
    } catch (err) {
      logger.error('Failed to load resumes', err);
    } finally {
      setLoadingResumes(false);
    }
  };

  const downloadResume = async (fileName: string) => {
    try {
      const token = await getToken();
      const blob = await api.downloadResume(fileName, token || undefined);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      logger.error('Failed to download resume', err);
    }
  };

  const getFilteredResumes = () => {
    let filtered = [...resumes];

    if (searchTerm) {
      filtered = filtered.filter(resume =>
        (resume.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
         resume.role?.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    const now = new Date();
    if (filter === 'recent') {
      filtered = filtered.slice(0, 5);
    } else if (filter === 'week') {
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(resume =>
        resume.createdAt && new Date(resume.createdAt) > oneWeekAgo
      );
    }

    return filtered;
  };

  const formatFileSize = (bytes: number = 250000) => {
    return (bytes / 1024).toFixed(0) + ' KB';
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Just now';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffHours < 48) return 'Yesterday';
    return date.toLocaleDateString();
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
      const token = await getToken();

      // Clear tailoring details
      setTailoringDetails([]);

      // Start job processing
      const { jobId } = await api.processJob(jobDescription, 'claude', 'Standard', token || undefined);
      logger.info('Job started', { jobId });

      // Poll for job completion
      let jobCompleted = false;
      let pollCount = 0;
      const maxPolls = 180; // Max 3 minutes (resume gen takes ~45-60 seconds)

      while (!jobCompleted && pollCount < maxPolls) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second

        try {
          const jobStatus = await api.getJobStatus(jobId, token || undefined);
          logger.debug('Job status', { jobId, status: jobStatus.status });

          if (jobStatus.status === 'COMPLETED') {
            jobCompleted = true;
          } else if (jobStatus.status === 'FAILED') {
            throw new Error(jobStatus.error || 'Resume generation failed');
          }
        } catch (pollErr) {
          logger.error('Error polling job status', pollErr);
        }

        pollCount++;
      }

      if (!jobCompleted) {
        throw new Error('Resume generation timed out. Please try again.');
      }

      // Job completed
      setJobId(jobId);
      setSuccess(true);
      setGeneratedResume('Your tailored resume has been generated successfully!');

      // Add completion details
      setTailoringDetails([
        'Job requirements analyzed',
        'Experience matched and optimized',
        'ATS keywords integrated',
        'Resume formatted and ready for download'
      ]);

      // Reload resumes to show the new one
      await loadResumes();

      // Show success message
      setTimeout(() => setSuccess(false), 5000);
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
      <div className="max-w-7xl mx-auto px-4 sm:px-8 pb-8">
        {/* Template Customization Banner */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3"
        >
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Layout size={16} />
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-800">Customize Your Resume Template</p>
              <p className="text-xs text-neutral-500">AI uses your template when generating resumes</p>
            </div>
          </div>
          <Link
            to="/templates"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary hover:text-primary-700 bg-white border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors"
          >
            <Layout size={14} />
            Customize
          </Link>
        </motion.div>

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
              className="rounded-[12px] p-6 mb-6"
              style={{ backgroundColor: 'var(--background-50)' }}
            >
              <div className="flex flex-col items-center justify-center py-4">
                <div className="h-12 w-12 rounded-full bg-[var(--primary-50)] text-[var(--primary)] flex items-center justify-center mb-4">
                  <Icons.loader className="animate-spin" size={24} />
                </div>
                <h4 className="text-base font-semibold mb-1" style={{ color: 'var(--text-900)' }}>
                  Generating your resume...
                </h4>
                <p className="text-sm" style={{ color: 'var(--text-600)' }}>
                  This usually takes about 10 seconds
                </p>
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

        {/* History Section */}
        <div className="mt-10">
          <SectionHeader
            icon={<Icons.clock size={22} />}
            title="Generation History"
            count={getFilteredResumes().length}
            right={
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <div className="relative">
                  <Input
                    placeholder="Search resumes..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 w-full sm:w-64"
                  />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
                    <Icons.search size={16} />
                  </div>
                </div>
                <Button variant={filter === 'all' ? 'solid' : 'outline'} size="sm" onClick={() => setFilter('all')}>All</Button>
                <Button variant={filter === 'recent' ? 'solid' : 'outline'} size="sm" onClick={() => setFilter('recent')}>Recent</Button>
                <Button variant={filter === 'week' ? 'solid' : 'outline'} size="sm" onClick={() => setFilter('week')}>Week</Button>
              </div>
            }
            className="mb-6"
          />

          {loadingResumes ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="pt-5">
                    <div className="flex items-start gap-3 animate-pulse">
                      <div className="w-5 h-5 bg-gray-200 rounded"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                        <div className="flex gap-3 mt-2">
                          <div className="h-3 bg-gray-200 rounded w-20"></div>
                          <div className="h-3 bg-gray-200 rounded w-16"></div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : getFilteredResumes().length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {getFilteredResumes().map((resume, idx) => (
                <Card key={idx}>
                  <CardContent className="pt-5">
                    <div className="flex items-start gap-3">
                      <div className="text-primary-600 mt-0.5"><Icons.fileText size={20} /></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="font-semibold truncate">{resume.company || 'Unknown Company'}</h3>
                            <p className="text-xs text-neutral-600 truncate">{resume.role || 'Position not specified'}</p>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center gap-3 text-xs text-neutral-500">
                          <span className="inline-flex items-center gap-1">
                            <Icons.calendar size={14} />
                            {formatDate(resume.createdAt)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Icons.file size={14} />
                            {formatFileSize()}
                          </span>
                        </div>
                      </div>
                      <div className="self-start">
                        <Button
                          aria-label="Download resume"
                          variant="outline"
                          size="sm"
                          onClick={() => downloadResume(resume.fileName)}
                        >
                          <Icons.download size={16} />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="pt-5">
                <div className="text-center py-8">
                  <div className="mx-auto mb-3 text-neutral-400"><Icons.inbox size={40} /></div>
                  <h3 className="text-base font-semibold">No resumes found</h3>
                  <p className="text-sm text-neutral-600">
                    {searchTerm ? `No results matching "${searchTerm}"` : 'Generate your first resume to get started'}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
