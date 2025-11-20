/**
 * Category Response DTO
 *
 * DTO for category API responses.
 */

/**
 * Category response structure with optional children
 */
export class CategoryResponseDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  level: number;
  sortOrder: number;
  isActive: boolean;
  children?: CategoryResponseDto[]; // Optional: include children in response
  productCount?: number; // Optional: count of products in this category
  createdAt: Date;
  updatedAt: Date;
}

