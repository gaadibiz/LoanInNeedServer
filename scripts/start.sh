#!/bin/sh

set -e

echo "===================================================================="
echo "🟦  STARTING LoanInNeed Backend with DEBUG MODE"
echo "===================================================================="

echo ""
echo "▶️  Step 0: Printing environment variables"
echo "------------------------------------------------------------"
echo "NODE_ENV=$NODE_ENV"
echo "PORT=${PORT:-5000}"
echo "DATABASE_URL=$DATABASE_URL"
echo ""

echo "▶️  Step 1: Confirming filesystem"
echo "------------------------------------------------------------"
echo "PWD: $(pwd)"
echo ""
echo "Listing /app directory:"
ls -R /app || echo "❌ ERROR: Cannot list /app"
echo ""

echo "▶️  Step 2: Checking Node + NPM + NPX"
echo "------------------------------------------------------------"
echo "node: $(which node)"
echo "npm:  $(which npm)"
echo "npx:  $(which npx)"
echo ""

node -v
npm -v

echo ""

echo "▶️  Step 3: Checking if server.js exists"
echo "------------------------------------------------------------"
if [ -f "/app/server.js" ]; then
  echo "✔ server.js found at /app/server.js"
else
  echo "❌ ERROR: server.js NOT found at /app/server.js"
fi
echo ""

echo "▶️  Step 4: Checking scripts/start.sh exists inside container"
echo "------------------------------------------------------------"
if [ -f "/app/scripts/start.sh" ]; then
  echo "✔ start.sh found at /app/scripts/start.sh"
else
  echo "❌ ERROR: start.sh NOT found"
fi
echo ""

echo "▶️  Step 5: Verifying Prisma folder structure"
echo "------------------------------------------------------------"
ls -R /app/prisma || echo "❌ ERROR: /app/prisma missing!"
echo ""

echo "▶️  Step 6: Verifying Prisma Client"
echo "------------------------------------------------------------"
ls -R /app/node_modules/@prisma || echo "❌ ERROR: @prisma missing!"
echo ""
ls -R /app/node_modules/.prisma || echo "❌ ERROR: .prisma engines missing!"
echo ""

echo "===================================================================="
echo "DATABASE CHECK / MIGRATIONS"
echo "===================================================================="

if [ -z "$DATABASE_URL" ]; then
  echo "⚠️  WARNING: DATABASE_URL not set — skipping all Prisma migrations."
else

  echo "▶️  Checking Prisma connection:"
  echo "------------------------------------------------------------"
  npx prisma migrate status || echo "⚠️  migrate status failed"
  echo ""

  echo "▶️  Running prisma migrate deploy (with debug output):"
  echo "------------------------------------------------------------"
  npx prisma migrate deploy --schema=/app/prisma/schema.prisma || {
    echo "❌ Prisma migrate deploy FAILED"
    echo "======================================================="
    echo "FULL PRISMA CLIENT DEBUG OUTPUT"
    echo "======================================================="
    export DEBUG="*"
    npx prisma migrate deploy --schema=/app/prisma/schema.prisma
    echo "-------------------------------------------------------"
  }
fi

echo ""
echo "===================================================================="
echo "▶️  STARTING NODE SERVER (with debug tracing)"
echo "===================================================================="

echo "DEBUG: node path = $(which node)"
echo "DEBUG: checking if /app/server.js is readable:"
ls -l /app/server.js || echo "❌ server.js missing or unreadable"
echo ""

echo "▶️ Running: node server.js"
echo "------------------------------------------------------------"

# RUN WITHOUT exec so logs DO NOT DISAPPEAR if server crashes
node server.js || {
  echo ""
  echo "❌ NODE SERVER CRASHED"
  echo "------------------------------------------------------------"
  echo "EXIT CODE: $?"
  echo "------------------------------------------------------------"
  echo "Node error log output (if any):"
  echo "------------------------------------------------------------"
  sleep 5
  exit 1
}

echo ""
echo "===================================================================="
echo "✔️ BACKEND FULLY STARTED"
echo "===================================================================="
