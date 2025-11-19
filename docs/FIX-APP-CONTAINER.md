# 🔧 Complete Fix: App Container Issues

## Issues Found

1. ✅ **Fixed:** Missing `@nestjs/swagger` module - Dockerfile updated
2. ⚠️ **Current:** Port 3000 conflict - Local dev server is running

## Step-by-Step Fix

### Step 1: Stop Local Dev Server

**If you have `npm run start:dev` running:**
- Press `Ctrl+C` in that terminal
- Or close the terminal

**Or kill the process:**
```powershell
# Find process using port 3000
netstat -ano | findstr :3000

# Kill it (replace PID with actual number)
taskkill /PID <PID> /F
```

### Step 2: Start Docker Container

```bash
docker-compose up -d app
```

### Step 3: Verify Container is Running

```bash
docker-compose ps app
```

**Should show:** `Up` (not "Created" or "Restarting")

### Step 4: Check Logs

```bash
docker-compose logs app --tail 30
```

**Look for:**
- ✅ "Application is running on: http://localhost:3000"
- ✅ "Swagger documentation: http://localhost:3000/api"
- ❌ No errors about missing modules

### Step 5: Test App

```powershell
# Test health endpoint
Invoke-WebRequest -Uri http://localhost:3000/health -UseBasicParsing

# Test metrics endpoint
Invoke-WebRequest -Uri http://localhost:3000/metrics -UseBasicParsing | Select-Object -First 20
```

### Step 6: Check Prometheus

1. **Wait 30 seconds** after app starts
2. **Open:** http://localhost:9090/targets
3. **Check:** `ecommerce-backend` target
4. **Should show:** ✅ **UP** (green)

**If still DOWN:**
- Wait another 30 seconds (Prometheus scrapes every 15s)
- Check app logs for errors
- Verify app is on the network: `docker network inspect e-commerce-backend_ecommerce-network`

### Step 7: Generate Traffic

```powershell
# Make some requests to generate metrics
Invoke-WebRequest -Uri http://localhost:3000/health -UseBasicParsing
Invoke-WebRequest -Uri http://localhost:3000/api/info -UseBasicParsing
```

### Step 8: Check Grafana

1. **Open:** http://localhost:3001
2. **Go to:** Dashboards → Browse
3. **Select:** HTTP Metrics
4. **Set time range:** Last 5 minutes
5. **Click:** Refresh

**You should now see data!**

---

## Quick Commands

```bash
# Stop everything
docker-compose down

# Rebuild and start
docker-compose up -d --build

# Check status
docker-compose ps

# View logs
docker-compose logs app --tail 50

# Test app
Invoke-WebRequest -Uri http://localhost:3000/health -UseBasicParsing
```

---

## Troubleshooting

### Container Still Restarting

1. **Check logs:**
   ```bash
   docker-compose logs app --tail 100
   ```

2. **Common issues:**
   - Missing dependencies → Rebuild: `docker-compose build app --no-cache`
   - Database connection → Check postgres is running
   - Port conflict → Stop process using port 3000

### Prometheus Still Can't Connect

1. **Verify app is on network:**
   ```bash
   docker network inspect e-commerce-backend_ecommerce-network
   ```
   Should list: `ecommerce-app`

2. **Test from Prometheus container:**
   ```bash
   docker-compose exec prometheus wget -qO- http://app:3000/metrics | head -10
   ```

3. **Check Prometheus config:**
   - File: `prometheus/prometheus.yml`
   - Target should be: `app:3000` (service name, not localhost)

---

**Last Updated:** 2025-11-18

