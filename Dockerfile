# Multi-stage Dockerfile for LoanInNeed Backend

# -------------------------
# Stage 1: Dependencies
# -------------------------
FROM node:18-alpine AS dependencies
WORKDIR /app

COPY package*.json ./
RUN npm install

# -------------------------
# Stage 2: Builder
# -------------------------
FROM node:18-alpine AS builder
WORKDIR /app

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

RUN npx prisma generate

# -------------------------
# Stage 3: Production
# -------------------------
FROM node:18-alpine AS production
WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# Prisma client
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Required folders
COPY --from=builder /app/routes ./routes
COPY --from=builder /app/controllers ./controllers
COPY --from=builder /app/services ./services
COPY --from=builder /app/config ./config
COPY --from=builder /app/middleware ./middleware
COPY --from=builder /app/models ./models
COPY --from=builder /app/utils ./utils
COPY --from=builder /app/uploads ./uploads
COPY --from=builder /app/GlobalExceptionHandler ./GlobalExceptionHandler
COPY --from=builder /app/UI ./UI

# Optional folders (ignore if missing)
RUN mkdir -p reports jest-html-reporters-attach
COPY --from=builder /app/reports ./reports 2>/dev/null || true
COPY --from=builder /app/jest-html-reporters-attach ./jest-html-reporters-attach 2>/dev/null || true

# Root files
COPY --from=builder /app/server.js ./server.js

# Scripts
COPY --from=builder /app/scripts ./scripts
RUN chmod +x /app/scripts/start.sh

# Normal + healthcheck script
COPY --from=builder /app/scripts/test-healthcheck.js ./scripts/test-healthcheck.js

# Directories
RUN mkdir -p logs uploads/temp logs/temp

ENV NODE_ENV=production
EXPOSE 5000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=60s --retries=3 \
  CMD node /app/scripts/test-healthcheck.js || exit 1

CMD ["/app/scripts/start.sh"]
