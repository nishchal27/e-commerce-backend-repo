# 🔍 Observability Setup Guide

> **Complete guide for setting up Loki log aggregation and Grafana dashboards**

---

## 📋 Overview

This guide covers the complete setup of:
- **Loki** - Log aggregation system
- **Promtail** - Log collector
- **Grafana** - Metrics and logs visualization
- **Pre-configured Dashboards** - Ready-to-use dashboards

---

## 🚀 Quick Start

### 1. Start Services

```bash
# Start all observability services
docker-compose up -d loki promtail grafana

# Or start everything
docker-compose up -d
```

### 2. Access Grafana

1. Open browser: http://localhost:3001
2. Login:
   - Username: `admin`
   - Password: `admin`
3. Change password when prompted (optional)

### 3. Verify Setup

**Check Prometheus Datasource:**
- Go to Configuration → Data Sources
- Prometheus should be configured automatically
- Test connection

**Check Loki Datasource:**
- Go to Configuration → Data Sources
- Loki should be configured automatically
- Test connection

**Check Dashboards:**
- Go to Dashboards → Browse
- You should see:
  - HTTP Metrics
  - Database Metrics
  - Cache Metrics
  - Outbox Metrics
  - Worker Metrics
  - System Overview

---

## 📊 Available Dashboards

### 1. HTTP Metrics
- **Location:** Dashboards → HTTP Metrics
- **Metrics:**
  - HTTP request rate
  - Request duration (p50, p95)
  - Status code distribution
  - Error rate

### 2. Database Metrics
- **Location:** Dashboards → Database Metrics
- **Metrics:**
  - Query rate by operation and table
  - Query duration (p50, p95)
  - Query errors
  - Operations breakdown

### 3. Cache Metrics
- **Location:** Dashboards → Cache Metrics
- **Metrics:**
  - Cache hit ratio
  - Hits vs misses
  - Operations by cache type
  - Hit rate over time

### 4. Outbox Metrics
- **Location:** Dashboards → Outbox Metrics
- **Metrics:**
  - Outbox backlog size
  - Event publication rate
  - Events by topic
  - Publication failure rate

### 5. Worker Metrics
- **Location:** Dashboards → Worker Metrics
- **Metrics:**
  - Active vs waiting jobs
  - Failed vs completed jobs
  - Job status by queue
  - Job failure rate

### 6. System Overview
- **Location:** Dashboards → System Overview
- **Metrics:**
  - Total HTTP request rate
  - Cache hit ratio
  - Outbox backlog
  - Database query rate
  - Worker jobs
  - HTTP error rate

---

## 📝 Log Aggregation (Loki)

### How It Works

1. **Application** logs to stdout/stderr (JSON format via Pino)
2. **Docker** captures container logs
3. **Promtail** collects logs from Docker
4. **Loki** stores and indexes logs
5. **Grafana** queries logs from Loki

### Viewing Logs in Grafana

1. Go to Explore in Grafana
2. Select **Loki** datasource
3. Use LogQL queries:

**All application logs:**
```
{job="ecommerce-backend"}
```

**Error logs only:**
```
{job="ecommerce-backend"} |= "error"
```

**Logs by level:**
```
{job="ecommerce-backend"} | json | level="error"
```

**Logs with specific context:**
```
{job="ecommerce-backend"} | json | context="OrdersService"
```

### Log Format

Application logs are in JSON format:
```json
{
  "level": 30,
  "time": 1638360000000,
  "pid": 12345,
  "hostname": "app",
  "context": "OrdersService",
  "msg": "Order created successfully",
  "orderId": "uuid-here"
}
```

---

## 🔧 Configuration Files

### Loki Configuration
**File:** `loki/loki-config.yml`
- Configures Loki storage and indexing
- Uses filesystem storage (local development)
- For production, configure S3 or other object storage

### Promtail Configuration
**File:** `promtail/promtail-config.yml`
- Configures log collection from Docker
- Scrapes container logs
- Sends logs to Loki

### Grafana Provisioning
**Directory:** `grafana/provisioning/`
- **Datasources:** Auto-configured Prometheus and Loki
- **Dashboards:** Auto-loaded from `grafana/dashboards/`

---

## 🐳 Docker Services

### Loki
- **Port:** 3100
- **Health:** http://localhost:3100/ready
- **API:** http://localhost:3100/api/prom/query

### Promtail
- **Port:** 9080 (internal)
- **Collects:** Docker container logs
- **Sends to:** Loki

### Grafana
- **Port:** 3001
- **URL:** http://localhost:3001
- **Default credentials:** admin/admin

---

## 📈 Prometheus Queries

### HTTP Metrics

**Request rate:**
```promql
rate(http_requests_total[5m])
```

**Request duration (p95):**
```promql
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
```

**Error rate:**
```promql
sum(rate(http_requests_total{status=~"[45].."}[5m])) / sum(rate(http_requests_total[5m]))
```

### Database Metrics

**Query rate:**
```promql
rate(db_queries_total[5m])
```

**Query duration (p95):**
```promql
histogram_quantile(0.95, rate(db_query_duration_seconds_bucket[5m]))
```

**Error rate:**
```promql
rate(db_query_errors_total[5m])
```

### Cache Metrics

**Hit ratio:**
```promql
cache_hit_ratio
```

**Hit rate:**
```promql
rate(cache_hits_total[5m]) / (rate(cache_hits_total[5m]) + rate(cache_misses_total[5m]))
```

### Outbox Metrics

**Backlog size:**
```promql
outbox_backlog_size
```

**Publication rate:**
```promql
rate(outbox_events_published_total[5m])
```

**Failure rate:**
```promql
rate(outbox_events_failed_total[5m]) / rate(outbox_events_published_total[5m])
```

### Worker Metrics

**Active jobs:**
```promql
worker_active_jobs
```

**Failed jobs:**
```promql
worker_failed_jobs
```

**Failure rate:**
```promql
sum(worker_failed_jobs) / (sum(worker_completed_jobs) + sum(worker_failed_jobs))
```

---

## 🔍 Troubleshooting

### Loki Not Collecting Logs

1. **Check Promtail is running:**
   ```bash
   docker-compose ps promtail
   ```

2. **Check Promtail logs:**
   ```bash
   docker-compose logs promtail
   ```

3. **Verify Docker socket access:**
   - Promtail needs access to `/var/run/docker.sock`
   - Check volume mount in `docker-compose.yml`

### Grafana Dashboards Not Showing

1. **Check dashboard files exist:**
   ```bash
   ls -la grafana/dashboards/
   ```

2. **Check provisioning config:**
   ```bash
   cat grafana/provisioning/dashboards/default.yml
   ```

3. **Restart Grafana:**
   ```bash
   docker-compose restart grafana
   ```

### No Metrics in Grafana

1. **Verify Prometheus is scraping:**
   - Go to Prometheus: http://localhost:9090
   - Check Targets: http://localhost:9090/targets
   - Should show "UP" for ecommerce-backend

2. **Check metrics endpoint:**
   ```bash
   curl http://localhost:3000/metrics
   ```

3. **Verify datasource connection:**
   - Grafana → Configuration → Data Sources
   - Test Prometheus connection

### Logs Not Appearing in Loki

1. **Check application is logging:**
   ```bash
   docker-compose logs app | head -20
   ```

2. **Check Loki is receiving logs:**
   ```bash
   curl http://localhost:3100/ready
   ```

3. **Query Loki directly:**
   ```bash
   curl -G -s "http://localhost:3100/loki/api/v1/query_range" \
     --data-urlencode 'query={job="ecommerce-backend"}' \
     --data-urlencode 'start=1638360000000000000' \
     --data-urlencode 'end=1638363600000000000'
   ```

---

## 🚀 Production Considerations

### Loki Storage

For production, configure Loki to use object storage:
- AWS S3
- Google Cloud Storage
- Azure Blob Storage

Update `loki/loki-config.yml`:
```yaml
common:
  storage:
    s3:
      bucket: your-loki-bucket
      region: us-east-1
```

### Grafana Security

1. **Change default password**
2. **Enable authentication** (LDAP, OAuth, etc.)
3. **Configure HTTPS**
4. **Set up user permissions**

### Retention Policies

Configure log retention in Loki:
```yaml
limits_config:
  retention_period: 720h  # 30 days
```

### Resource Limits

Add resource limits to docker-compose.yml:
```yaml
services:
  loki:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
```

---

## 📚 Additional Resources

- [Loki Documentation](https://grafana.com/docs/loki/latest/)
- [Promtail Documentation](https://grafana.com/docs/loki/latest/clients/promtail/)
- [Grafana Documentation](https://grafana.com/docs/grafana/latest/)
- [Prometheus Query Language](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [LogQL](https://grafana.com/docs/loki/latest/logql/)

---

**Last Updated:** 2025-11-17  
**Status:** ✅ Complete

