// Clerk-compatible API adapter
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
  savedResumeUrl?: string;
};

// Use relative paths in development to leverage Vite proxy
const API_URL = import.meta.env.VITE_API_URL || '';

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

  async post(path: string, data: any, token?: string) {
    const r = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
      body: JSON.stringify(data)
    });
    return handle<any>(r);
  },

  async put(path: string, data: any, token?: string) {
    const r = await fetch(`${API_URL}${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
      body: JSON.stringify(data)
    });
    return handle<any>(r);
  },

  async delete(path: string, token?: string) {
    const r = await fetch(`${API_URL}${path}`, {
      method: 'DELETE',
      headers: authHeaders(token)
    });
    return handle<any>(r);
  },

  // Profile methods
  async getProfile(token?: string) {
    const r = await fetch(`${API_URL}/api/profile`, { headers: { ...authHeaders(token) } });
    return r.status === 404 ? null : handle<Profile>(r);
  },

  async postProfile(p: Profile, token?: string) {
    const r = await fetch(`${API_URL}/api/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
      body: JSON.stringify(p)
    });
    return handle<Profile>(r);
  },

  // Resume methods
  async getResumes(token?: string) {
    const r = await fetch(`${API_URL}/api/resumes`, { headers: { ...authHeaders(token) } });
    return r.status === 404 ? [] : handle<ResumeEntry[]>(r);
  },

  async downloadResume(fileName: string, token?: string) {
    const r = await fetch(`${API_URL}/api/resumes/${fileName}`, { headers: { ...authHeaders(token) } });
    if (!r.ok) throw new Error('Failed to download resume');
    return r.blob();
  },

  // Quota methods
  async getQuota(token?: string) {
    const r = await fetch(`${API_URL}/api/quota`, { headers: { ...authHeaders(token) } });
    return r.status === 404 ? null : handle<Quota>(r);
  },

  // Job processing methods
  async processJob(jobDescription: string, aiMode: string, matchMode: string, token?: string) {
    const r = await fetch(`${API_URL}/api/process-job`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
      body: JSON.stringify({ jobDescription, aiMode, matchMode })
    });
    return handle<{ jobId: string }>(r);
  },

  async getJobStatus(jobId: string, token?: string) {
    const r = await fetch(`${API_URL}/api/job/${jobId}`, { headers: { ...authHeaders(token) } });
    return handle<{ status: string; progress?: number; error?: string }>(r);
  },

  // Health check
  async health() {
    const r = await fetch(`${API_URL}/api/health`);
    return handle<{ status: string }>(r);
  }
};
