/**
 * Test Helpers
 *
 * Common utilities for testing across the application.
 * Provides factories, mocks, and helper functions for tests.
 */

import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

/**
 * Create a mock Prisma service for testing
 */
export function createMockPrismaService() {
  return {
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    order: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    payment: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    product: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    productVariant: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    inventoryReservation: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    outbox: {
      create: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback({})),
    $queryRaw: jest.fn(),
  } as unknown as PrismaClient;
}

/**
 * Create a mock Redis service for testing
 */
export function createMockRedisService() {
  const store = new Map<string, string>();
  return {
    getClient: jest.fn(() => ({
      get: jest.fn((key: string) => Promise.resolve(store.get(key) || null)),
      set: jest.fn((key: string, value: string) => {
        store.set(key, value);
        return Promise.resolve('OK');
      }),
      setex: jest.fn((key: string, seconds: number, value: string) => {
        store.set(key, value);
        return Promise.resolve('OK');
      }),
      del: jest.fn((key: string) => {
        store.delete(key);
        return Promise.resolve(1);
      }),
      ping: jest.fn(() => Promise.resolve('PONG')),
      expire: jest.fn(() => Promise.resolve(1)),
    })),
  };
}

/**
 * Create a mock Logger for testing
 */
export function createMockLogger() {
  return {
    log: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    verbose: jest.fn(),
  };
}

/**
 * Create a mock Prometheus service for testing
 */
export function createMockPrometheusService() {
  return {
    recordHttpRequest: jest.fn(),
    recordOrderCreated: jest.fn(),
    recordPaymentCreated: jest.fn(),
    recordPaymentSucceeded: jest.fn(),
    recordPaymentFailed: jest.fn(),
    recordInventoryReservationAttempt: jest.fn(),
    recordInventoryReservationSuccess: jest.fn(),
    recordInventoryReservationFailure: jest.fn(),
    recordSearchQuery: jest.fn(),
    recordRecommendationQuery: jest.fn(),
  };
}

/**
 * Create a mock Outbox service for testing
 */
export function createMockOutboxService() {
  return {
    createEvent: jest.fn((eventType: string, payload: any) => ({
      event_id: uuidv4(),
      event_type: eventType,
      timestamp: new Date().toISOString(),
      source: 'test-service',
      payload,
    })),
    writeEvent: jest.fn(),
    getUnsentEvents: jest.fn(),
    markAsSent: jest.fn(),
    lockEvents: jest.fn(),
    incrementAttempts: jest.fn(),
  };
}

/**
 * Create test user data
 */
export function createTestUser(overrides?: Partial<any>) {
  return {
    id: uuidv4(),
    email: 'test@example.com',
    password: 'hashedPassword',
    role: 'CUSTOMER',
    emailVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Create test order data
 */
export function createTestOrder(overrides?: Partial<any>) {
  return {
    id: uuidv4(),
    userId: uuidv4(),
    totalAmount: { toNumber: () => 99.99 },
    status: 'CREATED',
    idempotencyKey: uuidv4(),
    createdAt: new Date(),
    updatedAt: new Date(),
    user: createTestUser(),
    ...overrides,
  };
}

/**
 * Create test product data
 */
export function createTestProduct(overrides?: Partial<any>) {
  return {
    id: uuidv4(),
    title: 'Test Product',
    description: 'Test Description',
    price: { toNumber: () => 29.99 },
    stock: 100,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Create test payment data
 */
export function createTestPayment(overrides?: Partial<any>) {
  return {
    id: uuidv4(),
    orderId: uuidv4(),
    paymentIntentId: 'pi_test_123',
    provider: 'stripe',
    amount: { toNumber: () => 99.99 },
    currency: 'USD',
    status: 'PENDING',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Wait for async operations to complete
 */
export async function waitFor(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a mock request with request ID
 */
export function createMockRequest(overrides?: Partial<any>) {
  return {
    requestId: uuidv4(),
    traceId: uuidv4(),
    headers: {},
    body: {},
    params: {},
    query: {},
    ...overrides,
  };
}

