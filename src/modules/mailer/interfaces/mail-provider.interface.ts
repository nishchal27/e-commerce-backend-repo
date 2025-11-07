/**
 * Mail Provider Interface
 *
 * Defines the contract for email providers.
 * Allows different providers (Ethereal, SMTP, SendGrid) to be swapped
 * without changing the mailer service code.
 *
 * This abstraction enables:
 * - Easy switching between providers (dev vs production)
 * - Testing with mock providers
 * - Adding new providers without refactoring existing code
 */

import { MailOptions } from './mail-options.interface';

/**
 * Result of sending an email
 */
export interface MailResult {
  /**
   * Whether the email was sent successfully
   */
  success: boolean;

  /**
   * Message ID from the email provider (for tracking)
   */
  messageId?: string;

  /**
   * Error message if sending failed
   */
  error?: string;

  /**
   * Additional provider-specific data (e.g., preview URL for Ethereal)
   */
  metadata?: Record<string, any>;
}

/**
 * Mail provider interface
 * All email providers must implement this interface
 */
export interface IMailProvider {
  /**
   * Send an email
   *
   * @param options - Email options (to, subject, html, etc.)
   * @returns Promise resolving to mail result
   */
  sendMail(options: MailOptions): Promise<MailResult>;

  /**
   * Verify provider configuration
   * Called during module initialization to ensure provider is properly configured
   *
   * @returns Promise resolving to true if valid, false otherwise
   */
  verify(): Promise<boolean>;
}

