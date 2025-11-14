/**
 * Cart Controller
 *
 * This controller handles HTTP requests for cart-related endpoints.
 * It validates request data, delegates to the service layer, and returns HTTP responses.
 *
 * Endpoints:
 * - GET /cart - Get cart (protected or anonymous)
 * - POST /cart/items - Add item to cart (protected or anonymous)
 * - PATCH /cart/items/:skuId - Update cart item (protected or anonymous)
 * - DELETE /cart/items/:skuId - Remove item from cart (protected or anonymous)
 * - DELETE /cart - Clear cart (protected or anonymous)
 * - POST /cart/merge - Merge anonymous cart into user cart (protected)
 *
 * Security:
 * - Endpoints support both authenticated and anonymous access
 * - Anonymous carts use session ID from cookie/header
 * - Cart merging requires authentication
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { RequestWithId } from '../../common/middleware/request-id.middleware';
import { Req, Headers, Optional } from '@nestjs/common';

/**
 * CartController handles HTTP requests for cart endpoints
 */
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  /**
   * GET /cart
   * Get cart.
   *
   * Supports both authenticated and anonymous carts.
   * - Authenticated: Uses user ID from JWT
   * - Anonymous: Uses session ID from X-Session-ID header
   *
   * @param user - Optional authenticated user (from JWT)
   * @param req - Request object (for session ID)
   * @returns Cart
   */
  @Get()
  @Public() // Allow anonymous access
  async getCart(
    @Optional() @CurrentUser() user: JwtPayload | undefined,
    @Headers('x-session-id') sessionId: string | undefined,
  ) {
    return this.cartService.getCart(user?.sub, sessionId);
  }

  /**
   * POST /cart/items
   * Add item to cart.
   *
   * @param addToCartDto - Add to cart data
   * @param user - Optional authenticated user
   * @param req - Request object (for session ID and request ID)
   * @returns Updated cart
   */
  @Post('items')
  @Public() // Allow anonymous access
  @HttpCode(HttpStatus.OK)
  async addToCart(
    @Body() addToCartDto: AddToCartDto,
    @Optional() @CurrentUser() user: JwtPayload | undefined,
    @Headers('x-session-id') sessionId: string | undefined,
    @Req() req: RequestWithId,
  ) {
    return this.cartService.addToCart(
      addToCartDto,
      user?.sub,
      sessionId,
      req.requestId,
      req.traceId,
    );
  }

  /**
   * PATCH /cart/items/:skuId
   * Update cart item quantity.
   *
   * @param skuId - Product variant SKU ID
   * @param updateDto - Update data
   * @param user - Optional authenticated user
   * @param req - Request object
   * @returns Updated cart
   */
  @Patch('items/:skuId')
  @Public() // Allow anonymous access
  async updateCartItem(
    @Param('skuId') skuId: string,
    @Body() updateDto: UpdateCartItemDto,
    @Optional() @CurrentUser() user: JwtPayload | undefined,
    @Headers('x-session-id') sessionId: string | undefined,
    @Req() req: RequestWithId,
  ) {
    return this.cartService.updateCartItem(
      skuId,
      updateDto,
      user?.sub,
      sessionId,
      req.requestId,
      req.traceId,
    );
  }

  /**
   * DELETE /cart/items/:skuId
   * Remove item from cart.
   *
   * @param skuId - Product variant SKU ID
   * @param user - Optional authenticated user
   * @param req - Request object
   * @returns Updated cart
   */
  @Delete('items/:skuId')
  @Public() // Allow anonymous access
  async removeFromCart(
    @Param('skuId') skuId: string,
    @Optional() @CurrentUser() user: JwtPayload | undefined,
    @Headers('x-session-id') sessionId: string | undefined,
  ) {
    return this.cartService.removeFromCart(skuId, user?.sub, sessionId);
  }

  /**
   * DELETE /cart
   * Clear cart.
   *
   * @param user - Optional authenticated user
   * @param req - Request object
   */
  @Delete()
  @Public() // Allow anonymous access
  @HttpCode(HttpStatus.NO_CONTENT)
  async clearCart(
    @Optional() @CurrentUser() user: JwtPayload | undefined,
    @Headers('x-session-id') sessionId: string | undefined,
  ) {
    await this.cartService.clearCart(user?.sub, sessionId);
  }

  /**
   * POST /cart/merge
   * Merge anonymous cart into user cart.
   *
   * This endpoint:
   * - Requires authentication
   * - Merges anonymous cart (from session) into user cart
   * - Uses deterministic merge rules
   * - Deletes anonymous cart after merge
   *
   * @param user - Authenticated user (required)
   * @param req - Request object (for session ID)
   * @returns Merged cart
   */
  @Post('merge')
  @UseGuards(JwtAuthGuard) // Requires authentication
  async mergeCart(
    @CurrentUser() user: JwtPayload,
    @Headers('x-session-id') sessionId: string | undefined,
    @Req() req: RequestWithId,
  ) {
    if (!sessionId) {
      throw new Error('Session ID required for cart merge');
    }

    return this.cartService.mergeCart(
      user.sub,
      sessionId,
      req.requestId,
      req.traceId,
    );
  }
}

