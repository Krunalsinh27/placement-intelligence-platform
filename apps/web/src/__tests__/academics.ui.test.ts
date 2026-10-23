import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  DepartmentCreateSchema,
  DepartmentUpdateSchema,
  AcademicBatchCreateSchema,
  AcademicBatchUpdateSchema,
} from '@placement-platform/contracts';
import { listDepartments, createDepartment, updateBatch } from '../api/academics.js';

describe('Academic Management UI Logic & Validation (Step 7)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ─── Department Form Validation ───────────────────────────────────────────

  describe('Department Form Validation', () => {
    it('accepts valid department input and converts code to uppercase', () => {
      const result = DepartmentCreateSchema.safeParse({
        name: 'Computer Science and Engineering',
        code: 'cse',
        status: 'active',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.code).toBe('CSE');
        expect(result.data.name).toBe('Computer Science and Engineering');
      }
    });

    it('rejects department names shorter than 2 characters', () => {
      const result = DepartmentCreateSchema.safeParse({
        name: 'A',
        code: 'CSE',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const nameIssue = result.error.issues.find((i) => i.path[0] === 'name');
        expect(nameIssue?.message).toContain('at least 2 characters');
      }
    });

    it('rejects department codes longer than 10 characters', () => {
      const result = DepartmentCreateSchema.safeParse({
        name: 'Electronics and Communication',
        code: 'TOOLONGENGINEERING',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const codeIssue = result.error.issues.find((i) => i.path[0] === 'code');
        expect(codeIssue?.message).toContain('cannot exceed 10 characters');
      }
    });

    it('requires at least one field for department update', () => {
      const result = DepartmentUpdateSchema.safeParse({});
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain(
          'At least one field must be provided for update'
        );
      }
    });
  });

  // ─── Academic Batch Form Validation ───────────────────────────────────────

  describe('Academic Batch Form Validation', () => {
    it('accepts valid cohort years when graduationYear >= startYear', () => {
      const result = AcademicBatchCreateSchema.safeParse({
        name: 'Class of 2026',
        startYear: 2022,
        graduationYear: 2026,
        status: 'active',
      });

      expect(result.success).toBe(true);
    });

    it('rejects batch creation when graduationYear is earlier than startYear', () => {
      const result = AcademicBatchCreateSchema.safeParse({
        name: 'Invalid Batch',
        startYear: 2026,
        graduationYear: 2022,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const gradIssue = result.error.issues.find((i) => i.path[0] === 'graduationYear');
        expect(gradIssue?.message).toContain(
          'Graduation year must be greater than or equal to start year'
        );
      }
    });

    it('rejects years outside the 1990–2100 bounds', () => {
      const result = AcademicBatchCreateSchema.safeParse({
        name: 'Ancient Batch',
        startYear: 1800,
        graduationYear: 1804,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const startIssue = result.error.issues.find((i) => i.path[0] === 'startYear');
        expect(startIssue?.message).toContain('1990 or later');
      }
    });

    it('validates batch update when changing only status', () => {
      const result = AcademicBatchUpdateSchema.safeParse({
        status: 'graduated',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('graduated');
      }
    });
  });

  // ─── Academic UI Data Fetching & Error Handling ───────────────────────────

  describe('Academic UI Data Operations', () => {
    it('loads department list for UI rendering', async () => {
      const mockDepts = [
        {
          id: 'dept-1',
          orgId: 'org-1',
          name: 'Computer Science',
          code: 'CS',
          status: 'active' as const,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ];

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: mockDepts, meta: { requestId: 'req-1' } }),
      } as Response);

      const depts = await listDepartments();
      expect(depts).toHaveLength(1);
      expect(depts[0]?.code).toBe('CS');
    });

    it('handles 409 duplicate department code error cleanly for UI display', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({
          error: {
            code: 'DUPLICATE_RESOURCE',
            message: 'Department with code CS already exists in this college.',
            requestId: 'req-dup',
          },
        }),
      } as Response);

      await expect(createDepartment({ name: 'Computer Science', code: 'CS' })).rejects.toThrow(
        'Department with code CS already exists in this college.'
      );
    });

    it('handles 404 batch not found error during edit submission', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({
          error: {
            code: 'BATCH_NOT_FOUND',
            message: 'Academic batch not found.',
            requestId: 'req-404',
          },
        }),
      } as Response);

      await expect(updateBatch('nonexistent-batch-id', { name: 'New Name' })).rejects.toThrow(
        'Academic batch not found.'
      );
    });
  });
});
