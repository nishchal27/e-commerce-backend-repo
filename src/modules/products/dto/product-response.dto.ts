/**
 * Product Response DTO
 *
 * DTO for product API responses.
 * Ensures consistent response format and hides internal implementation details.
 */

import { Gender, ProductStatus } from '@prisma/client';

/**
 * Product variant response structure
 */
export class ProductVariantResponseDto {
  id: string;
  sku: string;
  price: number;
  compareAtPrice: number | null;
  currency: string;
  attributes: Record<string, any> | null;
  stock: number; // Legacy: total stock (deprecated in favor of InventoryStock)
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Product response structure with variants
 */
export class ProductResponseDto {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  categoryId: string | null;
  brandId: string | null;
  collectionId: string | null;
  gender: Gender | null;
  status: ProductStatus;
  metaTitle: string | null;
  metaDescription: string | null;
  isActive: boolean;
  deletedAt: Date | null;
  variants: ProductVariantResponseDto[];
  createdAt: Date;
  updatedAt: Date;
}

