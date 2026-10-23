import { Router } from 'express';
import type { Request, Response, Router as ExpressRouter } from 'express';
import crypto from 'node:crypto';
import { LoginRequestSchema } from '@placement-platform/contracts';
import { authService, AuthenticationError } from './auth.service.js';
import { validateBody } from '../../middlewares/validate.js';
import { requireAuth } from '../../middlewares/auth.js';
import { createAuthRateLimiter } from '../../middlewares/rate-limit.js';
import { csrfProtection } from '../../middlewares/csrf.js';
import { getEnv } from '../../config/env.js';
import {
  getSessionCookieName,
  getSessionCookieOptions,
  getClearSessionCookieOptions,
} from '../../config/cookies.js';

export const authRouter: ExpressRouter = Router();

// Brute-force rate limiting: 5 attempts per IP per 15 minutes (relaxed in test environment)
const isTestEnv = getEnv().NODE_ENV === 'test';
const loginLimiter = createAuthRateLimiter(isTestEnv ? 1000 : 5, 15 * 60 * 1000);

/**
 * POST /api/v1/auth/login
 * Public endpoint to authenticate and receive an HttpOnly session cookie.
 */
authRouter.post(
  '/auth/login',
  loginLimiter,
  csrfProtection,
  validateBody(LoginRequestSchema),
  async (req: Request, res: Response): Promise<void> => {
    const isProd = getEnv().NODE_ENV === 'production';
    const cookieName = getSessionCookieName(isProd);

    try {
      const result = await authService.login(req.body, {
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      });

      // Set secure HttpOnly session cookie
      res.cookie(cookieName, result.rawToken, getSessionCookieOptions(isProd));

      res.status(200).json({
        data: {
          user: result.user,
        },
        meta: {
          requestId: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      if (error instanceof AuthenticationError) {
        res.status(error.statusCode).json({
          error: {
            code: error.code,
            message: error.message,
            requestId: crypto.randomUUID(),
          },
        });
        return;
      }

      console.error('[auth] Unexpected error during login:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred during login.',
          requestId: crypto.randomUUID(),
        },
      });
    }
  }
);

/**
 * POST /api/v1/auth/logout
 * Revokes the current session and clears the session cookie.
 */
authRouter.post(
  '/auth/logout',
  requireAuth,
  csrfProtection,
  async (req: Request, res: Response): Promise<void> => {
    const isProd = getEnv().NODE_ENV === 'production';
    const cookieName = getSessionCookieName(isProd);
    const rawToken = req.cookies[cookieName] || req.cookies['session'];

    if (rawToken && typeof rawToken === 'string') {
      await authService.logout(rawToken, {
        userId: req.session?.userId,
        orgId: req.session?.orgId,
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      });
    }

    res.clearCookie(cookieName, getClearSessionCookieOptions(isProd));
    if (!isProd) {
      res.clearCookie('session', getClearSessionCookieOptions(false));
    }

    res.status(200).json({
      data: {
        success: true,
      },
      meta: {
        requestId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
    });
  }
);

/**
 * GET /api/v1/auth/me
 * Retrieves the currently authenticated user's profile and active role.
 */
authRouter.get('/auth/me', requireAuth, (req: Request, res: Response): void => {
  res.status(200).json({
    data: {
      user: {
        id: req.session!.userId,
        email: req.session!.user.email,
        fullName: req.session!.user.fullName,
        activeOrgId: req.session!.orgId,
        role: req.session!.role,
      },
    },
    meta: {
      requestId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    },
  });
});
