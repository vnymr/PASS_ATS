export type Quota = { month: string; used: number; remaining: number; limit: number };
export type ResumeEntry = { fileName: string; pdfUrl: string; texUrl?: string; role?: string; company?: string; createdAt?: string };
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
  experience?: Array<{ company?: string; role?: string; location?: string; dates?: string; bullets?: string[] }>;
  projects?: Array<{ name?: string; summary?: string; bullets?: string[] }>;
  education?: Array<{ institution?: string; degree?: string; location?: string; dates?: string }>;
  jobsAppliedThisMonth?: number;
  resumeText?: string;
  isComplete?: boolean;
  updatedAt?: string;
};

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000';

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('token');
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
  async get(path: string) {
    const r = await fetch(`${API_URL}${path}`, { headers: { ...authHeaders() } });
    return handle<any>(r);
  },
  async login(email: string, password: string) {
    const r = await fetch(`${API_URL}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    const result = await handle<{ token: string; user: any }>(r);
    localStorage.setItem('token', result.token);
    return { ...result, isNew: false, onboardingCompleted: true };
  },
  async signup(email: string, password: string) {
    const r = await fetch(`${API_URL}/api/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, name: email.split('@')[0] }) });
    const result = await handle<{ token: string }>(r);
    localStorage.setItem('token', result.token);
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
    const r = await fetch(`${API_URL}/api/profile`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(p) });
    return handle<{ success: boolean; profile: Profile }>(r);
  },
  async putProfile(p: Partial<Profile>) {
    const r = await fetch(`${API_URL}/api/profile`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(p) });
    return handle<{ success: boolean }>(r);
  },
  async quota() {
    // Mock quota - backend doesn't have this endpoint yet
    return Promise.resolve({ month: new Date().toISOString().slice(0, 7), used: 0, remaining: 100, limit: 100 });
  },
  async resumes() {
    const r = await fetch(`${API_URL}/api/jobs?status=COMPLETED&limit=20`, { headers: { ...authHeaders() } });
    const result = await handle<{ jobs: any[] }>(r);
    return result.jobs.map((job: any) => ({
      fileName: `resume_${job.id}.pdf`,
      pdfUrl: `${API_URL}/api/job/${job.id}/download/pdf`,
      texUrl: `${API_URL}/api/job/${job.id}/download/latex`,
      createdAt: job.createdAt
    }));
  },
  async analyzePublic(resumeText: string) {
    const r = await fetch(`${API_URL}/api/analyze/public`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resumeText }) });
    return handle<{ structured: { summary?: string; skills?: string[] } }>(r);
  },
  async generateResume(resumeText: string, jobDescription: string, company?: string, role?: string) {
    const r = await fetch(`${API_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        resumeText,
        jobDescription,
        company,
        role,
        aiMode: 'gpt-5-mini'
      })
    });

    const result = await handle<{ success: boolean; jobId: string; downloadUrl: string; error?: string }>(r);

    if (result.success && result.downloadUrl) {
      // Auto-download the PDF
      const pdfRes = await fetch(`${API_URL}${result.downloadUrl}`, { headers: authHeaders() });
      if (pdfRes.ok) {
        const blob = await pdfRes.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `resume_${company || 'generated'}_${Date.now()}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    }

    return result;
  },
  async getJobStatus(jobId: string) {
    const r = await fetch(`${API_URL}/api/job/${jobId}`, { headers: { ...authHeaders() } });
    const job = await handle<any>(r);
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
  async resetPassword(email: string) {
    // Password reset not implemented in current backend
    return Promise.resolve({ success: false, message: 'Password reset not available' });
  },
  async verifyResetToken(token: string) {
    // Not implemented in current backend
    return Promise.resolve({ valid: false });
  },
  async updatePassword(token: string, newPassword: string) {
    // Not implemented in current backend
    return Promise.resolve({ success: false });
  },
  // Simplified API methods for the new flow
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
    // Store resume text for later use
    localStorage.setItem('userResumeText', resumeText);
    const r = await fetch(`${API_URL}/api/analyze/public`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resumeText })
    });
    const result = await handle<{ structured: any }>(r);
    return {
      summary: result.structured.summary || '',
      skills: result.structured.skills || [],
      experience: result.structured.experience || []
    };
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
    localStorage.setItem('userResumeText', resumeText);
    const r = await fetch(`${API_URL}/api/analyze/public`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resumeText })
    });
    const result = await handle<{ structured: any }>(r);
    return {
      ...result.structured,
      resumeText,
      isComplete: true
    } as Profile;
  }
};

