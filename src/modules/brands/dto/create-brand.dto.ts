/**
 * Create Brand DTO
 *
 * DTO for creating new brands via POST /brands endpoint.
 */

import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsUrl } from 'class-validator';

/**
 * DTO for creating a new brand
 */
export class CreateBrandDto {
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
  logoUrl?: string;

  @IsUrl()
  @IsOptional()
  website?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;
}

