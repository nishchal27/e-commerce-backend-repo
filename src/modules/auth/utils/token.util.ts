/**
 * Token Utility Functions
 *
 * This module provides utility functions for token generation, hashing, and validation.
 * It encapsulates all token-related cryptographic operations used in the authentication flow.
 *
 * Responsibilities:
 * - Generate JWT access tokens with user payload
 * - Generate random refresh tokens (UUIDs)
 * - Hash refresh tokens using HMAC-SHA256 before storage
 * - Validate and compare refresh token hashes
 *
 * Security Considerations:
 * - Access tokens are JWTs signed with JWT_SECRET
 * - Refresh tokens are random UUIDs (cryptographically secure)
 * - Refresh tokens are hashed with HMAC-SHA256 before database storage
 * - HMAC is fast (O(1)) and adds negligible latency (< 1ms per operation)
 */

import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

/**
 * Generates a random UUID to be used as a refresh token.
 *
 * Why UUID v4? It's cryptographically random, 128-bit entropy, and guaranteed unique.
 * The UUID is never stored directly - it's hashed before storage for security.
 *
 * @returns A random UUID string (e.g., "550e8400-e29b-41d4-a716-446655440000")
 */
export function generateRefreshToken(): string {
  // Generate a cryptographically secure random UUID v4
  // This UUID will be sent to the client and hashed before storing in DB
  return uuidv4();
}

/**
 * Hashes a refresh token using HMAC-SHA256 before storing in the database.
 *
 * Why HMAC-SHA256?
 * - Fast: O(1) operation, adds < 1ms latency per refresh request
 * - Secure: If database leaks, attackers only get hashes (not usable tokens)
 * - Efficient: Allows fast database lookups via indexed tokenHash column
 *
 * Alternative considered: bcrypt/Argon2 - but these are password hashing functions
 * that add CPU cost. HMAC is appropriate for token storage where we need fast lookups.
 *
 * @param token - The plaintext refresh token (UUID) to hash
 * @param secret - HMAC secret from environment variables (HMAC_SECRET)
 * @returns Hexadecimal hash string of the token (e.g., "a1b2c3d4e5f6...")
 */
export function hashRefreshToken(token: string, secret: string): string {
  // Create HMAC-SHA256 hash of the token
  // The secret (HMAC_SECRET) should be different from JWT_SECRET and kept secure
  const hmac = crypto.createHmac('sha256', secret);

  // Update with the token string and get hex digest
  hmac.update(token);

  // Return hexadecimal string representation of the hash
  // This is what gets stored in the database (tokenHash field)
  return hmac.digest('hex');
}

/**
 * Validates a refresh token by comparing its hash with a stored hash from the database.
 *
 * This function hashes the presented token and compares it with the stored hash.
 * If they match, the token is valid (and belongs to the user who owns the stored hash).
 *
 * Why compare hashes instead of storing plaintext?
 * - Security: Even if database is compromised, tokens can't be used without the HMAC secret
 * - Integrity: Ensures the token presented matches exactly what was issued
 *
 * @param presentedToken - The refresh token presented by the client (from cookie)
 * @param storedHash - The hash stored in the database (from RefreshToken.tokenHash)
 * @param secret - HMAC secret from environment variables (HMAC_SECRET)
 * @returns True if the token hash matches the stored hash, false otherwise
 */
export function verifyRefreshToken(
  presentedToken: string,
  storedHash: string,
  secret: string,
): boolean {
  // Hash the presented token using the same algorithm and secret
  const presentedHash = hashRefreshToken(presentedToken, secret);

  // Use constant-time comparison to prevent timing attacks
  // crypto.timingSafeEqual ensures the comparison takes the same time
  // regardless of where the first difference occurs
  try {
    // Both hashes should be the same length (64 hex characters for SHA-256)
    // If lengths differ, timingSafeEqual will throw, which we catch and return false
    return crypto.timingSafeEqual(
      Buffer.from(presentedHash),
      Buffer.from(storedHash),
    );
  } catch {
    // If comparison fails (different lengths or other errors), token is invalid
    return false;
  }
}

/**
 * Creates a JWT payload structure from user data.
 *
 * This is a helper function to ensure consistent payload structure across
 * the application. The payload is then signed by JwtService to create the access token.
 *
 * JWT Standard: Uses "sub" (subject) claim for user ID, following JWT best practices.
 *
 * @param userId - User's unique identifier (UUID)
 * @param email - User's email address
 * @param role - User's role (CUSTOMER, ADMIN, MANAGER)
 * @returns JWT payload object ready to be signed
 */
export function createJwtPayload(
  userId: string,
  email: string,
  role: string,
): JwtPayload {
  return {
    sub: userId, // JWT standard: "subject" claim contains the user ID
    email, // User's email for convenience (display, logging)
    role, // User's role for RBAC authorization checks
  };
}

