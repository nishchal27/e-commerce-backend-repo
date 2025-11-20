/**
 * Create Product DTO (Data Transfer Object)
 *
 * DTOs define the shape of data for API requests/responses and provide validation.
 * This DTO is used for creating new products via POST /products endpoint.
 */

import { IsString, IsNotEmpty, IsOptional, IsArray, ValidateNested, IsUUID, IsEnum, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { Gender, ProductStatus } from '@prisma/client';

/**
 * DTO for creating a product variant (SKU)
 */
export class CreateProductVariantDto {
  @IsString()
  @IsNotEmpty()
  sku: string;

  @IsNotEmpty()
  price: number;

  @IsOptional()
  compareAtPrice?: number; // Original price for showing discounts

  @IsString()
  @IsOptional()
  currency?: string = 'USD';

  @IsOptional()
  attributes?: Record<string, any>; // JSONB field for flexible attributes (size, color, etc.)

  @IsOptional()
  stock?: number = 0; // Legacy: total stock (deprecated in favor of InventoryStock)

  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
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

  @IsUUID()
  @IsOptional()
  brandId?: string;

  @IsUUID()
  @IsOptional()
  collectionId?: string;

  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender;

  @IsEnum(ProductStatus)
  @IsOptional()
  status?: ProductStatus = ProductStatus.DRAFT;

  @IsString()
  @IsOptional()
  metaTitle?: string; // SEO meta title

  @IsString()
  @IsOptional()
  metaDescription?: string; // SEO meta description

  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductVariantDto)
  @IsOptional()
  variants?: CreateProductVariantDto[];
}

