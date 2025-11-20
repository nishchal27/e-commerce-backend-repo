/**
 * Collection Response DTO
 *
 * DTO for collection API responses.
 */

/**
 * Collection response structure
 */
export class CollectionResponseDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  startDate: Date | null;
  endDate: Date | null;
  isActive: boolean;
  productCount?: number; // Optional: count of products in this collection
  isActiveNow?: boolean; // Optional: whether collection is currently active (within date range)
  createdAt: Date;
  updatedAt: Date;
}

