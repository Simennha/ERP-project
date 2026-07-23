/**
 * Keys used with nestjs-cls to carry request-scoped identity through the
 * request lifecycle without prop-drilling. Seeded by the JWT strategy on
 * successful authentication (see auth/strategies/jwt.strategy.ts).
 *
 * Later phases (audit logging, company-scoped queries) read these to stamp
 * companyId / userId onto writes automatically.
 */
export const CLS_USER_ID = 'userId';
export const CLS_COMPANY_ID = 'companyId';
