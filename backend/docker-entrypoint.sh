#!/bin/sh
set -e

# Run Prisma schema synchronization to ensure tables exist
if [ -n "$DATABASE_URL" ]; then
  echo "=> Synchronizing database schema with Prisma..."
  npx prisma db push --skip-generate || echo "WARNING: Prisma db push failed or timed out, continuing application startup..."
fi

exec "$@"
