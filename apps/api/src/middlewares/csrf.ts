import type { Request, Response, NextFunction } from 'express';
import { getEnv } from '../config/env.js';
import crypto from 'node:crypto';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * ADR 0003: CSRF Defense via Origin Validation and SameSite cookie isolation.
 * For state-changing methods (POST, PUT, PATCH, DELETE), validates that the
 * request Origin (or Referer) matches the authorized client.
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  const env = getEnv();
  const origin =
    (req.headers['origin'] as string | undefined) ||
    (typeof req.headers['referer'] === 'string'
      ? new URL(req.headers['referer']).origin
      : undefined);
  const secFetchSite = req.headers['sec-fetch-site'];

  // Reject explicit cross-site fetch metadata if browser provides it
  if (secFetchSite === 'cross-site') {
    res.status(403).json({
      error: {
        code: 'CSRF_REJECTED',
        message: 'Cross-site request blocked.',
        requestId: crypto.randomUUID(),
      },
    });
    return;
  }

  // If origin is present, check against CLIENT_URL
  if (origin) {
    let allowed = false;
    try {
      const allowedOrigin = new URL(env.CLIENT_URL).origin;
      const incomingOrigin = new URL(origin).origin;
      allowed = allowedOrigin === incomingOrigin;
    } catch {
      // Invalid URL format
    }

    // In non-production, also permit localhost client ports
    if (!allowed && env.NODE_ENV !== 'production') {
      allowed = origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:');
    }

    if (!allowed) {
      res.status(403).json({
        error: {
          code: 'CSRF_FORBIDDEN_ORIGIN',
          message: 'Cross-origin request blocked.',
          requestId: crypto.randomUUID(),
        },
      });
      return;
    }
  }

  next();
}
