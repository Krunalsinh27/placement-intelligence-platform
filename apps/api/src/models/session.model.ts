import mongoose, { Schema, Document, Types } from 'mongoose';
import type { UserRole } from '@placement-platform/contracts';

export interface ISession extends Document {
  tokenHash: string;
  userId: Types.ObjectId;
  orgId?: Types.ObjectId;
  departmentId?: Types.ObjectId;
  role: UserRole;
  expiresAt: Date;
  userAgent?: string;
  ipAddress?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SessionSchema = new Schema<ISession>(
  {
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    orgId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      index: true,
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      index: true,
    },
    role: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 }, // Automatic TTL purge by MongoDB
    },
    userAgent: { type: String },
    ipAddress: { type: String },
  },
  {
    timestamps: true,
  }
);

export const SessionModel: mongoose.Model<ISession> =
  (mongoose.models['Session'] as mongoose.Model<ISession>) ||
  mongoose.model<ISession>('Session', SessionSchema);

