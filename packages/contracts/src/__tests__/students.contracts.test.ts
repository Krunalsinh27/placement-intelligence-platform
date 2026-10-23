import { describe, it, expect } from 'vitest';
import {
  StudentProfileCreateSchema,
  StudentProfileUpdateSchema,
  StudentVerifyRequestSchema,
  StudentStatusUpdateRequestSchema,
  StudentQueryFiltersSchema,
} from '../students.js';

describe('Students Contracts', () => {
  const validObjectId = '507f1f77bcf86cd799439011';
  const validBatchObjectId = '507f1f77bcf86cd799439022';

  const baseValidStudentInput = {
    enrollmentNumber: '  0101cs221001  ',
    departmentId: validObjectId,
    batchId: validBatchObjectId,
    personalDetails: {
      firstName: 'Jane',
      lastName: 'Doe',
      email: '  Jane.Doe@EXAMPLE.EDU  ',
      phone: '+91 9876543210',
      gender: 'female' as const,
    },
    academicRecords: {
      tenthPercentage: 88.5,
      twelfthPercentage: 85.0,
      currentCgpa: 8.75,
      activeBacklogs: 0,
      historyBacklogs: 1,
      gapYears: 0,
    },
    skills: ['TypeScript', 'Node.js', 'React'],
  };

  describe('StudentProfileCreateSchema', () => {
    it('validates a valid student and normalizes enrollment and email', () => {
      const result = StudentProfileCreateSchema.safeParse(baseValidStudentInput);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.enrollmentNumber).toBe('0101CS221001');
        expect(result.data.personalDetails.email).toBe('jane.doe@example.edu');
        expect(result.data.academicRecords.currentCgpa).toBe(8.75);
        expect(result.data.academicRecords.activeBacklogs).toBe(0);
        expect(result.data.skills).toEqual(['TypeScript', 'Node.js', 'React']);
      }
    });

    it('rejects CGPA greater than 10', () => {
      const result = StudentProfileCreateSchema.safeParse({
        ...baseValidStudentInput,
        academicRecords: {
          ...baseValidStudentInput.academicRecords,
          currentCgpa: 10.5,
        },
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toMatch(/cannot exceed 10/i);
      }
    });

    it('rejects CGPA less than 0', () => {
      const result = StudentProfileCreateSchema.safeParse({
        ...baseValidStudentInput,
        academicRecords: {
          ...baseValidStudentInput.academicRecords,
          currentCgpa: -0.5,
        },
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toMatch(/cannot be less than 0/i);
      }
    });

    it('rejects percentage greater than 100', () => {
      const result = StudentProfileCreateSchema.safeParse({
        ...baseValidStudentInput,
        academicRecords: {
          ...baseValidStudentInput.academicRecords,
          tenthPercentage: 105,
        },
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toMatch(/cannot exceed 100/i);
      }
    });

    it('rejects negative active backlogs', () => {
      const result = StudentProfileCreateSchema.safeParse({
        ...baseValidStudentInput,
        academicRecords: {
          ...baseValidStudentInput.academicRecords,
          activeBacklogs: -1,
        },
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toMatch(/cannot be negative/i);
      }
    });

    it('rejects non-integer backlogs', () => {
      const result = StudentProfileCreateSchema.safeParse({
        ...baseValidStudentInput,
        academicRecords: {
          ...baseValidStudentInput.academicRecords,
          activeBacklogs: 1.5,
        },
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toMatch(/must be an integer/i);
      }
    });

    it('rejects negative gap years', () => {
      const result = StudentProfileCreateSchema.safeParse({
        ...baseValidStudentInput,
        academicRecords: {
          ...baseValidStudentInput.academicRecords,
          gapYears: -1,
        },
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toMatch(/cannot be negative/i);
      }
    });

    it('rejects invalid departmentId format', () => {
      const result = StudentProfileCreateSchema.safeParse({
        ...baseValidStudentInput,
        departmentId: 'not-a-valid-hex-id',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toMatch(/invalid department ID format/i);
      }
    });

    it('rejects invalid batchId format', () => {
      const result = StudentProfileCreateSchema.safeParse({
        ...baseValidStudentInput,
        batchId: 'invalid-id',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toMatch(/invalid batch ID format/i);
      }
    });

    it('strips client-supplied orgId and userId', () => {
      const result = StudentProfileCreateSchema.safeParse({
        ...baseValidStudentInput,
        orgId: 'attacker-supplied-org-id',
        userId: 'attacker-supplied-user-id',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.data as Record<string, unknown>)['orgId']).toBeUndefined();
        expect((result.data as Record<string, unknown>)['userId']).toBeUndefined();
      }
    });
  });

  describe('StudentProfileUpdateSchema', () => {
    it('rejects empty update payload', () => {
      const result = StudentProfileUpdateSchema.safeParse({});
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toMatch(/at least one field/i);
      }
    });

    it('accepts partial update of skills', () => {
      const result = StudentProfileUpdateSchema.safeParse({
        skills: ['Python', 'Django'],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.skills).toEqual(['Python', 'Django']);
      }
    });
  });

  describe('StudentVerifyRequestSchema', () => {
    it('validates verification with optional remarks', () => {
      const result = StudentVerifyRequestSchema.safeParse({
        isVerified: true,
        remarks: 'Original marksheets verified in person',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isVerified).toBe(true);
        expect(result.data.remarks).toBe('Original marksheets verified in person');
      }
    });
  });

  describe('StudentStatusUpdateRequestSchema', () => {
    it('validates status change to placed with optional reason', () => {
      const result = StudentStatusUpdateRequestSchema.safeParse({
        status: 'placed',
        reason: 'Accepted offer at Google',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('placed');
        expect(result.data.reason).toBe('Accepted offer at Google');
      }
    });
  });

  describe('StudentQueryFiltersSchema', () => {
    it('provides sensible defaults for pagination and sorting', () => {
      const result = StudentQueryFiltersSchema.safeParse({});

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(20);
        expect(result.data.sortBy).toBe('createdAt');
        expect(result.data.sortOrder).toBe('desc');
      }
    });

    it('coerces string numbers and booleans from URL query parameters', () => {
      const result = StudentQueryFiltersSchema.safeParse({
        page: '3',
        limit: '50',
        minCgpa: '7.5',
        maxActiveBacklogs: '0',
        isVerified: 'true',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(3);
        expect(result.data.limit).toBe(50);
        expect(result.data.minCgpa).toBe(7.5);
        expect(result.data.maxActiveBacklogs).toBe(0);
        expect(result.data.isVerified).toBe(true);
      }
    });

    it('rejects limit exceeding 100', () => {
      const result = StudentQueryFiltersSchema.safeParse({
        limit: '150',
      });

      expect(result.success).toBe(false);
    });

    it('rejects page number less than 1', () => {
      const result = StudentQueryFiltersSchema.safeParse({
        page: '0',
      });

      expect(result.success).toBe(false);
    });
  });
});
