/**
 * Custom Authentication Exceptions
 *
 * This module defines custom exception classes for authentication-related errors.
 * These exceptions provide more specific error information while maintaining security
 * (e.g., not revealing sensitive details to potential attackers).
 *
 * Benefits:
 * - More specific error types for better error handling
 * - Consistent error messages across the application
 * - Better logging and monitoring capabilities
 * - Security-focused (generic messages to prevent enumeration)
 */

import {
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';

/**
 * Exception thrown when user credentials are invalid.
 * Used for login attempts with wrong email or password.
 *
 * Security: Generic message prevents email enumeration attacks.
 */
export class InvalidCredentialsException extends UnauthorizedException {
  constructor() {
    super('Invalid credentials');
  }
}

/**
 * Exception thrown when a token has expired.
 * Used for JWT access tokens, refresh tokens, verification tokens, and reset tokens.
 */
export class TokenExpiredException extends UnauthorizedException {
  constructor(tokenType: string = 'Token') {
    super(`${tokenType} expired`);
  }
}

/**
 * Exception thrown when a token is invalid or malformed.
 * Used for JWT verification failures, invalid refresh tokens, etc.
 */
export class InvalidTokenException extends UnauthorizedException {
  constructor(tokenType: string = 'Token') {
    super(`Invalid ${tokenType.toLowerCase()}`);
  }
}

/**
 * Exception thrown when a token has been reused (security violation).
 * Used when a refresh token is used after it has been rotated.
 *
 * Security: This indicates a potential token theft or replay attack.
 */
export class TokenReusedException extends UnauthorizedException {
  constructor() {
    super('Token has been used and is no longer valid. Please log in again.');
  }
}

/**
 * Exception thrown when user's email is not verified.
 * Used to restrict access to certain features until email is verified.
 */
export class EmailNotVerifiedException extends ForbiddenException {
  constructor() {
    super('Email address not verified. Please verify your email before continuing.');
  }
}

/**
 * Exception thrown when a password reset token has already been used.
 * Password reset tokens are single-use for security.
 */
export class PasswordResetTokenUsedException extends BadRequestException {
  constructor() {
    super('Password reset token has already been used. Please request a new one.');
  }
}

/**
 * Exception thrown when an email verification token has already been used.
 * While verification is idempotent, this can be used for tracking purposes.
 */
export class EmailVerificationTokenUsedException extends BadRequestException {
  constructor() {
    super('Email verification token has already been used.');
  }
}

