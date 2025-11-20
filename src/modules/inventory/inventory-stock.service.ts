/**
 * Inventory Stock Service
 *
 * This service manages multi-warehouse inventory stock.
 * Handles InventoryStock model operations for tracking stock per variant per warehouse.
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../lib/prisma/prisma.service';
import { Logger } from '../../lib/logger';

/**
 * InventoryStockService handles multi-warehouse inventory stock operations
 */
@Injectable()
export class InventoryStockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: Logger,
  ) {}

  /**
   * Get total available stock for a variant across all warehouses.
   *
   * @param variantId - Product variant ID
   * @returns Total available stock
   */
  async getTotalStock(variantId: string): Promise<number> {
    const stocks = await this.prisma.inventoryStock.findMany({
      where: {
        variantId,
        warehouse: {
          isActive: true,
        },
      },
    });

    return stocks.reduce((sum, stock) => sum + stock.quantity, 0);
  }

  /**
   * Get stock for a variant in a specific warehouse.
   *
   * @param variantId - Product variant ID
   * @param warehouseId - Warehouse ID
   * @returns Stock information
   */
  async getStockByWarehouse(variantId: string, warehouseId: string) {
    const stock = await this.prisma.inventoryStock.findUnique({
      where: {
        variantId_warehouseId: {
          variantId,
          warehouseId,
        },
      },
      include: {
        warehouse: true,
      },
    });

    if (!stock) {
      // Return zero stock if record doesn't exist
      return {
        variantId,
        warehouseId,
        quantity: 0,
        reserved: 0,
        available: 0,
      };
    }

    return {
      variantId: stock.variantId,
      warehouseId: stock.warehouseId,
      warehouseCode: stock.warehouse.code,
      quantity: stock.quantity,
      reserved: stock.reserved,
      available: stock.quantity - stock.reserved,
      reorderLevel: stock.reorderLevel,
    };
  }

  /**
   * Get stock for a variant across all warehouses.
   *
   * @param variantId - Product variant ID
   * @returns Array of stock per warehouse
   */
  async getStockByVariant(variantId: string) {
    const stocks = await this.prisma.inventoryStock.findMany({
      where: {
        variantId,
        warehouse: {
          isActive: true,
        },
      },
      include: {
        warehouse: true,
      },
      orderBy: {
        warehouse: {
          code: 'asc',
        },
      },
    });

    const totalQuantity = stocks.reduce((sum, s) => sum + s.quantity, 0);
    const totalReserved = stocks.reduce((sum, s) => sum + s.reserved, 0);

    return {
      variantId,
      totalQuantity,
      totalReserved,
      totalAvailable: totalQuantity - totalReserved,
      warehouses: stocks.map((stock) => ({
        warehouseId: stock.warehouseId,
        warehouseCode: stock.warehouse.code,
        warehouseName: stock.warehouse.name,
        quantity: stock.quantity,
        reserved: stock.reserved,
        available: stock.quantity - stock.reserved,
        reorderLevel: stock.reorderLevel,
      })),
    };
  }

  /**
   * Find warehouse with available stock for a variant.
   * Returns warehouse with highest available stock, or null if none available.
   *
   * @param variantId - Product variant ID
   * @param quantity - Required quantity
   * @returns Warehouse ID with available stock, or null
   */
  async findAvailableWarehouse(variantId: string, quantity: number): Promise<string | null> {
    const stocks = await this.prisma.inventoryStock.findMany({
      where: {
        variantId,
        warehouse: {
          isActive: true,
        },
      },
      include: {
        warehouse: true,
      },
      orderBy: [
        // Prioritize warehouses with highest available stock
        {
          quantity: 'desc',
        },
      ],
    });

    // Find first warehouse with enough available stock
    for (const stock of stocks) {
      const available = stock.quantity - stock.reserved;
      if (available >= quantity) {
        return stock.warehouseId;
      }
    }

    return null;
  }

  /**
   * Reserve stock in a warehouse.
   * Atomically decrements available stock and increments reserved stock.
   *
   * @param variantId - Product variant ID
   * @param warehouseId - Warehouse ID
   * @param quantity - Quantity to reserve
   * @returns Updated stock record
   * @throws NotFoundException if stock record doesn't exist
   */
  async reserveStock(
    variantId: string,
    warehouseId: string,
    quantity: number,
  ) {
    // Use upsert to create record if it doesn't exist
    const stock = await this.prisma.inventoryStock.upsert({
      where: {
        variantId_warehouseId: {
          variantId,
          warehouseId,
        },
      },
      create: {
        variantId,
        warehouseId,
        quantity: 0,
        reserved: quantity,
      },
      update: {
        reserved: {
          increment: quantity,
        },
      },
    });

    // Check if enough stock available
    const available = stock.quantity - stock.reserved;
    if (available < 0) {
      throw new NotFoundException(
        `Insufficient stock in warehouse ${warehouseId}: requested ${quantity}, available ${stock.quantity - (stock.reserved - quantity)}`,
      );
    }

    return stock;
  }

  /**
   * Release reserved stock in a warehouse.
   * Atomically decrements reserved stock.
   *
   * @param variantId - Product variant ID
   * @param warehouseId - Warehouse ID
   * @param quantity - Quantity to release
   * @returns Updated stock record
   */
  async releaseStock(
    variantId: string,
    warehouseId: string,
    quantity: number,
  ) {
    return this.prisma.inventoryStock.update({
      where: {
        variantId_warehouseId: {
          variantId,
          warehouseId,
        },
      },
      data: {
        reserved: {
          decrement: quantity,
        },
      },
    });
  }

  /**
   * Commit reserved stock (convert reserved to sold).
   * Atomically decrements both quantity and reserved.
   *
   * @param variantId - Product variant ID
   * @param warehouseId - Warehouse ID
   * @param quantity - Quantity to commit
   * @returns Updated stock record
   */
  async commitStock(
    variantId: string,
    warehouseId: string,
    quantity: number,
  ) {
    return this.prisma.inventoryStock.update({
      where: {
        variantId_warehouseId: {
          variantId,
          warehouseId,
        },
      },
      data: {
        quantity: {
          decrement: quantity,
        },
        reserved: {
          decrement: quantity,
        },
      },
    });
  }

  /**
   * Update stock quantity in a warehouse.
   * Used for receiving inventory, adjustments, etc.
   *
   * @param variantId - Product variant ID
   * @param warehouseId - Warehouse ID
   * @param quantity - New quantity (or delta if isDelta = true)
   * @param isDelta - If true, quantity is added/subtracted; if false, quantity is set
   * @returns Updated stock record
   */
  async updateStock(
    variantId: string,
    warehouseId: string,
    quantity: number,
    isDelta: boolean = false,
  ) {
    if (isDelta) {
      return this.prisma.inventoryStock.upsert({
        where: {
          variantId_warehouseId: {
            variantId,
            warehouseId,
          },
        },
        create: {
          variantId,
          warehouseId,
          quantity: Math.max(0, quantity), // Ensure non-negative
          reserved: 0,
        },
        update: {
          quantity: {
            increment: quantity,
          },
        },
      });
    } else {
      return this.prisma.inventoryStock.upsert({
        where: {
          variantId_warehouseId: {
            variantId,
            warehouseId,
          },
        },
        create: {
          variantId,
          warehouseId,
          quantity: Math.max(0, quantity),
          reserved: 0,
        },
        update: {
          quantity: Math.max(0, quantity),
        },
      });
    }
  }
}

