import rateLimit from 'express-rate-limit';
import crypto from 'node:crypto';
import type { Request, Response } from 'express';

/**
 * Rate limiter for sensitive authentication endpoints (e.g. login).
 * Enforces brute-force defense per IP address.
 */
export function createAuthRateLimiter(maxAttempts = 5, windowMs = 15 * 60 * 1000) {
  return rateLimit({
    windowMs,
    limit: maxAttempts,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req: Request, res: Response) => {
      res.status(429).json({
        error: {
          code: 'TOO_MANY_REQUESTS',
          message: 'Too many login attempts. Please try again later.',
          requestId: crypto.randomUUID(),
        },
      });
    },
  });
}
