/**
 * Update Brand DTO
 *
 * DTO for updating existing brands via PUT /brands/:id endpoint.
 */

import { PartialType } from '@nestjs/mapped-types';
import { CreateBrandDto } from './create-brand.dto';

/**
 * All fields from CreateBrandDto are optional for updates
 */
export class UpdateBrandDto extends PartialType(CreateBrandDto) {}

