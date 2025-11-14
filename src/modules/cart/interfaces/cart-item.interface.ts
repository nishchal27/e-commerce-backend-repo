/**
 * Cart Item Interface
 *
 * This file defines the structure for cart items.
 * Cart items represent products added to a shopping cart.
 */

/**
 * Cart item structure
 */
export interface CartItem {
  /**
   * Product variant SKU ID
   */
  skuId: string;

  /**
   * Product variant SKU (for display)
   */
  sku: string;

  /**
   * Product ID (for reference)
   */
  productId: string;

  /**
   * Product title (for display)
   */
  productTitle: string;

  /**
   * Quantity in cart
   */
  quantity: number;

  /**
   * Unit price at time of adding to cart
   */
  unitPrice: number;

  /**
   * Currency code
   */
  currency: string;

  /**
   * Total price for this item (unitPrice * quantity)
   */
  totalPrice: number;

  /**
   * Optional: Product variant attributes (size, color, etc.)
   */
  attributes?: Record<string, any>;
}

/**
 * Cart structure
 */
export interface Cart {
  /**
   * Cart ID (user ID for authenticated carts, session ID for anonymous carts)
   */
  id: string;

  /**
   * Cart items
   */
  items: CartItem[];

  /**
   * Total cart value (sum of all item totalPrice)
   */
  totalAmount: number;

  /**
   * Currency code
   */
  currency: string;

  /**
   * When cart was created
   */
  createdAt: Date;

  /**
   * When cart was last updated
   */
  updatedAt: Date;

  /**
   * Cart expiration time (TTL)
   */
  expiresAt: Date;
}

