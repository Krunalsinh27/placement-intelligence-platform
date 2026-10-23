import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import { createApp } from '../app.js';
import { UserModel } from '../models/user.model.js';
import { OrganizationModel } from '../models/organization.model.js';
import { SessionModel } from '../models/session.model.js';
import { AuditLogModel } from '../models/audit-log.model.js';
import { hashPassword, hashSessionToken } from '../utils/password.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { createAuthRateLimiter } from '../middlewares/rate-limit.js';
import {
  getSessionCookieName,
  getSessionCookieOptions,
  getClearSessionCookieOptions,
} from '../config/cookies.js';
import mongoose from 'mongoose';

const app = createApp();

// Add a test-only role-guarded endpoint to verify requireRole and tenant isolation
const testRoleApp = express();
testRoleApp.use(cookieParser());
testRoleApp.use(express.json());
testRoleApp.get(
  '/api/v1/test/tpo-only',
  requireAuth,
  requireRole('tpo', 'college_admin'),
  (req, res) => {
    res.status(200).json({
      data: {
        message: 'Welcome TPO',
        scopedOrgId: req.session?.orgId,
      },
    });
  }
);

describe('Authentication & Security (Phase 3)', () => {
  const dummyOrgId = new mongoose.Types.ObjectId();
  const dummyUserId = new mongoose.Types.ObjectId();
  const dummySessionId = new mongoose.Types.ObjectId();

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(AuditLogModel, 'create').mockResolvedValue({} as never);
    vi.spyOn(SessionModel, 'deleteOne').mockResolvedValue({} as never);
  });

  describe('Cookie Security Compatibility', () => {
    it('ensures set and clear cookie options match path, sameSite, and security', () => {
      const isProd = true;
      const setOpts = getSessionCookieOptions(isProd);
      const clearOpts = getClearSessionCookieOptions(isProd);

      expect(setOpts.path).toBe(clearOpts.path);
      expect(setOpts.sameSite).toBe(clearOpts.sameSite);
      expect(setOpts.secure).toBe(clearOpts.secure);
      expect(setOpts.httpOnly).toBe(clearOpts.httpOnly);
    });

    it('uses __Host- prefix in production and standard name in development', () => {
      expect(getSessionCookieName(true)).toBe('__Host-session');
      expect(getSessionCookieName(false)).toBe('session');
    });
  });

  describe('Rate Limiting', () => {
    it('returns 429 TOO_MANY_REQUESTS when login rate limit is exceeded', async () => {
      const rateLimitedApp = express();
      rateLimitedApp.use(express.json());
      const testLimiter = createAuthRateLimiter(2, 60000);
      rateLimitedApp.post('/api/v1/test-rate-limit', testLimiter, (_req, res) => {
        res.status(200).json({ ok: true });
      });

      const res1 = await request(rateLimitedApp).post('/api/v1/test-rate-limit').send({});
      expect(res1.status).toBe(200);

      const res2 = await request(rateLimitedApp).post('/api/v1/test-rate-limit').send({});
      expect(res2.status).toBe(200);

      const res3 = await request(rateLimitedApp).post('/api/v1/test-rate-limit').send({});
      expect(res3.status).toBe(429);
      expect(res3.body.error.code).toBe('TOO_MANY_REQUESTS');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('validates request payload and rejects invalid email or short password with 400', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'invalid-email', password: '123' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details).toBeDefined();
    });

    it('handles malformed JSON payloads gracefully with HTTP 400 instead of 500', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .set('Content-Type', 'application/json')
        .send('{malformed: json');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('MALFORMED_JSON');
      expect(res.body.error.message).toBe('Malformed JSON in request body.');
    });

    it('rejects cross-site CSRF requests with 403', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .set('Sec-Fetch-Site', 'cross-site')
        .send({ email: 'user@example.com', password: 'Password123!' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('CSRF_REJECTED');
    });

    it('returns generic 401 when user does not exist', async () => {
      vi.spyOn(UserModel, 'findOne').mockReturnValue({
        select: vi.fn().mockResolvedValue(null),
      } as never);

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'nonexistent@example.com', password: 'Password123!' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(res.body.error.message).toBe('Invalid email or password.');
    });

    it('returns generic 401 when password does not match', async () => {
      const correctHash = await hashPassword('CorrectPassword123!');
      vi.spyOn(UserModel, 'findOne').mockReturnValue({
        select: vi.fn().mockResolvedValue({
          _id: dummyUserId,
          email: 'user@example.com',
          passwordHash: correctHash,
          status: 'active',
          memberships: [{ orgId: dummyOrgId, role: 'tpo' }],
        }),
      } as never);

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'user@example.com', password: 'WrongPassword999!' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(res.body.error.message).toBe('Invalid email or password.');
    });

    it('rejects login when user status is disabled with 401', async () => {
      const hash = await hashPassword('Password123!');
      vi.spyOn(UserModel, 'findOne').mockReturnValue({
        select: vi.fn().mockResolvedValue({
          _id: dummyUserId,
          email: 'disabled@example.com',
          passwordHash: hash,
          status: 'disabled',
          memberships: [{ orgId: dummyOrgId, role: 'tpo' }],
        }),
      } as never);

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'disabled@example.com', password: 'Password123!' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('USER_INACTIVE');
    });

    it('rejects login when user organization is inactive with 403', async () => {
      const hash = await hashPassword('Password123!');
      vi.spyOn(UserModel, 'findOne').mockReturnValue({
        select: vi.fn().mockResolvedValue({
          _id: dummyUserId,
          email: 'user@example.com',
          passwordHash: hash,
          status: 'active',
          memberships: [{ orgId: dummyOrgId, role: 'tpo' }],
        }),
      } as never);

      vi.spyOn(OrganizationModel, 'findById').mockResolvedValue({
        _id: dummyOrgId,
        status: 'suspended',
      } as never);

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'user@example.com', password: 'Password123!' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('ORGANIZATION_INACTIVE');
    });

    it('successfully logs in with valid credentials and sets HttpOnly session cookie', async () => {
      const password = 'ValidPassword123!';
      const hash = await hashPassword(password);

      vi.spyOn(UserModel, 'findOne').mockReturnValue({
        select: vi.fn().mockResolvedValue({
          _id: dummyUserId,
          email: 'tpo@example.com',
          fullName: 'Prof. Demo TPO',
          passwordHash: hash,
          status: 'active',
          memberships: [{ orgId: dummyOrgId, role: 'tpo' }],
        }),
      } as never);

      vi.spyOn(OrganizationModel, 'findById').mockResolvedValue({
        _id: dummyOrgId,
        status: 'active',
      } as never);

      vi.spyOn(SessionModel, 'create').mockResolvedValue({} as never);

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'tpo@example.com', password });

      expect(res.status).toBe(200);
      expect(res.body.data.user.email).toBe('tpo@example.com');
      expect(res.body.data.user.role).toBe('tpo');
      expect(res.body.data.user.activeOrgId).toBe(dummyOrgId.toString());

      // Verify Set-Cookie header is present with HttpOnly
      const cookieHeader = res.headers['set-cookie'];
      expect(cookieHeader).toBeDefined();
      const sessionCookie = cookieHeader ? cookieHeader[0] : '';
      expect(sessionCookie).toMatch(/session=[a-f0-9]{64}/i);
      expect(sessionCookie).toContain('HttpOnly');
    });
  });

  describe('Session Verification & Active Check (requireAuth)', () => {
    const rawToken = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    it('rejects /api/v1/auth/me when session cookie is missing with 401', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('rejects /api/v1/auth/me when session has expired in database with 401 and clears cookie', async () => {
      vi.spyOn(SessionModel, 'findOne').mockResolvedValue({
        _id: dummySessionId,
        tokenHash: hashSessionToken(rawToken),
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
      } as never);

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Cookie', [`session=${rawToken}`]);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_SESSION');
      expect(res.headers['set-cookie']).toBeDefined(); // Cookie cleared
    });

    it('rejects /api/v1/auth/me if user account was disabled after session creation with 401', async () => {
      vi.spyOn(SessionModel, 'findOne').mockResolvedValue({
        _id: dummySessionId,
        userId: dummyUserId,
        orgId: dummyOrgId,
        role: 'tpo',
        expiresAt: new Date(Date.now() + 60000),
      } as never);

      vi.spyOn(UserModel, 'findById').mockResolvedValue({
        _id: dummyUserId,
        status: 'disabled', // User suspended
      } as never);

      const deleteSessionSpy = vi.spyOn(SessionModel, 'deleteOne').mockResolvedValue({} as never);

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Cookie', [`session=${rawToken}`]);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('USER_INACTIVE');
      expect(deleteSessionSpy).toHaveBeenCalled();
    });

    it('rejects /api/v1/auth/me if organization was suspended after session creation with 403', async () => {
      vi.spyOn(SessionModel, 'findOne').mockResolvedValue({
        _id: dummySessionId,
        userId: dummyUserId,
        orgId: dummyOrgId,
        role: 'tpo',
        expiresAt: new Date(Date.now() + 60000),
      } as never);

      vi.spyOn(UserModel, 'findById').mockResolvedValue({
        _id: dummyUserId,
        status: 'active',
      } as never);

      vi.spyOn(OrganizationModel, 'findById').mockResolvedValue({
        _id: dummyOrgId,
        status: 'suspended', // Organization suspended
      } as never);

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Cookie', [`session=${rawToken}`]);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('ORGANIZATION_INACTIVE');
    });

    it('returns 200 with authenticated user profile when session is valid and active', async () => {
      vi.spyOn(SessionModel, 'findOne').mockResolvedValue({
        _id: dummySessionId,
        userId: dummyUserId,
        orgId: dummyOrgId,
        role: 'tpo',
        expiresAt: new Date(Date.now() + 60000),
      } as never);

      vi.spyOn(UserModel, 'findById').mockResolvedValue({
        _id: dummyUserId,
        email: 'tpo@college.edu',
        fullName: 'Prof. Placement Officer',
        status: 'active',
      } as never);

      vi.spyOn(OrganizationModel, 'findById').mockResolvedValue({
        _id: dummyOrgId,
        status: 'active',
      } as never);

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Cookie', [`session=${rawToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.data.user.email).toBe('tpo@college.edu');
      expect(res.body.data.user.role).toBe('tpo');
      expect(res.body.data.user.activeOrgId).toBe(dummyOrgId.toString());
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    const rawToken = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';

    it('revokes ONLY the current session in database, clears cookie, and logs audit event without secrets', async () => {
      vi.spyOn(SessionModel, 'findOne').mockResolvedValue({
        _id: dummySessionId,
        userId: dummyUserId,
        orgId: dummyOrgId,
        role: 'tpo',
        expiresAt: new Date(Date.now() + 60000),
      } as never);

      vi.spyOn(UserModel, 'findById').mockResolvedValue({
        _id: dummyUserId,
        email: 'tpo@college.edu',
        fullName: 'Prof. TPO',
        status: 'active',
      } as never);

      vi.spyOn(OrganizationModel, 'findById').mockResolvedValue({
        _id: dummyOrgId,
        status: 'active',
      } as never);

      const deleteSessionSpy = vi.spyOn(SessionModel, 'deleteOne').mockResolvedValue({} as never);
      const auditLogSpy = vi.spyOn(AuditLogModel, 'create').mockResolvedValue({} as never);

      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', [`session=${rawToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.data.success).toBe(true);

      // Verify only this token hash was deleted
      const expectedTokenHash = hashSessionToken(rawToken);
      expect(deleteSessionSpy).toHaveBeenCalledWith({ tokenHash: expectedTokenHash });

      // Verify audit log has no secrets or tokens
      expect(auditLogSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'AUTH_LOGOUT',
          details: { reason: 'user_logout' },
        })
      );
    });
  });

  describe('Role-Based Authorization & Tenant Scoping', () => {
    const rawToken = '1111222233334444111122223333444411112222333344441111222233334444';

    it('blocks unauthorized roles with 403 Forbidden', async () => {
      vi.spyOn(SessionModel, 'findOne').mockResolvedValue({
        _id: dummySessionId,
        userId: dummyUserId,
        orgId: dummyOrgId,
        role: 'student', // student role is NOT allowed on this endpoint
        expiresAt: new Date(Date.now() + 60000),
      } as never);

      vi.spyOn(UserModel, 'findById').mockResolvedValue({
        _id: dummyUserId,
        email: 'student@college.edu',
        fullName: 'Jane Student',
        status: 'active',
      } as never);

      vi.spyOn(OrganizationModel, 'findById').mockResolvedValue({
        _id: dummyOrgId,
        status: 'active',
      } as never);

      const res = await request(testRoleApp)
        .get('/api/v1/test/tpo-only')
        .set('Cookie', [`session=${rawToken}`]);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('enforces strict tenant isolation on server side (ADR 0002)', async () => {
      vi.spyOn(SessionModel, 'findOne').mockResolvedValue({
        _id: dummySessionId,
        userId: dummyUserId,
        orgId: dummyOrgId, // Tenant A
        role: 'tpo',
        expiresAt: new Date(Date.now() + 60000),
      } as never);

      vi.spyOn(UserModel, 'findById').mockResolvedValue({
        _id: dummyUserId,
        email: 'tpo@college.edu',
        fullName: 'Prof. TPO',
        status: 'active',
      } as never);

      vi.spyOn(OrganizationModel, 'findById').mockResolvedValue({
        _id: dummyOrgId,
        status: 'active',
      } as never);

      // Attempt to spoof another organization via query or headers
      const res = await request(testRoleApp)
        .get('/api/v1/test/tpo-only?orgId=evil-tenant-id')
        .set('X-Organization-Id', 'evil-tenant-id')
        .set('Cookie', [`session=${rawToken}`]);

      expect(res.status).toBe(200);
      // The server strictly evaluated session.orgId from the server session, ignoring client spoofing
      expect(res.body.data.scopedOrgId).toBe(dummyOrgId.toString());
      expect(res.body.data.scopedOrgId).not.toBe('evil-tenant-id');
    });
  });
});
