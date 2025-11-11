/**
 * Structured logging service using Pino.
 *
 * Pino is a fast, low-overhead JSON logger that produces structured logs
 * which are easy to parse and search in log aggregation systems (ELK, Datadog, etc.).
 *
 * This wrapper provides:
 * - Environment-based log levels
 * - Pretty printing for development
 * - Request ID context propagation
 * - Consistent log format across the application
 */

import { Injectable, LoggerService as NestLoggerService, Optional, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import pino, { Logger as PinoLogger } from 'pino';
import pinoPretty from 'pino-pretty';

/**
 * Logger class that wraps Pino and implements NestJS LoggerService interface.
 * This allows it to be used as a drop-in replacement for the default NestJS logger.
 */
@Injectable()
export class Logger implements NestLoggerService {
  private readonly pinoLogger: PinoLogger;

  /**
   * Constructor initializes the Pino logger with configuration from environment variables.
   */
  constructor(@Optional() @Inject(ConfigService) private readonly configService?: ConfigService) {
    const logLevel = configService?.get<string>('LOG_LEVEL', 'info');
    const logPretty = configService?.get<boolean>('LOG_PRETTY', true);

    // Configure Pino logger
    const pinoOptions: pino.LoggerOptions = {
      level: logLevel,
      // In development, use pretty printing; in production, use JSON
      ...(logPretty && process.env.NODE_ENV !== 'production'
        ? {
            transport: {
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname',
              },
            },
          }
        : {}),
    };

    this.pinoLogger = pino(pinoOptions);
  }

  /**
   * Static factory method to create a logger instance.
   * Useful when creating logger outside of dependency injection context.
   */
  static createLogger(): PinoLogger {
    const logLevel = process.env.LOG_LEVEL || 'info';
    const logPretty = process.env.LOG_PRETTY !== 'false';

    const options: pino.LoggerOptions = {
      level: logLevel,
      ...(logPretty && process.env.NODE_ENV !== 'production'
        ? {
            transport: {
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname',
              },
            },
          }
        : {}),
    };

    return pino(options);
  }

  /**
   * Log a message at debug level.
   * Use for detailed diagnostic information useful during development.
   */
  debug(message: any, context?: string): void {
    this.pinoLogger.debug({ context }, message);
  }

  /**
   * Log a message at info level.
   * Use for general informational messages about application flow.
   */
  log(message: any, context?: string): void {
    this.pinoLogger.info({ context }, message);
  }

  /**
   * Log a message at warn level.
   * Use for warning messages about potentially harmful situations.
   */
  warn(message: any, context?: string): void {
    this.pinoLogger.warn({ context }, message);
  }

  /**
   * Log a message at error level.
   * Use for error events that might still allow the application to continue.
   */
  error(message: any, trace?: string, context?: string): void {
    this.pinoLogger.error({ context, trace }, message);
  }

  /**
   * Log a message at verbose level (aliased to debug).
   */
  verbose(message: any, context?: string): void {
    this.pinoLogger.debug({ context }, message);
  }

  /**
   * Get the underlying Pino logger instance.
   * Useful for advanced logging features not exposed by NestJS LoggerService interface.
   */
  getPinoLogger(): PinoLogger {
    return this.pinoLogger;
  }

  /**
   * Create a child logger with additional context.
   * Useful for adding request ID or other contextual information to all logs from a scope.
   */
  child(bindings: pino.Bindings): PinoLogger {
    return this.pinoLogger.child(bindings);
  }
}

