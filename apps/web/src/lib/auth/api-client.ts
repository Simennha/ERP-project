import type { LoginResponse, MeResponse, RefreshResponse } from '@erp/contracts';

/**
 * Base URL the browser uses to reach the NestJS API. Override with
 * NEXT_PUBLIC_API_URL (in apps/web/.env.local) if the API is not on :3001.
 */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function extractErrorMessage(res: Response): Promise<string> {
  try {
    const body: unknown = await res.json();
    if (body && typeof body === 'object' && 'message' in body) {
      const message = (body as { message: unknown }).message;
      if (typeof message === 'string') {
        return message;
      }
      if (Array.isArray(message)) {
        return message.join(', ');
      }
    }
  } catch {
    // Non-JSON error body — fall through to the status text.
  }
  return `Request failed (${res.status})`;
}

/** POST /auth/login — sets the httpOnly refresh cookie, returns access token + user. */
export async function apiLogin(email: string, password: string): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(await extractErrorMessage(res));
  }
  return (await res.json()) as LoginResponse;
}

/**
 * POST /auth/refresh — exchanges the refresh cookie for a new access token.
 * Returns null when there is no valid session (so app bootstrap can proceed
 * as "logged out" without throwing).
 */
export async function apiRefresh(): Promise<RefreshResponse | null> {
  const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) {
    return null;
  }
  return (await res.json()) as RefreshResponse;
}

/** GET /auth/me — current user + effective permission keys. */
export async function apiMe(accessToken: string): Promise<MeResponse> {
  const res = await fetch(`${API_BASE_URL}/auth/me`, {
    method: 'GET',
    credentials: 'include',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(await extractErrorMessage(res));
  }
  return (await res.json()) as MeResponse;
}

/** POST /auth/logout — clears the refresh cookie. */
export async function apiLogout(): Promise<void> {
  await fetch(`${API_BASE_URL}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  });
}
