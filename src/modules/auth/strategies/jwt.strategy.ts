/**
 * JWT Strategy
 *
 * This Passport strategy validates JWT access tokens from the Authorization header.
 * It's used by the JwtAuthGuard to protect routes that require authentication.
 *
 * How it works:
 * 1. Extracts token from "Authorization: Bearer <token>" header
 * 2. Verifies token signature using JWT_SECRET
 * 3. Validates token expiration
 * 4. Calls validate() method with decoded payload
 * 5. If valid, attaches user to request object
 *
 * Security:
 * - Token signature verified using JWT_SECRET
 * - Token expiration automatically checked
 * - Invalid tokens are rejected immediately
 *
 * Integration:
 * - Used by JwtAuthGuard to protect routes
 * - User data is available via @CurrentUser() decorator after authentication
 */

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

/**
 * Payload structure returned by validate() method
 * This is what gets attached to the request object as `user`
 */
export interface RequestUser {
  id: string;
  email: string;
  role: string;
  name: string | null;
  isEmailVerified: boolean;
}

/**
 * JwtStrategy validates JWT access tokens
 * Extends PassportStrategy with 'jwt' strategy (from passport-jwt)
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      // Extract token from Authorization header
      // Format: "Authorization: Bearer <token>"
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),

      // Ignore token expiration (we'll check it manually if needed)
      // Actually, passport-jwt checks expiration by default, but we can override
      ignoreExpiration: false,

      // Secret key for verifying token signature
      // Must match the secret used to sign tokens in AuthService
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });

    // Validate configuration
    if (!this.configService.get<string>('JWT_SECRET')) {
      throw new Error('JWT_SECRET is required in environment variables');
    }
  }

  /**
   * Validate JWT payload
   *
   * This method is called by Passport after token signature is verified.
   * It:
   * 1. Receives the decoded JWT payload
   * 2. Validates the user still exists in database
   * 3. Returns user data (attached to request as `req.user`)
   *
   * Why check database? Even though token is valid, user might have been deleted,
   * or role might have changed. We ensure user still exists and is active.
   *
   * @param payload - Decoded JWT payload (sub, email, role)
   * @returns User object if valid, throws UnauthorizedException if invalid
   * @throws UnauthorizedException if user not found or token invalid
   */
  async validate(payload: JwtPayload): Promise<RequestUser> {
    // Validate user exists in database
    // This ensures that even if token is valid, user hasn't been deleted
    const user = await this.authService.validateUser(payload);

    if (!user) {
      // User not found - token is valid but user doesn't exist
      // This can happen if user was deleted after token was issued
      throw new UnauthorizedException('User not found');
    }

    // Return user data (attached to request as req.user)
    // This is what @CurrentUser() decorator will return
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      isEmailVerified: user.isEmailVerified,
    };
  }
}

