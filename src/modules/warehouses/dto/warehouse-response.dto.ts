/**
 * Warehouse Response DTO
 *
 * DTO for warehouse API responses.
 */

/**
 * Warehouse response structure
 */
export class WarehouseResponseDto {
  id: string;
  name: string;
  code: string;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

