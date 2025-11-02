/**
 * JWT Payload Interface
 *
 * Defines the structure of the payload embedded in JWT access tokens.
 * This payload is decoded and available in authenticated requests via the JWT strategy.
 *
 * The payload contains minimal user information needed for authorization:
 * - User ID: For identifying the authenticated user
 * - Email: For display/logging purposes (can be used instead of fetching from DB)
 * - Role: For role-based access control (RBAC) checks
 *
 * Security Note: Keep payload small - JWTs are sent with every request.
 * Only include non-sensitive data needed for authorization.
 */

/**
 * Payload structure for JWT access tokens
 */
export interface JwtPayload {
  /**
   * User's unique identifier (UUID)
   * Used to identify the authenticated user in database queries
   */
  sub: string; // Standard JWT claim: "subject" (user ID)

  /**
   * User's email address
   * Included for convenience (avoids DB lookup in some cases)
   * Not used for authentication, only for display/logging
   */
  email: string;

  /**
   * User's role (CUSTOMER, ADMIN, MANAGER)
   * Used by RolesGuard to enforce role-based access control
   */
  role: string;
}

