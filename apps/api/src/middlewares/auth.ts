import type { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import type { UserRole } from '@placement-platform/contracts';
import { getEnv } from '../config/env.js';
import { getSessionCookieName, getClearSessionCookieOptions } from '../config/cookies.js';
import { hashSessionToken } from '../utils/password.js';
import { SessionModel } from '../models/session.model.js';
import { UserModel } from '../models/user.model.js';
import { OrganizationModel } from '../models/organization.model.js';

export interface AuthenticatedSession {
  sessionId: string;
  userId: string;
  orgId: string | null;
  role: UserRole;
  departmentId?: string | null;
  user: {
    email: string;
    fullName: string;
  };
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      session?: AuthenticatedSession;
    }
  }
}

/**
 * Validates the session cookie and ensures:
 * 1. The session exists and has not expired.
 * 2. The associated User exists and is 'active'.
 * 3. The associated Organization exists and is 'active' (when orgId is present).
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const env = getEnv();
  const isProd = env.NODE_ENV === 'production';
  const cookieName = getSessionCookieName(isProd);

  // Read cookie from primary name, with fallback to standard name if in development
  const rawToken = req.cookies[cookieName] || req.cookies['session'];

  if (!rawToken || typeof rawToken !== 'string') {
    res.status(401).json({
      error: {
        code: 'UNAUTHENTICATED',
        message: 'Authentication required. Please log in.',
        requestId: crypto.randomUUID(),
      },
    });
    return;
  }

  const tokenHash = hashSessionToken(rawToken);

  try {
    const session = await SessionModel.findOne({ tokenHash });

    if (!session || session.expiresAt <= new Date()) {
      res.clearCookie(cookieName, getClearSessionCookieOptions(isProd));
      res.status(401).json({
        error: {
          code: 'INVALID_SESSION',
          message: 'Session has expired or is invalid. Please log in again.',
          requestId: crypto.randomUUID(),
        },
      });
      return;
    }

    // Step 2: Verify user is active
    const user = await UserModel.findById(session.userId);
    if (!user || user.status !== 'active') {
      await SessionModel.deleteOne({ _id: session._id });
      res.clearCookie(cookieName, getClearSessionCookieOptions(isProd));
      res.status(401).json({
        error: {
          code: 'USER_INACTIVE',
          message: 'User account is disabled or inactive.',
          requestId: crypto.randomUUID(),
        },
      });
      return;
    }

    // Step 3: Verify organization is active (if tenant session)
    if (session.orgId) {
      const org = await OrganizationModel.findById(session.orgId);
      if (!org || org.status !== 'active') {
        await SessionModel.deleteOne({ _id: session._id });
        res.clearCookie(cookieName, getClearSessionCookieOptions(isProd));
        res.status(403).json({
          error: {
            code: 'ORGANIZATION_INACTIVE',
            message: 'Organization is inactive or suspended.',
            requestId: crypto.randomUUID(),
          },
        });
        return;
      }
    }

    // Resolve optional department assignment (e.g. for dept_coordinator)
    const activeMembership = user.memberships?.find(
      (m) => session.orgId && m.orgId.toString() === session.orgId.toString()
    );
    const departmentId = activeMembership?.departmentId
      ? activeMembership.departmentId.toString()
      : session.departmentId
        ? session.departmentId.toString()
        : null;

    // Attach validated session to request
    req.session = {
      sessionId: session._id.toString(),
      userId: user._id.toString(),
      orgId: session.orgId ? session.orgId.toString() : null,
      role: session.role as UserRole,
      departmentId,
      user: {
        email: user.email,
        fullName: user.fullName,
      },
    };

    next();
  } catch (error) {
    console.error('[auth] Error verifying session:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while authenticating the session.',
        requestId: crypto.randomUUID(),
      },
    });
  }
}

/**
 * Optional authentication middleware:
 * Populates req.session if a valid session cookie exists; otherwise continues without error.
 */
export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const env = getEnv();
  const isProd = env.NODE_ENV === 'production';
  const cookieName = getSessionCookieName(isProd);

  const rawToken = req.cookies[cookieName] || req.cookies['session'];

  if (!rawToken || typeof rawToken !== 'string') {
    next();
    return;
  }

  const tokenHash = hashSessionToken(rawToken);

  try {
    const session = await SessionModel.findOne({ tokenHash });

    if (!session || session.expiresAt <= new Date()) {
      next();
      return;
    }

    const user = await UserModel.findById(session.userId);
    if (!user || user.status !== 'active') {
      next();
      return;
    }

    if (session.orgId) {
      const org = await OrganizationModel.findById(session.orgId);
      if (!org || org.status !== 'active') {
        next();
        return;
      }
    }

    const activeMembership = user.memberships?.find(
      (m) => session.orgId && m.orgId.toString() === session.orgId.toString()
    );
    const departmentId = activeMembership?.departmentId
      ? activeMembership.departmentId.toString()
      : session.departmentId
        ? session.departmentId.toString()
        : null;

    req.session = {
      sessionId: session._id.toString(),
      userId: user._id.toString(),
      orgId: session.orgId ? session.orgId.toString() : null,
      role: session.role as UserRole,
      departmentId,
      user: {
        email: user.email,
        fullName: user.fullName,
      },
    };

    next();
  } catch {
    next();
  }
}

/**
 * Enforces role-based authorization.
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.session) {
      res.status(401).json({
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Authentication required.',
          requestId: crypto.randomUUID(),
        },
      });
      return;
    }

    if (!allowedRoles.includes(req.session.role)) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to access this resource.',
          requestId: crypto.randomUUID(),
        },
      });
      return;
    }

    next();
  };
}

/**
 * ADR 0002 Helper: Enforces tenant isolation from validated server session.
 * Throws if the current session has no active organization context.
 */
export function getTenantScope(req: Request): string {
  if (!req.session || !req.session.orgId) {
    throw new Error('Tenant context missing from authenticated session.');
  }
  return req.session.orgId;
}
