import mongoose from 'mongoose';
import { DepartmentModel, type IDepartment } from '../../models/department.model.js';
import { AcademicBatchModel, type IAcademicBatch } from '../../models/academic-batch.model.js';
import { AuditLogModel } from '../../models/audit-log.model.js';
import type {
  DepartmentCreateInput,
  DepartmentUpdateInput,
  DepartmentResponse,
  AcademicBatchCreateInput,
  AcademicBatchUpdateInput,
  AcademicBatchResponse,
} from '@placement-platform/contracts';

export interface AuditContext {
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export class AcademicError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'AcademicError';
  }
}

function formatDepartment(doc: IDepartment): DepartmentResponse {
  return {
    id: doc._id.toString(),
    orgId: doc.orgId.toString(),
    name: doc.name,
    code: doc.code,
    status: doc.status,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

function formatAcademicBatch(doc: IAcademicBatch): AcademicBatchResponse {
  return {
    id: doc._id.toString(),
    orgId: doc.orgId.toString(),
    name: doc.name,
    startYear: doc.startYear,
    graduationYear: doc.graduationYear,
    status: doc.status,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 11000
  );
}

export class AcademicService {
  // ─── Department Operations ────────────────────────────────────────────────

  /**
   * Creates a new academic department scoped to the authenticated college.
   */
  async createDepartment(
    orgId: string,
    input: DepartmentCreateInput,
    context: AuditContext
  ): Promise<DepartmentResponse> {
    try {
      const department = await DepartmentModel.create({
        orgId: new mongoose.Types.ObjectId(orgId),
        name: input.name.trim(),
        code: input.code.trim().toUpperCase(),
        status: input.status ?? 'active',
      });

      await AuditLogModel.create({
        orgId: new mongoose.Types.ObjectId(orgId),
        userId: context.userId ? new mongoose.Types.ObjectId(context.userId) : undefined,
        action: 'ACADEMIC_DEPARTMENT_CREATED',
        details: {
          departmentId: department._id.toString(),
          code: department.code,
          name: department.name,
          status: department.status,
        },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });

      return formatDepartment(department);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new AcademicError(
          `Department with code '${input.code.trim().toUpperCase()}' already exists in your college.`,
          'DUPLICATE_RESOURCE',
          409
        );
      }
      throw error;
    }
  }

  /**
   * Lists all academic departments for the authenticated college.
   */
  async listDepartments(orgId: string): Promise<DepartmentResponse[]> {
    const departments = await DepartmentModel.find({
      orgId: new mongoose.Types.ObjectId(orgId),
    }).sort({ name: 1 });

    return departments.map(formatDepartment);
  }

  /**
   * Updates an existing department scoped to the authenticated college.
   */
  async updateDepartment(
    orgId: string,
    departmentId: string,
    input: DepartmentUpdateInput,
    context: AuditContext
  ): Promise<DepartmentResponse> {
    if (!mongoose.Types.ObjectId.isValid(departmentId)) {
      throw new AcademicError('Invalid department ID format.', 'INVALID_ID', 400);
    }

    const updateFields: Partial<{
      name: string;
      code: string;
      status: 'active' | 'inactive';
    }> = {};

    if (input.name !== undefined) updateFields.name = input.name.trim();
    if (input.code !== undefined) updateFields.code = input.code.trim().toUpperCase();
    if (input.status !== undefined) updateFields.status = input.status;

    try {
      const department = await DepartmentModel.findOneAndUpdate(
        {
          _id: new mongoose.Types.ObjectId(departmentId),
          orgId: new mongoose.Types.ObjectId(orgId),
        },
        { $set: updateFields },
        { new: true, runValidators: true }
      );

      if (!department) {
        throw new AcademicError('Department not found in your college.', 'NOT_FOUND', 404);
      }

      await AuditLogModel.create({
        orgId: new mongoose.Types.ObjectId(orgId),
        userId: context.userId ? new mongoose.Types.ObjectId(context.userId) : undefined,
        action: 'ACADEMIC_DEPARTMENT_UPDATED',
        details: {
          departmentId: department._id.toString(),
          updateFields,
        },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });

      return formatDepartment(department);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new AcademicError(
          `Department with code '${input.code}' already exists in your college.`,
          'DUPLICATE_RESOURCE',
          409
        );
      }
      throw error;
    }
  }

  // ─── Academic Batch Operations ────────────────────────────────────────────

  /**
   * Creates a new academic batch scoped to the authenticated college.
   */
  async createBatch(
    orgId: string,
    input: AcademicBatchCreateInput,
    context: AuditContext
  ): Promise<AcademicBatchResponse> {
    try {
      const batch = await AcademicBatchModel.create({
        orgId: new mongoose.Types.ObjectId(orgId),
        name: input.name.trim(),
        startYear: input.startYear,
        graduationYear: input.graduationYear,
        status: input.status ?? 'active',
      });

      await AuditLogModel.create({
        orgId: new mongoose.Types.ObjectId(orgId),
        userId: context.userId ? new mongoose.Types.ObjectId(context.userId) : undefined,
        action: 'ACADEMIC_BATCH_CREATED',
        details: {
          batchId: batch._id.toString(),
          name: batch.name,
          startYear: batch.startYear,
          graduationYear: batch.graduationYear,
          status: batch.status,
        },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });

      return formatAcademicBatch(batch);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new AcademicError(
          `Academic batch with name '${input.name.trim()}' and graduation year ${input.graduationYear} already exists in your college.`,
          'DUPLICATE_RESOURCE',
          409
        );
      }
      throw error;
    }
  }

  /**
   * Lists all academic batches for the authenticated college.
   */
  async listBatches(orgId: string): Promise<AcademicBatchResponse[]> {
    const batches = await AcademicBatchModel.find({
      orgId: new mongoose.Types.ObjectId(orgId),
    }).sort({ graduationYear: -1, name: 1 });

    return batches.map(formatAcademicBatch);
  }

  /**
   * Updates an existing academic batch scoped to the authenticated college.
   */
  async updateBatch(
    orgId: string,
    batchId: string,
    input: AcademicBatchUpdateInput,
    context: AuditContext
  ): Promise<AcademicBatchResponse> {
    if (!mongoose.Types.ObjectId.isValid(batchId)) {
      throw new AcademicError('Invalid batch ID format.', 'INVALID_ID', 400);
    }

    // Verify existing batch to cross-check years if only one is updated
    const existing = await AcademicBatchModel.findOne({
      _id: new mongoose.Types.ObjectId(batchId),
      orgId: new mongoose.Types.ObjectId(orgId),
    });

    if (!existing) {
      throw new AcademicError('Academic batch not found in your college.', 'NOT_FOUND', 404);
    }

    const startYear = input.startYear ?? existing.startYear;
    const graduationYear = input.graduationYear ?? existing.graduationYear;

    if (graduationYear < startYear) {
      throw new AcademicError(
        'Graduation year must be greater than or equal to start year.',
        'INVALID_YEAR_RANGE',
        400
      );
    }

    const updateFields: Partial<{
      name: string;
      startYear: number;
      graduationYear: number;
      status: 'active' | 'graduated' | 'archived';
    }> = {};

    if (input.name !== undefined) updateFields.name = input.name.trim();
    if (input.startYear !== undefined) updateFields.startYear = input.startYear;
    if (input.graduationYear !== undefined) updateFields.graduationYear = input.graduationYear;
    if (input.status !== undefined) updateFields.status = input.status;

    try {
      const batch = await AcademicBatchModel.findOneAndUpdate(
        {
          _id: new mongoose.Types.ObjectId(batchId),
          orgId: new mongoose.Types.ObjectId(orgId),
        },
        { $set: updateFields },
        { new: true, runValidators: true }
      );

      if (!batch) {
        throw new AcademicError('Academic batch not found in your college.', 'NOT_FOUND', 404);
      }

      await AuditLogModel.create({
        orgId: new mongoose.Types.ObjectId(orgId),
        userId: context.userId ? new mongoose.Types.ObjectId(context.userId) : undefined,
        action: 'ACADEMIC_BATCH_UPDATED',
        details: {
          batchId: batch._id.toString(),
          updateFields,
        },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });

      return formatAcademicBatch(batch);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new AcademicError(
          'An academic batch with these details already exists in your college.',
          'DUPLICATE_RESOURCE',
          409
        );
      }
      throw error;
    }
  }
}

export const academicService = new AcademicService();
