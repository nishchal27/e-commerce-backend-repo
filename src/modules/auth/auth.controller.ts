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
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { RequestUser } from './strategies/jwt.strategy';

/**
 * AuthController handles HTTP requests for authentication endpoints
 */
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
   *
   * @param registerDto - Registration data
   * @param response - Express response object (for setting cookies)
   * @returns Access token and user data
   */
  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
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
   *
   * @param loginDto - Login credentials
   * @param response - Express response object (for setting cookies)
   * @returns Access token
   */
  @Public()
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
   *
   * @param request - Express request object (contains cookies)
   * @param response - Express response object (for setting cookies)
   * @returns New access token
   */
  @Public()
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
}

