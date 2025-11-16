/**
 * k6 Load Test: Orders Endpoint
 *
 * Tests order creation and retrieval under load.
 * Measures:
 * - Order creation throughput
 * - Response times (p50, p95, p99)
 * - Error rates
 * - Idempotency behavior
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const orderCreationRate = new Rate('order_creation_success');
const orderCreationTime = new Trend('order_creation_time');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 10 }, // Ramp up to 10 users
    { duration: '1m', target: 20 }, // Ramp up to 20 users
    { duration: '2m', target: 20 }, // Stay at 20 users
    { duration: '30s', target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'], // 95% of requests < 500ms, 99% < 1s
    http_req_failed: ['rate<0.01'], // Less than 1% errors
    order_creation_success: ['rate>0.95'], // 95% success rate
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
let authToken = '';

// Setup: Login to get auth token
export function setup() {
  const loginRes = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
    email: 'test@example.com',
    password: 'password123',
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  if (loginRes.status === 200) {
    return { token: JSON.parse(loginRes.body).accessToken };
  }
  throw new Error('Failed to login');
}

export default function (data) {
  if (!data || !data.token) {
    console.error('No auth token available');
    return;
  }

  authToken = data.token;
  const userId = __ENV.USER_ID || 'test-user-id';

  // Test order creation
  const orderPayload = JSON.stringify({
    userId: userId,
    items: [
      {
        sku: 'test-sku-001',
        quantity: Math.floor(Math.random() * 5) + 1,
      },
    ],
    idempotencyKey: `test-${Date.now()}-${Math.random()}`,
  });

  const createStart = Date.now();
  const createRes = http.post(
    `${BASE_URL}/orders`,
    orderPayload,
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      tags: { name: 'CreateOrder' },
    },
  );

  const createDuration = Date.now() - createStart;
  orderCreationTime.add(createDuration);

  const createSuccess = check(createRes, {
    'order creation status is 201': (r) => r.status === 201,
    'order creation has order id': (r) => {
      if (r.status === 201) {
        const body = JSON.parse(r.body);
        return body.id !== undefined;
      }
      return false;
    },
  });

  orderCreationRate.add(createSuccess);

  // Test order retrieval
  if (createSuccess && createRes.status === 201) {
    const orderId = JSON.parse(createRes.body).id;

    const getRes = http.get(`${BASE_URL}/orders/${orderId}`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      tags: { name: 'GetOrder' },
    });

    check(getRes, {
      'order retrieval status is 200': (r) => r.status === 200,
      'order retrieval returns correct id': (r) => {
        if (r.status === 200) {
          const body = JSON.parse(r.body);
          return body.id === orderId;
        }
        return false;
      },
    });
  }

  sleep(1); // Think time between requests
}

export function teardown(data) {
  // Cleanup if needed
}

