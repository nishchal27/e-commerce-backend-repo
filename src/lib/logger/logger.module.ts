/**
 * Logger Module
 *
 * Global module that provides the Logger service throughout the application.
 * Marked as Global so it doesn't need to be imported in every module.
 */

import { Global, Module } from '@nestjs/common';
import { Logger } from '../logger';

/**
 * Global Logger module that provides logging service throughout the application.
 * Marked as Global so LoggerService doesn't need to be imported in every module.
 */
@Global()
@Module({
  providers: [Logger],
  exports: [Logger],
})
export class LoggerModule {}

