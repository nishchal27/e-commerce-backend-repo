/**
 * Create Product Cost DTO
 *
 * DTO for creating/updating product cost data via POST /suppliers/costs endpoint.
 */

import { IsUUID, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

/**
 * DTO for creating/updating product cost
 */
export class CreateProductCostDto {
  @IsUUID()
  @IsNotEmpty()
  variantId: string; // Product variant UUID

  @IsUUID()
  @IsOptional()
  supplierId?: string; // Supplier UUID (optional)

  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  costPrice: number; // Cost price from supplier

  @IsString()
  @IsOptional()
  currency?: string = 'USD';

  @IsString()
  @IsOptional()
  notes?: string;
}

