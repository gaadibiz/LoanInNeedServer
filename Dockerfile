# Multi-stage Dockerfile for LoanInNeed Backend
# Stage 1: Dependencies
FROM node:18-alpine AS dependencies

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (production and dev for Prisma)
# Using `npm install` instead of `npm ci` so we don't depend on lockfile presence in the image
RUN npm install

# Stage 2: Builder
FROM node:18-alpine AS builder

WORKDIR /app

# Copy dependencies from previous stage
COPY --from=dependencies /app/node_modules ./node_modules

# Copy application files
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Stage 3: Production
FROM node:18-alpine AS production

WORKDIR /app

# Install only production dependencies
COPY package*.json ./
# Use npm install with dev dependencies omitted for production image
RUN npm install --omit=dev && npm cache clean --force

# Copy Prisma files and generated client
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy application files
COPY . .

# Create directories for logs and uploads
RUN mkdir -p logs/uploads logs/temp uploads/temp

# Set environment to production
ENV NODE_ENV=production

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["node", "server.js"]

