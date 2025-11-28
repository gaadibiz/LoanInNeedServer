#!/bin/sh
set -e

echo "=========================================="
echo "Starting LoanInNeed Backend"
echo "=========================================="

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL environment variable is not set"
  exit 1
fi

echo "✓ DATABASE_URL is set"

# Check migration status
echo ""
echo "Checking migration status..."
npx prisma migrate status || echo "⚠️  Migration status check failed (this is OK if database is new)"

# Run migrations
echo ""
echo "Running database migrations..."
npx prisma migrate deploy

if [ $? -eq 0 ]; then
  echo "✓ Migrations completed successfully"
else
  echo "✗ Migration failed"
  exit 1
fi

# Start the server
echo ""
echo "Starting server on port ${PORT:-5000}..."
echo "=========================================="
exec node server.js

