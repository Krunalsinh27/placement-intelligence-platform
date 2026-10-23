import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ICompanyLocation {
  city?: string | null;
  state?: string | null;
  country?: string | null;
  addressLine?: string | null;
}

export interface ICompany extends Document {
  _id: Types.ObjectId;
  name: string;
  legalName?: string | null;
  website?: string | null;
  industry: string;
  description?: string | null;
  location?: ICompanyLocation | null;
  createdAt: Date;
  updatedAt: Date;
}

const CompanySchema = new Schema<ICompany>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 150,
    },
    legalName: {
      type: String,
      trim: true,
      maxlength: 150,
      default: null,
    },
    website: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
    },
    industry: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: null,
    },
    location: {
      city: { type: String, trim: true, maxlength: 100, default: null },
      state: { type: String, trim: true, maxlength: 100, default: null },
      country: { type: String, trim: true, maxlength: 100, default: null },
      addressLine: { type: String, trim: true, maxlength: 250, default: null },
    },
  },
  {
    timestamps: true,
  }
);

CompanySchema.index(
  { website: 1 },
  {
    unique: true,
    partialFilterExpression: { website: { $type: 'string' } },
  }
);
CompanySchema.index({ name: 1 });

export const CompanyModel: mongoose.Model<ICompany> =
  (mongoose.models['Company'] as mongoose.Model<ICompany>) ||
  mongoose.model<ICompany>('Company', CompanySchema);
