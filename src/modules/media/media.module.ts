/**
 * Media Module
 *
 * This module encapsulates all media-related functionality:
 * - MediaController: HTTP endpoints
 * - MediaService: Business logic
 * - MediaRepository: Data access layer
 */

import { Module } from '@nestjs/common';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { MediaRepository } from './media.repository';
import { PrismaModule } from '../../lib/prisma/prisma.module';

/**
 * MediaModule provides media-related functionality
 */
@Module({
  imports: [PrismaModule],
  controllers: [MediaController],
  providers: [MediaService, MediaRepository],
  exports: [MediaService], // Export service for use in other modules
})
export class MediaModule {}

