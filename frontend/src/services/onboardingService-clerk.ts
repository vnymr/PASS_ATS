// Enhanced API service for onboarding with Clerk authentication

import {
  ResumeUploadResponse,
  ResumeAnalysisResponse,
  ProfileUpdateResponse,
  ParsedResumeData
} from '../types/onboarding';
import { OnboardingValidator } from '../utils/onboardingValidation';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Store the getToken function from Clerk's useAuth hook
let clerkGetToken: (() => Promise<string | null>) | null = null;

export function setClerkGetToken(getTokenFn: () => Promise<string | null>) {
  clerkGetToken = getTokenFn;
}

async function authHeaders(): Promise<Record<string, string>> {
  if (clerkGetToken) {
    const token = await clerkGetToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }
  // No localStorage fallback - Clerk auth only
  return {};
}

async function handleResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    const errorMessage = (body && (body.error || body.message)) || response.statusText;
    throw new OnboardingError(errorMessage, response.status, body);
  }

  return body as T;
}

export class OnboardingError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: any
  ) {
    super(message);
    this.name = 'OnboardingError';
  }
}

export class OnboardingService {
  static async uploadResume(file: File, onProgress?: (progress: number) => void): Promise<ResumeUploadResponse> {
    try {
      const formData = new FormData();
      formData.append('resume', file);

      // Simulate progress for better UX
      if (onProgress) {
        onProgress(10);
        await new Promise(resolve => setTimeout(resolve, 200));
        onProgress(50);
        await new Promise(resolve => setTimeout(resolve, 200));
        onProgress(90);
      }

      const headers = await authHeaders();
      const response = await fetch(`${API_URL}/api/upload/resume`, {
        method: 'POST',
        headers,
        body: formData
      });

      if (onProgress) onProgress(100);

      const result = await handleResponse<ResumeUploadResponse>(response);

      if (!result.success) {
        throw new OnboardingError(result.error || 'Failed to upload resume', 400);
      }

      return result;
    } catch (error) {
      if (error instanceof OnboardingError) throw error;
      throw new OnboardingError(
        error instanceof Error ? error.message : 'Failed to upload resume',
        500
      );
    }
  }

  static async analyzeResume(text: string): Promise<ResumeAnalysisResponse> {
    try {
      const headers = await authHeaders();
      const response = await fetch(`${API_URL}/api/analyze/public`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body: JSON.stringify({ resumeText: text })
      });

      const raw = await handleResponse<any>(response);
      const mapped = {
        success: true,
        data: {
          ...(raw.structured || {}),
          extractedAt: new Date().toISOString()
        },
        qualityScore: 70,
        suggestions: []
      };

      // Validate the parsed data
      const validationResult = OnboardingValidator.validateParsedData(mapped.data);
      if (!validationResult.isValid) {
        console.error('Validation errors:', validationResult.errors);
        // Continue with partial data even if validation fails
      }

      return mapped;
    } catch (error) {
      if (error instanceof OnboardingError) throw error;
      throw new OnboardingError(
        error instanceof Error ? error.message : 'Failed to analyze resume',
        500
      );
    }
  }

  static async saveProfile(profileData: ParsedResumeData): Promise<ProfileUpdateResponse> {
    try {
      // Sanitize then validate data before sending
      const sanitized = OnboardingValidator.sanitizeData(profileData as any);
      const validation = OnboardingValidator.validateParsedData(sanitized);
      if (!validation.isValid) {
        throw new OnboardingError('Profile data validation failed', 400, validation.errors);
      }

      // Ensure completion flag is set when saving from onboarding
      const payload = { ...sanitized, isComplete: true };

      const headers = await authHeaders();
      const response = await fetch(`${API_URL}/api/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body: JSON.stringify(payload)
      });

      // Server returns the saved profile object directly, not wrapped
      const raw = await handleResponse<any>(response);
      const mapped: ProfileUpdateResponse = {
        success: true,
        profile: raw
      };

      return mapped;
    } catch (error) {
      if (error instanceof OnboardingError) throw error;
      throw new OnboardingError(
        error instanceof Error ? error.message : 'Failed to save profile',
        500
      );
    }
  }

  // Aliases for compatibility with OnboardingNew.tsx
  static async updateProfile(profileData: ParsedResumeData): Promise<ProfileUpdateResponse> {
    return this.saveProfile(profileData);
  }

  static async processAdditionalInfo(profileData: ParsedResumeData, additionalInfo: string): Promise<ParsedResumeData> {
    // Simple client-side merge; server will sanitize/merge on save
    const merged: any = { ...profileData, additionalInfo };
    return merged as ParsedResumeData;
  }

  static async updateAdditionalInfo(additionalInfo: string): Promise<ProfileUpdateResponse> {
    try {
      const headers = await authHeaders();
      const response = await fetch(`${API_URL}/api/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body: JSON.stringify({ additionalInfo })
      });

      const result = await handleResponse<ProfileUpdateResponse>(response);

      if (!result.success) {
        throw new OnboardingError(result.error || 'Failed to update profile', 400);
      }

      return result;
    } catch (error) {
      if (error instanceof OnboardingError) throw error;
      throw new OnboardingError(
        error instanceof Error ? error.message : 'Failed to update profile',
        500
      );
    }
  }

  static async checkProfile(): Promise<ParsedResumeData | null> {
    try {
      const headers = await authHeaders();
      const response = await fetch(`${API_URL}/api/profile`, {
        headers
      });

      if (response.status === 404) {
        return null;
      }

      const result = await handleResponse<any>(response);
      return result;
    } catch (error) {
      console.error('Failed to check profile:', error);
      return null;
    }
  }

  static validateFileType(file: File): { isValid: boolean; error?: string } {
    const validTypes = [
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (!validTypes.includes(file.type)) {
      return {
        isValid: false,
        error: 'Please upload a PDF, TXT, DOC, or DOCX file'
      };
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      return {
        isValid: false,
        error: 'File size must be less than 5MB'
      };
    }

    return { isValid: true };
  }

  static getErrorMessage(error: unknown): string {
    if (error instanceof OnboardingError) {
      switch (error.status) {
        case 400:
          return 'Please check your input and try again.';
        case 401:
          return 'Please log in again to continue.';
        case 403:
          return 'You do not have permission to perform this action.';
        case 404:
          return 'The requested resource was not found.';
        case 413:
          return 'File is too large. Please choose a smaller file.';
        case 415:
          return 'File type not supported. Please upload a PDF, DOC, or DOCX file.';
        case 429:
          return 'Too many requests. Please wait a moment and try again.';
        case 500:
          return 'Server error. Please try again later.';
        case 0:
          return 'Network error. Please check your connection.';
        default:
          return error.message || 'An unexpected error occurred.';
      }
    }
    
    if (error instanceof Error) {
      return error.message;
    }
    
    return 'An unexpected error occurred.';
  }
}