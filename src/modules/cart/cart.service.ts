/**
 * Cart Service
 *
 * This service contains the business logic for cart operations.
 * It manages shopping carts using Redis for fast access and TTL expiration.
 *
 * Responsibilities:
 * - Cart management (add, update, remove items)
 * - Cart merging (anonymous → authenticated user)
 * - Price calculation
 * - Cart expiration (TTL)
 * - Integration with Products module (for product details)
 *
 * Key Features:
 * - Redis-backed cart storage (fast, scalable)
 * - TTL expiration (automatic cleanup)
 * - Deterministic cart merging
 * - Price snapshot (prices locked at add-to-cart time)
 *
 * Cart Storage:
 * - Redis key format: `cart:{cartId}`
 * - TTL: 7 days (configurable)
 * - JSON serialization for cart data
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../lib/prisma/prisma.service';
import { RedisService } from '../../lib/redis/redis.service';
import { OutboxService } from '../../common/events/outbox.service';
import { Cart, CartItem } from './interfaces/cart-item.interface';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { mergeCartItems } from './utils/cart-merge.util';
import { ConfigService } from '@nestjs/config';
import { Logger } from '../../lib/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * CartService handles business logic for cart operations
 */
@Injectable()
export class CartService {
  private readonly cartTtlSeconds: number;
  private readonly redisKeyPrefix = 'cart:';

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly outboxService: OutboxService,
    private readonly configService: ConfigService,
    private readonly logger: Logger,
  ) {
    // Get cart TTL from configuration (default: 7 days)
    this.cartTtlSeconds = this.configService.get<number>('CART_TTL_SECONDS', 604800); // 7 days
  }

  /**
   * Get cart ID for a user or session.
   *
   * @param userId - User ID (if authenticated)
   * @param sessionId - Session ID (if anonymous)
   * @returns Cart ID
   */
  private getCartId(userId?: string, sessionId?: string): string {
    if (userId) {
      return `user:${userId}`;
    }
    if (sessionId) {
      return `session:${sessionId}`;
    }
    // Generate session ID if neither provided
    return `session:${uuidv4()}`;
  }

  /**
   * Get Redis key for cart.
   *
   * @param cartId - Cart ID
   * @returns Redis key
   */
  private getCartKey(cartId: string): string {
    return `${this.redisKeyPrefix}${cartId}`;
  }

  /**
   * Get cart from Redis.
   *
   * @param cartId - Cart ID
   * @returns Cart or null if not found
   */
  private async getCartFromRedis(cartId: string): Promise<Cart | null> {
    const redisClient = this.redisService.getClient();
    if (!redisClient) {
      throw new Error('Redis client not available');
    }

    const cartKey = this.getCartKey(cartId);
    const cartData = await redisClient.get(cartKey);

    if (!cartData) {
      return null;
    }

    return JSON.parse(cartData) as Cart;
  }

  /**
   * Save cart to Redis.
   *
   * @param cart - Cart to save
   */
  private async saveCartToRedis(cart: Cart): Promise<void> {
    const redisClient = this.redisService.getClient();
    if (!redisClient) {
      throw new Error('Redis client not available');
    }

    const cartKey = this.getCartKey(cart.id);
    const cartData = JSON.stringify(cart);

    // Save with TTL
    await redisClient.setex(cartKey, this.cartTtlSeconds, cartData);
  }

  /**
   * Calculate cart total.
   *
   * @param items - Cart items
   * @returns Total amount
   */
  private calculateTotal(items: CartItem[]): number {
    return items.reduce((sum, item) => sum + item.totalPrice, 0);
  }

  /**
   * Get or create cart.
   *
   * @param userId - Optional user ID
   * @param sessionId - Optional session ID
   * @returns Cart
   */
  async getCart(userId?: string, sessionId?: string): Promise<Cart> {
    const cartId = this.getCartId(userId, sessionId);

    // Try to get existing cart
    let cart = await this.getCartFromRedis(cartId);

    if (!cart) {
      // Create new cart
      const now = new Date();
      cart = {
        id: cartId,
        items: [],
        totalAmount: 0,
        currency: 'USD',
        createdAt: now,
        updatedAt: now,
        expiresAt: new Date(now.getTime() + this.cartTtlSeconds * 1000),
      };

      await this.saveCartToRedis(cart);
    }

    return cart;
  }

  /**
   * Add item to cart.
   *
   * This method:
   * 1. Gets or creates cart
   * 2. Fetches product variant details
   * 3. Adds or updates item in cart
   * 4. Recalculates cart total
   * 5. Saves cart to Redis
   * 6. Emits cart.updated event
   *
   * @param addToCartDto - Add to cart data
   * @param userId - Optional user ID
   * @param sessionId - Optional session ID
   * @param requestId - Optional request ID for event correlation
   * @param traceId - Optional trace ID for distributed tracing
   * @returns Updated cart
   */
  async addToCart(
    addToCartDto: AddToCartDto,
    userId?: string,
    sessionId?: string,
    requestId?: string,
    traceId?: string,
  ): Promise<Cart> {
    const { skuId, quantity } = addToCartDto;

    // Get product variant details
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: skuId },
      include: {
        product: true,
      },
    });

    if (!variant) {
      throw new NotFoundException(`Product variant with SKU ID ${skuId} not found`);
    }

    // Check stock availability
    if (variant.stock < quantity) {
      throw new BadRequestException(
        `Insufficient stock: requested ${quantity}, available ${variant.stock}`,
      );
    }

    // Get or create cart
    const cart = await this.getCart(userId, sessionId);

    // Check if item already exists in cart
    const existingItemIndex = cart.items.findIndex((item) => item.skuId === skuId);

    if (existingItemIndex >= 0) {
      // Update existing item quantity
      const existingItem = cart.items[existingItemIndex];
      cart.items[existingItemIndex] = {
        ...existingItem,
        quantity: existingItem.quantity + quantity,
        totalPrice: existingItem.unitPrice * (existingItem.quantity + quantity),
      };
    } else {
      // Add new item
      const unitPrice = Number(variant.price);
      const newItem: CartItem = {
        skuId: variant.id,
        sku: variant.sku,
        productId: variant.productId,
        productTitle: variant.product.title,
        quantity,
        unitPrice,
        currency: variant.currency,
        totalPrice: unitPrice * quantity,
        attributes: variant.attributes as Record<string, any> | undefined,
      };

      cart.items.push(newItem);
    }

    // Recalculate total
    cart.totalAmount = this.calculateTotal(cart.items);
    cart.updatedAt = new Date();

    // Save cart
    await this.saveCartToRedis(cart);

    // Emit cart.updated event
    await this.outboxService.writeEvent({
      topic: 'cart.updated',
      event: this.outboxService.createEvent(
        'cart.updated.v1',
        {
          cart_id: cart.id,
          user_id: userId,
          session_id: sessionId,
          item_count: cart.items.length,
          total_amount: cart.totalAmount,
        },
        {
          trace_id: traceId,
          request_id: requestId,
        },
      ),
    });

    this.logger.debug(
      `Item added to cart: ${skuId}, quantity ${quantity} (cart: ${cart.id})`,
      'CartService',
    );

    return cart;
  }

  /**
   * Update cart item quantity.
   *
   * @param skuId - Product variant SKU ID
   * @param updateDto - Update data
   * @param userId - Optional user ID
   * @param sessionId - Optional session ID
   * @param requestId - Optional request ID
   * @param traceId - Optional trace ID
   * @returns Updated cart
   */
  async updateCartItem(
    skuId: string,
    updateDto: UpdateCartItemDto,
    userId?: string,
    sessionId?: string,
    requestId?: string,
    traceId?: string,
  ): Promise<Cart> {
    const { quantity } = updateDto;

    // Get cart
    const cart = await this.getCart(userId, sessionId);

    // Find item
    const itemIndex = cart.items.findIndex((item) => item.skuId === skuId);

    if (itemIndex < 0) {
      throw new NotFoundException(`Item with SKU ID ${skuId} not found in cart`);
    }

    if (quantity === 0) {
      // Remove item
      cart.items.splice(itemIndex, 1);
    } else {
      // Update quantity
      const item = cart.items[itemIndex];
      cart.items[itemIndex] = {
        ...item,
        quantity,
        totalPrice: item.unitPrice * quantity,
      };
    }

    // Recalculate total
    cart.totalAmount = this.calculateTotal(cart.items);
    cart.updatedAt = new Date();

    // Save cart
    await this.saveCartToRedis(cart);

    // Emit event
    await this.outboxService.writeEvent({
      topic: 'cart.updated',
      event: this.outboxService.createEvent(
        'cart.updated.v1',
        {
          cart_id: cart.id,
          user_id: userId,
          session_id: sessionId,
          item_count: cart.items.length,
          total_amount: cart.totalAmount,
        },
        {
          trace_id: traceId,
          request_id: requestId,
        },
      ),
    });

    return cart;
  }

  /**
   * Remove item from cart.
   *
   * @param skuId - Product variant SKU ID
   * @param userId - Optional user ID
   * @param sessionId - Optional session ID
   * @returns Updated cart
   */
  async removeFromCart(
    skuId: string,
    userId?: string,
    sessionId?: string,
  ): Promise<Cart> {
    return this.updateCartItem(skuId, { quantity: 0 }, userId, sessionId);
  }

  /**
   * Clear cart.
   *
   * @param userId - Optional user ID
   * @param sessionId - Optional session ID
   */
  async clearCart(userId?: string, sessionId?: string): Promise<void> {
    const cartId = this.getCartId(userId, sessionId);
    const redisClient = this.redisService.getClient();

    if (redisClient) {
      const cartKey = this.getCartKey(cartId);
      await redisClient.del(cartKey);
    }

    this.logger.debug(`Cart cleared: ${cartId}`, 'CartService');
  }

  /**
   * Merge anonymous cart into user cart.
   *
   * This method:
   * 1. Gets user cart
   * 2. Gets anonymous cart
   * 3. Merges carts deterministically
   * 4. Saves merged cart
   * 5. Deletes anonymous cart
   *
   * @param userId - User ID
   * @param sessionId - Anonymous session ID
   * @param requestId - Optional request ID
   * @param traceId - Optional trace ID
   * @returns Merged cart
   */
  async mergeCart(
    userId: string,
    sessionId: string,
    requestId?: string,
    traceId?: string,
  ): Promise<Cart> {
    // Get both carts
    const userCart = await this.getCart(userId);
    const anonymousCart = await this.getCart(undefined, sessionId);

    // Merge items deterministically
    const mergedItems = mergeCartItems(userCart.items, anonymousCart.items);

    // Update user cart
    userCart.items = mergedItems;
    userCart.totalAmount = this.calculateTotal(mergedItems);
    userCart.updatedAt = new Date();

    // Save merged cart
    await this.saveCartToRedis(userCart);

    // Delete anonymous cart
    await this.clearCart(undefined, sessionId);

    // Emit cart.merged event
    await this.outboxService.writeEvent({
      topic: 'cart.merged',
      event: this.outboxService.createEvent(
        'cart.merged.v1',
        {
          user_id: userId,
          session_id: sessionId,
          user_cart_items: userCart.items.length,
          anonymous_cart_items: anonymousCart.items.length,
          merged_items: mergedItems.length,
          total_amount: userCart.totalAmount,
        },
        {
          trace_id: traceId,
          request_id: requestId,
        },
      ),
    });

    this.logger.log(
      `Cart merged: user ${userId}, session ${sessionId} (${anonymousCart.items.length} items merged)`,
      'CartService',
    );

    return userCart;
  }
}

