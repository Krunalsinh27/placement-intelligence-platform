import { z } from 'zod';

// ─── Department Contracts ───────────────────────────────────────────────────

export const DepartmentStatusSchema = z.enum(['active', 'inactive']);
export type DepartmentStatus = z.infer<typeof DepartmentStatusSchema>;

export const DepartmentCodeSchema = z
  .string()
  .trim()
  .min(2, 'Department code must be at least 2 characters')
  .max(10, 'Department code cannot exceed 10 characters')
  .transform((val) => val.toUpperCase());

export const DepartmentCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Department name must be at least 2 characters')
    .max(100, 'Department name cannot exceed 100 characters'),
  code: DepartmentCodeSchema,
  status: DepartmentStatusSchema.default('active').optional(),
});
export type DepartmentCreateInput = z.infer<typeof DepartmentCreateSchema>;

export const DepartmentUpdateSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Department name must be at least 2 characters')
      .max(100, 'Department name cannot exceed 100 characters')
      .optional(),
    code: DepartmentCodeSchema.optional(),
    status: DepartmentStatusSchema.optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined || data.code !== undefined || data.status !== undefined,
    {
      message: 'At least one field must be provided for update',
    }
  );
export type DepartmentUpdateInput = z.infer<typeof DepartmentUpdateSchema>;

export const DepartmentResponseSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  name: z.string(),
  code: z.string(),
  status: DepartmentStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type DepartmentResponse = z.infer<typeof DepartmentResponseSchema>;

// ─── Academic Batch Contracts ───────────────────────────────────────────────

export const AcademicBatchStatusSchema = z.enum(['active', 'graduated', 'archived']);
export type AcademicBatchStatus = z.infer<typeof AcademicBatchStatusSchema>;

export const AcademicBatchCreateSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Batch name must be at least 2 characters')
      .max(100, 'Batch name cannot exceed 100 characters'),
    startYear: z
      .number()
      .int('Start year must be an integer')
      .min(1990, 'Start year must be 1990 or later')
      .max(2100, 'Start year must be 2100 or earlier'),
    graduationYear: z
      .number()
      .int('Graduation year must be an integer')
      .min(1990, 'Graduation year must be 1990 or later')
      .max(2100, 'Graduation year must be 2100 or earlier'),
    status: AcademicBatchStatusSchema.default('active').optional(),
  })
  .refine((data) => data.graduationYear >= data.startYear, {
    message: 'Graduation year must be greater than or equal to start year',
    path: ['graduationYear'],
  });
export type AcademicBatchCreateInput = z.infer<typeof AcademicBatchCreateSchema>;

export const AcademicBatchUpdateSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Batch name must be at least 2 characters')
      .max(100, 'Batch name cannot exceed 100 characters')
      .optional(),
    startYear: z
      .number()
      .int('Start year must be an integer')
      .min(1990, 'Start year must be 1990 or later')
      .max(2100, 'Start year must be 2100 or earlier')
      .optional(),
    graduationYear: z
      .number()
      .int('Graduation year must be an integer')
      .min(1990, 'Graduation year must be 1990 or later')
      .max(2100, 'Graduation year must be 2100 or earlier')
      .optional(),
    status: AcademicBatchStatusSchema.optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.startYear !== undefined ||
      data.graduationYear !== undefined ||
      data.status !== undefined,
    {
      message: 'At least one field must be provided for update',
    }
  )
  .refine(
    (data) => {
      if (data.startYear !== undefined && data.graduationYear !== undefined) {
        return data.graduationYear >= data.startYear;
      }
      return true;
    },
    {
      message: 'Graduation year must be greater than or equal to start year',
      path: ['graduationYear'],
    }
  );
export type AcademicBatchUpdateInput = z.infer<typeof AcademicBatchUpdateSchema>;

export const AcademicBatchResponseSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  name: z.string(),
  startYear: z.number(),
  graduationYear: z.number(),
  status: AcademicBatchStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AcademicBatchResponse = z.infer<typeof AcademicBatchResponseSchema>;
