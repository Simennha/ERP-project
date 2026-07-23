/** Name of the httpOnly cookie holding the refresh token. */
export const REFRESH_TOKEN_COOKIE = 'refresh_token';

/**
 * Cookie path scope. Scoping to /auth means the refresh token is only sent to
 * auth routes, never to general API calls.
 */
export const REFRESH_COOKIE_PATH = '/auth';

/** Refresh cookie lifetime (7 days), kept in sync with JWT_REFRESH_EXPIRES_IN. */
export const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
