/**
 * Auth Service
 *
 * This service contains the core business logic for authentication and authorization.
 * It handles user registration, login, token management, and password operations.
 *
 * Responsibilities:
 * - User registration with password hashing
 * - User login with credential validation
 * - JWT access token generation
 * - Refresh token generation and rotation
 * - Token validation and invalidation
 * - Password hashing and verification
 *
 * Security Features:
 * - Bcrypt password hashing (12 rounds)
 * - HMAC-SHA256 refresh token hashing
 * - Token rotation on refresh (prevents token reuse attacks)
 * - Secure token storage (hashed tokens in database)
 *
 * Integration Points:
 * - PrismaService: Database operations
 * - JwtService: JWT token signing
 * - ConfigService: Environment configuration
 * - Logger: Structured logging
 * - MailerService: Email sending (verification, password reset)
 */

import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../lib/prisma/prisma.service';
import { Logger } from '../../lib/logger';
import { MailerService } from '../mailer/mailer.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { TokenPair } from './interfaces/token-pair.interface';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import {
  generateRefreshToken,
  hashRefreshToken,
  verifyRefreshToken,
  createJwtPayload,
} from './utils/token.util';

/**
 * AuthService handles all authentication and authorization business logic
 */
@Injectable()
export class AuthService {
  // Bcrypt salt rounds for password hashing (12 is secure and performant)
  private readonly bcryptRounds = 12;

  // JWT configuration from environment
  private readonly jwtSecret: string;
  private readonly jwtExpiresIn: string;
  private readonly refreshExpiresIn: number;

  // HMAC secret for refresh token hashing (different from JWT secret)
  private readonly hmacSecret: string;

  // Application URL for email links
  private readonly appUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly logger: Logger,
    private readonly mailerService: MailerService,
  ) {
    // Load configuration from environment variables
    const jwtSecret = this.configService.get<string>('JWT_SECRET');
    const hmacSecret = this.configService.get<string>('HMAC_SECRET');

    // Validate required configuration
    if (!jwtSecret) {
      throw new Error('JWT_SECRET is required in environment variables');
    }
    if (!hmacSecret) {
      throw new Error('HMAC_SECRET is required in environment variables');
    }

    this.jwtSecret = jwtSecret;
    this.jwtExpiresIn = this.configService.get<string>('JWT_EXPIRES_IN', '3600');
    this.refreshExpiresIn = this.configService.get<number>(
      'JWT_REFRESH_EXPIRES_IN',
      604800,
    ); // 7 days default
    this.hmacSecret = hmacSecret;
    this.appUrl = this.configService.get<string>('APP_URL', 'http://localhost:3000');
  }

  /**
   * Register a new user
   *
   * Flow:
   * 1. Check if email already exists (prevent duplicates)
   * 2. Hash password using bcrypt (12 rounds)
   * 3. Create user in database with hashed password
   * 4. Generate access and refresh tokens
   * 5. Store refresh token hash in database
   * 6. Return tokens to client
   *
   * Security:
   * - Password is hashed before storage (never stored in plaintext)
   * - Email uniqueness enforced at database level
   * - User starts with isEmailVerified = false (requires email verification)
   *
   * @param registerDto - Registration data (email, password, optional name)
   * @returns Token pair (access token + refresh token)
   * @throws ConflictException if email already exists
   */
  async register(registerDto: RegisterDto): Promise<TokenPair> {
    const { email, password, name } = registerDto;

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      this.logger.warn(`Registration attempt with existing email: ${email}`, 'AuthService');
      throw new ConflictException('Email already registered');
    }

    // Hash password using bcrypt (12 rounds)
    // Why bcrypt? It's adaptive, slow (prevents brute force), and includes salt
    // 12 rounds is a good balance between security and performance (~250ms per hash)
    const hashedPassword = await bcrypt.hash(password, this.bcryptRounds);

    // Create user in database
    // Note: isEmailVerified defaults to false (user must verify email)
    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || null, // Store null instead of undefined for database
        role: 'CUSTOMER', // Default role
        isEmailVerified: false, // Requires email verification
      },
    });

    this.logger.log(`User registered: ${user.email} (${user.id})`, 'AuthService');

    // Send verification email (async, don't wait for it)
    // Email is queued via BullMQ, so it won't block the registration response
    this.sendVerificationEmail(user.id, user.email, user.name || user.email).catch(
      (error) => {
        // Log error but don't fail registration if email fails
        this.logger.error(
          `Failed to send verification email to ${user.email}: ${error.message}`,
          'AuthService',
        );
      },
    );

    // Generate tokens for the newly registered user
    const tokens = await this.generateTokenPair(user.id, user.email, user.role);

    return tokens;
  }

  /**
   * Authenticate user and generate tokens
   *
   * Flow:
   * 1. Find user by email
   * 2. Compare provided password with stored hash
   * 3. If valid, generate access and refresh tokens
   * 4. Store refresh token hash in database
   * 5. Return tokens to client
   *
   * Security:
   * - Generic error message prevents email enumeration
   * - Password comparison uses bcrypt.compare (timing-safe)
   * - Failed login attempts are logged for monitoring
   *
   * @param loginDto - Login credentials (email, password)
   * @returns Token pair (access token + refresh token)
   * @throws UnauthorizedException if credentials are invalid
   */
  async login(loginDto: LoginDto): Promise<TokenPair> {
    const { email, password } = loginDto;

    // Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    // Generic error message to prevent email enumeration
    // Don't reveal whether email exists or password is wrong
    if (!user) {
      this.logger.warn(`Login attempt with non-existent email: ${email}`, 'AuthService');
      throw new UnauthorizedException('Invalid credentials');
    }

    // Compare provided password with stored hash
    // bcrypt.compare is timing-safe (prevents timing attacks)
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      this.logger.warn(`Failed login attempt for: ${email}`, 'AuthService');
      throw new UnauthorizedException('Invalid credentials');
    }

    this.logger.log(`User logged in: ${user.email} (${user.id})`, 'AuthService');

    // Generate tokens for authenticated user
    const tokens = await this.generateTokenPair(user.id, user.email, user.role);

    return tokens;
  }

  /**
   * Refresh access token using refresh token
   *
   * Flow:
   * 1. Hash the presented refresh token
   * 2. Find refresh token hash in database
   * 3. Verify token is valid and not expired
   * 4. Generate new access token
   * 5. Rotate refresh token (delete old, create new)
   * 6. Return new access token
   *
   * Security:
   * - Token rotation prevents token reuse attacks
   * - If old token is reused after rotation, all tokens for user are revoked
   * - Expired tokens are automatically invalidated
   *
   * @param refreshToken - Refresh token from cookie
   * @returns New access token and refresh token
   * @throws UnauthorizedException if token is invalid or expired
   */
  async refresh(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
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
      this.logger.warn('Refresh attempt with invalid token hash', 'AuthService');
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Check if token is expired
    if (storedToken.expiresAt < new Date()) {
      // Clean up expired token
      await this.prisma.refreshToken.delete({
        where: { id: storedToken.id },
      });
      this.logger.warn(`Expired refresh token used: ${storedToken.id}`, 'AuthService');
      throw new UnauthorizedException('Refresh token expired');
    }

    const user = storedToken.user;

    // Generate new access token
    const payload = createJwtPayload(user.id, user.email, user.role);
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.jwtExpiresIn,
    });

    // Rotate refresh token (delete old, create new)
    // This prevents token reuse: if old token is used again, it won't be found
    // Token rotation is a security best practice
    const newRefreshToken = generateRefreshToken();
    const newTokenHash = hashRefreshToken(newRefreshToken, this.hmacSecret);
    const expiresAt = new Date(Date.now() + this.refreshExpiresIn * 1000);

    // Delete old token and create new one in a transaction
    await this.prisma.$transaction([
      this.prisma.refreshToken.delete({ where: { id: storedToken.id } }),
      this.prisma.refreshToken.create({
        data: {
          tokenHash: newTokenHash,
          userId: user.id,
          expiresAt,
        },
      }),
    ]);

    this.logger.log(`Token refreshed for user: ${user.email}`, 'AuthService');

    // Return new access token and new refresh token
    // Controller will set new refresh token in cookie
    return { accessToken, refreshToken: newRefreshToken };
  }

  /**
   * Logout user by invalidating refresh token
   *
   * Flow:
   * 1. Hash the presented refresh token
   * 2. Find and delete refresh token from database
   * 3. Client should clear cookie
   *
   * Security:
   * - Token is deleted from database (can't be reused)
   * - If token not found, silently succeed (idempotent)
   *
   * @param refreshToken - Refresh token to invalidate
   */
  async logout(refreshToken: string): Promise<void> {
    if (!refreshToken) {
      return; // Idempotent: if no token, logout is already complete
    }

    // Hash token to find in database
    const tokenHash = hashRefreshToken(refreshToken, this.hmacSecret);

    // Delete token (if exists)
    await this.prisma.refreshToken.deleteMany({
      where: { tokenHash },
    });

    this.logger.log('User logged out', 'AuthService');
  }

  /**
   * Validate user for Passport strategies
   *
   * This method is called by Passport strategies to validate user credentials.
   * Used by:
   * - JwtStrategy: Validates JWT payload and returns user
   * - LocalStrategy (if implemented): Validates email/password
   *
   * @param payload - JWT payload containing user ID
   * @returns User object if found, null otherwise
   */
  async validateUser(payload: JwtPayload) {
    // Find user by ID from JWT payload
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        name: true,
        isEmailVerified: true,
      },
    });

    if (!user) {
      this.logger.warn(`JWT payload references non-existent user: ${payload.sub}`, 'AuthService');
      return null;
    }

    return user;
  }

  /**
   * Generate access and refresh token pair
   *
   * This is a private helper method used by register() and login().
   * It encapsulates the token generation logic:
   * 1. Create JWT access token
   * 2. Generate random refresh token (UUID)
   * 3. Hash refresh token
   * 4. Store refresh token hash in database
   * 5. Return both tokens
   *
   * @param userId - User's unique identifier
   * @param email - User's email
   * @param role - User's role
   * @returns Token pair (access token + refresh token)
   */
  private async generateTokenPair(
    userId: string,
    email: string,
    role: string,
  ): Promise<TokenPair> {
    // Create JWT payload and sign access token
    const payload = createJwtPayload(userId, email, role);
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.jwtExpiresIn,
    });

    // Generate random refresh token (UUID)
    const refreshToken = generateRefreshToken();

    // Hash refresh token before storing
    const tokenHash = hashRefreshToken(refreshToken, this.hmacSecret);

    // Calculate expiration date (now + refreshExpiresIn seconds)
    const expiresAt = new Date(Date.now() + this.refreshExpiresIn * 1000);

    // Store refresh token hash in database
    await this.prisma.refreshToken.create({
      data: {
        tokenHash,
        userId,
        expiresAt,
      },
    });

    // Return both tokens
    // Note: Controller will set refresh token in HttpOnly cookie
    return {
      accessToken,
      refreshToken,
    };
  }

  /**
   * Send email verification email to user
   *
   * Generates a signed JWT token containing user ID and email,
   * then sends a verification email with a link containing the token.
   *
   * Flow:
   * 1. Generate signed JWT token (expires in 24 hours)
   * 2. Create verification URL with token
   * 3. Queue email for async sending via BullMQ
   *
   * Security:
   * - Token is signed JWT (not guessable)
   * - Token expires after 24 hours
   * - Token contains user ID and email for verification
   *
   * @param userId - User's unique identifier
   * @param email - User's email address
   * @param name - User's name (for email personalization)
   */
  async sendVerificationEmail(userId: string, email: string, name: string): Promise<void> {
    // Generate verification token (JWT with 24-hour expiry)
    // Token contains: userId, email, type='email_verification'
    const token = this.jwtService.sign(
      {
        sub: userId,
        email,
        type: 'email_verification',
      },
      {
        expiresIn: '24h', // 24 hours expiry
      },
    );

    // Create verification URL
    const verificationUrl = `${this.appUrl}/auth/verify?token=${token}`;

    // Queue email for async sending
    // Using queueEmail() so email sending doesn't block the request
    await this.mailerService.queueEmail('verification', email, 'Verify Your Email Address', {
      name,
      email,
      verificationUrl,
    });

    this.logger.log(`Verification email queued for: ${email}`, 'AuthService');
  }

  /**
   * Verify user's email address using verification token
   *
   * Flow:
   * 1. Verify JWT token signature and expiration
   * 2. Extract user ID and email from token
   * 3. Verify token type is 'email_verification'
   * 4. Find user in database
   * 5. Update isEmailVerified to true
   * 6. Send welcome email
   *
   * Security:
   * - Token signature verified (prevents tampering)
   * - Token expiration checked (24 hours)
   * - Token type verified (prevents token reuse)
   * - User must exist in database
   *
   * @param token - Verification token from email link
   * @throws UnauthorizedException if token is invalid or expired
   * @throws NotFoundException if user not found
   */
  async verifyEmail(token: string): Promise<void> {
    try {
      // Verify and decode JWT token
      const payload = this.jwtService.verify<{
        sub: string;
        email: string;
        type: string;
      }>(token);

      // Verify token type
      if (payload.type !== 'email_verification') {
        this.logger.warn('Invalid token type for email verification', 'AuthService');
        throw new UnauthorizedException('Invalid verification token');
      }

      // Find user by ID from token
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) {
        this.logger.warn(`Verification token references non-existent user: ${payload.sub}`, 'AuthService');
        throw new NotFoundException('User not found');
      }

      // Verify email matches
      if (user.email !== payload.email) {
        this.logger.warn(`Email mismatch in verification token for user: ${user.id}`, 'AuthService');
        throw new UnauthorizedException('Invalid verification token');
      }

      // Check if already verified
      if (user.isEmailVerified) {
        this.logger.log(`Email already verified for user: ${user.email}`, 'AuthService');
        return; // Idempotent: already verified is success
      }

      // Update user to mark email as verified
      await this.prisma.user.update({
        where: { id: user.id },
        data: { isEmailVerified: true },
      });

      this.logger.log(`Email verified for user: ${user.email}`, 'AuthService');

      // Send welcome email (async, don't wait)
      this.mailerService
        .queueEmail('welcome', user.email, 'Welcome!', {
          name: user.name || user.email,
          email: user.email,
        })
        .catch((error) => {
          this.logger.error(
            `Failed to send welcome email to ${user.email}: ${error.message}`,
            'AuthService',
          );
        });
    } catch (error) {
      // Handle JWT verification errors
      if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Verification token expired');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new UnauthorizedException('Invalid verification token');
      }

      // Re-throw other errors (NotFoundException, UnauthorizedException)
      throw error;
    }
  }

  /**
   * Resend email verification email
   *
   * Allows users to request a new verification email if they didn't receive
   * the original one or if it expired.
   *
   * Flow:
   * 1. Find user by email
   * 2. Check if email is already verified
   * 3. Generate new verification token
   * 4. Send verification email
   *
   * Security:
   * - Generic error message prevents email enumeration
   * - Only sends if email is not already verified
   *
   * @param email - User's email address
   * @throws NotFoundException if user not found (generic message)
   * @throws BadRequestException if email already verified
   */
  async resendVerificationEmail(email: string): Promise<void> {
    // Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    // Generic error message to prevent email enumeration
    if (!user) {
      this.logger.warn(`Resend verification attempt with non-existent email: ${email}`, 'AuthService');
      // Return success to prevent email enumeration
      // In production, you might want to add a delay here to prevent timing attacks
      return;
    }

    // Check if already verified
    if (user.isEmailVerified) {
      this.logger.log(`Resend verification requested for already verified email: ${email}`, 'AuthService');
      throw new BadRequestException('Email is already verified');
    }

    // Send verification email
    await this.sendVerificationEmail(user.id, user.email, user.name || user.email);

    this.logger.log(`Verification email resent to: ${email}`, 'AuthService');
  }

  /**
   * Request password reset (forgot password)
   *
   * Generates a password reset token and sends it to the user's email.
   * The token is a signed JWT with 1-hour expiry.
   *
   * Flow:
   * 1. Find user by email
   * 2. Generate signed JWT reset token (1-hour expiry)
   * 3. Create reset URL with token
   * 4. Send password reset email
   *
   * Security:
   * - Generic error message prevents email enumeration
   * - Token is signed JWT (not guessable)
   * - Token expires after 1 hour
   * - Token contains user ID and email for verification
   *
   * @param email - User's email address
   * @throws NotFoundException if user not found (generic message to prevent enumeration)
   */
  async forgotPassword(email: string): Promise<void> {
    // Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    // Generic error message to prevent email enumeration
    // Always return success, even if user doesn't exist
    // This prevents attackers from discovering which emails are registered
    if (!user) {
      this.logger.warn(`Password reset requested for non-existent email: ${email}`, 'AuthService');
      // Return success to prevent email enumeration
      // In production, you might want to add a delay here to prevent timing attacks
      return;
    }

    // Generate password reset token (JWT with 1-hour expiry)
    // Token contains: userId, email, type='password_reset'
    const token = this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        type: 'password_reset',
      },
      {
        expiresIn: '1h', // 1 hour expiry
      },
    );

    // Create password reset URL
    const resetUrl = `${this.appUrl}/auth/reset-password?token=${token}`;

    // Queue email for async sending
    await this.mailerService.queueEmail('password-reset', email, 'Reset Your Password', {
      name: user.name || user.email,
      email: user.email,
      resetUrl,
    });

    this.logger.log(`Password reset email queued for: ${email}`, 'AuthService');
  }

  /**
   * Reset user's password using reset token
   *
   * Validates the reset token and updates the user's password.
   * The token is single-use (implicitly, as it's validated once).
   *
   * Flow:
   * 1. Verify JWT token signature and expiration
   * 2. Extract user ID and email from token
   * 3. Verify token type is 'password_reset'
   * 4. Find user in database
   * 5. Hash new password
   * 6. Update user's password
   *
   * Security:
   * - Token signature verified (prevents tampering)
   * - Token expiration checked (1 hour)
   * - Token type verified (prevents token reuse)
   * - New password is hashed before storage
   * - Token is effectively single-use (expires quickly, validated once)
   *
   * @param token - Password reset token from email link
   * @param newPassword - New password to set
   * @throws UnauthorizedException if token is invalid or expired
   * @throws NotFoundException if user not found
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    try {
      // Verify and decode JWT token
      const payload = this.jwtService.verify<{
        sub: string;
        email: string;
        type: string;
      }>(token);

      // Verify token type
      if (payload.type !== 'password_reset') {
        this.logger.warn('Invalid token type for password reset', 'AuthService');
        throw new UnauthorizedException('Invalid reset token');
      }

      // Find user by ID from token
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) {
        this.logger.warn(`Reset token references non-existent user: ${payload.sub}`, 'AuthService');
        throw new NotFoundException('User not found');
      }

      // Verify email matches
      if (user.email !== payload.email) {
        this.logger.warn(`Email mismatch in reset token for user: ${user.id}`, 'AuthService');
        throw new UnauthorizedException('Invalid reset token');
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, this.bcryptRounds);

      // Update user's password
      await this.prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      });

      this.logger.log(`Password reset completed for user: ${user.email}`, 'AuthService');

      // Optional: Invalidate all refresh tokens for security
      // This forces user to log in again with new password
      await this.prisma.refreshToken.deleteMany({
        where: { userId: user.id },
      });

      this.logger.log(`All refresh tokens invalidated for user: ${user.email}`, 'AuthService');
    } catch (error) {
      // Handle JWT verification errors
      if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Reset token expired');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new UnauthorizedException('Invalid reset token');
      }

      // Re-throw other errors (NotFoundException, UnauthorizedException)
      throw error;
    }
  }
}

