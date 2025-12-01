# ---------------------------
# Stage 1 — Install dependencies
# ---------------------------
FROM node:18-alpine AS deps

WORKDIR /app
COPY package*.json ./
RUN npm install


# ---------------------------
# Stage 2 — Builder (Prisma client, TS build)
# ---------------------------
FROM node:18-alpine AS builder

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate


# ---------------------------
# Stage 3 — Production Image
# ---------------------------
FROM node:18-alpine AS prod

WORKDIR /app

# Copy only package files and reinstall for production
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# Copy only necessary application code
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/src ./src
COPY --from=builder /app/routes ./routes
COPY --from=builder /app/utils ./utils
COPY --from=builder /app/GlobalExceptionHandler ./GlobalExceptionHandler
COPY --from=builder /app/middleware ./middleware
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/server.js ./server.js

# Create logs and uploads
RUN mkdir -p logs uploads/temp logs/temp

# Start script permission
RUN chmod +x /app/scripts/start.sh

ENV NODE_ENV=production

EXPOSE 5000

HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:${PORT:-5000}/ || exit 1

CMD ["/app/scripts/start.sh"]
