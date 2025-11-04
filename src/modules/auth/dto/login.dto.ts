/**
 * Login DTO (Data Transfer Object)
 *
 * This DTO defines the structure and validation rules for user login requests.
 * It ensures that login credentials are properly formatted before authentication.
 *
 * Validation Rules:
 * - Email: Must be a valid email format and required
 * - Password: Required (not validated for length, as we'll check against stored hash)
 *
 * Security Considerations:
 * - Email format validation prevents injection attacks
 * - Password is not validated for format (we compare against stored hash)
 * - Generic error messages prevent email enumeration attacks (handled in service)
 */

import { IsEmail, IsString, IsNotEmpty } from 'class-validator';

/**
 * DTO for user login
 * Used by POST /auth/login endpoint
 */
export class LoginDto {
  /**
   * User's email address
   * Must match an existing user's email in the database
   * Used to identify which user is attempting to log in
   */
  @IsEmail({}, { message: 'Email must be a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  /**
   * User's password (plaintext)
   * Will be compared against the stored bcrypt hash
   * If valid, user receives access and refresh tokens
   *
   * Note: We don't validate password format here because:
   * - We'll compare against the stored hash (which handles all formats)
   * - Invalid passwords will fail hash comparison anyway
   * - We want to avoid revealing password requirements to attackers
   */
  @IsString({ message: 'Password must be a string' })
  @IsNotEmpty({ message: 'Password is required' })
  password: string;
}

