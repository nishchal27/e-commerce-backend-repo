/**
 * Create SizeChart DTO
 *
 * DTO for creating size charts via POST /size-charts endpoint.
 */

import { IsString, IsNotEmpty, IsObject, IsUUID } from 'class-validator';

/**
 * DTO for creating a size chart
 */
export class CreateSizeChartDto {
  @IsUUID()
  @IsNotEmpty()
  productId: string; // Product UUID (one size chart per product)

  @IsString()
  @IsNotEmpty()
  name: string; // Size chart name (e.g., "US Men's Sizes", "EU Sizes")

  @IsObject()
  @IsNotEmpty()
  measurements: Record<string, any>; // JSON structure: { "S": { "chest": "38", "waist": "32", ... }, "M": {...} }
}

