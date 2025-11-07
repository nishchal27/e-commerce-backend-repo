/**
 * Mailer Service
 *
 * This service provides email sending functionality for the application.
 * It handles template rendering, email queuing, and provider abstraction.
 *
 * Responsibilities:
 * - Render Handlebars email templates with data
 * - Queue emails for async processing via BullMQ
 * - Provide synchronous interface for immediate sending
 * - Support multiple email providers (Ethereal, SMTP, SendGrid)
 *
 * Architecture:
 * - Templates are stored as Handlebars files
 * - Emails are queued via BullMQ for async processing
 * - Provider abstraction allows switching between dev/prod providers
 * - Template rendering happens before queuing
 *
 * Usage:
 * - Use queueEmail() for async sending (recommended)
 * - Use sendEmail() for immediate sending (use sparingly)
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as fs from 'fs';
import * as path from 'path';
import * as handlebars from 'handlebars';
import { MailOptions, EmailTemplateData } from './interfaces/mail-options.interface';
import { IMailProvider } from './interfaces/mail-provider.interface';
import { EtherealProvider } from './providers/ethereal.provider';
import { SMTPProvider } from './providers/smtp.provider';

/**
 * Email template types
 */
export type EmailTemplate = 'verification' | 'password-reset' | 'welcome';

/**
 * MailerService handles email sending and template rendering
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly provider: IMailProvider;
  private readonly appName: string;
  private readonly appUrl: string;
  private readonly templatesPath: string;

  constructor(
    private readonly configService: ConfigService,
    @InjectQueue('mail') private readonly mailQueue: Queue,
    private readonly etherealProvider: EtherealProvider,
    private readonly smtpProvider: SMTPProvider,
  ) {
    // Load configuration
    const driver = this.configService.get<string>('MAILER_DRIVER', 'ethereal');
    this.appName = this.configService.get<string>('FROM_NAME', 'E-commerce Backend');
    this.appUrl = this.configService.get<string>('APP_URL', 'http://localhost:3000');
    this.templatesPath = path.join(__dirname, 'templates');

    // Initialize provider based on driver
    this.provider = this.initializeProvider(driver);

    this.logger.log(`Mailer service initialized with driver: ${driver}`);
  }

  /**
   * Initialize email provider based on driver configuration
   *
   * @param driver - Provider driver (ethereal, smtp, sendgrid, etc.)
   * @returns Initialized mail provider
   */
  private initializeProvider(driver: string): IMailProvider {
    switch (driver.toLowerCase()) {
      case 'ethereal':
        // Initialize Ethereal provider (async, but we'll verify later)
        this.etherealProvider.initialize().catch((error) => {
          this.logger.error('Failed to initialize Ethereal provider', error);
        });
        return this.etherealProvider;

      case 'smtp':
        return this.smtpProvider;

      default:
        this.logger.warn(`Unknown mailer driver: ${driver}. Using Ethereal as fallback.`);
        this.etherealProvider.initialize().catch((error) => {
          this.logger.error('Failed to initialize Ethereal provider', error);
        });
        return this.etherealProvider;
    }
  }

  /**
   * Queue an email for async processing
   *
   * This is the recommended method for sending emails.
   * Emails are queued and processed by BullMQ workers,
   * preventing email sending from blocking HTTP requests.
   *
   * @param template - Email template name
   * @param to - Recipient email address
   * @param subject - Email subject
   * @param data - Template data for rendering
   * @returns Promise resolving when email is queued
   */
  async queueEmail(
    template: EmailTemplate,
    to: string,
    subject: string,
    data: EmailTemplateData,
  ): Promise<void> {
    try {
      // Render template to HTML
      const html = await this.renderTemplate(template, data);

      // Add job to queue
      await this.mailQueue.add('send-email', {
        to,
        subject,
        html,
        template,
      });

      this.logger.debug(`Email queued: ${template} to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to queue email: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Send an email immediately (synchronously)
   *
   * Use this method sparingly, as it blocks the request.
   * Prefer queueEmail() for most use cases.
   *
   * @param template - Email template name
   * @param to - Recipient email address
   * @param subject - Email subject
   * @param data - Template data for rendering
   * @returns Promise resolving when email is sent
   */
  async sendEmail(
    template: EmailTemplate,
    to: string,
    subject: string,
    data: EmailTemplateData,
  ): Promise<void> {
    try {
      // Render template to HTML
      const html = await this.renderTemplate(template, data);

      // Send email via provider
      const result = await this.provider.sendMail({
        to,
        subject,
        html,
        template,
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to send email');
      }

      this.logger.log(`Email sent: ${template} to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send email: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Render email template with data
   *
   * Loads Handlebars template file, compiles it, and renders with provided data.
   * Adds common variables (appName, appUrl, year) to all templates.
   *
   * @param template - Template name (without .hbs extension)
   * @param data - Template variables
   * @returns Rendered HTML string
   */
  private async renderTemplate(
    template: EmailTemplate,
    data: EmailTemplateData,
  ): Promise<string> {
    try {
      // Load template file
      const templatePath = path.join(this.templatesPath, `${template}.hbs`);
      const templateContent = fs.readFileSync(templatePath, 'utf-8');

      // Compile template
      const compiledTemplate = handlebars.compile(templateContent);

      // Add common variables to all templates
      const templateData = {
        ...data,
        appName: this.appName,
        appUrl: this.appUrl,
        year: new Date().getFullYear(),
      };

      // Render template
      return compiledTemplate(templateData);
    } catch (error) {
      this.logger.error(`Failed to render template ${template}: ${error.message}`, error);
      throw new Error(`Template rendering failed: ${template}`);
    }
  }

  /**
   * Send email directly (used by processor)
   * Exposes provider's sendMail method for direct use
   *
   * @param options - Mail options
   * @returns Promise resolving when email is sent
   */
  async sendMailDirectly(options: MailOptions): Promise<void> {
    const result = await this.provider.sendMail(options);
    if (!result.success) {
      throw new Error(result.error || 'Failed to send email');
    }
  }

  /**
   * Verify email provider configuration
   * Called during module initialization to ensure provider is properly set up
   *
   * @returns True if provider is valid
   */
  async verifyProvider(): Promise<boolean> {
    return this.provider.verify();
  }

  /**
   * Get email provider (for processor access)
   * Exposes provider for use in mail processor
   */
  getProvider(): IMailProvider {
    return this.provider;
  }
}

