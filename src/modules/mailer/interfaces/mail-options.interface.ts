/**
 * Mail Options Interface
 *
 * Defines the structure for email sending options.
 * Used by mailer service to send emails with consistent formatting.
 */

/**
 * Options for sending an email
 */
export interface MailOptions {
  /**
   * Recipient email address
   */
  to: string;

  /**
   * Email subject line
   */
  subject: string;

  /**
   * HTML email body (rendered from template)
   */
  html: string;

  /**
   * Plain text email body (optional, for email clients that don't support HTML)
   */
  text?: string;

  /**
   * Email template name (for logging and tracking)
   */
  template?: string;
}

/**
 * Email template data
 * Used to pass variables to Handlebars templates
 */
export interface EmailTemplateData {
  [key: string]: any;
}

