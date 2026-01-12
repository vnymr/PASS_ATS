# Application Ports

## 🚀 Running Services

### Backend Server
- **Port:** `8080`
- **URL:** http://localhost:8080
- **Health Check:** http://localhost:8080/health
- **API Endpoints:** http://localhost:8080/api/*
- **Start Command:** `cd server && npm run dev`

### Frontend (Vite Dev Server)
- **Port:** `5173`
- **URL:** http://localhost:5173
- **Start Command:** `cd frontend && npm run dev`
- **Proxy:** Frontend proxies `/api/*` and `/health/*` to backend on port 8080

### Frontend (Production Build)
- **Port:** `8080` (or set via `PORT` environment variable)
- **Start Command:** `cd frontend && npm start`
- **Note:** This serves the built static files, not the dev server

## 📋 Quick Start

### Development (Recommended)

**Terminal 1 - Backend:**
```bash
cd server
npm run dev
# Backend runs on http://localhost:8080
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
# Frontend runs on http://localhost:5173
# Open http://localhost:5173 in your browser
```

### Production Build

**Build Frontend:**
```bash
cd frontend
npm run build
```

**Serve Frontend:**
```bash
cd frontend
npm start
# Serves on port 8080 (or PORT env var)
```

## 🔗 Access Points

- **Frontend Application:** http://localhost:5173 (dev) or http://localhost:8080 (production)
- **Backend API:** http://localhost:8080/api/*
- **Health Check:** http://localhost:8080/health
- **Worker WebSocket:** ws://localhost:8080/ws/worker

## ⚙️ Configuration

### Backend Port
Set in `server/.env`:
```env
PORT=8080
```

### Frontend Port (Dev)
Set in `frontend/vite.config.ts`:
```typescript
server: {
  port: 5173,
  // ...
}
```

### Frontend Port (Production)
Set via environment variable:
```bash
PORT=8080 npm start
```

## 🔄 Proxy Configuration

The frontend Vite dev server automatically proxies API requests:
- `/api/*` → `http://localhost:8080/api/*`
- `/health/*` → `http://localhost:8080/health/*`

This means you can make API calls from the frontend using relative paths like `/api/jobs` and they'll be forwarded to the backend.


