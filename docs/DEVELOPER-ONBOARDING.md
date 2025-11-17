# 👨‍💻 Developer Onboarding Guide

> **Welcome to the E-Commerce Backend Team!**  
> This guide will help you get started with the codebase and development workflow.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [Project Structure](#project-structure)
4. [Development Workflow](#development-workflow)
5. [Code Standards](#code-standards)
6. [Testing](#testing)
7. [Common Tasks](#common-tasks)
8. [Resources](#resources)

---

## Prerequisites

### Required Software

- **Node.js** 18+ ([Download](https://nodejs.org/))
- **npm** 9+ (comes with Node.js)
- **PostgreSQL** 14+ ([Download](https://www.postgresql.org/download/))
- **Redis** 6+ ([Download](https://redis.io/download))
- **Git** ([Download](https://git-scm.com/downloads))

### Recommended Tools

- **VS Code** with extensions:
  - ESLint
  - Prettier
  - Prisma
  - Docker
- **Postman** or **Insomnia** (API testing)
- **Docker Desktop** (optional, for containerized development)

---

## Initial Setup

### 1. Clone Repository

```bash
git clone <repository-url>
cd e-commerce-backend
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env` with your local configuration:

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ecommerce_db?schema=public

# Redis
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT Secrets (use strong secrets in production)
JWT_SECRET=dev-secret-change-in-production
JWT_REFRESH_SECRET=dev-refresh-secret-change-in-production
HMAC_SECRET=dev-hmac-secret-change-in-production

# Application
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000
```

### 4. Database Setup

**Using Docker (Recommended):**

```bash
docker-compose up -d postgres redis
```

**Manual Setup:**

```bash
# Create database
createdb ecommerce_db

# Run migrations
npm run prisma:migrate

# Generate Prisma Client
npm run prisma:generate

# (Optional) Seed database
npm run prisma:seed
```

### 5. Start Development Server

```bash
npm run start:dev
```

The application will be available at `http://localhost:3000`

### 6. Verify Setup

```bash
# Health check
curl http://localhost:3000/health

# API info
curl http://localhost:3000/api/info

# Swagger documentation
open http://localhost:3000/api
```

---

## Project Structure

```
e-commerce-backend/
├── src/
│   ├── modules/              # Feature modules
│   │   ├── auth/            # Authentication & authorization
│   │   ├── products/        # Product catalog
│   │   ├── orders/          # Order management
│   │   ├── payments/        # Payment processing
│   │   ├── inventory/       # Inventory management
│   │   ├── cart/            # Shopping cart
│   │   ├── search/          # Product search
│   │   ├── recommendations/ # Product recommendations
│   │   ├── reviews/         # Product reviews
│   │   ├── admin/           # Admin operations
│   │   └── shipping/        # Shipping providers
│   ├── common/              # Shared modules
│   │   ├── events/         # Event system (Outbox pattern)
│   │   ├── prometheus/     # Metrics
│   │   ├── observability/  # Tracing & health checks
│   │   ├── audit/          # Audit logging
│   │   └── security/      # Security utilities
│   ├── lib/                # Core libraries
│   │   ├── prisma/        # Database client
│   │   ├── redis/         # Redis client
│   │   └── logger/        # Logging
│   └── main.ts            # Application entry point
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── migrations/        # Database migrations
├── docs/                  # Documentation
├── test/                  # Tests
├── k6/                    # Load testing scripts
└── docker-compose.yml     # Docker configuration
```

### Module Structure

Each module follows this structure:

```
module-name/
├── dto/                  # Data Transfer Objects
├── module-name.controller.ts
├── module-name.service.ts
├── module-name.repository.ts (if needed)
└── module-name.module.ts
```

---

## Development Workflow

### 1. Create Feature Branch

```bash
git checkout -b feature/your-feature-name
```

### 2. Make Changes

- Write code following project standards
- Add tests for new features
- Update documentation if needed

### 3. Test Locally

```bash
# Run unit tests
npm run test:unit

# Run integration tests
npm run test:integration

# Run all tests
npm run test:all

# Check linting
npm run lint

# Format code
npm run format
```

### 4. Commit Changes

```bash
git add .
git commit -m "feat: add new feature"
```

**Commit Message Format:**
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `refactor:` Code refactoring
- `test:` Tests
- `chore:` Maintenance

### 5. Push and Create PR

```bash
git push origin feature/your-feature-name
```

Create a Pull Request with:
- Description of changes
- Related issues
- Screenshots (if UI changes)
- Test results

---

## Code Standards

### TypeScript

- Use TypeScript strict mode
- Prefer interfaces over types for object shapes
- Use explicit return types for public methods
- Avoid `any` type (use `unknown` if needed)

### NestJS Patterns

- **Controllers:** Handle HTTP requests/responses
- **Services:** Business logic
- **Repositories:** Data access (when needed)
- **DTOs:** Request/response validation
- **Guards:** Authentication/authorization
- **Interceptors:** Cross-cutting concerns

### Naming Conventions

- **Files:** `kebab-case.ts`
- **Classes:** `PascalCase`
- **Variables/Functions:** `camelCase`
- **Constants:** `UPPER_SNAKE_CASE`
- **Interfaces:** `PascalCase` (prefix with `I` if needed)

### Code Style

- Use ESLint and Prettier (configured)
- Maximum line length: 100 characters
- Use meaningful variable names
- Add JSDoc comments for public methods
- Keep functions small and focused

---

## Testing

### Unit Tests

```bash
# Run all unit tests
npm run test:unit

# Run specific test file
npm test -- orders.service.spec.ts

# Watch mode
npm run test:watch
```

### Integration Tests

```bash
# Run integration tests
npm run test:integration
```

### Load Testing

```bash
# Orders endpoint
npm run k6:orders

# Payments endpoint
npm run k6:payments
```

### Test Coverage

```bash
npm run test:cov
```

Target: **80%+ coverage**

---

## Common Tasks

### Add New Endpoint

1. Create/update DTO in `dto/` folder
2. Add method to service
3. Add route to controller
4. Add Swagger decorators
5. Write tests
6. Update documentation

### Database Changes

1. Update `prisma/schema.prisma`
2. Create migration: `npm run prisma:migrate`
3. Generate Prisma Client: `npm run prisma:generate`
4. Update repository/service code

### Add New Module

1. Generate module: `nest g module modules/module-name`
2. Generate controller: `nest g controller modules/module-name`
3. Generate service: `nest g service modules/module-name`
4. Import module in `app.module.ts`
5. Add Swagger tags
6. Write tests

### Debugging

**VS Code Debug Configuration:**

```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug NestJS",
  "runtimeExecutable": "npm",
  "runtimeArgs": ["run", "start:debug"],
  "port": 9229
}
```

**Logs:**

- Application logs: Console output (structured JSON)
- Database queries: Enable Prisma logging
- Redis: Check Redis logs

---

## Resources

### Documentation

- **API Documentation:** `http://localhost:3000/api` (Swagger)
- **Architecture:** `docs/architecture/Modules-Architecture & Experimentation.mdx`
- **Phase Documentation:** `docs/modules/`
- **Auth Security:** `docs/Auth Security Design.mdx`

### External Resources

- [NestJS Documentation](https://docs.nestjs.com/)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

### Getting Help

1. Check documentation
2. Search existing issues
3. Ask in team chat
4. Create new issue with:
   - Description
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details

---

## Quick Reference

### Common Commands

```bash
# Development
npm run start:dev          # Start dev server
npm run build              # Build for production
npm run start:prod         # Start production server

# Database
npm run prisma:generate    # Generate Prisma Client
npm run prisma:migrate     # Run migrations
npm run prisma:studio      # Open Prisma Studio

# Testing
npm run test               # Run all tests
npm run test:watch         # Watch mode
npm run test:cov           # Coverage report

# Code Quality
npm run lint               # Check linting
npm run format             # Format code
```

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | ✅ |
| `REDIS_URL` | Redis connection string | ✅ |
| `JWT_SECRET` | JWT signing secret | ✅ |
| `JWT_REFRESH_SECRET` | Refresh token secret | ✅ |
| `HMAC_SECRET` | HMAC secret for token hashing | ✅ |
| `NODE_ENV` | Environment (development/production) | ✅ |
| `PORT` | Server port | ❌ (default: 3000) |

---

## Next Steps

1. ✅ Complete initial setup
2. ✅ Read architecture documentation
3. ✅ Explore codebase structure
4. ✅ Run example requests
5. ✅ Pick your first task
6. ✅ Start coding!

---

**Welcome aboard! 🚀**

**Last Updated:** 2025-11-17  
**Version:** 1.0

