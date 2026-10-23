import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../app.js';
import { DepartmentModel } from '../models/department.model.js';
import { AcademicBatchModel } from '../models/academic-batch.model.js';
import { AuditLogModel } from '../models/audit-log.model.js';
import { SessionModel } from '../models/session.model.js';
import { UserModel } from '../models/user.model.js';
import { OrganizationModel } from '../models/organization.model.js';
import { hashSessionToken } from '../utils/password.js';
import type { UserRole } from '@placement-platform/contracts';

const app = createApp();

describe('Academic Structure Integration & Cross-Tenant Isolation (Step 3)', () => {
  const collegeAOrgId = new mongoose.Types.ObjectId();
  const collegeBOrgId = new mongoose.Types.ObjectId();
  const tpoUserId = new mongoose.Types.ObjectId();
  const rawSessionToken = 'test-academic-session-token-xyz';

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
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // Active 1 hour
    } as never);

    vi.spyOn(UserModel, 'findById').mockResolvedValue({
      _id: userId,
      email: `${role}@college.edu`,
      fullName: `Test ${role}`,
      status: 'active',
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

  // ─── 1. Authentication & Role-Based Authorization ────────────────────────

  describe('Authentication & Authorization Guards', () => {
    it('returns 401 UNAUTHENTICATED when accessing academic endpoints without a session', async () => {
      const resGet = await request(app).get('/api/v1/academics/departments');
      expect(resGet.status).toBe(401);
      expect(resGet.body.error.code).toBe('UNAUTHENTICATED');

      const resPost = await request(app)
        .post('/api/v1/academics/departments')
        .send({ name: 'Computer Science', code: 'CSE' });
      expect(resPost.status).toBe(401);
      expect(resPost.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('rejects student role from creating or modifying departments and batches with 403 FORBIDDEN', async () => {
      mockSession('student', collegeAOrgId);

      const resDeptPost = await request(app)
        .post('/api/v1/academics/departments')
        .set('Cookie', [`session=${rawSessionToken}`])
        .send({ name: 'Computer Science', code: 'CSE' });

      expect(resDeptPost.status).toBe(403);
      expect(resDeptPost.body.error.code).toBe('FORBIDDEN');

      const resBatchPost = await request(app)
        .post('/api/v1/academics/batches')
        .set('Cookie', [`session=${rawSessionToken}`])
        .send({ name: '2022-2026', startYear: 2022, graduationYear: 2026 });

      expect(resBatchPost.status).toBe(403);
      expect(resBatchPost.body.error.code).toBe('FORBIDDEN');
    });

    it('rejects company recruiter from accessing academic management with 403 FORBIDDEN', async () => {
      mockSession('company_recruiter', collegeAOrgId);

      const res = await request(app)
        .get('/api/v1/academics/departments')
        .set('Cookie', [`session=${rawSessionToken}`]);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('allows dept_coordinator and faculty_mentor to read departments and batches, but forbids write operations', async () => {
      mockSession('dept_coordinator', collegeAOrgId);

      vi.spyOn(DepartmentModel, 'find').mockReturnValue({
        sort: vi.fn().mockResolvedValue([]),
      } as never);

      const resRead = await request(app)
        .get('/api/v1/academics/departments')
        .set('Cookie', [`session=${rawSessionToken}`]);

      expect(resRead.status).toBe(200);
      expect(resRead.body.data).toEqual([]);

      const resWrite = await request(app)
        .post('/api/v1/academics/departments')
        .set('Cookie', [`session=${rawSessionToken}`])
        .send({ name: 'Civil Engineering', code: 'CIVIL' });

      expect(resWrite.status).toBe(403);
      expect(resWrite.body.error.code).toBe('FORBIDDEN');
    });
  });

  // ─── 2. TPO Academic Management CRUD ──────────────────────────────────────

  describe('TPO Department & Batch Management', () => {
    it('creates a new department and records audit log for an authorized TPO', async () => {
      mockSession('tpo', collegeAOrgId);
      const deptId = new mongoose.Types.ObjectId();

      const auditSpy = vi.spyOn(AuditLogModel, 'create').mockResolvedValue({} as never);
      vi.spyOn(DepartmentModel, 'create').mockResolvedValue({
        _id: deptId,
        orgId: collegeAOrgId,
        name: 'Computer Science and Engineering',
        code: 'CSE',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never);

      const res = await request(app)
        .post('/api/v1/academics/departments')
        .set('Cookie', [`session=${rawSessionToken}`])
        .send({
          name: 'Computer Science and Engineering',
          code: '  cse  ', // Tests normalization
        });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('Computer Science and Engineering');
      expect(res.body.data.code).toBe('CSE');
      expect(res.body.data.orgId).toBe(collegeAOrgId.toString());

      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ACADEMIC_DEPARTMENT_CREATED',
          orgId: collegeAOrgId,
          userId: tpoUserId,
          details: expect.objectContaining({
            departmentId: deptId.toString(),
            code: 'CSE',
          }),
        })
      );
    });

    it('lists all departments for the authenticated college', async () => {
      mockSession('tpo', collegeAOrgId);
      const dept1 = {
        _id: new mongoose.Types.ObjectId(),
        orgId: collegeAOrgId,
        name: 'Computer Science and Engineering',
        code: 'CSE',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn(DepartmentModel, 'find').mockReturnValue({
        sort: vi.fn().mockResolvedValue([dept1]),
      } as never);

      const res = await request(app)
        .get('/api/v1/academics/departments')
        .set('Cookie', [`session=${rawSessionToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].code).toBe('CSE');
    });

    it('updates an existing department and records audit log', async () => {
      mockSession('tpo', collegeAOrgId);
      const deptId = new mongoose.Types.ObjectId();

      const auditSpy = vi.spyOn(AuditLogModel, 'create').mockResolvedValue({} as never);
      vi.spyOn(DepartmentModel, 'findOneAndUpdate').mockResolvedValue({
        _id: deptId,
        orgId: collegeAOrgId,
        name: 'CSE & AI',
        code: 'CSE',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never);

      const res = await request(app)
        .put(`/api/v1/academics/departments/${deptId.toString()}`)
        .set('Cookie', [`session=${rawSessionToken}`])
        .send({ name: 'CSE & AI' });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('CSE & AI');

      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ACADEMIC_DEPARTMENT_UPDATED',
          orgId: collegeAOrgId,
          userId: tpoUserId,
        })
      );
    });

    it('creates an academic batch and records audit log', async () => {
      mockSession('tpo', collegeAOrgId);
      const batchId = new mongoose.Types.ObjectId();

      const auditSpy = vi.spyOn(AuditLogModel, 'create').mockResolvedValue({} as never);
      vi.spyOn(AcademicBatchModel, 'create').mockResolvedValue({
        _id: batchId,
        orgId: collegeAOrgId,
        name: '2022-2026',
        startYear: 2022,
        graduationYear: 2026,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never);

      const res = await request(app)
        .post('/api/v1/academics/batches')
        .set('Cookie', [`session=${rawSessionToken}`])
        .send({
          name: '2022-2026',
          startYear: 2022,
          graduationYear: 2026,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('2022-2026');
      expect(res.body.data.graduationYear).toBe(2026);
      expect(res.body.data.orgId).toBe(collegeAOrgId.toString());

      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ACADEMIC_BATCH_CREATED',
          orgId: collegeAOrgId,
          userId: tpoUserId,
        })
      );
    });

    it('lists all academic batches for the college', async () => {
      mockSession('tpo', collegeAOrgId);
      const batch = {
        _id: new mongoose.Types.ObjectId(),
        orgId: collegeAOrgId,
        name: '2022-2026',
        startYear: 2022,
        graduationYear: 2026,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn(AcademicBatchModel, 'find').mockReturnValue({
        sort: vi.fn().mockResolvedValue([batch]),
      } as never);

      const res = await request(app)
        .get('/api/v1/academics/batches')
        .set('Cookie', [`session=${rawSessionToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].name).toBe('2022-2026');
    });

    it('updates an existing academic batch', async () => {
      mockSession('tpo', collegeAOrgId);
      const batchId = new mongoose.Types.ObjectId();

      vi.spyOn(AcademicBatchModel, 'findOne').mockResolvedValue({
        _id: batchId,
        orgId: collegeAOrgId,
        name: '2022-2026',
        startYear: 2022,
        graduationYear: 2026,
      } as never);

      vi.spyOn(AcademicBatchModel, 'findOneAndUpdate').mockResolvedValue({
        _id: batchId,
        orgId: collegeAOrgId,
        name: 'Batch of 2026',
        startYear: 2022,
        graduationYear: 2026,
        status: 'graduated',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never);

      const res = await request(app)
        .put(`/api/v1/academics/batches/${batchId.toString()}`)
        .set('Cookie', [`session=${rawSessionToken}`])
        .send({ status: 'graduated', name: 'Batch of 2026' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('graduated');
      expect(res.body.data.name).toBe('Batch of 2026');
    });
  });

  // ─── 3. Mandatory Tenant Isolation Tests ──────────────────────────────────

  describe('Tenant Isolation Enforcement', () => {
    it('College B cannot view or list College A departments (queries strictly scoped by orgId)', async () => {
      mockSession('tpo', collegeBOrgId);

      const findSpy = vi.spyOn(DepartmentModel, 'find').mockReturnValue({
        sort: vi.fn().mockResolvedValue([]),
      } as never);

      const res = await request(app)
        .get('/api/v1/academics/departments')
        .set('Cookie', [`session=${rawSessionToken}`]);

      expect(res.status).toBe(200);
      // Verify query is strictly filtered by College B orgId
      expect(findSpy).toHaveBeenCalledWith({
        orgId: collegeBOrgId,
      });
      expect(res.body.data).toEqual([]);
    });

    it('College B cannot modify College A department (returns 404 NOT_FOUND)', async () => {
      mockSession('tpo', collegeBOrgId);
      const collegeADeptId = new mongoose.Types.ObjectId();

      // findOneAndUpdate with College B orgId finds nothing because doc belongs to College A
      vi.spyOn(DepartmentModel, 'findOneAndUpdate').mockResolvedValue(null);

      const res = await request(app)
        .put(`/api/v1/academics/departments/${collegeADeptId.toString()}`)
        .set('Cookie', [`session=${rawSessionToken}`])
        .send({ name: 'Hacked Name' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
      expect(res.body.error.message).toMatch(/not found in your college/i);
    });

    it('College B cannot modify College A academic batch (returns 404 NOT_FOUND)', async () => {
      mockSession('tpo', collegeBOrgId);
      const collegeABatchId = new mongoose.Types.ObjectId();

      vi.spyOn(AcademicBatchModel, 'findOne').mockResolvedValue(null);

      const res = await request(app)
        .put(`/api/v1/academics/batches/${collegeABatchId.toString()}`)
        .set('Cookie', [`session=${rawSessionToken}`])
        .send({ name: 'Hacked Batch' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
      expect(res.body.error.message).toMatch(/not found in your college/i);
    });

    it('allows identical department code in two different colleges without conflict', async () => {
      // 1. College A creates CSE
      mockSession('tpo', collegeAOrgId);
      vi.spyOn(DepartmentModel, 'create').mockResolvedValueOnce({
        _id: new mongoose.Types.ObjectId(),
        orgId: collegeAOrgId,
        name: 'Computer Science',
        code: 'CSE',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never);

      const resA = await request(app)
        .post('/api/v1/academics/departments')
        .set('Cookie', [`session=${rawSessionToken}`])
        .send({ name: 'Computer Science', code: 'CSE' });

      expect(resA.status).toBe(201);
      expect(resA.body.data.orgId).toBe(collegeAOrgId.toString());

      // 2. College B creates CSE
      mockSession('tpo', collegeBOrgId);
      vi.spyOn(DepartmentModel, 'create').mockResolvedValueOnce({
        _id: new mongoose.Types.ObjectId(),
        orgId: collegeBOrgId,
        name: 'Computer Science & Engineering',
        code: 'CSE',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never);

      const resB = await request(app)
        .post('/api/v1/academics/departments')
        .set('Cookie', [`session=${rawSessionToken}`])
        .send({ name: 'Computer Science & Engineering', code: 'CSE' });

      expect(resB.status).toBe(201);
      expect(resB.body.data.orgId).toBe(collegeBOrgId.toString());
    });

    it('returns 409 DUPLICATE_RESOURCE for duplicate department codes within the same college', async () => {
      mockSession('tpo', collegeAOrgId);

      const duplicateError = new Error('E11000 duplicate key error');
      (duplicateError as unknown as { code: number }).code = 11000;
      vi.spyOn(DepartmentModel, 'create').mockRejectedValue(duplicateError);

      const res = await request(app)
        .post('/api/v1/academics/departments')
        .set('Cookie', [`session=${rawSessionToken}`])
        .send({ name: 'Computer Science 2', code: 'CSE' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('DUPLICATE_RESOURCE');
      expect(res.body.error.message).toMatch(/already exists in your college/i);
    });

    it('returns 409 DUPLICATE_RESOURCE for duplicate batch uniqueness conflict within the same college', async () => {
      mockSession('tpo', collegeAOrgId);

      const duplicateError = new Error('E11000 duplicate key error');
      (duplicateError as unknown as { code: number }).code = 11000;
      vi.spyOn(AcademicBatchModel, 'create').mockRejectedValue(duplicateError);

      const res = await request(app)
        .post('/api/v1/academics/batches')
        .set('Cookie', [`session=${rawSessionToken}`])
        .send({ name: '2022-2026', startYear: 2022, graduationYear: 2026 });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('DUPLICATE_RESOURCE');
      expect(res.body.error.message).toMatch(/already exists in your college/i);
    });
  });

  // ─── 4. Input Validation & Error Handling ─────────────────────────────────

  describe('Validation & Error Scenarios', () => {
    it('returns 400 INVALID_ID when updating department with non-ObjectId string', async () => {
      mockSession('tpo', collegeAOrgId);

      const res = await request(app)
        .put('/api/v1/academics/departments/invalid-non-hex-id')
        .set('Cookie', [`session=${rawSessionToken}`])
        .send({ name: 'Valid Name' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_ID');
    });

    it('returns 400 INVALID_ID when updating batch with non-ObjectId string', async () => {
      mockSession('tpo', collegeAOrgId);

      const res = await request(app)
        .put('/api/v1/academics/batches/invalid-batch-id')
        .set('Cookie', [`session=${rawSessionToken}`])
        .send({ name: 'Valid Batch' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_ID');
    });

    it('rejects batch update where new startYear exceeds existing graduationYear with 400', async () => {
      mockSession('tpo', collegeAOrgId);
      const batchId = new mongoose.Types.ObjectId();

      vi.spyOn(AcademicBatchModel, 'findOne').mockResolvedValue({
        _id: batchId,
        orgId: collegeAOrgId,
        startYear: 2022,
        graduationYear: 2026,
      } as never);

      const res = await request(app)
        .put(`/api/v1/academics/batches/${batchId.toString()}`)
        .set('Cookie', [`session=${rawSessionToken}`])
        .send({ startYear: 2028 }); // Exceeds existing graduationYear (2026)

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_YEAR_RANGE');
      expect(res.body.error.message).toMatch(/greater than or equal to start year/i);
    });
  });
});
