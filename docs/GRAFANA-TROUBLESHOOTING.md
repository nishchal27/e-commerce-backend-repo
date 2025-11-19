# 🔧 Grafana "No Data" Troubleshooting Guide

> **For new Grafana users** - Step-by-step guide to fix "No data" issues

---

## 🔍 Step 1: Check if Services are Running

### Check Docker Containers

```bash
# Check all services
docker-compose ps

# You should see:
# - app (running)
# - prometheus (running)
# - grafana (running)
```

**If services aren't running:**
```bash
# Start all services
docker-compose up -d
```

---

## 🔍 Step 2: Verify Application is Exposing Metrics

### Test Metrics Endpoint

```bash
# Check if app is exposing metrics
curl http://localhost:3000/metrics

# You should see output like:
# # HELP http_requests_total Total number of HTTP requests
# # TYPE http_requests_total counter
# http_requests_total{method="GET",route="/",status="200"} 5
```

**If you get connection error:**
- App might not be running
- Check: `docker-compose logs app`

**If you see metrics:** ✅ Good! Move to Step 3

**If you see empty or no metrics:**
- Make some API requests first (metrics are created when requests happen)
- Try: `curl http://localhost:3000/health`

---

## 🔍 Step 3: Verify Prometheus is Scraping

### Check Prometheus Targets

1. **Open Prometheus UI:** http://localhost:9090
2. **Go to:** Status → Targets
3. **Look for:** `ecommerce-backend` target
4. **Status should be:** ✅ **UP** (green)

**If status is DOWN (red):**
- Prometheus can't reach the app
- Check network connectivity
- Verify `prometheus/prometheus.yml` has correct target: `app:3000`

### Check Prometheus Metrics

1. **In Prometheus UI:** Go to Graph tab
2. **Type query:** `up`
3. **Click Execute**
4. **Should show:** `up{instance="ecommerce-app",job="ecommerce-backend"} = 1`

**If you see the metric:** ✅ Prometheus is scraping!

**If you don't see it:**
- Check Prometheus logs: `docker-compose logs prometheus`
- Verify `prometheus/prometheus.yml` configuration

---

## 🔍 Step 4: Verify Grafana Datasource

### Check Datasource Connection

1. **In Grafana:** Go to Configuration → Data Sources
2. **Click on:** Prometheus
3. **Click:** "Test" button
4. **Should show:** ✅ "Data source is working"

**If test fails:**
- Check URL: Should be `http://prometheus:9090`
- Check network: Grafana and Prometheus should be on same Docker network
- Restart Grafana: `docker-compose restart grafana`

---

## 🔍 Step 5: Check Time Range in Dashboard

### Common Issue: Wrong Time Range

**In Grafana Dashboard:**
1. **Look at top-right corner** - Time range selector
2. **Click on it**
3. **Select:** "Last 1 hour" or "Last 5 minutes"
4. **Click:** Apply

**Why this matters:**
- If time range is "Last 6 hours" but app just started, there's no data
- Select a time range that includes when your app was running

---

## 🔍 Step 6: Generate Some Traffic

### Metrics Only Appear After Activity

**If you just started the app:**
- Metrics are created when events happen
- Make some API requests to generate metrics

**Generate traffic:**
```bash
# Health check (creates HTTP metrics)
curl http://localhost:3000/health

# Make a few requests
for i in {1..10}; do
  curl http://localhost:3000/health
  sleep 1
done
```

**Then refresh Grafana dashboard** - You should see data!

---

## 🔍 Step 7: Check Specific Metric Names

### Verify Metric Names Match

**In Grafana:**
1. Go to **Explore** (compass icon on left)
2. Select **Prometheus** datasource
3. Type: `http_requests_total`
4. Click **Run query**

**If you see data:** ✅ Metric exists!

**If you see "No data":**
- Try: `up` (should always work)
- If `up` works but `http_requests_total` doesn't:
  - App might not have received requests yet
  - Make some API calls first

---

## 🔍 Step 8: Check Dashboard Queries

### View Query in Dashboard

1. **In Dashboard:** Click on a panel
2. **Click:** Edit (pencil icon)
3. **Look at:** Query tab
4. **Check:** The PromQL query

**Example query:**
```promql
rate(http_requests_total[5m])
```

**Common issues:**
- Query uses `rate()` but metric hasn't changed → shows 0
- Query uses `[5m]` but no data in last 5 minutes
- Metric name might be wrong

**Try simpler query:**
```promql
# Instead of rate, try:
http_requests_total

# Or:
sum(http_requests_total)
```

---

## 🎯 Quick Fix Checklist

Run through this checklist:

- [ ] **App is running:** `docker-compose ps app`
- [ ] **Metrics endpoint works:** `curl http://localhost:3000/metrics`
- [ ] **Prometheus is running:** `docker-compose ps prometheus`
- [ ] **Prometheus target is UP:** http://localhost:9090/targets
- [ ] **Grafana is running:** `docker-compose ps grafana`
- [ ] **Grafana datasource works:** Configuration → Data Sources → Test
- [ ] **Time range is correct:** Last 1 hour or Last 5 minutes
- [ ] **Made some API requests:** Generate metrics
- [ ] **Refreshed dashboard:** Click refresh button

---

## 🚀 Quick Test Script

Run this to test everything:

```bash
#!/bin/bash

echo "1. Testing app metrics endpoint..."
curl -s http://localhost:3000/metrics | head -20

echo -e "\n2. Generating some traffic..."
for i in {1..5}; do
  curl -s http://localhost:3000/health > /dev/null
  echo "Request $i done"
done

echo -e "\n3. Check Prometheus: http://localhost:9090"
echo "   - Go to Graph tab"
echo "   - Query: up"
echo "   - Should show value = 1"

echo -e "\n4. Check Grafana: http://localhost:3001"
echo "   - Login: admin/admin"
echo "   - Go to Explore → Prometheus"
echo "   - Query: http_requests_total"
echo "   - Should show data"
```

---

## 📊 Expected Metrics

After making requests, you should see:

### HTTP Metrics
- `http_requests_total` - Total HTTP requests
- `http_request_duration_seconds` - Request duration

### System Metrics (always available)
- `app_process_resident_memory_bytes` - Memory usage
- `app_process_cpu_seconds_total` - CPU usage
- `up` - Service availability (should be 1)

### Other Metrics (after activity)
- `auth_login_attempts_total` - After login attempts
- `db_queries_total` - After database queries
- `cache_hits_total` - After cache operations

---

## 🔧 Common Solutions

### Solution 1: Restart Everything

```bash
docker-compose down
docker-compose up -d
# Wait 30 seconds
# Then make some requests
curl http://localhost:3000/health
```

### Solution 2: Check Network

```bash
# Verify services can communicate
docker-compose exec prometheus wget -qO- http://app:3000/metrics | head -5
```

### Solution 3: Check Logs

```bash
# App logs
docker-compose logs app | tail -20

# Prometheus logs
docker-compose logs prometheus | tail -20

# Grafana logs
docker-compose logs grafana | tail -20
```

### Solution 4: Manual Query Test

1. **In Grafana Explore:**
   - Datasource: Prometheus
   - Query: `up`
   - Time range: Last 5 minutes
   - Click Run

2. **If `up` works but other metrics don't:**
   - Make API requests first
   - Wait a few seconds
   - Try query again

---

## 💡 Pro Tips

1. **Always check time range first** - Most common issue!
2. **Generate traffic before checking dashboards** - Metrics need activity
3. **Use Explore tab to test queries** - Easier than fixing dashboards
4. **Start with simple queries** - `up`, `http_requests_total` before `rate()`
5. **Check Prometheus first** - If Prometheus has data, Grafana will too

---

## 🆘 Still Not Working?

If you've tried everything:

1. **Share these details:**
   ```bash
   # Service status
   docker-compose ps
   
   # Metrics output
   curl http://localhost:3000/metrics | head -30
   
   # Prometheus targets
   # (Screenshot of http://localhost:9090/targets)
   ```

2. **Check specific error:**
   - What does Prometheus show? (http://localhost:9090)
   - What does Grafana Explore show?
   - Any errors in logs?

---

**Last Updated:** 2025-11-17  
**For:** New Grafana Users

