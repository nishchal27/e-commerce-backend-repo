/**
 * Media Response DTO
 *
 * DTO for media API responses.
 */

/**
 * Product media response structure
 */
export class ProductMediaResponseDto {
  id: string;
  productId: string;
  url: string;
  alt: string | null;
  type: string;
  position: number;
  isPrimary: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Variant media response structure
 */
export class VariantMediaResponseDto {
  id: string;
  variantId: string;
  url: string;
  alt: string | null;
  type: string;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

