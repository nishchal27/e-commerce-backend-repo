/**
 * Update Product DTO
 *
 * DTO for updating existing products via PUT /products/:id endpoint.
 * Uses PartialType to make all fields optional.
 */

import { PartialType } from '@nestjs/mapped-types';
import { CreateProductDto } from './create-product.dto';

/**
 * All fields from CreateProductDto are optional for updates
 */
export class UpdateProductDto extends PartialType(CreateProductDto) {}

