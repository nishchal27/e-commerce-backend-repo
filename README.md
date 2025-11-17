# E-commerce Backend

A production-minded NestJS e-commerce backend with observability, caching, and modular architecture.

## 📋 Overview

This is an advanced e-commerce backend built with NestJS and TypeScript, designed as a Experiment/Study project that demonstrates:

- **Real-world backend architecture**: Stateless API servers, caches, queues, databases, and background workers
- **DS/Algorithms**: LRU cache implementation, search algorithms, recommendation systems
- **Observability**: Prometheus metrics, structured logging, request tracing
- **Production-ready features**: Docker containerization, database migrations, load testing

> 📖 **Full Project Documentation**: See `E-commerce Backend — Project Plan & Docs.mdx` for comprehensive architecture, API specs, and roadmap.

## 🚀 Quick Start

### Prerequisites

- Node.js 20+ and npm
- Docker and Docker Compose
- k6 (for load testing - optional)

workflow Diagram:

![Alt text for the image](/public/images/HLD-core-workflow.png)


### Installation

1. **Clone the repository**

```bash
git clone <repository-url>
cd e-commerce-backend
```

2. **Run setup script** (installs dependencies, sets up .env, runs migrations, seeds database)

```bash
chmod +x scripts/*.sh
./scripts/setup.sh
```

Or manually:

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Edit .env with your configuration

# Generate Prisma Client
npm run prisma:generate

# Start services (PostgreSQL, Redis, Prometheus)
docker-compose up -d postgres redis prometheus

# Run database migrations
npm run prisma:migrate

# Seed database with sample data
npm run prisma:seed
```

3. **Start the development server**

```bash
npm run start:dev
```

The API will be available at `http://localhost:3000`

## 📁 Project Structure

```
e-commerce-backend/
├── src/
│   ├── algorithms/          # Data structures and algorithms (LRU cache, etc.)
│   ├── common/              # Shared utilities (middleware, filters)
│   │   ├── middleware/      # Request ID, Prometheus middleware
│   │   └── prometheus/      # Prometheus metrics service
│   ├── lib/                 # Library services (Prisma, Redis, Logger)
│   ├── modules/             # Feature modules
│   │   ├── products/        # Products module (CRUD, caching)
│   │   └── auth/            # Auth module (scaffold)
│   ├── app.module.ts        # Root module
│   └── main.ts              # Application entry point
├── prisma/
│   ├── schema.prisma        # Database schema
│   └── seed.ts              # Database seed script
├── k6/                      # Load testing scripts
├── scripts/                 # Helper scripts (migrations, seeding)
├── test/                    # E2E tests
└── docker-compose.yml       # Docker services configuration
```

## 🛠️ Development Commands

### Database

```bash
# Generate Prisma Client
npm run prisma:generate

# Create and apply migrations
npm run prisma:migrate

# Seed database
npm run prisma:seed

# Open Prisma Studio (database GUI)
npm run prisma:studio
```

### Testing

```bash
# Run unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:cov

# Run e2e tests
npm run test:e2e
```

### Load Testing

```bash
# Run baseline load test (no cache)
npm run k6:baseline

# Run cache performance test
npm run k6:cache
```

Or use k6 directly:

```bash
k6 run k6/baseline.js
k6 run k6/cache-test.js
```

## 🔧 Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ecommerce_db?schema=public"

# Redis
REDIS_URL="redis://localhost:6379"

# Application
PORT=3000
NODE_ENV=development

# Cache
USE_IN_MEMORY_CACHE=true
LRU_CACHE_MAX_SIZE=100
CACHE_TTL=3600

# JWT (use strong secrets in production)
JWT_SECRET="your-secret-key"
```

See `.env.example` for all available configuration options.

## 🐳 Docker

### Start all services

```bash
docker-compose up -d
```

This starts:
- **PostgreSQL** on port 5432
- **Redis** on port 6379
- **NestJS App** on port 3000
- **Prometheus** on port 9090
- **Grafana** (optional, commented out) on port 3001

### Stop services

```bash
docker-compose down
```

### View logs

```bash
docker-compose logs -f app
```

### Rebuild application

```bash
docker-compose build app
docker-compose up -d app
```

## 📊 Observability

### Prometheus Metrics

Metrics endpoint: `http://localhost:3000/metrics`

Prometheus UI: `http://localhost:9090`

Available metrics:
- `http_requests_total` - Total HTTP requests by route, method, status
- `http_request_duration_seconds` - Request duration histogram
- `process_resident_memory_bytes` - Memory usage
- `process_cpu_seconds_total` - CPU usage

### Logging

Structured JSON logs using Pino. Logs include:
- Request ID for correlation
- Log levels (debug, info, warn, error)
- Context information

## 🧪 Testing the Cache

The `GET /products/:id` endpoint demonstrates caching:

1. **First request** (cache miss): Queries database, slower response
2. **Subsequent requests** (cache hit): Returns from LRU cache or Redis, faster response

Test it:

```bash
# Get a product ID from seeded data
PRODUCT_ID="<product-id-from-db>"

# First request (cache miss)
curl http://localhost:3000/products/$PRODUCT_ID

# Second request (cache hit - should be faster)
curl http://localhost:3000/products/$PRODUCT_ID
```

Check application logs to see cache hit/miss messages.

## 📡 API Endpoints

### Products

- `GET /products` - List products (paginated)
- `GET /products/:id` - Get product by ID (cached)
- `POST /products` - Create product (admin only - TODO: add auth)
- `PATCH /products/:id` - Update product (admin only)
- `DELETE /products/:id` - Delete product (admin only)

### Health & Metrics

- `GET /` - Health check
- `GET /api/info` - API information
- `GET /metrics` - Prometheus metrics

## 🗄️ Database Schema

See `prisma/schema.prisma` for full schema definition.

Key tables:
- `users` - User accounts and authentication
- `products` - Product catalog
- `product_variants` - Product SKUs/variants
- `orders` - Customer orders
- `reviews` - Product reviews and ratings
- `inventory_reservations` - Stock reservations
- `experiments` - Experiment tracking for analytics

## 🎯 Next Steps

1. **Implement Authentication**: Complete the auth module with JWT, registration, and login
2. **Add More Modules**: Cart, checkout, orders, recommendations, reviews
3. **Implement Search**: Full-text search with Postgres or Meilisearch
4. **Background Workers**: Set up BullMQ workers for indexing, emails, etc.
5. **Add Tests**: Expand test coverage for all modules
6. **Performance Optimization**: Database indexes, query optimization, caching strategies

See `E-commerce Backend — Project Plan & Docs.mdx` for the full roadmap.

## 📚 Documentation

- **Project Plan**: `E-commerce Backend — Project Plan & Docs.mdx` - Comprehensive project documentation
- **Quick Start**: `docs/quickstart.md` - Getting started guide and first benchmark
- **API Documentation**: `http://localhost:3000/api` - Swagger/OpenAPI documentation (development)
- **Deployment Guide**: `docs/DEPLOYMENT.md` - Production deployment instructions
- **Developer Onboarding**: `docs/DEVELOPER-ONBOARDING.md` - Getting started guide for developers
- **API Usage Examples**: `docs/API-USAGE-EXAMPLES.md` - Complete API usage examples
- **Troubleshooting**: `docs/TROUBLESHOOTING.md` - Common issues and solutions
- **Postman Collection**: `docs/postman/e-commerce-backend.postman_collection.json` - Import into Postman

## 🤝 Contributing

This is a learning project. Feel free to fork and extend it!

## 📝 License

MIT

