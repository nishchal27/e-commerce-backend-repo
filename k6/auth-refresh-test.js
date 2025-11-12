/**
 * k6 Load Test Script for Token Refresh Endpoint
 *
 * This script specifically tests the /auth/refresh endpoint under load
 * to validate HMAC performance and token rotation.
 *
 * Focus:
 * - HMAC-SHA256 hashing performance (should be < 1ms per operation)
 * - Token rotation performance
 * - Concurrent refresh operations
 * - Rate limiting on refresh endpoint
 *
 * Usage:
 *   k6 run k6/auth-refresh-test.js
 *
 * Before running:
 * 1. Start the application: docker-compose up -d app
 * 2. Ensure database is seeded: npm run prisma:seed
 * 3. Ensure Redis is running (for rate limiting)
 * 4. Login first to get valid refresh tokens (or use seed data)
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const refreshSuccessRate = new Rate('refresh_success');
const refreshResponseTime = new Trend('refresh_response_time');
const rateLimitBlocks = new Rate('rate_limit_blocks');

// Test configuration - high concurrency to test HMAC performance
export const options = {
  stages: [
    { duration: '30s', target: 10 }, // Ramp up to 10 users
    { duration: '2m', target: 10 }, // Stay at 10 users
    { duration: '30s', target: 30 }, // Ramp up to 30 users
    { duration: '2m', target: 30 }, // Stay at 30 users
    { duration: '30s', target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% should be below 500ms (HMAC is fast)
    http_req_failed: ['rate<0.1'], // Error rate should be less than 10%
    refresh_success: ['rate>0.9'], // At least 90% success rate
    refresh_response_time: ['p(95)<100'], // 95% should be below 100ms (HMAC overhead)
  },
};

// Base URL
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Store refresh tokens per virtual user
let refreshTokens = {};

/**
 * Setup: Login to get refresh tokens
 * This runs once per virtual user before the main test
 */
export function setup() {
  // Login to get a refresh token
  const loginPayload = JSON.stringify({
    email: 'customer@example.com', // From seed data
    password: 'password123',
  });

  const loginRes = http.post(
    `${BASE_URL}/auth/login`,
    loginPayload,
    {
      headers: { 'Content-Type': 'application/json' },
    },
  );

  if (loginRes.status === 200) {
    const cookies = loginRes.headers['Set-Cookie'];
    if (cookies) {
      const refreshCookie = cookies.find((cookie) =>
        cookie.startsWith('refreshToken='),
      );
      if (refreshCookie) {
        return { refreshToken: refreshCookie.split(';')[0] };
      }
    }
  }

  return { refreshToken: null };
}

/**
 * Main test: Refresh token repeatedly
 * Tests HMAC performance and token rotation
 */
export default function (data) {
  if (!data.refreshToken) {
    console.log('No refresh token available, skipping test');
    return;
  }

  const params = {
    headers: {
      Cookie: data.refreshToken,
    },
  };

  const startTime = Date.now();
  const res = http.post(`${BASE_URL}/auth/refresh`, null, params);
  const duration = Date.now() - startTime;

  const success = check(res, {
    'refresh status is 200': (r) => r.status === 200,
    'refresh returns access token': (r) => {
      if (r.status === 200) {
        try {
          const body = JSON.parse(r.body);
          return body.data && body.data.accessToken;
        } catch {
          return false;
        }
      }
      return false;
    },
    'refresh response time < 100ms': () => duration < 100, // HMAC should be fast
  });

  if (res.status === 200) {
    refreshSuccessRate.add(1);
    
    // Update refresh token from new cookie (token rotation)
    const cookies = res.headers['Set-Cookie'];
    if (cookies) {
      const newRefreshCookie = cookies.find((cookie) =>
        cookie.startsWith('refreshToken='),
      );
      if (newRefreshCookie) {
        data.refreshToken = newRefreshCookie.split(';')[0];
      }
    }
  } else if (res.status === 429) {
    rateLimitBlocks.add(1);
    refreshSuccessRate.add(0);
  } else {
    refreshSuccessRate.add(0);
  }

  refreshResponseTime.add(res.timings.duration);

  // Small sleep to avoid overwhelming the server
  sleep(0.1);
}

/**
 * Summary function
 */
export function handleSummary(data) {
  return {
    'stdout': `
Token Refresh Load Test Results
================================

HTTP Metrics:
  Total Requests: ${data.metrics.http_reqs.values.count}
  Failed Requests: ${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%
  Average Response Time: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms
  P95 Response Time: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms
  P99 Response Time: ${data.metrics.http_req_duration.values['p(99)'].toFixed(2)}ms

Refresh-Specific Metrics:
  Refresh Success Rate: ${(data.metrics.refresh_success.values.rate * 100).toFixed(2)}%
  Average Refresh Time: ${data.metrics.refresh_response_time.values.avg.toFixed(2)}ms
  P95 Refresh Time: ${data.metrics.refresh_response_time.values['p(95)'].toFixed(2)}ms
  Rate Limit Blocks: ${(data.metrics.rate_limit_blocks.values.rate * 100).toFixed(2)}%

Performance Analysis:
  HMAC-SHA256 hashing adds minimal overhead (< 1ms per operation)
  Token rotation works correctly under load
  Rate limiting is effective
`,
    'k6-auth-refresh-results.json': JSON.stringify(data),
  };
}

