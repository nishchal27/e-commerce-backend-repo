/**
 * Orders Controller
 *
 * This controller handles HTTP requests for order-related endpoints.
 * It validates request data, delegates to the service layer, and returns HTTP responses.
 *
 * Endpoints:
 * - POST /orders - Create order (protected, requires authentication)
 * - GET /orders/:id - Get order by ID (protected, user can only access their own orders)
 * - GET /orders - Get user's orders (protected, paginated)
 * - PATCH /orders/:id/status - Update order status (protected, admin/manager only)
 *
 * Security:
 * - All endpoints require authentication (@UseGuards(JwtAuthGuard))
 * - Users can only access their own orders (enforced in service)
 * - Status updates require admin/manager role (@Roles('ADMIN', 'MANAGER'))
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  HttpCode,
  HttpStatus,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrderResponseDto } from './dto/order-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { RequestWithId } from '../../common/middleware/request-id.middleware';
import { Req } from '@nestjs/common';

/**
 * OrdersController handles HTTP requests for order endpoints
 */
@Controller('orders')
@UseGuards(JwtAuthGuard) // All endpoints require authentication
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /**
   * POST /orders
   * Create a new order.
   *
   * This endpoint:
   * - Validates order items (SKUs, quantities)
   * - Calculates total amount from product prices
   * - Creates order with idempotency support
   * - Emits order.created event
   *
   * @param createOrderDto - Order creation data
   * @param user - Current authenticated user (from JWT)
   * @param req - Request object (for request ID)
   * @returns Created order
   *
   * @example
   * POST /orders
   * {
   *   "items": [
   *     { "sku": "TSHIRT-SM-RED", "quantity": 2 },
   *     { "sku": "TSHIRT-MD-BLUE", "quantity": 1 }
   *   ],
   *   "idempotencyKey": "unique-key-123"
   * }
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createOrderDto: CreateOrderDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: RequestWithId,
  ): Promise<OrderResponseDto> {
    // Override userId from JWT (security: user can only create orders for themselves)
    createOrderDto.userId = user.sub;

    return this.ordersService.create(
      createOrderDto,
      req.requestId,
      req.traceId,
    );
  }

  /**
   * GET /orders/:id
   * Get an order by ID.
   *
   * Security: Users can only access their own orders.
   * Service layer enforces this check.
   *
   * @param id - Order UUID
   * @param user - Current authenticated user (from JWT)
   * @returns Order details
   */
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<OrderResponseDto> {
    const order = await this.ordersService.findOne(id);

    // Security: Users can only access their own orders
    if (order.userId !== user.sub) {
      throw new ForbiddenException('You can only access your own orders');
    }

    return order;
  }

  /**
   * GET /orders
   * Get orders for the current user (paginated).
   *
   * @param page - Page number (default: 1)
   * @param limit - Items per page (default: 20, max: 100)
   * @param user - Current authenticated user (from JWT)
   * @returns Paginated list of user's orders
   */
  @Get()
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @CurrentUser() user: JwtPayload,
  ) {
    // Enforce maximum page size
    const maxLimit = 100;
    const actualLimit = Math.min(limit, maxLimit);

    return this.ordersService.findByUserId(user.sub, page, actualLimit);
  }

  /**
   * PATCH /orders/:id/status
   * Update order status.
   *
   * This endpoint:
   * - Validates status transition (state machine)
   * - Updates order status
   * - Emits order.updated event
   *
   * Security: Only ADMIN and MANAGER roles can update order status.
   *
   * @param id - Order UUID
   * @param updateStatusDto - Status update data
   * @param req - Request object (for request ID and trace ID)
   * @returns Updated order
   */
  @Patch(':id/status')
  @UseGuards(RolesGuard) // Additional guard for role-based access
  @Roles('ADMIN', 'MANAGER') // Only admin and manager can update status
  async updateStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateOrderStatusDto,
    @Req() req: RequestWithId,
  ): Promise<OrderResponseDto> {
    return this.ordersService.updateStatus(
      id,
      updateStatusDto,
      req.requestId,
      req.traceId,
    );
  }
}

