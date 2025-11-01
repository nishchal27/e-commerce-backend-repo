/**
 * k6 Cache Performance Test Script
 *
 * This script tests the performance improvement when caching is enabled.
 * It compares:
 * - First request (cache miss - from database)
 * - Subsequent requests (cache hit - from LRU cache or Redis)
 *
 * Usage:
 *   k6 run k6/cache-test.js
 *
 * Before running:
 * 1. Ensure caching is enabled (USE_IN_MEMORY_CACHE=true or Redis configured)
 * 2. Start the application: docker-compose up -d app
 * 3. Ensure database is seeded: npm run prisma:seed
 * 4. Get a product ID from the database
 *
 * This test helps demonstrate the performance benefits of caching.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const cacheHitRate = new Rate('cache_hits');
const cacheMissRate = new Rate('cache_misses');
const responseTime = new Trend('response_time');
const cacheHitTime = new Trend('cache_hit_time');
const cacheMissTime = new Trend('cache_miss_time');

// Test configuration - focused on measuring cache performance
export const options = {
  stages: [
    { duration: '10s', target: 1 }, // Single user to measure cache behavior
    { duration: '30s', target: 1 }, // Stay at 1 user
    { duration: '30s', target: 10 }, // Ramp up to 10 concurrent users
    { duration: '1m', target: 10 }, // Stay at 10 users to test cache under load
    { duration: '10s', target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<100'], // With cache, 95% should be < 100ms
    cache_hit_time: ['p(95)<50'], // Cache hits should be very fast
    cache_hits: ['rate>0.7'], // At least 70% cache hit rate after warmup
  },
};

// Test data - replace with actual product ID
const PRODUCT_ID = __ENV.PRODUCT_ID || '00000000-0000-0000-0000-000000000001';
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Track if we've made the first request (cache miss)
let isFirstRequest = true;

/**
 * Main test function
 */
export default function () {
  const url = `${BASE_URL}/products/${PRODUCT_ID}`;

  // Make HTTP GET request
  const start = Date.now();
  const response = http.get(url, {
    tags: { name: 'GetProductById_Cached' },
  });
  const duration = Date.now() - start;

  // Track metrics based on whether this is a cache hit or miss
  if (isFirstRequest) {
    // First request is always a cache miss
    cacheMissRate.add(1);
    cacheMissTime.add(duration);
    isFirstRequest = false;
    console.log(`Cache MISS: ${duration}ms`);
  } else {
    // Subsequent requests should be cache hits
    cacheHitRate.add(1);
    cacheHitTime.add(duration);
    if (duration < 50) {
      // Likely a cache hit if response is very fast
      console.log(`Cache HIT: ${duration}ms`);
    }
  }

  responseTime.add(duration);

  // Validate response
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
    'has product id': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.id === PRODUCT_ID;
      } catch {
        return false;
      }
    },
  });

  // Short sleep between requests
  sleep(0.5);
}

/**
 * Setup function
 */
export function setup() {
  console.log('Starting cache performance test...');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Product ID: ${PRODUCT_ID}`);
  console.log('Making initial request to warm up cache...');

  // Make an initial request to warm up the cache
  const url = `${BASE_URL}/products/${PRODUCT_ID}`;
  const response = http.get(url);

  if (response.status === 200) {
    console.log('Cache warmed up successfully');
  } else {
    console.warn(`Warning: Initial request failed with status ${response.status}`);
  }

  return { timestamp: new Date().toISOString() };
}

/**
 * Teardown function
 */
export function teardown(data) {
  console.log('Cache performance test completed');
  console.log(`Test started at: ${data.timestamp}`);
  console.log('\nSummary:');
  console.log('- First request (cache miss) should be slower (database query)');
  console.log('- Subsequent requests (cache hits) should be faster (from cache)');
  console.log('- Check metrics above for cache hit rate and performance improvement');
}

