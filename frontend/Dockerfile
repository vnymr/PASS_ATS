# Frontend Dockerfile for separate deployment
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci

# Copy source files
COPY . .

# Set build-time environment variables
ARG VITE_API_URL
ARG VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_API_URL=${VITE_API_URL:-/api}
ENV VITE_CLERK_PUBLISHABLE_KEY=${VITE_CLERK_PUBLISHABLE_KEY:-pk_live_Y2xlcmsuaGFwcHlyZXN1bWVzLmNvbSQ}

# Build the frontend
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Install serve globally
RUN npm install -g serve

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE 8080

# Start the server
CMD ["serve", "-s", "dist", "-l", "8080", "--single", "--no-clipboard"]