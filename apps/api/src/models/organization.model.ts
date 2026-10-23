import mongoose, { Schema, Document } from 'mongoose';

export interface IOrganization extends Document {
  name: string;
  slug: string;
  code?: string;
  status: 'active' | 'suspended';
  createdAt: Date;
  updatedAt: Date;
}

const OrganizationSchema = new Schema<IOrganization>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    code: { type: String, uppercase: true, trim: true },
    status: {
      type: String,
      enum: ['active', 'suspended'],
      default: 'active',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export const OrganizationModel: mongoose.Model<IOrganization> =
  (mongoose.models['Organization'] as mongoose.Model<IOrganization>) ||
  mongoose.model<IOrganization>('Organization', OrganizationSchema);

