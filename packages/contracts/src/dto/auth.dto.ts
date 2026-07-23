import { z } from 'zod';

/** Request body for `POST /auth/login`. */
export const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(200),
});
export type LoginInput = z.infer<typeof loginSchema>;

/** The authenticated user shape returned by the API (never includes secrets). */
export const authUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  companyId: z.string(),
  departmentId: z.string().nullable(),
  isActive: z.boolean(),
});
export type AuthUser = z.infer<typeof authUserSchema>;

/** Response body for `POST /auth/login`. */
export const loginResponseSchema = z.object({
  accessToken: z.string(),
  user: authUserSchema,
});
export type LoginResponse = z.infer<typeof loginResponseSchema>;

/** Response body for `POST /auth/refresh`. */
export const refreshResponseSchema = z.object({
  accessToken: z.string(),
});
export type RefreshResponse = z.infer<typeof refreshResponseSchema>;

/** Response body for `GET /auth/me`. */
export const meResponseSchema = z.object({
  user: authUserSchema,
  permissions: z.array(z.string()),
});
export type MeResponse = z.infer<typeof meResponseSchema>;

/**
 * Decoded JWT access-token payload. `sub` is the user id.
 * (Not validated at runtime here — Passport verifies the signature; this type
 * documents the claim shape shared between API and client.)
 */
export interface AccessTokenPayload {
  sub: string;
  companyId: string;
  email: string;
}

/** Decoded JWT refresh-token payload. */
export interface RefreshTokenPayload {
  sub: string;
  companyId: string;
  tokenType: 'refresh';
}
