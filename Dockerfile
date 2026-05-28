# ============================
# Stage 1: Dependencies
# ============================
FROM node:22-alpine AS dependencies
WORKDIR /app

COPY package*.json ./
RUN npm install


# ============================
# Stage 2: Builder
# ============================
FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

RUN npx prisma generate


# ============================
# Stage 3: Production
# ============================
FROM node:22-alpine AS production
WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# Prisma client
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma


# ============================
# Main folders (Guaranteed to exist)
# ============================
COPY --from=builder /app/routes ./routes
COPY --from=builder /app/controllers ./controllers
COPY --from=builder /app/services ./services
COPY --from=builder /app/config ./config
COPY --from=builder /app/middleware ./middleware
COPY --from=builder /app/models ./models
COPY --from=builder /app/utils ./utils
COPY --from=builder /app/uploads ./uploads
COPY --from=builder /app/UI ./UI
COPY --from=builder /app/GlobalExceptionHandler ./GlobalExceptionHandler


# ============================
# Optional Folders (May not exist)
# Prevents build failure
# ============================

# reports/
RUN mkdir -p reports
RUN [ -d /app/reports ] && cp -r /app/reports/* ./reports/ || true

# jest-html-reporters-attach/
RUN mkdir -p jest-html-reporters-attach
RUN [ -d /app/jest-html-reporters-attach ] && cp -r /app/jest-html-reporters-attach/* ./jest-html-reporters-attach/ || true


# ============================
# Root files
# ============================
COPY --from=builder /app/server.js ./server.js


# ============================
# Scripts
# ============================
COPY --from=builder /app/scripts ./scripts
RUN chmod +x /app/scripts/start.sh
RUN chmod +x /app/scripts/test-healthcheck.js


# ============================
# Prepare directories
# ============================
RUN mkdir -p logs uploads/temp logs/temp


# ============================
# Environment
# ============================
ENV NODE_ENV=production
EXPOSE 5000


# ============================
# Healthcheck
# ============================
HEALTHCHECK --interval=30s --timeout=3s --start-period=60s --retries=3 \
  CMD node /app/scripts/test-healthcheck.js || exit 1


# ============================
# Start backend
# ============================
CMD ["/app/scripts/start.sh"]
