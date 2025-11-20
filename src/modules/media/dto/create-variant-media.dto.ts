/**
 * Create Variant Media DTO
 *
 * DTO for creating variant media (images) via POST /media/variants/:variantId endpoint.
 */

import { IsString, IsNotEmpty, IsOptional, IsInt, Min, IsUrl } from 'class-validator';

/**
 * DTO for creating variant media
 */
export class CreateVariantMediaDto {
  @IsUrl()
  @IsNotEmpty()
  url: string; // Image URL

  @IsString()
  @IsOptional()
  alt?: string; // Alt text

  @IsString()
  @IsOptional()
  type?: string = 'image'; // image, video, etc.

  @IsInt()
  @Min(0)
  @IsOptional()
  position?: number = 0; // Sort order
}

