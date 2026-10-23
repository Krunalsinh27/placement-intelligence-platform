import mongoose, { Schema, Document, Types } from 'mongoose';
import type {
  CompanyRecruiterRole,
  RecruiterAssociationStatus,
} from '@placement-platform/contracts';

export interface ICompanyRecruiter extends Document {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  userId?: Types.ObjectId | null;
  name: string;
  email: string;
  phone?: string | null;
  designation?: string | null;
  role: CompanyRecruiterRole;
  status: RecruiterAssociationStatus;
  invitationTokenHash?: string | null;
  invitationExpiresAt?: Date | null;
  invitedByOrgId?: Types.ObjectId | null;
  invitedByUserId?: Types.ObjectId | null;
  acceptedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const CompanyRecruiterSchema = new Schema<ICompanyRecruiter>(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 20,
      default: null,
    },
    designation: {
      type: String,
      trim: true,
      maxlength: 100,
      default: null,
    },
    role: {
      type: String,
      enum: ['company_admin', 'company_recruiter', 'interviewer'],
      default: 'company_recruiter',
      required: true,
    },
    status: {
      type: String,
      enum: ['pending_invitation', 'active', 'inactive'],
      default: 'pending_invitation',
      required: true,
      index: true,
    },
    invitationTokenHash: {
      type: String,
      default: null,
    },
    invitationExpiresAt: {
      type: Date,
      default: null,
    },
    invitedByOrgId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      default: null,
    },
    invitedByUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    acceptedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Unique compound index: One recruiter record per email within a global company
CompanyRecruiterSchema.index({ companyId: 1, email: 1 }, { unique: true });

// Partial unique index for invitation token lookup
CompanyRecruiterSchema.index(
  { invitationTokenHash: 1 },
  {
    unique: true,
    partialFilterExpression: { invitationTokenHash: { $type: 'string' } },
  }
);

// Fast index on userId when resolving recruiter associations
CompanyRecruiterSchema.index(
  { userId: 1 },
  {
    partialFilterExpression: { userId: { $type: 'objectId' } },
  }
);

// Query filters
CompanyRecruiterSchema.index({ companyId: 1, status: 1 });
CompanyRecruiterSchema.index({ invitedByOrgId: 1, createdAt: -1 });

export const CompanyRecruiterModel: mongoose.Model<ICompanyRecruiter> =
  (mongoose.models['CompanyRecruiter'] as mongoose.Model<ICompanyRecruiter>) ||
  mongoose.model<ICompanyRecruiter>('CompanyRecruiter', CompanyRecruiterSchema);
