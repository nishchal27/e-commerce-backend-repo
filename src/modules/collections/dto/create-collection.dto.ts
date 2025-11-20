/**
 * Create Collection DTO
 *
 * DTO for creating new collections via POST /collections endpoint.
 */

import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsUrl, IsDateString } from 'class-validator';

/**
 * DTO for creating a new collection
 */
export class CreateCollectionDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  slug: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsUrl()
  @IsOptional()
  imageUrl?: string;

  @IsDateString()
  @IsOptional()
  startDate?: string; // ISO date string

  @IsDateString()
  @IsOptional()
  endDate?: string; // ISO date string

  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;
}

