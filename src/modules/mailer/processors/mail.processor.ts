/**
 * Mail Processor
 *
 * This processor handles email jobs from the BullMQ queue.
 * It processes emails asynchronously, allowing HTTP requests to complete
 * without waiting for email sending to finish.
 *
 * Features:
 * - Async email processing (non-blocking)
 * - Automatic retries on failure
 * - Error handling and logging
 * - Job status tracking
 *
 * How it works:
 * 1. MailerService queues email jobs
 * 2. This processor picks up jobs from the queue
 * 3. Sends email via configured provider
 * 4. Logs success/failure
 * 5. Retries on failure (up to 3 attempts)
 */

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { MailerService } from '../mailer.service';
import { MailOptions } from '../interfaces/mail-options.interface';

/**
 * Email job data structure
 */
interface EmailJobData {
  to: string;
  subject: string;
  html: string;
  template?: string;
}

/**
 * MailProcessor processes email jobs from the queue
 * Uses @Processor decorator to register as a BullMQ processor
 */
@Processor('mail', {
  // Configuration for the processor
  concurrency: 5, // Process up to 5 emails concurrently
  limiter: {
    max: 10, // Maximum 10 emails per interval
    duration: 1000, // Per second (1000ms)
  },
})
export class MailProcessor extends WorkerHost {
  private readonly logger = new Logger(MailProcessor.name);

  constructor(private readonly mailerService: MailerService) {
    super();
  }

  /**
   * Process email job
   *
   * This method is called by BullMQ when an email job is available.
   * It sends the email via the mailer service provider.
   *
   * @param job - Email job from queue
   * @returns Promise resolving when email is sent
   */
  async process(job: Job<EmailJobData>): Promise<void> {
    const { to, subject, html, template } = job.data;

    this.logger.debug(`Processing email job ${job.id}: ${template} to ${to}`);

    try {
      // Get provider from mailer service and send email
      // Note: We need to access the provider directly or use sendEmail method
      // For now, we'll use a workaround - the mailer service should expose sendMail directly
      // Actually, let's create a method in MailerService that accepts MailOptions

      // Send email via provider
      // We'll need to refactor MailerService to expose the provider's sendMail method
      // Or create a method that accepts MailOptions directly
      await this.sendEmailDirectly({ to, subject, html, template });

      this.logger.log(`Email sent successfully: ${template} to ${to} (Job ${job.id})`);
    } catch (error) {
      this.logger.error(
        `Failed to send email: ${template} to ${to} (Job ${job.id}): ${error.message}`,
        error,
      );

      // Throw error to trigger retry mechanism
      // BullMQ will automatically retry the job (up to attempts limit)
      throw error;
    }
  }

  /**
   * Send email directly using mailer service
   * Uses MailerService's sendMailDirectly method
   *
   * @param options - Mail options
   */
  private async sendEmailDirectly(options: MailOptions): Promise<void> {
    await this.mailerService.sendMailDirectly(options);
  }
}

