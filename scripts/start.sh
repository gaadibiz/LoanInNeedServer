#!/bin/sh
set -e

echo "=========================================="
echo "Starting LoanInNeed Backend"
echo "=========================================="

# Utility: run a command with retries
try() {
  # args: <retries> <sleep_seconds> -- <cmd...>
  retries=$1; shift
  sleep_sec=$1; shift
  i=0
  while [ $i -le $retries ]; do
    if "$@"; then
      return 0
    fi
    i=$((i+1))
    if [ $i -gt $retries ]; then
      break
    fi
    echo "Retry $i/$retries — sleeping ${sleep_sec}s before retrying..."
    sleep $sleep_sec
    sleep_sec=$((sleep_sec * 2))
  done
  return 1
}

# Warn if no DATABASE_URL, but do not exit
if [ -z "$DATABASE_URL" ]; then
  echo "⚠️  WARNING: DATABASE_URL environment variable is not set. Skipping migrations."
  SKIP_MIGRATIONS=true
else
  echo "✓ DATABASE_URL is set"
  SKIP_MIGRATIONS=false
fi

if [ "$SKIP_MIGRATIONS" = "false" ]; then
  echo ""
  echo "Checking Prisma migration status (will not fail immediately if DB isn't ready)..."

  # Check status (best-effort) — don't fail the script on single failure
  if ! npx prisma migrate status >/dev/null 2>&1; then
    echo "⚠️  Prisma status check could not connect or returned non-zero. Will try migrations with retries."
  else
    echo "✓ Prisma status looks OK (or returned info)."
  fi

  echo ""
  echo "Running database migrations with retries (up to 5 attempts)..."

  if try 5 2 npx prisma migrate deploy; then
    echo "✓ Migrations completed successfully"
  else
    echo "✗ Migrations failed after retries. Continuing to start the server so you can inspect logs."
    # If you want to be strict (fail deployment when migrations fail), uncomment the next line:
    # exit 1
  fi
fi

echo ""
echo "Starting server on port ${PORT:-5000}..."
echo "=========================================="

# Finally start the app as PID 1
exec node server.js
