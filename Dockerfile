# Dockerfile for NestJS E-commerce Backend
#
# Multi-stage build:
# 1. Dependencies stage: Install npm dependencies
# 2. Build stage: Compile TypeScript
# 3. Production stage: Run the application

# Stage 1: Dependencies
FROM node:20-alpine AS dependencies

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Stage 2: Build
FROM node:20-alpine AS build

WORKDIR /app

# Copy dependencies from previous stage
COPY --from=dependencies /app/node_modules ./node_modules

# Copy source code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build the application
RUN npm run build

# Stage 3: Production
FROM node:20-alpine AS production

WORKDIR /app

# Install OpenSSL for Prisma (required for database connections)
RUN apk add --no-cache openssl libc6-compat

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Copy built application from build stage FIRST
COPY --from=build /app/dist ./dist

# Copy ALL node_modules from build stage (includes all dependencies)
# This ensures @nestjs/swagger and all other runtime dependencies are available
# We do this BEFORE installing production deps to avoid conflicts
COPY --from=build /app/node_modules ./node_modules

# Install Prisma Client in production (needs to match the binary target)
RUN npm install prisma --no-save && \
    npx prisma generate && \
    npm uninstall prisma

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Change ownership of app directory
RUN chown -R nestjs:nodejs /app
USER nestjs

# Expose application port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/ || exit 1

# Start the application
CMD ["node", "dist/main"]

