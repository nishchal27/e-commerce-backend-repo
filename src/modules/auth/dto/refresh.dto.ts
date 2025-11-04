/**
 * Refresh DTO (Data Transfer Object)
 *
 * This DTO is used for token refresh requests. Note that refresh tokens
 * are typically sent via HttpOnly cookie (not in request body) for security.
 *
 * This DTO is optional - the refresh endpoint can work without a body
 * if the token is in the cookie. However, having a DTO allows for
 * future flexibility (e.g., device identifier, refresh token in body for mobile apps).
 *
 * Security Considerations:
 * - Refresh token is typically in HttpOnly cookie (not accessible to JavaScript)
 * - If token is in body, it should never be logged or exposed in error messages
 * - Token validation happens in the RefreshStrategy (not here)
 */

/**
 * DTO for token refresh (optional)
 * Used by POST /auth/refresh endpoint
 *
 * Note: In most cases, the refresh token is sent via HttpOnly cookie,
 * so this DTO may be empty. However, some clients (mobile apps) may
 * send the refresh token in the request body.
 */
export class RefreshDto {
  // Currently empty - refresh token is in cookie
  // Future: Could add deviceId, refreshToken (for mobile apps), etc.
}

