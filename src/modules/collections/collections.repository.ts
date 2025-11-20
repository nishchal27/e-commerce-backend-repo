/**
 * Collections Repository
 *
 * This repository abstracts database operations for collections.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../lib/prisma/prisma.service';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';
import { Prisma } from '@prisma/client';

/**
 * CollectionsRepository handles all database operations for collections
 */
@Injectable()
export class CollectionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find all collections with optional filtering.
   * By default, filters out inactive collections.
   *
   * @param includeInactive - Whether to include inactive collections
   * @param activeOnly - Whether to only return currently active collections (within date range)
   * @returns Array of collections
   */
  async findAll(includeInactive: boolean = false, activeOnly: boolean = false): Promise<Prisma.CollectionGetPayload<{}>[]> {
    const now = new Date();
    const where: Prisma.CollectionWhereInput = {
      ...(includeInactive ? {} : { isActive: true }),
      ...(activeOnly ? {
        startDate: { lte: now },
        endDate: { gte: now },
      } : {}),
    };

    return this.prisma.collection.findMany({
      where,
      orderBy: [
        { startDate: 'desc' },
        { name: 'asc' },
      ],
    });
  }

  /**
   * Find a collection by ID.
   *
   * @param id - Collection UUID
   * @returns Collection or null if not found
   */
  async findById(id: string): Promise<Prisma.CollectionGetPayload<{}> | null> {
    return this.prisma.collection.findUnique({
      where: { id },
    });
  }

  /**
   * Find a collection by slug.
   *
   * @param slug - Collection slug
   * @returns Collection or null if not found
   */
  async findBySlug(slug: string): Promise<Prisma.CollectionGetPayload<{}> | null> {
    return this.prisma.collection.findUnique({
      where: { slug },
    });
  }

  /**
   * Create a new collection.
   *
   * @param data - Collection creation data
   * @returns Created collection
   */
  async create(data: CreateCollectionDto): Promise<Prisma.CollectionGetPayload<{}>> {
    return this.prisma.collection.create({
      data: {
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
      },
    });
  }

  /**
   * Update an existing collection.
   *
   * @param id - Collection UUID
   * @param data - Collection update data
   * @returns Updated collection
   */
  async update(id: string, data: UpdateCollectionDto): Promise<Prisma.CollectionGetPayload<{}>> {
    const updateData: any = { ...data };
    if (data.startDate !== undefined) {
      updateData.startDate = data.startDate ? new Date(data.startDate) : null;
    }
    if (data.endDate !== undefined) {
      updateData.endDate = data.endDate ? new Date(data.endDate) : null;
    }

    return this.prisma.collection.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Delete a collection (soft delete by setting isActive = false).
   *
   * @param id - Collection UUID
   * @returns Updated collection
   */
  async delete(id: string): Promise<Prisma.CollectionGetPayload<{}>> {
    return this.prisma.collection.update({
      where: { id },
      data: {
        isActive: false,
      },
    });
  }

  /**
   * Get count of products in a collection.
   *
   * @param id - Collection UUID
   * @returns Product count
   */
  async getProductCount(id: string): Promise<number> {
    return this.prisma.product.count({
      where: {
        collectionId: id,
        isActive: true,
        deletedAt: null,
      },
    });
  }

  /**
   * Check if a collection is currently active (within date range).
   *
   * @param collection - Collection object
   * @returns True if collection is currently active
   */
  isActiveNow(collection: Prisma.CollectionGetPayload<{}>): boolean {
    if (!collection.isActive) {
      return false;
    }

    const now = new Date();
    const startDate = collection.startDate;
    const endDate = collection.endDate;

    if (startDate && now < startDate) {
      return false;
    }

    if (endDate && now > endDate) {
      return false;
    }

    return true;
  }
}

