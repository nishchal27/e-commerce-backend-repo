/**
 * Update Media DTO
 *
 * DTO for updating existing media via PUT /media/:id endpoint.
 */

import { IsString, IsOptional, IsInt, Min, IsBoolean, IsUrl } from 'class-validator';

/**
 * DTO for updating media
 */
export class UpdateMediaDto {
  @IsUrl()
  @IsOptional()
  url?: string;

  @IsString()
  @IsOptional()
  alt?: string;

  @IsString()
  @IsOptional()
  type?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  position?: number;

  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean; // For product media only
}

