/**
 * SizeChart Response DTO
 *
 * DTO for size chart API responses.
 */

/**
 * Size chart response structure
 */
export class SizeChartResponseDto {
  id: string;
  productId: string;
  name: string;
  measurements: Record<string, any>; // JSON structure with size measurements
  createdAt: Date;
  updatedAt: Date;
}

