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
export type ApplicationQuestions = {
  // Legal & Authorization
  legallyAuthorized?: string; // "Yes", "No"
  requiresVisaSponsorship?: string; // "Yes", "No"

  // Work Preferences
  willingToRelocate?: string; // "Yes", "No", "Depends on location"
  hasDriversLicense?: string; // "Yes", "No"
  availableStartDate?: string; // e.g., "Immediately", "2 weeks notice"
  noticePeriod?: string; // e.g., "2 weeks", "1 month"
  workArrangement?: string; // "Remote", "Hybrid", "Onsite", "Flexible"
  willingToTravel?: string; // "Yes", "No", "Yes, up to X%"
  salaryExpectation?: string; // e.g., "$120,000 - $150,000"

  // Additional Info
  howDidYouHear?: string; // e.g., "LinkedIn", "Referral", "Company website"
  hasRelativesAtCompany?: string; // "Yes", "No"
  comfortableWithBackgroundCheck?: string; // "Yes", "No"

  // EEO Questions (Optional - for compliance)
  gender?: string; // "Male", "Female", "Non-binary", "Decline to answer"
  race?: string; // "Decline to answer", various options
  veteranStatus?: string; // "Not a veteran", "Veteran", "Decline to answer"
  disabilityStatus?: string; // "No disability", "Has disability", "Decline to answer"

  // Custom additional questions (user can add their own)
  customQuestions?: Record<string, string>; // key-value pairs
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
  applicationQuestions?: ApplicationQuestions; // NEW: Auto-apply question answers
  uploadedResume?: { // User-uploaded resume for auto-apply
    content: string; // Base64 encoded PDF
    filename: string;
    uploadedAt: string;
    size: number;
  };
};

// Use relative paths in development to leverage Vite proxy
const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8080').trim();

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
  },

  // Template methods
  async getTemplates(token?: string) {
    const r = await fetch(`${API_URL}/api/templates`, { headers: { ...authHeaders(token) } });
    return handle<{
      success: boolean;
      templates: {
        user: Array<{
          id: string;
          name: string;
          isDefault: boolean;
          createdAt: string;
          updatedAt: string;
        }>;
        defaults: Array<{
          id: string;
          name: string;
          isSystemDefault: boolean;
          fillPercentage: number;
          bestFor: string[];
          characteristics: string[];
          usage: string;
        }>;
      };
    }>(r);
  },

  async getTemplate(id: string, token?: string) {
    const r = await fetch(`${API_URL}/api/templates/${id}`, { headers: { ...authHeaders(token) } });
    return handle<{
      success: boolean;
      template: {
        id: string;
        name: string;
        latex: string;
        isSystemDefault?: boolean;
        isDefault?: boolean;
      };
    }>(r);
  },

  async getDefaultTemplate(token?: string) {
    const r = await fetch(`${API_URL}/api/templates/default`, { headers: { ...authHeaders(token) } });
    return handle<{
      success: boolean;
      template: {
        id: string;
        name: string;
        latex: string;
        isSystemDefault?: boolean;
      };
    }>(r);
  },

  async saveTemplate(name: string, latex: string, isDefault: boolean, token?: string) {
    const r = await fetch(`${API_URL}/api/templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
      body: JSON.stringify({ name, latex, isDefault })
    });
    return handle<{ success: boolean; template: any }>(r);
  },

  async updateTemplate(id: string, data: { name?: string; latex?: string; isDefault?: boolean }, token?: string) {
    const r = await fetch(`${API_URL}/api/templates/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
      body: JSON.stringify(data)
    });
    return handle<{ success: boolean; template: any }>(r);
  },

  async deleteTemplate(id: string, token?: string) {
    const r = await fetch(`${API_URL}/api/templates/${id}`, {
      method: 'DELETE',
      headers: authHeaders(token)
    });
    return handle<{ success: boolean }>(r);
  },

  async copyTemplate(sourceId: string, name: string, token?: string) {
    const r = await fetch(`${API_URL}/api/templates/copy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
      body: JSON.stringify({ sourceId, name })
    });
    return handle<{ success: boolean; template: any }>(r);
  },

  async previewTemplate(latex: string, token?: string) {
    const r = await fetch(`${API_URL}/api/templates/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
      body: JSON.stringify({ latex })
    });
    return handle<{ success: boolean; pdf: string; mimeType: string }>(r);
  },

  async chatWithTemplate(templateId: string, message: string, currentLatex?: string, token?: string) {
    const r = await fetch(`${API_URL}/api/templates/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
      body: JSON.stringify({ templateId, message, currentLatex })
    });
    return handle<{ success: boolean; latex: string; explanation: string; changes: string[] }>(r);
  }
};
