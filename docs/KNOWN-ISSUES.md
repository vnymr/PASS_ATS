### Potential causes of unstyled “Generation History” (raw HTML look)

- a) Sanitizer stripping `class`
  - Current approach avoids HTML render by converting ATS HTML → plain text via `htmlToPlainText()`. No sanitizer that strips classes is applied to History items (they are not HTML). See:

```44:99:/Users/vinaymuthareddy/RESUME_GENERATOR/frontend/src/utils/htmlCleaner.ts
export function htmlToPlainText(html: string) {
```

- Policy doc confirms: no `dangerouslySetInnerHTML` used.

```258:264:/Users/vinaymuthareddy/RESUME_GENERATOR/HTML_DISPLAY_FIX.md
- ✅ No `dangerouslySetInnerHTML` used
```

- b) Tailwind purge missing dynamic classes
  - Tailwind content globs cover `src/**/*`. Safelist includes `w-[%]` widths.

```1:20:/Users/vinaymuthareddy/RESUME_GENERATOR/frontend/tailwind.config.js
content: ["./index.html","./src/**/*.{js,ts,jsx,tsx}"]
```

- No dynamic patterns like `text-${color}-600` detected; low purge risk for History’s static classes.

- c) Rendered in an iframe/portal without CSS

  - No evidence of `<iframe>` or `createPortal(`.

- d) Injected HTML whose classes aren’t in compiled CSS (no safelist)
  - Frontend does not render model HTML in History. Server can produce HTML (`/api/generate-html`), but UI isn’t using it; History lists PDF artifacts and metadata.

```1469:1505:/Users/vinaymuthareddy/RESUME_GENERATOR/server/server.js
app.post('/api/generate-html', ...)
```

- e) CSS load order/scope problems
  - Tailwind v4 imported in `index.css` and loaded via `main.tsx`. `ModernLayout` wraps History ensuring tailwind utility scope applies.

```6:13:/Users/vinaymuthareddy/RESUME_GENERATOR/frontend/src/main.tsx
import './index.css';
```

### Exact render path and component for History items

- Dashboard page History section:

```344:387:/Users/vinaymuthareddy/RESUME_GENERATOR/frontend/src/pages/DashboardModern.tsx
<div id="history-section" className="modern-history-section mt-10"> ...
```

- Standalone History page:

```95:116:/Users/vinaymuthareddy/RESUME_GENERATOR/frontend/src/pages/History.tsx
<div className="history-container"> ...
```

- Data source: `/api/resumes` and `/api/resumes/:identifier` for downloads.

```1605:1650:/Users/vinaymuthareddy/RESUME_GENERATOR/server/server.js
app.get('/api/resumes', ...)
```

```2537:2606:/Users/vinaymuthareddy/RESUME_GENERATOR/server/server.js
app.get('/api/resumes/:identifier', ...)
```

### Prioritized hypothesis for “unstyled History”

1. Most likely: Tailwind CSS not loaded or conflicting global CSS on the page instance showing History (e.g., CSS not bundled/served in production build or a stylesheet load error). Evidence: History uses only static utility classes; if these appear as raw HTML-like text, it typically means CSS didn’t load.
   - Check: `frontend/dist/index.html` includes CSS; backend serves `frontend/dist` in prod.

```2662:2668:/Users/vinaymuthareddy/RESUME_GENERATOR/server/server.js
if (process.env.NODE_ENV === 'production') { app.use(express.static(...)) }
```

- Verify `index.css` is present and loaded in `main.tsx`.

```6:13:/Users/vinaymuthareddy/RESUME_GENERATOR/frontend/src/main.tsx
import './index.css';
```

Single most likely root cause: CSS not loading in the affected environment (build or CDN path issue), not sanitizer/purge. Validate by checking network tab for CSS 404s on the History route.
