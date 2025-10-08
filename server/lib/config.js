// Centralized configuration for the application
export const config = {
  // AI Provider Configuration - GEMINI FIRST, OpenAI as fallback
  ai: {
    // Primary provider (Gemini is cheaper and faster)
    primary: process.env.AI_PRIMARY_PROVIDER || 'gemini',
    fallback: process.env.AI_FALLBACK_PROVIDER || 'openai',
  },

  // Gemini Model Configuration (PRIMARY)
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    // Text generation models
    textModels: {
      fast: 'gemini-1.5-flash',      // Fastest, cheapest
      quality: 'gemini-1.5-pro',     // Highest quality
      default: 'gemini-1.5-flash',   // Default to fast
    },
    // Response settings - HIGH tokens for LaTeX generation
    maxTokens: parseInt(process.env.GEMINI_MAX_TOKENS || '10000'), // Increased for LaTeX
    temperature: parseFloat(process.env.GEMINI_TEMPERATURE || '0.7'),
  },

  // OpenAI Model Configuration (FALLBACK)
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    // Text generation models
    textModels: {
      fast: process.env.OPENAI_TEXT_MODEL_FAST || 'gpt-4o-mini',
      quality: process.env.OPENAI_TEXT_MODEL_QUALITY || 'gpt-4o',
      default: process.env.OPENAI_TEXT_MODEL || 'gpt-4o-mini',
      // Available models
      'gpt-4o-mini': 'gpt-4o-mini',
      'gpt-4o': 'gpt-4o',
    },
    // Embedding model
    embeddingModel: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
    // Response settings - HIGH tokens for LaTeX generation
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '10000'), // Increased for LaTeX
    temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
  },

  // Queue Configuration
  queue: {
    maxAttempts: parseInt(process.env.QUEUE_MAX_ATTEMPTS || '3'),
    backoffDelay: parseInt(process.env.QUEUE_BACKOFF_DELAY || '2000'),
  },

  // Redis Configuration
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
    maxRetriesPerRequest: 3,
    enableReadyCheck: false,
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
  },

  // Embedding Configuration
  embeddings: {
    batchSize: parseInt(process.env.EMBEDDING_BATCH_SIZE || '20'),
    dimensions: 1536, // text-embedding-3-small dimensions
    relevanceThreshold: {
      skills: 0.7,
      experiences: 0.65,
    },
  },

  // PDF Generation Configuration
  pdf: {
    keepTempDirOnFail: true, // Keep for debugging
    engine: process.env.PDF_ENGINE || 'pdflatex', // Primary engine
    pdflatex: {
      command: process.env.PDFLATEX_COMMAND || 'pdflatex',
      timeout: parseInt(process.env.PDFLATEX_TIMEOUT || '5000', 10),
      args: ['-interaction=nonstopmode', '-halt-on-error', '-file-line-error', '-no-shell-escape', 'resume.tex']
    },
    tectonic: {
      command: process.env.TECTONIC_COMMAND || 'tectonic',
      timeout: parseInt(process.env.TECTONIC_TIMEOUT || '5000', 10),
      args: ['--chatter', 'minimal', '--keep-logs', 'resume.tex']
    },
  },

  // Server Configuration
  server: {
    port: parseInt(process.env.PORT || '3000'),
    environment: process.env.NODE_ENV || 'development',
    allowedOrigins: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
      : [
          'http://localhost:3000',
          'http://localhost:5173',
          'http://localhost:8080',
          'https://happyresumes.com',
          'https://www.happyresumes.com',
          // Allow Chrome extension
          'chrome-extension://pkhamkbdejjbjeckjkoofjpcbbghdgoc'
        ],
  },

  // Job Processing Configuration
  jobs: {
    cleanupDays: parseInt(process.env.JOB_CLEANUP_DAYS || '7'),
    sseHeartbeatInterval: parseInt(process.env.SSE_HEARTBEAT_INTERVAL || '15000'),
  },
};

// Helper function to get AI model - GEMINI FIRST, OpenAI fallback
export function getAIModel(aiMode = 'default') {
  const provider = config.ai.primary;

  if (provider === 'gemini') {
    return {
      provider: 'gemini',
      model: getGeminiModel(aiMode),
      apiKey: config.gemini.apiKey
    };
  } else {
    return {
      provider: 'openai',
      model: getOpenAIModel(aiMode),
      apiKey: config.openai.apiKey
    };
  }
}

// Helper function to get Gemini model
export function getGeminiModel(aiMode) {
  // Check if it's a direct model name
  if (config.gemini.textModels[aiMode]) {
    return config.gemini.textModels[aiMode];
  }

  // Map quality levels
  switch (aiMode) {
    case 'quality':
      return config.gemini.textModels.quality;
    case 'fast':
      return config.gemini.textModels.fast;
    default:
      return config.gemini.textModels.default;
  }
}

// Helper function to get the appropriate OpenAI model based on mode (for fallback)
export function getOpenAIModel(aiMode) {
  // Check if it's a direct model name
  if (config.openai.textModels[aiMode]) {
    return config.openai.textModels[aiMode];
  }

  // Map quality levels
  switch (aiMode) {
    case 'quality':
      return config.openai.textModels.quality;
    case 'fast':
      return config.openai.textModels.fast;
    default:
      return config.openai.textModels.default;
  }
}