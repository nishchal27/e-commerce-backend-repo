/**
 * Create Warehouse DTO
 *
 * DTO for creating new warehouses via POST /warehouses endpoint.
 */

import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

/**
 * DTO for creating a new warehouse
 */
export class CreateWarehouseDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  code: string; // Warehouse code (e.g., "WH-NYC-01")

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  state?: string;

  @IsString()
  @IsOptional()
  country?: string;

  @IsString()
  @IsOptional()
  postalCode?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;
}

