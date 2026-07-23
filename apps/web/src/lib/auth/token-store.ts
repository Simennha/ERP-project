/**
 * Single source of truth for the in-memory access token, shared between
 * `AuthProvider` (which owns login/refresh/logout) and `authedFetch`
 * (api-client.ts — needs to read the current token and, on a 401, refresh
 * and update it so subsequent calls don't immediately 401 again too).
 * Never persisted (no localStorage) — same "access token lives in memory
 * only" invariant AuthProvider always had; this just moves the value out of
 * a React ref so code outside the component tree can read/write it.
 */
let currentAccessToken: string | null = null;

export function getStoredAccessToken(): string | null {
  return currentAccessToken;
}

export function setStoredAccessToken(token: string | null): void {
  currentAccessToken = token;
}
