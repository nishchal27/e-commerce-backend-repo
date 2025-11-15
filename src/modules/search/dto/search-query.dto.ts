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

