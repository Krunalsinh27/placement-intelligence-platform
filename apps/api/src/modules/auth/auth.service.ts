import { UserModel } from '../../models/user.model.js';
import { OrganizationModel } from '../../models/organization.model.js';
import { SessionModel } from '../../models/session.model.js';
import { AuditLogModel } from '../../models/audit-log.model.js';
import { verifyPassword, generateSessionToken, hashSessionToken } from '../../utils/password.js';
import type { AuthUser, LoginRequest } from '@placement-platform/contracts';

// Constant dummy hash to mitigate user enumeration via timing discrepancies
const DUMMY_HASH = '$argon2id$v=19$m=65536,t=3,p=1$c29tZXNhbHQ$P2Tz9Fq7d3Y9/pX5j7Q1Q';

export interface LoginResult {
  rawToken: string;
  user: AuthUser;
}

export class AuthenticationError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 401
  ) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthService {
  /**
   * Authenticates user, creates single session in MongoDB, and logs audit event.
   */
  async login(
    credentials: LoginRequest,
    context: { ipAddress?: string; userAgent?: string }
  ): Promise<LoginResult> {
    const email = credentials.email.toLowerCase().trim();

    // Query user and explicitly select passwordHash
    const user = await UserModel.findOne({ email }).select('+passwordHash');

    if (!user) {
      // Execute dummy verify to neutralize timing side-channel
      await verifyPassword(DUMMY_HASH, credentials.password);
      await AuditLogModel.create({
        action: 'AUTH_FAILED',
        details: { reason: 'user_not_found', attemptedEmail: email },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });
      throw new AuthenticationError('Invalid email or password.', 'INVALID_CREDENTIALS', 401);
    }

    if (user.status !== 'active') {
      await AuditLogModel.create({
        userId: user._id,
        action: 'AUTH_FAILED',
        details: { reason: 'user_status_not_active', status: user.status },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });
      throw new AuthenticationError('Account is not active.', 'USER_INACTIVE', 401);
    }

    const isPasswordValid = await verifyPassword(user.passwordHash, credentials.password);
    if (!isPasswordValid) {
      await AuditLogModel.create({
        userId: user._id,
        action: 'AUTH_FAILED',
        details: { reason: 'invalid_password' },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });
      throw new AuthenticationError('Invalid email or password.', 'INVALID_CREDENTIALS', 401);
    }

    // Resolve primary organization membership
    const primaryMembership = user.memberships[0];
    if (!primaryMembership) {
      throw new AuthenticationError('User has no assigned organization.', 'NO_ORGANIZATION', 403);
    }

    // Verify organization is active
    const org = await OrganizationModel.findById(primaryMembership.orgId);
    if (!org || org.status !== 'active') {
      await AuditLogModel.create({
        userId: user._id,
        orgId: primaryMembership.orgId,
        action: 'AUTH_FAILED',
        details: { reason: 'organization_inactive' },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });
      throw new AuthenticationError(
        'Organization is suspended or inactive.',
        'ORGANIZATION_INACTIVE',
        403
      );
    }

    // Generate 256-bit cryptographically random session token (ADR 0003)
    const rawToken = generateSessionToken();
    const tokenHash = hashSessionToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await SessionModel.create({
      tokenHash,
      userId: user._id,
      orgId: org._id,
      role: primaryMembership.role,
      expiresAt,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    // Record audit log without storing tokens or secrets
    await AuditLogModel.create({
      userId: user._id,
      orgId: org._id,
      action: 'AUTH_LOGIN',
      details: { role: primaryMembership.role, email: user.email },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return {
      rawToken,
      user: {
        id: user._id.toString(),
        email: user.email,
        fullName: user.fullName,
        activeOrgId: org._id.toString(),
        role: primaryMembership.role,
      },
    };
  }

  /**
   * Revokes ONLY the current session and records an audit event without secrets.
   */
  async logout(
    rawToken: string,
    context: {
      userId?: string;
      orgId?: string | null;
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<void> {
    const tokenHash = hashSessionToken(rawToken);

    // Delete ONLY this specific session
    await SessionModel.deleteOne({ tokenHash });

    await AuditLogModel.create({
      userId: context.userId,
      orgId: context.orgId ?? undefined,
      action: 'AUTH_LOGOUT',
      details: { reason: 'user_logout' },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
  }
}

export const authService = new AuthService();
