# 🔧 Troubleshooting Guide

> **Common issues and solutions for the E-Commerce Backend**

---

## 📋 Table of Contents

1. [Setup Issues](#setup-issues)
2. [Database Issues](#database-issues)
3. [Redis Issues](#redis-issues)
4. [Authentication Issues](#authentication-issues)
5. [API Issues](#api-issues)
6. [Performance Issues](#performance-issues)
7. [Deployment Issues](#deployment-issues)
8. [Worker Issues](#worker-issues)

---

## Setup Issues

### Issue: `npm install` fails

**Symptoms:**
- Dependency resolution errors
- Build failures

**Solutions:**

1. **Clear npm cache:**
   ```bash
   npm cache clean --force
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **Use Node.js 18+:**
   ```bash
   node --version  # Should be 18.x or higher
   ```

3. **Check disk space:**
   ```bash
   df -h
   ```

### Issue: Prisma Client not generated

**Symptoms:**
- `@prisma/client` import errors
- Type errors

**Solutions:**

```bash
# Generate Prisma Client
npm run prisma:generate

# If that fails, try:
npx prisma generate
```

### Issue: Environment variables not loading

**Symptoms:**
- Configuration errors
- Missing secrets

**Solutions:**

1. **Check `.env` file exists:**
   ```bash
   ls -la .env
   ```

2. **Verify file format:**
   ```bash
   # No spaces around =
   DATABASE_URL=postgresql://...
   # Not: DATABASE_URL = postgresql://...
   ```

3. **Restart application after changes**

---

## Database Issues

### Issue: Cannot connect to database

**Symptoms:**
- `P1001: Can't reach database server`
- Connection timeout

**Solutions:**

1. **Check PostgreSQL is running:**
   ```bash
   # Docker
   docker ps | grep postgres
   
   # System service
   sudo systemctl status postgresql
   ```

2. **Verify connection string:**
   ```bash
   # Test connection
   psql $DATABASE_URL
   ```

3. **Check firewall/network:**
   ```bash
   # Test port
   telnet localhost 5432
   ```

4. **Verify credentials:**
   - Check username/password in `DATABASE_URL`
   - Ensure database exists

### Issue: Migration errors

**Symptoms:**
- `Migration failed`
- Schema drift

**Solutions:**

1. **Reset database (development only):**
   ```bash
   npx prisma migrate reset
   ```

2. **Check migration status:**
   ```bash
   npx prisma migrate status
   ```

3. **Create new migration:**
   ```bash
   npx prisma migrate dev --name migration_name
   ```

4. **Resolve conflicts:**
   - Review migration files
   - Manually fix conflicts
   - Re-run migration

### Issue: Slow queries

**Symptoms:**
- High response times
- Database CPU high

**Solutions:**

1. **Check indexes:**
   ```sql
   -- List indexes
   SELECT * FROM pg_indexes WHERE tablename = 'your_table';
   ```

2. **Add missing indexes:**
   ```prisma
   // In schema.prisma
   model User {
     email String @unique
     @@index([email])  // Add index
   }
   ```

3. **Analyze queries:**
   ```sql
   EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'test@example.com';
   ```

4. **Enable query logging:**
   ```env
   # In .env
   DATABASE_URL="...?log=query"
   ```

---

## Redis Issues

### Issue: Cannot connect to Redis

**Symptoms:**
- `ECONNREFUSED`
- `Redis connection error`

**Solutions:**

1. **Check Redis is running:**
   ```bash
   # Docker
   docker ps | grep redis
   
   # System service
   sudo systemctl status redis
   ```

2. **Test connection:**
   ```bash
   redis-cli ping
   # Should return: PONG
   ```

3. **Check connection string:**
   ```bash
   # Verify REDIS_URL format
   echo $REDIS_URL
   # Should be: redis://localhost:6379
   ```

4. **Check firewall:**
   ```bash
   telnet localhost 6379
   ```

### Issue: Redis memory full

**Symptoms:**
- `OOM command not allowed`
- Cache misses

**Solutions:**

1. **Check memory usage:**
   ```bash
   redis-cli INFO memory
   ```

2. **Clear cache:**
   ```bash
   redis-cli FLUSHDB
   ```

3. **Configure eviction policy:**
   ```conf
   # In redis.conf
   maxmemory 256mb
   maxmemory-policy allkeys-lru
   ```

### Issue: Cache not working

**Symptoms:**
- No cache hits
- High database load

**Solutions:**

1. **Check Redis connection:**
   ```bash
   redis-cli ping
   ```

2. **Verify cache configuration:**
   ```env
   USE_IN_MEMORY_CACHE=false  # Use Redis, not in-memory
   REDIS_URL=redis://localhost:6379
   ```

3. **Check cache keys:**
   ```bash
   redis-cli KEYS "*"
   ```

---

## Authentication Issues

### Issue: JWT token invalid

**Symptoms:**
- `401 Unauthorized`
- `Token expired`

**Solutions:**

1. **Check token expiration:**
   ```bash
   # Decode JWT (use jwt.io)
   # Verify exp claim
   ```

2. **Refresh token:**
   ```bash
   curl -X POST http://localhost:3000/auth/refresh \
     -b cookies.txt
   ```

3. **Verify JWT_SECRET:**
   ```bash
   # Check .env file
   echo $JWT_SECRET
   # Must match secret used to sign tokens
   ```

### Issue: Refresh token not working

**Symptoms:**
- `Invalid refresh token`
- Cookie not sent

**Solutions:**

1. **Check cookie settings:**
   - `httpOnly: true`
   - `secure: true` (production)
   - `sameSite: 'strict'`

2. **Verify cookie is sent:**
   ```bash
   curl -v -X POST http://localhost:3000/auth/refresh \
     -b cookies.txt
   ```

3. **Check token in database:**
   ```sql
   SELECT * FROM refresh_tokens WHERE "userId" = 'user-uuid';
   ```

### Issue: Password reset not working

**Symptoms:**
- Email not received
- Token invalid

**Solutions:**

1. **Check email configuration:**
   ```env
   SMTP_HOST=smtp.example.com
   SMTP_PORT=587
   SMTP_USER=your-email@example.com
   SMTP_PASS=your-password
   ```

2. **Check email queue:**
   ```bash
   # Check BullMQ queue
   redis-cli KEYS "bull:*"
   ```

3. **Verify token expiration:**
   - Reset tokens expire in 1 hour
   - Check token timestamp

---

## API Issues

### Issue: 400 Bad Request

**Symptoms:**
- Validation errors
- Invalid input

**Solutions:**

1. **Check request body:**
   ```bash
   # Verify JSON format
   curl -X POST http://localhost:3000/endpoint \
     -H "Content-Type: application/json" \
     -d '{"key": "value"}'
   ```

2. **Check DTO validation:**
   - Review DTO file
   - Ensure required fields present
   - Check field types

3. **Check Swagger docs:**
   - Visit `http://localhost:3000/api`
   - Review endpoint schema

### Issue: 404 Not Found

**Symptoms:**
- Endpoint not found
- Resource not found

**Solutions:**

1. **Check endpoint URL:**
   ```bash
   # Verify route exists
   curl -X GET http://localhost:3000/health
   ```

2. **Check resource exists:**
   ```bash
   # Verify ID is valid UUID
   curl -X GET http://localhost:3000/products/valid-uuid
   ```

3. **Check route registration:**
   - Verify controller is imported in module
   - Check route path matches

### Issue: 429 Too Many Requests

**Symptoms:**
- Rate limit exceeded
- Too many requests

**Solutions:**

1. **Wait for rate limit reset:**
   - Default: 1 hour window
   - Check rate limit headers

2. **Clear rate limit (development):**
   ```bash
   npm run clear-rate-limit
   ```

3. **Adjust rate limits:**
   ```typescript
   // In rate-limit configuration
   @RateLimit({ points: 10, duration: 60 })
   ```

### Issue: CORS errors

**Symptoms:**
- `CORS policy blocked`
- Preflight request fails

**Solutions:**

1. **Check CORS configuration:**
   ```typescript
   // In main.ts
   app.enableCors({
     origin: 'http://localhost:3001',  // Your frontend URL
     credentials: true,
   });
   ```

2. **Verify frontend URL:**
   - Check `origin` header in request
   - Ensure matches CORS config

---

## Performance Issues

### Issue: Slow API responses

**Symptoms:**
- High latency
- Timeout errors

**Solutions:**

1. **Check database queries:**
   ```sql
   -- Enable slow query log
   SET log_min_duration_statement = 1000;  -- Log queries > 1s
   ```

2. **Check Redis cache:**
   ```bash
   # Verify cache hits
   redis-cli INFO stats | grep keyspace_hits
   ```

3. **Check application logs:**
   ```bash
   # Look for slow operations
   tail -f logs/app.log | grep "duration"
   ```

4. **Monitor metrics:**
   ```bash
   curl http://localhost:3000/metrics | grep http_request_duration
   ```

### Issue: High memory usage

**Symptoms:**
- Application crashes
- OOM errors

**Solutions:**

1. **Check memory usage:**
   ```bash
   # Node.js
   node --max-old-space-size=4096 dist/main.js
   ```

2. **Check for memory leaks:**
   - Use Node.js profiler
   - Check for unclosed connections
   - Review event listeners

3. **Restart application:**
   ```bash
   pm2 restart e-commerce-backend
   ```

---

## Deployment Issues

### Issue: Application won't start

**Symptoms:**
- Startup errors
- Port already in use

**Solutions:**

1. **Check port availability:**
   ```bash
   lsof -i :3000
   # Kill process if needed
   kill -9 <PID>
   ```

2. **Check environment variables:**
   ```bash
   # Verify all required vars set
   env | grep -E "DATABASE_URL|REDIS_URL|JWT_SECRET"
   ```

3. **Check logs:**
   ```bash
   # PM2
   pm2 logs e-commerce-backend
   
   # Docker
   docker logs <container-name>
   ```

### Issue: Database migration fails in production

**Symptoms:**
- Migration errors
- Schema mismatch

**Solutions:**

1. **Run migrations manually:**
   ```bash
   npm run prisma:migrate:deploy
   ```

2. **Check migration status:**
   ```bash
   npx prisma migrate status
   ```

3. **Backup before migration:**
   ```bash
   pg_dump $DATABASE_URL > backup.sql
   ```

### Issue: SSL/TLS certificate errors

**Symptoms:**
- Certificate validation fails
- HTTPS errors

**Solutions:**

1. **Check certificate validity:**
   ```bash
   openssl s_client -connect api.yourdomain.com:443
   ```

2. **Renew certificate:**
   ```bash
   sudo certbot renew
   ```

3. **Verify Nginx configuration:**
   ```nginx
   ssl_certificate /etc/letsencrypt/live/domain/fullchain.pem;
   ssl_certificate_key /etc/letsencrypt/live/domain/privkey.pem;
   ```

---

## Worker Issues

### Issue: Workers not processing jobs

**Symptoms:**
- Jobs stuck in queue
- No job processing

**Solutions:**

1. **Check workers are running:**
   ```bash
   # Check process
   ps aux | grep worker
   
   # Check logs
   pm2 logs worker
   ```

2. **Check Redis connection:**
   ```bash
   redis-cli ping
   ```

3. **Check queue status:**
   ```bash
   curl http://localhost:3000/workers/queues
   ```

4. **Restart workers:**
   ```bash
   pm2 restart worker
   ```

### Issue: Jobs failing

**Symptoms:**
- High failure rate
- Jobs in DLQ

**Solutions:**

1. **Check job errors:**
   ```bash
   curl http://localhost:3000/workers/dlq
   ```

2. **Review worker logs:**
   ```bash
   tail -f logs/worker.log
   ```

3. **Retry failed jobs:**
   ```bash
   curl -X POST http://localhost:3000/workers/dlq/retry/job-id
   ```

---

## Getting Help

### Debug Steps

1. **Check logs:**
   - Application logs
   - Database logs
   - Redis logs

2. **Verify configuration:**
   - Environment variables
   - Database connection
   - Redis connection

3. **Test components:**
   - Health endpoints
   - Database queries
   - Redis commands

4. **Review documentation:**
   - API documentation
   - Architecture docs
   - Deployment guide

### Useful Commands

```bash
# Health check
curl http://localhost:3000/health/detailed

# Check database
psql $DATABASE_URL -c "SELECT 1"

# Check Redis
redis-cli ping

# View logs
pm2 logs
# or
docker logs <container>

# Check metrics
curl http://localhost:3000/metrics
```

---

**Last Updated:** 2025-11-17  
**Version:** 1.0

