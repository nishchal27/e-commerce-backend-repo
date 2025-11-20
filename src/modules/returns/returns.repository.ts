/**
 * Returns Repository
 *
 * This repository abstracts database operations for returns/RMAs.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../lib/prisma/prisma.service';
import { CreateReturnDto } from './dto/create-return.dto';
import { UpdateReturnDto } from './dto/update-return.dto';
import { Prisma, ReturnStatus } from '@prisma/client';

/**
 * Return with items and order relations
 */
export type ReturnWithItems = Prisma.ReturnGetPayload<{
  include: {
    items: {
      include: {
        orderItem: {
          include: {
            variant: true;
          };
        };
        variant: true;
      };
    };
    order: true;
  };
}>;

/**
 * ReturnsRepository handles all database operations for returns
 */
@Injectable()
export class ReturnsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find all returns with optional filtering.
   *
   * @param userId - Optional user ID to filter by
   * @param orderId - Optional order ID to filter by
   * @param status - Optional status to filter by
   * @param skip - Number of records to skip
   * @param take - Number of records to take
   * @returns Array of returns with items
   */
  async findAll(
    userId?: string,
    orderId?: string,
    status?: ReturnStatus,
    skip: number = 0,
    take: number = 20,
  ): Promise<ReturnWithItems[]> {
    const where: Prisma.ReturnWhereInput = {
      ...(userId ? { userId } : {}),
      ...(orderId ? { orderId } : {}),
      ...(status ? { status } : {}),
    };

    return this.prisma.return.findMany({
      where,
      skip,
      take,
      include: {
        items: {
          include: {
            orderItem: {
              include: {
                variant: true,
              },
            },
            variant: true,
          },
        },
        order: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Find a return by ID.
   *
   * @param id - Return UUID
   * @returns Return with items or null if not found
   */
  async findById(id: string): Promise<ReturnWithItems | null> {
    return this.prisma.return.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            orderItem: {
              include: {
                variant: true,
              },
            },
            variant: true,
          },
        },
        order: true,
      },
    });
  }

  /**
   * Find a return by return number (RMA number).
   *
   * @param returnNumber - Return number (e.g., "RMA-2024-001")
   * @returns Return with items or null if not found
   */
  async findByReturnNumber(returnNumber: string): Promise<ReturnWithItems | null> {
    return this.prisma.return.findUnique({
      where: { returnNumber },
      include: {
        items: {
          include: {
            orderItem: {
              include: {
                variant: true,
              },
            },
            variant: true,
          },
        },
        order: true,
      },
    });
  }

  /**
   * Generate next return number (RMA number).
   * Format: RMA-YYYY-NNN (e.g., RMA-2024-001)
   *
   * @returns Next return number
   */
  async generateReturnNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `RMA-${year}-`;

    // Find the highest return number for this year
    const lastReturn = await this.prisma.return.findFirst({
      where: {
        returnNumber: {
          startsWith: prefix,
        },
      },
      orderBy: {
        returnNumber: 'desc',
      },
    });

    let nextNumber = 1;
    if (lastReturn) {
      // Extract number from last return number (e.g., "RMA-2024-042" -> 42)
      const lastNumber = parseInt(lastReturn.returnNumber.replace(prefix, ''), 10);
      nextNumber = lastNumber + 1;
    }

    // Format with leading zeros (e.g., 1 -> "001", 42 -> "042")
    const formattedNumber = nextNumber.toString().padStart(3, '0');
    return `${prefix}${formattedNumber}`;
  }

  /**
   * Create a new return.
   * Note: This method expects order items to be validated and variant IDs to be provided.
   * The service layer should fetch variant IDs from order items before calling this.
   *
   * @param data - Return creation data
   * @param returnNumber - Generated return number
   * @param orderItemVariantMap - Map of orderItemId to variantId
   * @returns Created return with items
   */
  async create(
    data: CreateReturnDto,
    returnNumber: string,
    orderItemVariantMap: Map<string, string>,
  ): Promise<ReturnWithItems> {
    const { items, ...returnData } = data;

    return this.prisma.return.create({
      data: {
        ...returnData,
        returnNumber,
        items: {
          create: items.map((item) => {
            const variantId = orderItemVariantMap.get(item.orderItemId);
            if (!variantId) {
              throw new Error(`Variant ID not found for order item ${item.orderItemId}`);
            }
            return {
              orderItemId: item.orderItemId,
              variantId,
              quantity: item.quantity,
              reason: item.reason || data.reason,
            };
          }),
        },
      },
      include: {
        items: {
          include: {
            orderItem: {
              include: {
                variant: true,
              },
            },
            variant: true,
          },
        },
        order: true,
      },
    });
  }

  /**
   * Update an existing return.
   *
   * @param id - Return UUID
   * @param data - Return update data
   * @returns Updated return with items
   */
  async update(id: string, data: UpdateReturnDto): Promise<ReturnWithItems> {
    return this.prisma.return.update({
      where: { id },
      data,
      include: {
        items: {
          include: {
            orderItem: {
              include: {
                variant: true,
              },
            },
            variant: true,
          },
        },
        order: true,
      },
    });
  }

  /**
   * Count returns matching criteria.
   *
   * @param where - Optional Prisma where clause for filtering
   * @returns Total count
   */
  async count(where?: Prisma.ReturnWhereInput): Promise<number> {
    return this.prisma.return.count({ where });
  }
}

