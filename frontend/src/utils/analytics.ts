// Google Analytics 4 event tracking utilities

declare global {
  interface Window {
    gtag?: (
      command: 'event' | 'config' | 'set',
      targetId: string,
      config?: Record<string, any>
    ) => void;
    dataLayer?: any[];
  }
}

/**
 * Track custom events in Google Analytics
 */
export const trackEvent = (
  eventName: string,
  eventParams?: Record<string, any>
) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', eventName, eventParams);
  }
};

/**
 * Track page views
 */
export const trackPageView = (url: string, title?: string) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'page_view', {
      page_path: url,
      page_title: title,
    });
  }
};

/**
 * Track user sign ups
 */
export const trackSignUp = (method: 'google' | 'email' = 'email') => {
  trackEvent('sign_up', {
    method,
  });
};

/**
 * Track user sign ins
 */
export const trackSignIn = (method: 'google' | 'email' = 'email') => {
  trackEvent('login', {
    method,
  });
};

/**
 * Track resume generation start
 */
export const trackResumeGenerationStart = (jobId?: string) => {
  trackEvent('resume_generation_start', {
    job_id: jobId,
  });
};

/**
 * Track resume generation completion
 */
export const trackResumeGenerationComplete = (
  jobId: string,
  duration?: number
) => {
  trackEvent('resume_generation_complete', {
    job_id: jobId,
    duration_seconds: duration,
  });
};

/**
 * Track resume download
 */
export const trackResumeDownload = (jobId: string, format: 'pdf' = 'pdf') => {
  trackEvent('resume_download', {
    job_id: jobId,
    format,
  });
};

/**
 * Track job description paste/upload
 */
export const trackJobDescriptionAdd = (method: 'paste' | 'url' | 'file') => {
  trackEvent('job_description_add', {
    method,
  });
};

/**
 * Track Chrome extension clicks
 */
export const trackExtensionClick = () => {
  trackEvent('extension_click', {
    source: 'landing_page',
  });
};

/**
 * Track CTA button clicks
 */
export const trackCTAClick = (location: string, label: string) => {
  trackEvent('cta_click', {
    location,
    label,
  });
};

/**
 * Track search queries (for future search feature)
 */
export const trackSearch = (searchTerm: string) => {
  trackEvent('search', {
    search_term: searchTerm,
  });
};

/**
 * Track errors
 */
export const trackError = (errorMessage: string, errorLocation: string) => {
  trackEvent('error', {
    error_message: errorMessage,
    error_location: errorLocation,
  });
};
