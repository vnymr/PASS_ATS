import logger from './utils/logger';

// Adapter to bridge the frontend with the new production backend
export type Quota = { month: string; used: number; remaining: number; limit: number };
export type ResumeEntry = { 
  fileName: string; 
  pdfUrl: string; 
  texUrl?: string; 
  role?: string; 
  company?: string; 
  jobUrl?: string; 
  createdAt?: string; 
};
export type Profile = {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  website?: string;
  summary?: string;
  summary_narrative?: string;
  skills?: string[];
  experiences?: Array<{ company?: string; role?: string; location?: string; dates?: string; bullets?: string[] }>;
  projects?: Array<{ name?: string; summary?: string; bullets?: string[] }>;
  education?: Array<{ institution?: string; degree?: string; location?: string; dates?: string }>;
  jobsAppliedThisMonth?: number;
  resumeText?: string;
  additionalInfo?: string;
  isComplete?: boolean;
  updatedAt?: string;
};

// Update to use the new backend port
const API_URL = ((import.meta as any).env?.VITE_API_URL || 'http://localhost:8080').trim();

// Clerk token helper - this will be used by components that have access to Clerk
export function getClerkToken(): Promise<string | null> {
  // This will be implemented in components that use Clerk hooks
  return Promise.resolve(null);
}

function authHeaders(token?: string): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handle<T>(res: Response): Promise<T> {
  const ct = res.headers.get('content-type') || '';
  const body = ct.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) throw Object.assign(new Error((body && (body.error || body.message)) || res.statusText), { status: res.status, body });
  return body as T;
}

export const api = {
  base: API_URL,

  async get(path: string, token?: string) {
    const r = await fetch(`${API_URL}${path}`, { headers: { ...authHeaders(token) } });
    return handle<any>(r);
  },

  // Map old auth endpoints to new ones
  async login(email: string, password: string) {
    const r = await fetch(`${API_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const result = await handle<{ token: string; user: { id: number; email: string } }>(r);
    // Transform to expected format
    return {
      token: result.token,
      isNew: false,
      onboardingCompleted: true
    };
  },

  async signup(email: string, password: string) {
    const r = await fetch(`${API_URL}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const result = await handle<{ token: string }>(r);
    return result;
  },

  async me() {
    const r = await fetch(`${API_URL}/api/profile`, { headers: { ...authHeaders() } });
    return r.status === 404 ? null : handle<Profile>(r);
  },

  async getProfile() {
    const r = await fetch(`${API_URL}/api/profile`, { headers: { ...authHeaders() } });
    return r.status === 404 ? null : handle<Profile>(r);
  },

  async postProfile(p: Profile) {
    const r = await fetch(`${API_URL}/api/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(p)
    });
    const result = await handle<any>(r);
    return { success: true, profile: p };
  },

  async putProfile(p: Partial<Profile>) {
    const r = await fetch(`${API_URL}/api/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(p)
    });
    await handle<any>(r);
    return { success: true };
  },

  async quota() {
    // Mock quota for now - new backend doesn't have quota endpoint
    return {
      month: new Date().toISOString().slice(0, 7),
      used: 0,
      remaining: 100,
      limit: 100
    };
  },

  async resumes() {
    const r = await fetch(`${API_URL}/api/my-jobs?status=COMPLETED&limit=20`, { headers: { ...authHeaders() } });
    const result = await handle<{ jobs: any[] }>(r);

    // Transform job data to resume format
    return result.jobs.map(job => ({
      fileName: `resume_${job.id}.pdf`,
      pdfUrl: `${API_URL}/api/job/${job.id}/download/pdf`,
      texUrl: `${API_URL}/api/job/${job.id}/download/latex`,
      role: job.role || 'Position',
      company: job.company || 'Company',
      jobUrl: job.jobUrl,
      createdAt: job.createdAt
    }));
  },

  async analyzePublic(resumeText: string) {
    const r = await fetch(`${API_URL}/api/analyze/public`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resumeText })
    });
    return handle<{ structured: { summary: string; skills: string[]; resumeText: string; isComplete: boolean } }>(r);
  },

  async generateResume(jobUrl: string, jobDetails: any) {
    // Try to get profile data but don't fail if it's not available
    let profileData: Profile | null = null;
    try {
      profileData = await this.getProfile();
    } catch (error) {
      logger.warn('Could not load profile data, using local storage');
    }

    // Combine resume text with additional info
    let fullResumeText = profileData?.resumeText || localStorage.getItem('userResumeText') || '';

    if (profileData?.additionalInfo) {
      fullResumeText = `${fullResumeText}\n\nADDITIONAL INFORMATION:\n${profileData.additionalInfo}`;
    }

    // If no resume text at all, include basic profile info
    if (!fullResumeText && profileData) {
      const parts = [];
      if (profileData.name) parts.push(`Name: ${profileData.name}`);
      if (profileData.email) parts.push(`Email: ${profileData.email}`);
      if (profileData.phone) parts.push(`Phone: ${profileData.phone}`);
      if (profileData.location) parts.push(`Location: ${profileData.location}`);
      if (profileData.summary) parts.push(`\nSummary: ${profileData.summary}`);
      if (profileData.skills?.length) parts.push(`\nSkills: ${profileData.skills.join(', ')}`);
      fullResumeText = parts.join('\n');
    }

    if (!fullResumeText) {
      throw new Error('No resume text available. Please add your resume in the profile section.');
    }

    const r = await fetch(`${API_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        resumeText: fullResumeText,
        jobDescription: jobDetails.description || `${jobDetails.role} at ${jobDetails.company}`,
        company: jobDetails.company,
        role: jobDetails.role,
        jobUrl: jobUrl,
        aiMode: 'gpt-4', // Use GPT-4
        matchMode: jobDetails.matchMode || 'balanced'
      })
    });
    return handle<{ jobId: string }>(r);
  },

  async getJobStatus(jobId: string) {
    const r = await fetch(`${API_URL}/api/job/${jobId}`, { headers: { ...authHeaders() } });
    const job = await handle<any>(r);

    // Transform to expected format
    return {
      status: job.status.toLowerCase(),
      progress: job.status === 'COMPLETED' ? 100 : job.status === 'PROCESSING' ? 50 : 0,
      error: job.error,
      result: job.artifacts?.[0]
    };
  },

  async downloadResume(fileName: string) {
    // Extract jobId from fileName if needed
    const jobId = fileName.replace('resume_', '').replace('.pdf', '');
    const r = await fetch(`${API_URL}/api/job/${jobId}/download/pdf`, { headers: { ...authHeaders() } });
    if (!r.ok) throw new Error('Failed to download resume');
    return r.blob();
  },

  // SSE endpoint adapter
  getSSEUrl(jobId: string): string {
    const token = localStorage.getItem('token');
    // New backend uses /api/events/:jobId with auth header
    return `${API_URL}/api/events/${jobId}`;
  },

  // Other methods remain similar with endpoint adjustments
  async resetPassword(email: string) {
    return { success: true, message: 'Password reset not implemented in new backend' };
  },

  async verifyResetToken(token: string) {
    return { valid: false };
  },

  async updatePassword(token: string, newPassword: string) {
    return { success: false };
  },

  // Simplified API methods
  async getQuota() {
    return this.quota();
  },

  async getResumes() {
    return this.resumes();
  },

  async updateProfile(profile: Partial<Profile>) {
    return this.putProfile(profile);
  },

  async summarizeResume(resumeText: string) {
    return this.analyzePublic(resumeText);
  },

  async uploadResume(file: File) {
    // Upload file to backend for proper parsing (PDF, DOCX, etc.)
    const formData = new FormData();
    formData.append('resume', file);

    const r = await fetch(`${API_URL}/api/upload/resume`, {
      method: 'POST',
      body: formData
    });

    if (!r.ok) {
      const error = await r.json();
      throw new Error(error.error || 'Failed to upload file');
    }

    const result = await handle<{ success: boolean; text: string; filename: string; size: number }>(r);
    return { text: result.text };
  },

  async analyzeResume(resumeText: string) {
    const result = await this.analyzePublic(resumeText);
    // Store resume text for job generation
    localStorage.setItem('userResumeText', resumeText);

    return {
      name: (result.structured as any).name || '',
      email: (result.structured as any).email || '',
      phone: (result.structured as any).phone || '',
      location: (result.structured as any).location || '',
      summary: result.structured.summary,
      skills: result.structured.skills || [],
      experiences: (result.structured as any).experiences || (result.structured as any).experience || [],
      education: (result.structured as any).education || [],
      projects: (result.structured as any).projects || [],
      resumeText,
      isComplete: true
    };
  }
};