# 🚀 Grafana Quick Start Guide

> **For beginners** - Get your dashboards showing data in 5 minutes!

---

## ⚡ Quick Fix (Most Common Issue)

**90% of "No data" issues are because:**
1. ❌ No traffic has been generated yet
2. ❌ Time range is wrong

**Quick Fix:**
```bash
# 1. Generate some traffic
curl http://localhost:3000/health
curl http://localhost:3000/api/info

# 2. In Grafana:
#    - Set time range to "Last 5 minutes"
#    - Click refresh button
```

---

## 📋 Step-by-Step Setup

### Step 1: Start All Services

```bash
docker-compose up -d
```

Wait 30 seconds for everything to start.

### Step 2: Generate Traffic

**Metrics only appear after activity!**

```bash
# Make some API requests
for i in {1..10}; do
  curl http://localhost:3000/health
  sleep 0.5
done
```

### Step 3: Open Grafana

1. **Open:** http://localhost:3001
2. **Login:** 
   - Username: `admin`
   - Password: `admin`
3. **Change password:** (optional, click Skip)

### Step 4: Test Datasource

1. **Click:** Configuration (gear icon) → Data Sources
2. **Click:** Prometheus
3. **Click:** "Test" button at bottom
4. **Should see:** ✅ "Data source is working"

**If test fails:**
- Check Prometheus is running: `docker-compose ps prometheus`
- Restart Grafana: `docker-compose restart grafana`

### Step 5: Test Query in Explore

1. **Click:** Explore (compass icon on left)
2. **Select:** Prometheus (top dropdown)
3. **Type query:** `up`
4. **Set time range:** Last 5 minutes (top right)
5. **Click:** Run query (blue button)

**Expected result:**
- Should show: `up{instance="ecommerce-app",job="ecommerce-backend"} = 1`

**If you see this:** ✅ Everything is working!

**If you see "No data":**
- Check time range (try "Last 1 hour")
- Check Prometheus: http://localhost:9090/graph?query=up

### Step 6: View Dashboard

1. **Click:** Dashboards (grid icon) → Browse
2. **Click:** HTTP Metrics (or any dashboard)
3. **Set time range:** Last 5 minutes (top right)
4. **Click:** Refresh (circular arrow icon)

**You should now see data!**

---

## 🎯 Common Issues & Fixes

### Issue 1: "No data" in all panels

**Fix:**
1. Generate traffic first:
   ```bash
   curl http://localhost:3000/health
   ```
2. Set time range to "Last 5 minutes"
3. Wait 10 seconds
4. Refresh dashboard

### Issue 2: "Data source not found"

**Fix:**
1. Go to Configuration → Data Sources
2. Check Prometheus datasource exists
3. Click "Test" - should show ✅
4. If not, check Prometheus is running

### Issue 3: Prometheus shows "DOWN"

**Fix:**
1. Check Prometheus: http://localhost:9090/targets
2. If target is DOWN:
   ```bash
   # Check app is running
   docker-compose ps app
   
   # Check app metrics
   curl http://localhost:3000/metrics
   
   # Restart Prometheus
   docker-compose restart prometheus
   ```

### Issue 4: Dashboard shows 0 or empty

**Fix:**
- This is normal if no requests were made
- Make some API calls first
- Then refresh dashboard

---

## 🔍 Verify Everything Works

### Test Script

Run this to test everything:

```bash
# Run test script
./scripts/test-grafana-setup.sh

# Or manually:
curl http://localhost:3000/metrics | grep http_requests_total
```

### Manual Verification

1. **App metrics:** `curl http://localhost:3000/metrics` → Should show metrics
2. **Prometheus:** http://localhost:9090/graph?query=up → Should show 1
3. **Grafana Explore:** Query `up` → Should show data
4. **Dashboard:** Should show graphs after generating traffic

---

## 📊 What You Should See

### After Making Requests

**HTTP Metrics Dashboard:**
- Request rate graph (should show activity)
- Request duration graph
- Status codes (should show 200s)

**System Overview Dashboard:**
- Total request rate
- Cache hit ratio
- Outbox backlog
- Worker jobs

### If You See This

✅ **Graphs with lines/points** = Working!  
❌ **"No data" message** = Need to generate traffic  
❌ **Empty graphs** = Normal if no activity yet  

---

## 💡 Pro Tips

1. **Always generate traffic first** before checking dashboards
2. **Use "Last 5 minutes"** time range when testing
3. **Check Explore tab first** - easier to debug than dashboards
4. **Start with `up` query** - always works if Prometheus is connected
5. **Wait 10-15 seconds** after making requests before checking

---

## 🆘 Still Having Issues?

1. **Check services are running:**
   ```bash
   docker-compose ps
   ```

2. **Check logs:**
   ```bash
   docker-compose logs app | tail -20
   docker-compose logs prometheus | tail -20
   docker-compose logs grafana | tail -20
   ```

3. **Restart everything:**
   ```bash
   docker-compose down
   docker-compose up -d
   # Wait 30 seconds
   # Generate traffic
   curl http://localhost:3000/health
   ```

4. **Read detailed guide:** `docs/GRAFANA-TROUBLESHOOTING.md`

---

**Remember:** Metrics need activity! Make some API requests first, then check dashboards.

**Last Updated:** 2025-11-17

