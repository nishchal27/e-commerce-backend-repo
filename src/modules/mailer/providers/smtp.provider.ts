/**
 * SMTP Email Provider
 *
 * This provider uses standard SMTP for sending emails.
 * Can be configured to work with any SMTP server:
 * - MailHog (local development)
 * - SendGrid SMTP
 * - Gmail SMTP
 * - Custom SMTP servers
 *
 * Configuration:
 * - SMTP_HOST: SMTP server hostname
 * - SMTP_PORT: SMTP server port (usually 587 for TLS, 465 for SSL)
 * - SMTP_USER: SMTP username (if authentication required)
 * - SMTP_PASS: SMTP password (if authentication required)
 * - SMTP_SECURE: Whether to use TLS/SSL (true for port 465, false for 587)
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { IMailProvider, MailResult } from '../interfaces/mail-provider.interface';
import { MailOptions } from '../interfaces/mail-options.interface';

/**
 * SMTPProvider uses standard SMTP for email sending
 */
@Injectable()
export class SMTPProvider implements IMailProvider {
  private readonly logger = new Logger(SMTPProvider.name);
  private transporter: nodemailer.Transporter;
  private readonly fromEmail: string;
  private readonly fromName: string;

  constructor(private readonly configService: ConfigService) {
    // Load SMTP configuration from environment
    const host = this.configService.get<string>('SMTP_HOST', 'localhost');
    const port = this.configService.get<number>('SMTP_PORT', 1025);
    const secure = this.configService.get<boolean>('SMTP_SECURE', false);
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');

    // Email sender configuration
    this.fromEmail = this.configService.get<string>('FROM_EMAIL', 'no-reply@localhost');
    this.fromName = this.configService.get<string>('FROM_NAME', 'E-commerce Backend');

    // Create SMTP transporter
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure, // true for 465, false for other ports
      auth: user && pass
        ? {
            user,
            pass,
          }
        : undefined, // No auth if credentials not provided
    } as nodemailer.TransportOptions);

    this.logger.log(`SMTP provider initialized: ${host}:${port}`);
  }

  /**
   * Send email using SMTP
   *
   * @param options - Email options
   * @returns Mail result
   */
  async sendMail(options: MailOptions): Promise<MailResult> {
    try {
      // Send email via SMTP
      const info = await this.transporter.sendMail({
        from: `"${this.fromName}" <${this.fromEmail}>`, // Sender name and email
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });

      this.logger.debug(`Email sent via SMTP to ${options.to}. Message ID: ${info.messageId}`);

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error) {
      this.logger.error(`Failed to send email via SMTP: ${error.message}`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Verify SMTP provider configuration
   * Tests the connection to SMTP server
   *
   * @returns True if provider is properly configured
   */
  async verify(): Promise<boolean> {
    try {
      await this.transporter.verify();
      this.logger.log('SMTP provider verified successfully');
      return true;
    } catch (error) {
      this.logger.error('SMTP provider verification failed', error);
      return false;
    }
  }
}

