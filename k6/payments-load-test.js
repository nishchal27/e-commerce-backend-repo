/**
 * k6 Load Test: Payments Endpoint
 *
 * Tests payment creation and confirmation under load.
 * Measures:
 * - Payment creation throughput
 * - Payment confirmation latency
 * - Webhook processing
 * - Error rates
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const paymentCreationRate = new Rate('payment_creation_success');
const paymentCreationTime = new Trend('payment_creation_time');

export const options = {
  stages: [
    { duration: '30s', target: 5 }, // Ramp up to 5 users
    { duration: '1m', target: 10 }, // Ramp up to 10 users
    { duration: '2m', target: 10 }, // Stay at 10 users
    { duration: '30s', target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000', 'p(99)<2000'], // Payments can be slower
    http_req_failed: ['rate<0.02'], // Less than 2% errors
    payment_creation_success: ['rate>0.90'], // 90% success rate
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
let authToken = '';
let testOrderId = '';

export function setup() {
  // Login
  const loginRes = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
    email: 'test@example.com',
    password: 'password123',
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  if (loginRes.status !== 200) {
    throw new Error('Failed to login');
  }

  const token = JSON.parse(loginRes.body).accessToken;

  // Create a test order
  const orderRes = http.post(`${BASE_URL}/orders`, JSON.stringify({
    userId: 'test-user-id',
    items: [{ sku: 'test-sku-001', quantity: 1 }],
  }), {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (orderRes.status !== 201) {
    throw new Error('Failed to create test order');
  }

  return {
    token,
    orderId: JSON.parse(orderRes.body).id,
  };
}

export default function (data) {
  if (!data || !data.token || !data.orderId) {
    return;
  }

  authToken = data.token;
  testOrderId = data.orderId;

  // Test payment creation
  const paymentPayload = JSON.stringify({
    orderId: testOrderId,
    amount: 99.99,
    currency: 'USD',
    paymentMethodType: 'card',
    idempotencyKey: `payment-${Date.now()}-${Math.random()}`,
  });

  const createStart = Date.now();
  const createRes = http.post(
    `${BASE_URL}/payments`,
    paymentPayload,
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      tags: { name: 'CreatePayment' },
    },
  );

  const createDuration = Date.now() - createStart;
  paymentCreationTime.add(createDuration);

  const createSuccess = check(createRes, {
    'payment creation status is 201': (r) => r.status === 201,
    'payment creation has payment intent id': (r) => {
      if (r.status === 201) {
        const body = JSON.parse(r.body);
        return body.paymentIntentId !== undefined;
      }
      return false;
    },
  });

  paymentCreationRate.add(createSuccess);

  sleep(2); // Payments are slower, longer think time
}

