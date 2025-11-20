/**
 * Create Category DTO
 *
 * DTO for creating new categories via POST /categories endpoint.
 */

import { IsString, IsNotEmpty, IsOptional, IsUUID, IsInt, IsBoolean, Min } from 'class-validator';

/**
 * DTO for creating a new category
 */
export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  slug: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsUUID()
  @IsOptional()
  parentId?: string; // For hierarchical categories

  @IsInt()
  @Min(0)
  @IsOptional()
  level?: number = 0; // Depth in hierarchy (0 = root)

  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number = 0; // For custom ordering

  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;
}

