/**
 * Verify Email DTO (Data Transfer Object)
 *
 * This DTO defines the structure and validation rules for email verification requests.
 * Users receive a verification token via email and submit it to verify their email address.
 *
 * Validation Rules:
 * - Token: Required, must be a valid JWT string
 *
 * Security Considerations:
 * - Token is a signed JWT (not guessable)
 * - Token expires after 24 hours
 * - Token is single-use (invalidated after verification)
 * - Token contains user ID and email for verification
 */

import { IsString, IsNotEmpty } from 'class-validator';

/**
 * DTO for email verification
 * Used by POST /auth/verify endpoint
 */
export class VerifyEmailDto {
  /**
   * Email verification token
   * This is a signed JWT token sent to the user's email address
   * Contains: userId, email, type='email_verification', exp (24h)
   *
   * Format: JWT token string (e.g., "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...")
   */
  @IsString({ message: 'Token must be a string' })
  @IsNotEmpty({ message: 'Verification token is required' })
  token: string;
}

