import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IAuditLog extends Document {
  orgId?: Types.ObjectId;
  userId?: Types.ObjectId;
  action: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    action: { type: String, required: true, index: true },
    details: { type: Schema.Types.Mixed },
    ipAddress: { type: String },
    userAgent: { type: String },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  {
    timestamps: false, // Audit records use immutable timestamp
  }
);

AuditLogSchema.index({ orgId: 1, timestamp: -1 });

export const AuditLogModel: mongoose.Model<IAuditLog> =
  (mongoose.models['AuditLog'] as mongoose.Model<IAuditLog>) ||
  mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);

