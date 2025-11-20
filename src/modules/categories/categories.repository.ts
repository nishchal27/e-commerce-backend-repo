/**
 * Categories Repository
 *
 * This repository abstracts database operations for categories.
 * Handles hierarchical category queries and operations.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../lib/prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Prisma } from '@prisma/client';

/**
 * Category with children relation
 */
export type CategoryWithChildren = Prisma.CategoryGetPayload<{
  include: { children: true };
}>;

/**
 * CategoriesRepository handles all database operations for categories
 */
@Injectable()
export class CategoriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find all categories with optional filtering.
   * By default, filters out inactive categories.
   *
   * @param includeInactive - Whether to include inactive categories
   * @param includeChildren - Whether to include child categories
   * @param parentId - Filter by parent ID (null for root categories)
   * @returns Array of categories
   */
  async findAll(
    includeInactive: boolean = false,
    includeChildren: boolean = false,
    parentId?: string | null,
  ): Promise<CategoryWithChildren[]> {
    const where: Prisma.CategoryWhereInput = {
      ...(includeInactive ? {} : { isActive: true }),
      ...(parentId !== undefined ? { parentId } : {}),
    };

    return this.prisma.category.findMany({
      where,
      include: {
        children: includeChildren,
      },
      orderBy: [
        { sortOrder: 'asc' },
        { name: 'asc' },
      ],
    });
  }

  /**
   * Find a category by ID.
   *
   * @param id - Category UUID
   * @param includeChildren - Whether to include child categories
   * @returns Category or null if not found
   */
  async findById(id: string, includeChildren: boolean = false): Promise<CategoryWithChildren | null> {
    return this.prisma.category.findUnique({
      where: { id },
      include: {
        children: includeChildren,
      },
    });
  }

  /**
   * Find a category by slug.
   *
   * @param slug - Category slug
   * @param includeChildren - Whether to include child categories
   * @returns Category or null if not found
   */
  async findBySlug(slug: string, includeChildren: boolean = false): Promise<CategoryWithChildren | null> {
    return this.prisma.category.findUnique({
      where: { slug },
      include: {
        children: includeChildren,
      },
    });
  }

  /**
   * Get category tree (all categories with nested children).
   * Returns only root categories with their nested children.
   *
   * @param includeInactive - Whether to include inactive categories
   * @returns Array of root categories with nested children
   */
  async findTree(includeInactive: boolean = false): Promise<CategoryWithChildren[]> {
    const where: Prisma.CategoryWhereInput = {
      parentId: null, // Only root categories
      ...(includeInactive ? {} : { isActive: true }),
    };

    return this.prisma.category.findMany({
      where,
      include: {
        children: {
          where: includeInactive ? {} : { isActive: true },
          include: {
            children: true, // Recursive: include nested children
          },
          orderBy: [
            { sortOrder: 'asc' },
            { name: 'asc' },
          ],
        },
      },
      orderBy: [
        { sortOrder: 'asc' },
        { name: 'asc' },
      ],
    });
  }

  /**
   * Create a new category.
   * Automatically calculates level based on parent if not provided.
   *
   * @param data - Category creation data
   * @returns Created category
   */
  async create(data: CreateCategoryDto): Promise<CategoryWithChildren> {
    // If parentId is provided, calculate level from parent
    let level = data.level ?? 0;
    if (data.parentId) {
      const parent = await this.prisma.category.findUnique({
        where: { id: data.parentId },
      });
      if (parent) {
        level = parent.level + 1;
      }
    }

    return this.prisma.category.create({
      data: {
        ...data,
        level,
      },
      include: {
        children: true,
      },
    });
  }

  /**
   * Update an existing category.
   * If parentId changes, recalculates level and updates children levels.
   *
   * @param id - Category UUID
   * @param data - Category update data
   * @returns Updated category
   */
  async update(id: string, data: UpdateCategoryDto): Promise<CategoryWithChildren> {
    // If parentId is being updated, recalculate level
    if (data.parentId !== undefined) {
      let level = 0;
      if (data.parentId) {
        const parent = await this.prisma.category.findUnique({
          where: { id: data.parentId },
        });
        if (parent) {
          level = parent.level + 1;
        }
      }
      data.level = level;

      // Update children levels recursively
      await this.updateChildrenLevels(id, level + 1);
    }

    return this.prisma.category.update({
      where: { id },
      data,
      include: {
        children: true,
      },
    });
  }

  /**
   * Delete a category (soft delete by setting isActive = false).
   * Also soft-deletes all children recursively.
   *
   * @param id - Category UUID
   * @returns Updated category
   */
  async delete(id: string): Promise<Prisma.CategoryGetPayload<{}>> {
    // Soft delete children first
    const children = await this.prisma.category.findMany({
      where: { parentId: id },
    });

    for (const child of children) {
      await this.delete(child.id);
    }

    // Soft delete this category
    return this.prisma.category.update({
      where: { id },
      data: {
        isActive: false,
      },
    });
  }

  /**
   * Get count of products in a category (including subcategories).
   *
   * @param id - Category UUID
   * @returns Product count
   */
  async getProductCount(id: string): Promise<number> {
    // Get all descendant category IDs (including self)
    const categoryIds = await this.getDescendantIds(id);

    return this.prisma.product.count({
      where: {
        categoryId: { in: categoryIds },
        isActive: true,
        deletedAt: null,
      },
    });
  }

  /**
   * Get all descendant category IDs (including self).
   * Used for counting products in category tree.
   *
   * @param id - Category UUID
   * @returns Array of category IDs
   */
  private async getDescendantIds(id: string): Promise<string[]> {
    const ids: string[] = [id];
    const children = await this.prisma.category.findMany({
      where: { parentId: id, isActive: true },
    });

    for (const child of children) {
      const childIds = await this.getDescendantIds(child.id);
      ids.push(...childIds);
    }

    return ids;
  }

  /**
   * Update children levels recursively when parent level changes.
   *
   * @param parentId - Parent category UUID
   * @param level - New level for children
   */
  private async updateChildrenLevels(parentId: string, level: number): Promise<void> {
    const children = await this.prisma.category.findMany({
      where: { parentId },
    });

    for (const child of children) {
      await this.prisma.category.update({
        where: { id: child.id },
        data: { level },
      });

      // Recursively update grandchildren
      await this.updateChildrenLevels(child.id, level + 1);
    }
  }
}

