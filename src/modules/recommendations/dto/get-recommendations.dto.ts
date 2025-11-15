/**
 * Get Recommendations DTO
 *
 * Defines the request parameters for getting product recommendations.
 */

import { IsUUID, IsOptional, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class GetRecommendationsDto {
  @IsUUID()
  @IsOptional()
  productId?: string; // For product-based recommendations

  @IsUUID()
  @IsOptional()
  userId?: string; // For user-based recommendations

  @IsNumber()
  @Min(1)
  @Max(50)
  @IsOptional()
  @Type(() => Number)
  limit?: number = 10; // Number of recommendations to return
}

