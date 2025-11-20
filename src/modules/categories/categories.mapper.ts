/**
 * Categories Mapper
 *
 * Maps Prisma database models to API response DTOs.
 */

import { CategoryResponseDto } from './dto/category-response.dto';
import { CategoryWithChildren } from './categories.repository';

/**
 * Map category from Prisma model to response DTO
 */
export function mapCategoryToDto(
  category: CategoryWithChildren,
  includeChildren: boolean = false,
  includeProductCount: boolean = false,
): CategoryResponseDto {
  const dto: CategoryResponseDto = {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    parentId: category.parentId,
    level: category.level,
    sortOrder: category.sortOrder,
    isActive: category.isActive,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  };

  if (includeChildren && category.children) {
    dto.children = category.children.map((child) =>
      mapCategoryToDto(child as CategoryWithChildren, true, false),
    );
  }

  return dto;
}

