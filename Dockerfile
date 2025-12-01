# Multi-stage Dockerfile for LoanInNeed Backend

# -------------------------
# Stage 1: Dependencies
# -------------------------
FROM node:18-alpine AS dependencies

WORKDIR /app

# Copy ONLY package files from Backend folder
COPY Backend/package*.json ./
RUN npm install


# -------------------------
# Stage 2: Builder
# -------------------------
FROM node:18-alpine AS builder

WORKDIR /app

# Copy dependencies from previous stage
COPY --from=dependencies /app/node_modules ./node_modules

# Copy full Backend source code
COPY Backend .    

# Generate Prisma Client
RUN npx prisma generate


# -------------------------
# Stage 3: Production
# -------------------------
FROM node:18-alpine AS production

WORKDIR /app

# Install only production deps
COPY Backend/package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# Copy prisma generated client
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy application files
COPY --from=builder /app/routes ./routes
COPY --from=builder /app/utils ./utils
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/GlobalExceptionHandler ./GlobalExceptionHandler
COPY --from=builder /app/middleware ./middleware
COPY --from=builder /app/server.js ./server.js

# Create directories for logs and uploads
RUN mkdir -p logs uploads/temp logs/temp

# Make startup script executable
RUN chmod +x /app/scripts/start.sh

ENV NODE_ENV=production
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=3s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 5000) + '/', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["/app/scripts/start.sh"]
