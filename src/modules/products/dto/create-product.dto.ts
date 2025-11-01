/**
 * Create Product DTO (Data Transfer Object)
 *
 * DTOs define the shape of data for API requests/responses and provide validation.
 * This DTO is used for creating new products via POST /products endpoint.
 */

import { IsString, IsNotEmpty, IsOptional, IsArray, ValidateNested, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for creating a product variant (SKU)
 */
export class CreateProductVariantDto {
  @IsString()
  @IsNotEmpty()
  sku: string;

  @IsNotEmpty()
  price: number;

  @IsString()
  @IsOptional()
  currency?: string = 'USD';

  @IsOptional()
  attributes?: Record<string, any>; // JSONB field for flexible attributes (size, color, etc.)

  @IsOptional()
  stock?: number = 0;
}

/**
 * DTO for creating a new product
 */
export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  slug: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductVariantDto)
  @IsOptional()
  variants?: CreateProductVariantDto[];
}

