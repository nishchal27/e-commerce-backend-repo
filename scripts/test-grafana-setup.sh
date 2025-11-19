#!/bin/bash

# Grafana Setup Test Script
# This script tests if Grafana, Prometheus, and the app are properly connected

echo "🔍 Testing Grafana Setup..."
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Check if app is running
echo "1️⃣  Checking if app is running..."
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ App is running${NC}"
else
    echo -e "${RED}❌ App is NOT running${NC}"
    echo "   Start it with: docker-compose up -d app"
    exit 1
fi

# Test 2: Check metrics endpoint
echo ""
echo "2️⃣  Checking metrics endpoint..."
METRICS=$(curl -s http://localhost:3000/metrics | head -5)
if [ -n "$METRICS" ]; then
    echo -e "${GREEN}✅ Metrics endpoint is working${NC}"
    echo "   Sample output:"
    echo "$METRICS" | head -3
else
    echo -e "${RED}❌ Metrics endpoint is NOT working${NC}"
    exit 1
fi

# Test 3: Generate some traffic
echo ""
echo "3️⃣  Generating traffic to create metrics..."
for i in {1..5}; do
    curl -s http://localhost:3000/health > /dev/null
    curl -s http://localhost:3000/api/info > /dev/null
done
echo -e "${GREEN}✅ Generated 10 requests${NC}"

# Test 4: Check Prometheus
echo ""
echo "4️⃣  Checking Prometheus..."
if curl -s http://localhost:9090/-/healthy > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Prometheus is running${NC}"
    echo "   Check targets at: http://localhost:9090/targets"
else
    echo -e "${RED}❌ Prometheus is NOT running${NC}"
    echo "   Start it with: docker-compose up -d prometheus"
    exit 1
fi

# Test 5: Check if Prometheus can scrape app
echo ""
echo "5️⃣  Checking if Prometheus can scrape app..."
PROM_QUERY=$(curl -s "http://localhost:9090/api/v1/query?query=up" | grep -o '"value":\[[^]]*\]' | head -1)
if [ -n "$PROM_QUERY" ]; then
    echo -e "${GREEN}✅ Prometheus can query metrics${NC}"
    echo "   Query result: $PROM_QUERY"
else
    echo -e "${YELLOW}⚠️  Prometheus might not have data yet${NC}"
    echo "   Wait 30 seconds and check: http://localhost:9090/graph?query=up"
fi

# Test 6: Check Grafana
echo ""
echo "6️⃣  Checking Grafana..."
if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Grafana is running${NC}"
    echo "   Access at: http://localhost:3001"
    echo "   Login: admin / admin"
else
    echo -e "${RED}❌ Grafana is NOT running${NC}"
    echo "   Start it with: docker-compose up -d grafana"
    exit 1
fi

# Test 7: Check specific metric
echo ""
echo "7️⃣  Checking for HTTP metrics..."
HTTP_METRIC=$(curl -s http://localhost:3000/metrics | grep "http_requests_total" | head -1)
if [ -n "$HTTP_METRIC" ]; then
    echo -e "${GREEN}✅ HTTP metrics found${NC}"
    echo "   Sample: $HTTP_METRIC"
else
    echo -e "${YELLOW}⚠️  No HTTP metrics yet (this is OK if app just started)${NC}"
    echo "   Make more requests to generate metrics"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Next Steps:"
echo ""
echo "1. Open Grafana: http://localhost:3001"
echo "2. Login: admin / admin"
echo "3. Go to: Explore → Select Prometheus"
echo "4. Try query: up"
echo "5. If 'up' works, try: http_requests_total"
echo "6. Go to Dashboards → Browse → Select a dashboard"
echo "7. Set time range to: Last 5 minutes"
echo "8. Click refresh"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ Setup test complete!${NC}"

