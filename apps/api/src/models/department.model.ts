import mongoose, { Schema, Document, Types } from 'mongoose';
import type { DepartmentStatus } from '@placement-platform/contracts';

export interface IDepartment extends Document {
  orgId: Types.ObjectId;
  name: string;
  code: string;
  status: DepartmentStatus;
  createdAt: Date;
  updatedAt: Date;
}

const DepartmentSchema = new Schema<IDepartment>(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// ── Compound Indexes ────────────────────────────────────────────────────────
// Strict tenant isolation: department code is unique within a college,
// but identical codes (e.g. "CSE") can exist across different colleges.
DepartmentSchema.index({ orgId: 1, code: 1 }, { unique: true });
DepartmentSchema.index({ orgId: 1, status: 1 });

export const DepartmentModel: mongoose.Model<IDepartment> =
  (mongoose.models['Department'] as mongoose.Model<IDepartment>) ||
  mongoose.model<IDepartment>('Department', DepartmentSchema);
