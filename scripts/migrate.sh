#!/bin/bash
# Database Migration Script
#
# This script runs Prisma migrations to set up or update the database schema.
# Usage: ./scripts/migrate.sh

echo "Running database migrations..."

# Generate Prisma Client
echo "Generating Prisma Client..."
npx prisma generate

# Run migrations
echo "Applying migrations..."
npx prisma migrate dev

echo "Migrations completed successfully!"

