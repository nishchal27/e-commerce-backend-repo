/**
 * Update Supplier DTO
 *
 * DTO for updating existing suppliers via PUT /suppliers/:id endpoint.
 */

import { PartialType } from '@nestjs/mapped-types';
import { CreateSupplierDto } from './create-supplier.dto';

/**
 * All fields from CreateSupplierDto are optional for updates
 */
export class UpdateSupplierDto extends PartialType(CreateSupplierDto) {}

