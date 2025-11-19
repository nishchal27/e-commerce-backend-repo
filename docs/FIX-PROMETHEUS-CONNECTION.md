# 🔧 Fix: Prometheus "No such host" Error

## Problem

Prometheus shows error:
```
Error scraping target: Get "http://app:3000/metrics": dial tcp: lookup app on 127.0.0.11:53: no such host
```

## Root Cause

The app container (`ecommerce-app`) is **restarting** due to Prisma Client binary mismatch, so it never fully starts. When Prometheus tries to scrape it, the container isn't running properly.

## Solution

### Step 1: Rebuild the App Container

The Prisma Client needs to be regenerated with the correct binary target:

```bash
# Stop the app
docker-compose stop app

# Rebuild with fresh Prisma Client
docker-compose build app

# Start the app
docker-compose up -d app

# Check logs to verify it started
docker-compose logs app --tail 50
```

### Step 2: Verify App is Running

```bash
# Check container status
docker-compose ps app

# Should show: "Up" (not "Restarting")
```

### Step 3: Verify App is on Network

```bash
# Check if app is on the network
docker network inspect e-commerce-backend_ecommerce-network

# Should list: ecommerce-app
```

### Step 4: Test Metrics Endpoint

```bash
# From host
curl http://localhost:3000/metrics

# From Prometheus container
docker-compose exec prometheus wget -qO- http://app:3000/metrics | head -10
```

### Step 5: Check Prometheus Targets

1. Open: http://localhost:9090/targets
2. Target should show: ✅ **UP** (green)
3. If still DOWN, wait 30 seconds and refresh

## Alternative: Quick Fix

If rebuild takes too long, you can restart everything:

```bash
# Stop all
docker-compose down

# Rebuild and start
docker-compose up -d --build

# Wait 1 minute for everything to start
# Then check
docker-compose ps
```

## Verification

After fixing, you should see:

1. **App container:** `Up` (not Restarting)
2. **Prometheus target:** `UP` (green) at http://localhost:9090/targets
3. **Metrics available:** `curl http://localhost:3000/metrics` shows data
4. **Grafana dashboards:** Show data after generating traffic

## Generate Traffic

After app is running:

```bash
# Make some requests
curl http://localhost:3000/health
curl http://localhost:3000/api/info

# Then check Grafana dashboards
```

---

**Last Updated:** 2025-11-18

