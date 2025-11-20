/**
 * Update Promotion DTO
 *
 * DTO for updating existing promotions via PUT /promotions/:id endpoint.
 */

import { PartialType } from '@nestjs/mapped-types';
import { CreatePromotionDto } from './create-promotion.dto';

/**
 * All fields from CreatePromotionDto are optional for updates
 */
export class UpdatePromotionDto extends PartialType(CreatePromotionDto) {}

