/**
 * Create Return DTO
 *
 * DTO for creating new returns via POST /returns endpoint.
 */

import {
  IsUUID,
  IsNotEmpty,
  IsEnum,
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsInt,
  Min,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ReturnReason } from '@prisma/client';

/**
 * DTO for a return item
 */
export class CreateReturnItemDto {
  @IsUUID()
  @IsNotEmpty()
  orderItemId: string; // OrderItem ID being returned

  @IsInt()
  @Min(1)
  quantity: number; // Quantity being returned

  @IsEnum(ReturnReason)
  @IsOptional()
  reason?: ReturnReason; // Reason for returning this item
}

/**
 * DTO for creating a new return
 */
export class CreateReturnDto {
  @IsUUID()
  @IsNotEmpty()
  orderId: string; // Order ID

  @IsUUID()
  @IsNotEmpty()
  userId: string; // User ID requesting return

  @IsEnum(ReturnReason)
  @IsNotEmpty()
  reason: ReturnReason; // Primary reason for return

  @IsString()
  @IsOptional()
  reasonDetails?: string; // Additional details

  @IsArray()
  @ArrayMinSize(1, { message: 'Return must contain at least one item' })
  @ValidateNested({ each: true })
  @Type(() => CreateReturnItemDto)
  items: CreateReturnItemDto[]; // Items being returned
}

