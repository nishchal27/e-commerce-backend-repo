# 🚀 Deployment Guide

> **E-Commerce Backend Deployment Guide**  
> Production deployment instructions for the NestJS e-commerce backend

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Database Setup](#database-setup)
4. [Redis Setup](#redis-setup)
5. [Application Deployment](#application-deployment)
6. [Docker Deployment](#docker-deployment)
7. [Cloud Deployment](#cloud-deployment)
8. [Post-Deployment](#post-deployment)
9. [Monitoring & Maintenance](#monitoring--maintenance)

---

## Prerequisites

### Required Services

- **PostgreSQL** 14+ (database)
- **Redis** 6+ (caching and queues)
- **Node.js** 18+ (runtime)
- **npm** or **yarn** (package manager)

### Optional Services

- **Prometheus** (metrics collection)
- **Grafana** (metrics visualization)
- **Jaeger** (distributed tracing)
- **Nginx** or **HAProxy** (reverse proxy/load balancer)

---

## Environment Setup

### 1. Environment Variables

Create a `.env` file in the project root with the following variables:

```env
# Application
NODE_ENV=production
PORT=3000
APP_URL=https://api.yourdomain.com

# Database
DATABASE_URL=postgresql://user:password@host:5432/database?schema=public

# Redis
REDIS_URL=redis://host:6379
REDIS_HOST=host
REDIS_PORT=6379

# JWT Secrets (USE STRONG SECRETS IN PRODUCTION!)
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_EXPIRES_IN=3600
JWT_REFRESH_SECRET=your-super-secret-refresh-key-min-32-chars
JWT_REFRESH_EXPIRES_IN=604800

# HMAC Secret (for refresh token hashing)
HMAC_SECRET=your-hmac-secret-min-32-chars

# Email Configuration
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASS=your-email-password
SMTP_FROM=noreply@yourdomain.com

# Stripe (Payment Processing)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# OpenTelemetry (Optional)
OTEL_ENABLED=true
OTEL_SERVICE_NAME=e-commerce-backend
OTEL_EXPORTER_JAEGER_ENDPOINT=http://jaeger:14268/api/traces
OTEL_SAMPLING_RATE=1.0

# Shipping (Optional)
SHIPPING_PROVIDER=mock

# Cache Settings
USE_IN_MEMORY_CACHE=false
CACHE_TTL=3600

# Logging
LOG_LEVEL=info
LOG_PRETTY=false
```

### 2. Generate Strong Secrets

**Important:** Generate strong, random secrets for production:

```bash
# Generate JWT secret (32+ characters)
openssl rand -base64 32

# Generate HMAC secret (32+ characters)
openssl rand -base64 32
```

**Never commit secrets to version control!**

---

## Database Setup

### 1. Create Database

```sql
CREATE DATABASE ecommerce_db;
CREATE USER ecommerce_user WITH PASSWORD 'strong_password';
GRANT ALL PRIVILEGES ON DATABASE ecommerce_db TO ecommerce_user;
```

### 2. Run Migrations

```bash
# Generate Prisma Client
npm run prisma:generate

# Run migrations
npm run prisma:migrate:deploy

# (Optional) Seed initial data
npm run prisma:seed
```

### 3. Database Connection Pooling

For production, configure connection pooling:

```env
DATABASE_URL=postgresql://user:password@host:5432/database?schema=public&connection_limit=20&pool_timeout=20
```

---

## Redis Setup

### 1. Install Redis

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install redis-server
sudo systemctl start redis
sudo systemctl enable redis
```

**Docker:**
```bash
docker run -d --name redis -p 6379:6379 redis:7-alpine
```

### 2. Configure Redis

Edit `/etc/redis/redis.conf`:

```conf
# Set max memory
maxmemory 256mb
maxmemory-policy allkeys-lru

# Enable persistence (optional)
save 900 1
save 300 10
save 60 10000
```

### 3. Test Connection

```bash
redis-cli ping
# Should return: PONG
```

---

## Application Deployment

### 1. Build Application

```bash
# Install dependencies
npm ci

# Build application
npm run build

# Generate Prisma Client
npm run prisma:generate
```

### 2. Start Application

**Development:**
```bash
npm run start:dev
```

**Production:**
```bash
npm run start:prod
```

### 3. Process Manager (PM2)

For production, use PM2 for process management:

```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start dist/main.js --name e-commerce-backend

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
pm2 startup
```

**PM2 Ecosystem File (`ecosystem.config.js`):**

```javascript
module.exports = {
  apps: [{
    name: 'e-commerce-backend',
    script: './dist/main.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    max_memory_restart: '1G'
  }]
};
```

---

## Docker Deployment

### 1. Build Docker Image

```bash
docker build -t e-commerce-backend:latest .
```

### 2. Run with Docker Compose

```bash
docker-compose up -d
```

### 3. Docker Compose Production

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://user:password@postgres:5432/database
      REDIS_URL: redis://redis:6379
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: ecommerce_db
      POSTGRES_USER: ecommerce_user
      POSTGRES_PASSWORD: strong_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

---

## Cloud Deployment

### AWS (Elastic Beanstalk / ECS)

1. **Create Application**
   - Upload application code
   - Configure environment variables
   - Set up RDS (PostgreSQL) and ElastiCache (Redis)

2. **Configure Load Balancer**
   - Health check: `GET /health`
   - SSL/TLS termination

3. **Set Up Auto Scaling**
   - Min instances: 2
   - Max instances: 10
   - Target CPU: 70%

### Google Cloud Platform (Cloud Run)

1. **Build Container**
   ```bash
   gcloud builds submit --tag gcr.io/PROJECT_ID/e-commerce-backend
   ```

2. **Deploy to Cloud Run**
   ```bash
   gcloud run deploy e-commerce-backend \
     --image gcr.io/PROJECT_ID/e-commerce-backend \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated
   ```

### Azure (App Service)

1. **Create App Service**
   - Select Node.js runtime
   - Configure environment variables
   - Set up PostgreSQL and Redis

2. **Configure Deployment**
   - Connect to GitHub/GitLab
   - Enable continuous deployment

---

## Post-Deployment

### 1. Health Checks

Verify application is running:

```bash
# Health check
curl http://localhost:3000/health

# Detailed health
curl http://localhost:3000/health/detailed

# Metrics
curl http://localhost:3000/metrics
```

### 2. Verify Services

- ✅ Database connection
- ✅ Redis connection
- ✅ Background workers running
- ✅ Email service configured
- ✅ Payment provider configured

### 3. SSL/TLS Setup

**Using Let's Encrypt (Certbot):**

```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com
```

**Nginx Configuration:**

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## Monitoring & Maintenance

### 1. Prometheus Metrics

Access metrics at: `http://your-domain/metrics`

### 2. Log Monitoring

- Application logs: Check PM2 logs or Docker logs
- Structured JSON logs: Parse with ELK stack or Loki

### 3. Database Backups

**Automated Backups:**

```bash
# Daily backup script
#!/bin/bash
pg_dump -h localhost -U ecommerce_user ecommerce_db > backup_$(date +%Y%m%d).sql
```

### 4. Updates & Maintenance

```bash
# Pull latest code
git pull origin main

# Install dependencies
npm ci

# Run migrations
npm run prisma:migrate:deploy

# Rebuild
npm run build

# Restart application
pm2 restart e-commerce-backend
# or
docker-compose restart app
```

### 5. Performance Monitoring

- Monitor Prometheus metrics
- Set up Grafana dashboards
- Configure alerts for:
  - High error rates
  - Slow response times
  - Database connection issues
  - Redis connection issues

---

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Check DATABASE_URL format
   - Verify database is running
   - Check firewall rules

2. **Redis Connection Errors**
   - Verify Redis is running
   - Check REDIS_URL format
   - Verify network connectivity

3. **JWT Token Errors**
   - Verify JWT_SECRET is set
   - Check token expiration settings
   - Ensure secrets match across instances

4. **Worker Not Processing Jobs**
   - Check Redis connection
   - Verify workers are running
   - Check queue configuration

### Logs Location

- **PM2:** `~/.pm2/logs/`
- **Docker:** `docker logs <container-name>`
- **Systemd:** `journalctl -u e-commerce-backend`

---

## Security Checklist

- [ ] Strong secrets generated and stored securely
- [ ] SSL/TLS certificates configured
- [ ] Database credentials secured
- [ ] Redis password set (if applicable)
- [ ] Firewall rules configured
- [ ] Rate limiting enabled
- [ ] CORS configured for production
- [ ] Security headers configured
- [ ] Regular security updates
- [ ] Backup strategy in place

---

## Support

For issues or questions:
- Check logs: `pm2 logs` or `docker logs`
- Review metrics: `/metrics` endpoint
- Check health: `/health/detailed` endpoint

---

**Last Updated:** 2025-11-17  
**Version:** 1.0

