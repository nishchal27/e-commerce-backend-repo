/**
 * Token Pair Interface
 *
 * Defines the structure of the token pair returned after successful authentication
 * (login or registration).
 *
 * Token pairs consist of:
 * - Access Token: Short-lived JWT used to authenticate API requests
 * - Refresh Token: Long-lived token used to obtain new access tokens
 *
 * The refresh token is typically sent via HttpOnly cookie for security,
 * while the access token is returned in the response body for the client
 * to store in memory/localStorage.
 */

/**
 * Token pair structure returned by authentication endpoints
 */
export interface TokenPair {
  /**
   * Access token (JWT)
   * Short-lived (15m-1h) token used to authenticate API requests
   * Client stores this in memory/localStorage and sends in Authorization header
   * Format: "Bearer <token>"
   */
  accessToken: string;

  /**
   * Refresh token (UUID)
   * Long-lived (7-30 days) token used to obtain new access tokens
   * Stored in HttpOnly cookie by server, not accessible to JavaScript
   * Used when access token expires to get a new one without re-login
   */
  refreshToken: string;
}

