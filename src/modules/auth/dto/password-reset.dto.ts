/**
 * Password Reset DTOs (Data Transfer Object)
 *
 * These DTOs define the structure and validation rules for password reset requests.
 * There are two DTOs:
 * 1. ForgotPasswordDto - Request password reset (sends email)
 * 2. ResetPasswordDto - Complete password reset (with token)
 *
 * Security Considerations:
 * - Reset tokens are signed JWTs (not guessable)
 * - Tokens expire after 1 hour
 * - Tokens are single-use (invalidated after reset)
 * - New password must meet minimum requirements
 */

import { IsString, IsEmail, IsNotEmpty, MinLength } from 'class-validator';

/**
 * DTO for requesting password reset
 * Used by POST /auth/forgot-password endpoint
 *
 * User provides their email address, and a reset token is sent to that email.
 */
export class ForgotPasswordDto {
  /**
   * User's email address
   * Must match an existing user's email in the database
   * A password reset token will be sent to this email
   */
  @IsEmail({}, { message: 'Email must be a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;
}

/**
 * DTO for completing password reset
 * Used by POST /auth/reset-password endpoint
 *
 * User provides the reset token (from email) and new password.
 */
export class ResetPasswordDto {
  /**
   * Password reset token
   * This is a signed JWT token sent to the user's email address
   * Contains: userId, email, type='password_reset', exp (1h)
   *
   * Format: JWT token string
   */
  @IsString({ message: 'Token must be a string' })
  @IsNotEmpty({ message: 'Reset token is required' })
  token: string;

  /**
   * New password
   * Must be at least 8 characters long
   * Will be hashed using bcrypt before storage
   */
  @IsString({ message: 'Password must be a string' })
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;
}

