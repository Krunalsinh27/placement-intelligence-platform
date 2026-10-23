import { describe, it, expect } from 'vitest';
import {
  DepartmentCreateSchema,
  DepartmentUpdateSchema,
  AcademicBatchCreateSchema,
  AcademicBatchUpdateSchema,
} from '../academics.js';

describe('Academics Contracts', () => {
  describe('DepartmentCreateSchema', () => {
    it('validates a correct department and normalizes code to uppercase', () => {
      const result = DepartmentCreateSchema.safeParse({
        name: 'Computer Science and Engineering',
        code: '  cse  ',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Computer Science and Engineering');
        expect(result.data.code).toBe('CSE');
        expect(result.data.status).toBe('active');
      }
    });

    it('rejects department with name shorter than 2 characters', () => {
      const result = DepartmentCreateSchema.safeParse({
        name: 'C',
        code: 'CSE',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toMatch(/at least 2 characters/i);
      }
    });

    it('rejects department with code shorter than 2 characters', () => {
      const result = DepartmentCreateSchema.safeParse({
        name: 'Computer Science',
        code: 'C',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toMatch(/at least 2 characters/i);
      }
    });

    it('rejects department with code longer than 10 characters', () => {
      const result = DepartmentCreateSchema.safeParse({
        name: 'Computer Science',
        code: 'TOOLONGDEPARTMENTCODE',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toMatch(/cannot exceed 10 characters/i);
      }
    });

    it('accepts explicit inactive status', () => {
      const result = DepartmentCreateSchema.safeParse({
        name: 'Mechanical Engineering',
        code: 'MECH',
        status: 'inactive',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('inactive');
      }
    });

    it('does not accept or include client-supplied orgId in parsed data', () => {
      const result = DepartmentCreateSchema.safeParse({
        name: 'Civil Engineering',
        code: 'CIVIL',
        orgId: 'attacker-supplied-org-id',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        // Zod strips unexpected keys from object definitions
        expect((result.data as Record<string, unknown>)['orgId']).toBeUndefined();
      }
    });
  });

  describe('DepartmentUpdateSchema', () => {
    it('rejects empty update payload', () => {
      const result = DepartmentUpdateSchema.safeParse({});
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toMatch(/at least one field/i);
      }
    });

    it('accepts updating name only', () => {
      const result = DepartmentUpdateSchema.safeParse({
        name: 'Information Technology',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Information Technology');
      }
    });

    it('normalizes code on update', () => {
      const result = DepartmentUpdateSchema.safeParse({
        code: ' it ',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.code).toBe('IT');
      }
    });
  });

  describe('AcademicBatchCreateSchema', () => {
    it('validates a valid batch and defaults status to active', () => {
      const result = AcademicBatchCreateSchema.safeParse({
        name: '2022-2026',
        startYear: 2022,
        graduationYear: 2026,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('2022-2026');
        expect(result.data.startYear).toBe(2022);
        expect(result.data.graduationYear).toBe(2026);
        expect(result.data.status).toBe('active');
      }
    });

    it('rejects batch when graduationYear is before startYear', () => {
      const result = AcademicBatchCreateSchema.safeParse({
        name: 'Invalid Batch',
        startYear: 2026,
        graduationYear: 2022,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toMatch(
          /graduation year must be greater than or equal to start year/i
        );
      }
    });

    it('rejects non-integer startYear', () => {
      const result = AcademicBatchCreateSchema.safeParse({
        name: 'Batch 2025',
        startYear: 2022.5,
        graduationYear: 2026,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toMatch(/must be an integer/i);
      }
    });

    it('rejects years outside allowable bounds', () => {
      const result = AcademicBatchCreateSchema.safeParse({
        name: 'Ancient Batch',
        startYear: 1850,
        graduationYear: 1854,
      });

      expect(result.success).toBe(false);
    });

    it('does not accept or include client-supplied orgId in parsed data', () => {
      const result = AcademicBatchCreateSchema.safeParse({
        name: '2023-2027',
        startYear: 2023,
        graduationYear: 2027,
        orgId: 'attacker-supplied-org-id',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.data as Record<string, unknown>)['orgId']).toBeUndefined();
      }
    });
  });

  describe('AcademicBatchUpdateSchema', () => {
    it('rejects empty batch update payload', () => {
      const result = AcademicBatchUpdateSchema.safeParse({});
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toMatch(/at least one field/i);
      }
    });

    it('rejects update if provided graduationYear is before startYear', () => {
      const result = AcademicBatchUpdateSchema.safeParse({
        startYear: 2026,
        graduationYear: 2022,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toMatch(
          /graduation year must be greater than or equal to start year/i
        );
      }
    });

    it('accepts partial update of status only', () => {
      const result = AcademicBatchUpdateSchema.safeParse({
        status: 'graduated',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('graduated');
      }
    });
  });
});
