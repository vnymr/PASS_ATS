# Multi-stage build for Vite React app with environment variables
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files from frontend directory
COPY frontend/package*.json ./

# Install dependencies
RUN npm ci

# Copy frontend source code
COPY frontend/ .

# Define build arguments for environment variables
ARG VITE_API_URL
ARG VITE_CLERK_PUBLISHABLE_KEY

# Set as environment variables for the build process
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_CLERK_PUBLISHABLE_KEY=${VITE_CLERK_PUBLISHABLE_KEY}

# Build the app (Vite will inject these env vars)
RUN npm run build

# Production stage - serve the built app
FROM node:18-alpine

WORKDIR /app

# Install serve globally
RUN npm install -g serve@14.2.5

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE 8080

# Start the server
CMD ["serve", "-s", "dist", "-l", "8080"]