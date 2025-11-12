/**
 * Unit Tests for Token Utilities
 *
 * Tests cover:
 * - Refresh token generation (UUID v4)
 * - Token hashing (HMAC-SHA256)
 * - Token verification (constant-time comparison)
 * - JWT payload creation
 * - Edge cases and security considerations
 */

import {
  generateRefreshToken,
  hashRefreshToken,
  verifyRefreshToken,
  createJwtPayload,
} from './token.util';

describe('Token Utilities', () => {
  const testSecret = 'test-hmac-secret-key-for-testing-purposes';

  describe('generateRefreshToken', () => {
    it('should generate a valid UUID v4', () => {
      const token = generateRefreshToken();
      
      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(token).toMatch(uuidRegex);
    });

    it('should generate unique tokens on each call', () => {
      const token1 = generateRefreshToken();
      const token2 = generateRefreshToken();
      
      expect(token1).not.toBe(token2);
    });

    it('should generate tokens of correct length', () => {
      const token = generateRefreshToken();
      // UUID v4 is 36 characters (32 hex + 4 hyphens)
      expect(token.length).toBe(36);
    });
  });

  describe('hashRefreshToken', () => {
    it('should hash a token using HMAC-SHA256', () => {
      const token = 'test-token-123';
      const hash = hashRefreshToken(token, testSecret);
      
      // SHA-256 produces 64 hex characters
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]{64}$/i);
    });

    it('should produce the same hash for the same token and secret', () => {
      const token = 'test-token-123';
      const hash1 = hashRefreshToken(token, testSecret);
      const hash2 = hashRefreshToken(token, testSecret);
      
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different tokens', () => {
      const token1 = 'test-token-1';
      const token2 = 'test-token-2';
      const hash1 = hashRefreshToken(token1, testSecret);
      const hash2 = hashRefreshToken(token2, testSecret);
      
      expect(hash1).not.toBe(hash2);
    });

    it('should produce different hashes with different secrets', () => {
      const token = 'test-token-123';
      const secret1 = 'secret-1';
      const secret2 = 'secret-2';
      const hash1 = hashRefreshToken(token, secret1);
      const hash2 = hashRefreshToken(token, secret2);
      
      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty token', () => {
      const hash = hashRefreshToken('', testSecret);
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]{64}$/i);
    });

    it('should handle UUID tokens correctly', () => {
      const uuidToken = generateRefreshToken();
      const hash = hashRefreshToken(uuidToken, testSecret);
      
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]{64}$/i);
    });
  });

  describe('verifyRefreshToken', () => {
    it('should return true for valid token and hash', () => {
      const token = 'test-token-123';
      const storedHash = hashRefreshToken(token, testSecret);
      
      const isValid = verifyRefreshToken(token, storedHash, testSecret);
      expect(isValid).toBe(true);
    });

    it('should return false for invalid token', () => {
      const correctToken = 'test-token-123';
      const wrongToken = 'wrong-token-456';
      const storedHash = hashRefreshToken(correctToken, testSecret);
      
      const isValid = verifyRefreshToken(wrongToken, storedHash, testSecret);
      expect(isValid).toBe(false);
    });

    it('should return false for wrong hash', () => {
      const token = 'test-token-123';
      const wrongHash = 'a'.repeat(64); // Wrong hash
      
      const isValid = verifyRefreshToken(token, wrongHash, testSecret);
      expect(isValid).toBe(false);
    });

    it('should return false for wrong secret', () => {
      const token = 'test-token-123';
      const correctSecret = testSecret;
      const wrongSecret = 'wrong-secret';
      const storedHash = hashRefreshToken(token, correctSecret);
      
      const isValid = verifyRefreshToken(token, storedHash, wrongSecret);
      expect(isValid).toBe(false);
    });

    it('should handle hash length mismatch gracefully', () => {
      const token = 'test-token-123';
      const shortHash = 'abc123'; // Too short
      
      const isValid = verifyRefreshToken(token, shortHash, testSecret);
      expect(isValid).toBe(false);
    });

    it('should use constant-time comparison (security)', () => {
      const token = 'test-token-123';
      const storedHash = hashRefreshToken(token, testSecret);
      
      // This test verifies the function works, but doesn't test timing
      // In production, timing attacks are prevented by crypto.timingSafeEqual
      const isValid = verifyRefreshToken(token, storedHash, testSecret);
      expect(isValid).toBe(true);
    });

    it('should verify real UUID tokens correctly', () => {
      const token = generateRefreshToken();
      const storedHash = hashRefreshToken(token, testSecret);
      
      const isValid = verifyRefreshToken(token, storedHash, testSecret);
      expect(isValid).toBe(true);
    });
  });

  describe('createJwtPayload', () => {
    it('should create a valid JWT payload structure', () => {
      const userId = 'user-123';
      const email = 'test@example.com';
      const role = 'CUSTOMER';
      
      const payload = createJwtPayload(userId, email, role);
      
      expect(payload).toHaveProperty('sub', userId);
      expect(payload).toHaveProperty('email', email);
      expect(payload).toHaveProperty('role', role);
    });

    it('should use "sub" claim for user ID (JWT standard)', () => {
      const userId = 'user-123';
      const payload = createJwtPayload(userId, 'test@example.com', 'CUSTOMER');
      
      expect(payload.sub).toBe(userId);
    });

    it('should handle different roles', () => {
      const roles = ['CUSTOMER', 'ADMIN', 'MANAGER'];
      
      roles.forEach((role) => {
        const payload = createJwtPayload('user-123', 'test@example.com', role);
        expect(payload.role).toBe(role);
      });
    });

    it('should handle UUID user IDs', () => {
      const userId = '550e8400-e29b-41d4-a716-446655440000';
      const payload = createJwtPayload(userId, 'test@example.com', 'CUSTOMER');
      
      expect(payload.sub).toBe(userId);
    });
  });

  describe('Integration: Full Token Flow', () => {
    it('should generate, hash, and verify a complete token flow', () => {
      // Generate a refresh token
      const refreshToken = generateRefreshToken();
      expect(refreshToken).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      
      // Hash the token
      const tokenHash = hashRefreshToken(refreshToken, testSecret);
      expect(tokenHash).toHaveLength(64);
      
      // Verify the token
      const isValid = verifyRefreshToken(refreshToken, tokenHash, testSecret);
      expect(isValid).toBe(true);
      
      // Verify wrong token fails
      const wrongToken = generateRefreshToken();
      const isInvalid = verifyRefreshToken(wrongToken, tokenHash, testSecret);
      expect(isInvalid).toBe(false);
    });
  });
});

