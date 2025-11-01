#!/bin/bash
# Database Seed Script
#
# This script seeds the database with initial data for development and testing.
# Usage: ./scripts/seed.sh
#
# Prerequisites:
# - Database must be running and migrations applied

echo "Seeding database..."

# Run the seed script
npm run prisma:seed

echo "Database seeding completed!"

