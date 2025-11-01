/**
 * Prisma Service
 *
 * This service provides a singleton instance of Prisma Client for database access.
 * It handles:
 * - Prisma Client initialization
 * - Connection lifecycle management
 * - Graceful shutdown on application termination
 *
 * Prisma Client is automatically generated from schema.prisma by running:
 * npm run prisma:generate
 */

import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * PrismaService wraps Prisma Client and provides lifecycle hooks for connection management.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  /**
   * Constructor initializes Prisma Client.
   * In production, enable query logging for debugging:
   * super({ log: ['query', 'info', 'warn', 'error'] })
   */
  constructor() {
    super({
      // Enable query logging in development for debugging
      log:
        process.env.NODE_ENV === 'development'
          ? ['query', 'info', 'warn', 'error']
          : ['error'],
    });
  }

  /**
   * Called when the module is initialized.
   * Establishes connection to the database.
   */
  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('Connected to PostgreSQL database');
    } catch (error) {
      this.logger.error('Failed to connect to database', error);
      throw error;
    }
  }

  /**
   * Called when the module is destroyed (application shutdown).
   * Closes the database connection gracefully.
   */
  async onModuleDestroy(): Promise<void> {
    try {
      await this.$disconnect();
      this.logger.log('Disconnected from PostgreSQL database');
    } catch (error) {
      this.logger.error('Error disconnecting from database', error);
    }
  }

  /**
   * Health check method to verify database connection.
   * Can be used in health check endpoints.
   */
  async isHealthy(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}

