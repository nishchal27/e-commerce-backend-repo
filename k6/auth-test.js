/**
 * k6 Load Test Script for Authentication Endpoints
 *
 * This script performs load testing on authentication endpoints:
 * - POST /auth/login - Login endpoint (tests rate limiting and HMAC performance)
 * - POST /auth/refresh - Token refresh endpoint (tests HMAC performance)
 * - POST /auth/register - Registration endpoint
 *
 * Metrics measured:
 * - Response times (p50, p95, p99)
 * - Request rate (requests per second)
 * - Error rate (including rate limit blocks)
 * - Throughput
 * - Rate limit effectiveness
 *
 * Usage:
 *   k6 run k6/auth-test.js
 *
 * Before running:
 * 1. Start the application: docker-compose up -d app
 * 2. Ensure database is seeded: npm run prisma:seed
 * 3. Ensure Redis is running (for rate limiting)
 *
 * Results are displayed in the console and can be exported to CSV/JSON.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics for tracking
const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');
const rateLimitBlocks = new Counter('rate_limit_blocks');
const loginSuccessRate = new Rate('login_success');
const refreshSuccessRate = new Rate('refresh_success');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 5 }, // Ramp up to 5 users over 30 seconds
    { duration: '1m', target: 5 }, // Stay at 5 users for 1 minute
    { duration: '30s', target: 20 }, // Ramp up to 20 users over 30 seconds
    { duration: '1m', target: 20 }, // Stay at 20 users for 1 minute
    { duration: '30s', target: 0 }, // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'], // 95% of requests should be below 1 second
    http_req_failed: ['rate<0.2'], // Error rate should be less than 20% (includes rate limits)
    errors: ['rate<0.2'], // Custom error rate should be less than 20%
    login_success: ['rate>0.5'], // At least 50% login success (others may be rate limited)
    refresh_success: ['rate>0.8'], // At least 80% refresh success
  },
};

// Base URL for the API
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Test users (from seed data or create dynamically)
// These should match users in your seed data
const TEST_USERS = [
  { email: 'customer@example.com', password: 'password123' },
  { email: 'admin@example.com', password: 'password123' },
];

// Store tokens for refresh tests
let accessTokens = {};
let refreshTokenCookies = {};

/**
 * Test login endpoint
 * Tests: Authentication, rate limiting, HMAC performance
 */
function testLogin(userIndex) {
  const user = TEST_USERS[userIndex % TEST_USERS.length];
  const uniqueEmail = `loadtest-${userIndex}-${Date.now()}@example.com`;

  const payload = JSON.stringify({
    email: uniqueEmail, // Use unique email to avoid conflicts
    password: user.password,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const res = http.post(`${BASE_URL}/auth/login`, payload, params);

  const success = check(res, {
    'login status is 200 or 401': (r) => r.status === 200 || r.status === 401,
    'login response time < 2s': (r) => r.timings.duration < 2000,
  });

  if (res.status === 429) {
    rateLimitBlocks.add(1);
    console.log(`Rate limited: ${res.status} - ${res.body}`);
  }

  if (res.status === 200) {
    loginSuccessRate.add(1);
    const body = JSON.parse(res.body);
    if (body.data && body.data.accessToken) {
      accessTokens[userIndex] = body.data.accessToken;
      
      // Extract refresh token from cookie
      const cookies = res.headers['Set-Cookie'];
      if (cookies) {
        const refreshCookie = cookies.find((cookie) =>
          cookie.startsWith('refreshToken='),
        );
        if (refreshCookie) {
          refreshTokenCookies[userIndex] = refreshCookie.split(';')[0];
        }
      }
    }
  } else {
    loginSuccessRate.add(0);
  }

  errorRate.add(!success);
  responseTime.add(res.timings.duration);

  return res.status === 200;
}

/**
 * Test refresh endpoint
 * Tests: Token refresh, HMAC performance, token rotation
 */
function testRefresh(userIndex) {
  if (!refreshTokenCookies[userIndex]) {
    // No refresh token available, skip
    return false;
  }

  const params = {
    headers: {
      Cookie: refreshTokenCookies[userIndex],
    },
  };

  const res = http.post(`${BASE_URL}/auth/refresh`, null, params);

  const success = check(res, {
    'refresh status is 200': (r) => r.status === 200,
    'refresh response time < 1s': (r) => r.timings.duration < 1000,
    'refresh returns new access token': (r) => {
      if (r.status === 200) {
        const body = JSON.parse(r.body);
        return body.data && body.data.accessToken;
      }
      return false;
    },
  });

  if (res.status === 200) {
    refreshSuccessRate.add(1);
    const body = JSON.parse(res.body);
    if (body.data && body.data.accessToken) {
      // Update access token
      accessTokens[userIndex] = body.data.accessToken;
      
      // Update refresh token cookie (token rotation)
      const cookies = res.headers['Set-Cookie'];
      if (cookies) {
        const refreshCookie = cookies.find((cookie) =>
          cookie.startsWith('refreshToken='),
        );
        if (refreshCookie) {
          refreshTokenCookies[userIndex] = refreshCookie.split(';')[0];
        }
      }
    }
  } else {
    refreshSuccessRate.add(0);
  }

  errorRate.add(!success);
  responseTime.add(res.timings.duration);

  return success;
}

/**
 * Test register endpoint
 * Tests: Registration, rate limiting
 */
function testRegister(userIndex) {
  const uniqueEmail = `register-${userIndex}-${Date.now()}@example.com`;
  const payload = JSON.stringify({
    email: uniqueEmail,
    password: 'password123',
    name: `Load Test User ${userIndex}`,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const res = http.post(`${BASE_URL}/auth/register`, payload, params);

  const success = check(res, {
    'register status is 201 or 409': (r) => r.status === 201 || r.status === 409,
    'register response time < 2s': (r) => r.timings.duration < 2000,
  });

  if (res.status === 429) {
    rateLimitBlocks.add(1);
  }

  errorRate.add(!success);
  responseTime.add(res.timings.duration);

  return res.status === 201;
}

/**
 * Main test function
 * Simulates a user performing authentication operations
 */
export default function () {
  const userIndex = __VU; // Virtual user ID

  // Test 1: Login (may fail due to rate limiting or invalid credentials)
  const loginSuccess = testLogin(userIndex);
  sleep(1);

  // Test 2: If login succeeded, test refresh
  if (loginSuccess) {
    testRefresh(userIndex);
    sleep(1);
    
    // Test refresh again (token rotation)
    testRefresh(userIndex);
    sleep(1);
  }

  // Test 3: Register (may fail due to rate limiting)
  testRegister(userIndex);
  sleep(2);
}

/**
 * Summary function - called after all tests complete
 */
export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'k6-auth-results.json': JSON.stringify(data),
  };
}

function textSummary(data, options) {
  const indent = options.indent || '';
  const enableColors = options.enableColors || false;
  
  let summary = '\n';
  summary += `${indent}Authentication Load Test Results\n`;
  summary += `${indent}================================\n\n`;
  
  // HTTP metrics
  summary += `${indent}HTTP Metrics:\n`;
  summary += `${indent}  Total Requests: ${data.metrics.http_reqs.values.count}\n`;
  summary += `${indent}  Failed Requests: ${data.metrics.http_req_failed.values.rate * 100}%\n`;
  summary += `${indent}  Average Response Time: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms\n`;
  summary += `${indent}  P95 Response Time: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms\n`;
  summary += `${indent}  P99 Response Time: ${data.metrics.http_req_duration.values['p(99)'].toFixed(2)}ms\n\n`;
  
  // Auth-specific metrics
  if (data.metrics.login_success) {
    summary += `${indent}Login Success Rate: ${(data.metrics.login_success.values.rate * 100).toFixed(2)}%\n`;
  }
  if (data.metrics.refresh_success) {
    summary += `${indent}Refresh Success Rate: ${(data.metrics.refresh_success.values.rate * 100).toFixed(2)}%\n`;
  }
  if (data.metrics.rate_limit_blocks) {
    summary += `${indent}Rate Limit Blocks: ${data.metrics.rate_limit_blocks.values.count}\n`;
  }
  
  summary += '\n';
  return summary;
}

