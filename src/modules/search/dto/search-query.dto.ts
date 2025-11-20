/**
 * Search Query DTO
 *
 * Defines the request parameters for product search.
 */

import {
  IsString,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsBoolean,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SearchFiltersDto {
  @IsString()
  @IsOptional()
  categoryId?: string;

  @IsString()
  @IsOptional()
  brandId?: string;

  @IsString()
  @IsOptional()
  gender?: string; // "men", "women", "unisex", "kids"

  @IsNumber()
  @Min(0)
  @IsOptional()
  minPrice?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  maxPrice?: number;

  @IsBoolean()
  @IsOptional()
  inStock?: boolean;

  // Size filter - array of sizes (e.g., ["S", "M", "L"])
  @IsString({ each: true })
  @IsOptional()
  sizes?: string[];

  // Color filter - array of colors (e.g., ["red", "blue"])
  @IsString({ each: true })
  @IsOptional()
  colors?: string[];

  @IsObject()
  @IsOptional()
  attributes?: Record<string, any>;
}

export class SearchQueryDto {
  @IsString()
  @IsOptional()
  q?: string; // Search query string

  @IsNumber()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsNumber()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;

  @ValidateNested()
  @Type(() => SearchFiltersDto)
  @IsOptional()
  filters?: SearchFiltersDto;
}

