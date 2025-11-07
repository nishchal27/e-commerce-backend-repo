/**
 * Ethereal Email Provider
 *
 * This provider uses Ethereal Email (https://ethereal.email) for development.
 * Ethereal creates temporary email accounts that capture all sent emails
 * without actually sending them to real recipients.
 *
 * Features:
 * - Free, no API keys required
 * - Provides preview URLs for viewing sent emails
 * - Perfect for development and testing
 * - No deliverability concerns
 *
 * Usage:
 * - Set MAILER_DRIVER=ethereal in development
 * - All emails are captured and can be viewed via preview URL
 * - No real emails are sent (safe for testing)
 */

import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { IMailProvider, MailResult } from '../interfaces/mail-provider.interface';
import { MailOptions } from '../interfaces/mail-options.interface';

/**
 * EtherealProvider uses Ethereal Email for development email sending
 */
@Injectable()
export class EtherealProvider implements IMailProvider {
  private readonly logger = new Logger(EtherealProvider.name);
  private transporter: nodemailer.Transporter;

  /**
   * Initialize Ethereal email transporter
   * Creates a test account if one doesn't exist
   */
  async initialize(): Promise<void> {
    try {
      // Create a test account using Ethereal
      // This returns credentials for a temporary email account
      const testAccount = await nodemailer.createTestAccount();

      // Create transporter with Ethereal credentials
      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false, // true for 465, false for other ports
        auth: {
          user: testAccount.user, // Generated Ethereal user
          pass: testAccount.pass, // Generated Ethereal password
        },
      });

      this.logger.log(
        `Ethereal email provider initialized. Test account: ${testAccount.user}`,
      );
      this.logger.log(
        `View sent emails at: https://ethereal.email/messages`,
      );
    } catch (error) {
      this.logger.error('Failed to initialize Ethereal provider', error);
      throw error;
    }
  }

  /**
   * Send email using Ethereal
   *
   * @param options - Email options
   * @returns Mail result with preview URL
   */
  async sendMail(options: MailOptions): Promise<MailResult> {
    try {
      // Ensure transporter is initialized
      if (!this.transporter) {
        await this.initialize();
      }

      // Send email
      const info = await this.transporter.sendMail({
        from: options.to, // Use recipient as sender for Ethereal
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });

      // Get preview URL from Ethereal
      const previewUrl = nodemailer.getTestMessageUrl(info);

      this.logger.debug(
        `Email sent via Ethereal. Preview URL: ${previewUrl}`,
      );

      return {
        success: true,
        messageId: info.messageId,
        metadata: {
          previewUrl, // URL to view the email in browser
          etherealAccount: info.envelope.from,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to send email via Ethereal: ${error.message}`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Verify Ethereal provider configuration
   * Tests the connection to Ethereal email service
   *
   * @returns True if provider is properly configured
   */
  async verify(): Promise<boolean> {
    try {
      if (!this.transporter) {
        await this.initialize();
      }

      // Verify transporter connection
      await this.transporter.verify();
      return true;
    } catch (error) {
      this.logger.error('Ethereal provider verification failed', error);
      return false;
    }
  }
}

