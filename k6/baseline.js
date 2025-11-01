/**
 * k6 Baseline Load Test Script
 *
 * This script performs baseline load testing on the GET /products/:id endpoint
 * WITHOUT caching enabled. It measures:
 * - Response times (p50, p95, p99)
 * - Request rate (requests per second)
 * - Error rate
 * - Throughput
 *
 * Usage:
 *   k6 run k6/baseline.js
 *
 * Before running:
 * 1. Start the application: docker-compose up -d app
 * 2. Ensure database is seeded: npm run prisma:seed
 * 3. Get a product ID from the database or create one
 *
 * Results are displayed in the console and can be exported to CSV/JSON.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics for tracking
const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 10 }, // Ramp up to 10 users over 30 seconds
    { duration: '1m', target: 10 }, // Stay at 10 users for 1 minute
    { duration: '30s', target: 50 }, // Ramp up to 50 users over 30 seconds
    { duration: '1m', target: 50 }, // Stay at 50 users for 1 minute
    { duration: '30s', target: 0 }, // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests should be below 500ms
    http_req_failed: ['rate<0.1'], // Error rate should be less than 10%
    errors: ['rate<0.1'], // Custom error rate should be less than 10%
  },
};

// Test data - replace with actual product IDs from your database
// You can get product IDs by running: docker-compose exec app npm run prisma:studio
const PRODUCT_IDS = [
  '00000000-0000-0000-0000-000000000001', // Replace with actual product IDs
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000003',
];

// Base URL for the API
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

/**
 * Main test function - executed by each virtual user
 */
export default function () {
  // Select a random product ID
  const productId =
    PRODUCT_IDS[Math.floor(Math.random() * PRODUCT_IDS.length)] ||
    '00000000-0000-0000-0000-000000000001';

  const url = `${BASE_URL}/products/${productId}`;

  // Make HTTP GET request
  const start = Date.now();
  const response = http.get(url, {
    tags: { name: 'GetProductById' },
  });
  const duration = Date.now() - start;

  // Track metrics
  responseTime.add(duration);
  errorRate.add(response.status !== 200);

  // Validate response
  const success = check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
    'has product id': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.id === productId;
      } catch {
        return false;
      }
    },
  });

  if (!success) {
    console.log(`Request failed: ${response.status} - ${response.body.substring(0, 100)}`);
  }

  // Wait between requests (simulate user think time)
  sleep(1);
}

/**
 * Setup function - runs once before the test
 * Can be used to create test data or warm up the cache
 */
export function setup() {
  console.log('Starting baseline load test...');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Product IDs: ${PRODUCT_IDS.join(', ')}`);

  // Optionally: Create test products or verify they exist
  return { timestamp: new Date().toISOString() };
}

/**
 * Teardown function - runs once after the test
 * Can be used to clean up test data or generate reports
 */
export function teardown(data) {
  console.log('Baseline load test completed');
  console.log(`Test started at: ${data.timestamp}`);
}

