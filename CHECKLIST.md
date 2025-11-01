# Post-Scaffold Checklist

Use this checklist after setting up the scaffold to ensure everything is working correctly.

## ✅ Immediate Actions After Scaffold

### 1. Install Dependencies
```bash
npm install
```
- [ ] Dependencies installed successfully
- [ ] No installation errors

### 2. Set Up Environment Variables
```bash
cp env.example .env
# Edit .env if needed (defaults should work for local development)
```
- [ ] `.env` file created
- [ ] Environment variables reviewed and updated if necessary

### 3. Start Docker Services
```bash
docker-compose up -d postgres redis prometheus
```
- [ ] PostgreSQL container is running (`docker-compose ps postgres`)
- [ ] Redis container is running (`docker-compose ps redis`)
- [ ] Prometheus container is running (`docker-compose ps prometheus`)

### 4. Set Up Database
```bash
# Generate Prisma Client
npm run prisma:generate

# Create and apply migrations
npm run prisma:migrate

# Seed database with sample data
npm run prisma:seed
```
- [ ] Prisma Client generated successfully
- [ ] Database migrations applied
- [ ] Database seeded with sample data
- [ ] Can verify data in Prisma Studio: `npm run prisma:studio`

### 5. Start Development Server
```bash
npm run start:dev
```
- [ ] Application starts without errors
- [ ] Server is running on `http://localhost:3000`
- [ ] Health check endpoint works: `curl http://localhost:3000/`

### 6. Verify Basic Functionality

#### Test Health Endpoint
```bash
curl http://localhost:3000/
```
- [ ] Returns `{"status": "ok", ...}`

#### Test Products Endpoint
```bash
# Get product ID from seeded data
curl http://localhost:3000/products | jq '.data[0].id'

# Test product detail endpoint (replace <ID> with actual ID)
curl http://localhost:3000/products/<ID>
```
- [ ] Can list products
- [ ] Can get product by ID
- [ ] Second request to same product is faster (cache working)

#### Test Metrics Endpoint
```bash
curl http://localhost:3000/metrics
```
- [ ] Returns Prometheus metrics in text format
- [ ] Metrics include `http_requests_total`

### 7. Run Tests
```bash
# Unit tests (LRU cache)
npm test

# E2E tests (products module)
npm run test:e2e
```
- [ ] All unit tests pass
- [ ] All e2e tests pass

### 8. Run Baseline Load Test (Optional)
```bash
# First, update product IDs in k6/baseline.js
# Then run:
k6 run k6/baseline.js
```
- [ ] k6 installed
- [ ] Baseline test completes successfully
- [ ] Results show acceptable performance

### 9. Verify Observability

#### Check Logs
- [ ] Logs include request IDs
- [ ] Logs are structured (JSON in production, pretty in dev)
- [ ] Cache hit/miss messages appear in logs

#### Check Prometheus
- [ ] Prometheus UI accessible: `http://localhost:9090`
- [ ] Can query metrics in Prometheus
- [ ] Application metrics are being scraped

### 10. Verify Cache Behavior

1. **Get a product ID:**
   ```bash
   PRODUCT_ID=$(curl -s http://localhost:3000/products | jq -r '.data[0].id')
   ```

2. **Make first request (cache miss):**
   ```bash
   curl -w "\nTime: %{time_total}s\n" http://localhost:3000/products/$PRODUCT_ID
   ```
   - [ ] First request completes
   - [ ] Log shows "retrieved from database"

3. **Make second request (cache hit):**
   ```bash
   curl -w "\nTime: %{time_total}s\n" http://localhost:3000/products/$PRODUCT_ID
   ```
   - [ ] Second request is faster
   - [ ] Log shows "retrieved from LRU cache" or "retrieved from Redis cache"

## 🐛 Troubleshooting

### Database Connection Issues
- Check PostgreSQL is running: `docker-compose ps postgres`
- Check connection string in `.env`: `DATABASE_URL`
- View logs: `docker-compose logs postgres`

### Redis Connection Issues
- Check Redis is running: `docker-compose ps redis`
- Test connection: `docker-compose exec redis redis-cli ping`
- Should return: `PONG`

### Application Errors
- Check application logs: `docker-compose logs app` or console output
- Verify all environment variables are set correctly
- Ensure database migrations are applied

### Cache Not Working
- Check `USE_IN_MEMORY_CACHE` is set to `true` in `.env`
- Verify Redis is running if using Redis cache
- Check application logs for cache-related messages

## 📝 Next Steps

After completing this checklist:

1. **Explore the Codebase**
   - Review module structure
   - Understand the caching implementation
   - Study the Prometheus integration

2. **Read Documentation**
   - `README.md` - Project overview and commands
   - `docs/quickstart.md` - Detailed getting started guide
   - `E-commerce Backend — Project Plan & Docs.mdx` - Full project documentation

3. **Extend the Project**
   - Implement authentication endpoints
   - Add more modules (cart, checkout, orders)
   - Implement search functionality
   - Add more tests

4. **Performance Optimization**
   - Run load tests and analyze results
   - Experiment with cache settings
   - Optimize database queries
   - Add database indexes if needed

## ✨ Success Criteria

You've successfully set up the scaffold if:
- ✅ All services start without errors
- ✅ Database is migrated and seeded
- ✅ API endpoints respond correctly
- ✅ Caching is working (second request is faster)
- ✅ Metrics endpoint is accessible
- ✅ Tests pass
- ✅ Logs show structured output with request IDs

## 📞 Getting Help

If you encounter issues:
1. Check the troubleshooting section above
2. Review error logs carefully
3. Verify all prerequisites are installed
4. Ensure Docker services are running
5. Check that environment variables are set correctly

Happy coding! 🚀

