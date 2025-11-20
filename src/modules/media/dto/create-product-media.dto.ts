/**
 * Create Product Media DTO
 *
 * DTO for creating product media (images) via POST /media/products/:productId endpoint.
 */

import { IsString, IsNotEmpty, IsOptional, IsInt, Min, IsBoolean, IsUrl } from 'class-validator';

/**
 * DTO for creating product media
 */
export class CreateProductMediaDto {
  @IsUrl()
  @IsNotEmpty()
  url: string; // Image URL

  @IsString()
  @IsOptional()
  alt?: string; // Alt text for accessibility

  @IsString()
  @IsOptional()
  type?: string = 'image'; // image, video, etc.

  @IsInt()
  @Min(0)
  @IsOptional()
  position?: number = 0; // Sort order for gallery

  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean = false; // Primary product image
}

