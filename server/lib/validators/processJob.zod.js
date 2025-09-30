import { z } from 'zod';

// Valid template IDs (extend as needed)
const TEMPLATE_IDS = ['ats_v1', 'modern', 'classic', 'minimal', 'default'];

// Valid focus modes
const FOCUS_MODES = ['General', 'AI_Product', 'Data', 'SWE'];

// Request body schema for POST /api/process-job
export const processJobSchema = z.object({
  profileSnapshotId: z.string().min(1, 'profileSnapshotId is required'),

  jobDescription: z.string()
    .min(500, 'Job description must be at least 500 characters')
    .max(20000, 'Job description must not exceed 20,000 characters')
    .transform(str => {
      // Strip HTML tags for security
      return str.replace(/<[^>]*>/g, '');
    }),

  templateId: z.string()
    .default('ats_v1')
    .refine(
      val => TEMPLATE_IDS.includes(val) || val.length > 0,
      'Invalid template ID'
    ),

  focusMode: z.string()
    .default('General')
    .refine(
      val => FOCUS_MODES.includes(val) || val.length > 0,
      'Invalid focus mode'
    ),

  constraints: z.object({
    length: z.string().optional(),
    noBuzzwords: z.boolean().optional(),
    emphasizeSkills: z.array(z.string()).optional(),
    excludeProjects: z.array(z.string()).optional(),
  }).optional().default({})
});

// Export type helper for TypeScript users (optional)
export const validateProcessJobRequest = (data) => {
  return processJobSchema.safeParse(data);
};