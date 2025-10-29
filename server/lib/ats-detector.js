// ATS Platform Detection Service
// Detects which Applicant Tracking System is used for a job posting

class ATSDetector {
  constructor() {
    // Comprehensive ATS URL patterns
    this.atsPatterns = {
      // ✅ Simple/Automatable ATS Platforms
      GREENHOUSE: {
        patterns: [
          /boards\.greenhouse\.io/i,
          /boards-api\.greenhouse\.io/i,
          /job-boards\.greenhouse\.io/i,
          /\.greenhouse\.io\/embed/i
        ],
        complexity: 'SIMPLE',
        aiApplyable: true,
        confidence: 0.99,
        description: 'Greenhouse - standardized forms, easy to automate',
        publicAPI: true,
        apiExample: 'https://boards-api.greenhouse.io/v1/boards/{company}/jobs'
      },

      LEVER: {
        patterns: [
          /jobs\.lever\.co/i,
          /lever\.co\/.*\/jobs/i,
          /api\.lever\.co\/v0\/postings/i
        ],
        complexity: 'SIMPLE',
        aiApplyable: true,
        confidence: 0.99,
        description: 'Lever - simple forms, highly automatable',
        publicAPI: true,
        apiExample: 'https://api.lever.co/v0/postings/{company}?mode=json'
      },

      ASHBY: {
        patterns: [
          /jobs\.ashbyhq\.com/i,
          /api\.ashbyhq\.com\/posting-api/i
        ],
        complexity: 'SIMPLE',
        aiApplyable: true,
        confidence: 0.99,
        description: 'Ashby - modern ATS with clean forms',
        publicAPI: true,
        apiExample: 'https://api.ashbyhq.com/posting-api/job-board/{company}'
      },

      WORKABLE: {
        patterns: [
          /apply\.workable\.com/i,
          /workable\.com\/api\/v1/i
        ],
        complexity: 'SIMPLE',
        aiApplyable: true,
        confidence: 0.99,
        description: 'Workable - straightforward application process',
        publicAPI: true,
        apiExample: 'https://apply.workable.com/api/v1/widget/accounts/{company}'
      },

      RECRUITEE: {
        patterns: [
          /recruitee\.com\/careers/i,
          /\.recruitee\.com/i
        ],
        complexity: 'SIMPLE',
        aiApplyable: true,
        confidence: 0.95,
        description: 'Recruitee - simple application forms'
      },

      BREEZYHR: {
        patterns: [
          /\.breezy\.hr/i,
          /breezyhr\.com\/.*\/positions/i
        ],
        complexity: 'SIMPLE',
        aiApplyable: true,
        confidence: 0.95,
        description: 'BreezyHR - user-friendly forms'
      },

      TEAMTAILOR: {
        patterns: [
          /jobs\.teamtailor\.com/i,
          /teamtailor\.com\/jobs/i
        ],
        complexity: 'SIMPLE',
        aiApplyable: true,
        confidence: 0.95,
        description: 'Teamtailor - clean application interface'
      },

      // ⚠️ Moderate Complexity (Try automation, expect some failures)
      SMARTRECRUITERS: {
        patterns: [
          /jobs\.smartrecruiters\.com/i,
          /smartrecruiters\.com\/.*\/job/i
        ],
        complexity: 'MODERATE',
        aiApplyable: true,
        confidence: 0.90,
        description: 'SmartRecruiters - varies by company configuration'
      },

      JOBVITE: {
        patterns: [
          /jobvite\.com\/.*\/job/i,
          /\.jobvite\.com/i,
          /jobs\.jobvite\.com/i
        ],
        complexity: 'MODERATE',
        aiApplyable: false,
        confidence: 0.90,
        description: 'Jobvite - can be complex, custom questions common'
      },

      BAMBOOHR: {
        patterns: [
          /bamboohr\.com\/jobs/i,
          /\.bamboohr\.com\/careers/i
        ],
        complexity: 'MODERATE',
        aiApplyable: true,
        confidence: 0.85,
        description: 'BambooHR - mostly simple but some customization'
      },

      // ❌ Complex ATS Platforms (Manual Apply Only)
      WORKDAY: {
        patterns: [
          /myworkdayjobs\.com/i,
          /\.wd1\.myworkdayjobs\.com/i,
          /\.wd5\.myworkdayjobs\.com/i,
          /\.wd12\.myworkdayjobs\.com/i,
          /workday\.com\/.*\/job/i,
          /workdayrecruiting\.com/i
        ],
        complexity: 'COMPLEX',
        aiApplyable: false,
        confidence: 0.99,
        description: 'Workday - highly complex, 30+ min applications, avoid automation',
        knownIssues: [
          '60% applicant dropout rate',
          'Custom fields per company',
          'Multi-step wizard',
          'Heavy anti-bot detection'
        ]
      },

      TALEO: {
        patterns: [
          /\.taleo\.net/i,
          /tbe\.taleo\.net/i,
          /careersection\.taleo\.net/i
        ],
        complexity: 'COMPLEX',
        aiApplyable: false,
        confidence: 0.99,
        description: 'Taleo (Oracle) - legacy system, very difficult to automate',
        knownIssues: [
          'Outdated UI',
          'Unpredictable workflows',
          'Frequent timeouts'
        ]
      },

      SUCCESSFACTORS: {
        patterns: [
          /successfactors\.com\/sfcareer/i,
          /\.successfactors\.eu/i,
          /\.successfactors\.com\/career/i
        ],
        complexity: 'COMPLEX',
        aiApplyable: false,
        confidence: 0.99,
        description: 'SAP SuccessFactors - enterprise ATS, highly customized'
      },

      ICIMS: {
        patterns: [
          /icims\.com\/jobs/i,
          /\.icims\.com/i,
          /app\.icims\.com/i
        ],
        complexity: 'COMPLEX',
        aiApplyable: false,
        confidence: 0.95,
        description: 'iCIMS - complex enterprise ATS'
      },

      ULTIPRO: {
        patterns: [
          /ultipro\.com\/.*\/careers/i,
          /recruiting\.ultipro\.com/i
        ],
        complexity: 'COMPLEX',
        aiApplyable: false,
        confidence: 0.90,
        description: 'UltiPro (UKG) - enterprise HR system'
      },

      ADECCORPP: {
        patterns: [
          /adeccorpp\.com/i,
          /adeccousa\.com\/jobs/i
        ],
        complexity: 'COMPLEX',
        aiApplyable: false,
        confidence: 0.85,
        description: 'Adecco Recruitment Platform - staffing agency ATS'
      },

      // 🌐 Simple Job Boards (Easy Apply)
      LINKEDIN_EASY_APPLY: {
        patterns: [
          /linkedin\.com\/jobs\/view.*easy-apply/i,
          /linkedin\.com\/jobs\/search.*easyApply/i
        ],
        complexity: 'SIMPLE',
        aiApplyable: true,
        confidence: 0.99,
        description: 'LinkedIn Easy Apply - requires LinkedIn login but simple form',
        requiresAuth: true
      },

      INDEED_QUICK_APPLY: {
        patterns: [
          /indeed\.com\/viewjob.*simplifiedapplication/i,
          /indeed\.com\/.*\/apply\/start/i,
          /indeed\.com\/rc\/clk.*iaapply/i
        ],
        complexity: 'SIMPLE',
        aiApplyable: true,
        confidence: 0.95,
        description: 'Indeed Quick Apply - standardized forms'
      },

      GLASSDOOR_EASY_APPLY: {
        patterns: [
          /glassdoor\.com\/job-listing.*easyapply/i,
          /glassdoor\.com\/Job\/.*easy-apply/i
        ],
        complexity: 'SIMPLE',
        aiApplyable: true,
        confidence: 0.95,
        description: 'Glassdoor Easy Apply'
      },

      ZIPRECRUITER: {
        patterns: [
          /ziprecruiter\.com\/jobs/i,
          /ziprecruiter\.com\/c\//i
        ],
        complexity: 'SIMPLE',
        aiApplyable: true,
        confidence: 0.90,
        description: 'ZipRecruiter - mostly simple applications'
      },

      ANGELLIST: {
        patterns: [
          /angel\.co\/.*\/jobs/i,
          /wellfound\.com\/.*\/jobs/i,
          /angel\.co\/l\//i
        ],
        complexity: 'SIMPLE',
        aiApplyable: true,
        confidence: 0.95,
        description: 'AngelList/Wellfound - startup jobs, simple forms'
      },

      // 🏢 Company-Specific Portals
      AMAZON_JOBS: {
        patterns: [
          /amazon\.jobs/i,
          /hiring\.amazon\.com/i
        ],
        complexity: 'COMPLEX',
        aiApplyable: false,
        confidence: 0.99,
        description: 'Amazon Jobs - custom assessments and tests'
      },

      GOOGLE_CAREERS: {
        patterns: [
          /careers\.google\.com/i,
          /google\.com\/about\/careers/i
        ],
        complexity: 'COMPLEX',
        aiApplyable: false,
        confidence: 0.99,
        description: 'Google Careers - complex multi-step process'
      },

      META_CAREERS: {
        patterns: [
          /metacareers\.com/i,
          /facebook\.com\/careers/i
        ],
        complexity: 'COMPLEX',
        aiApplyable: false,
        confidence: 0.99,
        description: 'Meta Careers - custom application portal'
      },

      // 🔍 Unknown/Generic
      COMPANY_PORTAL: {
        patterns: [
          /\/careers?\//i,
          /\/jobs?\//i,
          /\/opportunities/i
        ],
        complexity: 'UNKNOWN',
        aiApplyable: false,
        confidence: 0.50,
        description: 'Company career page - needs manual inspection'
      }
    };
  }

  /**
   * Detect ATS platform from URL
   * @param {string} url - Job application URL
   * @returns {Object} ATS detection result
   */
  detectFromURL(url) {
    if (!url) {
      return this.unknownResult();
    }

    const urlLower = url.toLowerCase();

    // Check each ATS pattern
    for (const [atsName, atsInfo] of Object.entries(this.atsPatterns)) {
      for (const pattern of atsInfo.patterns) {
        if (pattern.test(urlLower)) {
          return {
            atsType: atsName,
            ...atsInfo,
            detectionMethod: 'URL_PATTERN',
            url: url,
            matchedPattern: pattern.toString()
          };
        }
      }
    }

    // No match found
    return this.unknownResult(url);
  }

  /**
   * Extract company identifier from ATS URL
   * @param {string} url - Job application URL
   * @param {string} atsType - Detected ATS type
   * @returns {string|null} Company identifier
   */
  extractCompanyIdentifier(url, atsType) {
    const extractors = {
      GREENHOUSE: /boards\.greenhouse\.io\/([^\/]+)/i,
      LEVER: /jobs\.lever\.co\/([^\/]+)/i,
      ASHBY: /jobs\.ashbyhq\.com\/([^\/]+)/i,
      WORKABLE: /apply\.workable\.com\/([^\/]+)/i,
      WORKDAY: /myworkdayjobs\.com\/([^\/]+)/i
    };

    const extractor = extractors[atsType];
    if (!extractor) return null;

    const match = url.match(extractor);
    return match ? match[1] : null;
  }

  /**
   * Batch detect ATS for multiple URLs
   * @param {Array<string>} urls - Array of job URLs
   * @returns {Array<Object>} Detection results
   */
  detectBatch(urls) {
    return urls.map(url => this.detectFromURL(url));
  }

  /**
   * Get all automatable ATS platforms
   * @returns {Array<string>} List of ATS types that can be automated
   */
  getAutomatableATS() {
    return Object.entries(this.atsPatterns)
      .filter(([_, info]) => info.aiApplyable)
      .map(([atsName, _]) => atsName);
  }

  /**
   * Get ATS platforms with public APIs
   * @returns {Array<Object>} ATS info with API details
   */
  getATSWithPublicAPIs() {
    return Object.entries(this.atsPatterns)
      .filter(([_, info]) => info.publicAPI)
      .map(([atsName, info]) => ({
        atsType: atsName,
        apiEndpoint: info.apiExample,
        complexity: info.complexity,
        aiApplyable: info.aiApplyable
      }));
  }

  /**
   * Check if ATS requires authentication
   * @param {string} atsType - ATS type
   * @returns {boolean}
   */
  requiresAuth(atsType) {
    return this.atsPatterns[atsType]?.requiresAuth || false;
  }

  /**
   * Get complexity score (for sorting/filtering)
   * @param {string} complexity - SIMPLE, MODERATE, COMPLEX, UNKNOWN
   * @returns {number} Score 0-100 (higher = more complex)
   */
  getComplexityScore(complexity) {
    const scores = {
      SIMPLE: 20,
      MODERATE: 50,
      COMPLEX: 90,
      UNKNOWN: 100
    };
    return scores[complexity] || 100;
  }

  /**
   * Unknown ATS result
   * @param {string} url - URL that couldn't be identified
   * @returns {Object}
   */
  unknownResult(url = null) {
    return {
      atsType: 'UNKNOWN',
      complexity: 'UNKNOWN',
      aiApplyable: false,
      confidence: 0,
      description: 'Unknown ATS - manual inspection required',
      detectionMethod: 'NONE',
      url: url
    };
  }

  /**
   * Get statistics about detection patterns
   * @returns {Object} Stats
   */
  getStats() {
    const total = Object.keys(this.atsPatterns).length;
    const automatable = this.getAutomatableATS().length;
    const withAPI = this.getATSWithPublicAPIs().length;

    return {
      totalATS: total,
      automatableATS: automatable,
      withPublicAPI: withAPI,
      complexATS: Object.values(this.atsPatterns)
        .filter(info => info.complexity === 'COMPLEX').length,
      simpleATS: Object.values(this.atsPatterns)
        .filter(info => info.complexity === 'SIMPLE').length
    };
  }
}

// Export singleton instance
export default new ATSDetector();
