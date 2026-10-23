import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../app.js';
import { StudentProfileModel } from '../models/student-profile.model.js';
import { DepartmentModel } from '../models/department.model.js';
import { AcademicBatchModel } from '../models/academic-batch.model.js';
import { AuditLogModel } from '../models/audit-log.model.js';
import { SessionModel } from '../models/session.model.js';
import { UserModel } from '../models/user.model.js';
import { OrganizationModel } from '../models/organization.model.js';
import { hashSessionToken } from '../utils/password.js';
import type { UserRole } from '@placement-platform/contracts';

const app = createApp();

describe('Student Management Integration Tests & Cross-Tenant Security Suite (Step 5)', () => {
  const collegeAOrgId = new mongoose.Types.ObjectId();
  const collegeBOrgId = new mongoose.Types.ObjectId();

  const collegeADept1Id = new mongoose.Types.ObjectId();
  const collegeADept2Id = new mongoose.Types.ObjectId();
  const collegeBDeptId = new mongoose.Types.ObjectId();

  const collegeABatchId = new mongoose.Types.ObjectId();
  const collegeBBatchId = new mongoose.Types.ObjectId();

  const tpoUserId = new mongoose.Types.ObjectId();
  const coordinatorUserId = new mongoose.Types.ObjectId();
  const rawSessionToken = 'test-student-session-token-abc';

  function mockSession(
    role: UserRole,
    orgId: mongoose.Types.ObjectId,
    userId: mongoose.Types.ObjectId = tpoUserId,
    departmentId?: mongoose.Types.ObjectId
  ) {
    vi.spyOn(SessionModel, 'findOne').mockResolvedValue({
      _id: new mongoose.Types.ObjectId(),
      tokenHash: hashSessionToken(rawSessionToken),
      userId,
      orgId,
      departmentId,
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
          departmentId,
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

  const baseStudentInput = {
    enrollmentNumber: '  0101cs221001  ',
    departmentId: collegeADept1Id.toString(),
    batchId: collegeABatchId.toString(),
    personalDetails: {
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'Jane.Doe@college.edu',
      phone: '+91 9876543210',
      gender: 'female' as const,
    },
    academicRecords: {
      tenthPercentage: 89.5,
      twelfthPercentage: 87.0,
      currentCgpa: 8.75,
      activeBacklogs: 0,
      historyBacklogs: 0,
      gapYears: 0,
    },
    skills: ['TypeScript', 'Node.js', 'React'],
  };

  function mockStudentDoc(overrides: Record<string, unknown> = {}) {
    return {
      _id: new mongoose.Types.ObjectId(),
      orgId: collegeAOrgId,
      userId: undefined,
      enrollmentNumber: '0101CS221001',
      departmentId: collegeADept1Id,
      batchId: collegeABatchId,
      personalDetails: {
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane.doe@college.edu',
        phone: '+91 9876543210',
        gender: 'female',
        dob: undefined,
      },
      academicRecords: {
        tenthPercentage: 89.5,
        twelfthPercentage: 87.0,
        diplomaPercentage: null,
        currentCgpa: 8.75,
        activeBacklogs: 0,
        historyBacklogs: 0,
        gapYears: 0,
      },
      skills: ['TypeScript', 'Node.js', 'React'],
      status: 'unplaced',
      isVerified: false,
      verificationDetails: undefined as
        | { verifiedBy?: mongoose.Types.ObjectId; verifiedAt?: Date; remarks?: string }
        | undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
      save: vi.fn().mockResolvedValue(true),
      ...overrides,
    };
  }

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(AuditLogModel, 'create').mockResolvedValue({} as never);
  });

  // ─── 1. Authentication & Role-Based Authorization ────────────────────────

  describe('Authentication & Role-Based Authorization', () => {
    it('returns 401 UNAUTHENTICATED when accessing student endpoints without a session', async () => {
      const resPost = await request(app).post('/api/v1/students').send(baseStudentInput);
      expect(resPost.status).toBe(401);
      expect(resPost.body.error.code).toBe('UNAUTHENTICATED');

      const resGet = await request(app).get('/api/v1/students');
      expect(resGet.status).toBe(401);
      expect(resGet.body.error.code).toBe('UNAUTHENTICATED');

      const resGetOne = await request(app).get(
        `/api/v1/students/${new mongoose.Types.ObjectId().toString()}`
      );
      expect(resGetOne.status).toBe(401);

      const resPut = await request(app)
        .put(`/api/v1/students/${new mongoose.Types.ObjectId().toString()}`)
        .send({ skills: ['Python'] });
      expect(resPut.status).toBe(401);

      const resVerify = await request(app)
        .patch(`/api/v1/students/${new mongoose.Types.ObjectId().toString()}/verify`)
        .send({ isVerified: true });
      expect(resVerify.status).toBe(401);

      const resStatus = await request(app)
        .patch(`/api/v1/students/${new mongoose.Types.ObjectId().toString()}/status`)
        .send({ status: 'placed' });
      expect(resStatus.status).toBe(401);
    });

    it('rejects student role with 403 FORBIDDEN on all student management endpoints', async () => {
      mockSession('student', collegeAOrgId);
      const studentId = new mongoose.Types.ObjectId().toString();

      const resPost = await request(app)
        .post('/api/v1/students')
        .set('Cookie', [`session=${rawSessionToken}`])
        .send(baseStudentInput);
      expect(resPost.status).toBe(403);
      expect(resPost.body.error.code).toBe('FORBIDDEN');

      const resGet = await request(app)
        .get('/api/v1/students')
        .set('Cookie', [`session=${rawSessionToken}`]);
      expect(resGet.status).toBe(403);

      const resGetOne = await request(app)
        .get(`/api/v1/students/${studentId}`)
        .set('Cookie', [`session=${rawSessionToken}`]);
      expect(resGetOne.status).toBe(403);

      const resPut = await request(app)
        .put(`/api/v1/students/${studentId}`)
        .set('Cookie', [`session=${rawSessionToken}`])
        .send({ skills: ['Go'] });
      expect(resPut.status).toBe(403);

      const resVerify = await request(app)
        .patch(`/api/v1/students/${studentId}/verify`)
        .set('Cookie', [`session=${rawSessionToken}`])
        .send({ isVerified: true });
      expect(resVerify.status).toBe(403);

      const resStatus = await request(app)
        .patch(`/api/v1/students/${studentId}/status`)
        .set('Cookie', [`session=${rawSessionToken}`])
        .send({ status: 'placed' });
      expect(resStatus.status).toBe(403);
    });

    it('rejects company_recruiter and interviewer with 403 FORBIDDEN', async () => {
      mockSession('company_recruiter', collegeAOrgId);

      const resRecruiter = await request(app)
        .get('/api/v1/students')
        .set('Cookie', [`session=${rawSessionToken}`]);
      expect(resRecruiter.status).toBe(403);
      expect(resRecruiter.body.error.code).toBe('FORBIDDEN');

      mockSession('interviewer', collegeAOrgId);
      const resInterviewer = await request(app)
        .get('/api/v1/students')
        .set('Cookie', [`session=${rawSessionToken}`]);
      expect(resInterviewer.status).toBe(403);
      expect(resInterviewer.body.error.code).toBe('FORBIDDEN');
    });

    it('rejects faculty_mentor from student management endpoints with 403 FORBIDDEN', async () => {
      mockSession('faculty_mentor', collegeAOrgId);

      const res = await request(app)
        .get('/api/v1/students')
        .set('Cookie', [`session=${rawSessionToken}`]);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  // ─── 2. CRUD, Validation & Audit Logging ──────────────────────────────────

  describe('CRUD Operations & Data Validation', () => {
    it('creates a new student, normalizes enrollment and email, and writes audit event', async () => {
      mockSession('tpo', collegeAOrgId);
      const studentDoc = mockStudentDoc();

      vi.spyOn(DepartmentModel, 'findOne').mockResolvedValue({
        _id: collegeADept1Id,
        orgId: collegeAOrgId,
      } as never);
      vi.spyOn(AcademicBatchModel, 'findOne').mockResolvedValue({
        _id: collegeABatchId,
        orgId: collegeAOrgId,
      } as never);
      vi.spyOn(StudentProfileModel, 'create').mockResolvedValue(studentDoc as never);
      const auditSpy = vi.spyOn(AuditLogModel, 'create').mockResolvedValue({} as never);

      const res = await request(app)
        .post('/api/v1/students')
        .set('Cookie', [`session=${rawSessionToken}`])
        .send(baseStudentInput);

      expect(res.status).toBe(201);
      expect(res.body.data.enrollmentNumber).toBe('0101CS221001');
      expect(res.body.data.personalDetails.email).toBe('jane.doe@college.edu');
      expect(res.body.data.status).toBe('unplaced');
      expect(res.body.data.isVerified).toBe(false);

      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'STUDENT_CREATED',
          orgId: collegeAOrgId,
          userId: tpoUserId,
          details: expect.objectContaining({
            studentId: studentDoc._id.toString(),
            enrollmentNumber: '0101CS221001',
          }),
        })
      );
    });

    it('rejects duplicate enrollment numbers within the college with 409 DUPLICATE_RESOURCE', async () => {
      mockSession('tpo', collegeAOrgId);

      vi.spyOn(DepartmentModel, 'findOne').mockResolvedValue({
        _id: collegeADept1Id,
        orgId: collegeAOrgId,
      } as never);
      vi.spyOn(AcademicBatchModel, 'findOne').mockResolvedValue({
        _id: collegeABatchId,
        orgId: collegeAOrgId,
      } as never);

      const duplicateError = new Error('E11000 duplicate key error');
      (duplicateError as unknown as { code: number }).code = 11000;
      vi.spyOn(StudentProfileModel, 'create').mockRejectedValue(duplicateError);

      const res = await request(app)
        .post('/api/v1/students')
        .set('Cookie', [`session=${rawSessionToken}`])
        .send(baseStudentInput);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('DUPLICATE_RESOURCE');
      expect(res.body.error.message).toMatch(/already exists in your college/i);
    });

    it('rejects invalid ObjectId route parameter with 400 INVALID_ID', async () => {
      mockSession('tpo', collegeAOrgId);

      const resGet = await request(app)
        .get('/api/v1/students/not-a-valid-hex-id')
        .set('Cookie', [`session=${rawSessionToken}`]);
      expect(resGet.status).toBe(400);
      expect(resGet.body.error.code).toBe('INVALID_ID');

      const resPut = await request(app)
        .put('/api/v1/students/not-a-valid-hex-id')
        .set('Cookie', [`session=${rawSessionToken}`])
        .send({ skills: ['Python'] });
      expect(resPut.status).toBe(400);
      expect(resPut.body.error.code).toBe('INVALID_ID');
    });

    it('rejects invalid student input boundaries (CGPA > 10, negative backlogs) with 400 VALIDATION_ERROR', async () => {
      mockSession('tpo', collegeAOrgId);

      const invalidInput = {
        ...baseStudentInput,
        academicRecords: {
          ...baseStudentInput.academicRecords,
          currentCgpa: 11.0, // invalid
          activeBacklogs: -1, // invalid
        },
      };

      const res = await request(app)
        .post('/api/v1/students')
        .set('Cookie', [`session=${rawSessionToken}`])
        .send(invalidInput);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('updates general student fields and writes STUDENT_UPDATED audit log', async () => {
      mockSession('tpo', collegeAOrgId);
      const studentId = new mongoose.Types.ObjectId();
      const updatedDoc = mockStudentDoc({
        _id: studentId,
        skills: ['Rust', 'WebAssembly'],
        academicRecords: {
          tenthPercentage: 89.5,
          twelfthPercentage: 87.0,
          diplomaPercentage: null,
          currentCgpa: 9.1,
          activeBacklogs: 0,
          historyBacklogs: 0,
          gapYears: 0,
        },
      });

      vi.spyOn(StudentProfileModel, 'findOneAndUpdate').mockResolvedValue(updatedDoc as never);
      const auditSpy = vi.spyOn(AuditLogModel, 'create').mockResolvedValue({} as never);

      const res = await request(app)
        .put(`/api/v1/students/${studentId.toString()}`)
        .set('Cookie', [`session=${rawSessionToken}`])
        .send({
          skills: ['Rust', 'WebAssembly'],
          academicRecords: { currentCgpa: 9.1 },
        });

      expect(res.status).toBe(200);
      expect(res.body.data.skills).toEqual(['Rust', 'WebAssembly']);
      expect(res.body.data.academicRecords.currentCgpa).toBe(9.1);

      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'STUDENT_UPDATED',
          orgId: collegeAOrgId,
          userId: tpoUserId,
          details: expect.objectContaining({
            studentId: studentId.toString(),
          }),
        })
      );
    });

    it('verifies student academic data, sets verificationDetails, and writes STUDENT_VERIFIED audit log', async () => {
      mockSession('tpo', collegeAOrgId);
      const studentId = new mongoose.Types.ObjectId();
      const studentDoc = mockStudentDoc({ _id: studentId, isVerified: false });

      vi.spyOn(StudentProfileModel, 'findOne').mockResolvedValue(studentDoc as never);
      const auditSpy = vi.spyOn(AuditLogModel, 'create').mockResolvedValue({} as never);

      const res = await request(app)
        .patch(`/api/v1/students/${studentId.toString()}/verify`)
        .set('Cookie', [`session=${rawSessionToken}`])
        .send({ isVerified: true, remarks: 'Verified with physical marksheets' });

      expect(res.status).toBe(200);
      expect(studentDoc.isVerified).toBe(true);
      expect(studentDoc.verificationDetails?.remarks).toBe('Verified with physical marksheets');
      expect(studentDoc.verificationDetails?.verifiedBy).toEqual(tpoUserId);

      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'STUDENT_VERIFIED',
          orgId: collegeAOrgId,
          userId: tpoUserId,
          details: expect.objectContaining({
            studentId: studentId.toString(),
            isVerified: true,
            remarks: 'Verified with physical marksheets',
          }),
        })
      );
    });

    it('changes placement status and writes STUDENT_STATUS_CHANGED audit log', async () => {
      mockSession('tpo', collegeAOrgId);
      const studentId = new mongoose.Types.ObjectId();
      const studentDoc = mockStudentDoc({ _id: studentId, status: 'unplaced' });

      vi.spyOn(StudentProfileModel, 'findOne').mockResolvedValue(studentDoc as never);
      const auditSpy = vi.spyOn(AuditLogModel, 'create').mockResolvedValue({} as never);

      const res = await request(app)
        .patch(`/api/v1/students/${studentId.toString()}/status`)
        .set('Cookie', [`session=${rawSessionToken}`])
        .send({ status: 'placed', reason: 'Accepted Microsoft SDE offer' });

      expect(res.status).toBe(200);
      expect(studentDoc.status).toBe('placed');

      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'STUDENT_STATUS_CHANGED',
          orgId: collegeAOrgId,
          userId: tpoUserId,
          details: expect.objectContaining({
            studentId: studentId.toString(),
            previousStatus: 'unplaced',
            newStatus: 'placed',
            reason: 'Accepted Microsoft SDE offer',
          }),
        })
      );
    });

    it('paginates, filters, searches, and sorts student directory correctly', async () => {
      mockSession('tpo', collegeAOrgId);
      const student1 = mockStudentDoc({ enrollmentNumber: '0101CS221001' });

      const countSpy = vi.spyOn(StudentProfileModel, 'countDocuments').mockResolvedValue(1);
      const findSpy = vi.spyOn(StudentProfileModel, 'find').mockReturnValue({
        sort: vi.fn().mockReturnValue({
          skip: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([student1]),
          }),
        }),
      } as never);

      const res = await request(app)
        .get('/api/v1/students')
        .query({
          page: 1,
          limit: 10,
          search: 'Jane',
          minCgpa: 8.0,
          maxActiveBacklogs: 0,
          status: 'unplaced',
          sortBy: 'currentCgpa',
          sortOrder: 'desc',
        })
        .set('Cookie', [`session=${rawSessionToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(1);
      expect(res.body.data.page).toBe(1);
      expect(res.body.data.limit).toBe(10);
      expect(res.body.data.totalPages).toBe(1);
      expect(res.body.data.items).toHaveLength(1);

      expect(countSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: collegeAOrgId,
          status: 'unplaced',
          'academicRecords.currentCgpa': { $gte: 8.0 },
          'academicRecords.activeBacklogs': { $lte: 0 },
          $or: expect.arrayContaining([
            expect.objectContaining({ enrollmentNumber: expect.anything() }),
          ]),
        })
      );
      expect(findSpy).toHaveBeenCalled();
    });
  });

  // ─── 3. Mandatory Cross-Tenant Security Tests ─────────────────────────────

  describe('Mandatory Cross-Tenant Security Tests', () => {
    it('1. College B cannot list or search College A students', async () => {
      mockSession('tpo', collegeBOrgId);

      const countSpy = vi.spyOn(StudentProfileModel, 'countDocuments').mockResolvedValue(0);
      const findSpy = vi.spyOn(StudentProfileModel, 'find').mockReturnValue({
        sort: vi.fn().mockReturnValue({
          skip: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as never);

      const res = await request(app)
        .get('/api/v1/students')
        .set('Cookie', [`session=${rawSessionToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toEqual([]);
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

    it('2. College B receives 404 NOT_FOUND when viewing a College A student by ID', async () => {
      mockSession('tpo', collegeBOrgId);
      const collegeAStudentId = new mongoose.Types.ObjectId();

      // Query with College B orgId returns null
      vi.spyOn(StudentProfileModel, 'findOne').mockResolvedValue(null);

      const res = await request(app)
        .get(`/api/v1/students/${collegeAStudentId.toString()}`)
        .set('Cookie', [`session=${rawSessionToken}`]);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
      expect(res.body.error.message).toMatch(/not found in your college/i);
    });

    it('3. College B receives 404 NOT_FOUND when updating a College A student (record unchanged)', async () => {
      mockSession('tpo', collegeBOrgId);
      const collegeAStudentId = new mongoose.Types.ObjectId();

      // findOneAndUpdate with College B orgId returns null
      vi.spyOn(StudentProfileModel, 'findOneAndUpdate').mockResolvedValue(null);

      const res = await request(app)
        .put(`/api/v1/students/${collegeAStudentId.toString()}`)
        .set('Cookie', [`session=${rawSessionToken}`])
        .send({ skills: ['MaliciousSkill'] });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
      expect(res.body.error.message).toMatch(/not found in your college/i);
    });

    it('4. College A cannot create a student using College B department or batch IDs (returns 400 INVALID_REFERENCE)', async () => {
      mockSession('tpo', collegeAOrgId);

      // Department belongs to College B, so findOne within College A returns null
      vi.spyOn(DepartmentModel, 'findOne').mockResolvedValue(null);

      const resDeptFail = await request(app)
        .post('/api/v1/students')
        .set('Cookie', [`session=${rawSessionToken}`])
        .send({
          ...baseStudentInput,
          departmentId: collegeBDeptId.toString(),
        });

      expect(resDeptFail.status).toBe(400);
      expect(resDeptFail.body.error.code).toBe('INVALID_REFERENCE');
      expect(resDeptFail.body.error.message).toMatch(/department does not belong to your college/i);

      // Now department is valid, but batch belongs to College B
      vi.spyOn(DepartmentModel, 'findOne').mockResolvedValue({
        _id: collegeADept1Id,
        orgId: collegeAOrgId,
      } as never);
      vi.spyOn(AcademicBatchModel, 'findOne').mockResolvedValue(null);

      const resBatchFail = await request(app)
        .post('/api/v1/students')
        .set('Cookie', [`session=${rawSessionToken}`])
        .send({
          ...baseStudentInput,
          batchId: collegeBBatchId.toString(),
        });

      expect(resBatchFail.status).toBe(400);
      expect(resBatchFail.body.error.code).toBe('INVALID_REFERENCE');
      expect(resBatchFail.body.error.message).toMatch(/batch does not belong to your college/i);
    });

    it('5. Same enrollment number can exist in two different colleges without conflict', async () => {
      // 1. College A creates student with enrollment 0101CS221001
      mockSession('tpo', collegeAOrgId);
      vi.spyOn(DepartmentModel, 'findOne').mockResolvedValue({ _id: collegeADept1Id, orgId: collegeAOrgId } as never);
      vi.spyOn(AcademicBatchModel, 'findOne').mockResolvedValue({ _id: collegeABatchId, orgId: collegeAOrgId } as never);
      vi.spyOn(StudentProfileModel, 'create').mockResolvedValueOnce(
        mockStudentDoc({ orgId: collegeAOrgId, enrollmentNumber: '0101CS221001' }) as never
      );

      const resA = await request(app)
        .post('/api/v1/students')
        .set('Cookie', [`session=${rawSessionToken}`])
        .send(baseStudentInput);

      expect(resA.status).toBe(201);
      expect(resA.body.data.orgId).toBe(collegeAOrgId.toString());
      expect(resA.body.data.enrollmentNumber).toBe('0101CS221001');

      // 2. College B creates student with the same enrollment 0101CS221001
      mockSession('tpo', collegeBOrgId);
      vi.spyOn(DepartmentModel, 'findOne').mockResolvedValue({ _id: collegeBDeptId, orgId: collegeBOrgId } as never);
      vi.spyOn(AcademicBatchModel, 'findOne').mockResolvedValue({ _id: collegeBBatchId, orgId: collegeBOrgId } as never);
      vi.spyOn(StudentProfileModel, 'create').mockResolvedValueOnce(
        mockStudentDoc({ orgId: collegeBOrgId, enrollmentNumber: '0101CS221001' }) as never
      );

      const resB = await request(app)
        .post('/api/v1/students')
        .set('Cookie', [`session=${rawSessionToken}`])
        .send({
          ...baseStudentInput,
          departmentId: collegeBDeptId.toString(),
          batchId: collegeBBatchId.toString(),
        });

      expect(resB.status).toBe(201);
      expect(resB.body.data.orgId).toBe(collegeBOrgId.toString());
      expect(resB.body.data.enrollmentNumber).toBe('0101CS221001');
    });

    it('6. Multiple student profiles without a linked userId can be created without unique-index conflict', async () => {
      mockSession('tpo', collegeAOrgId);
      vi.spyOn(DepartmentModel, 'findOne').mockResolvedValue({ _id: collegeADept1Id, orgId: collegeAOrgId } as never);
      vi.spyOn(AcademicBatchModel, 'findOne').mockResolvedValue({ _id: collegeABatchId, orgId: collegeAOrgId } as never);

      // Student 1 (userId: undefined)
      vi.spyOn(StudentProfileModel, 'create').mockResolvedValueOnce(
        mockStudentDoc({ enrollmentNumber: '0101CS221001', userId: undefined }) as never
      );
      const res1 = await request(app)
        .post('/api/v1/students')
        .set('Cookie', [`session=${rawSessionToken}`])
        .send({ ...baseStudentInput, enrollmentNumber: '0101CS221001' });

      expect(res1.status).toBe(201);
      expect(res1.body.data.userId).toBeNull();

      // Student 2 (userId: undefined)
      vi.spyOn(StudentProfileModel, 'create').mockResolvedValueOnce(
        mockStudentDoc({ enrollmentNumber: '0101CS221002', userId: undefined }) as never
      );
      const res2 = await request(app)
        .post('/api/v1/students')
        .set('Cookie', [`session=${rawSessionToken}`])
        .send({ ...baseStudentInput, enrollmentNumber: '0101CS221002' });

      expect(res2.status).toBe(201);
      expect(res2.body.data.userId).toBeNull();
    });
  });

  // ─── 4. Department Coordinator Isolation ──────────────────────────────────

  describe('Department Coordinator Scoping (Option A)', () => {
    it('1. Coordinator sees only students in their assigned department', async () => {
      mockSession('dept_coordinator', collegeAOrgId, coordinatorUserId, collegeADept1Id);

      const findSpy = vi.spyOn(StudentProfileModel, 'find').mockReturnValue({
        sort: vi.fn().mockReturnValue({
          skip: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockStudentDoc({ departmentId: collegeADept1Id })]),
          }),
        }),
      } as never);
      vi.spyOn(StudentProfileModel, 'countDocuments').mockResolvedValue(1);

      const res = await request(app)
        .get('/api/v1/students')
        .set('Cookie', [`session=${rawSessionToken}`]);

      expect(res.status).toBe(200);
      expect(findSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: collegeAOrgId,
          departmentId: collegeADept1Id, // Enforced at query level
        })
      );
    });

    it('2. Requesting a different department through query filter is rejected with 403 FORBIDDEN', async () => {
      mockSession('dept_coordinator', collegeAOrgId, coordinatorUserId, collegeADept1Id);

      const res = await request(app)
        .get('/api/v1/students')
        .query({ departmentId: collegeADept2Id.toString() }) // Mismatched department
        .set('Cookie', [`session=${rawSessionToken}`]);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toMatch(/only access students in their assigned department/i);
    });

    it('3. Viewing or verifying a student from another department returns 404 NOT_FOUND', async () => {
      mockSession('dept_coordinator', collegeAOrgId, coordinatorUserId, collegeADept1Id);
      const otherDeptStudentId = new mongoose.Types.ObjectId();

      // Student exists in collegeA, but belongs to dept2
      vi.spyOn(StudentProfileModel, 'findOne').mockResolvedValue(
        mockStudentDoc({
          _id: otherDeptStudentId,
          departmentId: collegeADept2Id, // different department
        }) as never
      );

      // GET detail
      const resGet = await request(app)
        .get(`/api/v1/students/${otherDeptStudentId.toString()}`)
        .set('Cookie', [`session=${rawSessionToken}`]);

      expect(resGet.status).toBe(404);
      expect(resGet.body.error.code).toBe('NOT_FOUND');

      // PATCH verify
      const resVerify = await request(app)
        .patch(`/api/v1/students/${otherDeptStudentId.toString()}/verify`)
        .set('Cookie', [`session=${rawSessionToken}`])
        .send({ isVerified: true });

      expect(resVerify.status).toBe(404);
      expect(resVerify.body.error.code).toBe('NOT_FOUND');
    });

    it('4. Coordinator cannot create students, perform general updates, or change placement status', async () => {
      mockSession('dept_coordinator', collegeAOrgId, coordinatorUserId, collegeADept1Id);
      const studentId = new mongoose.Types.ObjectId().toString();

      const resCreate = await request(app)
        .post('/api/v1/students')
        .set('Cookie', [`session=${rawSessionToken}`])
        .send(baseStudentInput);
      expect(resCreate.status).toBe(403);

      const resUpdate = await request(app)
        .put(`/api/v1/students/${studentId}`)
        .set('Cookie', [`session=${rawSessionToken}`])
        .send({ skills: ['Python'] });
      expect(resUpdate.status).toBe(403);

      const resStatus = await request(app)
        .patch(`/api/v1/students/${studentId}/status`)
        .set('Cookie', [`session=${rawSessionToken}`])
        .send({ status: 'placed' });
      expect(resStatus.status).toBe(403);
    });
  });

  // ─── 5. Protected Fields Immunity ─────────────────────────────────────────

  describe('Protected Fields Immunity', () => {
    it('ignores client attempts to inject orgId, userId, enrollmentNumber, isVerified, or status in PUT', async () => {
      mockSession('tpo', collegeAOrgId);
      const studentId = new mongoose.Types.ObjectId();
      const studentDoc = mockStudentDoc({
        _id: studentId,
        orgId: collegeAOrgId,
        enrollmentNumber: '0101CS221001',
        isVerified: false,
        status: 'unplaced',
      });

      const updateSpy = vi.spyOn(StudentProfileModel, 'findOneAndUpdate').mockResolvedValue(studentDoc as never);

      const res = await request(app)
        .put(`/api/v1/students/${studentId.toString()}`)
        .set('Cookie', [`session=${rawSessionToken}`])
        .send({
          skills: ['Go', 'Docker'],
          orgId: 'attacker-org-id',
          userId: 'attacker-user-id',
          enrollmentNumber: 'HACKED-ENROLLMENT',
          isVerified: true,
          status: 'placed',
        });

      expect(res.status).toBe(200);

      // Verify that updateSet in findOneAndUpdate only contains skills
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: studentId,
          orgId: collegeAOrgId,
        }),
        expect.objectContaining({
          $set: { skills: ['Go', 'Docker'] },
        }),
        expect.anything()
      );
    });

    it('verify endpoint updates strictly isVerified and verificationDetails', async () => {
      mockSession('tpo', collegeAOrgId);
      const studentId = new mongoose.Types.ObjectId();
      const studentDoc = mockStudentDoc({ _id: studentId, status: 'unplaced' });

      vi.spyOn(StudentProfileModel, 'findOne').mockResolvedValue(studentDoc as never);

      const res = await request(app)
        .patch(`/api/v1/students/${studentId.toString()}/verify`)
        .set('Cookie', [`session=${rawSessionToken}`])
        .send({
          isVerified: true,
          remarks: 'Valid marksheets',
          status: 'placed', // malicious injection
          enrollmentNumber: 'HACKED',
        });

      expect(res.status).toBe(200);
      expect(studentDoc.isVerified).toBe(true);
      expect(studentDoc.status).toBe('unplaced'); // Unchanged
      expect(studentDoc.enrollmentNumber).toBe('0101CS221001'); // Unchanged
    });

    it('status endpoint updates strictly status and preserves verification and enrollment', async () => {
      mockSession('tpo', collegeAOrgId);
      const studentId = new mongoose.Types.ObjectId();
      const studentDoc = mockStudentDoc({
        _id: studentId,
        isVerified: true,
        status: 'unplaced',
      });

      vi.spyOn(StudentProfileModel, 'findOne').mockResolvedValue(studentDoc as never);

      const res = await request(app)
        .patch(`/api/v1/students/${studentId.toString()}/status`)
        .set('Cookie', [`session=${rawSessionToken}`])
        .send({
          status: 'placed',
          isVerified: false, // malicious injection
          skills: ['HackedSkill'],
        });

      expect(res.status).toBe(200);
      expect(studentDoc.status).toBe('placed');
      expect(studentDoc.isVerified).toBe(true); // Unchanged
      expect(studentDoc.skills).toEqual(['TypeScript', 'Node.js', 'React']); // Unchanged
    });
  });
});
