import mongoose from 'mongoose';
import { StudentProfileModel, type IStudentProfile } from '../../models/student-profile.model.js';
import { DepartmentModel } from '../../models/department.model.js';
import { AcademicBatchModel } from '../../models/academic-batch.model.js';
import { AuditLogModel } from '../../models/audit-log.model.js';
import type {
  StudentProfileCreateInput,
  StudentProfileUpdateInput,
  StudentVerifyRequest,
  StudentStatusUpdateRequest,
  StudentQueryFilters,
  StudentProfileResponse,
  PaginatedStudentListResponse,
} from '@placement-platform/contracts';

export interface AuditContext {
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export class StudentError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'StudentError';
  }
}

function formatStudent(doc: IStudentProfile): StudentProfileResponse {
  return {
    id: doc._id.toString(),
    orgId: doc.orgId.toString(),
    userId: doc.userId ? doc.userId.toString() : null,
    enrollmentNumber: doc.enrollmentNumber,
    departmentId: doc.departmentId.toString(),
    batchId: doc.batchId.toString(),
    personalDetails: {
      firstName: doc.personalDetails.firstName,
      lastName: doc.personalDetails.lastName,
      email: doc.personalDetails.email,
      phone: doc.personalDetails.phone,
      gender: doc.personalDetails.gender,
      dob: doc.personalDetails.dob ? doc.personalDetails.dob.toISOString() : undefined,
    },
    academicRecords: {
      tenthPercentage: doc.academicRecords.tenthPercentage,
      twelfthPercentage: doc.academicRecords.twelfthPercentage ?? null,
      diplomaPercentage: doc.academicRecords.diplomaPercentage ?? null,
      currentCgpa: doc.academicRecords.currentCgpa,
      activeBacklogs: doc.academicRecords.activeBacklogs,
      historyBacklogs: doc.academicRecords.historyBacklogs,
      gapYears: doc.academicRecords.gapYears,
    },
    skills: doc.skills,
    status: doc.status,
    isVerified: doc.isVerified,
    verificationDetails: doc.verificationDetails
      ? {
          verifiedBy: doc.verificationDetails.verifiedBy?.toString(),
          verifiedAt: doc.verificationDetails.verifiedAt?.toISOString(),
          remarks: doc.verificationDetails.remarks,
        }
      : undefined,
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

export class StudentService {
  /**
   * Registers a new student profile without requiring user account credentials (Option B).
   */
  async createStudent(
    orgId: string,
    input: StudentProfileCreateInput,
    context: AuditContext
  ): Promise<StudentProfileResponse> {
    const orgObjectId = new mongoose.Types.ObjectId(orgId);

    // 1. Validate department existence within the authenticated college
    const department = await DepartmentModel.findOne({
      _id: new mongoose.Types.ObjectId(input.departmentId),
      orgId: orgObjectId,
    });
    if (!department) {
      throw new StudentError(
        'Referenced department does not belong to your college.',
        'INVALID_REFERENCE',
        400
      );
    }

    // 2. Validate batch existence within the authenticated college
    const batch = await AcademicBatchModel.findOne({
      _id: new mongoose.Types.ObjectId(input.batchId),
      orgId: orgObjectId,
    });
    if (!batch) {
      throw new StudentError(
        'Referenced batch does not belong to your college.',
        'INVALID_REFERENCE',
        400
      );
    }

    const normalizedEnrollment = input.enrollmentNumber.trim().toUpperCase();

    try {
      const student = await StudentProfileModel.create({
        orgId: orgObjectId,
        enrollmentNumber: normalizedEnrollment,
        departmentId: department._id,
        batchId: batch._id,
        personalDetails: {
          firstName: input.personalDetails.firstName.trim(),
          lastName: input.personalDetails.lastName.trim(),
          email: input.personalDetails.email.trim().toLowerCase(),
          phone: input.personalDetails.phone.trim(),
          gender: input.personalDetails.gender,
          dob: input.personalDetails.dob ? new Date(input.personalDetails.dob) : undefined,
        },
        academicRecords: {
          tenthPercentage: input.academicRecords.tenthPercentage,
          twelfthPercentage: input.academicRecords.twelfthPercentage ?? null,
          diplomaPercentage: input.academicRecords.diplomaPercentage ?? null,
          currentCgpa: input.academicRecords.currentCgpa,
          activeBacklogs: input.academicRecords.activeBacklogs,
          historyBacklogs: input.academicRecords.historyBacklogs,
          gapYears: input.academicRecords.gapYears,
        },
        skills: input.skills ?? [],
        status: 'unplaced',
        isVerified: false,
      });

      await AuditLogModel.create({
        orgId: orgObjectId,
        userId: context.userId ? new mongoose.Types.ObjectId(context.userId) : undefined,
        action: 'STUDENT_CREATED',
        details: {
          studentId: student._id.toString(),
          enrollmentNumber: student.enrollmentNumber,
          departmentId: student.departmentId.toString(),
          batchId: student.batchId.toString(),
        },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });

      return formatStudent(student);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new StudentError(
          `Student with enrollment number '${normalizedEnrollment}' already exists in your college.`,
          'DUPLICATE_RESOURCE',
          409
        );
      }
      throw error;
    }
  }

  /**
   * Retrieves a paginated, filtered, and searchable directory of students.
   * Enforces department coordinator scoping at the database query level.
   */
  async listStudents(
    orgId: string,
    filters: StudentQueryFilters,
    coordinatorDeptId?: string | null
  ): Promise<PaginatedStudentListResponse> {
    const orgObjectId = new mongoose.Types.ObjectId(orgId);
    const query: Record<string, unknown> = { orgId: orgObjectId };

    // Enforce coordinator department scoping (Option A)
    if (coordinatorDeptId) {
      if (filters.departmentId && filters.departmentId !== coordinatorDeptId) {
        throw new StudentError(
          'Coordinators can only access students in their assigned department.',
          'FORBIDDEN',
          403
        );
      }
      query.departmentId = new mongoose.Types.ObjectId(coordinatorDeptId);
    } else if (filters.departmentId) {
      query.departmentId = new mongoose.Types.ObjectId(filters.departmentId);
    }

    if (filters.batchId) {
      query.batchId = new mongoose.Types.ObjectId(filters.batchId);
    }

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.minCgpa !== undefined) {
      query['academicRecords.currentCgpa'] = { $gte: filters.minCgpa };
    }

    if (filters.maxActiveBacklogs !== undefined) {
      query['academicRecords.activeBacklogs'] = { $lte: filters.maxActiveBacklogs };
    }

    if (filters.isVerified !== undefined) {
      query.isVerified = filters.isVerified;
    }

    if (filters.search) {
      const escaped = filters.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { enrollmentNumber: { $regex: escaped, $options: 'i' } },
        { 'personalDetails.firstName': { $regex: escaped, $options: 'i' } },
        { 'personalDetails.lastName': { $regex: escaped, $options: 'i' } },
        { 'personalDetails.email': { $regex: escaped, $options: 'i' } },
      ];
    }

    // Determine sorting criteria
    const sortFieldMap: Record<string, string> = {
      name: 'personalDetails.firstName',
      enrollmentNumber: 'enrollmentNumber',
      currentCgpa: 'academicRecords.currentCgpa',
      createdAt: 'createdAt',
    };
    const sortKey = sortFieldMap[filters.sortBy] || 'createdAt';
    const sortDirection = filters.sortOrder === 'asc' ? 1 : -1;
    const sortObject = { [sortKey]: sortDirection } as Record<string, 1 | -1>;

    const page = Math.max(1, filters.page);
    const limit = Math.min(100, Math.max(1, filters.limit));
    const skip = (page - 1) * limit;

    const [total, students] = await Promise.all([
      StudentProfileModel.countDocuments(query),
      StudentProfileModel.find(query).sort(sortObject).skip(skip).limit(limit),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      items: students.map(formatStudent),
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Retrieves single student profile.
   * Validates department coordinator restriction if applicable.
   */
  async getStudentById(
    orgId: string,
    studentId: string,
    coordinatorDeptId?: string | null
  ): Promise<StudentProfileResponse> {
    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      throw new StudentError('Invalid student ID format.', 'INVALID_ID', 400);
    }

    const student = await StudentProfileModel.findOne({
      _id: new mongoose.Types.ObjectId(studentId),
      orgId: new mongoose.Types.ObjectId(orgId),
    });

    if (!student) {
      throw new StudentError('Student not found in your college.', 'NOT_FOUND', 404);
    }

    if (coordinatorDeptId && student.departmentId.toString() !== coordinatorDeptId) {
      throw new StudentError('Student not found in your college.', 'NOT_FOUND', 404);
    }

    return formatStudent(student);
  }

  /**
   * Updates an existing student profile. Validates referenced department/batch.
   */
  async updateStudent(
    orgId: string,
    studentId: string,
    input: StudentProfileUpdateInput,
    context: AuditContext
  ): Promise<StudentProfileResponse> {
    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      throw new StudentError('Invalid student ID format.', 'INVALID_ID', 400);
    }

    const orgObjectId = new mongoose.Types.ObjectId(orgId);

    // Validate foreign references if modified
    if (input.departmentId) {
      const dept = await DepartmentModel.findOne({
        _id: new mongoose.Types.ObjectId(input.departmentId),
        orgId: orgObjectId,
      });
      if (!dept) {
        throw new StudentError(
          'Referenced department does not belong to your college.',
          'INVALID_REFERENCE',
          400
        );
      }
    }

    if (input.batchId) {
      const batch = await AcademicBatchModel.findOne({
        _id: new mongoose.Types.ObjectId(input.batchId),
        orgId: orgObjectId,
      });
      if (!batch) {
        throw new StudentError(
          'Referenced batch does not belong to your college.',
          'INVALID_REFERENCE',
          400
        );
      }
    }

    const updateSet: Record<string, unknown> = {};

    if (input.departmentId) {
      updateSet.departmentId = new mongoose.Types.ObjectId(input.departmentId);
    }
    if (input.batchId) {
      updateSet.batchId = new mongoose.Types.ObjectId(input.batchId);
    }
    if (input.skills !== undefined) {
      updateSet.skills = input.skills;
    }

    if (input.personalDetails) {
      for (const [key, val] of Object.entries(input.personalDetails)) {
        if (val !== undefined) {
          if (key === 'email' && typeof val === 'string') {
            updateSet[`personalDetails.${key}`] = val.trim().toLowerCase();
          } else if (key === 'dob' && typeof val === 'string') {
            updateSet[`personalDetails.${key}`] = new Date(val);
          } else {
            updateSet[`personalDetails.${key}`] = val;
          }
        }
      }
    }

    if (input.academicRecords) {
      for (const [key, val] of Object.entries(input.academicRecords)) {
        if (val !== undefined) {
          updateSet[`academicRecords.${key}`] = val;
        }
      }
    }

    const student = await StudentProfileModel.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(studentId),
        orgId: orgObjectId,
      },
      { $set: updateSet },
      { new: true, runValidators: true }
    );

    if (!student) {
      throw new StudentError('Student not found in your college.', 'NOT_FOUND', 404);
    }

    await AuditLogModel.create({
      orgId: orgObjectId,
      userId: context.userId ? new mongoose.Types.ObjectId(context.userId) : undefined,
      action: 'STUDENT_UPDATED',
      details: {
        studentId: student._id.toString(),
        updateSet,
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return formatStudent(student);
  }

  /**
   * Verifies academic data for a student. Only modifies verification status and details.
   */
  async verifyStudent(
    orgId: string,
    studentId: string,
    input: StudentVerifyRequest,
    context: AuditContext,
    coordinatorDeptId?: string | null
  ): Promise<StudentProfileResponse> {
    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      throw new StudentError('Invalid student ID format.', 'INVALID_ID', 400);
    }

    const orgObjectId = new mongoose.Types.ObjectId(orgId);
    const student = await StudentProfileModel.findOne({
      _id: new mongoose.Types.ObjectId(studentId),
      orgId: orgObjectId,
    });

    if (!student) {
      throw new StudentError('Student not found in your college.', 'NOT_FOUND', 404);
    }

    if (coordinatorDeptId && student.departmentId.toString() !== coordinatorDeptId) {
      throw new StudentError('Student not found in your college.', 'NOT_FOUND', 404);
    }

    student.isVerified = input.isVerified;
    student.verificationDetails = {
      verifiedBy: context.userId ? new mongoose.Types.ObjectId(context.userId) : undefined,
      verifiedAt: new Date(),
      remarks: input.remarks ? input.remarks.trim() : undefined,
    };

    await student.save();

    await AuditLogModel.create({
      orgId: orgObjectId,
      userId: context.userId ? new mongoose.Types.ObjectId(context.userId) : undefined,
      action: 'STUDENT_VERIFIED',
      details: {
        studentId: student._id.toString(),
        isVerified: input.isVerified,
        remarks: input.remarks,
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return formatStudent(student);
  }

  /**
   * Updates student placement status. Only modifies the status field.
   */
  async updateStatus(
    orgId: string,
    studentId: string,
    input: StudentStatusUpdateRequest,
    context: AuditContext
  ): Promise<StudentProfileResponse> {
    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      throw new StudentError('Invalid student ID format.', 'INVALID_ID', 400);
    }

    const orgObjectId = new mongoose.Types.ObjectId(orgId);
    const student = await StudentProfileModel.findOne({
      _id: new mongoose.Types.ObjectId(studentId),
      orgId: orgObjectId,
    });

    if (!student) {
      throw new StudentError('Student not found in your college.', 'NOT_FOUND', 404);
    }

    const previousStatus = student.status;
    student.status = input.status;
    await student.save();

    await AuditLogModel.create({
      orgId: orgObjectId,
      userId: context.userId ? new mongoose.Types.ObjectId(context.userId) : undefined,
      action: 'STUDENT_STATUS_CHANGED',
      details: {
        studentId: student._id.toString(),
        previousStatus,
        newStatus: input.status,
        reason: input.reason,
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return formatStudent(student);
  }
}

export const studentService = new StudentService();
