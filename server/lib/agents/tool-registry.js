/**
 * Tool registry with JSON schemas, validation, and execution
 * Includes config-based fallback for UNKNOWN actions
 */

import { executeTool as executeToolImpl } from './tools.js';
import { extractTimeframeFallback, extractRoleFallback } from '../config/search-fallbacks.js';
import { getSearchDefaults } from './profile-manager.js';
import logger from '../logger.js';

/**
 * Tool definitions with JSON schemas
 */
const TOOLS = {
  search_jobs: {
    name: 'search_jobs',
    description: 'Search for jobs matching specific criteria',
    schema: {
      type: 'object',
      properties: {
        role: {
          type: 'string',
          description: 'Normalized job role/title (e.g., "Product Manager", "Software Engineer")',
          maxLength: 100
        },
        query: {
          type: 'string',
          description: 'General search query for title/description/company',
          maxLength: 200
        },
        filter: {
          type: 'string',
          enum: ['all', 'ai_applyable', 'manual'],
          description: 'Filter by application method',
          default: 'all'
        },
        atsType: {
          type: 'string',
          enum: ['GREENHOUSE', 'LEVER', 'ASHBY', 'WORKABLE', 'SMARTRECRUITERS'],
          description: 'Filter by ATS type'
        },
        company: {
          type: 'string',
          description: 'Filter by company name',
          maxLength: 100
        },
        location: {
          type: 'string',
          description: 'Filter by location',
          maxLength: 100
        },
        postedSince: {
          type: 'string',
          description: 'Filter jobs posted after this date/time (ISO 8601 format)',
          pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d{3})?Z$'
        },
        limit: {
          type: 'number',
          minimum: 1,
          maximum: 50,
          default: 10,
          description: 'Number of results to return'
        },
        offset: {
          type: 'number',
          minimum: 0,
          maximum: 500,
          default: 0,
          description: 'Offset for pagination'
        }
      },
      additionalProperties: false
    }
  },

  generate_resume_preview: {
    name: 'generate_resume_preview',
    description: 'Generate a tailored resume preview for a specific job. You can provide either jobUrl, jobDescription, or jobId.',
    schema: {
      type: 'object',
      properties: {
        jobUrl: {
          type: 'string',
          description: 'URL of the job posting',
          pattern: '^https?://.+',
          maxLength: 500
        },
        jobDescription: {
          type: 'string',
          description: 'Job description text (can be used instead of jobUrl)',
          maxLength: 5000
        },
        jobTitle: {
          type: 'string',
          description: 'Job title',
          maxLength: 200
        },
        company: {
          type: 'string',
          description: 'Company name',
          maxLength: 200
        },
        jobId: {
          type: 'string',
          description: 'Internal job ID from search results (can be used instead of jobUrl)',
          maxLength: 100
        }
      },
      additionalProperties: false
    }
  },

  prepare_application_preview: {
    name: 'prepare_application_preview',
    description: 'Prepare an application preview with form fields and resume',
    schema: {
      type: 'object',
      properties: {
        jobUrl: {
          type: 'string',
          description: 'URL of the job posting',
          pattern: '^https?://.+',
          maxLength: 500
        },
        jobId: {
          type: 'string',
          description: 'Internal job ID if available',
          maxLength: 100
        }
      },
      additionalProperties: false
    }
  },

  create_goal: {
    name: 'create_goal',
    description: 'Create a new goal for the user based on conversation context',
    schema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Goal title (e.g., "Apply to 5 jobs per week")',
          maxLength: 200
        },
        description: {
          type: 'string',
          description: 'Detailed description of the goal',
          maxLength: 2000
        },
        type: {
          type: 'string',
          enum: ['JOB_SEARCH', 'RESUME_IMPROVEMENT', 'SKILL_DEVELOPMENT', 'INTERVIEW_PREP', 'CAREER_PLANNING', 'OTHER'],
          description: 'Type of goal',
          default: 'JOB_SEARCH'
        },
        targetDate: {
          type: 'string',
          description: 'Target completion date (ISO 8601 format)',
          pattern: '^\\d{4}-\\d{2}-\\d{2}'
        },
        metadata: {
          type: 'object',
          description: 'Additional goal metadata'
        }
      },
      required: ['title'],
      additionalProperties: false
    }
  },

  update_goal: {
    name: 'update_goal',
    description: 'Update progress on an existing goal',
    schema: {
      type: 'object',
      properties: {
        goalId: {
          type: 'string',
          description: 'ID of the goal to update'
        },
        status: {
          type: 'string',
          enum: ['ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'],
          description: 'New status for the goal'
        },
        progress: {
          type: 'number',
          minimum: 0,
          maximum: 100,
          description: 'Progress percentage (0-100)'
        },
        notes: {
          type: 'string',
          description: 'Progress notes',
          maxLength: 1000
        }
      },
      required: ['goalId'],
      additionalProperties: false
    }
  },

  list_goals: {
    name: 'list_goals',
    description: 'List all goals for the user',
    schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'],
          description: 'Filter by status (defaults to ACTIVE)'
        },
        limit: {
          type: 'number',
          minimum: 1,
          maximum: 50,
          default: 10,
          description: 'Number of goals to return'
        }
      },
      additionalProperties: false
    }
  },

  submit_application: {
    name: 'submit_application',
    description: 'Submit an application to a job (auto-apply). Use this after showing preview to actually apply.',
    schema: {
      type: 'object',
      properties: {
        jobId: {
          type: 'string',
          description: 'ID of the job from aggregated jobs',
          maxLength: 100
        },
        resumeJobId: {
          type: 'string',
          description: 'Optional: ID of the generated resume job to use',
          maxLength: 100
        }
      },
      required: ['jobId'],
      additionalProperties: false
    }
  },

  track_applications: {
    name: 'track_applications',
    description: 'Track status of submitted applications',
    schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['QUEUED', 'APPLYING', 'SUBMITTED', 'FAILED', 'CANCELLED', 'RETRYING'],
          description: 'Filter by application status'
        },
        limit: {
          type: 'number',
          minimum: 1,
          maximum: 50,
          default: 10,
          description: 'Number of applications to return'
        }
      },
      additionalProperties: false
    }
  },

  create_routine: {
    name: 'create_routine',
    description: 'Create a new routine/schedule for automated tasks',
    schema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Title of the routine (e.g., "Daily job search")',
          maxLength: 200
        },
        description: {
          type: 'string',
          description: 'Detailed description of what the routine does',
          maxLength: 2000
        },
        type: {
          type: 'string',
          enum: ['SEARCH_JOBS', 'APPLY_TO_JOBS', 'REVIEW_APPLICATIONS', 'UPDATE_GOALS', 'DAILY_DIGEST', 'WEEKLY_SUMMARY', 'CUSTOM'],
          description: 'Type of routine',
          default: 'SEARCH_JOBS'
        },
        frequency: {
          type: 'string',
          enum: ['HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM'],
          description: 'How often the routine runs',
          default: 'DAILY'
        },
        schedule: {
          type: 'string',
          description: 'Time to run in HH:MM format (e.g., "09:00")',
          pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$',
          default: '09:00'
        },
        config: {
          type: 'object',
          description: 'Configuration parameters for the routine (e.g., search filters, job criteria)'
        }
      },
      required: ['title'],
      additionalProperties: false
    }
  },

  list_routines: {
    name: 'list_routines',
    description: 'List all routines for the user',
    schema: {
      type: 'object',
      properties: {
        isActive: {
          type: 'boolean',
          description: 'Filter by active status (true=active only, false=inactive only, omit for all)'
        },
        limit: {
          type: 'number',
          minimum: 1,
          maximum: 50,
          default: 10,
          description: 'Number of routines to return'
        }
      },
      additionalProperties: false
    }
  },

  update_routine: {
    name: 'update_routine',
    description: 'Update an existing routine',
    schema: {
      type: 'object',
      properties: {
        routineId: {
          type: 'string',
          description: 'ID of the routine to update'
        },
        title: {
          type: 'string',
          description: 'New title for the routine',
          maxLength: 200
        },
        description: {
          type: 'string',
          description: 'New description',
          maxLength: 2000
        },
        frequency: {
          type: 'string',
          enum: ['HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM'],
          description: 'New frequency'
        },
        schedule: {
          type: 'string',
          description: 'New schedule time in HH:MM format',
          pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'
        },
        isActive: {
          type: 'boolean',
          description: 'Whether the routine is active (true) or paused (false)'
        },
        config: {
          type: 'object',
          description: 'New configuration parameters'
        }
      },
      required: ['routineId'],
      additionalProperties: false
    }
  },

  delete_routine: {
    name: 'delete_routine',
    description: 'Delete a routine permanently',
    schema: {
      type: 'object',
      properties: {
        routineId: {
          type: 'string',
          description: 'ID of the routine to delete'
        }
      },
      required: ['routineId'],
      additionalProperties: false
    }
  }
};

/**
 * Get all registered tools
 * @returns {Array<{ name: string, schema: object, handler: Function }>}
 */
export function getTools() {
  return Object.values(TOOLS).map(tool => ({
    name: tool.name,
    description: tool.description,
    schema: tool.schema,
    handler: (input, ctx) => executeToolImpl(tool.name, input, ctx)
  }));
}

/**
 * Get a specific tool by name
 * @param {string} name
 * @returns {object|null}
 */
export function getTool(name) {
  return TOOLS[name] || null;
}

/**
 * Validate tool input against schema
 * @param {string} name - Tool name
 * @param {object} input - Tool input
 * @throws {Error} If validation fails
 */
export function validate(name, input) {
  const tool = TOOLS[name];

  if (!tool) {
    logger.error({ toolName: name, availableTools: Object.keys(TOOLS) }, 'Unknown tool requested');
    throw new Error(`Unknown tool: ${name}. Available tools: ${Object.keys(TOOLS).join(', ')}`);
  }

  if (!input || typeof input !== 'object') {
    logger.error({ toolName: name, inputType: typeof input }, 'Invalid tool input type');
    throw new Error(`Tool ${name} input must be an object, got ${typeof input}`);
  }

  const { schema } = tool;

  // Check required fields (with special handling for generate_resume_preview)
  if (schema.required) {
    // Special case: generate_resume_preview needs either jobUrl OR jobDescription
    if (name === 'generate_resume_preview') {
      if (!input.jobUrl && !input.jobDescription && !input.jobId) {
        logger.error({
          toolName: name,
          providedFields: Object.keys(input)
        }, 'Missing required field: need jobUrl, jobDescription, or jobId');
        throw new Error(`Tool ${name} requires at least one of: jobUrl, jobDescription, or jobId`);
      }
    } else {
      // Standard required field validation
      for (const field of schema.required) {
        if (!(field in input)) {
          logger.error({
            toolName: name,
            missingField: field,
            providedFields: Object.keys(input),
            requiredFields: schema.required
          }, 'Missing required field');
          throw new Error(`Tool ${name} missing required field: ${field}. Provided fields: ${Object.keys(input).join(', ')}`);
        }
      }
    }
  }

  // Validate each property
  for (const [key, value] of Object.entries(input)) {
    // Check if property is allowed
    if (schema.additionalProperties === false && !(key in schema.properties)) {
      throw new Error(`Unknown property: ${key}`);
    }

    const propSchema = schema.properties[key];
    if (!propSchema) continue;

    // Type validation
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    if (value !== null && value !== undefined && propSchema.type && actualType !== propSchema.type) {
      throw new Error(`Property ${key} must be of type ${propSchema.type}, got ${actualType}`);
    }

    // String validations
    if (propSchema.type === 'string' && typeof value === 'string') {
      if (propSchema.maxLength && value.length > propSchema.maxLength) {
        throw new Error(`Property ${key} exceeds maximum length of ${propSchema.maxLength}`);
      }

      if (propSchema.pattern) {
        const regex = new RegExp(propSchema.pattern);
        if (!regex.test(value)) {
          throw new Error(`Property ${key} does not match required pattern`);
        }
      }

      if (propSchema.enum && !propSchema.enum.includes(value)) {
        throw new Error(`Property ${key} must be one of: ${propSchema.enum.join(', ')}`);
      }
    }

    // Number validations
    if (propSchema.type === 'number' && typeof value === 'number') {
      if (propSchema.minimum !== undefined && value < propSchema.minimum) {
        throw new Error(`Property ${key} must be >= ${propSchema.minimum}`);
      }

      if (propSchema.maximum !== undefined && value > propSchema.maximum) {
        throw new Error(`Property ${key} must be <= ${propSchema.maximum}`);
      }
    }
  }

  // Apply defaults
  const validated = { ...input };
  for (const [key, propSchema] of Object.entries(schema.properties)) {
    if (!(key in validated) && 'default' in propSchema) {
      validated[key] = propSchema.default;
    }
  }

  return validated;
}

/**
 * Handle UNKNOWN action type with config-based fallback
 * @param {string} message - Original user message
 * @param {object} profile - User profile with preferences
 * @returns {{ name: string, input: object } | null} - Tool call or null if can't infer
 */
export function handleUnknownAction(message, profile = null) {
  logger.info({ message, hasProfile: !!profile }, 'Applying config-based fallback for UNKNOWN action');

  try {
    // Try to extract timeframe from config
    const timeframeData = extractTimeframeFallback(message);

    // Try to extract role from config
    const roleFallback = extractRoleFallback(message);

    // Start with profile defaults if available
    const input = profile ? getSearchDefaults(profile) : {};

    // Apply fallback role if found
    if (roleFallback) {
      input.role = roleFallback;
    }

    // Apply fallback timeframe if found
    if (timeframeData?.postedSince) {
      input.postedSince = timeframeData.postedSince;
    }

    // If we have something to search with, return tool call
    if (Object.keys(input).length > 0) {
      input.limit = 10; // Default limit

      logger.info({ input }, 'Fallback generated search_jobs tool call');

      return {
        name: 'search_jobs',
        input
      };
    }

    // Cannot infer, return null (will trigger clarification message)
    logger.warn({ message }, 'Cannot infer search parameters from fallback');
    return null;

  } catch (error) {
    logger.error({ error: error.message, message }, 'Fallback extraction failed');
    return null;
  }
}

/**
 * Execute a tool with validation
 * @param {string} name - Tool name
 * @param {object} input - Tool input
 * @param {object} ctx - Execution context (userId, conversationId, etc.)
 * @returns {Promise<object>} Tool output
 */
export async function execute(name, input, ctx = {}) {
  try {
    // Validate input
    const validatedInput = validate(name, input);

    logger.info({ tool: name, input: validatedInput, ctx }, 'Executing tool');

    // Execute tool handler
    const tool = TOOLS[name];
    const result = await executeToolImpl(name, validatedInput, ctx);

    logger.info({ tool: name, resultSize: JSON.stringify(result).length }, 'Tool executed successfully');

    return result;
  } catch (error) {
    logger.error({ tool: name, error: error.message, input }, 'Tool execution failed');
    throw error;
  }
}

/**
 * Get tool schemas for OpenAI function calling
 * @returns {Array}
 */
export function getToolSchemasForOpenAI() {
  return Object.values(TOOLS).map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.schema
    }
  }));
}
