import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  listStudents,
  getStudentById,
  createStudent,
  updateStudent,
  verifyStudent,
  updateStudentStatus,
  buildStudentQueryString,
} from '../api/students.js';
import type {
  StudentProfileResponse,
  PaginatedStudentListResponse,
  StudentProfileCreateInput,
  StudentProfileUpdateInput,
  StudentQueryFilters,
} from '@placement-platform/contracts';

describe('Frontend Student API Client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockStudentResponse: StudentProfileResponse = {
    id: 'student-1',
    orgId: 'org-1',
    userId: null,
    enrollmentNumber: 'EN2026001',
    departmentId: '507f1f77bcf86cd799439011',
    batchId: '507f1f77bcf86cd799439012',
    personalDetails: {
      firstName: 'Rahul',
      lastName: 'Sharma',
      email: 'rahul.sharma@college.edu',
      phone: '+919876543210',
      gender: 'male',
      dob: '2004-05-15T00:00:00.000Z',
    },
    academicRecords: {
      tenthPercentage: 88.5,
      twelfthPercentage: 86.0,
      diplomaPercentage: null,
      currentCgpa: 8.45,
      activeBacklogs: 0,
      historyBacklogs: 0,
      gapYears: 0,
    },
    skills: ['JavaScript', 'TypeScript', 'React'],
    status: 'unplaced',
    isVerified: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  // ─── Query String Serialization ───────────────────────────────────────────

  describe('buildStudentQueryString()', () => {
    it('returns empty string when no filters or empty object passed', () => {
      expect(buildStudentQueryString()).toBe('');
      expect(buildStudentQueryString({})).toBe('');
    });

    it('serializes pagination and search parameters', () => {
      const qs = buildStudentQueryString({
        page: 2,
        limit: 15,
        search: 'Rahul',
      });
      expect(qs).toBe('?page=2&limit=15&search=Rahul');
    });

    it('serializes academic filters and handles falsy zero values properly', () => {
      const qs = buildStudentQueryString({
        departmentId: '507f1f77bcf86cd799439011',
        batchId: '507f1f77bcf86cd799439012',
        minCgpa: 0,
        maxActiveBacklogs: 0,
        status: 'unplaced',
        isVerified: false,
      });

      expect(qs).toContain('departmentId=507f1f77bcf86cd799439011');
      expect(qs).toContain('batchId=507f1f77bcf86cd799439012');
      expect(qs).toContain('minCgpa=0');
      expect(qs).toContain('maxActiveBacklogs=0');
      expect(qs).toContain('status=unplaced');
      expect(qs).toContain('isVerified=false');
    });

    it('serializes sorting parameters', () => {
      const qs = buildStudentQueryString({
        sortBy: 'currentCgpa',
        sortOrder: 'asc',
      });
      expect(qs).toBe('?sortBy=currentCgpa&sortOrder=asc');
    });

    it('ignores unsupported or unauthorized keys such as orgId and userId', () => {
      const dirtyFilters = {
        page: 1,
        orgId: 'malicious-org',
        userId: 'malicious-user',
      } as unknown as Partial<StudentQueryFilters>;

      const qs = buildStudentQueryString(dirtyFilters);
      expect(qs).toBe('?page=1');
      expect(qs).not.toContain('orgId');
      expect(qs).not.toContain('userId');
    });
  });

  // ─── List Students ────────────────────────────────────────────────────────

  describe('listStudents()', () => {
    it('sends GET /api/v1/students with credentials: "include" and returns paginated result', async () => {
      const mockPaginated: PaginatedStudentListResponse = {
        items: [mockStudentResponse],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: mockPaginated,
          meta: { requestId: 'req-stud-1' },
        }),
      } as Response);

      const result = await listStudents();

      expect(result).toEqual(mockPaginated);
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/v1/students',
        expect.objectContaining({
          method: 'GET',
          credentials: 'include',
        })
      );
    });

    it('appends serialized query parameters to GET /api/v1/students', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: { items: [], total: 0, page: 1, limit: 10, totalPages: 0 },
          meta: { requestId: 'req-stud-2' },
        }),
      } as Response);

      await listStudents({ page: 2, limit: 10, isVerified: true });

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/v1/students?page=2&limit=10&isVerified=true',
        expect.objectContaining({
          method: 'GET',
          credentials: 'include',
        })
      );
    });
  });

  // ─── Get Student By ID ────────────────────────────────────────────────────

  describe('getStudentById()', () => {
    it('sends GET /api/v1/students/:id with credentials: "include" and encodes id', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: mockStudentResponse,
          meta: { requestId: 'req-stud-3' },
        }),
      } as Response);

      const result = await getStudentById('student-1');

      expect(result).toEqual(mockStudentResponse);
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/v1/students/student-1',
        expect.objectContaining({
          method: 'GET',
          credentials: 'include',
        })
      );
    });
  });

  // ─── Create Student Profile ───────────────────────────────────────────────

  describe('createStudent()', () => {
    const validCreateInput: StudentProfileCreateInput = {
      enrollmentNumber: 'EN2026001',
      departmentId: '507f1f77bcf86cd799439011',
      batchId: '507f1f77bcf86cd799439012',
      personalDetails: {
        firstName: 'Rahul',
        lastName: 'Sharma',
        email: 'rahul.sharma@college.edu',
        phone: '+919876543210',
        gender: 'male',
      },
      academicRecords: {
        tenthPercentage: 88.5,
        currentCgpa: 8.45,
        activeBacklogs: 0,
        historyBacklogs: 0,
        gapYears: 0,
      },
      skills: ['TypeScript', 'React'],
    };

    it('sends POST /api/v1/students with credentials: "include" and JSON body', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({
          data: mockStudentResponse,
          meta: { requestId: 'req-stud-4' },
        }),
      } as Response);

      const result = await createStudent(validCreateInput);

      expect(result).toEqual(mockStudentResponse);
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/v1/students',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(validCreateInput),
        })
      );
    });

    it('strips orgId and userId if injected to protect server-side tenant scoping', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({
          data: mockStudentResponse,
          meta: { requestId: 'req-stud-5' },
        }),
      } as Response);

      const taintedInput = {
        ...validCreateInput,
        orgId: 'attacker-org-id',
        userId: 'attacker-user-id',
      };

      await createStudent(taintedInput as unknown as StudentProfileCreateInput);

      const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0]!;
      const parsedBody = JSON.parse(fetchCall[1]?.body as string);
      expect(parsedBody.orgId).toBeUndefined();
      expect(parsedBody.userId).toBeUndefined();
      expect(parsedBody.enrollmentNumber).toBe('EN2026001');
    });
  });

  // ─── Update Student Profile ───────────────────────────────────────────────

  describe('updateStudent()', () => {
    it('sends PUT /api/v1/students/:id with credentials: "include" and JSON body', async () => {
      const updatedMock: StudentProfileResponse = {
        ...mockStudentResponse,
        skills: ['TypeScript', 'React', 'Node.js'],
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: updatedMock,
          meta: { requestId: 'req-stud-6' },
        }),
      } as Response);

      const result = await updateStudent('student-1', {
        skills: ['TypeScript', 'React', 'Node.js'],
      });

      expect(result).toEqual(updatedMock);
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/v1/students/student-1',
        expect.objectContaining({
          method: 'PUT',
          credentials: 'include',
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            skills: ['TypeScript', 'React', 'Node.js'],
          }),
        })
      );
    });

    it('strips orgId, userId, and enrollmentNumber from update body', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: mockStudentResponse,
          meta: { requestId: 'req-stud-7' },
        }),
      } as Response);

      const taintedUpdate = {
        skills: ['Python'],
        orgId: 'other-org',
        userId: 'other-user',
        enrollmentNumber: 'TAMPERED',
      };

      await updateStudent('student-1', taintedUpdate as unknown as StudentProfileUpdateInput);

      const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0]!;
      const parsedBody = JSON.parse(fetchCall[1]?.body as string);
      expect(parsedBody.orgId).toBeUndefined();
      expect(parsedBody.userId).toBeUndefined();
      expect(parsedBody.enrollmentNumber).toBeUndefined();
      expect(parsedBody.skills).toEqual(['Python']);
    });
  });

  // ─── Verify Student Profile ───────────────────────────────────────────────

  describe('verifyStudent()', () => {
    it('sends PATCH /api/v1/students/:id/verify with verification payload', async () => {
      const verifiedStudent: StudentProfileResponse = {
        ...mockStudentResponse,
        isVerified: true,
        verificationDetails: {
          verifiedBy: 'coordinator-user-1',
          verifiedAt: '2026-01-02T00:00:00.000Z',
          remarks: 'Verified against original marksheet.',
        },
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: verifiedStudent,
          meta: { requestId: 'req-stud-8' },
        }),
      } as Response);

      const result = await verifyStudent('student-1', {
        isVerified: true,
        remarks: 'Verified against original marksheet.',
      });

      expect(result).toEqual(verifiedStudent);
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/v1/students/student-1/verify',
        expect.objectContaining({
          method: 'PATCH',
          credentials: 'include',
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            isVerified: true,
            remarks: 'Verified against original marksheet.',
          }),
        })
      );
    });
  });

  // ─── Update Student Status ────────────────────────────────────────────────

  describe('updateStudentStatus()', () => {
    it('sends PATCH /api/v1/students/:id/status with status payload', async () => {
      const placedStudent: StudentProfileResponse = {
        ...mockStudentResponse,
        status: 'placed',
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: placedStudent,
          meta: { requestId: 'req-stud-9' },
        }),
      } as Response);

      const result = await updateStudentStatus('student-1', {
        status: 'placed',
        reason: 'Selected in campus placement drive at TechCorp.',
      });

      expect(result).toEqual(placedStudent);
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/v1/students/student-1/status',
        expect.objectContaining({
          method: 'PATCH',
          credentials: 'include',
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            status: 'placed',
            reason: 'Selected in campus placement drive at TechCorp.',
          }),
        })
      );
    });
  });

  // ─── Error Handling ────────────────────────────────────────────────────────

  describe('Error handling', () => {
    it('throws ApiError on HTTP 401 unauthenticated response', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required. Please sign in.',
          },
        }),
      } as Response);

      await expect(listStudents()).rejects.toMatchObject({
        statusCode: 401,
        code: 'UNAUTHORIZED',
        message: 'Authentication required. Please sign in.',
      });
    });

    it('throws ApiError on HTTP 403 COORDINATOR_SCOPE_VIOLATION', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({
          error: {
            code: 'COORDINATOR_SCOPE_VIOLATION',
            message: 'You can only view or verify students in your assigned department.',
          },
        }),
      } as Response);

      await expect(getStudentById('foreign-dept-student')).rejects.toMatchObject({
        statusCode: 403,
        code: 'COORDINATOR_SCOPE_VIOLATION',
        message: 'You can only view or verify students in your assigned department.',
      });
    });

    it('throws ApiError on HTTP 404 STUDENT_NOT_FOUND', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({
          error: {
            code: 'STUDENT_NOT_FOUND',
            message: 'Student profile not found.',
          },
        }),
      } as Response);

      await expect(getStudentById('missing-student')).rejects.toMatchObject({
        statusCode: 404,
        code: 'STUDENT_NOT_FOUND',
      });
    });

    it('throws ApiError on HTTP 409 DUPLICATE_RESOURCE for duplicate enrollment number', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({
          error: {
            code: 'DUPLICATE_RESOURCE',
            message:
              'Student profile with enrollment number EN2026001 already exists in this college.',
          },
        }),
      } as Response);

      await expect(
        createStudent({
          enrollmentNumber: 'EN2026001',
          departmentId: '507f1f77bcf86cd799439011',
          batchId: '507f1f77bcf86cd799439012',
          personalDetails: {
            firstName: 'A',
            lastName: 'B',
            email: 'a.b@college.edu',
            phone: '12345678',
            gender: 'other',
          },
          academicRecords: {
            tenthPercentage: 80,
            currentCgpa: 8,
            activeBacklogs: 0,
            historyBacklogs: 0,
            gapYears: 0,
          },
          skills: [],
        })
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'DUPLICATE_RESOURCE',
        message: 'Student profile with enrollment number EN2026001 already exists in this college.',
      });
    });

    it('throws ApiError on HTTP 400 VALIDATION_ERROR with field details', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request payload.',
            details: [{ path: 'academicRecords.currentCgpa', issue: 'CGPA cannot exceed 10' }],
          },
        }),
      } as Response);

      await expect(
        updateStudent('student-1', {
          academicRecords: { currentCgpa: 15 },
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        details: [{ path: 'academicRecords.currentCgpa', issue: 'CGPA cannot exceed 10' }],
      });
    });

    it('throws ApiError on network offline with code NETWORK_ERROR and statusCode 0', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

      await expect(listStudents()).rejects.toMatchObject({
        statusCode: 0,
        code: 'NETWORK_ERROR',
        message: 'Unable to connect to the API server. Please check your network connection.',
      });
    });
  });
});
