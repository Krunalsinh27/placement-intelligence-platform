import mongoose, { Schema, Document, Types } from 'mongoose';
import type { StudentStatus, StudentGender } from '@placement-platform/contracts';

export interface IStudentProfile extends Document {
  orgId: Types.ObjectId;
  userId?: Types.ObjectId;
  enrollmentNumber: string;
  departmentId: Types.ObjectId;
  batchId: Types.ObjectId;
  personalDetails: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    gender: StudentGender;
    dob?: Date;
  };
  academicRecords: {
    tenthPercentage: number;
    twelfthPercentage?: number | null;
    diplomaPercentage?: number | null;
    currentCgpa: number;
    activeBacklogs: number;
    historyBacklogs: number;
    gapYears: number;
  };
  skills: string[];
  status: StudentStatus;
  isVerified: boolean;
  verificationDetails?: {
    verifiedBy?: Types.ObjectId;
    verifiedAt?: Date;
    remarks?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const StudentProfileSchema = new Schema<IStudentProfile>(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: undefined,
    },
    enrollmentNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
      index: true,
    },
    batchId: {
      type: Schema.Types.ObjectId,
      ref: 'AcademicBatch',
      required: true,
      index: true,
    },
    personalDetails: {
      firstName: { type: String, required: true, trim: true },
      lastName: { type: String, required: true, trim: true },
      email: { type: String, required: true, lowercase: true, trim: true },
      phone: { type: String, required: true, trim: true },
      gender: {
        type: String,
        enum: ['male', 'female', 'other', 'prefer_not_to_say'],
        required: true,
      },
      dob: { type: Date },
    },
    academicRecords: {
      tenthPercentage: { type: Number, required: true },
      twelfthPercentage: { type: Number, default: null },
      diplomaPercentage: { type: Number, default: null },
      currentCgpa: { type: Number, required: true },
      activeBacklogs: { type: Number, default: 0, required: true },
      historyBacklogs: { type: Number, default: 0, required: true },
      gapYears: { type: Number, default: 0, required: true },
    },
    skills: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ['unplaced', 'placed', 'opted_out', 'blocked'],
      default: 'unplaced',
      required: true,
      index: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
      required: true,
      index: true,
    },
    verificationDetails: {
      verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      verifiedAt: { type: Date },
      remarks: { type: String, trim: true },
    },
  },
  {
    timestamps: true,
  }
);

// ── Compound Indexes (ADR 0002) ─────────────────────────────────────────────
// 1. Enrollment uniqueness per college: same enrollment can exist across different colleges.
StudentProfileSchema.index({ orgId: 1, enrollmentNumber: 1 }, { unique: true });

// 2. Option B: Multiple unlinked student profiles (userId undefined) can coexist without conflict.
// Once linked, at most one student profile per user within the college organization.
StudentProfileSchema.index(
  { orgId: 1, userId: 1 },
  {
    unique: true,
    partialFilterExpression: { userId: { $exists: true, $type: 'objectId' } },
  }
);

// 3. Query optimization for drive eligibility, department cohorts, and rank listings
StudentProfileSchema.index({ orgId: 1, departmentId: 1, batchId: 1 });
StudentProfileSchema.index({ orgId: 1, status: 1 });
StudentProfileSchema.index({ orgId: 1, 'academicRecords.currentCgpa': -1 });
StudentProfileSchema.index({ orgId: 1, isVerified: 1 });

export const StudentProfileModel: mongoose.Model<IStudentProfile> =
  (mongoose.models['StudentProfile'] as mongoose.Model<IStudentProfile>) ||
  mongoose.model<IStudentProfile>('StudentProfile', StudentProfileSchema);
