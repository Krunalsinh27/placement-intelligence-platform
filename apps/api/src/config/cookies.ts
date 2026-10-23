import type { CookieOptions } from 'express';

/**
 * ADR 0003: Server-Side Session Authentication with Secure Cookies
 *
 * In production (HTTPS), we use the __Host- prefix which prevents subdomain injection
 * and requires the Secure attribute and path=/ according to IETF RFC 6265bis.
 * In local development (HTTP localhost), browsers reject __Host- cookies, so we fallback
 * to a standard cookie name.
 */
export function getSessionCookieName(isProduction: boolean): string {
  return isProduction ? '__Host-session' : 'session';
}

/**
 * Standard cookie options enforcing httpOnly, secure, and sameSite properties.
 */
export function getSessionCookieOptions(isProduction: boolean): CookieOptions {
  return {
    httpOnly: true, // Prevents JavaScript access (mitigates XSS)
    secure: isProduction, // Enforces transmission over HTTPS in production
    sameSite: 'lax', // CSRF mitigation for first-party navigation
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
  };
}

/**
 * Compatible options for clearing session cookie, matching path, secure, and sameSite.
 */
export function getClearSessionCookieOptions(isProduction: boolean): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
  };
}

