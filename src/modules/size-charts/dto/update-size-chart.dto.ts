/**
 * Update SizeChart DTO
 *
 * DTO for updating existing size charts via PUT /size-charts/:id endpoint.
 */

import { IsString, IsOptional, IsObject } from 'class-validator';

/**
 * DTO for updating a size chart
 */
export class UpdateSizeChartDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsObject()
  @IsOptional()
  measurements?: Record<string, any>;
}

