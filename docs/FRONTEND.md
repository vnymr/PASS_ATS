### Tech stack

- React 18 (SPA) + React Router v6
- Vite build tool
- Tailwind CSS v4
- Clerk for auth (frontend SDK)

References:

```1:86:/Users/vinaymuthareddy/RESUME_GENERATOR/frontend/src/main.tsx
import { BrowserRouter } from 'react-router-dom';
```

```1:94:/Users/vinaymuthareddy/RESUME_GENERATOR/frontend/package.json
"dependencies": {"react-router-dom": "^6.26.2", "@clerk/clerk-react": "^5.48.1", "tailwindcss": "^4"}
```

### Route map

App routes:

```100:172:/Users/vinaymuthareddy/RESUME_GENERATOR/frontend/src/App.tsx
<Routes>
  <Route path="/" element={<Landing />} />
  <Route path="/auth" element={<AuthPage />} />
  <Route path="/dashboard" element={<ProtectedRoute><ModernLayout><DashboardModern /></ModernLayout></ProtectedRoute>} />
  <Route path="/profile" element={<ProtectedRoute><ModernLayout><MemoryProfile /></ModernLayout></ProtectedRoute>} />
  <Route path="/generate" element={<ProtectedRoute><ModernLayout><DashboardModern /></ModernLayout></ProtectedRoute>} />
  <Route path="/history" element={<ProtectedRoute><ModernLayout><DashboardModern /></ModernLayout></ProtectedRoute>} />
  <Route path="/find-jobs" element={<ProtectedRoute><ModernLayout><FindJob /></ModernLayout></ProtectedRoute>} />
  <Route path="/extension" element={<ProtectedRoute><ModernLayout><DashboardModern /></ModernLayout></ProtectedRoute>} />
  <Route path="/billing" element={<ProtectedRoute><ModernLayout><Billing /></ModernLayout></ProtectedRoute>} />
  <Route path="/pricing" element={<ProtectedRoute><ModernLayout><Billing /></ModernLayout></ProtectedRoute>} />
  <Route path="/checkout/success" element={<ProtectedRoute><CheckoutSuccess /></ProtectedRoute>} />
  <Route path="/checkout/cancel" element={<ProtectedRoute><CheckoutCancel /></ProtectedRoute>} />
  <Route path="/support" element={<Support />} />
  <Route path="/privacy" element={<Privacy />} />
</Routes>
```

### Component map (key screens)

- **Generate**: `DashboardModern.tsx` (primary), `Dashboard.tsx`, `GenerateResume.tsx`.
- **History**: `DashboardModern.tsx` history section; standalone `History.tsx` page.
- **Jobs**: `FindJob.tsx` (search, job cards, detail panel).
- **Profile**: `MemoryProfile.tsx`, `ModernProfileModal.tsx`.
- **Billing**: `Billing.tsx`, checkout success/cancel pages.

References:

```344:385:/Users/vinaymuthareddy/RESUME_GENERATOR/frontend/src/pages/DashboardModern.tsx
{/* History Section */}
```

```1:255:/Users/vinaymuthareddy/RESUME_GENERATOR/frontend/src/pages/History.tsx
export default function History() {
```

### Where HTML from LLM is rendered

- Frontend renders job descriptions as PLAIN TEXT, not HTML, via `htmlToPlainText()` to avoid unstyled/raw HTML.

```48:56:/Users/vinaymuthareddy/RESUME_GENERATOR/HTML_DISPLAY_FIX.md
Used the existing `htmlToPlainText()` utility function to clean HTML before displaying
```

```44:99:/Users/vinaymuthareddy/RESUME_GENERATOR/frontend/src/utils/htmlCleaner.ts
export function htmlToPlainText(html: string): string {
```

- No `dangerouslySetInnerHTML` usage found in the frontend codebase at present.

```258:282:/Users/vinaymuthareddy/RESUME_GENERATOR/HTML_DISPLAY_FIX.md
- ✅ No `dangerouslySetInnerHTML` used
```

### Tailwind config analysis

```1:95:/Users/vinaymuthareddy/RESUME_GENERATOR/frontend/tailwind.config.js
export default { content: ["./index.html","./src/**/*.{js,ts,jsx,tsx}"], safelist: [{ pattern: /w-\[(?:100|[0-9]{1,2})%\]/ }], ... }
```

- **content**: Includes `index.html` and all `src/**/*.{js,ts,jsx,tsx}`; good coverage for SPA.
- **safelist**: Regex allows dynamic width utilities like `w-[42%]`.
- **dynamic class patterns**: No evidence of patterns like `text-${color}-600`; grep returned none.
- **purge risks**: Low for static classes. If History renders data-driven class names, ensure safelist covers them. Current History mostly uses static classes.
- Impact on History: History uses static classes in `DashboardModern.tsx` and `History.tsx` — unlikely to purge necessary CSS.

Minimal safelist suggestion (if needed later):

- Add `pattern: /bg-(primary|accent|neutral)-(50|100|200|400|600|700)/` if dynamic themes introduced.

### Iframes/portals/microfrontends

- No `<iframe>` or `createPortal(` usages found.

### Packaging/build

```1:36:/Users/vinaymuthareddy/RESUME_GENERATOR/frontend/vite.config.ts
server.proxy maps /api and /health to backend :3000
```

Build output at `frontend/dist/`; served by backend in production.
