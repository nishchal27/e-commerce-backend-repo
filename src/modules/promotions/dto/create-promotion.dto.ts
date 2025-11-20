/**
 * Create Promotion DTO
 *
 * DTO for creating new promotions via POST /promotions endpoint.
 */

import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  IsDateString,
  IsInt,
  Min,
  IsBoolean,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Promotion type enum
 */
export enum PromotionType {
  PERCENTAGE = 'percentage',
  FIXED_AMOUNT = 'fixed_amount',
  FREE_SHIPPING = 'free_shipping',
}

/**
 * DTO for creating a new promotion
 */
export class CreatePromotionDto {
  @IsString()
  @IsNotEmpty()
  code: string; // Promo code (e.g., "SUMMER20")

  @IsString()
  @IsNotEmpty()
  name: string; // Promotion name

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(PromotionType)
  @IsNotEmpty()
  type: PromotionType; // "percentage", "fixed_amount", "free_shipping"

  @IsNumber()
  @Min(0)
  value: number; // Discount value (percentage or fixed amount)

  @IsNumber()
  @Min(0)
  @IsOptional()
  minPurchase?: number; // Minimum purchase amount

  @IsNumber()
  @Min(0)
  @IsOptional()
  maxDiscount?: number; // Maximum discount cap (for percentage)

  @IsDateString()
  @IsNotEmpty()
  startDate: string; // ISO date string

  @IsDateString()
  @IsNotEmpty()
  endDate: string; // ISO date string

  @IsInt()
  @Min(1)
  @IsOptional()
  usageLimit?: number; // Total usage limit (null = unlimited)

  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;

  @IsObject()
  @IsOptional()
  applicableCategories?: string[]; // Category IDs this promotion applies to (null = all)

  @IsObject()
  @IsOptional()
  applicableBrands?: string[]; // Brand IDs this promotion applies to (null = all)
}

