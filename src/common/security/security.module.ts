/**
 * Security Module
 *
 * Provides security utilities and hardening features.
 */

import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SecurityService } from './security.service';
import { LoggerModule } from '../../lib/logger/logger.module';

@Global() // Make SecurityService available globally
@Module({
  imports: [ConfigModule, LoggerModule],
  providers: [SecurityService],
  exports: [SecurityService],
})
export class SecurityModule {}

