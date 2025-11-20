/**
 * Orders Repository
 *
 * This repository abstracts database operations for orders.
 * It provides a clean interface between the service layer and Prisma,
 * making it easier to test and swap out database implementations.
 *
 * Responsibilities:
 * - CRUD operations for orders
 * - Database query optimization
 * - Type-safe database access via Prisma
 * - Order lookup by idempotency key
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../lib/prisma/prisma.service';
import { OrderStatus, Prisma } from '@prisma/client';

/**
 * Extended Order type that includes user and items relations
 * Uses Prisma's generated type for type safety
 */
export type OrderWithUser = Prisma.OrderGetPayload<{
  include: { user: true };
}>;

export type OrderWithItems = Prisma.OrderGetPayload<{
  include: { user: true; items: { include: { variant: true } } };
}>;

/**
 * OrdersRepository handles all database operations for orders
 */
@Injectable()
export class OrdersRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find an order by ID.
   *
   * @param id - Order UUID
   * @param includeItems - Whether to include order items (default: true)
   * @returns Order with user and items relations or null if not found
   */
  async findById(id: string, includeItems: boolean = true): Promise<OrderWithItems | OrderWithUser | null> {
    return this.prisma.order.findUnique({
      where: { id },
      include: {
        user: true,
        items: includeItems ? {
          include: {
            variant: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        } : false,
      },
    });
  }

  /**
   * Find an order by idempotency key.
   *
   * Used to check if an order with the same idempotency key already exists.
   * Prevents duplicate order creation on retries.
   *
   * @param idempotencyKey - Idempotency key
   * @param includeItems - Whether to include order items (default: true)
   * @returns Order or null if not found
   */
  async findByIdempotencyKey(
    idempotencyKey: string,
    includeItems: boolean = true,
  ): Promise<OrderWithItems | OrderWithUser | null> {
    if (!idempotencyKey) {
      return null;
    }

    return this.prisma.order.findUnique({
      where: { idempotencyKey },
      include: {
        user: true,
        items: includeItems ? {
          include: {
            variant: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        } : false,
      },
    });
  }

  /**
   * Find orders by user ID with pagination.
   *
   * @param userId - User UUID
   * @param skip - Number of records to skip (for pagination)
   * @param take - Number of records to take (page size)
   * @param includeItems - Whether to include order items (default: true)
   * @returns Array of orders with user and items relations
   */
  async findByUserId(
    userId: string,
    skip: number = 0,
    take: number = 20,
    includeItems: boolean = true,
  ): Promise<OrderWithItems[] | OrderWithUser[]> {
    return this.prisma.order.findMany({
      where: { userId },
      skip,
      take,
      include: {
        user: true,
        items: includeItems ? {
          include: {
            variant: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        } : false,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Find orders by status.
   *
   * Useful for finding orders in a specific state (e.g., all PAID orders ready to ship).
   *
   * @param status - Order status
   * @param skip - Number of records to skip
   * @param take - Number of records to take
   * @returns Array of orders with user relation
   */
  async findByStatus(
    status: OrderStatus,
    skip: number = 0,
    take: number = 20,
  ): Promise<OrderWithUser[]> {
    return this.prisma.order.findMany({
      where: { status },
      skip,
      take,
      include: {
        user: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  /**
   * Create a new order.
   *
   * @param data - Order creation data
   * @returns Created order with user and items relations
   */
  async create(data: {
    userId: string;
    totalAmount: number;
    subtotalAmount: number;
    discountAmount?: number;
    taxAmount?: number;
    shippingAmount?: number;
    status: OrderStatus;
    idempotencyKey?: string;
    promotionCode?: string;
  }): Promise<OrderWithItems> {
    return this.prisma.order.create({
      data: {
        userId: data.userId,
        totalAmount: data.totalAmount,
        subtotalAmount: data.subtotalAmount,
        discountAmount: data.discountAmount ?? 0,
        taxAmount: data.taxAmount ?? 0,
        shippingAmount: data.shippingAmount ?? 0,
        status: data.status,
        idempotencyKey: data.idempotencyKey,
        promotionCode: data.promotionCode,
      },
      include: {
        user: true,
        items: {
          include: {
            variant: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });
  }

  /**
   * Update an order's status.
   *
   * @param id - Order UUID
   * @param status - New order status
   * @returns Updated order with user relation
   */
  async updateStatus(
    id: string,
    status: OrderStatus,
  ): Promise<OrderWithUser> {
    return this.prisma.order.update({
      where: { id },
      data: { status },
      include: {
        user: true,
      },
    });
  }

  /**
   * Count orders matching criteria.
   *
   * @param where - Optional Prisma where clause for filtering
   * @returns Total count
   */
  async count(where?: Prisma.OrderWhereInput): Promise<number> {
    return this.prisma.order.count({ where });
  }
}

