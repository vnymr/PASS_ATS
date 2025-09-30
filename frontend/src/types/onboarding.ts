// Comprehensive TypeScript interfaces for onboarding data flow

export interface OnboardingStep {
  id: number;
  title: string;
  description: string;
  isCompleted: boolean;
  isActive: boolean;
}

export interface FileUploadState {
  file: File | null;
  isUploading: boolean;
  uploadProgress: number;
  error: string | null;
}

export interface ResumeAnalysisState {
  isAnalyzing: boolean;
  analysisProgress: number;
  error: string | null;
  result: ParsedResumeData | null;
}

export interface ParsedResumeData {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  website?: string;
  summary?: string;
  skills?: string[];
  experiences?: Experience[];
  projects?: Project[];
  education?: Education[];
  certifications?: Certification[];
  resumeText: string;
  isComplete: boolean;
  qualityScore?: number;
  extractedAt: string;
}

export interface Experience {
  company: string;
  role: string;
  location?: string;
  dates: string;
  bullets: string[];
  isCurrent?: boolean;
}

export interface Project {
  name: string;
  summary: string;
  bullets: string[];
  technologies?: string[];
  url?: string;
}

export interface Education {
  institution: string;
  degree: string;
  location?: string;
  dates: string;
  gpa?: string;
}

export interface Certification {
  name: string;
  issuer: string;
  date: string;
  url?: string;
}

export interface AdditionalInfoState {
  text: string;
  isProcessing: boolean;
  processedData?: ProcessedAdditionalInfo;
  error: string | null;
}

export interface ProcessedAdditionalInfo {
  newSkills: string[];
  newExperiences: Experience[];
  newProjects: Project[];
  newEducation: Education[];
  newCertifications: Certification[];
  summaryEnhancement?: string;
  extraInfo?: string;
}

export interface OnboardingState {
  currentStep: number;
  steps: OnboardingStep[];
  fileUpload: FileUploadState;
  resumeAnalysis: ResumeAnalysisState;
  additionalInfo: AdditionalInfoState;
  parsedData: ParsedResumeData | null;
  isCompleting: boolean;
  completionError: string | null;
  isDirty: boolean; // Track if user has made changes
}

export interface OnboardingValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export interface OnboardingValidationResult {
  isValid: boolean;
  errors: OnboardingValidationError[];
  qualityScore: number;
  suggestions: string[];
}

// API Response types
export interface ResumeUploadResponse {
  success: boolean;
  text: string;
  filename: string;
  size: number;
  error?: string;
}

export interface ResumeAnalysisResponse {
  success: boolean;
  data: ParsedResumeData;
  qualityScore: number;
  suggestions: string[];
  error?: string;
}

export interface ProfileUpdateResponse {
  success: boolean;
  profile: ParsedResumeData;
  error?: string;
}

// Progress tracking
export interface OnboardingProgress {
  step: number;
  substep?: string;
  percentage: number;
  message: string;
  isError: boolean;
}


