/**
 * Refresh Strategy
 *
 * This Passport strategy validates refresh tokens from HttpOnly cookies.
 * It's used by the refresh endpoint to authenticate token refresh requests.
 *
 * How it works:
 * 1. Extracts refresh token from cookie (cookie name: 'refreshToken')
 * 2. Hashes the token using HMAC-SHA256
 * 3. Looks up token hash in database
 * 4. Validates token is not expired
 * 5. Calls validate() method with user data
 * 6. If valid, attaches user to request object
 *
 * Security:
 * - Refresh tokens are stored as hashes (not plaintext)
 * - Token expiration is checked
 * - Invalid/expired tokens are rejected
 *
 * Why custom strategy?
 * - passport-jwt is for JWT tokens, but refresh tokens are UUIDs
 * - We need to extract from cookie, not Authorization header
 * - We need to hash and lookup in database
 */

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-strategy';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../lib/prisma/prisma.service';
import { hashRefreshToken } from '../utils/token.util';
import { RequestUser } from './jwt.strategy';

/**
 * Custom Passport strategy for refresh token validation
 * This strategy validates refresh tokens from HttpOnly cookies
 */
class RefreshTokenStrategy extends Strategy {
  name = 'refresh';

  constructor(
    private readonly validateFn: (request: Request) => Promise<RequestUser>,
  ) {
    super();
  }

  authenticate(req: Request): void {
    this.validateFn(req)
      .then((user) => {
        this.success(user);
      })
      .catch((error) => {
        this.fail(error, 401);
      });
  }
}

/**
 * RefreshStrategy validates refresh tokens from cookies
 * Uses custom Passport strategy for full control over validation
 */
@Injectable()
export class RefreshStrategy extends PassportStrategy(
  RefreshTokenStrategy,
  'refresh',
) {
  private readonly hmacSecret: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    // Pass validate function to custom strategy
    super(async (request: Request) => {
      return this.validateRefreshToken(request);
    });

    const hmacSecret = this.configService.get<string>('HMAC_SECRET');

    if (!hmacSecret) {
      throw new Error('HMAC_SECRET is required in environment variables');
    }

    this.hmacSecret = hmacSecret;
  }

  /**
   * Validate refresh token from cookie
   *
   * This method is called by the custom strategy for refresh token validation.
   * It:
   * 1. Extracts refresh token from cookie
   * 2. Hashes the token
   * 3. Looks up token hash in database
   * 4. Validates token is not expired
   * 5. Returns user data (attached to request as `req.user`)
   *
   * @param request - Express request object (contains cookies)
   * @returns User object if valid, throws UnauthorizedException if invalid
   * @throws UnauthorizedException if token is missing, invalid, or expired
   */
  private async validateRefreshToken(request: Request): Promise<RequestUser> {
    // Extract refresh token from cookie
    // Cookie name: 'refreshToken' (set by controller)
    const refreshToken = request.cookies?.refreshToken;

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    // Hash the presented token to look up in database
    const tokenHash = hashRefreshToken(refreshToken, this.hmacSecret);

    // Find refresh token in database
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!storedToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Check if token is expired
    if (storedToken.expiresAt < new Date()) {
      // Clean up expired token
      await this.prisma.refreshToken.delete({
        where: { id: storedToken.id },
      });
      throw new UnauthorizedException('Refresh token expired');
    }

    const user = storedToken.user;

    // Return user data (attached to request as req.user)
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      isEmailVerified: user.isEmailVerified,
    };
  }
}

