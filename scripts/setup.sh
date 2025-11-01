#!/bin/bash
# Initial Setup Script
#
# This script performs initial project setup:
# 1. Installs dependencies
# 2. Sets up environment variables
# 3. Generates Prisma Client
# 4. Runs database migrations
# 5. Seeds the database
#
# Usage: ./scripts/setup.sh

set -e  # Exit on error

echo "🚀 Starting project setup..."

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Copy .env.example to .env if it doesn't exist
if [ ! -f .env ]; then
  echo "📝 Creating .env file from .env.example..."
  cp .env.example .env
  echo "⚠️  Please review and update .env with your configuration"
else
  echo "✓ .env file already exists"
fi

# Generate Prisma Client
echo "🔧 Generating Prisma Client..."
npx prisma generate

# Check if database is available
echo "🔍 Checking database connection..."
if docker-compose ps postgres | grep -q "Up"; then
  echo "✓ PostgreSQL is running"
  
  # Run migrations
  echo "🗄️  Running database migrations..."
  npx prisma migrate dev
  
  # Seed database
  echo "🌱 Seeding database..."
  npm run prisma:seed
else
  echo "⚠️  PostgreSQL is not running. Start it with: docker-compose up -d postgres"
  echo "   Then run migrations manually: npm run prisma:migrate"
  echo "   And seed: npm run prisma:seed"
fi

echo "✅ Setup completed successfully!"
echo ""
echo "Next steps:"
echo "  1. Review .env file and update as needed"
echo "  2. Start services: docker-compose up -d"
echo "  3. Start dev server: npm run start:dev"
echo "  4. View API docs: http://localhost:3000"
echo "  5. View metrics: http://localhost:3000/metrics"

