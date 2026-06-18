import type { auth } from './auth';

/**
 * Better Auth infers the types
 * https://www.better-auth.com/docs/concepts/typescript#inferring-types
 */
export type Session = typeof auth.$Infer.Session;
export type SessionUser = typeof auth.$Infer.Session.user;
