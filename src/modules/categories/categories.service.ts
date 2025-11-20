/**
 * Categories Service
 *
 * This service contains the business logic for category operations.
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { CategoriesRepository, CategoryWithChildren } from './categories.repository';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryResponseDto } from './dto/category-response.dto';
import { mapCategoryToDto } from './categories.mapper';
import { Logger } from '../../lib/logger';

/**
 * CategoriesService handles business logic for category operations
 */
@Injectable()
export class CategoriesService {
  constructor(
    private readonly categoriesRepository: CategoriesRepository,
    private readonly logger: Logger,
  ) {}

  /**
   * Get all categories.
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
  ): Promise<CategoryResponseDto[]> {
    const categories = await this.categoriesRepository.findAll(
      includeInactive,
      includeChildren,
      parentId,
    );

    return categories.map((cat) =>
      mapCategoryToDto(cat, includeChildren, false),
    );
  }

  /**
   * Get category tree (hierarchical structure).
   *
   * @param includeInactive - Whether to include inactive categories
   * @returns Array of root categories with nested children
   */
  async findTree(includeInactive: boolean = false): Promise<CategoryResponseDto[]> {
    const tree = await this.categoriesRepository.findTree(includeInactive);

    return tree.map((cat) => mapCategoryToDto(cat, true, false));
  }

  /**
   * Get a single category by ID.
   *
   * @param id - Category UUID
   * @param includeChildren - Whether to include child categories
   * @returns Category
   * @throws NotFoundException if category not found
   */
  async findOne(id: string, includeChildren: boolean = false): Promise<CategoryResponseDto> {
    const category = await this.categoriesRepository.findById(id, includeChildren);

    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    const productCount = await this.categoriesRepository.getProductCount(id);

    const dto = mapCategoryToDto(category, includeChildren, false);
    dto.productCount = productCount;

    return dto;
  }

  /**
   * Get a category by slug.
   *
   * @param slug - Category slug
   * @param includeChildren - Whether to include child categories
   * @returns Category
   * @throws NotFoundException if category not found
   */
  async findBySlug(slug: string, includeChildren: boolean = false): Promise<CategoryResponseDto> {
    const category = await this.categoriesRepository.findBySlug(slug, includeChildren);

    if (!category) {
      throw new NotFoundException(`Category with slug ${slug} not found`);
    }

    return mapCategoryToDto(category, includeChildren, false);
  }

  /**
   * Create a new category.
   *
   * @param createCategoryDto - Category creation data
   * @returns Created category
   * @throws BadRequestException if slug already exists or parent not found
   */
  async create(createCategoryDto: CreateCategoryDto): Promise<CategoryResponseDto> {
    // Validate slug uniqueness
    const existing = await this.categoriesRepository.findBySlug(createCategoryDto.slug);
    if (existing) {
      throw new BadRequestException(`Category with slug ${createCategoryDto.slug} already exists`);
    }

    // Validate parent exists if provided
    if (createCategoryDto.parentId) {
      const parent = await this.categoriesRepository.findById(createCategoryDto.parentId);
      if (!parent) {
        throw new BadRequestException(`Parent category with ID ${createCategoryDto.parentId} not found`);
      }
    }

    const category = await this.categoriesRepository.create(createCategoryDto);
    this.logger.log(`Category created: ${category.id} (${category.slug})`, 'CategoriesService');

    return mapCategoryToDto(category, false, false);
  }

  /**
   * Update an existing category.
   *
   * @param id - Category UUID
   * @param updateCategoryDto - Category update data
   * @returns Updated category
   * @throws NotFoundException if category not found
   * @throws BadRequestException if slug already exists or circular reference
   */
  async update(id: string, updateCategoryDto: UpdateCategoryDto): Promise<CategoryResponseDto> {
    const existing = await this.categoriesRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    // Validate slug uniqueness if being updated
    if (updateCategoryDto.slug && updateCategoryDto.slug !== existing.slug) {
      const slugExists = await this.categoriesRepository.findBySlug(updateCategoryDto.slug);
      if (slugExists) {
        throw new BadRequestException(`Category with slug ${updateCategoryDto.slug} already exists`);
      }
    }

    // Prevent circular reference (category cannot be its own parent or ancestor)
    if (updateCategoryDto.parentId) {
      if (updateCategoryDto.parentId === id) {
        throw new BadRequestException('Category cannot be its own parent');
      }

      // Check if parent is a descendant (would create circular reference)
      const isDescendant = await this.isDescendant(id, updateCategoryDto.parentId);
      if (isDescendant) {
        throw new BadRequestException('Cannot set parent to a descendant category (would create circular reference)');
      }
    }

    const category = await this.categoriesRepository.update(id, updateCategoryDto);
    this.logger.log(`Category updated: ${category.id}`, 'CategoriesService');

    return mapCategoryToDto(category, false, false);
  }

  /**
   * Delete a category (soft delete).
   *
   * @param id - Category UUID
   * @throws NotFoundException if category not found
   */
  async remove(id: string): Promise<void> {
    const existing = await this.categoriesRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    await this.categoriesRepository.delete(id);
    this.logger.log(`Category deleted: ${id}`, 'CategoriesService');
  }

  /**
   * Check if a category is a descendant of another category.
   *
   * @param ancestorId - Potential ancestor category ID
   * @param descendantId - Potential descendant category ID
   * @returns True if descendantId is a descendant of ancestorId
   */
  private async isDescendant(ancestorId: string, descendantId: string): Promise<boolean> {
    const category = await this.categoriesRepository.findById(descendantId);
    if (!category || !category.parentId) {
      return false;
    }

    if (category.parentId === ancestorId) {
      return true;
    }

    return this.isDescendant(ancestorId, category.parentId);
  }
}

