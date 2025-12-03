# Quick Resume AI - Chrome Extension

> Generate tailored, ATS-optimized resumes for any job in seconds

## Features

- **Smart Job Detection**: Automatically detects job postings on major job sites (LinkedIn, Indeed, Glassdoor, etc.)
- **One-Click Generation**: Click the floating button to extract job details and generate a tailored resume
- **AI-Powered Extraction**: Uses GPT-5-mini to intelligently extract job requirements (no brittle CSS selectors!)
- **Manual Fallback**: Can't extract automatically? Just paste the job description manually
- **Real-Time Progress**: See live updates as your resume is being generated
- **Keyboard Shortcut**: Press `Alt+R` to instantly generate a resume on any job page
- **Universal Detection**: Works on any job site, not just the big ones
- **Dark Mode**: Respects your system preferences

## Installation (Development)

1. **Start the backend server**:
   ```bash
   cd server
   npm install
   npm start
   ```

2. **Load the extension**:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right)
   - Click "Load unpacked"
   - Select the `extension/` folder

3. **Configure the extension**:
   - Click the extension icon in Chrome toolbar
   - Login or register for an account
   - (Optional) Go to Settings and set API URL if not using default

## Usage

### Method 1: On Job Pages (Recommended)

1. Navigate to any job posting (LinkedIn, Indeed, etc.)
2. Click the orange floating button that appears in the bottom-right
3. Review the extracted job details
4. Click "Generate Resume"
5. Wait 15-30 seconds
6. Download your tailored PDF resume!

### Method 2: Manual Entry

1. Click the extension icon in your browser toolbar
2. Paste the job description in the text area
3. Click "Generate Resume"
4. Check back in a few moments to download

### Method 3: Keyboard Shortcut

1. On any job page, press `Alt+R` (or `⌥+R` on Mac)
2. The generation process will start automatically

## How It Works

```
┌─────────────┐
│  Job Page   │
└──────┬──────┘
       │
       ▼
┌─────────────────────────┐
│  Smart Detection        │ ← Detects job postings using heuristics
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│  Extract Content        │ ← Scrapes text from page
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│  LLM Extraction         │ ← GPT-5-mini extracts structured data
│  (cached for 24hrs)     │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│  User Preview & Edit    │ ← Review extracted details
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│  Resume Generation      │ ← Backend generates LaTeX → PDF
│  (15-30 seconds)        │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│  Download PDF          │ ← Optimized for ATS systems
└─────────────────────────┘
```

## File Structure

```
extension/
├── manifest.json              # Extension configuration
├── background/
│   └── service-worker.js      # Background tasks & messaging
├── content/
│   ├── detector.js            # Job page detection
│   ├── scraper.js             # Content extraction
│   └── ui-injector.js         # Floating button & overlays
├── popup/
│   ├── popup.html             # Extension popup UI
│   ├── popup.css              # Popup styles
│   └── popup.js               # Popup logic
├── utils/
│   ├── config.js              # Configuration
│   └── api-client.js          # API wrapper
└── assets/
    ├── styles.css             # Global styles
    └── icons/                 # Extension icons (16, 48, 128)
```

## Configuration

### Change API Endpoint

1. Click extension icon
2. Go to Settings (⚙️)
3. Enter your API base URL
4. Click Save

### Keyboard Shortcuts

Default: `Alt+R` (Windows/Linux) or `⌥+R` (Mac)

To customize:
1. Go to `chrome://extensions/shortcuts`
2. Find "Quick Resume AI"
3. Set your preferred shortcut

## Development

### Testing Job Detection

The detector uses a scoring system to identify job pages:

- **Known sites** (LinkedIn, Indeed, etc.): Auto-detected via URL patterns
- **Unknown sites**: Analyzed using content heuristics:
  - 3+ job-related keywords (e.g., "job description", "requirements")
  - Apply button present
  - Job-related metadata

Test on various sites to improve detection accuracy.

### Adding New Job Sites

If a site isn't detected:

1. Add URL pattern to `detector.js`:
   ```javascript
   /yoursite\.com\/jobs\//
   ```

2. Or rely on heuristic detection (usually works!)

### Debugging

Enable debug logging:

```javascript
// In config.js
DEBUG_MODE: true
```

Then check:
- Extension console: Right-click extension icon → "Inspect popup"
- Content script console: F12 on any job page
- Background console: `chrome://extensions/` → "Inspect service worker"

## Rate Limits

- **Extraction**: 20 requests/minute
- **Generation**: 5 requests/minute
- **Monthly quota**: 50 resumes per user

## Troubleshooting

### "Not logged in" error
→ Click extension icon and login first

### Floating button doesn't appear
→ Refresh the page after installing/updating extension

### Extraction fails
→ Use the manual fallback (paste job description)

### Generation takes too long
→ Normal for complex jobs. Wait up to 2 minutes.

### Download fails
→ Check browser download permissions

## Privacy & Security

- ✅ Only scrapes pages when you click the button
- ✅ Stores Clerk auth token + email in `chrome.storage.local` (auto-cleared on logout/expiry)
- ✅ Secure token-based authentication
- ✅ HTTPS-only connections
- ✅ No tracking or analytics (unless you add it)

## Supported Job Sites

Works universally, but optimized for:
- LinkedIn
- Indeed
- Glassdoor
- Monster
- ZipRecruiter
- Greenhouse
- Lever
- Workday
- And many more!

## Future Enhancements

- [ ] Browser extension sync (settings across devices)
- [ ] Job application tracker
- [ ] Cover letter generator
- [ ] LinkedIn Easy Apply integration
- [ ] AI job matching scores

## License

MIT License

## Support

For issues or questions:
- Check the main [README](../README.md)
- Open an issue on GitHub
- Contact support at support@yourapp.com

---

Built with ❤️ for job seekers everywhere
