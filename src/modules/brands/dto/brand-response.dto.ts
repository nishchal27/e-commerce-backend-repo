/**
 * Brand Response DTO
 *
 * DTO for brand API responses.
 */

/**
 * Brand response structure
 */
export class BrandResponseDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  website: string | null;
  isActive: boolean;
  productCount?: number; // Optional: count of products for this brand
  createdAt: Date;
  updatedAt: Date;
}

