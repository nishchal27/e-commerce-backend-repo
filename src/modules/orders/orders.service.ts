/**
 * Orders Service
 *
 * This service contains the business logic for order operations.
 * It coordinates between the repository (data access) and controller (HTTP layer).
 *
 * Responsibilities:
 * - Order creation with idempotency
 * - Order status state machine management
 * - Order validation and business rules
 * - Event emission via Outbox pattern
 * - Integration with Products module (for price calculation)
 *
 * Key Features:
 * - Idempotent order creation (prevents duplicates on retries)
 * - State machine for status transitions (validates transitions)
 * - Event emission (order.created, order.updated events)
 * - Price calculation from product variants
 * - Error handling and logging
 */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../lib/prisma/prisma.service';
import { OrdersRepository, OrderWithItems } from './orders.repository';
import { OutboxService } from '../../common/events/outbox.service';
import { PrometheusService } from '../../common/prometheus/prometheus.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrderResponseDto, OrderItemResponseDto } from './dto/order-response.dto';
import { OrderStatus } from '@prisma/client';
import {
  isValidStatusTransition,
  isTerminalStatus,
} from './interfaces/order-status.interface';
import { Logger } from '../../lib/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * Order item with calculated price and variant info
 */
interface OrderItemWithPrice {
  variantId: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  discountAmount?: number;
  attributes?: Record<string, any>;
}

/**
 * OrdersService handles business logic for order operations
 */
@Injectable()
export class OrdersService {
  constructor(
    private readonly ordersRepository: OrdersRepository,
    private readonly prisma: PrismaService,
    private readonly outboxService: OutboxService,
    private readonly prometheusService: PrometheusService,
    private readonly logger: Logger,
  ) {}

  /**
   * Create a new order with idempotency support.
   *
   * This method:
   * 1. Checks for existing order with same idempotency key (if provided)
   * 2. Validates order items (checks product variants exist and have stock)
   * 3. Calculates total amount from product prices
   * 4. Creates order in database transaction
   * 5. Emits order.created event via Outbox
   * 6. Records metrics
   *
   * @param createOrderDto - Order creation data
   * @param requestId - Optional request ID for event correlation
   * @param traceId - Optional trace ID for distributed tracing
   * @returns Created order
   *
   * @throws BadRequestException if order items are invalid
   * @throws ConflictException if order with idempotency key already exists
   */
  async create(
    createOrderDto: CreateOrderDto,
    requestId?: string,
    traceId?: string,
  ): Promise<OrderResponseDto> {
    const { userId, items, idempotencyKey } = createOrderDto;

    // Check idempotency: if idempotency key provided, check for existing order
    if (idempotencyKey) {
      const existingOrder = await this.ordersRepository.findByIdempotencyKey(
        idempotencyKey,
        true,
      );

      if (existingOrder && 'items' in existingOrder) {
        this.logger.debug(
          `Order with idempotency key ${idempotencyKey} already exists: ${existingOrder.id}`,
          'OrdersService',
        );
        // Return existing order (idempotent behavior)
        return this.mapToResponseDto(existingOrder as OrderWithItems);
      }
    }

    // Validate and calculate prices for order items
    const orderItemsWithPrice = await this.validateAndCalculatePrices(items);

    // Calculate amounts
    const subtotalAmount = orderItemsWithPrice.reduce(
      (sum, item) => sum + item.totalPrice,
      0,
    );
    const discountAmount = orderItemsWithPrice.reduce(
      (sum, item) => sum + (item.discountAmount || 0),
      0,
    );
    const taxAmount = 0; // TODO: Calculate tax based on location
    const shippingAmount = 0; // TODO: Calculate shipping based on order
    const totalAmount = subtotalAmount - discountAmount + taxAmount + shippingAmount;

    // Create order in transaction (with order items and event emission)
    const order = await this.prisma.$transaction(async (tx) => {
      // Create order
      const newOrder = await tx.order.create({
        data: {
          id: uuidv4(),
          userId,
          totalAmount,
          subtotalAmount,
          discountAmount,
          taxAmount,
          shippingAmount,
          status: OrderStatus.CREATED,
          idempotencyKey: idempotencyKey || null,
          promotionCode: createOrderDto.promotionCode || null,
          items: {
            create: orderItemsWithPrice.map((item) => ({
              variantId: item.variantId,
              sku: item.sku,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
              discountAmount: item.discountAmount || 0,
              attributes: item.attributes || null,
            })),
          },
        },
        include: {
          user: true,
          items: {
            include: {
              variant: true,
            },
          },
        },
      });

      // Emit order.created event via Outbox (same transaction)
      await this.outboxService.writeEvent({
        topic: 'order.created',
        event: this.outboxService.createEvent(
          'order.created.v1',
          {
            order_id: newOrder.id,
            user_id: newOrder.userId,
            total_amount: Number(newOrder.totalAmount),
            currency: 'USD', // TODO: Get from product variant
            items: orderItemsWithPrice.map((item) => ({
              variant_id: item.variantId,
              sku: item.sku,
              quantity: item.quantity,
              unit_price: item.unitPrice,
              total_price: item.totalPrice,
              discount_amount: item.discountAmount || 0,
            })),
            idempotency_key: idempotencyKey,
          },
          {
            trace_id: traceId,
            request_id: requestId,
          },
        ),
        tx, // Use same transaction
      });

      return newOrder;
    });

    // Record metrics
    this.prometheusService.recordRegistration(true); // Reuse registration counter for orders
    // TODO: Add orders_created_total counter to PrometheusService

    this.logger.log(
      `Order created: ${order.id} (user: ${userId}, amount: ${totalAmount})`,
      'OrdersService',
    );

    // Map to response DTO
    return this.mapToResponseDto(order as OrderWithItems);
  }

  /**
   * Get an order by ID.
   *
   * @param id - Order UUID
   * @returns Order details
   * @throws NotFoundException if order not found
   */
  async findOne(id: string): Promise<OrderResponseDto> {
    const order = await this.ordersRepository.findById(id, true);

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    if (!('items' in order)) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    return this.mapToResponseDto(order as OrderWithItems);
  }

  /**
   * Get orders for a user with pagination.
   *
   * @param userId - User UUID
   * @param page - Page number (default: 1)
   * @param limit - Items per page (default: 20)
   * @returns Paginated list of orders
   */
  async findByUserId(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    data: OrderResponseDto[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const skip = (page - 1) * limit;
    const [orders, total] = await Promise.all([
      this.ordersRepository.findByUserId(userId, skip, limit),
      this.ordersRepository.count({ userId }),
    ]);

    return {
      data: orders.map((order) => {
        if ('items' in order) {
          return this.mapToResponseDto(order as OrderWithItems);
        }
        // Fallback for orders without items (shouldn't happen, but type safety)
        return this.mapToResponseDto(order as any);
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update order status (state machine).
   *
   * Validates status transition and updates order.
   * Emits order.updated event on status change.
   *
   * @param id - Order UUID
   * @param updateStatusDto - Status update data
   * @param requestId - Optional request ID for event correlation
   * @param traceId - Optional trace ID for distributed tracing
   * @returns Updated order
   *
   * @throws NotFoundException if order not found
   * @throws BadRequestException if status transition is invalid
   */
  async updateStatus(
    id: string,
    updateStatusDto: UpdateOrderStatusDto,
    requestId?: string,
    traceId?: string,
  ): Promise<OrderResponseDto> {
    const { status: newStatus, reason } = updateStatusDto;

    // Get current order
    const currentOrder = await this.ordersRepository.findById(id);
    if (!currentOrder) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    // Check if order is in terminal state
    if (isTerminalStatus(currentOrder.status)) {
      throw new BadRequestException(
        `Cannot update order status: order is in terminal state (${currentOrder.status})`,
      );
    }

    // Validate status transition
    if (!isValidStatusTransition(currentOrder.status, newStatus)) {
      throw new BadRequestException(
        `Invalid status transition: ${currentOrder.status} → ${newStatus}`,
      );
    }

    // Update order status in transaction (with event emission)
    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      // Update order status
      const order = await tx.order.update({
        where: { id },
        data: { status: newStatus },
        include: {
          user: true,
        },
      });

      // Emit order.updated event via Outbox (same transaction)
      await this.outboxService.writeEvent({
        topic: 'order.updated',
        event: this.outboxService.createEvent(
          'order.updated.v1',
          {
            order_id: order.id,
            user_id: order.userId,
            old_status: currentOrder.status,
            new_status: newStatus,
            reason: reason || null,
          },
          {
            trace_id: traceId,
            request_id: requestId,
          },
        ),
        tx, // Use same transaction
      });

      return order;
    });

    this.logger.log(
      `Order status updated: ${id} (${currentOrder.status} → ${newStatus})`,
      'OrdersService',
    );

    // Fetch order with items for response
    const orderWithItems = await this.ordersRepository.findById(id, true);
    if (!orderWithItems || !('items' in orderWithItems)) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    return this.mapToResponseDto(orderWithItems as OrderWithItems);
  }

  /**
   * Validate order items and calculate prices.
   *
   * This method:
   * 1. Checks that all SKUs exist in ProductVariant table
   * 2. Validates stock availability (basic check)
   * 3. Calculates prices from product variants
   * 4. Returns order items with calculated prices
   *
   * @param items - Order items (SKU + quantity)
   * @returns Order items with calculated prices
   * @throws BadRequestException if items are invalid
   */
  private async validateAndCalculatePrices(
    items: { sku: string; quantity: number }[],
  ): Promise<OrderItemWithPrice[]> {
    // Get all unique SKUs
    const skus = [...new Set(items.map((item) => item.sku))];

    // Fetch product variants from database
    const variants = await this.prisma.productVariant.findMany({
      where: {
        sku: { in: skus },
      },
    });

    // Create map for quick lookup
    const variantMap = new Map(variants.map((v) => [v.sku, v]));

    // Validate and calculate prices
    const orderItemsWithPrice: OrderItemWithPrice[] = [];

    for (const item of items) {
      const variant = variantMap.get(item.sku);

      if (!variant) {
        throw new BadRequestException(
          `Product variant with SKU ${item.sku} not found`,
        );
      }

      // Check stock availability (basic check - full inventory management in Phase 2)
      if (variant.stock < item.quantity) {
        throw new BadRequestException(
          `Insufficient stock for SKU ${item.sku}: requested ${item.quantity}, available ${variant.stock}`,
        );
      }

      const unitPrice = Number(variant.price);
      const totalPrice = unitPrice * item.quantity;

      orderItemsWithPrice.push({
        variantId: variant.id,
        sku: item.sku,
        quantity: item.quantity,
        unitPrice,
        totalPrice,
        discountAmount: 0, // TODO: Calculate discount from promotion
        attributes: variant.attributes as Record<string, any> | undefined,
      });
    }

    return orderItemsWithPrice;
  }

  /**
   * Map order entity to response DTO.
   *
   * @param order - Order entity from database with items
   * @returns Order response DTO
   */
  private mapToResponseDto(order: OrderWithItems): OrderResponseDto {
    // Map items to response format
    const orderItems: OrderItemResponseDto[] = order.items.map((item) => ({
      id: item.id,
      variantId: item.variantId,
      sku: item.sku,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      totalPrice: Number(item.totalPrice),
      discountAmount: Number(item.discountAmount),
      attributes: item.attributes as Record<string, any> | null,
    }));

    // Get currency from first item's variant, or default to USD
    const currency = order.items.length > 0 && order.items[0].variant
      ? order.items[0].variant.currency
      : 'USD';

    return {
      id: order.id,
      userId: order.userId,
      status: order.status,
      totalAmount: Number(order.totalAmount),
      subtotalAmount: Number(order.subtotalAmount),
      discountAmount: Number(order.discountAmount),
      taxAmount: Number(order.taxAmount),
      shippingAmount: Number(order.shippingAmount),
      promotionCode: order.promotionCode,
      currency,
      items: orderItems,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }
}

