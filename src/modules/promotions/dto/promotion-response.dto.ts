/**
 * Promotion Response DTO
 *
 * DTO for promotion API responses.
 */

/**
 * Promotion response structure
 */
export class PromotionResponseDto {
  id: string;
  code: string;
  name: string;
  description: string | null;
  type: string; // "percentage", "fixed_amount", "free_shipping"
  value: number;
  minPurchase: number | null;
  maxDiscount: number | null;
  startDate: Date;
  endDate: Date;
  usageLimit: number | null;
  usageCount: number;
  isActive: boolean;
  applicableCategories: string[] | null;
  applicableBrands: string[] | null;
  isValid?: boolean; // Optional: whether promotion is currently valid
  discountAmount?: number; // Optional: calculated discount amount
  createdAt: Date;
  updatedAt: Date;
}

