/**
 * Refresh Token Payload Interface
 *
 * Defines the structure of data associated with a refresh token during validation.
 *
 * Unlike JWT payloads, refresh tokens don't embed user data directly.
 * Instead, this interface represents the data structure we extract when validating
 * a refresh token from the database.
 *
 * When a refresh token is presented:
 * 1. Hash the presented token using HMAC-SHA256
 * 2. Look up the hash in the database
 * 3. Return this payload containing user ID and token metadata
 */

/**
 * Payload structure extracted when validating a refresh token
 */
export interface RefreshTokenPayload {
  /**
   * User's unique identifier (UUID)
   * Used to identify which user this refresh token belongs to
   */
  userId: string;

  /**
   * Token hash (HMAC-SHA256)
   * The hashed version of the refresh token stored in database
   * Used to match against the presented token's hash
   */
  tokenHash: string;

  /**
   * Token expiration timestamp
   * Used to check if the token is still valid (not expired)
   */
  expiresAt: Date;

  /**
   * Token creation timestamp
   * Used for logging, analytics, and token rotation policies
   */
  createdAt: Date;
}

