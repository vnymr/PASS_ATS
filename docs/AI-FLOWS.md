### Prompt sources and builders

- Fast prompts for LaTeX generation via `fast-prompt-builder.js`; Gemini preferred, OpenAI fallback.

```2051:2060:/Users/vinaymuthareddy/RESUME_GENERATOR/server/server.js
const { buildFastSystemPrompt, buildFastUserPrompt } = await import('./lib/fast-prompt-builder.js');
```

- Simplified API and AI client abstraction available for generalized text:

```14:76:/Users/vinaymuthareddy/RESUME_GENERATOR/server/lib/ai-client.js
class AIClient { ... generateText({ prompt, systemPrompt, aiMode, ... }) }
```

### Models

- Gemini 2.5 Flash first; OpenAI `gpt-5-mini` fallback for LaTeX generation/fixing.

```2060:2081:/Users/vinaymuthareddy/RESUME_GENERATOR/server/server.js
if (isGeminiAvailable()) { ... } else { logger.info('Using OpenAI gpt-5-mini') }
```

### Post-processing

- LaTeX fixes loop with LLM on compile errors; escapes special chars; ensures proper itemize blocks.

```2160:2272:/Users/vinaymuthareddy/RESUME_GENERATOR/server/server.js
async function fixLatexWithLLM(openai, brokenLatex, errorMessage) { ... }
```

- Compilation to PDF via `compileLatex` and stored as `Artifact`.

```1957:1974:/Users/vinaymuthareddy/RESUME_GENERATOR/server/server.js
await prisma.artifact.create({ type: 'PDF_OUTPUT', content: pdfBuffer, ... })
```

### Where model output becomes UI HTML/markdown

- Server can produce HTML via `/api/generate-html` using `html-generator.js`, but the frontend does not currently render returned HTML. Primary user-visible output is PDF link in History.

```1469:1505:/Users/vinaymuthareddy/RESUME_GENERATOR/server/server.js
app.post('/api/generate-html', authenticateToken, async (req, res) => { ... })
```

```159:172:/Users/vinaymuthareddy/RESUME_GENERATOR/server/lib/html-generator.js
return { success: true, html, json }
```

### Sanitization pipeline

- For job descriptions from external ATS, frontend converts HTML → plain text with `htmlToPlainText()`; no `dangerouslySetInnerHTML` used.

```44:99:/Users/vinaymuthareddy/RESUME_GENERATOR/frontend/src/utils/htmlCleaner.ts
export function htmlToPlainText(html: string): string { ... }
```

Guardrails: backend input validators for job description and profile updates.

```1705:1713:/Users/vinaymuthareddy/RESUME_GENERATOR/server/server.js
const validation = validateJobDescription(jobDescription);
```
