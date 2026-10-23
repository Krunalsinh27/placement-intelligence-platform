import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  StudentProfileCreateSchema,
  StudentProfileUpdateSchema,
  StudentVerifyRequestSchema,
  StudentStatusUpdateRequestSchema,
} from '@placement-platform/contracts';
import { createStudent, verifyStudent, buildStudentQueryString } from '../api/students.js';
import {
  canCreateOrEditStudents,
  canVerifyStudents,
  canUpdateStudentStatus,
} from '../utils/permissions.js';

describe('Student Management UI Logic & Validation (Step 7)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const validStudentInput = {
    enrollmentNumber: 'en2026001',
    departmentId: '507f1f77bcf86cd799439011',
    batchId: '507f1f77bcf86cd799439012',
    personalDetails: {
      firstName: 'Aarav',
      lastName: 'Patel',
      email: 'aarav.patel@college.edu',
      phone: '+919876543210',
      gender: 'male' as const,
      dob: '2004-06-12T00:00:00.000Z',
    },
    academicRecords: {
      tenthPercentage: 88.5,
      twelfthPercentage: 84.0,
      diplomaPercentage: null,
      currentCgpa: 8.75,
      activeBacklogs: 0,
      historyBacklogs: 0,
      gapYears: 0,
    },
    skills: ['TypeScript', 'React', 'MongoDB'],
  };

  // ─── Student Profile Create Form Validation ───────────────────────────────

  describe('Student Create Form Validation', () => {
    it('accepts valid student payload and normalizes enrollment number to uppercase', () => {
      const result = StudentProfileCreateSchema.safeParse(validStudentInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.enrollmentNumber).toBe('EN2026001');
        expect(result.data.personalDetails.email).toBe('aarav.patel@college.edu');
      }
    });

    it('rejects CGPA greater than 10', () => {
      const result = StudentProfileCreateSchema.safeParse({
        ...validStudentInput,
        academicRecords: {
          ...validStudentInput.academicRecords,
          currentCgpa: 11.5,
        },
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path.includes('currentCgpa'));
        expect(issue?.message).toContain('cannot exceed 10');
      }
    });

    it('rejects negative active backlogs', () => {
      const result = StudentProfileCreateSchema.safeParse({
        ...validStudentInput,
        academicRecords: {
          ...validStudentInput.academicRecords,
          activeBacklogs: -1,
        },
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path.includes('activeBacklogs'));
        expect(issue?.message).toContain('cannot be negative');
      }
    });

    it('rejects invalid email format', () => {
      const result = StudentProfileCreateSchema.safeParse({
        ...validStudentInput,
        personalDetails: {
          ...validStudentInput.personalDetails,
          email: 'not-an-email',
        },
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path.includes('email'));
        expect(issue?.message).toContain('valid email address');
      }
    });
  });

  // ─── Student Update Form Validation ───────────────────────────────────────

  describe('Student Update Form Validation', () => {
    it('allows updating partial fields without re-sending the whole profile', () => {
      const result = StudentProfileUpdateSchema.safeParse({
        skills: ['Rust', 'Go'],
        academicRecords: {
          currentCgpa: 9.1,
        },
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.skills).toEqual(['Rust', 'Go']);
        expect(result.data.academicRecords?.currentCgpa).toBe(9.1);
      }
    });

    it('rejects empty update payload (must provide at least one field)', () => {
      const result = StudentProfileUpdateSchema.safeParse({});
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain(
          'At least one field must be provided for update'
        );
      }
    });
  });

  // ─── Verification & Status Modals Validation ──────────────────────────────

  describe('Verification & Status Modals', () => {
    it('validates verification request with optional remarks', () => {
      const result = StudentVerifyRequestSchema.safeParse({
        isVerified: true,
        remarks: 'Original marksheets verified in person.',
      });

      expect(result.success).toBe(true);
    });

    it('rejects remarks longer than 500 characters', () => {
      const longRemarks = 'A'.repeat(501);
      const result = StudentVerifyRequestSchema.safeParse({
        isVerified: true,
        remarks: longRemarks,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain('cannot exceed 500 characters');
      }
    });

    it('validates status update with valid placement status', () => {
      const result = StudentStatusUpdateRequestSchema.safeParse({
        status: 'placed',
        reason: 'Selected as SDE-1 at Amazon.',
      });

      expect(result.success).toBe(true);
    });

    it('rejects invalid status values', () => {
      const result = StudentStatusUpdateRequestSchema.safeParse({
        status: 'graduated_not_supported',
      });

      expect(result.success).toBe(false);
    });
  });

  // ─── Query Filters & Pagination Math ──────────────────────────────────────

  describe('UI Pagination & Filter Calculations', () => {
    it('calculates page range numbers correctly', () => {
      const total = 45;
      const limit = 20;
      const page1Start = (1 - 1) * limit + 1;
      const page1End = Math.min(1 * limit, total);
      expect(page1Start).toBe(1);
      expect(page1End).toBe(20);

      const page3Start = (3 - 1) * limit + 1;
      const page3End = Math.min(3 * limit, total);
      expect(page3Start).toBe(41);
      expect(page3End).toBe(45);
    });

    it('builds comprehensive query string with all UI filter criteria', () => {
      const qs = buildStudentQueryString({
        page: 2,
        limit: 20,
        search: 'Rahul',
        departmentId: '507f1f77bcf86cd799439011',
        status: 'unplaced',
        isVerified: true,
        minCgpa: 7.5,
        maxActiveBacklogs: 0,
        sortBy: 'currentCgpa',
        sortOrder: 'desc',
      });

      expect(qs).toContain('page=2');
      expect(qs).toContain('limit=20');
      expect(qs).toContain('search=Rahul');
      expect(qs).toContain('departmentId=507f1f77bcf86cd799439011');
      expect(qs).toContain('status=unplaced');
      expect(qs).toContain('isVerified=true');
      expect(qs).toContain('minCgpa=7.5');
      expect(qs).toContain('maxActiveBacklogs=0');
      expect(qs).toContain('sortBy=currentCgpa');
      expect(qs).toContain('sortOrder=desc');
    });
  });

  // ─── Role-Gated Action UI Scenarios ───────────────────────────────────────

  describe('Coordinator Scoped UI Scenarios', () => {
    it('coordinator can verify students but cannot create students or change placement status', () => {
      const coordinatorRole = 'dept_coordinator' as const;

      expect(canVerifyStudents(coordinatorRole)).toBe(true);
      expect(canCreateOrEditStudents(coordinatorRole)).toBe(false);
      expect(canUpdateStudentStatus(coordinatorRole)).toBe(false);
    });

    it('college_admin and tpo can perform all student management actions', () => {
      for (const adminRole of ['college_admin', 'tpo'] as const) {
        expect(canCreateOrEditStudents(adminRole)).toBe(true);
        expect(canVerifyStudents(adminRole)).toBe(true);
        expect(canUpdateStudentStatus(adminRole)).toBe(true);
      }
    });

    it('handles 409 conflict when duplicate enrollment number is submitted', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({
          error: {
            code: 'DUPLICATE_RESOURCE',
            message:
              'Student profile with enrollment number EN2026001 already exists in this college.',
            requestId: 'req-dup-enrollment',
          },
        }),
      } as Response);

      await expect(createStudent(validStudentInput)).rejects.toMatchObject({
        statusCode: 409,
        code: 'DUPLICATE_RESOURCE',
        message: 'Student profile with enrollment number EN2026001 already exists in this college.',
      });
    });

    it('handles 403 coordinator scope violation error', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({
          error: {
            code: 'COORDINATOR_SCOPE_VIOLATION',
            message: 'You can only view or verify students in your assigned department.',
            requestId: 'req-scope',
          },
        }),
      } as Response);

      await expect(verifyStudent('foreign-student-id', { isVerified: true })).rejects.toMatchObject(
        {
          statusCode: 403,
          code: 'COORDINATOR_SCOPE_VIOLATION',
        }
      );
    });
  });
});
