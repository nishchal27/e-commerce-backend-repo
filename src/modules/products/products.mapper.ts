/**
 * Products Mapper
 *
 * Maps Prisma database models to API response DTOs.
 * Handles type conversions (e.g., Decimal to number).
 */

import { ProductResponseDto, ProductVariantResponseDto } from './dto/product-response.dto';
import { ProductWithVariants } from './products.repository';

/**
 * Convert Prisma's Decimal type to number
 */
function decimalToNumber(value: any): number {
  if (value === null || value === undefined) {
    return 0;
  }
  // Prisma Decimal has a toNumber() method
  if (typeof value === 'object' && 'toNumber' in value) {
    return value.toNumber();
  }
  // If it's already a number or string, convert it
  return typeof value === 'number' ? value : parseFloat(String(value));
}

/**
 * Map product variant from Prisma model to response DTO
 */
function mapVariantToDto(variant: any): ProductVariantResponseDto {
  return {
    id: variant.id,
    sku: variant.sku,
    price: decimalToNumber(variant.price),
    currency: variant.currency,
    attributes: variant.attributes,
    stock: variant.stock,
    createdAt: variant.createdAt,
    updatedAt: variant.updatedAt,
  };
}

/**
 * Map product with variants from Prisma model to response DTO
 */
export function mapProductToDto(product: ProductWithVariants): ProductResponseDto {
  return {
    id: product.id,
    slug: product.slug,
    title: product.title,
    description: product.description,
    categoryId: product.categoryId,
    variants: product.variants.map(mapVariantToDto),
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

