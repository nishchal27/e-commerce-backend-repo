/**
 * Main entry point for the NestJS e-commerce backend application.
 *
 * This file bootstraps the NestJS application, configures global middleware,
 * sets up CORS, enables validation pipes, and starts the HTTP server.
 * It also configures structured logging and request ID middleware for observability.
 */

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { Logger } from './lib/logger';
import { SecurityService } from './common/security/security.service';

/**
 * Bootstrap function that initializes and starts the NestJS application.
 * Configures:
 * - Global validation pipes for DTO validation
 * - CORS for cross-origin requests
 * - Request logging and request ID tracking
 * - Graceful shutdown handlers
 */
async function bootstrap() {
  // Create the NestJS application instance
  // Note: We'll use the default NestJS logger, Logger service is available via DI
  const app = await NestFactory.create(AppModule);

  // Get configuration service for environment variables
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');

  // Validate required secrets on startup
  const securityService = app.get(SecurityService);
  try {
    securityService.validateSecrets();
  } catch (error: any) {
    const logger = app.get(Logger);
    logger.error(
      `Security validation failed: ${error.message}`,
      error.stack,
      'Bootstrap',
    );
    // In production, exit if secrets are missing
    if (nodeEnv === 'production') {
      process.exit(1);
    }
  }

  // Enable global validation pipe - automatically validates DTOs using class-validator
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties that don't have decorators
      forbidNonWhitelisted: true, // Throw error if non-whitelisted properties are present
      transform: true, // Automatically transform payloads to DTO instances
      transformOptions: {
        enableImplicitConversion: true, // Enable implicit type conversion
      },
    }),
  );

  // Enable CORS for cross-origin requests (configure appropriately for production)
  app.enableCors({
    origin: nodeEnv === 'production' ? false : '*', // Allow all origins in dev, restrict in prod
    credentials: true,
  });

  // Start the HTTP server
  await app.listen(port);

  // Log application startup with port and environment
  const logger = app.get(Logger);
  logger.log(`Application is running on: http://localhost:${port}`, 'Bootstrap');
  logger.log(`Environment: ${nodeEnv}`, 'Bootstrap');
  logger.log(`Metrics endpoint: http://localhost:${port}/metrics`, 'Bootstrap');
}

// Execute bootstrap and handle any errors
bootstrap().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});

