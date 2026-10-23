import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../app.js';
import { CompanyModel } from '../models/company.model.js';
import { CollegeCompanyProfileModel } from '../models/college-company-profile.model.js';
import { AuditLogModel } from '../models/audit-log.model.js';
import { SessionModel } from '../models/session.model.js';
import { UserModel } from '../models/user.model.js';
import { OrganizationModel } from '../models/organization.model.js';
import { hashSessionToken } from '../utils/password.js';
import type { UserRole } from '@placement-platform/contracts';

const app = createApp();

describe('Company Management Backend (Phase 6, Step 2)', () => {
  const collegeAOrgId = new mongoose.Types.ObjectId();
  const collegeBOrgId = new mongoose.Types.ObjectId();
  const tpoUserId = new mongoose.Types.ObjectId();
  const coordinatorUserId = new mongoose.Types.ObjectId();
  const rawSessionToken = 'test-company-session-token-xyz';

  function mockSession(
    role: UserRole,
    orgId: mongoose.Types.ObjectId,
    userId: mongoose.Types.ObjectId = tpoUserId
  ) {
    vi.spyOn(SessionModel, 'findOne').mockResolvedValue({
      _id: new mongoose.Types.ObjectId(),
      tokenHash: hashSessionToken(rawSessionToken),
      userId,
      orgId,
      role,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    } as never);

    vi.spyOn(UserModel, 'findById').mockResolvedValue({
      _id: userId,
      email: `${role}@college.edu`,
      fullName: `Test ${role}`,
      status: 'active',
      memberships: [
        {
          orgId,
          role,
        },
      ],
    } as never);

    vi.spyOn(OrganizationModel, 'findById').mockResolvedValue({
      _id: orgId,
      name: 'Test College',
      slug: 'test-college',
      status: 'active',
    } as never);
  }

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(AuditLogModel, 'create').mockResolvedValue({} as never);
  });

  const baseCompanyInput = {
    name: 'Acme Corporation',
    legalName: 'Acme Tech Pvt Ltd',
    website: 'https://acme.example.com',
    industry: 'Software Engineering',
    description: 'Enterprise automation and cloud tools.',
    tier: 'tier_1' as const,
    location: {
      city: 'Bengaluru',
      state: 'Karnataka',
      country: 'India',
      addressLine: 'Phase 1, Electronic City',
    },
    primaryContact: {
      name: 'Rohan Sharma',
      email: 'rohan.sharma@acme.example.com',
      phone: '+91 9876543210',
      designation: 'Campus Lead',
    },
    notes: 'Key partner for 2026.',
  };

  function mockGlobalCompany(overrides: Record<string, unknown> = {}) {
    return {
      _id: new mongoose.Types.ObjectId(),
      name: 'Acme Corporation',
      legalName: 'Acme Tech Pvt Ltd',
      website: 'https://acme.example.com',
      industry: 'Software Engineering',
      description: 'Enterprise automation and cloud tools.',
      location: {
        city: 'Bengaluru',
        state: 'Karnataka',
        country: 'India',
        addressLine: 'Phase 1, Electronic City',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      save: vi.fn().mockResolvedValue(true),
      ...overrides,
    };
  }

  function mockCollegeProfile(
    globalCompany: Record<string, unknown>,
    overrides: Record<string, unknown> = {}
  ) {
    return {
      _id: new mongoose.Types.ObjectId(),
      orgId: collegeAOrgId,
      companyId: globalCompany,
      status: 'pending_verification',
      tier: 'tier_1',
      verificationDetails: null as {
        verifiedBy?: mongoose.Types.ObjectId | null;
        verifiedAt?: Date | null;
        remarks?: string | null;
      } | null,
      primaryContact: {
        name: 'Rohan Sharma',
        email: 'rohan.sharma@acme.example.com',
        phone: '+91 9876543210',
        designation: 'Campus Lead',
      },
      notes: 'Key partner for 2026.',
      createdAt: new Date(),
      updatedAt: new Date(),
      save: vi.fn().mockResolvedValue(true),
      ...overrides,
    };
  }

  // ─── 1. Authentication & Role Authorization ───────────────────────────────

  describe('Authentication & Role Guards', () => {
    it('returns 401 UNAUTHENTICATED when accessing endpoints without session', async () => {
      const resPost = await request(app).post('/api/v1/companies').send(baseCompanyInput);
      expect(resPost.status).toBe(401);
      expect(resPost.body.error.code).toBe('UNAUTHENTICATED');

      const resGet = await request(app).get('/api/v1/companies');
      expect(resGet.status).toBe(401);

      const resGetOne = await request(app).get(
        `/api/v1/companies/${new mongoose.Types.ObjectId().toString()}`
      );
      expect(resGetOne.status).toBe(401);

      const resPut = await request(app)
        .put(`/api/v1/companies/${new mongoose.Types.ObjectId().toString()}`)
        .send({ name: 'Acme' });
      expect(resPut.status).toBe(401);

      const resVerify = await request(app)
        .patch(`/api/v1/companies/${new mongoose.Types.ObjectId().toString()}/verify`)
        .send({ status: 'verified' });
      expect(resVerify.status).toBe(401);

      const resTier = await request(app)
        .patch(`/api/v1/companies/${new mongoose.Types.ObjectId().toString()}/tier`)
        .send({ tier: 'tier_1' });
      expect(resTier.status).toBe(401);
    });

    it('rejects student role with 403 FORBIDDEN on all company endpoints', async () => {
      mockSession('student', collegeAOrgId);

      const resPost = await request(app)
        .post('/api/v1/companies')
        .set('Cookie', [`session=${rawSessionToken}`])
        .send(baseCompanyInput);
      expect(resPost.status).toBe(403);
      expect(resPost.body.error.code).toBe('FORBIDDEN');

      const resGet = await request(app)
        .get('/api/v1/companies')
        .set('Cookie', [`session=${rawSessionToken}`]);
      expect(resGet.status).toBe(403);
    });

    it('rejects company_recruiter and interviewer with 403 FORBIDDEN', async () => {
      mockSession('company_recruiter', collegeAOrgId);

      const resRecruiter = await request(app)
        .get('/api/v1/companies')
        .set('Cookie', [`session=${rawSessionToken}`]);
      expect(resRecruiter.status).toBe(403);

      mockSession('interviewer', collegeAOrgId);
      const resInterviewer = await request(app)
        .get('/api/v1/companies')
        .set('Cookie', [`session=${rawSessionToken}`]);
      expect(resInterviewer.status).toBe(403);
    });

    it('rejects dept_coordinator from mutation endpoints but allows reads', async () => {
      mockSession('dept_coordinator', collegeAOrgId, coordinatorUserId);

      // Dept coordinator cannot create
      const resPost = await request(app)
        .post('/api/v1/companies')
        .set('Cookie', [`session=${rawSessionToken}`])
        .send(baseCompanyInput);
      expect(resPost.status).toBe(403);

      // Dept coordinator cannot update
      const resPut = await request(app)
        .put(`/api/v1/companies/${new mongoose.Types.ObjectId().toString()}`)
        .set('Cookie', [`session=${rawSessionToken}`])
        .send({ name: 'Updated' });
      expect(resPut.status).toBe(403);

      // Dept coordinator cannot verify
      const resVerify = await request(app)
        .patch(`/api/v1/companies/${new mongoose.Types.ObjectId().toString()}/verify`)
        .set('Cookie', [`session=${rawSessionToken}`])
        .send({ status: 'verified' });
      expect(resVerify.status).toBe(403);

      // Dept coordinator cannot change tier
      const resTier = await request(app)
        .patch(`/api/v1/companies/${new mongoose.Types.ObjectId().toString()}/tier`)
        .set('Cookie', [`session=${rawSessionToken}`])
        .send({ tier: 'tier_1' });
      expect(resTier.status).toBe(403);
    });
  });

  // ─── 2. Company Creation & Multi-College Association ──────────────────────

  describe('Company Creation (POST /api/v1/companies)', () => {
    it('creates global company and college profile when company is new', async () => {
      mockSession('tpo', collegeAOrgId);
      const globalComp = mockGlobalCompany();
      const collegeProf = mockCollegeProfile(globalComp);

      vi.spyOn(CompanyModel, 'findOne').mockResolvedValue(null);
      vi.spyOn(CompanyModel, 'create').mockResolvedValue(globalComp as never);
      vi.spyOn(CollegeCompanyProfileModel, 'findOne').mockResolvedValue(null);
      vi.spyOn(CollegeCompanyProfileModel, 'create').mockResolvedValue(collegeProf as never);

      const auditSpy = vi.spyOn(AuditLogModel, 'create').mockResolvedValue({} as never);

      const res = await request(app)
        .post('/api/v1/companies')
        .set('Cookie', [`session=${rawSessionToken}`])
        .send(baseCompanyInput);

      expect(res.status).toBe(201);
      expect(res.body.data.company.name).toBe('Acme Corporation');
      expect(res.body.data.company.website).toBe('https://acme.example.com');
      expect(res.body.data.status).toBe('pending_verification');
      expect(res.body.data.tier).toBe('tier_1');

      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'company_created',
          orgId: collegeAOrgId,
          userId: tpoUserId,
        })
      );
    });

    it('reuses existing global company identity when registering for another college', async () => {
      mockSession('tpo', collegeBOrgId); // College B registering existing company
      const existingGlobalComp = mockGlobalCompany();
      const collegeBProf = mockCollegeProfile(existingGlobalComp, {
        orgId: collegeBOrgId,
        tier: 'tier_2',
      });

      // Global company already exists
      vi.spyOn(CompanyModel, 'findOne').mockResolvedValue(existingGlobalComp as never);
      const globalCreateSpy = vi.spyOn(CompanyModel, 'create');

      // College B does not have it yet
      vi.spyOn(CollegeCompanyProfileModel, 'findOne').mockResolvedValue(null);
      vi.spyOn(CollegeCompanyProfileModel, 'create').mockResolvedValue(collegeBProf as never);

      const res = await request(app)
        .post('/api/v1/companies')
        .set('Cookie', [`session=${rawSessionToken}`])
        .send({
          ...baseCompanyInput,
          tier: 'tier_2',
        });

      expect(res.status).toBe(201);
      expect(globalCreateSpy).not.toHaveBeenCalled();
      expect(res.body.data.orgId).toBe(collegeBOrgId.toString());
      expect(res.body.data.tier).toBe('tier_2');
    });

    it('rejects duplicate company registration in the same college with 409 DUPLICATE_RESOURCE', async () => {
      mockSession('tpo', collegeAOrgId);
      const existingGlobalComp = mockGlobalCompany();
      const existingCollegeProf = mockCollegeProfile(existingGlobalComp);

      vi.spyOn(CompanyModel, 'findOne').mockResolvedValue(existingGlobalComp as never);
      vi.spyOn(CollegeCompanyProfileModel, 'findOne').mockResolvedValue(
        existingCollegeProf as never
      );

      const res = await request(app)
        .post('/api/v1/companies')
        .set('Cookie', [`session=${rawSessionToken}`])
        .send(baseCompanyInput);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('DUPLICATE_RESOURCE');
    });

    it('ignores client-supplied orgId and self-assigned status/verification', async () => {
      mockSession('tpo', collegeAOrgId);
      const globalComp = mockGlobalCompany();
      const collegeProf = mockCollegeProfile(globalComp);

      vi.spyOn(CompanyModel, 'findOne').mockResolvedValue(null);
      vi.spyOn(CompanyModel, 'create').mockResolvedValue(globalComp as never);
      vi.spyOn(CollegeCompanyProfileModel, 'findOne').mockResolvedValue(null);
      const profileCreateSpy = vi
        .spyOn(CollegeCompanyProfileModel, 'create')
        .mockResolvedValue(collegeProf as never);

      const res = await request(app)
        .post('/api/v1/companies')
        .set('Cookie', [`session=${rawSessionToken}`])
        .send({
          ...baseCompanyInput,
          orgId: 'attacker-org-id',
          status: 'verified',
          verificationDetails: { verifiedBy: 'attacker' },
        });

      expect(res.status).toBe(201);
      expect(profileCreateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: collegeAOrgId,
          status: 'pending_verification', // Server-enforced initial status
        })
      );
    });

    it('rejects invalid website URLs (e.g. ftp protocol or missing domain)', async () => {
      mockSession('tpo', collegeAOrgId);

      const resFtp = await request(app)
        .post('/api/v1/companies')
        .set('Cookie', [`session=${rawSessionToken}`])
        .send({ ...baseCompanyInput, website: 'ftp://acme.org' });
      expect(resFtp.status).toBe(400);

      const resInvalid = await request(app)
        .post('/api/v1/companies')
        .set('Cookie', [`session=${rawSessionToken}`])
        .send({ ...baseCompanyInput, website: 'not-a-url' });
      expect(resInvalid.status).toBe(400);
    });

    it('creates global company with normalized website (strips trailing slash, query params, and default ports)', async () => {
      mockSession('tpo', collegeAOrgId);
      const globalComp = mockGlobalCompany({
        website: 'https://acme.example.com',
      });
      const collegeProf = mockCollegeProfile(globalComp);

      vi.spyOn(CompanyModel, 'findOne').mockResolvedValue(null);
      const createSpy = vi.spyOn(CompanyModel, 'create').mockResolvedValue(globalComp as never);
      vi.spyOn(CollegeCompanyProfileModel, 'findOne').mockResolvedValue(null);
      vi.spyOn(CollegeCompanyProfileModel, 'create').mockResolvedValue(collegeProf as never);

      const res = await request(app)
        .post('/api/v1/companies')
        .set('Cookie', [`session=${rawSessionToken}`])
        .send({
          ...baseCompanyInput,
          website: 'HTTPS://ACME.EXAMPLE.COM:443/?utm_source=campus_drive#team',
        });

      expect(res.status).toBe(201);
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          website: 'https://acme.example.com',
        })
      );
    });

    it('allows registering a company without a website', async () => {
      mockSession('tpo', collegeAOrgId);
      const globalCompNoWeb = mockGlobalCompany({ website: null });
      const collegeProf = mockCollegeProfile(globalCompNoWeb);

      const createSpy = vi
        .spyOn(CompanyModel, 'create')
        .mockResolvedValue(globalCompNoWeb as never);
      vi.spyOn(CollegeCompanyProfileModel, 'findOne').mockResolvedValue(null);
      vi.spyOn(CollegeCompanyProfileModel, 'create').mockResolvedValue(collegeProf as never);

      const { website: _, ...inputWithoutWebsite } = baseCompanyInput;
      const res = await request(app)
        .post('/api/v1/companies')
        .set('Cookie', [`session=${rawSessionToken}`])
        .send(inputWithoutWebsite);

      expect(res.status).toBe(201);
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          website: null,
        })
      );
    });

    it('returns 409 COMPANY_DATA_CONFLICT when existing company has conflicting details', async () => {
      mockSession('tpo', collegeAOrgId);
      const existingGlobalComp = mockGlobalCompany({
        name: 'Acme Corporation',
        industry: 'Software Engineering',
        website: 'https://acme.example.com',
      });

      vi.spyOn(CompanyModel, 'findOne').mockResolvedValue(existingGlobalComp as never);

      // Attempting to register the same website with a conflicting name
      const resConflictName = await request(app)
        .post('/api/v1/companies')
        .set('Cookie', [`session=${rawSessionToken}`])
        .send({
          ...baseCompanyInput,
          name: 'Completely Different Name Ltd',
        });

      expect(resConflictName.status).toBe(409);
      expect(resConflictName.body.error.code).toBe('COMPANY_DATA_CONFLICT');
      expect(resConflictName.body.error.message).toMatch(/conflict/i);

      // Attempting to register with conflicting industry
      const resConflictIndustry = await request(app)
        .post('/api/v1/companies')
        .set('Cookie', [`session=${rawSessionToken}`])
        .send({
          ...baseCompanyInput,
          industry: 'Civil Construction',
        });

      expect(resConflictIndustry.status).toBe(409);
      expect(resConflictIndustry.body.error.code).toBe('COMPANY_DATA_CONFLICT');
    });

    it('handles concurrent college association race condition by returning 409 DUPLICATE_RESOURCE', async () => {
      mockSession('tpo', collegeAOrgId);
      const existingGlobalComp = mockGlobalCompany();

      vi.spyOn(CompanyModel, 'findOne').mockResolvedValue(existingGlobalComp as never);
      vi.spyOn(CollegeCompanyProfileModel, 'findOne').mockResolvedValue(null); // Passed find check

      // But concurrent insert triggered MongoDB duplicate key error 11000
      const mongoDupError = new Error('E11000 duplicate key error') as Error & { code: number };
      mongoDupError.code = 11000;
      vi.spyOn(CollegeCompanyProfileModel, 'create').mockRejectedValue(mongoDupError);

      const res = await request(app)
        .post('/api/v1/companies')
        .set('Cookie', [`session=${rawSessionToken}`])
        .send(baseCompanyInput);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('DUPLICATE_RESOURCE');
    });

    it('recovers safely from concurrent global company creation race condition', async () => {
      mockSession('tpo', collegeAOrgId);
      const existingGlobalComp = mockGlobalCompany();
      const collegeProf = mockCollegeProfile(existingGlobalComp);

      // findOne returns null initially
      let findCount = 0;
      vi.spyOn(CompanyModel, 'findOne').mockImplementation((() => {
        findCount++;
        if (findCount === 1) return Promise.resolve(null);
        return Promise.resolve(existingGlobalComp);
      }) as never);

      // create fails with E11000 because another worker created it
      const mongoDupError = new Error('E11000 duplicate key error') as Error & { code: number };
      mongoDupError.code = 11000;
      vi.spyOn(CompanyModel, 'create').mockRejectedValue(mongoDupError);

      vi.spyOn(CollegeCompanyProfileModel, 'findOne').mockResolvedValue(null);
      vi.spyOn(CollegeCompanyProfileModel, 'create').mockResolvedValue(collegeProf as never);

      const res = await request(app)
        .post('/api/v1/companies')
        .set('Cookie', [`session=${rawSessionToken}`])
        .send(baseCompanyInput);

      expect(res.status).toBe(201);
      expect(res.body.data.company.name).toBe('Acme Corporation');
    });
  });

  // ─── 3. Listing, Searching & Filtering ────────────────────────────────────

  describe('Listing & Filtering (GET /api/v1/companies)', () => {
    it('returns paginated list with populated global company data', async () => {
      mockSession('tpo', collegeAOrgId);
      const globalComp = mockGlobalCompany();
      const collegeProf = mockCollegeProfile(globalComp);

      vi.spyOn(CollegeCompanyProfileModel, 'countDocuments').mockResolvedValue(1);
      vi.spyOn(CollegeCompanyProfileModel, 'find').mockReturnValue({
        sort: vi.fn().mockReturnValue({
          skip: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              populate: vi.fn().mockResolvedValue([collegeProf]),
            }),
          }),
        }),
      } as never);

      const res = await request(app)
        .get('/api/v1/companies?page=1&limit=20')
        .set('Cookie', [`session=${rawSessionToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(1);
      expect(res.body.data.page).toBe(1);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].company.name).toBe('Acme Corporation');
    });

    it('filters by status and tier', async () => {
      mockSession('tpo', collegeAOrgId);
      const countSpy = vi.spyOn(CollegeCompanyProfileModel, 'countDocuments').mockResolvedValue(0);
      const findSpy = vi.spyOn(CollegeCompanyProfileModel, 'find').mockReturnValue({
        sort: vi.fn().mockReturnValue({
          skip: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              populate: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      } as never);

      const res = await request(app)
        .get('/api/v1/companies?status=verified&tier=tier_1')
        .set('Cookie', [`session=${rawSessionToken}`]);

      expect(res.status).toBe(200);
      expect(countSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: collegeAOrgId,
          status: 'verified',
          tier: 'tier_1',
        })
      );
      expect(findSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: collegeAOrgId,
          status: 'verified',
          tier: 'tier_1',
        })
      );
    });

    it('searches by company name via global company lookup', async () => {
      mockSession('tpo', collegeAOrgId);
      const matchingGlobalId = new mongoose.Types.ObjectId();

      vi.spyOn(CompanyModel, 'find').mockReturnValue({
        select: vi.fn().mockResolvedValue([{ _id: matchingGlobalId }]),
      } as never);

      const findSpy = vi.spyOn(CollegeCompanyProfileModel, 'find').mockReturnValue({
        sort: vi.fn().mockReturnValue({
          skip: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              populate: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      } as never);
      vi.spyOn(CollegeCompanyProfileModel, 'countDocuments').mockResolvedValue(0);

      const res = await request(app)
        .get('/api/v1/companies?search=Acme')
        .set('Cookie', [`session=${rawSessionToken}`]);

      expect(res.status).toBe(200);
      expect(findSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: collegeAOrgId,
          companyId: { $in: [matchingGlobalId] },
        })
      );
    });

    it('rejects limit exceeding 100 with 400 validation error', async () => {
      mockSession('tpo', collegeAOrgId);

      const res = await request(app)
        .get('/api/v1/companies?limit=101')
        .set('Cookie', [`session=${rawSessionToken}`]);

      expect(res.status).toBe(400);
    });

    it('sorts by company name across full dataset using database aggregation pipeline', async () => {
      mockSession('tpo', collegeAOrgId);
      const globalCompA = mockGlobalCompany({ name: 'Alpha Tech' });
      const globalCompB = mockGlobalCompany({ name: 'Beta Systems' });
      const profileA = mockCollegeProfile(globalCompA);
      const profileB = mockCollegeProfile(globalCompB);

      vi.spyOn(CollegeCompanyProfileModel, 'countDocuments').mockResolvedValue(2);
      const aggregateSpy = vi.spyOn(CollegeCompanyProfileModel, 'aggregate').mockResolvedValue([
        { ...profileA, companyDoc: globalCompA },
        { ...profileB, companyDoc: globalCompB },
      ] as never);

      const res = await request(app)
        .get('/api/v1/companies?sortBy=name&sortOrder=asc&page=1&limit=20')
        .set('Cookie', [`session=${rawSessionToken}`]);

      expect(res.status).toBe(200);
      expect(aggregateSpy).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ $match: expect.objectContaining({ orgId: collegeAOrgId }) }),
          expect.objectContaining({
            $lookup: expect.objectContaining({
              from: 'companies',
              localField: 'companyId',
              foreignField: '_id',
            }),
          }),
          expect.objectContaining({ $unwind: '$companyDoc' }),
          expect.objectContaining({ $sort: expect.objectContaining({ 'companyDoc.name': 1 }) }),
          expect.objectContaining({ $skip: 0 }),
          expect.objectContaining({ $limit: 20 }),
        ])
      );
      expect(res.body.data.items[0].company.name).toBe('Alpha Tech');
      expect(res.body.data.items[1].company.name).toBe('Beta Systems');
    });
  });

  // ─── 4. Retrieval by ID ───────────────────────────────────────────────────

  describe('Retrieval (GET /api/v1/companies/:id)', () => {
    it('retrieves single profile by ID for authorized college officer', async () => {
      mockSession('tpo', collegeAOrgId);
      const globalComp = mockGlobalCompany();
      const collegeProf = mockCollegeProfile(globalComp);

      vi.spyOn(CollegeCompanyProfileModel, 'findOne').mockResolvedValue(collegeProf as never);
      vi.spyOn(CompanyModel, 'findById').mockResolvedValue(globalComp as never);

      const res = await request(app)
        .get(`/api/v1/companies/${collegeProf._id.toString()}`)
        .set('Cookie', [`session=${rawSessionToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(collegeProf._id.toString());
      expect(res.body.data.company.name).toBe('Acme Corporation');
    });

    it('returns 400 INVALID_ID for malformed ObjectId format', async () => {
      mockSession('tpo', collegeAOrgId);

      const res = await request(app)
        .get('/api/v1/companies/invalid-mongo-id')
        .set('Cookie', [`session=${rawSessionToken}`]);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_ID');
    });

    it('returns 404 COMPANY_NOT_FOUND when company does not exist in college directory', async () => {
      mockSession('tpo', collegeAOrgId);

      vi.spyOn(CollegeCompanyProfileModel, 'findOne').mockResolvedValue(null);

      const res = await request(app)
        .get(`/api/v1/companies/${new mongoose.Types.ObjectId().toString()}`)
        .set('Cookie', [`session=${rawSessionToken}`]);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('COMPANY_NOT_FOUND');
    });
  });

  // ─── 5. Permitted Updates & Global Company Ownership Isolation ────────────

  describe('Permitted Updates (PUT /api/v1/companies/:id)', () => {
    it('updates permitted college-specific fields (primaryContact, notes) without touching global company master', async () => {
      mockSession('tpo', collegeAOrgId);
      const globalComp = mockGlobalCompany();
      const collegeProf = mockCollegeProfile(globalComp);

      vi.spyOn(CollegeCompanyProfileModel, 'findOne').mockResolvedValue(collegeProf as never);
      vi.spyOn(CompanyModel, 'findById').mockResolvedValue(globalComp as never);
      const auditSpy = vi.spyOn(AuditLogModel, 'create').mockResolvedValue({} as never);

      const res = await request(app)
        .put(`/api/v1/companies/${collegeProf._id.toString()}`)
        .set('Cookie', [`session=${rawSessionToken}`])
        .send({
          notes: 'Updated contact notes for 2026',
          primaryContact: {
            name: 'Vikram Mehta',
            email: 'vikram@acme.example.com',
            phone: '+91 9988776655',
            designation: 'VP University Relations',
          },
        });

      expect(res.status).toBe(200);
      // College-specific fields were updated
      expect(collegeProf.notes).toBe('Updated contact notes for 2026');
      expect(collegeProf.primaryContact?.name).toBe('Vikram Mehta');

      // Shared global company identity MUST remain untouched
      expect(globalComp.name).toBe('Acme Corporation');
      expect(globalComp.website).toBe('https://acme.example.com');
      expect(globalComp.save).not.toHaveBeenCalled();

      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'company_updated',
          orgId: collegeAOrgId,
          userId: tpoUserId,
        })
      );
    });

    it('rejects updates containing only global company fields (name, website, industry)', async () => {
      mockSession('tpo', collegeAOrgId);

      const res = await request(app)
        .put(`/api/v1/companies/${new mongoose.Types.ObjectId().toString()}`)
        .set('Cookie', [`session=${rawSessionToken}`])
        .send({
          name: 'Hacked Global Name',
          website: 'https://hacked.com',
          industry: 'Hacked Industry',
        });

      // Rejected because global fields are disallowed; body has no permitted fields
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('regression: update by College A does not alter global company data visible to College B', async () => {
      // 1. Shared global company
      const sharedGlobalComp = mockGlobalCompany({
        name: 'Shared Enterprise Inc',
        website: 'https://shared-enterprise.example.com',
        industry: 'Fintech',
      });

      // 2. College A updates its profile
      mockSession('tpo', collegeAOrgId);
      const collegeAProfile = mockCollegeProfile(sharedGlobalComp, {
        orgId: collegeAOrgId,
        notes: 'College A internal note',
      });

      vi.spyOn(CollegeCompanyProfileModel, 'findOne').mockResolvedValue(collegeAProfile as never);
      vi.spyOn(CompanyModel, 'findById').mockResolvedValue(sharedGlobalComp as never);

      const updateRes = await request(app)
        .put(`/api/v1/companies/${collegeAProfile._id.toString()}`)
        .set('Cookie', [`session=${rawSessionToken}`])
        .send({
          notes: 'Updated note by College A',
          primaryContact: {
            name: 'College A Contact',
            email: 'contactA@shared.example.com',
          },
        });

      expect(updateRes.status).toBe(200);
      expect(sharedGlobalComp.name).toBe('Shared Enterprise Inc');
      expect(sharedGlobalComp.save).not.toHaveBeenCalled();

      // 3. College B views the same company
      mockSession('tpo', collegeBOrgId);
      const collegeBProfile = mockCollegeProfile(sharedGlobalComp, {
        orgId: collegeBOrgId,
        notes: 'College B private note',
        primaryContact: {
          name: 'College B Contact',
          email: 'contactB@shared.example.com',
        },
      });

      vi.spyOn(CollegeCompanyProfileModel, 'findOne').mockResolvedValue(collegeBProfile as never);
      vi.spyOn(CompanyModel, 'findById').mockResolvedValue(sharedGlobalComp as never);

      const getResB = await request(app)
        .get(`/api/v1/companies/${collegeBProfile._id.toString()}`)
        .set('Cookie', [`session=${rawSessionToken}`]);

      expect(getResB.status).toBe(200);
      // Global details are untouched
      expect(getResB.body.data.company.name).toBe('Shared Enterprise Inc');
      expect(getResB.body.data.company.industry).toBe('Fintech');
      // College B's private notes and contact are isolated from College A's updates
      expect(getResB.body.data.notes).toBe('College B private note');
      expect(getResB.body.data.primaryContact.name).toBe('College B Contact');
    });

    it('rejects empty update payloads with 400', async () => {
      mockSession('tpo', collegeAOrgId);

      const res = await request(app)
        .put(`/api/v1/companies/${new mongoose.Types.ObjectId().toString()}`)
        .set('Cookie', [`session=${rawSessionToken}`])
        .send({});

      expect(res.status).toBe(400);
    });

    it('disallows modifying status or tier via ordinary update endpoint', async () => {
      mockSession('tpo', collegeAOrgId);
      const globalComp = mockGlobalCompany();
      const collegeProf = mockCollegeProfile(globalComp, {
        status: 'pending_verification',
        tier: 'tier_3',
      });

      vi.spyOn(CollegeCompanyProfileModel, 'findOne').mockResolvedValue(collegeProf as never);
      vi.spyOn(CompanyModel, 'findById').mockResolvedValue(globalComp as never);

      const res = await request(app)
        .put(`/api/v1/companies/${collegeProf._id.toString()}`)
        .set('Cookie', [`session=${rawSessionToken}`])
        .send({
          notes: 'Valid note update',
          status: 'verified', // Malicious privilege escalation attempt
          tier: 'tier_1',
        });

      expect(res.status).toBe(200);
      expect(collegeProf.status).toBe('pending_verification'); // Remained untouched!
      expect(collegeProf.tier).toBe('tier_3'); // Remained untouched!
    });
  });

  // ─── 6. Verification Status Updates & State Machine ───────────────────────

  describe('Verification (PATCH /api/v1/companies/:id/verify)', () => {
    it('updates verification status to verified and records audit log', async () => {
      mockSession('tpo', collegeAOrgId);
      const globalComp = mockGlobalCompany();
      const collegeProf = mockCollegeProfile(globalComp, { status: 'pending_verification' });

      vi.spyOn(CollegeCompanyProfileModel, 'findOne').mockResolvedValue(collegeProf as never);
      vi.spyOn(CompanyModel, 'findById').mockResolvedValue(globalComp as never);
      const auditSpy = vi.spyOn(AuditLogModel, 'create').mockResolvedValue({} as never);

      const res = await request(app)
        .patch(`/api/v1/companies/${collegeProf._id.toString()}/verify`)
        .set('Cookie', [`session=${rawSessionToken}`])
        .send({
          status: 'verified',
          remarks: 'Corporate documentation verified via MCA registry.',
        });

      expect(res.status).toBe(200);
      expect(collegeProf.status).toBe('verified');
      expect(collegeProf.verificationDetails?.verifiedBy).toEqual(tpoUserId);
      expect(collegeProf.verificationDetails?.remarks).toBe(
        'Corporate documentation verified via MCA registry.'
      );

      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'company_verified',
          orgId: collegeAOrgId,
          userId: tpoUserId,
          details: expect.objectContaining({
            previousStatus: 'pending_verification',
            newStatus: 'verified',
          }),
        })
      );
    });

    it('updates status to blacklisted with mandatory reason and records audit log', async () => {
      mockSession('college_admin', collegeAOrgId);
      const globalComp = mockGlobalCompany();
      const collegeProf = mockCollegeProfile(globalComp, { status: 'verified' });

      vi.spyOn(CollegeCompanyProfileModel, 'findOne').mockResolvedValue(collegeProf as never);
      vi.spyOn(CompanyModel, 'findById').mockResolvedValue(globalComp as never);
      const auditSpy = vi.spyOn(AuditLogModel, 'create').mockResolvedValue({} as never);

      const res = await request(app)
        .patch(`/api/v1/companies/${collegeProf._id.toString()}/verify`)
        .set('Cookie', [`session=${rawSessionToken}`])
        .send({
          status: 'blacklisted',
          remarks: 'Dishonored offer letters in 2025 placement season.',
        });

      expect(res.status).toBe(200);
      expect(collegeProf.status).toBe('blacklisted');
      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'company_verified',
          details: expect.objectContaining({
            previousStatus: 'verified',
            newStatus: 'blacklisted',
            remarks: 'Dishonored offer letters in 2025 placement season.',
          }),
        })
      );
    });

    it('rejects blacklisting when remarks are missing or shorter than 5 characters', async () => {
      mockSession('college_admin', collegeAOrgId);

      const resMissing = await request(app)
        .patch(`/api/v1/companies/${new mongoose.Types.ObjectId().toString()}/verify`)
        .set('Cookie', [`session=${rawSessionToken}`])
        .send({ status: 'blacklisted' });
      expect(resMissing.status).toBe(400);

      const resShort = await request(app)
        .patch(`/api/v1/companies/${new mongoose.Types.ObjectId().toString()}/verify`)
        .set('Cookie', [`session=${rawSessionToken}`])
        .send({ status: 'blacklisted', remarks: 'bad' });
      expect(resShort.status).toBe(400);
    });

    it('rejects disallowed status transitions (e.g. verified -> pending_verification, blacklisted -> verified)', async () => {
      mockSession('tpo', collegeAOrgId);
      const globalComp = mockGlobalCompany();

      // Case 1: verified -> pending_verification is disallowed
      const verifiedProf = mockCollegeProfile(globalComp, { status: 'verified' });
      vi.spyOn(CollegeCompanyProfileModel, 'findOne').mockResolvedValue(verifiedProf as never);
      vi.spyOn(CompanyModel, 'findById').mockResolvedValue(globalComp as never);

      const resDisallowed1 = await request(app)
        .patch(`/api/v1/companies/${verifiedProf._id.toString()}/verify`)
        .set('Cookie', [`session=${rawSessionToken}`])
        .send({ status: 'pending_verification' });

      expect(resDisallowed1.status).toBe(400);
      expect(resDisallowed1.body.error.code).toBe('INVALID_STATUS_TRANSITION');

      // Case 2: blacklisted -> verified directly is disallowed
      const blacklistedProf = mockCollegeProfile(globalComp, { status: 'blacklisted' });
      vi.spyOn(CollegeCompanyProfileModel, 'findOne').mockResolvedValue(blacklistedProf as never);

      const resDisallowed2 = await request(app)
        .patch(`/api/v1/companies/${blacklistedProf._id.toString()}/verify`)
        .set('Cookie', [`session=${rawSessionToken}`])
        .send({ status: 'verified' });

      expect(resDisallowed2.status).toBe(400);
      expect(resDisallowed2.body.error.code).toBe('INVALID_STATUS_TRANSITION');
    });

    it('rejects repeated identical status transitions with 400 NO_STATE_CHANGE without creating audit log', async () => {
      mockSession('tpo', collegeAOrgId);
      const globalComp = mockGlobalCompany();
      const verifiedProf = mockCollegeProfile(globalComp, { status: 'verified' });

      vi.spyOn(CollegeCompanyProfileModel, 'findOne').mockResolvedValue(verifiedProf as never);
      vi.spyOn(CompanyModel, 'findById').mockResolvedValue(globalComp as never);
      const auditSpy = vi.spyOn(AuditLogModel, 'create');

      const res = await request(app)
        .patch(`/api/v1/companies/${verifiedProf._id.toString()}/verify`)
        .set('Cookie', [`session=${rawSessionToken}`])
        .send({ status: 'verified' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('NO_STATE_CHANGE');
      expect(auditSpy).not.toHaveBeenCalled();
    });

    it('rejects invalid verification status enum with 400', async () => {
      mockSession('tpo', collegeAOrgId);

      const res = await request(app)
        .patch(`/api/v1/companies/${new mongoose.Types.ObjectId().toString()}/verify`)
        .set('Cookie', [`session=${rawSessionToken}`])
        .send({ status: 'invalid_status_enum' });

      expect(res.status).toBe(400);
    });
  });

  // ─── 7. Tier Updates ──────────────────────────────────────────────────────

  describe('Tier Management (PATCH /api/v1/companies/:id/tier)', () => {
    it('updates tier and records audit event with mandatory reason', async () => {
      mockSession('tpo', collegeAOrgId);
      const globalComp = mockGlobalCompany();
      const collegeProf = mockCollegeProfile(globalComp, { tier: 'tier_3' });

      vi.spyOn(CollegeCompanyProfileModel, 'findOne').mockResolvedValue(collegeProf as never);
      vi.spyOn(CompanyModel, 'findById').mockResolvedValue(globalComp as never);
      const auditSpy = vi.spyOn(AuditLogModel, 'create').mockResolvedValue({} as never);

      const res = await request(app)
        .patch(`/api/v1/companies/${collegeProf._id.toString()}/tier`)
        .set('Cookie', [`session=${rawSessionToken}`])
        .send({
          tier: 'tier_1',
          reason: 'Promoted to Tier 1 after offering 30 LPA package.',
        });

      expect(res.status).toBe(200);
      expect(collegeProf.tier).toBe('tier_1');

      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'company_tier_updated',
          orgId: collegeAOrgId,
          userId: tpoUserId,
          details: expect.objectContaining({
            previousTier: 'tier_3',
            newTier: 'tier_1',
            reason: 'Promoted to Tier 1 after offering 30 LPA package.',
          }),
        })
      );
    });

    it('rejects tier update when reason is missing or shorter than 5 characters', async () => {
      mockSession('tpo', collegeAOrgId);

      const resMissing = await request(app)
        .patch(`/api/v1/companies/${new mongoose.Types.ObjectId().toString()}/tier`)
        .set('Cookie', [`session=${rawSessionToken}`])
        .send({ tier: 'tier_1' });
      expect(resMissing.status).toBe(400);

      const resShort = await request(app)
        .patch(`/api/v1/companies/${new mongoose.Types.ObjectId().toString()}/tier`)
        .set('Cookie', [`session=${rawSessionToken}`])
        .send({ tier: 'tier_1', reason: 'ok' });
      expect(resShort.status).toBe(400);
    });

    it('rejects repeated identical tier update with 400 NO_STATE_CHANGE without creating audit log', async () => {
      mockSession('tpo', collegeAOrgId);
      const globalComp = mockGlobalCompany();
      const collegeProf = mockCollegeProfile(globalComp, { tier: 'tier_1' });

      vi.spyOn(CollegeCompanyProfileModel, 'findOne').mockResolvedValue(collegeProf as never);
      vi.spyOn(CompanyModel, 'findById').mockResolvedValue(globalComp as never);
      const auditSpy = vi.spyOn(AuditLogModel, 'create');

      const res = await request(app)
        .patch(`/api/v1/companies/${collegeProf._id.toString()}/tier`)
        .set('Cookie', [`session=${rawSessionToken}`])
        .send({
          tier: 'tier_1',
          reason: 'Attempting to re-assign same tier.',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('NO_STATE_CHANGE');
      expect(auditSpy).not.toHaveBeenCalled();
    });

    it('rejects invalid tier value with 400', async () => {
      mockSession('tpo', collegeAOrgId);

      const res = await request(app)
        .patch(`/api/v1/companies/${new mongoose.Types.ObjectId().toString()}/tier`)
        .set('Cookie', [`session=${rawSessionToken}`])
        .send({ tier: 'tier_unknown', reason: 'Valid reason format' });

      expect(res.status).toBe(400);
    });
  });

  // ─── 8. Cross-Tenant Isolation ────────────────────────────────────────────

  describe('Cross-Tenant Security Suite', () => {
    it('College B cannot view or modify College A company records', async () => {
      mockSession('tpo', collegeBOrgId); // Authenticated as College B
      const targetCompanyProfileId = new mongoose.Types.ObjectId();

      // College A has this company, but College B's query includes orgId: collegeBOrgId
      vi.spyOn(CollegeCompanyProfileModel, 'findOne').mockImplementation(((
        filter: Record<string, unknown>
      ) => {
        if (filter.orgId?.toString() === collegeBOrgId.toString()) {
          return Promise.resolve(null); // Tenant scoping prevents match!
        }
        return Promise.resolve({});
      }) as never);

      // GET detail returns 404
      const resGet = await request(app)
        .get(`/api/v1/companies/${targetCompanyProfileId.toString()}`)
        .set('Cookie', [`session=${rawSessionToken}`]);
      expect(resGet.status).toBe(404);
      expect(resGet.body.error.code).toBe('COMPANY_NOT_FOUND');

      // PUT update returns 404
      const resPut = await request(app)
        .put(`/api/v1/companies/${targetCompanyProfileId.toString()}`)
        .set('Cookie', [`session=${rawSessionToken}`])
        .send({ notes: 'Hacked notes attempt' });
      expect(resPut.status).toBe(404);
      expect(resPut.body.error.code).toBe('COMPANY_NOT_FOUND');

      // PATCH verify returns 404
      const resVerify = await request(app)
        .patch(`/api/v1/companies/${targetCompanyProfileId.toString()}/verify`)
        .set('Cookie', [`session=${rawSessionToken}`])
        .send({ status: 'verified', remarks: 'Cross-tenant verify attempt' });
      expect(resVerify.status).toBe(404);
      expect(resVerify.body.error.code).toBe('COMPANY_NOT_FOUND');

      // PATCH tier returns 404
      const resTier = await request(app)
        .patch(`/api/v1/companies/${targetCompanyProfileId.toString()}/tier`)
        .set('Cookie', [`session=${rawSessionToken}`])
        .send({ tier: 'tier_1', reason: 'Cross-tenant tier change attempt' });
      expect(resTier.status).toBe(404);
      expect(resTier.body.error.code).toBe('COMPANY_NOT_FOUND');
    });

    it('College B listing query strictly filters by College B orgId', async () => {
      mockSession('tpo', collegeBOrgId);
      const countSpy = vi.spyOn(CollegeCompanyProfileModel, 'countDocuments').mockResolvedValue(0);
      const findSpy = vi.spyOn(CollegeCompanyProfileModel, 'find').mockReturnValue({
        sort: vi.fn().mockReturnValue({
          skip: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              populate: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      } as never);

      await request(app)
        .get('/api/v1/companies')
        .set('Cookie', [`session=${rawSessionToken}`]);

      expect(countSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: collegeBOrgId,
        })
      );
      expect(findSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: collegeBOrgId,
        })
      );
    });
  });
});
