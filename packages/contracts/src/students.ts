import { z } from 'zod';

// ─── Enums & Sub-schemas ────────────────────────────────────────────────────

export const StudentStatusSchema = z.enum([
  'unplaced',
  'placed',
  'opted_out',
  'blocked',
]);
export type StudentStatus = z.infer<typeof StudentStatusSchema>;

export const StudentGenderSchema = z.enum([
  'male',
  'female',
  'other',
  'prefer_not_to_say',
]);
export type StudentGender = z.infer<typeof StudentGenderSchema>;

/**
 * Normalizes enrollment number by trimming whitespace and converting to uppercase.
 */
export const EnrollmentNumberSchema = z
  .string()
  .trim()
  .min(1, 'Enrollment number is required')
  .max(50, 'Enrollment number cannot exceed 50 characters')
  .transform((val) => val.toUpperCase());

export const StudentPersonalDetailsSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, 'First name is required')
    .max(100, 'First name cannot exceed 100 characters'),
  lastName: z
    .string()
    .trim()
    .min(1, 'Last name is required')
    .max(100, 'Last name cannot exceed 100 characters'),
  email: z
    .string()
    .trim()
    .email('Please enter a valid email address')
    .transform((val) => val.toLowerCase()),
  phone: z
    .string()
    .trim()
    .min(7, 'Phone number must be at least 7 characters')
    .max(20, 'Phone number cannot exceed 20 characters'),
  gender: StudentGenderSchema,
  dob: z.string().datetime().optional().nullable(),
});
export type StudentPersonalDetails = z.infer<typeof StudentPersonalDetailsSchema>;

export const StudentAcademicRecordsSchema = z.object({
  tenthPercentage: z
    .number()
    .min(0, '10th percentage cannot be less than 0')
    .max(100, '10th percentage cannot exceed 100'),
  twelfthPercentage: z
    .number()
    .min(0, '12th percentage cannot be less than 0')
    .max(100, '12th percentage cannot exceed 100')
    .optional()
    .nullable(),
  diplomaPercentage: z
    .number()
    .min(0, 'Diploma percentage cannot be less than 0')
    .max(100, 'Diploma percentage cannot exceed 100')
    .optional()
    .nullable(),
  currentCgpa: z
    .number()
    .min(0, 'CGPA cannot be less than 0')
    .max(10, 'CGPA cannot exceed 10'),
  activeBacklogs: z
    .number()
    .int('Active backlogs must be an integer')
    .min(0, 'Active backlogs cannot be negative')
    .default(0),
  historyBacklogs: z
    .number()
    .int('History backlogs must be an integer')
    .min(0, 'History backlogs cannot be negative')
    .default(0),
  gapYears: z
    .number()
    .int('Gap years must be an integer')
    .min(0, 'Gap years cannot be negative')
    .default(0),
});
export type StudentAcademicRecords = z.infer<typeof StudentAcademicRecordsSchema>;

// ─── Student Profile Create / Update Schemas (Client-Facing: No orgId) ───────

export const StudentProfileCreateSchema = z.object({
  enrollmentNumber: EnrollmentNumberSchema,
  departmentId: z
    .string()
    .trim()
    .min(1, 'Department ID is required')
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid department ID format'),
  batchId: z
    .string()
    .trim()
    .min(1, 'Batch ID is required')
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid batch ID format'),
  personalDetails: StudentPersonalDetailsSchema,
  academicRecords: StudentAcademicRecordsSchema,
  skills: z
    .array(z.string().trim().min(1, 'Skill cannot be empty'))
    .default([]),
});
export type StudentProfileCreateInput = z.infer<typeof StudentProfileCreateSchema>;

export const StudentProfileUpdateSchema = z
  .object({
    departmentId: z
      .string()
      .trim()
      .regex(/^[0-9a-fA-F]{24}$/, 'Invalid department ID format')
      .optional(),
    batchId: z
      .string()
      .trim()
      .regex(/^[0-9a-fA-F]{24}$/, 'Invalid batch ID format')
      .optional(),
    personalDetails: StudentPersonalDetailsSchema.partial().optional(),
    academicRecords: StudentAcademicRecordsSchema.partial().optional(),
    skills: z
      .array(z.string().trim().min(1, 'Skill cannot be empty'))
      .optional(),
  })
  .refine(
    (data) =>
      data.departmentId !== undefined ||
      data.batchId !== undefined ||
      data.personalDetails !== undefined ||
      data.academicRecords !== undefined ||
      data.skills !== undefined,
    {
      message: 'At least one field must be provided for update',
    }
  );
export type StudentProfileUpdateInput = z.infer<typeof StudentProfileUpdateSchema>;

export const StudentVerifyRequestSchema = z.object({
  isVerified: z.boolean(),
  remarks: z.string().trim().max(500, 'Remarks cannot exceed 500 characters').optional(),
});
export type StudentVerifyRequest = z.infer<typeof StudentVerifyRequestSchema>;

export const StudentStatusUpdateRequestSchema = z.object({
  status: StudentStatusSchema,
  reason: z.string().trim().max(500, 'Reason cannot exceed 500 characters').optional(),
});
export type StudentStatusUpdateRequest = z.infer<typeof StudentStatusUpdateRequestSchema>;

// ─── Query Filter & Pagination Schema ───────────────────────────────────────

export const StudentQueryFiltersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  departmentId: z
    .string()
    .trim()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid department ID format')
    .optional(),
  batchId: z
    .string()
    .trim()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid batch ID format')
    .optional(),
  status: StudentStatusSchema.optional(),
  minCgpa: z.coerce.number().min(0).max(10).optional(),
  maxActiveBacklogs: z.coerce.number().int().min(0).optional(),
  isVerified: z
    .preprocess((val) => {
      if (val === 'true' || val === true) return true;
      if (val === 'false' || val === false) return false;
      return undefined;
    }, z.boolean().optional()),
  sortBy: z
    .enum(['name', 'enrollmentNumber', 'currentCgpa', 'createdAt'])
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
export type StudentQueryFilters = z.infer<typeof StudentQueryFiltersSchema>;

// ─── Response Schemas ───────────────────────────────────────────────────────

export const StudentVerificationDetailsSchema = z.object({
  verifiedBy: z.string().optional(),
  verifiedAt: z.string().datetime().optional(),
  remarks: z.string().optional(),
});
export type StudentVerificationDetails = z.infer<typeof StudentVerificationDetailsSchema>;

export const StudentProfileResponseSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  userId: z.string().nullable().optional(),
  enrollmentNumber: z.string(),
  departmentId: z.string(),
  batchId: z.string(),
  personalDetails: StudentPersonalDetailsSchema,
  academicRecords: StudentAcademicRecordsSchema,
  skills: z.array(z.string()),
  status: StudentStatusSchema,
  isVerified: z.boolean(),
  verificationDetails: StudentVerificationDetailsSchema.optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type StudentProfileResponse = z.infer<typeof StudentProfileResponseSchema>;

export const PaginatedStudentListResponseSchema = z.object({
  items: z.array(StudentProfileResponseSchema),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  limit: z.number().int().min(1),
  totalPages: z.number().int().min(0),
});
export type PaginatedStudentListResponse = z.infer<typeof PaginatedStudentListResponseSchema>;
