/**
 * Supplier Response DTO
 *
 * DTO for supplier API responses.
 */

/**
 * Product cost response structure
 */
export class ProductCostResponseDto {
  id: string;
  variantId: string;
  supplierId: string | null;
  costPrice: number;
  currency: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Supplier response structure
 */
export class SupplierResponseDto {
  id: string;
  name: string;
  code: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  isActive: boolean;
  productCount?: number; // Optional: count of products from this supplier
  createdAt: Date;
  updatedAt: Date;
}

