# Quick Start Guide

This guide will help you get the e-commerce backend up and running and run your first performance benchmark.

## Prerequisites

Before starting, ensure you have:

- **Node.js 20+** and npm installed
- **Docker** and Docker Compose installed
- **k6** installed (optional, for load testing)

### Installing k6

**macOS:**
```bash
brew install k6
```

**Linux:**
```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

**Windows:**
Download from [k6.io](https://k6.io/docs/getting-started/installation/)

## Step 1: Initial Setup

1. **Clone and navigate to the project**
   ```bash
   cd e-commerce-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` if needed (defaults should work for local development).

4. **Start Docker services**
   ```bash
   docker-compose up -d postgres redis prometheus
   ```

5. **Set up the database**
   ```bash
   # Generate Prisma Client
   npm run prisma:generate

   # Run migrations
   npm run prisma:migrate

   # Seed database with sample data
   npm run prisma:seed
   ```

## Step 2: Start the Application

```bash
npm run start:dev
```

The application should start on `http://localhost:3000`.

Verify it's running:
```bash
curl http://localhost:3000/
```

You should see:
```json
{
  "status": "ok",
  "message": "E-commerce Backend API is running",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Step 3: Test the API

### Get a Product ID

First, get a product ID from the seeded data:

```bash
# Option 1: Use Prisma Studio
npm run prisma:studio
# Navigate to http://localhost:5555, go to Products, copy an ID

# Option 2: Query via API
curl http://localhost:3000/products | jq '.data[0].id'
```

### Test Product Endpoint

Replace `<PRODUCT_ID>` with an actual ID:

```bash
# First request (cache miss - slower)
curl -w "\nTime: %{time_total}s\n" http://localhost:3000/products/<PRODUCT_ID>

# Second request (cache hit - faster)
curl -w "\nTime: %{time_total}s\n" http://localhost:3000/products/<PRODUCT_ID>
```

You should see the second request is faster (check the `Time` output).

## Step 4: Run Your First Benchmark

### Baseline Load Test (No Cache)

This test measures performance without caching benefits:

1. **Update product IDs in the test script**

   Edit `k6/baseline.js` and replace the `PRODUCT_IDS` array with actual product IDs from your database:

   ```javascript
   const PRODUCT_IDS = [
     'your-product-id-1',
     'your-product-id-2',
     'your-product-id-3',
   ];
   ```

2. **Run the baseline test**

   ```bash
   k6 run k6/baseline.js
   ```

   This will:
   - Ramp up to 10 users over 30 seconds
   - Maintain 10 users for 1 minute
   - Ramp up to 50 users
   - Measure response times, throughput, and error rates

3. **Review the results**

   Look for:
   - **Response times**: p50, p95, p99 percentiles
   - **Throughput**: Requests per second
   - **Error rate**: Should be < 10%

### Cache Performance Test

This test demonstrates cache performance improvements:

1. **Update product ID in the test script**

   Edit `k6/cache-test.js` and set `PRODUCT_ID`:

   ```javascript
   const PRODUCT_ID = 'your-product-id';
   ```

2. **Run the cache test**

   ```bash
   k6 run k6/cache-test.js
   ```

   This will:
   - Warm up the cache with an initial request
   - Make subsequent requests (should hit cache)
   - Show cache hit rate and performance improvement

3. **Compare results**

   - First request (cache miss): Slower (database query)
   - Subsequent requests (cache hits): Faster (from cache)

## Step 5: View Metrics

### Prometheus Metrics

Visit: `http://localhost:3000/metrics`

You'll see metrics in Prometheus format:
```
http_requests_total{route="/products/:id",method="GET",status="200"} 42
http_request_duration_seconds_bucket{route="/products/:id",method="GET",status="200",le="0.1"} 35
...
```

### Prometheus UI

Visit: `http://localhost:9090`

You can:
- Query metrics
- Create graphs
- Set up alerts

Example query:
```
rate(http_requests_total[5m])
```

## Step 6: Store Experiment Results

After running benchmarks, you can store results in the database for analytics:

```bash
./scripts/experiment-results.sh "lru_cache_test" "baseline" "avg_response_time" 234.5 "Baseline test without cache"
./scripts/experiment-results.sh "lru_cache_test" "with_cache" "avg_response_time" 12.3 "Test with LRU cache enabled"
```

Query experiment results:
```bash
npm run prisma:studio
# Navigate to Experiments table
```

## Troubleshooting

### Database Connection Issues

```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# View PostgreSQL logs
docker-compose logs postgres

# Restart PostgreSQL
docker-compose restart postgres
```

### Redis Connection Issues

```bash
# Check if Redis is running
docker-compose ps redis

# Test Redis connection
docker-compose exec redis redis-cli ping
# Should return: PONG
```

### Application Won't Start

1. Check logs:
   ```bash
   docker-compose logs app
   ```

2. Verify environment variables:
   ```bash
   cat .env
   ```

3. Ensure database migrations are applied:
   ```bash
   npm run prisma:migrate
   ```

### k6 Not Found

#Newman (Postman) automation README snippet

Install k6 following the instructions in the Prerequisites section above.

## Next Steps

1. **Explore the API**: Try all endpoints in `README.md`
2. **Read the Full Docs**: See `E-commerce Backend — Project Plan & Docs.mdx` for architecture and roadmap
3. **Run More Tests**: Experiment with different load patterns
4. **Customize**: Modify cache settings, add more products, extend features

## Resources

- [NestJS Documentation](https://docs.nestjs.com/)
- [Prisma Documentation](https://www.prisma.io/docs)
- [k6 Documentation](https://k6.io/docs/)
- [Prometheus Documentation](https://prometheus.io/docs/)

Happy coding! 🚀

## Running smoke tests & experiments (Postman + k6 + report)

### Prereqs
- Node.js & npm
- Docker (optional for running services)
- k6 (install: https://k6.io/docs/getting-started/installation/)
- newman (npm install -g newman) or use npx newman

### 1) Run Postman collection automatically with Newman
Assuming you have `Ecom-Dev-Collection.postman_collection.json` and `Ecom-Dev-Environment.postman_environment.json` in `./docs`:

```bash
# Run the Smoke Tests folder and save a JSON report
newman run docs/Ecom-Dev-Collection.postman_collection.json -e docs/Ecom-Dev-Environment.postman_environment.json \
  --folder "Smoke Tests" --reporters cli,json --reporter-json-export ./newman_results.json


