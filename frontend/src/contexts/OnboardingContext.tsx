// ONBOARDING TEMPORARILY DISABLED
// This context is currently unused but preserved for easy re-enablement.
// Backend endpoints remain intact and functional.
// To re-enable: Set ONBOARDING_ENABLED=true in ProtectedRoute.tsx and uncomment the route in App.tsx

// Context provider for managing onboarding state and data flow

import React, { createContext, useContext, useReducer, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { 
  OnboardingState, 
  OnboardingStep, 
  ParsedResumeData, 
  OnboardingProgress,
  OnboardingValidationResult 
} from '../types/onboarding';
import { OnboardingValidator } from '../utils/onboardingValidation';

// Action types
type OnboardingAction =
  | { type: 'SET_STEP'; payload: number }
  | { type: 'SET_FILE'; payload: File | null }
  | { type: 'SET_UPLOADING'; payload: boolean }
  | { type: 'SET_UPLOAD_PROGRESS'; payload: number }
  | { type: 'SET_UPLOAD_ERROR'; payload: string | null }
  | { type: 'SET_ANALYZING'; payload: boolean }
  | { type: 'SET_ANALYSIS_PROGRESS'; payload: number }
  | { type: 'SET_ANALYSIS_ERROR'; payload: string | null }
  | { type: 'SET_ANALYSIS_RESULT'; payload: ParsedResumeData | null }
  | { type: 'SET_ADDITIONAL_INFO'; payload: string }
  | { type: 'SET_PROCESSING_ADDITIONAL'; payload: boolean }
  | { type: 'SET_ADDITIONAL_ERROR'; payload: string | null }
  | { type: 'SET_COMPLETING'; payload: boolean }
  | { type: 'SET_COMPLETION_ERROR'; payload: string | null }
  | { type: 'SET_DIRTY'; payload: boolean }
  | { type: 'RESET_STATE' }
  | { type: 'LOAD_FROM_STORAGE'; payload: Partial<OnboardingState> }
  | { type: 'UPDATE_PARSED_DATA'; payload: Partial<ParsedResumeData> };

// Initial state
const initialState: OnboardingState = {
  currentStep: 1,
  steps: [
    { id: 1, title: 'Upload Resume', description: 'Upload your current resume', isCompleted: false, isActive: true },
    { id: 2, title: 'Review & Edit', description: 'Review and edit your information', isCompleted: false, isActive: false },
    { id: 3, title: 'Complete', description: 'Finish your profile setup', isCompleted: false, isActive: false }
  ],
  fileUpload: {
    file: null,
    isUploading: false,
    uploadProgress: 0,
    error: null
  },
  resumeAnalysis: {
    isAnalyzing: false,
    analysisProgress: 0,
    error: null,
    result: null
  },
  additionalInfo: {
    text: '',
    isProcessing: false,
    error: null
  },
  parsedData: null,
  isCompleting: false,
  completionError: null,
  isDirty: false
};

// Reducer
function onboardingReducer(state: OnboardingState, action: OnboardingAction): OnboardingState {
  switch (action.type) {
    case 'SET_STEP':
      return {
        ...state,
        currentStep: action.payload,
        steps: state.steps.map(step => ({
          ...step,
          isActive: step.id === action.payload,
          isCompleted: step.id < action.payload
        }))
      };

    case 'SET_FILE':
      return {
        ...state,
        fileUpload: {
          ...state.fileUpload,
          file: action.payload,
          error: null
        },
        isDirty: true
      };

    case 'SET_UPLOADING':
      return {
        ...state,
        fileUpload: {
          ...state.fileUpload,
          isUploading: action.payload,
          error: action.payload ? null : state.fileUpload.error
        }
      };

    case 'SET_UPLOAD_PROGRESS':
      return {
        ...state,
        fileUpload: {
          ...state.fileUpload,
          uploadProgress: action.payload
        }
      };

    case 'SET_UPLOAD_ERROR':
      return {
        ...state,
        fileUpload: {
          ...state.fileUpload,
          error: action.payload,
          isUploading: false
        }
      };

    case 'SET_ANALYZING':
      return {
        ...state,
        resumeAnalysis: {
          ...state.resumeAnalysis,
          isAnalyzing: action.payload,
          error: action.payload ? null : state.resumeAnalysis.error
        }
      };

    case 'SET_ANALYSIS_PROGRESS':
      return {
        ...state,
        resumeAnalysis: {
          ...state.resumeAnalysis,
          analysisProgress: action.payload
        }
      };

    case 'SET_ANALYSIS_ERROR':
      return {
        ...state,
        resumeAnalysis: {
          ...state.resumeAnalysis,
          error: action.payload,
          isAnalyzing: false
        }
      };

    case 'SET_ANALYSIS_RESULT':
      return {
        ...state,
        resumeAnalysis: {
          ...state.resumeAnalysis,
          result: action.payload,
          isAnalyzing: false
        },
        parsedData: action.payload,
        isDirty: true
      };

    case 'SET_ADDITIONAL_INFO':
      return {
        ...state,
        additionalInfo: {
          ...state.additionalInfo,
          text: action.payload,
          error: null
        },
        isDirty: true
      };

    case 'SET_PROCESSING_ADDITIONAL':
      return {
        ...state,
        additionalInfo: {
          ...state.additionalInfo,
          isProcessing: action.payload
        }
      };

    case 'SET_ADDITIONAL_ERROR':
      return {
        ...state,
        additionalInfo: {
          ...state.additionalInfo,
          error: action.payload,
          isProcessing: false
        }
      };

    case 'SET_COMPLETING':
      return {
        ...state,
        isCompleting: action.payload,
        completionError: action.payload ? null : state.completionError
      };

    case 'SET_COMPLETION_ERROR':
      return {
        ...state,
        completionError: action.payload,
        isCompleting: false
      };

    case 'SET_DIRTY':
      return {
        ...state,
        isDirty: action.payload
      };

    case 'UPDATE_PARSED_DATA':
      return {
        ...state,
        parsedData: state.parsedData ? { ...state.parsedData, ...action.payload } : null,
        isDirty: true
      };

    case 'LOAD_FROM_STORAGE':
      return {
        ...state,
        ...action.payload
      };

    case 'RESET_STATE':
      return initialState;

    default:
      return state;
  }
}

// Context
const OnboardingContext = createContext<{
  state: OnboardingState;
  dispatch: React.Dispatch<OnboardingAction>;
  validation: OnboardingValidationResult | null;
  progress: OnboardingProgress | null;
  saveToStorage: () => void;
  loadFromStorage: () => void;
  clearStorage: () => void;
  validateData: () => OnboardingValidationResult;
  canProceed: () => boolean;
  getStepStatus: (stepId: number) => 'pending' | 'current' | 'completed' | 'error';
} | null>(null);

// Provider component
export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(onboardingReducer, initialState);
  const [validation, setValidation] = React.useState<OnboardingValidationResult | null>(null);
  const [progress, setProgress] = React.useState<OnboardingProgress | null>(null);
  const saveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Debounced auto-save to localStorage when critical data changes
  useEffect(() => {
    if (state.isDirty && (state.parsedData || state.fileUpload.file)) {
      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      // Set new timeout for debounced save
      saveTimeoutRef.current = setTimeout(() => {
        saveToStorage();
      }, 1000); // Save after 1 second of inactivity
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [state.parsedData, state.fileUpload.file, state.currentStep, state.additionalInfo.text]);

  // Auto-validate when parsed data changes
  useEffect(() => {
    if (state.parsedData) {
      const validationResult = OnboardingValidator.validateParsedData(state.parsedData);
      setValidation(validationResult);
    }
  }, [state.parsedData]);

  // Update progress based on current state
  useEffect(() => {
    const currentProgress = calculateProgress();
    setProgress(currentProgress);
  }, [state]);

  const saveToStorage = () => {
    try {
      const dataToSave = {
        currentStep: state.currentStep,
        fileUpload: state.fileUpload,
        additionalInfo: state.additionalInfo,
        parsedData: state.parsedData
      };
      localStorage.setItem('onboarding_data', JSON.stringify(dataToSave));
    } catch (error) {
      console.warn('Failed to save onboarding data to localStorage:', error);
    }
  };

  const loadFromStorage = useCallback(() => {
    try {
      const saved = localStorage.getItem('onboarding_data');
      if (saved) {
        const parsedData = JSON.parse(saved);
        dispatch({ type: 'LOAD_FROM_STORAGE', payload: parsedData });
      }
    } catch (error) {
      console.warn('Failed to load onboarding data from localStorage:', error);
    }
  }, []);

  const clearStorage = useCallback(() => {
    try {
      localStorage.removeItem('onboarding_data');
      dispatch({ type: 'RESET_STATE' });
    } catch (error) {
      console.warn('Failed to clear onboarding data from localStorage:', error);
    }
  }, []);

  const validateData = (): OnboardingValidationResult => {
    if (!state.parsedData) {
      return {
        isValid: false,
        errors: [{ field: 'parsedData', message: 'No resume data available', severity: 'error' }],
        qualityScore: 0,
        suggestions: ['Please upload and analyze your resume first']
      };
    }
    return OnboardingValidator.validateParsedData(state.parsedData);
  };

  const canProceed = (): boolean => {
    switch (state.currentStep) {
      case 1:
        return state.fileUpload.file !== null && !state.fileUpload.isUploading && !state.fileUpload.error;
      case 2:
        return state.parsedData !== null && !state.resumeAnalysis.isAnalyzing && !state.resumeAnalysis.error;
      case 3:
        return state.parsedData !== null && !state.isCompleting && !state.completionError;
      default:
        return false;
    }
  };

  const getStepStatus = (stepId: number): 'pending' | 'current' | 'completed' | 'error' => {
    const step = state.steps.find(s => s.id === stepId);
    if (!step) return 'pending';
    
    if (stepId < state.currentStep) return 'completed';
    if (stepId === state.currentStep) {
      if (stepId === 1 && state.fileUpload.error) return 'error';
      if (stepId === 2 && state.resumeAnalysis.error) return 'error';
      if (stepId === 3 && state.completionError) return 'error';
      return 'current';
    }
    return 'pending';
  };

  const calculateProgress = (): OnboardingProgress => {
    const step = state.currentStep;
    let percentage = 0;
    let message = '';
    let isError = false;

    switch (step) {
      case 1:
        if (state.fileUpload.isUploading) {
          percentage = state.fileUpload.uploadProgress;
          message = 'Uploading resume...';
        } else if (state.fileUpload.file) {
          percentage = 100;
          message = 'Resume uploaded successfully';
        } else {
          percentage = 0;
          message = 'Select a resume file to upload';
        }
        if (state.fileUpload.error) {
          isError = true;
          message = state.fileUpload.error;
        }
        break;

      case 2:
        if (state.resumeAnalysis.isAnalyzing) {
          percentage = state.resumeAnalysis.analysisProgress;
          message = 'Analyzing resume...';
        } else if (state.resumeAnalysis.result) {
          percentage = 100;
          message = 'Resume analyzed successfully';
        } else {
          percentage = 0;
          message = 'Click continue to analyze your resume';
        }
        if (state.resumeAnalysis.error) {
          isError = true;
          message = state.resumeAnalysis.error;
        }
        break;

      case 3:
        if (state.isCompleting) {
          percentage = 50;
          message = 'Saving your profile...';
        } else if (state.parsedData) {
          percentage = 100;
          message = 'Ready to complete setup';
        } else {
          percentage = 0;
          message = 'Complete your profile information';
        }
        if (state.completionError) {
          isError = true;
          message = state.completionError;
        }
        break;

      default:
        percentage = 0;
        message = 'Getting started...';
    }

    return {
      step,
      percentage,
      message,
      isError
    };
  };

  const contextValue = useMemo(() => ({
    state,
    dispatch,
    validation,
    progress,
    saveToStorage,
    loadFromStorage,
    clearStorage,
    validateData,
    canProceed,
    getStepStatus
  }), [state, validation, progress, saveToStorage, loadFromStorage, clearStorage, validateData, canProceed, getStepStatus]);

  return (
    <OnboardingContext.Provider value={contextValue}>
      {children}
    </OnboardingContext.Provider>
  );
}

// Hook to use the context
export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
}


