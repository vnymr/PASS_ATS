/**
 * API Service Layer
 * Handles all backend communication with proper error handling and typing
 */

// Use empty string for development to leverage Vite proxy, or explicit URL for production
const API_BASE_URL = (import.meta.env.VITE_API_URL || '').trim();

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Score breakdown from recommendation engine
export interface JobScoreBreakdown {
  keywordMatch?: number;
  requiredSkillsMatch?: number;
  preferredSkillsMatch?: number;
  experienceMatch?: number;
  descriptionSimilarity?: number;
  locationMatch?: number;
  recencyBoost?: number;
  interactionScore?: number;
}

// Job Types
export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  salary?: string;
  description: string;
  requirements?: string;
  applyUrl: string;
  atsType?: string;
  atsComplexity?: string;
  aiApplyable: boolean;
  postedDate: string;
  source: string;
  // AI-Extracted Metadata
  extractedSkills?: string[];
  extractedExperience?: string;
  extractedEducation?: string;
  extractedJobLevel?: string;
  extractedKeywords?: string[];
  extractedBenefits?: string[];
  extractionConfidence?: number;
  _count?: {
    applications: number;
  };
  // Personalized matching scores (only present when personalized=true)
  relevanceScore?: number;
  scoreBreakdown?: JobScoreBreakdown;
}

export interface JobSearchResult {
  success: boolean;
  query: string;
  parsedQuery: any;
  explanation: string;
  jobs: Job[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

// Resume Types
export interface ResumeGenerationRequest {
  jobDescription: string;
  jobTitle?: string;
  company?: string;
}

export interface ResumeGenerationResponse {
  jobId: string;
  status: string;
  message: string;
}

export interface ResumeStatusResponse {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  jobId: string;
  progress?: number;
  downloadUrl?: string;
  error?: string;
}

// Auto-Apply Types
export interface AutoApplyRequest {
  jobId: string;
}

export interface AutoApplyResponse {
  success: boolean;
  applicationId: string;
  status: string;
  message: string;
  estimatedTime?: string;
  estimatedCost?: number;
}

export interface Application {
  id: string;
  userId: number;
  jobId: string;
  status: 'QUEUED' | 'APPLYING' | 'SUBMITTED' | 'FAILED' | 'CANCELLED' | 'RETRYING';
  method: string;
  submittedAt?: string;
  confirmationUrl?: string;
  confirmationId?: string;
  confirmationData?: any;
  error?: string;
  errorType?: string;
  retryCount: number;
  maxRetries: number;
  cost: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  job?: Job;
}

export interface ApplicationsResponse {
  applications: Application[];
  total: number;
  statusCounts: Record<string, number>;
  limit: number;
  offset: number;
}

export interface ApplicationStats {
  total: number;
  submitted: number;
  failed: number;
  pending: number;
  thisWeek: number;
  totalCost: number;
  averageCost: number;
}

/**
 * Get auth token from localStorage
 *
 * Note: The Clerk authentication token is automatically synced to localStorage
 * by the App component when users sign in. This allows the API service to
 * access the token for authenticated requests. The token is refreshed every
 * 5 minutes to stay current.
 */
function getAuthToken(): string | null {
  return localStorage.getItem('token');
}

/**
 * Make authenticated API request
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || error.message || 'Request failed');
  }

  return response.json();
}

/**
 * AI-powered job search
 */
export async function searchJobs(query: string, limit = 20, offset = 0): Promise<JobSearchResult> {
  return apiRequest<JobSearchResult>('/api/ai-search', {
    method: 'POST',
    body: JSON.stringify({ query, limit, offset }),
  });
}

/**
 * Get job suggestions
 */
export async function getJobSuggestions(): Promise<{ suggestions: string[]; stats: any }> {
  return apiRequest('/api/ai-search/suggestions');
}

/**
 * Get jobs with filters
 */
export interface GetJobsParams {
  filter?: 'all' | 'ai_applyable' | 'manual';
  atsType?: string;
  company?: string;
  source?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface GetJobsResponse {
  jobs: Job[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export async function getJobs(params: GetJobsParams = {}): Promise<GetJobsResponse> {
  const queryParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      queryParams.append(key, value.toString());
    }
  });

  return apiRequest<GetJobsResponse>(`/api/jobs?${queryParams.toString()}`);
}

/**
 * Generate resume from job description
 */
export async function generateResume(request: ResumeGenerationRequest): Promise<ResumeGenerationResponse> {
  return apiRequest<ResumeGenerationResponse>('/api/generate', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

/**
 * Check resume generation status
 */
export async function checkResumeStatus(jobId: string): Promise<ResumeStatusResponse> {
  return apiRequest<ResumeStatusResponse>(`/api/job/${jobId}/status`);
}

/**
 * Download resume
 */
export async function downloadResume(jobId: string, type: 'pdf' | 'tex' = 'pdf'): Promise<Blob> {
  const token = getAuthToken();
  const response = await fetch(`${API_BASE_URL}/api/job/${jobId}/download/${type}`, {
    headers: {
      ...(token && { 'Authorization': `Bearer ${token}` }),
    },
  });

  if (!response.ok) {
    throw new Error('Failed to download resume');
  }

  return response.blob();
}

/**
 * Auto-apply to a job
 */
export async function autoApplyToJob(request: AutoApplyRequest): Promise<AutoApplyResponse> {
  return apiRequest<AutoApplyResponse>('/api/auto-apply', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

/**
 * Get user's applications
 */
export interface GetApplicationsParams {
  status?: 'QUEUED' | 'APPLYING' | 'SUBMITTED' | 'FAILED' | 'CANCELLED' | 'RETRYING';
  limit?: number;
  offset?: number;
}

export async function getMyApplications(params: GetApplicationsParams = {}): Promise<ApplicationsResponse> {
  const queryParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      queryParams.append(key, value.toString());
    }
  });

  return apiRequest<ApplicationsResponse>(`/api/my-applications?${queryParams.toString()}`);
}

/**
 * Get specific application details
 */
export async function getApplication(applicationId: string): Promise<{ application: Application }> {
  return apiRequest<{ application: Application }>(`/api/applications/${applicationId}`);
}

/**
 * Cancel a queued application
 */
export async function cancelApplication(applicationId: string): Promise<{ success: boolean; message: string }> {
  return apiRequest(`/api/applications/${applicationId}`, {
    method: 'DELETE',
  });
}

/**
 * Get auto-apply statistics
 */
export async function getAutoApplyStats(): Promise<ApplicationStats> {
  return apiRequest<ApplicationStats>('/api/auto-apply/stats');
}

/**
 * Detect user intent from input
 */
export interface IntentDetectionResult {
  intent: 'resume' | 'job_search' | 'auto_apply' | 'question';
  confidence: number;
  extractedData?: {
    jobDescription?: string;
    searchQuery?: string;
    jobId?: string;
  };
}

export async function detectIntent(userInput: string): Promise<IntentDetectionResult> {
  // Client-side heuristics for faster response
  const input = userInput.toLowerCase().trim();

  // Check for resume generation intent
  if (
    input.includes('generate resume') ||
    input.includes('create resume') ||
    input.includes('make resume') ||
    input.includes('tailor resume') ||
    (input.includes('job description') && input.length > 200) ||
    (input.includes('responsibilities:') || input.includes('requirements:'))
  ) {
    return {
      intent: 'resume',
      confidence: 0.9,
      extractedData: {
        jobDescription: userInput,
      },
    };
  }

  // Check for job search intent
  if (
    input.includes('find job') ||
    input.includes('search job') ||
    input.includes('looking for') ||
    input.includes('jobs in') ||
    input.includes('remote') ||
    input.includes('engineer') ||
    input.includes('developer') ||
    input.includes('designer') ||
    input.includes('manager')
  ) {
    return {
      intent: 'job_search',
      confidence: 0.85,
      extractedData: {
        searchQuery: userInput,
      },
    };
  }

  // Default to job search for most queries
  return {
    intent: 'job_search',
    confidence: 0.7,
    extractedData: {
      searchQuery: userInput,
    },
  };
}

export default {
  searchJobs,
  getJobSuggestions,
  getJobs,
  generateResume,
  checkResumeStatus,
  downloadResume,
  autoApplyToJob,
  getMyApplications,
  getApplication,
  cancelApplication,
  getAutoApplyStats,
  detectIntent,
};
