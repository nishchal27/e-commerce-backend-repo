/**
 * Update Return DTO
 *
 * DTO for updating existing returns via PUT /returns/:id endpoint.
 */

import { IsEnum, IsOptional, IsString, IsNumber, Min } from 'class-validator';
import { ReturnStatus, ReturnReason } from '@prisma/client';

/**
 * DTO for updating a return
 */
export class UpdateReturnDto {
  @IsEnum(ReturnStatus)
  @IsOptional()
  status?: ReturnStatus; // New return status

  @IsEnum(ReturnReason)
  @IsOptional()
  reason?: ReturnReason; // Update reason

  @IsString()
  @IsOptional()
  reasonDetails?: string; // Additional details

  @IsNumber()
  @Min(0)
  @IsOptional()
  refundAmount?: number; // Refund amount

  @IsString()
  @IsOptional()
  notes?: string; // Admin notes
}

