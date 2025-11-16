/**
 * Security Service
 *
 * Provides security utilities and hardening features.
 * Includes secret management, input sanitization, and security headers.
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from '../../lib/logger';
import * as crypto from 'crypto';

@Injectable()
export class SecurityService {
  constructor(
    private readonly configService: ConfigService,
    private readonly logger: Logger,
  ) {}

  /**
   * Validate that required secrets are set
   * Throws error if critical secrets are missing
   */
  validateSecrets(): void {
    const requiredSecrets = [
      'JWT_SECRET',
      'JWT_REFRESH_SECRET',
      'DATABASE_URL',
    ];

    const missingSecrets: string[] = [];

    for (const secret of requiredSecrets) {
      const value = this.configService.get<string>(secret);
      if (!value || value.trim() === '') {
        missingSecrets.push(secret);
      }
    }

    if (missingSecrets.length > 0) {
      throw new Error(
        `Missing required secrets: ${missingSecrets.join(', ')}. Please set them in environment variables.`,
      );
    }

    this.logger.log('All required secrets are configured', 'SecurityService');
  }

  /**
   * Sanitize user input to prevent XSS
   * Removes potentially dangerous characters
   */
  sanitizeInput(input: string): string {
    if (typeof input !== 'string') {
      return input;
    }

    // Remove HTML tags
    let sanitized = input.replace(/<[^>]*>/g, '');

    // Remove script tags and event handlers
    sanitized = sanitized.replace(/javascript:/gi, '');
    sanitized = sanitized.replace(/on\w+\s*=/gi, '');

    // Trim whitespace
    sanitized = sanitized.trim();

    return sanitized;
  }

  /**
   * Generate a secure random token
   */
  generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Hash sensitive data (one-way hash)
   */
  hashSensitiveData(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Validate password strength
   */
  validatePasswordStrength(password: string): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[^A-Za-z0-9]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check if request should be rate limited based on IP
   * Returns true if rate limit should be applied
   */
  shouldRateLimit(ipAddress: string, endpoint: string): boolean {
    // Admin endpoints should always be rate limited
    if (endpoint.includes('/admin')) {
      return true;
    }

    // Auth endpoints should be rate limited
    if (endpoint.includes('/auth')) {
      return true;
    }

    // Payment endpoints should be rate limited
    if (endpoint.includes('/payments')) {
      return true;
    }

    return false;
  }

  /**
   * Mask sensitive data in logs
   */
  maskSensitiveData(data: string, visibleChars: number = 4): string {
    if (!data || data.length <= visibleChars) {
      return '***';
    }

    const visible = data.slice(-visibleChars);
    const masked = '*'.repeat(data.length - visibleChars);
    return masked + visible;
  }
}

