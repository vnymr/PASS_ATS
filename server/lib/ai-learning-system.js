/**
 * AI Learning System
 * Records successful application patterns for future reference
 */

import logger from './logger.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class AILearningSystem {
  constructor(learningDir = path.join(__dirname, '../learned-patterns')) {
    this.learningDir = learningDir;
    this.ensureDirectory();
  }

  async ensureDirectory() {
    try {
      await fs.mkdir(this.learningDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create learning directory:', error.message);
    }
  }

  /**
   * Record a successful application pattern
   * @param {Object} pattern - The pattern to record
   */
  async recordSuccessfulPattern(pattern) {
    const {
      url,
      company,
      jobTitle,
      fields,
      responses,
      issues,
      solutions,
      timestamp = new Date().toISOString()
    } = pattern;

    // Extract domain from URL
    const domain = this.extractDomain(url);
    const filename = `${domain}_${Date.now()}.json`;
    const filepath = path.join(this.learningDir, filename);

    const learningEntry = {
      metadata: {
        url,
        domain,
        company,
        jobTitle,
        timestamp,
        success: true
      },
      formStructure: {
        totalFields: fields.length,
        fieldTypes: this.categorizeFields(fields),
        requiredFields: fields.filter(f => f.required).map(f => ({
          name: f.name,
          type: f.type,
          label: f.label
        }))
      },
      aiResponses: responses,
      problemsSolved: issues && issues.length > 0 ? issues.map((issue, idx) => ({
        problem: issue,
        solution: solutions?.[idx],
        timestamp: new Date().toISOString()
      })) : [],
      patterns: {
        // Extract reusable patterns
        commonQuestions: this.extractCommonQuestions(fields),
        fieldNamingConventions: this.analyzeFieldNaming(fields),
        formLayout: this.analyzeFormLayout(fields)
      }
    };

    try {
      await fs.writeFile(filepath, JSON.stringify(learningEntry, null, 2));
      logger.info(`📚 Recorded learning pattern: ${filename}`);

      // Also update domain-specific knowledge base
      await this.updateDomainKnowledge(domain, learningEntry);

      return filepath;
    } catch (error) {
      logger.error('❌ Failed to record learning pattern:', error.message);
      return null;
    }
  }

  /**
   * Retrieve learned patterns for a domain
   * @param {String} url - URL to check for patterns
   * @returns {Array} Array of learned patterns
   */
  async getLearnedPatternsForUrl(url) {
    const domain = this.extractDomain(url);
    const knowledgeFile = path.join(this.learningDir, `${domain}_knowledge.json`);

    try {
      const data = await fs.readFile(knowledgeFile, 'utf-8');
      const knowledge = JSON.parse(data);
      logger.info(`📖 Found learned patterns for ${domain}: ${knowledge.applications.length} applications`);
      return knowledge;
    } catch (error) {
      // No learned patterns yet
      return null;
    }
  }

  /**
   * Update domain-specific knowledge base
   */
  async updateDomainKnowledge(domain, newEntry) {
    const knowledgeFile = path.join(this.learningDir, `${domain}_knowledge.json`);

    let knowledge = {
      domain,
      firstSeen: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      applications: [],
      commonPatterns: {
        fieldNames: {},
        questionTypes: [],
        successStrategies: []
      }
    };

    // Try to load existing knowledge
    try {
      const existing = await fs.readFile(knowledgeFile, 'utf-8');
      knowledge = JSON.parse(existing);
    } catch {
      // New domain
    }

    // Add new entry
    knowledge.applications.push({
      timestamp: newEntry.metadata.timestamp,
      jobTitle: newEntry.metadata.jobTitle,
      fieldsCount: newEntry.formStructure.totalFields,
      problemsSolved: newEntry.problemsSolved.length
    });

    knowledge.lastUpdated = new Date().toISOString();

    // Update common patterns
    this.updateCommonPatterns(knowledge, newEntry);

    // Save updated knowledge
    await fs.writeFile(knowledgeFile, JSON.stringify(knowledge, null, 2));
    logger.info(`📘 Updated domain knowledge for ${domain}`);
  }

  /**
   * Update common patterns based on new entry
   */
  updateCommonPatterns(knowledge, newEntry) {
    // Track field name patterns
    newEntry.formStructure.requiredFields.forEach(field => {
      const key = field.name.toLowerCase();
      if (!knowledge.commonPatterns.fieldNames[key]) {
        knowledge.commonPatterns.fieldNames[key] = {
          name: field.name,
          type: field.type,
          label: field.label,
          count: 0
        };
      }
      knowledge.commonPatterns.fieldNames[key].count++;
    });

    // Track question types
    newEntry.patterns.commonQuestions.forEach(q => {
      if (!knowledge.commonPatterns.questionTypes.includes(q)) {
        knowledge.commonPatterns.questionTypes.push(q);
      }
    });

    // Track successful solutions
    newEntry.problemsSolved.forEach(problem => {
      knowledge.commonPatterns.successStrategies.push({
        problem: problem.problem,
        solution: problem.solution,
        timestamp: problem.timestamp
      });
    });
  }

  /**
   * Get all learning statistics
   */
  async getLearningSummary() {
    try {
      const files = await fs.readdir(this.learningDir);
      const knowledgeFiles = files.filter(f => f.endsWith('_knowledge.json'));

      const summary = {
        totalDomains: knowledgeFiles.length,
        domains: []
      };

      for (const file of knowledgeFiles) {
        const data = await fs.readFile(path.join(this.learningDir, file), 'utf-8');
        const knowledge = JSON.parse(data);
        summary.domains.push({
          domain: knowledge.domain,
          applications: knowledge.applications.length,
          lastUpdated: knowledge.lastUpdated
        });
      }

      return summary;
    } catch (error) {
      return { totalDomains: 0, domains: [] };
    }
  }

  // Helper methods

  extractDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return 'unknown';
    }
  }

  categorizeFields(fields) {
    const categories = {};
    fields.forEach(field => {
      const type = field.type || 'text';
      categories[type] = (categories[type] || 0) + 1;
    });
    return categories;
  }

  extractCommonQuestions(fields) {
    const questions = [];
    const questionKeywords = ['why', 'tell us', 'describe', 'explain', 'what', 'how'];

    fields.forEach(field => {
      const label = (field.label || '').toLowerCase();
      if (questionKeywords.some(keyword => label.includes(keyword))) {
        questions.push({
          label: field.label,
          type: field.type,
          category: this.categorizeQuestion(field.label)
        });
      }
    });

    return questions;
  }

  categorizeQuestion(label) {
    const lower = label.toLowerCase();
    if (lower.includes('why') && lower.includes('company')) return 'why_company';
    if (lower.includes('why') && lower.includes('role')) return 'why_role';
    if (lower.includes('experience')) return 'experience';
    if (lower.includes('skill')) return 'skills';
    if (lower.includes('challenge')) return 'challenges';
    if (lower.includes('strength')) return 'strengths';
    if (lower.includes('weakness')) return 'weaknesses';
    return 'other';
  }

  analyzeFieldNaming(fields) {
    const namingPatterns = {
      camelCase: 0,
      snake_case: 0,
      kebabCase: 0,
      standard: 0
    };

    fields.forEach(field => {
      const name = field.name;
      if (/[a-z][A-Z]/.test(name)) namingPatterns.camelCase++;
      else if (name.includes('_')) namingPatterns.snake_case++;
      else if (name.includes('-')) namingPatterns.kebabCase++;
      else namingPatterns.standard++;
    });

    return namingPatterns;
  }

  analyzeFormLayout(fields) {
    return {
      totalFields: fields.length,
      visibleFields: fields.filter(f => f.visible).length,
      requiredFields: fields.filter(f => f.required).length,
      optionalFields: fields.filter(f => !f.required).length
    };
  }

  /**
   * Export all learned patterns as training data
   */
  async exportTrainingData() {
    try {
      const files = await fs.readdir(this.learningDir);
      const patternFiles = files.filter(f => f.endsWith('.json') && !f.endsWith('_knowledge.json'));

      const allPatterns = [];
      for (const file of patternFiles) {
        const data = await fs.readFile(path.join(this.learningDir, file), 'utf-8');
        allPatterns.push(JSON.parse(data));
      }

      const exportFile = path.join(this.learningDir, `training_export_${Date.now()}.json`);
      await fs.writeFile(exportFile, JSON.stringify(allPatterns, null, 2));

      logger.info(`📤 Exported ${allPatterns.length} patterns to ${exportFile}`);
      return exportFile;
    } catch (error) {
      logger.error('❌ Failed to export training data:', error.message);
      return null;
    }
  }
}

export default AILearningSystem;
