export const resumeSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  required: ["personalInfo", "summary", "experience", "skills", "education"],
  properties: {
    personalInfo: {
      type: "object",
      required: ["name", "email"],
      properties: {
        name: { type: "string", minLength: 1 },
        email: { type: "string", format: "email" },
        phone: { type: "string" },
        linkedin: { type: "string", format: "uri" },
        github: { type: "string", format: "uri" },
        website: { type: "string", format: "uri" },
        location: { type: "string" }
      }
    },
    summary: {
      type: "string",
      minLength: 50,
      maxLength: 500
    },
    experience: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        required: ["company", "position", "startDate", "bullets"],
        properties: {
          company: { type: "string", minLength: 1 },
          position: { type: "string", minLength: 1 },
          location: { type: "string" },
          startDate: { type: "string", pattern: "^\\d{4}-\\d{2}$" },
          endDate: {
            oneOf: [
              { type: "string", pattern: "^\\d{4}-\\d{2}$" },
              { type: "string", enum: ["Present", "Current"] }
            ]
          },
          bullets: {
            type: "array",
            minItems: 2,
            maxItems: 6,
            items: {
              type: "string",
              minLength: 20,
              maxLength: 200
            }
          },
          relevanceScore: { type: "number", minimum: 0, maximum: 1 }
        }
      }
    },
    skills: {
      type: "object",
      required: ["technical"],
      properties: {
        technical: {
          type: "array",
          minItems: 5,
          maxItems: 20,
          items: {
            type: "object",
            required: ["name", "category"],
            properties: {
              name: { type: "string", minLength: 1 },
              category: {
                type: "string",
                enum: ["programming", "framework", "database", "cloud", "tool", "other"]
              },
              relevanceScore: { type: "number", minimum: 0, maximum: 1 }
            }
          }
        },
        soft: {
          type: "array",
          maxItems: 10,
          items: { type: "string", minLength: 1 }
        }
      }
    },
    education: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        required: ["school", "degree"],
        properties: {
          school: { type: "string", minLength: 1 },
          degree: { type: "string", minLength: 1 },
          field: { type: "string" },
          graduationDate: { type: "string", pattern: "^\\d{4}(-\\d{2})?$" },
          gpa: { type: "string", pattern: "^\\d\\.\\d{1,2}$" },
          honors: {
            type: "array",
            items: { type: "string" }
          }
        }
      }
    },
    projects: {
      type: "array",
      maxItems: 5,
      items: {
        type: "object",
        required: ["name", "description"],
        properties: {
          name: { type: "string", minLength: 1 },
          description: { type: "string", minLength: 20, maxLength: 150 },
          technologies: {
            type: "array",
            items: { type: "string" }
          },
          link: { type: "string", format: "uri" },
          date: { type: "string" },
          relevanceScore: { type: "number", minimum: 0, maximum: 1 }
        }
      }
    },
    certifications: {
      type: "array",
      maxItems: 5,
      items: {
        type: "object",
        required: ["name", "issuer"],
        properties: {
          name: { type: "string", minLength: 1 },
          issuer: { type: "string", minLength: 1 },
          date: { type: "string", pattern: "^\\d{4}(-\\d{2})?$" },
          expirationDate: { type: "string", pattern: "^\\d{4}(-\\d{2})?$" },
          credentialId: { type: "string" }
        }
      }
    },
    metadata: {
      type: "object",
      properties: {
        targetRole: { type: "string" },
        targetCompany: { type: "string" },
        keywords: {
          type: "array",
          items: { type: "string" }
        },
        generatedAt: { type: "string", format: "date-time" },
        version: { type: "string" }
      }
    }
  }
};

export async function validateResumeJson(data) {
  const Ajv = (await import('ajv')).default;
  const addFormats = (await import('ajv-formats')).default;

  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);

  const validate = ajv.compile(resumeSchema);
  const valid = validate(data);

  if (!valid) {
    return {
      valid: false,
      errors: validate.errors.map(err => ({
        path: err.instancePath,
        message: err.message,
        params: err.params
      }))
    };
  }

  return { valid: true };
}