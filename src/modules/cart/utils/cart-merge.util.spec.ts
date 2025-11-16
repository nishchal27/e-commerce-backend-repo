/**
 * Property-Based Tests for Cart Merge Logic
 *
 * Uses fast-check to test cart merge logic with random inputs.
 * Ensures merge is deterministic and handles edge cases.
 */

import * as fc from 'fast-check';
import { mergeCarts, calculateCartTotals } from './cart-merge.util';
import { Cart, CartItem } from '../interfaces/cart-item.interface';

describe('Cart Merge Utilities (Property-Based)', () => {
  describe('calculateCartTotals', () => {
    it('should calculate totals correctly for any cart items', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              skuId: fc.string(),
              productId: fc.string(),
              name: fc.string(),
              price: fc.float({ min: 0, max: 1000 }),
              quantity: fc.integer({ min: 1, max: 100 }),
              addedAt: fc.date(),
            }),
            { maxLength: 50 },
          ),
          (items: CartItem[]) => {
            const { totalQuantity, totalAmount } = calculateCartTotals(items);

            const expectedQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
            const expectedAmount = items.reduce(
              (sum, item) => sum + item.price * item.quantity,
              0,
            );

            return (
              totalQuantity === expectedQuantity &&
              Math.abs(totalAmount - expectedAmount) < 0.01 // Floating point tolerance
            );
          },
        ),
      );
    });
  });

  describe('mergeCarts', () => {
    it('should be deterministic (same inputs produce same output)', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              skuId: fc.string(),
              productId: fc.string(),
              name: fc.string(),
              price: fc.float({ min: 0, max: 100 }),
              quantity: fc.integer({ min: 1, max: 10 }),
              addedAt: fc.date(),
            }),
            { maxLength: 10 },
          ),
          fc.array(
            fc.record({
              skuId: fc.string(),
              productId: fc.string(),
              name: fc.string(),
              price: fc.float({ min: 0, max: 100 }),
              quantity: fc.integer({ min: 1, max: 10 }),
              addedAt: fc.date(),
            }),
            { maxLength: 10 },
          ),
          (userItems: CartItem[], anonItems: CartItem[]) => {
            const userCart: Cart = {
              id: 'user-cart',
              userId: 'user-1',
              items: userItems,
              totalQuantity: 0,
              totalAmount: 0,
              createdAt: new Date(),
              updatedAt: new Date(),
              expiresAt: new Date(),
            };

            const anonCart: Cart = {
              id: 'anon-cart',
              sessionId: 'session-1',
              items: anonItems,
              totalQuantity: 0,
              totalAmount: 0,
              createdAt: new Date(),
              updatedAt: new Date(),
              expiresAt: new Date(),
            };

            const result1 = mergeCarts(userCart, anonCart);
            const result2 = mergeCarts(userCart, anonCart);

            // Results should be identical
            return (
              result1.items.length === result2.items.length &&
              result1.totalQuantity === result2.totalQuantity &&
              Math.abs(result1.totalAmount - result2.totalAmount) < 0.01
            );
          },
        ),
      );
    });

    it('should preserve all items from both carts', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              skuId: fc.string({ minLength: 1 }),
              productId: fc.string(),
              name: fc.string(),
              price: fc.float({ min: 0 }),
              quantity: fc.integer({ min: 1 }),
              addedAt: fc.date(),
            }),
            { maxLength: 5 },
          ),
          fc.array(
            fc.record({
              skuId: fc.string({ minLength: 1 }),
              productId: fc.string(),
              name: fc.string(),
              price: fc.float({ min: 0 }),
              quantity: fc.integer({ min: 1 }),
              addedAt: fc.date(),
            }),
            { maxLength: 5 },
          ),
          (userItems: CartItem[], anonItems: CartItem[]) => {
            const userCart: Cart = {
              id: 'user-cart',
              userId: 'user-1',
              items: userItems,
              totalQuantity: 0,
              totalAmount: 0,
              createdAt: new Date(),
              updatedAt: new Date(),
              expiresAt: new Date(),
            };

            const anonCart: Cart = {
              id: 'anon-cart',
              sessionId: 'session-1',
              items: anonItems,
              totalQuantity: 0,
              totalAmount: 0,
              createdAt: new Date(),
              updatedAt: new Date(),
              expiresAt: new Date(),
            };

            const merged = mergeCarts(userCart, anonCart);

            // All unique SKUs should be present
            const allSkus = new Set([
              ...userItems.map((i) => i.skuId),
              ...anonItems.map((i) => i.skuId),
            ]);

            const mergedSkus = new Set(merged.items.map((i) => i.skuId));

            return allSkus.size === mergedSkus.size;
          },
        ),
      );
    });

    it('should combine quantities for duplicate SKUs', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }),
          fc.integer({ min: 1, max: 10 }),
          fc.integer({ min: 1, max: 10 }),
          (skuId, userQty, anonQty) => {
            const userCart: Cart = {
              id: 'user-cart',
              userId: 'user-1',
              items: [
                {
                  skuId,
                  productId: 'prod-1',
                  name: 'Product',
                  price: 10,
                  quantity: userQty,
                  addedAt: new Date(),
                },
              ],
              totalQuantity: 0,
              totalAmount: 0,
              createdAt: new Date(),
              updatedAt: new Date(),
              expiresAt: new Date(),
            };

            const anonCart: Cart = {
              id: 'anon-cart',
              sessionId: 'session-1',
              items: [
                {
                  skuId,
                  productId: 'prod-1',
                  name: 'Product',
                  price: 10,
                  quantity: anonQty,
                  addedAt: new Date(),
                },
              ],
              totalQuantity: 0,
              totalAmount: 0,
              createdAt: new Date(),
              updatedAt: new Date(),
              expiresAt: new Date(),
            };

            const merged = mergeCarts(userCart, anonCart);

            const mergedItem = merged.items.find((i) => i.skuId === skuId);

            return mergedItem !== undefined && mergedItem.quantity === userQty + anonQty;
          },
        ),
      );
    });
  });
});

