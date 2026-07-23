/**
 * The shape Passport attaches to `req.user` after a successful JWT validation.
 * Produced by the JWT strategies (see auth/strategies) and consumed by guards,
 * the `@CurrentUser()` decorator, and controllers.
 */
export interface AuthenticatedUser {
  userId: string;
  companyId: string;
  email: string;
}
