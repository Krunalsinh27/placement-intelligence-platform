import { describe, it, expect } from 'vitest';
import { getDatabaseStatus } from '../config/database.js';
import { getSessionCookieOptions, getSessionCookieName } from '../config/cookies.js';

describe('Database and Cookie configuration', () => {
  it('returns "disconnected" when not connected to MongoDB', () => {
    const status = getDatabaseStatus();
    expect(status).toBe('disconnected');
  });

  describe('Cookie Security Options (ADR 0003)', () => {
    it('sets httpOnly and sameSite=lax for session cookies', () => {
      const options = getSessionCookieOptions(false);
      expect(options.httpOnly).toBe(true);
      expect(options.sameSite).toBe('lax');
      expect(options.secure).toBe(false);
    });

    it('sets secure=true in production', () => {
      const options = getSessionCookieOptions(true);
      expect(options.secure).toBe(true);
    });

    it('uses __Host- prefix in production and standard name in development', () => {
      expect(getSessionCookieName(true)).toBe('__Host-session');
      expect(getSessionCookieName(false)).toBe('session');
    });
  });
});
