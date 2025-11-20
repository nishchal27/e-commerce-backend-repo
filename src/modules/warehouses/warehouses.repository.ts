/**
 * Warehouses Repository
 *
 * This repository abstracts database operations for warehouses.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../lib/prisma/prisma.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { Prisma } from '@prisma/client';

/**
 * WarehousesRepository handles all database operations for warehouses
 */
@Injectable()
export class WarehousesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find all warehouses with optional filtering.
   * By default, filters out inactive warehouses.
   *
   * @param includeInactive - Whether to include inactive warehouses
   * @returns Array of warehouses
   */
  async findAll(includeInactive: boolean = false): Promise<Prisma.WarehouseGetPayload<{}>[]> {
    const where: Prisma.WarehouseWhereInput = includeInactive ? {} : { isActive: true };

    return this.prisma.warehouse.findMany({
      where,
      orderBy: {
        code: 'asc',
      },
    });
  }

  /**
   * Find a warehouse by ID.
   *
   * @param id - Warehouse UUID
   * @returns Warehouse or null if not found
   */
  async findById(id: string): Promise<Prisma.WarehouseGetPayload<{}> | null> {
    return this.prisma.warehouse.findUnique({
      where: { id },
    });
  }

  /**
   * Find a warehouse by code.
   *
   * @param code - Warehouse code
   * @returns Warehouse or null if not found
   */
  async findByCode(code: string): Promise<Prisma.WarehouseGetPayload<{}> | null> {
    return this.prisma.warehouse.findUnique({
      where: { code },
    });
  }

  /**
   * Create a new warehouse.
   *
   * @param data - Warehouse creation data
   * @returns Created warehouse
   */
  async create(data: CreateWarehouseDto): Promise<Prisma.WarehouseGetPayload<{}>> {
    return this.prisma.warehouse.create({
      data,
    });
  }

  /**
   * Update an existing warehouse.
   *
   * @param id - Warehouse UUID
   * @param data - Warehouse update data
   * @returns Updated warehouse
   */
  async update(id: string, data: UpdateWarehouseDto): Promise<Prisma.WarehouseGetPayload<{}>> {
    return this.prisma.warehouse.update({
      where: { id },
      data,
    });
  }

  /**
   * Delete a warehouse (soft delete by setting isActive = false).
   *
   * @param id - Warehouse UUID
   * @returns Updated warehouse
   */
  async delete(id: string): Promise<Prisma.WarehouseGetPayload<{}>> {
    return this.prisma.warehouse.update({
      where: { id },
      data: {
        isActive: false,
      },
    });
  }
}

