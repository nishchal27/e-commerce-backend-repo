/**
 * Update Warehouse DTO
 *
 * DTO for updating existing warehouses via PUT /warehouses/:id endpoint.
 */

import { PartialType } from '@nestjs/mapped-types';
import { CreateWarehouseDto } from './create-warehouse.dto';

/**
 * All fields from CreateWarehouseDto are optional for updates
 */
export class UpdateWarehouseDto extends PartialType(CreateWarehouseDto) {}

