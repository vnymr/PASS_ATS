/**
 * Template Registry System
 * Manages LaTeX resume templates for the micro-prompt pipeline
 * Loads template definitions from manifest.yaml and provides access methods
 */

import { promises as fs } from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class TemplateRegistry {
  constructor() {
    this.templates = new Map();
    this.manifestPath = path.join(__dirname, 'manifest.yaml');
    this.templatesDir = path.join(__dirname, '..');
    this.initialized = false;
  }

  /**
   * Initialize the registry by loading the manifest
   */
  async initialize() {
    if (this.initialized) return;

    try {
      // Load and parse the manifest
      const manifestContent = await fs.readFile(this.manifestPath, 'utf8');
      const manifest = yaml.load(manifestContent);

      // Validate manifest structure
      if (!manifest.templates || !Array.isArray(manifest.templates)) {
        throw new Error('Invalid manifest: missing templates array');
      }

      // Load each template definition
      for (const templateDef of manifest.templates) {
        await this.loadTemplate(templateDef);
      }

      this.initialized = true;
      console.log(`[TemplateRegistry] Loaded ${this.templates.size} templates`);
    } catch (error) {
      console.error('[TemplateRegistry] Failed to initialize:', error);
      throw new Error(`Template registry initialization failed: ${error.message}`);
    }
  }

  /**
   * Load a single template from its definition
   */
  async loadTemplate(templateDef) {
    const { id, version, metadata, files, capacity } = templateDef;

    // Validate required fields
    if (!id || !files || !files.preamble || !files.wireframe) {
      throw new Error(`Invalid template definition for ${id}: missing required fields`);
    }

    // Construct full file paths
    const preamblePath = path.join(this.templatesDir, files.preamble);
    const wireframePath = path.join(this.templatesDir, files.wireframe);

    try {
      // Load template files
      const [preambleContent, wireframeContent] = await Promise.all([
        fs.readFile(preamblePath, 'utf8'),
        fs.readFile(wireframePath, 'utf8')
      ]);

      // Store template in registry
      this.templates.set(id, {
        id,
        version: version || '1.0.0',
        metadata: metadata || {},
        capacity: capacity || this.getDefaultCapacity(),
        files: {
          preamble: preambleContent,
          wireframe: wireframeContent,
          preamblePath: files.preamble,
          wireframePath: files.wireframe
        },
        placeholders: this.extractPlaceholders(wireframeContent)
      });

      console.log(`[TemplateRegistry] Loaded template: ${id} v${version}`);
    } catch (error) {
      console.error(`[TemplateRegistry] Failed to load template ${id}:`, error);
      throw new Error(`Failed to load template ${id}: ${error.message}`);
    }
  }

  /**
   * Extract placeholder names from wireframe content
   */
  extractPlaceholders(wireframeContent) {
    const placeholderRegex = /\[([A-Z_]+)\]/g;
    const placeholders = new Set();
    let match;

    while ((match = placeholderRegex.exec(wireframeContent)) !== null) {
      placeholders.add(match[1]);
    }

    return Array.from(placeholders);
  }

  /**
   * Get default capacity limits
   */
  getDefaultCapacity() {
    return {
      bullets_per_role: 4,
      roles_max: 5,
      bullet_max_words: 25,
      summary_max_words: 35,
      skills_max_items: 30
    };
  }

  /**
   * Get a template by ID
   * @param {string} templateId - The template identifier
   * @returns {Object} Template object with preamble and wireframe
   */
  async getTemplateById(templateId) {
    // Ensure registry is initialized
    if (!this.initialized) {
      await this.initialize();
    }

    const template = this.templates.get(templateId);

    if (!template) {
      const availableIds = Array.from(this.templates.keys()).join(', ');
      throw new Error(`Template not found: ${templateId}. Available templates: ${availableIds}`);
    }

    return {
      id: template.id,
      version: template.version,
      metadata: template.metadata,
      capacity: template.capacity,
      preamble: template.files.preamble,
      wireframe: template.files.wireframe,
      placeholders: template.placeholders
    };
  }

  /**
   * Get all available template IDs
   */
  async getAvailableTemplates() {
    if (!this.initialized) {
      await this.initialize();
    }

    return Array.from(this.templates.entries()).map(([id, template]) => ({
      id,
      version: template.version,
      name: template.metadata.name || id,
      description: template.metadata.description || '',
      best_for: template.metadata.best_for || [],
      capacity: template.capacity
    }));
  }

  /**
   * Get template metadata without loading content
   */
  async getTemplateMetadata(templateId) {
    if (!this.initialized) {
      await this.initialize();
    }

    const template = this.templates.get(templateId);

    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    return {
      id: template.id,
      version: template.version,
      metadata: template.metadata,
      capacity: template.capacity,
      placeholders: template.placeholders
    };
  }

  /**
   * Validate template content for required placeholders
   */
  async validateTemplate(templateId, providedData) {
    const template = await this.getTemplateById(templateId);
    const missingPlaceholders = [];

    for (const placeholder of template.placeholders) {
      if (!providedData[placeholder]) {
        missingPlaceholders.push(placeholder);
      }
    }

    if (missingPlaceholders.length > 0) {
      return {
        valid: false,
        missingPlaceholders,
        message: `Missing required placeholders: ${missingPlaceholders.join(', ')}`
      };
    }

    return {
      valid: true,
      message: 'All required placeholders provided'
    };
  }

  /**
   * Reload templates from manifest (useful for development)
   */
  async reload() {
    this.templates.clear();
    this.initialized = false;
    await this.initialize();
  }
}

// Create singleton instance
const registry = new TemplateRegistry();

// Export registry methods
export default {
  /**
   * Get a template by ID
   * @param {string} templateId - Template identifier
   * @returns {Promise<Object>} Template object with preamble and wireframe
   */
  getTemplateById: async (templateId) => {
    return await registry.getTemplateById(templateId);
  },

  /**
   * Get all available templates
   * @returns {Promise<Array>} Array of template metadata
   */
  getAvailableTemplates: async () => {
    return await registry.getAvailableTemplates();
  },

  /**
   * Get template metadata
   * @param {string} templateId - Template identifier
   * @returns {Promise<Object>} Template metadata
   */
  getTemplateMetadata: async (templateId) => {
    return await registry.getTemplateMetadata(templateId);
  },

  /**
   * Validate template data
   * @param {string} templateId - Template identifier
   * @param {Object} providedData - Data to validate
   * @returns {Promise<Object>} Validation result
   */
  validateTemplate: async (templateId, providedData) => {
    return await registry.validateTemplate(templateId, providedData);
  },

  /**
   * Initialize the registry
   * @returns {Promise<void>}
   */
  initialize: async () => {
    return await registry.initialize();
  },

  /**
   * Reload templates (for development)
   * @returns {Promise<void>}
   */
  reload: async () => {
    return await registry.reload();
  }
};