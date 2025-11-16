/**
 * Test Database Utilities
 *
 * Utilities for setting up and tearing down test databases.
 * Provides helpers for database seeding and cleanup.
 */

import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

/**
 * Seed test database with minimal data
 */
export async function seedTestDatabase(prisma: PrismaClient) {
  // Create test user
  const testUser = await prisma.user.create({
    data: {
      email: 'test@example.com',
      password: 'hashedPassword',
      role: 'CUSTOMER',
      emailVerified: true,
    },
  });

  // Create test product
  const testProduct = await prisma.product.create({
    data: {
      title: 'Test Product',
      description: 'Test Description',
      price: 29.99,
    },
  });

  // Create test variant
  const testVariant = await prisma.productVariant.create({
    data: {
      productId: testProduct.id,
      sku: 'TEST-SKU-001',
      price: 29.99,
      stock: 100,
      attributes: { color: 'red', size: 'M' },
    },
  });

  return {
    user: testUser,
    product: testProduct,
    variant: testVariant,
  };
}

/**
 * Clean up test database
 */
export async function cleanupTestDatabase(prisma: PrismaClient) {
  // Delete in reverse order of dependencies
  await prisma.inventoryReservation.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.productVariant.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.refreshToken.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.outbox.deleteMany({});
  await prisma.experiment.deleteMany({});
}

/**
 * Create a test transaction wrapper
 */
export async function withTestTransaction<T>(
  prisma: PrismaClient,
  callback: (tx: any) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    try {
      const result = await callback(tx);
      // Rollback by throwing an error
      throw new Error('ROLLBACK');
    } catch (error: any) {
      if (error.message === 'ROLLBACK') {
        // Expected rollback, return the result
        return error.result;
      }
      throw error;
    }
  });
}

