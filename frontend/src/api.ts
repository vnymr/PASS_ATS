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

const API_URL = (import.meta as any).env?.VITE_API_URL || (window as any).__API_URL__ || 'http://localhost:3001';

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
  async login(email: string, password: string) {
    const r = await fetch(`${API_URL}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    return handle<{ token: string; isNew?: boolean; onboardingCompleted?: boolean }>(r);
  },
  async signup(email: string, password: string) {
    const r = await fetch(`${API_URL}/auth/signup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    return handle<{ token: string }>(r);
  },
  async me() {
    const r = await fetch(`${API_URL}/me`, { headers: { ...authHeaders() } });
    return r.status === 404 ? null : handle<Profile>(r);
  },
  async getProfile() {
    const r = await fetch(`${API_URL}/profile`, { headers: { ...authHeaders() } });
    return r.status === 404 ? null : handle<Profile>(r);
  },
  async postProfile(p: Profile) {
    const r = await fetch(`${API_URL}/profile`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(p) });
    return handle<{ success: boolean; profile: Profile }>(r);
  },
  async putProfile(p: Partial<Profile>) {
    const r = await fetch(`${API_URL}/profile`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(p) });
    return handle<{ success: boolean }>(r);
  },
  async quota() {
    const r = await fetch(`${API_URL}/quota`, { headers: { ...authHeaders() } });
    return handle<Quota>(r);
  },
  async resumes() {
    const r = await fetch(`${API_URL}/me/resumes`, { headers: { ...authHeaders() } });
    return handle<ResumeEntry[]>(r);
  },
  async analyzePublic(resumeText: string) {
    const r = await fetch(`${API_URL}/onboarding/analyze-public`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resumeText }) });
    return handle<{ structured: { summary?: string; skills?: string[] } }>(r);
  },
  async generateResume(jobUrl: string, jobDetails: any) {
    const r = await fetch(`${API_URL}/generate/job`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        jobData: {
          ...jobDetails,
          company: jobDetails.company || '',
          role: jobDetails.role || '',
          text: jobDetails.description || ''
        }
      })
    });
    return handle<{ jobId: string }>(r);
  },
  async getJobStatus(jobId: string) {
    const r = await fetch(`${API_URL}/generate/job/${jobId}`, { headers: { ...authHeaders() } });
    return handle<{ status: string; progress?: number; error?: string; result?: any }>(r);
  },
  async downloadResume(fileName: string) {
    const r = await fetch(`${API_URL}/download/${fileName}`, { headers: { ...authHeaders() } });
    if (!r.ok) throw new Error('Failed to download resume');
    return r.blob();
  },
  async resetPassword(email: string) {
    const r = await fetch(`${API_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    return handle<{ success: boolean; message: string }>(r);
  },
  async verifyResetToken(token: string) {
    const r = await fetch(`${API_URL}/auth/verify-reset-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
    return handle<{ valid: boolean }>(r);
  },
  async updatePassword(token: string, newPassword: string) {
    const r = await fetch(`${API_URL}/auth/update-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword })
    });
    return handle<{ success: boolean }>(r);
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
    const r = await fetch(`${API_URL}/ai/summarize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ resumeText })
    });
    return handle<{ summary: string; skills: string[]; experience: any[] }>(r);
  },
  async uploadResume(file: File) {
    const formData = new FormData();
    formData.append('resume', file);
    const r = await fetch(`${API_URL}/onboarding/parse`, {
      method: 'POST',
      body: formData
    });
    return handle<{ text: string }>(r);
  },
  async analyzeResume(resumeText: string) {
    const r = await fetch(`${API_URL}/onboarding/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resumeText })
    });
    return handle<Profile>(r);
  }
};

