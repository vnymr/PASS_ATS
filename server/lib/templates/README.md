# LaTeX Resume Template System

Professional resume templates for the micro-prompt generation pipeline, based on 2025 ATS best practices research.

## Templates Overview

### 1. General-Readable-1col
- **Best for**: Most roles, corporate positions, mid-level professionals
- **Features**: Clean Helvetica font, 11pt body text, 1-inch margins
- **ATS Score**: 95/100
- **Style**: Professional and versatile

### 2. PO-Compact-1col
- **Best for**: Product Owners, Business Analysts, Operations Managers
- **Features**: Compact 10pt font, metrics emphasis, 0.75-inch margins
- **ATS Score**: 92/100
- **Style**: Business-focused with achievement highlights

### 3. Eng-Technical-1col
- **Best for**: Software Engineers, DevOps, Data Engineers
- **Features**: Technical skills prominent, code-style formatting, 10.5pt font
- **ATS Score**: 93/100
- **Style**: Technical with monospace-friendly design

## Usage Example

```javascript
import templateRegistry from './lib/templates/registry/index.js';

// Load a template
const template = await templateRegistry.getTemplateById('General-Readable-1col');

// Fill placeholders with generated content
const filledWireframe = template.wireframe
  .replace('[NAME]', 'John Doe')
  .replace('[LOCATION]', 'San Francisco, CA')
  .replace('[PHONE]', '(555) 123-4567')
  .replace('[EMAIL]', 'john.doe@example.com')
  .replace('[LINKEDIN]', 'linkedin.com/in/johndoe')
  .replace('[SUMMARY]', generatedSummary)
  .replace('[EXPERIENCES]', generatedExperiences)
  .replace('[SKILLS]', generatedSkills)
  .replace('[EDUCATION]', generatedEducation);

// Combine preamble and filled wireframe for complete LaTeX document
const latexDocument = template.preamble + '\n' + filledWireframe;

// Compile with pdflatex or similar
```

## Template Structure

Each template consists of:

1. **preamble.tex** - LaTeX packages, commands, and styling (immutable)
2. **wireframe.tex** - Document structure with placeholders

### Placeholders

All templates use these standard placeholders:
- `[NAME]` - Candidate's full name
- `[LOCATION]` - City, State
- `[PHONE]` - Phone number
- `[EMAIL]` - Email address
- `[LINKEDIN]` - LinkedIn profile URL
- `[SUMMARY]` - Professional summary (35 words max)
- `[EXPERIENCES]` - Work experience entries
- `[SKILLS]` - Skills by category
- `[EDUCATION]` - Education entries

## Capacity Limits

Templates enforce these limits for optimal formatting:
- **Bullets per role**: 4 maximum
- **Roles**: 5 maximum
- **Words per bullet**: 25 maximum
- **Summary words**: 35 maximum
- **Skills items**: 25-35 depending on template

## LaTeX Special Characters

Remember to escape these characters in content:
- `&` → `\&`
- `%` → `\%`
- `$` → `\$`
- `#` → `\#`
- `_` → `\_`
- `{` → `\{`
- `}` → `\}`
- `~` → `\textasciitilde{}`
- `^` → `\textasciicircum{}`
- `\` → `\textbackslash{}`

## Registry API

```javascript
// Get template by ID
const template = await templateRegistry.getTemplateById('General-Readable-1col');

// List all templates
const templates = await templateRegistry.getAvailableTemplates();

// Validate data against template
const validation = await templateRegistry.validateTemplate(templateId, data);

// Get template metadata only
const metadata = await templateRegistry.getTemplateMetadata(templateId);
```

## Key Design Decisions

Based on 2025 research:
1. **Single column only** - Multi-column layouts confuse ATS systems
2. **Standard fonts** - Arial, Calibri, Helvetica for maximum compatibility
3. **No graphics/tables** - Pure text formatting for ATS parsing
4. **Clear section headers** - Standard naming conventions
5. **Keyword optimization** - Placeholders support keyword-rich content
6. **68% prefer sans-serif** - Modern shift away from serif fonts
7. **Screen-first design** - Optimized for digital review

## Testing

Run the test suite:
```bash
node test-template-registry.js
```

This validates:
- Template loading
- Placeholder extraction
- Validation logic
- Error handling
- Manifest parsing