import mongoose, { Schema, Document, Types } from 'mongoose';
import type { CompanyStatus, CompanyTier } from '@placement-platform/contracts';

export interface ICompanyContactPerson {
  name: string;
  email: string;
  phone?: string | null;
  designation?: string | null;
}

export interface ICompanyVerificationDetails {
  verifiedBy?: Types.ObjectId | null;
  verifiedAt?: Date | null;
  remarks?: string | null;
}

export interface ICollegeCompanyProfile extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  companyId: Types.ObjectId;
  status: CompanyStatus;
  tier: CompanyTier;
  verificationDetails?: ICompanyVerificationDetails | null;
  primaryContact?: ICompanyContactPerson | null;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const CollegeCompanyProfileSchema = new Schema<ICollegeCompanyProfile>(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
    },
    status: {
      type: String,
      enum: ['pending_verification', 'verified', 'blacklisted', 'inactive'],
      default: 'pending_verification',
      required: true,
    },
    tier: {
      type: String,
      enum: ['tier_1', 'tier_2', 'tier_3', 'mass_recruiter', 'startup'],
      default: 'tier_3',
      required: true,
    },
    verificationDetails: {
      verifiedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      verifiedAt: { type: Date, default: null },
      remarks: { type: String, trim: true, maxlength: 500, default: null },
    },
    primaryContact: {
      name: { type: String, trim: true, maxlength: 100 },
      email: { type: String, trim: true, lowercase: true },
      phone: { type: String, trim: true, maxlength: 20, default: null },
      designation: { type: String, trim: true, maxlength: 100, default: null },
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

CollegeCompanyProfileSchema.index({ orgId: 1, companyId: 1 }, { unique: true });
CollegeCompanyProfileSchema.index({ orgId: 1, status: 1, tier: 1 });
CollegeCompanyProfileSchema.index({ orgId: 1, createdAt: -1 });

export const CollegeCompanyProfileModel: mongoose.Model<ICollegeCompanyProfile> =
  (mongoose.models['CollegeCompanyProfile'] as mongoose.Model<ICollegeCompanyProfile>) ||
  mongoose.model<ICollegeCompanyProfile>(
    'CollegeCompanyProfile',
    CollegeCompanyProfileSchema
  );
