// Centralized configuration for the application
export const config = {
  // OpenAI Model Configuration
  openai: {
    // Text generation models
    textModels: {
      fast: process.env.OPENAI_TEXT_MODEL_FAST || 'gpt-5-mini',
      quality: process.env.OPENAI_TEXT_MODEL_QUALITY || 'gpt-5',
      default: process.env.OPENAI_TEXT_MODEL || 'gpt-5-mini',
      // Available models (as of August 2025)
      'gpt-5-mini': 'gpt-5-mini',
    },
    // Embedding model
    embeddingModel: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
    // Response settings
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '3000'),
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
      : ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:8080', 'https://getresume.us'],
  },

  // Job Processing Configuration
  jobs: {
    cleanupDays: parseInt(process.env.JOB_CLEANUP_DAYS || '7'),
    sseHeartbeatInterval: parseInt(process.env.SSE_HEARTBEAT_INTERVAL || '15000'),
  },
};

// Helper function to get the appropriate OpenAI model based on mode
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