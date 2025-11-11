/**
 * Logger Module
 *
 * Global module that provides the Logger service throughout the application.
 * Marked as Global so it doesn't need to be imported in every module.
 */

import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Logger } from '../logger';

/**
 * Global Logger module that provides logging service throughout the application.
 * Marked as Global so LoggerService doesn't need to be imported in every module.
 */
@Global()
@Module({
  imports: [ConfigModule], // Import ConfigModule to ensure ConfigService is available for Logger
  providers: [Logger],
  exports: [Logger],
})
export class LoggerModule {}

