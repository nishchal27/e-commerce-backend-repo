/**
 * Validate Promotion DTO
 *
 * DTO for validating a promotion code.
 */

import { IsString, IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator';

/**
 * DTO for validating a promotion code
 */
export class ValidatePromotionDto {
  @IsString()
  @IsNotEmpty()
  code: string; // Promotion code to validate

  @IsNumber()
  @Min(0)
  @IsOptional()
  orderAmount?: number; // Order amount to calculate discount

  @IsString()
  @IsOptional()
  categoryId?: string; // Category ID to check applicability

  @IsString()
  @IsOptional()
  brandId?: string; // Brand ID to check applicability
}

