/**
 * Mailer Module
 *
 * This module provides email sending functionality for the application.
 * It configures BullMQ queue for async email processing and provides
 * email providers (Ethereal for dev, SMTP for production).
 *
 * Responsibilities:
 * - Configure BullMQ queue for email jobs
 * - Register email providers (Ethereal, SMTP)
 * - Register mail processor (worker)
 * - Export MailerService for use in other modules
 *
 * Integration:
 * - Uses Redis (via RedisModule) for BullMQ queue
 * - Uses ConfigService for email configuration
 * - Provides MailerService for sending emails
 */

import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { MailerService } from './mailer.service';
import { MailProcessor } from './processors/mail.processor';
import { EtherealProvider } from './providers/ethereal.provider';
import { SMTPProvider } from './providers/smtp.provider';

/**
 * MailerModule provides email sending functionality
 */
@Module({
  imports: [
    // Configure BullMQ connection (uses Redis)
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        // Get Redis URL for BullMQ (can reuse REDIS_URL or use BULLMQ_REDIS_URL)
        const redisUrl =
          configService.get<string>('BULLMQ_REDIS_URL') ||
          configService.get<string>('REDIS_URL') ||
          'redis://localhost:6379';

        return {
          connection: {
            // Parse Redis URL or use default connection
            // BullMQ will handle Redis connection string parsing
            host: configService.get<string>('REDIS_HOST', 'localhost'),
            port: configService.get<number>('REDIS_PORT', 6379),
            password: configService.get<string>('REDIS_PASSWORD'),
            // If REDIS_URL is provided, use it directly
            ...(redisUrl.startsWith('redis://') || redisUrl.startsWith('rediss://')
              ? { url: redisUrl }
              : {}),
          },
        };
      },
      inject: [ConfigService],
    }),

    // Register mail queue
    BullModule.registerQueue({
      name: 'mail',
      defaultJobOptions: {
        // Retry configuration
        attempts: 3, // Retry up to 3 times on failure
        backoff: {
          type: 'exponential', // Exponential backoff
          delay: 2000, // Initial delay: 2 seconds
        },
        // Remove job after completion (keep queue clean)
        removeOnComplete: {
          age: 3600, // Keep completed jobs for 1 hour
          count: 100, // Keep last 100 completed jobs
        },
        // Remove failed jobs after some time
        removeOnFail: {
          age: 86400, // Keep failed jobs for 24 hours (for debugging)
        },
      },
    }),
  ],
  providers: [
    // Email providers
    EtherealProvider, // For development (captures emails without sending)
    SMTPProvider, // For production (sends via SMTP)

    // Mailer service (main service for sending emails)
    MailerService,

    // Mail processor (BullMQ worker for async email processing)
    MailProcessor,
  ],
  exports: [
    // Export MailerService for use in other modules (e.g., AuthModule)
    MailerService,
  ],
})
export class MailerModule implements OnModuleInit {
  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Called when module is initialized
   * Verifies email provider configuration
   */
  async onModuleInit(): Promise<void> {
    // Verify email provider is properly configured
    const isVerified = await this.mailerService.verifyProvider();

    if (!isVerified) {
      const driver = this.configService.get<string>('MAILER_DRIVER', 'ethereal');
      console.warn(
        `⚠️  Email provider (${driver}) verification failed. Emails may not be sent.`,
      );
    } else {
      console.log('✅ Email provider verified successfully');
    }
  }
}

