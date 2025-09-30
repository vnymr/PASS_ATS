// Enhanced API service for onboarding with better error handling and data flow

import { 
  ResumeUploadResponse, 
  ResumeAnalysisResponse, 
  ProfileUpdateResponse,
  ParsedResumeData 
} from '../types/onboarding';
import { OnboardingValidator } from '../utils/onboardingValidation';

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000';

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
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

      const response = await fetch(`${API_URL}/api/upload/resume`, {
        method: 'POST',
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
      throw new OnboardingError('Network error during file upload', 0, error);
    }
  }

  static async analyzeResume(resumeText: string, onProgress?: (progress: number) => void): Promise<ResumeAnalysisResponse> {
    try {
      // Simulate analysis progress
      if (onProgress) {
        onProgress(10);
        await new Promise(resolve => setTimeout(resolve, 300));
        onProgress(30);
        await new Promise(resolve => setTimeout(resolve, 300));
        onProgress(60);
        await new Promise(resolve => setTimeout(resolve, 300));
        onProgress(90);
      }

      const response = await fetch(`${API_URL}/api/analyze/public`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeText })
      });

      if (onProgress) onProgress(100);

      const result = await handleResponse<{ structured: any }>(response);
      
      // Transform and validate the response
      const parsedData = OnboardingValidator.sanitizeData({
        ...result.structured,
        resumeText,
        extractedAt: new Date().toISOString()
      });

      const qualityScore = OnboardingValidator.calculateQualityScore(parsedData);
      const validation = OnboardingValidator.validateParsedData(parsedData);

      return {
        success: true,
        data: parsedData,
        qualityScore,
        suggestions: validation.suggestions
      };
    } catch (error) {
      if (error instanceof OnboardingError) throw error;
      throw new OnboardingError('Failed to analyze resume', 500, error);
    }
  }

  static async updateProfile(profileData: ParsedResumeData): Promise<ProfileUpdateResponse> {
    try {
      // Validate data before sending
      const validation = OnboardingValidator.validateParsedData(profileData);
      if (!validation.isValid) {
        throw new OnboardingError('Profile data validation failed', 400, validation.errors);
      }

      const response = await fetch(`${API_URL}/api/profile`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json', 
          ...authHeaders() 
        },
        body: JSON.stringify(profileData)
      });

      const result = await handleResponse<{ data: ParsedResumeData }>(response);
      
      return {
        success: true,
        profile: result.data
      };
    } catch (error) {
      if (error instanceof OnboardingError) throw error;
      throw new OnboardingError('Failed to update profile', 500, error);
    }
  }

  static async processAdditionalInfo(profileData: ParsedResumeData, additionalInfo: string): Promise<ParsedResumeData> {
    try {
      // For now, just append additional info to the profile
      // In the future, this could call an AI service to process the additional info
      const enhancedProfile = {
        ...profileData,
        additionalInfo,
        // Add a simple processing timestamp
        processedAt: new Date().toISOString()
      };

      return enhancedProfile;
    } catch (error) {
      throw new OnboardingError('Failed to process additional information', 500, error);
    }
  }

  static async getProfile(): Promise<ParsedResumeData | null> {
    try {
      const response = await fetch(`${API_URL}/api/profile`, { 
        headers: { ...authHeaders() } 
      });
      
      if (response.status === 404) {
        return null;
      }

      const result = await handleResponse<ParsedResumeData>(response);
      return OnboardingValidator.sanitizeData(result);
    } catch (error) {
      if (error instanceof OnboardingError) throw error;
      throw new OnboardingError('Failed to fetch profile', 500, error);
    }
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

  static getRetryDelay(attempt: number): number {
    // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
    return Math.min(1000 * Math.pow(2, attempt), 30000);
  }

  static async withRetry<T>(
    operation: () => Promise<T>,
    maxAttempts: number = 3,
    onRetry?: (attempt: number, error: Error) => void
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < maxAttempts - 1) {
          const delay = this.getRetryDelay(attempt);
          if (onRetry) onRetry(attempt + 1, lastError);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError!;
  }
}


