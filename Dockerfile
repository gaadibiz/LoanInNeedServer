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

# Copy entire Backend source
COPY . .

RUN npx prisma generate

# -------------------------
# Stage 3: Production
# -------------------------
FROM node:18-alpine AS production

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# Prisma Client
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# -------------------------
# COPY ALL BACKEND FOLDERS
# -------------------------
COPY --from=builder /app/routes ./routes
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/utils ./utils
COPY --from=builder /app/controllers ./controllers
COPY --from=builder /app/services ./services
COPY --from=builder /app/config ./config
COPY --from=builder /app/middleware ./middleware
COPY --from=builder /app/models ./models
COPY --from=builder /app/GlobalExceptionHandler ./GlobalExceptionHandler
COPY --from=builder /app/reports ./reports
COPY --from=builder /app/uploads ./uploads
COPY --from=builder /app/UI ./UI
COPY --from=builder /app/jest-html-reporters-attach ./jest-html-reporters-attach

# Copy root JS files
COPY --from=builder /app/server.js ./server.js
COPY --from=builder /app/test-healthcheck.js ./test-healthcheck.js

# Logs + uploads dirs
RUN mkdir -p logs uploads/temp logs/temp

# Make start script executable
RUN chmod +x /app/scripts/start.sh

ENV NODE_ENV=production
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=3s --start-period=60s --retries=3 \
  CMD node /app/test-healthcheck.js || exit 1

CMD ["/app/scripts/start.sh"]
