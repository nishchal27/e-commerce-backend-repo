/**
 * Auth Controller
 *
 * This controller handles HTTP requests for authentication endpoints.
 * It validates request data, delegates to the service layer, and returns HTTP responses.
 *
 * Endpoints:
 * - POST /auth/register - Register a new user (public)
 * - POST /auth/login - Login user (public)
 * - POST /auth/refresh - Refresh access token (public, uses cookie)
 * - POST /auth/logout - Logout user (protected)
 * - GET /auth/me - Get current user profile (protected)
 * - GET /auth/verify - Verify email address (public, from email link)
 * - POST /auth/verify - Verify email address (public, from request body)
 * - POST /auth/resend-verification - Resend verification email (public)
 * - POST /auth/forgot-password - Request password reset (public)
 * - POST /auth/reset-password - Reset password with token (public)
 *
 * Security:
 * - Public endpoints: register, login, refresh (no authentication required)
 * - Protected endpoints: logout, me (require valid JWT token)
 * - Refresh tokens are sent via HttpOnly cookies (secure, not accessible to JavaScript)
 * - Access tokens are returned in response body (client stores in memory/localStorage)
 */

import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  Res,
  Req,
  UseGuards,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/password-reset.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { RequestUser } from './strategies/jwt.strategy';
import { RateLimit, RateLimitType } from '../../common/rate-limiting/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../../common/rate-limiting/rate-limit.guard';

/**
 * AuthController handles HTTP requests for authentication endpoints
 */
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  // Refresh token cookie configuration
  private readonly cookieName = 'refreshToken';
  private readonly cookieMaxAge: number;
  private readonly isProduction: boolean;

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {
    // Get refresh token expiration from config (in seconds)
    const refreshExpiresIn = this.configService.get<number>(
      'JWT_REFRESH_EXPIRES_IN',
      604800,
    ); // 7 days default

    // Convert to milliseconds for cookie maxAge
    this.cookieMaxAge = refreshExpiresIn * 1000;

    // Check if we're in production (affects cookie security settings)
    this.isProduction = this.configService.get<string>('NODE_ENV') === 'production';
  }

  /**
   * POST /auth/register
   * Register a new user
   *
   * Flow:
   * 1. Validate registration data (email, password, name)
   * 2. Create user in database (password is hashed)
   * 3. Generate access and refresh tokens
   * 4. Set refresh token in HttpOnly cookie
   * 5. Return access token in response body
   *
   * Security:
   * - Password is hashed using bcrypt before storage
   * - Email uniqueness enforced at database level
   * - User starts with isEmailVerified = false (requires email verification)
   * - Refresh token is in HttpOnly cookie (not accessible to JavaScript)
   * - Rate limited: 3 requests per hour per IP
   *
   * @param registerDto - Registration data
   * @param response - Express response object (for setting cookies)
   * @returns Access token and user data
   */
  @Public()
  @RateLimit({ type: RateLimitType.REGISTER })
  @UseGuards(RateLimitGuard)
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input or email already exists' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async register(
    @Body() registerDto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    // Register user and generate tokens
    const { accessToken, refreshToken } = await this.authService.register(registerDto);

    // Set refresh token in HttpOnly cookie
    // HttpOnly: Not accessible to JavaScript (prevents XSS attacks)
    // Secure: Only sent over HTTPS in production
    // SameSite: Prevents CSRF attacks
    response.cookie(this.cookieName, refreshToken, {
      httpOnly: true, // Not accessible to JavaScript
      secure: this.isProduction, // Only sent over HTTPS in production
      sameSite: 'strict', // Prevents CSRF attacks
      maxAge: this.cookieMaxAge, // Cookie expiration matches token expiration
      path: '/', // Available to all paths
    });

    // Return access token in response body
    // Client stores this in memory/localStorage and sends in Authorization header
    return {
      success: true,
      message: 'User registered successfully',
      data: {
        accessToken,
        // Don't return refresh token in body (it's in cookie)
      },
    };
  }

  /**
   * POST /auth/login
   * Authenticate user and issue tokens
   *
   * Flow:
   * 1. Validate login credentials (email, password)
   * 2. Verify password against stored hash
   * 3. Generate access and refresh tokens
   * 4. Set refresh token in HttpOnly cookie
   * 5. Return access token in response body
   *
   * Security:
   * - Generic error messages prevent email enumeration
   * - Password comparison uses timing-safe bcrypt.compare
   * - Failed login attempts are logged for monitoring
   * - Rate limited: 5 requests per minute per IP+Email (blocks for 15 minutes after limit)
   *
   * @param loginDto - Login credentials
   * @param response - Express response object (for setting cookies)
   * @returns Access token
   */
  @Public()
  @RateLimit({ type: RateLimitType.LOGIN })
  @UseGuards(RateLimitGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    // Authenticate user and generate tokens
    const { accessToken, refreshToken } = await this.authService.login(loginDto);

    // Set refresh token in HttpOnly cookie
    response.cookie(this.cookieName, refreshToken, {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: 'strict',
      maxAge: this.cookieMaxAge,
      path: '/',
    });

    // Return access token in response body
    return {
      success: true,
      message: 'Login successful',
      data: {
        accessToken,
      },
    };
  }

  /**
   * POST /auth/refresh
   * Refresh access token using refresh token from cookie
   *
   * Flow:
   * 1. Extract refresh token from cookie
   * 2. Validate and rotate refresh token
   * 3. Generate new access token
   * 4. Set new refresh token in cookie
   * 5. Return new access token in response body
   *
   * Security:
   * - Refresh token rotation prevents token reuse attacks
   * - Token is validated before rotation
   * - Expired tokens are rejected
   * - Rate limited: 30 requests per minute per IP+Token
   *
   * @param request - Express request object (contains cookies)
   * @param response - Express response object (for setting cookies)
   * @returns New access token
   */
  @Public()
  @RateLimit({ type: RateLimitType.REFRESH })
  @UseGuards(RateLimitGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    // Extract refresh token from cookie
    const refreshToken = request.cookies?.[this.cookieName];

    if (!refreshToken) {
      return response.status(HttpStatus.UNAUTHORIZED).json({
        success: false,
        message: 'Refresh token is required',
      });
    }

    // Refresh token and get new access token + new refresh token
    // The refresh() method rotates the refresh token (generates new one)
    const { accessToken, refreshToken: newRefreshToken } =
      await this.authService.refresh(refreshToken);

    // Set new refresh token in HttpOnly cookie (token rotation)
    response.cookie(this.cookieName, newRefreshToken, {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: 'strict',
      maxAge: this.cookieMaxAge,
      path: '/',
    });

    // Return new access token in response body
    return {
      success: true,
      message: 'Token refreshed successfully',
      data: {
        accessToken,
      },
    };
  }

  /**
   * POST /auth/logout
   * Logout user by invalidating refresh token
   *
   * Flow:
   * 1. Extract refresh token from cookie
   * 2. Invalidate refresh token in database
   * 3. Clear refresh token cookie
   * 4. Return success response
   *
   * Security:
   * - Token is deleted from database (can't be reused)
   * - Cookie is cleared from client
   * - Idempotent: safe to call multiple times
   *
   * @param request - Express request object (contains cookies)
   * @param response - Express response object (for clearing cookies)
   * @returns Success response
   */
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    // Extract refresh token from cookie
    const refreshToken = request.cookies?.[this.cookieName];

    // Invalidate refresh token in database
    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }

    // Clear refresh token cookie
    response.clearCookie(this.cookieName, {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: 'strict',
      path: '/',
    });

    return {
      success: true,
      message: 'Logout successful',
    };
  }

  /**
   * GET /auth/me
   * Get current authenticated user profile
   *
   * Flow:
   * 1. Extract user from request (set by JwtAuthGuard)
   * 2. Return user profile data
   *
   * Security:
   * - Requires valid JWT token (protected by JwtAuthGuard)
   * - User data comes from validated JWT payload
   *
   * @param user - Current authenticated user (from @CurrentUser() decorator)
   * @returns User profile data
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@CurrentUser() user: RequestUser) {
    return {
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
      },
    };
  }

  /**
   * GET /auth/verify
   * Verify user's email address using verification token (from email link)
   *
   * This endpoint is used when users click the verification link in their email.
   * Email links typically use GET requests, so we support both GET and POST.
   *
   * Flow:
   * 1. Extract token from query parameter
   * 2. Validate token signature and expiration
   * 3. Update user's isEmailVerified to true
   * 4. Send welcome email
   *
   * Security:
   * - Token is signed JWT (not guessable)
   * - Token expires after 24 hours
   * - Token type verified (prevents token reuse)
   * - Idempotent: already verified is success
   *
   * @param queryToken - Verification token from query parameter (email link)
   * @returns Success response
   */
  @Public()
  @Get('verify')
  @HttpCode(HttpStatus.OK)
  async verifyEmailGet(@Query('token') queryToken: string) {
    if (!queryToken) {
      throw new BadRequestException('Verification token is required');
    }

    await this.authService.verifyEmail(queryToken);

    return {
      success: true,
      message: 'Email verified successfully',
    };
  }

  /**
   * POST /auth/verify
   * Verify user's email address using verification token (from request body)
   *
   * This endpoint allows programmatic verification (e.g., from mobile apps).
   * Email links typically use GET, but POST is also supported for flexibility.
   *
   * Flow:
   * 1. Extract token from request body
   * 2. Validate token signature and expiration
   * 3. Update user's isEmailVerified to true
   * 4. Send welcome email
   *
   * Security:
   * - Token is signed JWT (not guessable)
   * - Token expires after 24 hours
   * - Token type verified (prevents token reuse)
   * - Idempotent: already verified is success
   *
   * @param verifyDto - Verification token (from body)
   * @returns Success response
   */
  @Public()
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  async verifyEmailPost(@Body() verifyDto: VerifyEmailDto) {
    if (!verifyDto.token) {
      throw new BadRequestException('Verification token is required');
    }

    await this.authService.verifyEmail(verifyDto.token);

    return {
      success: true,
      message: 'Email verified successfully',
    };
  }

  /**
   * POST /auth/resend-verification
   * Resend email verification email
   *
   * Flow:
   * 1. Find user by email
   * 2. Check if email is already verified
   * 3. Generate new verification token
   * 4. Send verification email
   *
   * Security:
   * - Generic response prevents email enumeration
   * - Only sends if email is not already verified
   * - Rate limited: 5 requests per hour per IP+Email
   *
   * @param body - Request body containing email
   * @returns Success response (always, to prevent email enumeration)
   */
  @Public()
  @RateLimit({ type: RateLimitType.EMAIL_VERIFY })
  @UseGuards(RateLimitGuard)
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  async resendVerification(@Body('email') email: string) {
    if (!email) {
      throw new BadRequestException('Email is required');
    }

    // Resend verification email
    // This method handles email enumeration prevention internally
    await this.authService.resendVerificationEmail(email);

    // Always return success to prevent email enumeration
    return {
      success: true,
      message: 'If the email exists and is not verified, a verification email has been sent',
    };
  }

  /**
   * POST /auth/forgot-password
   * Request password reset (forgot password)
   *
   * Flow:
   * 1. Find user by email
   * 2. Generate password reset token (1-hour expiry)
   * 3. Send password reset email
   *
   * Security:
   * - Generic response prevents email enumeration
   * - Token is signed JWT (not guessable)
   * - Token expires after 1 hour
   * - Rate limited: 3 requests per hour per IP+Email
   *
   * @param forgotPasswordDto - Request body containing email
   * @returns Success response (always, to prevent email enumeration)
   */
  @Public()
  @RateLimit({ type: RateLimitType.PASSWORD_RESET })
  @UseGuards(RateLimitGuard)
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    // Request password reset
    // This method handles email enumeration prevention internally
    await this.authService.forgotPassword(forgotPasswordDto.email);

    // Always return success to prevent email enumeration
    return {
      success: true,
      message: 'If the email exists, a password reset link has been sent',
    };
  }

  /**
   * POST /auth/reset-password
   * Reset user's password using reset token
   *
   * Flow:
   * 1. Extract token and new password from request
   * 2. Validate token signature and expiration
   * 3. Hash new password
   * 4. Update user's password
   * 5. Invalidate all refresh tokens (force re-login)
   *
   * Security:
   * - Token signature verified (prevents tampering)
   * - Token expiration checked (1 hour)
   * - New password is hashed before storage
   * - All refresh tokens invalidated (security best practice)
   *
   * @param resetPasswordDto - Reset token and new password
   * @returns Success response
   */
  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    await this.authService.resetPassword(resetPasswordDto.token, resetPasswordDto.password);

    return {
      success: true,
      message: 'Password reset successfully. Please log in with your new password',
    };
  }
}

