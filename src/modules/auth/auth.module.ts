/**
 * Auth Module
 *
 * This module provides authentication and authorization functionality for the application.
 * It configures JWT authentication, Passport strategies, guards, and auth endpoints.
 *
 * Responsibilities:
 * - Configures JwtModule with secret and expiration
 * - Registers Passport strategies (JWT, Refresh)
 * - Provides AuthService for business logic
 * - Exports guards for use in other modules
 * - Registers AuthController with endpoints
 *
 * Integration:
 * - Uses PrismaService (global) for database access
 * - Uses ConfigService (global) for environment variables
 * - Uses Logger (global) for structured logging
 *
 * Exports:
 * - JwtAuthGuard: For protecting routes in other modules
 * - RolesGuard: For role-based access control
 * - Public decorator: For marking public routes
 * - Roles decorator: For specifying required roles
 */

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { MailerModule } from '../mailer/mailer.module';
import { normalizeJwtExpiresIn } from './utils/token.util';

/**
 * AuthModule provides authentication and authorization services
 */
@Module({
  imports: [
    // PassportModule enables Passport integration
    PassportModule.register({ defaultStrategy: 'jwt' }),

    // JwtModule provides JWT token signing and verification
    // Configured dynamically using ConfigService
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');
        const expiresInRaw = configService.get<string>('JWT_EXPIRES_IN', '3600');
        
        // Normalize expiration time to ensure proper format
        // This prevents issues where numeric strings are misinterpreted
        const expiresIn = normalizeJwtExpiresIn(expiresInRaw);

        if (!secret) {
          throw new Error('JWT_SECRET is required in environment variables');
        }

        return {
          secret, // Secret key for signing tokens
          signOptions: {
            expiresIn, // Token expiration time (normalized, default: 1 hour = "3600s")
          },
        };
      },
      inject: [ConfigService],
    }),

    // MailerModule provides email sending functionality
    // Used for sending verification and password reset emails
    MailerModule,
  ],
  controllers: [AuthController],
  providers: [
    // AuthService contains business logic for authentication
    AuthService,

    // Passport strategies for validating tokens
    JwtStrategy, // Validates JWT access tokens from Authorization header

    // Guards for protecting routes
    JwtAuthGuard, // Requires valid JWT token
    RolesGuard, // Enforces role-based access control
  ],
  exports: [
    // Export guards and service for use in other modules
    JwtAuthGuard, // Other modules can use this to protect routes
    RolesGuard, // Other modules can use this for RBAC
    AuthService, // Other modules might need to validate users
    PassportModule, // Export PassportModule for strategy registration
  ],
})
export class AuthModule {}
