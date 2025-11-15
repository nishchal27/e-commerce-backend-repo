/**
 * Tracing Module
 *
 * This module provides OpenTelemetry distributed tracing functionality.
 */

import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TracingService } from './tracing.service';
import { LoggerModule } from '../../../lib/logger/logger.module';

@Global() // Make TracingService available globally
@Module({
  imports: [ConfigModule, LoggerModule],
  providers: [TracingService],
  exports: [TracingService],
})
export class TracingModule {}

