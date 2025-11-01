/**
 * Product Response DTO
 *
 * DTO for product API responses.
 * Ensures consistent response format and hides internal implementation details.
 */

/**
 * Product variant response structure
 */
export class ProductVariantResponseDto {
  id: string;
  sku: string;
  price: number;
  currency: string;
  attributes: Record<string, any> | null;
  stock: number;
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
  variants: ProductVariantResponseDto[];
  createdAt: Date;
  updatedAt: Date;
}

