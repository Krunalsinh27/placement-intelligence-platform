import mongoose, { Schema, Document, Types } from 'mongoose';
import type { UserRole } from '@placement-platform/contracts';

export interface IUserMembership {
  orgId: Types.ObjectId;
  role: UserRole;
  departmentId?: Types.ObjectId;
}

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  fullName: string;
  status: 'active' | 'invited' | 'disabled';
  memberships: IUserMembership[];
  createdAt: Date;
  updatedAt: Date;
}

const UserMembershipSchema = new Schema<IUserMembership>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    role: { type: String, required: true },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department' },
  },
  { _id: false }
);

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false, // Omit password hash by default from all queries
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['active', 'invited', 'disabled'],
      default: 'active',
      index: true,
    },
    memberships: [UserMembershipSchema],
  },
  {
    timestamps: true,
  }
);

export const UserModel: mongoose.Model<IUser> =
  (mongoose.models['User'] as mongoose.Model<IUser>) ||
  mongoose.model<IUser>('User', UserSchema);

