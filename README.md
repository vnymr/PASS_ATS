<!-- Trigger redeploy: minor doc update -->
# Quick Resume AI - Production-Ready ATS Resume Generator

A full-stack Chrome extension and web service for instant AI-powered resume generation optimized for Applicant Tracking Systems (ATS).

## 🚀 Features

- **AI-Powered Resume Generation**: Uses OpenAI GPT-4 to tailor resumes to specific job descriptions
- **Chrome Extension**: One-click resume generation from LinkedIn, Indeed, and other job sites
- **ATS Optimization**: Ensures resumes pass ATS scanners with proper formatting and keywords
- **Real-time Progress**: Server-sent events (SSE) for live generation progress
- **PDF Export**: Professional LaTeX-based PDF generation
- **Multi-site Support**: Works on LinkedIn, Indeed, Glassdoor, Monster, ZipRecruiter

## 📁 Project Structure

```
RESUME_GENERATOR/
├── extension/          # Chrome extension source
├── server/            # Node.js backend server
├── dist/              # Built extension files
├── .env.example       # Environment configuration template
└── start-local.sh     # Local development launcher
```

## 🛠️ Setup Instructions

### Prerequisites
- Node.js 18+ and npm
- Chrome/Chromium browser
- OpenAI API key
- PostgreSQL database (for production)

### 1. Clone and Install

```bash
git clone <repository>
cd RESUME_GENERATOR
npm install
cd server && npm install && cd ..
```

### 2. Configure Environment

```bash
cp .env.example .env.local
# Edit .env.local with your configuration:
# - Add your OpenAI API key
# - Set JWT secret (generate with: openssl rand -hex 64)
# - Configure database URL (for production)
```

### 3. Start Development Server

```bash
./start-local.sh
# Server runs on http://localhost:3001
```

### 4. Install Chrome Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `dist/extension/` folder
5. The extension icon will appear in your toolbar

## 🧪 Testing

```bash
# Run all tests
cd server && npm test

# Run specific test suites
npm run test:unit        # Unit tests
npm run test:integration # Integration tests
npm run test:e2e        # End-to-end tests
npm run test:coverage   # Coverage report
```

## 📦 Production Deployment

### Build Extension for Chrome Web Store

```bash
./build-extension.sh
# Creates dist/extension.zip for upload
```

### Deploy Server

#### Railway (Recommended)
1. Push to GitHub repository
2. Connect Railway to your repo
3. Set environment variables in Railway dashboard
4. Deploy automatically on push

#### Docker
```bash
cd server
docker build -t resume-generator .
docker run -p 3000:3000 --env-file .env resume-generator
```

#### Manual
```bash
cd server
NODE_ENV=production npm start
```

## 🔒 Security Features

- JWT authentication with secure httpOnly cookies
- Rate limiting (100 requests per minute by default)
- CORS protection with configurable origins
- Input validation and sanitization
- SQL injection protection via Prisma ORM
- XSS prevention in generated content

## 📊 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check and status |
| `/auth/login` | POST | User authentication |
| `/profile/:email` | GET | Retrieve user profile |
| `/profile/:email` | PUT | Update user profile |
| `/generate` | POST | Generate resume |
| `/generate/job/:id` | GET | SSE job progress stream |
| `/pdfs/:filename` | GET | Download generated PDF |

## 🎯 Usage

### From Job Sites
1. Navigate to a job posting on LinkedIn, Indeed, etc.
2. Click the "Generate Resume" floating button
3. Review extracted job details
4. Click "Generate" to create tailored resume
5. Download PDF when ready

### From Extension Popup
1. Click the extension icon
2. Enter job details manually
3. Generate and download resume

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3000 |
| `NODE_ENV` | Environment mode | development |
| `JWT_SECRET` | JWT signing secret | (required) |
| `OPENAI_API_KEY` | OpenAI API key | (required) |
| `DATABASE_URL` | PostgreSQL connection | (required for production) |
| `ALLOWED_ORIGINS` | CORS allowed origins | http://localhost:* |
| `RATE_LIMIT_REQUESTS` | Max requests per window | 100 |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window (ms) | 60000 |

## 📈 Monitoring

The server includes built-in health checks and monitoring:

```bash
curl http://localhost:3001/health
```

Returns:
- Server status and uptime
- Database connectivity
- Memory usage
- Active job count
- Feature flags

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes and add tests
4. Ensure all tests pass
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Troubleshooting

### Extension Context Invalid
- Refresh the job page after installing/updating extension

### PDF Generation Fails
- Ensure tectonic is installed: `npm install -g tectonic`
- Check server logs for LaTeX compilation errors

### CORS Errors
- Add your domain to `ALLOWED_ORIGINS` in .env
- Ensure chrome-extension:// is allowed for extension

### Rate Limiting
- Adjust `RATE_LIMIT_REQUESTS` for development
- Implement user-based limits for production

## 📞 Support

For issues and questions:
- GitHub Issues: [Create an issue](https://github.com/your-repo/issues)
- Documentation: See `/docs` folder
- Email: support@example.com

---

Built with ❤️ for job seekers everywhere