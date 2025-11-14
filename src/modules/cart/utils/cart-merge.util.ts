/**
 * Cart Merge Utility
 *
 * This utility provides deterministic cart merging logic.
 * Used when merging anonymous cart into authenticated user cart.
 *
 * Merge Rules (Deterministic):
 * 1. If same SKU exists in both carts:
 *    - Take maximum quantity (user cart takes precedence if equal)
 * 2. If SKU only exists in one cart:
 *    - Keep that item
 * 3. Preserve prices from user cart (if item exists in both)
 * 4. Sort items by SKU for consistency
 *
 * Deterministic: Same inputs always produce same output
 * This is important for testing and consistency.
 */

import { CartItem } from '../interfaces/cart-item.interface';

/**
 * Merge two carts deterministically.
 *
 * @param userCartItems - Items from authenticated user cart
 * @param anonymousCartItems - Items from anonymous cart
 * @returns Merged cart items
 */
export function mergeCartItems(
  userCartItems: CartItem[],
  anonymousCartItems: CartItem[],
): CartItem[] {
  // Create map of user cart items by SKU ID
  const userCartMap = new Map<string, CartItem>();
  userCartItems.forEach((item) => {
    userCartMap.set(item.skuId, item);
  });

  // Create map of anonymous cart items by SKU ID
  const anonymousCartMap = new Map<string, CartItem>();
  anonymousCartItems.forEach((item) => {
    anonymousCartMap.set(item.skuId, item);
  });

  // Get all unique SKU IDs
  const allSkuIds = new Set([
    ...userCartItems.map((item) => item.skuId),
    ...anonymousCartItems.map((item) => item.skuId),
  ]);

  // Merge items
  const mergedItems: CartItem[] = [];

  for (const skuId of allSkuIds) {
    const userItem = userCartMap.get(skuId);
    const anonymousItem = anonymousCartMap.get(skuId);

    if (userItem && anonymousItem) {
      // Both carts have this item: take maximum quantity, prefer user cart price
      const maxQuantity = Math.max(userItem.quantity, anonymousItem.quantity);
      mergedItems.push({
        ...userItem, // Prefer user cart item (price, attributes, etc.)
        quantity: maxQuantity,
        totalPrice: userItem.unitPrice * maxQuantity,
      });
    } else if (userItem) {
      // Only user cart has this item
      mergedItems.push(userItem);
    } else if (anonymousItem) {
      // Only anonymous cart has this item
      mergedItems.push(anonymousItem);
    }
  }

  // Sort by SKU ID for consistency
  mergedItems.sort((a, b) => a.skuId.localeCompare(b.skuId));

  return mergedItems;
}

