import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../app.js';
import { CompanyModel } from '../models/company.model.js';
import { CollegeCompanyProfileModel } from '../models/college-company-profile.model.js';
import { CompanyRecruiterModel } from '../models/company-recruiter.model.js';
import { UserModel } from '../models/user.model.js';
import { SessionModel } from '../models/session.model.js';
import { OrganizationModel } from '../models/organization.model.js';
import { AuditLogModel } from '../models/audit-log.model.js';
import { hashSessionToken } from '../utils/password.js';
import type { UserRole } from '@placement-platform/contracts';

const app = createApp();

describe('Recruiter Management & Invitations Backend (Phase 6, Step 3)', () => {
  const collegeAOrgId = new mongoose.Types.ObjectId();
  const tpoUserId = new mongoose.Types.ObjectId();
  const companyAdminUserId = new mongoose.Types.ObjectId();
  const companyId = new mongoose.Types.ObjectId();
  const otherCompanyId = new mongoose.Types.ObjectId();
  const rawSessionToken = 'test-recruiter-session-token-xyz';

  function mockSession(
    role: UserRole,
    orgId: mongoose.Types.ObjectId | null,
    userId: mongoose.Types.ObjectId = tpoUserId,
    email: string = `${role}@college.edu`
  ) {
    vi.spyOn(SessionModel, 'findOne').mockResolvedValue({
      _id: new mongoose.Types.ObjectId(),
      tokenHash: hashSessionToken(rawSessionToken),
      userId,
      orgId: orgId ?? undefined,
      role,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    } as never);

    vi.spyOn(UserModel, 'findById').mockResolvedValue({
      _id: userId,
      email,
      fullName: `Test ${role}`,
      status: 'active',
      memberships: orgId
        ? [
            {
              orgId,
              role,
            },
          ]
        : [],
    } as never);

    if (orgId) {
      vi.spyOn(OrganizationModel, 'findById').mockResolvedValue({
        _id: orgId,
        name: 'Test College',
        slug: 'test-college',
        status: 'active',
      } as never);
    }
  }

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(AuditLogModel, 'create').mockResolvedValue({} as never);
  });

  const baseInviteInput = {
    companyId: companyId.toString(),
    name: 'Jane Doe',
    email: 'jane.doe@acme.example.com',
    phone: '+91 9876543210',
    designation: 'Senior Campus Recruiter',
    role: 'company_recruiter' as const,
  };

  function mockCompanyDoc(overrides: Record<string, unknown> = {}) {
    return {
      _id: companyId,
      name: 'Acme Corporation',
      website: 'https://acme.example.com',
      industry: 'Software Engineering',
      ...overrides,
    };
  }

  function mockRecruiterDoc(overrides: Record<string, unknown> = {}) {
    return {
      _id: new mongoose.Types.ObjectId(),
      companyId,
      userId: null,
      name: 'Jane Doe',
      email: 'jane.doe@acme.example.com',
      phone: '+91 9876543210',
      designation: 'Senior Campus Recruiter',
      role: 'company_recruiter',
      status: 'pending_invitation',
      invitationTokenHash: hashSessionToken('valid-raw-token-1234567890'),
      invitationExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      invitedByOrgId: collegeAOrgId,
      invitedByUserId: tpoUserId,
      createdAt: new Date(),
      updatedAt: new Date(),
      save: vi.fn().mockResolvedValue(true),
      ...overrides,
    };
  }

  // ─── 1. Authentication & Role Authorization ───────────────────────────────

  describe('Authentication & Role Guards', () => {
    it('rejects unauthenticated requests to invite endpoints with 401 UNAUTHENTICATED', async () => {
      const res = await request(app)
        .post(`/api/v1/companies/${companyId.toString()}/recruiters/invite`)
        .send(baseInviteInput);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('rejects unauthorized roles (student, dept_coordinator) from inviting recruiters with 403', async () => {
      mockSession('student', collegeAOrgId);

      const resStudent = await request(app)
        .post(`/api/v1/companies/${companyId.toString()}/recruiters/invite`)
        .set('Cookie', [`session=${rawSessionToken}`])
        .send(baseInviteInput);

      expect(resStudent.status).toBe(403);
      expect(resStudent.body.error.code).toBe('FORBIDDEN');

      mockSession('dept_coordinator', collegeAOrgId);
      const resCoord = await request(app)
        .post(`/api/v1/companies/${companyId.toString()}/recruiters/invite`)
        .set('Cookie', [`session=${rawSessionToken}`])
        .send(baseInviteInput);

      expect(resCoord.status).toBe(403);
      expect(resCoord.body.error.code).toBe('FORBIDDEN');
    });

    it('rejects company_recruiter from inviting additional recruiters', async () => {
      mockSession('company_recruiter', null, new mongoose.Types.ObjectId());

      const res = await request(app)
        .post(`/api/v1/companies/${companyId.toString()}/recruiters/invite`)
        .set('Cookie', [`session=${rawSessionToken}`])
        .send(baseInviteInput);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  // ─── 2. Recruiter Invitation Creation ─────────────────────────────────────

  describe('Recruiter Invitation Creation', () => {
    it('allows college TPO to invite recruiter for a registered company', async () => {
      mockSession('tpo', collegeAOrgId, tpoUserId);

      vi.spyOn(CompanyModel, 'findById').mockResolvedValue(mockCompanyDoc() as never);
      vi.spyOn(CollegeCompanyProfileModel, 'findOne').mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        orgId: collegeAOrgId,
        companyId,
        status: 'verified',
      } as never);
      vi.spyOn(CompanyRecruiterModel, 'findOne').mockResolvedValue(null);

      const createdRecruiter = mockRecruiterDoc();
      vi.spyOn(CompanyRecruiterModel, 'create').mockResolvedValue(createdRecruiter as never);

      const res = await request(app)
        .post(`/api/v1/companies/${companyId.toString()}/recruiters/invite`)
        .set('Cookie', [`session=${rawSessionToken}`])
        .send(baseInviteInput);

      expect(res.status).toBe(201);
      expect(res.body.data.recruiter.name).toBe('Jane Doe');
      expect(res.body.data.recruiter.status).toBe('pending_invitation');
      expect(res.body.data.invitationToken).toBeDefined();
      expect(typeof res.body.data.invitationToken).toBe('string');
      expect(res.body.data.invitationToken.length).toBe(64); // 256 bits = 64 hex chars
      expect(res.body.data.invitationExpiresAt).toBeDefined();

      // Check audit log
      expect(AuditLogModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'recruiter_invited',
          details: expect.objectContaining({
            email: 'jane.doe@acme.example.com',
          }),
        })
      );
    });

    it('rejects college TPO invitation if company is not registered in college directory', async () => {
      mockSession('tpo', collegeAOrgId, tpoUserId);

      vi.spyOn(CompanyModel, 'findById').mockResolvedValue(mockCompanyDoc() as never);
      vi.spyOn(CollegeCompanyProfileModel, 'findOne').mockResolvedValue(null);

      const res = await request(app)
        .post(`/api/v1/companies/${companyId.toString()}/recruiters/invite`)
        .set('Cookie', [`session=${rawSessionToken}`])
        .send(baseInviteInput);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('COMPANY_NOT_FOUND');
    });

    it('rejects college TPO invitation if company is blacklisted in college directory', async () => {
      mockSession('tpo', collegeAOrgId, tpoUserId);

      vi.spyOn(CompanyModel, 'findById').mockResolvedValue(mockCompanyDoc() as never);
      vi.spyOn(CollegeCompanyProfileModel, 'findOne').mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        orgId: collegeAOrgId,
        companyId,
        status: 'blacklisted',
      } as never);

      const res = await request(app)
        .post(`/api/v1/companies/${companyId.toString()}/recruiters/invite`)
        .set('Cookie', [`session=${rawSessionToken}`])
        .send(baseInviteInput);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('COMPANY_BLACKLISTED');
    });

    it('allows company_admin to invite a recruiter for their own company', async () => {
      mockSession('company_admin', null, companyAdminUserId, 'admin@acme.example.com');

      vi.spyOn(CompanyModel, 'findById').mockResolvedValue(mockCompanyDoc() as never);
      // Company admin membership lookup for this company
      vi.spyOn(CompanyRecruiterModel, 'findOne')
        .mockResolvedValueOnce({
          _id: new mongoose.Types.ObjectId(),
          companyId,
          userId: companyAdminUserId,
          role: 'company_admin',
          status: 'active',
        } as never) // verify caller
        .mockResolvedValueOnce(null); // recruiter exists check

      const createdRecruiter = mockRecruiterDoc({ role: 'interviewer' });
      vi.spyOn(CompanyRecruiterModel, 'create').mockResolvedValue(createdRecruiter as never);

      const res = await request(app)
        .post(`/api/v1/companies/${companyId.toString()}/recruiters/invite`)
        .set('Cookie', [`session=${rawSessionToken}`])
        .send({ ...baseInviteInput, role: 'interviewer' });

      expect(res.status).toBe(201);
      expect(res.body.data.recruiter.role).toBe('interviewer');
    });

    it('rejects company_admin from inviting for a different company', async () => {
      mockSession('company_admin', null, companyAdminUserId, 'admin@acme.example.com');

      vi.spyOn(CompanyModel, 'findById').mockResolvedValue(
        mockCompanyDoc({ _id: otherCompanyId }) as never
      );
      // Company admin does NOT have a record for otherCompanyId
      vi.spyOn(CompanyRecruiterModel, 'findOne').mockResolvedValue(null);

      const res = await request(app)
        .post(`/api/v1/companies/${otherCompanyId.toString()}/recruiters/invite`)
        .set('Cookie', [`session=${rawSessionToken}`])
        .send({ ...baseInviteInput, companyId: otherCompanyId.toString() });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  // ─── 3. Existing Recruiter & Duplicate Handling ───────────────────────────

  describe('Duplicate & Re-invitation Handling', () => {
    it('returns 409 RECRUITER_ALREADY_EXISTS when recruiter is already active', async () => {
      mockSession('tpo', collegeAOrgId);

      vi.spyOn(CompanyModel, 'findById').mockResolvedValue(mockCompanyDoc() as never);
      vi.spyOn(CollegeCompanyProfileModel, 'findOne').mockResolvedValue({
        status: 'verified',
      } as never);
      vi.spyOn(CompanyRecruiterModel, 'findOne').mockResolvedValue(
        mockRecruiterDoc({ status: 'active' }) as never
      );

      const res = await request(app)
        .post(`/api/v1/companies/${companyId.toString()}/recruiters/invite`)
        .set('Cookie', [`session=${rawSessionToken}`])
        .send(baseInviteInput);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('RECRUITER_ALREADY_EXISTS');
    });

    it('returns 409 INVITATION_ALREADY_PENDING when active pending invitation exists', async () => {
      mockSession('tpo', collegeAOrgId);

      vi.spyOn(CompanyModel, 'findById').mockResolvedValue(mockCompanyDoc() as never);
      vi.spyOn(CollegeCompanyProfileModel, 'findOne').mockResolvedValue({
        status: 'verified',
      } as never);
      vi.spyOn(CompanyRecruiterModel, 'findOne').mockResolvedValue(
        mockRecruiterDoc({
          status: 'pending_invitation',
          invitationExpiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        }) as never
      );

      const res = await request(app)
        .post(`/api/v1/companies/${companyId.toString()}/recruiters/invite`)
        .set('Cookie', [`session=${rawSessionToken}`])
        .send(baseInviteInput);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('INVITATION_ALREADY_PENDING');
    });

    it('re-issues invitation when previous invitation was inactive or expired', async () => {
      mockSession('tpo', collegeAOrgId);

      vi.spyOn(CompanyModel, 'findById').mockResolvedValue(mockCompanyDoc() as never);
      vi.spyOn(CollegeCompanyProfileModel, 'findOne').mockResolvedValue({
        status: 'verified',
      } as never);

      const inactiveRecruiter = mockRecruiterDoc({
        status: 'inactive',
        invitationExpiresAt: null,
      });
      vi.spyOn(CompanyRecruiterModel, 'findOne').mockResolvedValue(inactiveRecruiter as never);

      const res = await request(app)
        .post(`/api/v1/companies/${companyId.toString()}/recruiters/invite`)
        .set('Cookie', [`session=${rawSessionToken}`])
        .send(baseInviteInput);

      expect(res.status).toBe(201);
      expect(inactiveRecruiter.save).toHaveBeenCalled();
      expect(inactiveRecruiter.status).toBe('pending_invitation');
      expect(AuditLogModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'recruiter_invitation_reissued',
        })
      );
    });
  });

  // ─── 4. Invitation Acceptance - New User Flow ─────────────────────────────

  describe('Invitation Acceptance: New User', () => {
    const rawToken = 'valid-token-32-chars-long-hex-random';

    it('creates new user account with Argon2id hash and activates recruiter', async () => {
      const pendingRecruiter = mockRecruiterDoc({
        status: 'pending_invitation',
        invitationTokenHash: hashSessionToken(rawToken),
        invitationExpiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      });

      vi.spyOn(CompanyRecruiterModel, 'findOne').mockResolvedValue(pendingRecruiter as never);
      vi.spyOn(UserModel, 'findOne').mockResolvedValue(null); // user does NOT exist

      const newUserId = new mongoose.Types.ObjectId();
      vi.spyOn(UserModel, 'create').mockResolvedValue({
        _id: newUserId,
        email: 'jane.doe@acme.example.com',
        fullName: 'Jane Doe',
        status: 'active',
      } as never);

      const activeRecruiter = mockRecruiterDoc({
        status: 'active',
        userId: newUserId,
        acceptedAt: new Date(),
        invitationTokenHash: null,
        invitationExpiresAt: null,
      });
      vi.spyOn(CompanyRecruiterModel, 'findOneAndUpdate').mockResolvedValue(
        activeRecruiter as never
      );

      const res = await request(app).post('/api/v1/recruiters/accept-invitation').send({
        token: rawToken,
        password: 'securePassword123!',
      });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('active');
      expect(UserModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'jane.doe@acme.example.com',
          status: 'active',
          passwordHash: expect.stringMatching(/^\$argon2id\$/),
        })
      );

      // Verify token is atomically cleared
      expect(CompanyRecruiterModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          invitationTokenHash: hashSessionToken(rawToken),
          status: 'pending_invitation',
        }),
        expect.objectContaining({
          $set: expect.objectContaining({ status: 'active', userId: newUserId }),
          $unset: expect.objectContaining({ invitationTokenHash: 1 }),
        }),
        expect.any(Object)
      );

      expect(AuditLogModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'recruiter_invitation_accepted',
          details: expect.objectContaining({ isExistingUser: false }),
        })
      );
    });

    it('requires password for new user account provisioning', async () => {
      const pendingRecruiter = mockRecruiterDoc({
        invitationTokenHash: hashSessionToken(rawToken),
      });
      vi.spyOn(CompanyRecruiterModel, 'findOne').mockResolvedValue(pendingRecruiter as never);
      vi.spyOn(UserModel, 'findOne').mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/recruiters/accept-invitation')
        .send({ token: rawToken });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('PASSWORD_REQUIRED');
    });
  });

  // ─── 5. Invitation Acceptance - Existing User Flow ────────────────────────

  describe('Invitation Acceptance: Existing User', () => {
    const rawToken = 'existing-user-valid-token-32-chars';
    const existingUserId = new mongoose.Types.ObjectId();
    const existingEmail = 'jane.doe@acme.example.com';

    it('rejects acceptance without authentication when user already exists', async () => {
      const pendingRecruiter = mockRecruiterDoc({
        email: existingEmail,
        invitationTokenHash: hashSessionToken(rawToken),
      });
      vi.spyOn(CompanyRecruiterModel, 'findOne').mockResolvedValue(pendingRecruiter as never);
      vi.spyOn(UserModel, 'findOne').mockResolvedValue({
        _id: existingUserId,
        email: existingEmail,
      } as never);

      const res = await request(app)
        .post('/api/v1/recruiters/accept-invitation')
        .send({ token: rawToken });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    });

    it('rejects acceptance when authenticated email does not match invitation email', async () => {
      const pendingRecruiter = mockRecruiterDoc({
        email: existingEmail,
        invitationTokenHash: hashSessionToken(rawToken),
      });
      vi.spyOn(CompanyRecruiterModel, 'findOne').mockResolvedValue(pendingRecruiter as never);
      vi.spyOn(UserModel, 'findOne').mockResolvedValue({
        _id: existingUserId,
        email: existingEmail,
      } as never);

      // User logged in with different email
      mockSession('student', collegeAOrgId, new mongoose.Types.ObjectId(), 'other@college.edu');

      const res = await request(app)
        .post('/api/v1/recruiters/accept-invitation')
        .set('Cookie', [`session=${rawSessionToken}`])
        .send({ token: rawToken });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('EMAIL_MISMATCH');
    });

    it('links existing user without altering password, name, status, or memberships', async () => {
      const pendingRecruiter = mockRecruiterDoc({
        email: existingEmail,
        invitationTokenHash: hashSessionToken(rawToken),
      });
      vi.spyOn(CompanyRecruiterModel, 'findOne').mockResolvedValue(pendingRecruiter as never);

      const existingUserDoc = {
        _id: existingUserId,
        email: existingEmail,
        fullName: 'Jane Doe Senior',
        status: 'active',
        passwordHash: '$argon2id$existingHashSecret',
        memberships: [{ orgId: collegeAOrgId, role: 'student' }],
        save: vi.fn(),
      };
      vi.spyOn(UserModel, 'findOne').mockResolvedValue(existingUserDoc as never);
      const userCreateSpy = vi.spyOn(UserModel, 'create');

      // Authenticated with matching account
      mockSession('student', collegeAOrgId, existingUserId, existingEmail);

      const activeRecruiter = mockRecruiterDoc({
        status: 'active',
        userId: existingUserId,
      });
      vi.spyOn(CompanyRecruiterModel, 'findOneAndUpdate').mockResolvedValue(
        activeRecruiter as never
      );

      const res = await request(app)
        .post('/api/v1/recruiters/accept-invitation')
        .set('Cookie', [`session=${rawSessionToken}`])
        .send({ token: rawToken });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('active');

      // Crucial assertion: UserModel.create is NEVER called, and existing user save is not modified
      expect(userCreateSpy).not.toHaveBeenCalled();
      expect(existingUserDoc.save).not.toHaveBeenCalled();
      expect(existingUserDoc.passwordHash).toBe('$argon2id$existingHashSecret');
      expect(existingUserDoc.fullName).toBe('Jane Doe Senior');
      expect(existingUserDoc.memberships).toHaveLength(1);

      expect(AuditLogModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'recruiter_invitation_accepted',
          details: expect.objectContaining({ isExistingUser: true }),
        })
      );
    });
  });

  // ─── 6. Expiry, Revocation, and Single-Use Enforcement ────────────────────

  describe('Expiry, Revocation & Replay Protection', () => {
    const rawToken = 'token-lifecycle-test-123456789012';

    it('rejects expired invitation token with 400 INVITATION_EXPIRED', async () => {
      const expiredRecruiter = mockRecruiterDoc({
        invitationTokenHash: hashSessionToken(rawToken),
        invitationExpiresAt: new Date(Date.now() - 1000), // expired 1s ago
      });
      vi.spyOn(CompanyRecruiterModel, 'findOne').mockResolvedValue(expiredRecruiter as never);

      const res = await request(app)
        .post('/api/v1/recruiters/accept-invitation')
        .send({ token: rawToken, password: 'password123!' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVITATION_EXPIRED');
    });

    it('rejects revoked invitation with 400 INVITATION_REVOKED', async () => {
      const revokedRecruiter = mockRecruiterDoc({
        status: 'inactive',
        invitationTokenHash: hashSessionToken(rawToken),
      });
      vi.spyOn(CompanyRecruiterModel, 'findOne').mockResolvedValue(revokedRecruiter as never);

      const res = await request(app)
        .post('/api/v1/recruiters/accept-invitation')
        .send({ token: rawToken, password: 'password123!' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVITATION_REVOKED');
    });

    it('rejects already accepted invitation with 400 INVITATION_ALREADY_ACCEPTED', async () => {
      const acceptedRecruiter = mockRecruiterDoc({
        status: 'active',
        invitationTokenHash: hashSessionToken(rawToken),
      });
      vi.spyOn(CompanyRecruiterModel, 'findOne').mockResolvedValue(acceptedRecruiter as never);

      const res = await request(app)
        .post('/api/v1/recruiters/accept-invitation')
        .send({ token: rawToken, password: 'password123!' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVITATION_ALREADY_ACCEPTED');
    });
  });

  // ─── 7. Concurrent Acceptance & Atomic Race Safety ────────────────────────

  describe('Concurrency & Race Condition Handling', () => {
    const rawToken = 'concurrency-race-token-1234567890';

    it('prevents double acceptance when two requests arrive simultaneously', async () => {
      const pendingRecruiter = mockRecruiterDoc({
        status: 'pending_invitation',
        invitationTokenHash: hashSessionToken(rawToken),
      });
      vi.spyOn(CompanyRecruiterModel, 'findOne').mockResolvedValue(pendingRecruiter as never);
      vi.spyOn(UserModel, 'findOne').mockResolvedValue(null);
      vi.spyOn(UserModel, 'create').mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
      } as never);

      // Simulate findOneAndUpdate returning null because another concurrent request consumed it first
      vi.spyOn(CompanyRecruiterModel, 'findOneAndUpdate').mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/recruiters/accept-invitation')
        .send({ token: rawToken, password: 'password123!' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_OR_EXPIRED_TOKEN');
    });
  });

  // ─── 8. Recruiter Listing & Search ────────────────────────────────────────

  describe('Recruiter Directory Listing', () => {
    it('allows college officer to list recruiters for registered company', async () => {
      mockSession('tpo', collegeAOrgId);

      vi.spyOn(CollegeCompanyProfileModel, 'findOne').mockResolvedValue({
        status: 'verified',
      } as never);
      vi.spyOn(CompanyRecruiterModel, 'countDocuments').mockResolvedValue(2);
      vi.spyOn(CompanyRecruiterModel, 'find').mockReturnValue({
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi
          .fn()
          .mockResolvedValue([
            mockRecruiterDoc({ name: 'Alice', role: 'company_admin' }),
            mockRecruiterDoc({ name: 'Bob', role: 'company_recruiter' }),
          ]),
      } as never);

      const res = await request(app)
        .get(`/api/v1/companies/${companyId.toString()}/recruiters?page=1&limit=20`)
        .set('Cookie', [`session=${rawSessionToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(2);
      expect(res.body.data.total).toBe(2);
    });

    it('rejects college officer if company is not in college directory', async () => {
      mockSession('tpo', collegeAOrgId);
      vi.spyOn(CollegeCompanyProfileModel, 'findOne').mockResolvedValue(null);

      const res = await request(app)
        .get(`/api/v1/companies/${companyId.toString()}/recruiters`)
        .set('Cookie', [`session=${rawSessionToken}`]);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('COMPANY_NOT_FOUND');
    });

    it('allows company user to view recruiters for their own company', async () => {
      const recruiterUserId = new mongoose.Types.ObjectId();
      mockSession('company_recruiter', null, recruiterUserId);

      vi.spyOn(CompanyRecruiterModel, 'findOne').mockResolvedValue({
        companyId,
        userId: recruiterUserId,
        status: 'active',
      } as never);

      vi.spyOn(CompanyRecruiterModel, 'countDocuments').mockResolvedValue(1);
      vi.spyOn(CompanyRecruiterModel, 'find').mockReturnValue({
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockRecruiterDoc()]),
      } as never);

      const res = await request(app)
        .get(`/api/v1/companies/${companyId.toString()}/recruiters`)
        .set('Cookie', [`session=${rawSessionToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(1);
    });
  });

  // ─── 9. Lifecycle Operations: Resend, Revoke, Deactivate ───────────────────

  describe('Lifecycle: Resend, Revoke, Deactivate', () => {
    const recruiterId = new mongoose.Types.ObjectId();

    it('resends invitation with refreshed token and expiration', async () => {
      mockSession('tpo', collegeAOrgId);
      vi.spyOn(CollegeCompanyProfileModel, 'findOne').mockResolvedValue({
        status: 'verified',
      } as never);

      const pendingRecruiter = mockRecruiterDoc({ _id: recruiterId, status: 'pending_invitation' });
      vi.spyOn(CompanyRecruiterModel, 'findOne').mockResolvedValue(pendingRecruiter as never);

      const res = await request(app)
        .post(
          `/api/v1/companies/${companyId.toString()}/recruiters/${recruiterId.toString()}/resend`
        )
        .set('Cookie', [`session=${rawSessionToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.data.invitationToken).toBeDefined();
      expect(pendingRecruiter.save).toHaveBeenCalled();
      expect(AuditLogModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'recruiter_invitation_reissued' })
      );
    });

    it('rejects resend for an already active recruiter', async () => {
      mockSession('tpo', collegeAOrgId);
      vi.spyOn(CollegeCompanyProfileModel, 'findOne').mockResolvedValue({
        status: 'verified',
      } as never);

      const activeRecruiter = mockRecruiterDoc({ _id: recruiterId, status: 'active' });
      vi.spyOn(CompanyRecruiterModel, 'findOne').mockResolvedValue(activeRecruiter as never);

      const res = await request(app)
        .post(
          `/api/v1/companies/${companyId.toString()}/recruiters/${recruiterId.toString()}/resend`
        )
        .set('Cookie', [`session=${rawSessionToken}`]);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('RECRUITER_ALREADY_ACTIVE');
    });

    it('revokes a pending invitation', async () => {
      mockSession('tpo', collegeAOrgId);
      vi.spyOn(CollegeCompanyProfileModel, 'findOne').mockResolvedValue({
        status: 'verified',
      } as never);

      const pendingRecruiter = mockRecruiterDoc({ _id: recruiterId, status: 'pending_invitation' });
      vi.spyOn(CompanyRecruiterModel, 'findOne').mockResolvedValue(pendingRecruiter as never);

      const res = await request(app)
        .post(
          `/api/v1/companies/${companyId.toString()}/recruiters/${recruiterId.toString()}/revoke`
        )
        .set('Cookie', [`session=${rawSessionToken}`]);

      expect(res.status).toBe(200);
      expect(pendingRecruiter.status).toBe('inactive');
      expect(pendingRecruiter.invitationTokenHash).toBeNull();
      expect(pendingRecruiter.save).toHaveBeenCalled();
      expect(AuditLogModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'recruiter_invitation_revoked' })
      );
    });

    it('deactivates an active recruiter', async () => {
      mockSession('tpo', collegeAOrgId);
      vi.spyOn(CollegeCompanyProfileModel, 'findOne').mockResolvedValue({
        status: 'verified',
      } as never);

      const activeRecruiter = mockRecruiterDoc({ _id: recruiterId, status: 'active' });
      vi.spyOn(CompanyRecruiterModel, 'findOne').mockResolvedValue(activeRecruiter as never);

      const res = await request(app)
        .post(
          `/api/v1/companies/${companyId.toString()}/recruiters/${recruiterId.toString()}/deactivate`
        )
        .set('Cookie', [`session=${rawSessionToken}`]);

      expect(res.status).toBe(200);
      expect(activeRecruiter.status).toBe('inactive');
      expect(activeRecruiter.save).toHaveBeenCalled();
      expect(AuditLogModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'recruiter_deactivated' })
      );
    });

    it('rejects deactivating an already inactive recruiter with NO_STATE_CHANGE', async () => {
      mockSession('tpo', collegeAOrgId);
      vi.spyOn(CollegeCompanyProfileModel, 'findOne').mockResolvedValue({
        status: 'verified',
      } as never);

      const inactiveRecruiter = mockRecruiterDoc({ _id: recruiterId, status: 'inactive' });
      vi.spyOn(CompanyRecruiterModel, 'findOne').mockResolvedValue(inactiveRecruiter as never);

      const res = await request(app)
        .post(
          `/api/v1/companies/${companyId.toString()}/recruiters/${recruiterId.toString()}/deactivate`
        )
        .set('Cookie', [`session=${rawSessionToken}`]);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('NO_STATE_CHANGE');
    });
  });
});
