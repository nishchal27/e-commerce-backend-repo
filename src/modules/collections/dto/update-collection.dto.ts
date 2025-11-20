/**
 * Update Collection DTO
 *
 * DTO for updating existing collections via PUT /collections/:id endpoint.
 */

import { PartialType } from '@nestjs/mapped-types';
import { CreateCollectionDto } from './create-collection.dto';

/**
 * All fields from CreateCollectionDto are optional for updates
 */
export class UpdateCollectionDto extends PartialType(CreateCollectionDto) {}

