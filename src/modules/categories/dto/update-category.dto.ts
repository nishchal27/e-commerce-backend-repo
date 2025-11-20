/**
 * Update Category DTO
 *
 * DTO for updating existing categories via PUT /categories/:id endpoint.
 */

import { PartialType } from '@nestjs/mapped-types';
import { CreateCategoryDto } from './create-category.dto';

/**
 * All fields from CreateCategoryDto are optional for updates
 */
export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}

