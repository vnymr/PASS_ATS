# 🎯 PASS ATS - AI-Powered Resume Generator

> **Smart Chrome Extension + Server Backend for ATS-Optimized Resume Generation**

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/your-template-id)

## 🚀 **Quick Start**

### **Chrome Extension**
1. Load `extension/` folder in Chrome Developer Mode
2. Configure server URL in extension settings
3. Start generating ATS-optimized resumes!

### **Server Deployment**
- **Railway**: Auto-deploy from this GitHub repo
- **Docker**: `docker build -t pass-ats . && docker run -p 3000:3000 pass-ats`
- **Local**: `npm install && npm start`

## 🎯 **Features**

### **🤖 AI-Powered Resume Transformation**
- **Complete resume rewrite** for each job application
- **95%+ ATS keyword matching** with natural integration
- **Cross-domain translation** (e.g., Engineer → Business Development)
- **Quantified achievement enhancement**

### **🔧 Production-Ready Architecture**
- **Node.js/Express** server with Prisma ORM
- **PostgreSQL** database (Supabase integration)
- **LaTeX PDF generation** with Tectonic compiler
- **JWT authentication** and user management
- **Chrome Extension** with modern UI

### **📊 Database & Storage**
- **User profiles** with comprehensive data
- **Resume history** and download tracking
- **Job analysis** and keyword extraction
- **Template-based fallback** for reliability

## 🛠 **Environment Variables**

```env
DATABASE_URL=your_postgresql_connection_string
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
JWT_SECRET=your_jwt_secret_key
OPENAI_API_KEY=your_openai_api_key
NODE_ENV=production
PORT=3000
PUBLIC_BASE_URL=https://your-domain.com
```

## 📈 **Architecture**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Chrome Ext     │───▶│  Node.js API    │───▶│  PostgreSQL DB  │
│  (Frontend UI)  │    │  (AI + LaTeX)   │    │  (Supabase)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
   User Interface        Resume Generation        Data Persistence
   - Job Detection       - AI Optimization        - User Profiles
   - Profile Management  - LaTeX Compilation      - Resume History
   - Download History    - PDF Generation         - Job Analysis
```

## 🚀 **Deployment**

### **Railway (Recommended)**
1. Fork this repository
2. Connect to Railway
3. Add environment variables
4. Deploy automatically!

### **Docker**
```bash
docker build -t pass-ats .
docker run -p 3000:3000 --env-file .env pass-ats
```

### **Manual**
```bash
npm install
cd server && npm install
npm start
```

## 🔧 **Development**

```bash
# Install dependencies
npm run install:all

# Start development servers
npm run dev

# Build for production
npm run production:build
```

## 📝 **API Endpoints**

- `POST /generate` - Generate resume PDF
- `POST /analyze-job` - Analyze job description
- `POST /auth/signup` - User registration
- `POST /auth/login` - User authentication
- `GET /profile` - Get user profile
- `PUT /profile` - Update user profile
- `GET /health` - Health check

## 🎯 **License**

MIT License - Build amazing things! 🚀
