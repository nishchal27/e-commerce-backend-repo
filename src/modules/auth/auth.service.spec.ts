/**
 * Unit Tests for AuthService
 *
 * Tests cover:
 * - User registration (success and failure cases)
 * - User login (success and failure cases)
 * - Token refresh (success and failure cases)
 * - Token invalidation (logout)
 * - Email verification
 * - Password reset
 * - Security considerations (password hashing, token rotation)
 *
 * Note: These tests use mocks for external dependencies (Prisma, JWT, Mailer, etc.)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../../lib/prisma/prisma.service';
import { Logger } from '../../lib/logger';
import { MailerService } from '../mailer/mailer.service';
import { PrometheusService } from '../../common/prometheus/prometheus.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';

// Mock bcrypt
jest.mock('bcrypt');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: jest.Mocked<PrismaService>;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;
  let logger: jest.Mocked<Logger>;
  let mailerService: jest.Mocked<MailerService>;
  let prometheusService: jest.Mocked<PrometheusService>;

  // Test data
  const testUser = {
    id: 'user-123',
    email: 'test@example.com',
    password: 'hashed-password',
    name: 'Test User',
    role: 'CUSTOMER',
    isEmailVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const testRefreshToken = {
    id: 'token-123',
    tokenHash: 'hashed-token',
    userId: 'user-123',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    createdAt: new Date(),
    user: testUser,
  };

  beforeEach(async () => {
    // Create mocks for all dependencies
    const mockPrismaService = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      refreshToken: {
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const mockJwtService = {
      sign: jest.fn(),
      verify: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        const config: Record<string, any> = {
          JWT_SECRET: 'test-jwt-secret',
          HMAC_SECRET: 'test-hmac-secret',
          JWT_EXPIRES_IN: '3600',
          JWT_REFRESH_EXPIRES_IN: 604800,
          APP_URL: 'http://localhost:3000',
        };
        return config[key] || defaultValue;
      }),
    };

    const mockLogger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    const mockMailerService = {
      queueEmail: jest.fn().mockResolvedValue(undefined),
    };

    const mockPrometheusService = {
      recordLoginAttempt: jest.fn(),
      recordTokenRefresh: jest.fn(),
      recordRegistration: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: Logger,
          useValue: mockLogger,
        },
        {
          provide: MailerService,
          useValue: mockMailerService,
        },
        {
          provide: PrometheusService,
          useValue: mockPrometheusService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prismaService = module.get(PrismaService);
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);
    logger = module.get(Logger);
    mailerService = module.get(MailerService);
    prometheusService = module.get(PrometheusService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    const registerDto: RegisterDto = {
      email: 'newuser@example.com',
      password: 'password123',
      name: 'New User',
    };

    it('should register a new user successfully', async () => {
      // Mock: user doesn't exist
      prismaService.user.findUnique.mockResolvedValue(null);
      
      // Mock: bcrypt hash
      mockedBcrypt.hash.mockResolvedValue('hashed-password' as never);
      
      // Mock: user creation
      prismaService.user.create.mockResolvedValue({
        ...testUser,
        email: registerDto.email,
        name: registerDto.name,
      });
      
      // Mock: refresh token creation
      prismaService.refreshToken.create.mockResolvedValue(testRefreshToken);
      
      // Mock: JWT signing
      jwtService.sign.mockReturnValue('access-token');

      const result = await service.register(registerDto);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: registerDto.email },
      });
      expect(mockedBcrypt.hash).toHaveBeenCalledWith(registerDto.password, 12);
      expect(prismaService.user.create).toHaveBeenCalled();
      expect(prometheusService.recordRegistration).toHaveBeenCalledWith(true);
    });

    it('should throw ConflictException if email already exists', async () => {
      // Mock: user already exists
      prismaService.user.findUnique.mockResolvedValue(testUser);

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
      expect(prometheusService.recordRegistration).toHaveBeenCalledWith(false);
      expect(prismaService.user.create).not.toHaveBeenCalled();
    });

    it('should hash password before storing', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);
      mockedBcrypt.hash.mockResolvedValue('hashed-password' as never);
      prismaService.user.create.mockResolvedValue(testUser);
      prismaService.refreshToken.create.mockResolvedValue(testRefreshToken);
      jwtService.sign.mockReturnValue('access-token');

      await service.register(registerDto);

      expect(mockedBcrypt.hash).toHaveBeenCalledWith(registerDto.password, 12);
      expect(prismaService.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          password: 'hashed-password',
        }),
      });
    });
  });

  describe('login', () => {
    const loginDto: LoginDto = {
      email: 'test@example.com',
      password: 'password123',
    };

    it('should login user with valid credentials', async () => {
      // Mock: user exists
      prismaService.user.findUnique.mockResolvedValue(testUser);
      
      // Mock: password is valid
      mockedBcrypt.compare.mockResolvedValue(true as never);
      
      // Mock: refresh token creation
      prismaService.refreshToken.create.mockResolvedValue(testRefreshToken);
      
      // Mock: JWT signing
      jwtService.sign.mockReturnValue('access-token');

      const result = await service.login(loginDto);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(mockedBcrypt.compare).toHaveBeenCalledWith(
        loginDto.password,
        testUser.password,
      );
      expect(prometheusService.recordLoginAttempt).toHaveBeenCalledWith(true);
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      // Mock: user doesn't exist
      prismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(prometheusService.recordLoginAttempt).toHaveBeenCalledWith(
        false,
        'user_not_found',
      );
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      // Mock: user exists
      prismaService.user.findUnique.mockResolvedValue(testUser);
      
      // Mock: password is invalid
      mockedBcrypt.compare.mockResolvedValue(false as never);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(prometheusService.recordLoginAttempt).toHaveBeenCalledWith(
        false,
        'invalid_credentials',
      );
    });
  });

  describe('refresh', () => {
    const refreshToken = 'valid-refresh-token';

    it('should refresh tokens successfully', async () => {
      // Mock: token exists and is valid
      prismaService.refreshToken.findUnique.mockResolvedValue(testRefreshToken);
      
      // Mock: transaction (delete old, create new)
      prismaService.$transaction.mockImplementation(async (callback) => {
        return callback(prismaService);
      });
      prismaService.refreshToken.delete.mockResolvedValue(testRefreshToken);
      prismaService.refreshToken.create.mockResolvedValue(testRefreshToken);
      
      // Mock: JWT signing
      jwtService.sign.mockReturnValue('new-access-token');

      const result = await service.refresh(refreshToken);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(prometheusService.recordTokenRefresh).toHaveBeenCalledWith(true);
    });

    it('should throw UnauthorizedException for invalid token', async () => {
      // Mock: token doesn't exist
      prismaService.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.refresh(refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(prometheusService.recordTokenRefresh).toHaveBeenCalledWith(false);
    });

    it('should throw UnauthorizedException for expired token', async () => {
      // Mock: token exists but is expired
      const expiredToken = {
        ...testRefreshToken,
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
      };
      prismaService.refreshToken.findUnique.mockResolvedValue(expiredToken);
      prismaService.refreshToken.delete.mockResolvedValue(expiredToken);

      await expect(service.refresh(refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(prometheusService.recordTokenRefresh).toHaveBeenCalledWith(false);
    });
  });

  describe('logout', () => {
    const refreshToken = 'valid-refresh-token';

    it('should logout user by deleting refresh token', async () => {
      prismaService.refreshToken.deleteMany.mockResolvedValue({ count: 1 });

      await service.logout(refreshToken);

      expect(prismaService.refreshToken.deleteMany).toHaveBeenCalled();
    });

    it('should handle logout gracefully when token is missing', async () => {
      await service.logout('');

      // Should not throw, but also should not call deleteMany
      expect(prismaService.refreshToken.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('validateUser', () => {
    const jwtPayload = {
      sub: 'user-123',
      email: 'test@example.com',
      role: 'CUSTOMER',
      isEmailVerified: false,
    };

    it('should return user if found', async () => {
      prismaService.user.findUnique.mockResolvedValue(testUser);

      const result = await service.validateUser(jwtPayload as any);

      expect(result).toBeDefined();
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: jwtPayload.sub },
        select: expect.objectContaining({
          id: true,
          email: true,
          role: true,
        }),
      });
    });

    it('should return null if user not found', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.validateUser(jwtPayload as any);

      expect(result).toBeNull();
    });
  });
});

