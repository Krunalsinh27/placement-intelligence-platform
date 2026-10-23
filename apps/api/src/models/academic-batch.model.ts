import mongoose, { Schema, Document, Types } from 'mongoose';
import type { AcademicBatchStatus } from '@placement-platform/contracts';

export interface IAcademicBatch extends Document {
  orgId: Types.ObjectId;
  name: string;
  startYear: number;
  graduationYear: number;
  status: AcademicBatchStatus;
  createdAt: Date;
  updatedAt: Date;
}

const AcademicBatchSchema = new Schema<IAcademicBatch>(
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
    startYear: {
      type: Number,
      required: true,
    },
    graduationYear: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'graduated', 'archived'],
      default: 'active',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// ── Compound Indexes ────────────────────────────────────────────────────────
// Strict tenant isolation: batch name per graduation year is unique within a college.
AcademicBatchSchema.index({ orgId: 1, graduationYear: 1, name: 1 }, { unique: true });
AcademicBatchSchema.index({ orgId: 1, status: 1 });

export const AcademicBatchModel: mongoose.Model<IAcademicBatch> =
  (mongoose.models['AcademicBatch'] as mongoose.Model<IAcademicBatch>) ||
  mongoose.model<IAcademicBatch>('AcademicBatch', AcademicBatchSchema);
