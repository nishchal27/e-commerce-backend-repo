/**
 * Register DTO (Data Transfer Object)
 *
 * This DTO defines the structure and validation rules for user registration requests.
 * It ensures that incoming registration data is properly validated before processing.
 *
 * Validation Rules:
 * - Email: Must be a valid email format and required
 * - Password: Minimum 8 characters, required (complexity enforced by business rules)
 * - Name: Optional display name for the user
 *
 * Security Considerations:
 * - Password length is enforced to prevent weak passwords
 * - Email validation prevents malformed email addresses
 * - All fields are validated server-side (never trust client input)
 */

import { IsEmail, IsString, IsNotEmpty, MinLength, IsOptional, MaxLength } from 'class-validator';

/**
 * DTO for user registration
 * Used by POST /auth/register endpoint
 */
export class RegisterDto {
  /**
   * User's email address
   * Must be a valid email format and unique in the system
   * Used for authentication and communication
   */
  @IsEmail({}, { message: 'Email must be a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  /**
   * User's password
   * Minimum 8 characters required for security
   * Will be hashed using bcrypt (12 rounds) before storage
   * Note: Additional password complexity rules can be enforced in business logic
   */
  @IsString({ message: 'Password must be a string' })
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;

  /**
   * User's display name (optional)
   * Used for personalization and display purposes
   * If not provided, can be derived from email or set later
   */
  @IsString({ message: 'Name must be a string' })
  @IsOptional()
  @MaxLength(100, { message: 'Name must not exceed 100 characters' })
  name?: string;
}

