import mongoose from 'mongoose';
import { CompanyModel } from '../../models/company.model.js';
import { CollegeCompanyProfileModel } from '../../models/college-company-profile.model.js';
import {
  CompanyRecruiterModel,
  type ICompanyRecruiter,
} from '../../models/company-recruiter.model.js';
import { UserModel } from '../../models/user.model.js';
import { AuditLogModel } from '../../models/audit-log.model.js';
import {
  generateSessionToken,
  hashSessionToken,
  hashPassword,
} from '../../utils/password.js';
import {
  type RecruiterInviteRequest,
  type RecruiterAcceptInviteRequest,
  type RecruiterQueryFilters,
  type RecruiterAssociationResponse,
  type PaginatedRecruiterListResponse,
  type UserRole,
  isValidRecruiterStatusTransition,
} from '@placement-platform/contracts';

export interface AuditContext {
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface CallerContext {
  orgId?: string | null;
  userId: string;
  role: UserRole;
  email?: string;
}

export interface RecruiterInviteResult {
  recruiter: RecruiterAssociationResponse;
  invitationToken: string;
  invitationExpiresAt: string;
}

export class RecruiterError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'RecruiterError';
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatRecruiter(doc: ICompanyRecruiter): RecruiterAssociationResponse {
  return {
    id: doc._id.toString(),
    companyId: doc.companyId.toString(),
    orgId: doc.invitedByOrgId ? doc.invitedByOrgId.toString() : null,
    userId: doc.userId ? doc.userId.toString() : null,
    name: doc.name,
    email: doc.email,
    phone: doc.phone ?? null,
    designation: doc.designation ?? null,
    role: doc.role,
    status: doc.status,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export class RecruiterService {
  /**
   * Invites a new recruiter or re-invites an inactive recruiter for a company.
   * Authorized callers:
   * 1. College officers (college_admin, tpo): Only for companies registered in their college directory (not blacklisted).
   * 2. Company admin (company_admin): Only for their own company.
   */
  async inviteRecruiter(
    companyId: string,
    caller: CallerContext,
    input: RecruiterInviteRequest,
    context: AuditContext
  ): Promise<RecruiterInviteResult> {
    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      throw new RecruiterError('Invalid company ID format.', 'INVALID_ID', 400);
    }
    const companyObjectId = new mongoose.Types.ObjectId(companyId);

    // Verify global company exists
    const company = await CompanyModel.findById(companyObjectId);
    if (!company) {
      throw new RecruiterError(
        'Referenced global company does not exist.',
        'GLOBAL_COMPANY_NOT_FOUND',
        404
      );
    }

    // Role-based authorization and tenant/company scoping
    const isCollegeOfficer =
      caller.role === 'college_admin' || caller.role === 'tpo';
    const isCompanyAdmin = caller.role === 'company_admin';

    if (isCollegeOfficer) {
      if (!caller.orgId) {
        throw new RecruiterError(
          'Tenant context missing from session.',
          'TENANT_CONTEXT_REQUIRED',
          403
        );
      }
      const collegeProfile = await CollegeCompanyProfileModel.findOne({
        orgId: new mongoose.Types.ObjectId(caller.orgId),
        companyId: companyObjectId,
      });

      if (!collegeProfile) {
        throw new RecruiterError(
          'Company is not registered in your college directory.',
          'COMPANY_NOT_FOUND',
          404
        );
      }
      if (collegeProfile.status === 'blacklisted') {
        throw new RecruiterError(
          'Cannot invite recruiters for a blacklisted company.',
          'COMPANY_BLACKLISTED',
          400
        );
      }
    } else if (isCompanyAdmin) {
      // Company admin must have an active recruiter record for THIS company
      const adminRecord = await CompanyRecruiterModel.findOne({
        companyId: companyObjectId,
        userId: new mongoose.Types.ObjectId(caller.userId),
        role: 'company_admin',
        status: 'active',
      });

      if (!adminRecord) {
        throw new RecruiterError(
          'You are not an authorized company admin for this company.',
          'FORBIDDEN',
          403
        );
      }
    } else {
      throw new RecruiterError(
        'You do not have permission to invite recruiters.',
        'FORBIDDEN',
        403
      );
    }

    const email = input.email.toLowerCase().trim();

    // Check if recruiter already exists for this company
    const existingRecruiter = await CompanyRecruiterModel.findOne({
      companyId: companyObjectId,
      email,
    });

    const rawToken = generateSessionToken();
    const tokenHash = hashSessionToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days TTL

    if (existingRecruiter) {
      if (existingRecruiter.status === 'active') {
        throw new RecruiterError(
          'A recruiter with this email is already active for this company.',
          'RECRUITER_ALREADY_EXISTS',
          409
        );
      }
      if (existingRecruiter.status === 'pending_invitation') {
        // If invitation is already pending and not expired, reject duplicate invite
        if (
          existingRecruiter.invitationExpiresAt &&
          existingRecruiter.invitationExpiresAt > new Date()
        ) {
          throw new RecruiterError(
            'An active invitation is already pending for this recruiter. Use resend to issue a new token.',
            'INVITATION_ALREADY_PENDING',
            409
          );
        }
      }

      // Re-issue invitation for expired or inactive recruiter
      existingRecruiter.status = 'pending_invitation';
      existingRecruiter.name = input.name.trim();
      existingRecruiter.role = input.role;
      existingRecruiter.phone = input.phone?.trim() || null;
      existingRecruiter.designation = input.designation?.trim() || null;
      existingRecruiter.invitationTokenHash = tokenHash;
      existingRecruiter.invitationExpiresAt = expiresAt;
      existingRecruiter.invitedByOrgId = caller.orgId
        ? new mongoose.Types.ObjectId(caller.orgId)
        : null;
      existingRecruiter.invitedByUserId = new mongoose.Types.ObjectId(
        caller.userId
      );

      await existingRecruiter.save();

      await AuditLogModel.create({
        orgId: caller.orgId ? new mongoose.Types.ObjectId(caller.orgId) : undefined,
        userId: new mongoose.Types.ObjectId(caller.userId),
        action: 'recruiter_invitation_reissued',
        details: {
          recruiterId: existingRecruiter._id.toString(),
          companyId: companyObjectId.toString(),
          email,
          role: existingRecruiter.role,
        },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        timestamp: new Date(),
      });

      return {
        recruiter: formatRecruiter(existingRecruiter),
        invitationToken: rawToken,
        invitationExpiresAt: expiresAt.toISOString(),
      };
    }

    // Create new recruiter record
    let newRecruiter: ICompanyRecruiter;
    try {
      newRecruiter = await CompanyRecruiterModel.create({
        companyId: companyObjectId,
        email,
        name: input.name.trim(),
        phone: input.phone?.trim() || null,
        designation: input.designation?.trim() || null,
        role: input.role,
        status: 'pending_invitation',
        invitationTokenHash: tokenHash,
        invitationExpiresAt: expiresAt,
        invitedByOrgId: caller.orgId
          ? new mongoose.Types.ObjectId(caller.orgId)
          : null,
        invitedByUserId: new mongoose.Types.ObjectId(caller.userId),
      });
    } catch (err: unknown) {
      if (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code: number }).code === 11000
      ) {
        throw new RecruiterError(
          'An invitation or recruiter profile already exists for this email at this company.',
          'INVITATION_ALREADY_PENDING',
          409
        );
      }
      throw err;
    }

    await AuditLogModel.create({
      orgId: caller.orgId ? new mongoose.Types.ObjectId(caller.orgId) : undefined,
      userId: new mongoose.Types.ObjectId(caller.userId),
      action: 'recruiter_invited',
      details: {
        recruiterId: newRecruiter._id.toString(),
        companyId: companyObjectId.toString(),
        email,
        role: newRecruiter.role,
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      timestamp: new Date(),
    });

    return {
      recruiter: formatRecruiter(newRecruiter),
      invitationToken: rawToken,
      invitationExpiresAt: expiresAt.toISOString(),
    };
  }

  /**
   * Accepts an invitation using a raw cryptographic token.
   * - If user already exists: User MUST be authenticated, and authenticated email must match.
   *   Existing user password, name, status, and memberships are NEVER overwritten.
   * - If user is new: Validates invitation and provisions account with Argon2id password hash.
   * - Enforces atomic single-use acceptance via findOneAndUpdate.
   */
  async acceptInvitation(
    input: RecruiterAcceptInviteRequest,
    authenticatedUser: { userId?: string; email?: string } | null,
    context: AuditContext
  ): Promise<RecruiterAssociationResponse> {
    const rawToken = input.token.trim();
    const tokenHash = hashSessionToken(rawToken);

    // Find recruiter by invitation token hash
    const recruiter = await CompanyRecruiterModel.findOne({
      invitationTokenHash: tokenHash,
    });

    if (!recruiter) {
      throw new RecruiterError(
        'Invitation token is invalid or does not exist.',
        'INVALID_OR_EXPIRED_TOKEN',
        400
      );
    }

    if (recruiter.status === 'inactive') {
      throw new RecruiterError(
        'This invitation has been revoked or deactivated.',
        'INVITATION_REVOKED',
        400
      );
    }

    if (recruiter.status === 'active') {
      throw new RecruiterError(
        'This invitation has already been accepted.',
        'INVITATION_ALREADY_ACCEPTED',
        400
      );
    }

    if (
      !recruiter.invitationExpiresAt ||
      recruiter.invitationExpiresAt <= new Date()
    ) {
      throw new RecruiterError(
        'This invitation has expired. Please request a new invitation.',
        'INVITATION_EXPIRED',
        400
      );
    }

    // Check if user already exists in UserModel
    const existingUser = await UserModel.findOne({
      email: recruiter.email.toLowerCase(),
    });

    let targetUserId: mongoose.Types.ObjectId;

    if (existingUser) {
      // Existing User Flow: User MUST be authenticated with this exact email
      if (!authenticatedUser?.userId) {
        throw new RecruiterError(
          'An account already exists with this email address. Please log in first to accept this invitation.',
          'AUTHENTICATION_REQUIRED',
          401
        );
      }

      if (
        authenticatedUser.userId !== existingUser._id.toString() ||
        authenticatedUser.email?.toLowerCase() !== recruiter.email.toLowerCase()
      ) {
        throw new RecruiterError(
          'The authenticated account email does not match the invitation email.',
          'EMAIL_MISMATCH',
          403
        );
      }

      // Existing user attributes, password, status, and memberships are preserved intact
      targetUserId = existingUser._id;
    } else {
      // New User Flow: Provision user account with Argon2id hash
      if (!input.password || input.password.length < 8) {
        throw new RecruiterError(
          'A password of at least 8 characters is required to set up your account.',
          'PASSWORD_REQUIRED',
          400
        );
      }

      const passwordHash = await hashPassword(input.password);

      try {
        const newUser = await UserModel.create({
          email: recruiter.email.toLowerCase(),
          passwordHash,
          fullName: recruiter.name,
          status: 'active',
          memberships: [],
        });
        targetUserId = newUser._id;
      } catch (err: unknown) {
        // If concurrent user registration occurred, resolve existing
        if (
          typeof err === 'object' &&
          err !== null &&
          'code' in err &&
          (err as { code: number }).code === 11000
        ) {
          const raceUser = await UserModel.findOne({
            email: recruiter.email.toLowerCase(),
          });
          if (!raceUser) throw err;
          targetUserId = raceUser._id;
        } else {
          throw err;
        }
      }
    }

    // Atomically consume invitation and link user
    const updatedRecruiter = await CompanyRecruiterModel.findOneAndUpdate(
      {
        _id: recruiter._id,
        invitationTokenHash: tokenHash,
        status: 'pending_invitation',
        invitationExpiresAt: { $gt: new Date() },
      },
      {
        $set: {
          status: 'active',
          userId: targetUserId,
          acceptedAt: new Date(),
        },
        $unset: {
          invitationTokenHash: 1,
          invitationExpiresAt: 1,
        },
      },
      { new: true }
    );

    if (!updatedRecruiter) {
      throw new RecruiterError(
        'Invitation token is invalid, expired, or was already accepted concurrently.',
        'INVALID_OR_EXPIRED_TOKEN',
        400
      );
    }

    await AuditLogModel.create({
      orgId: updatedRecruiter.invitedByOrgId ?? undefined,
      userId: targetUserId,
      action: 'recruiter_invitation_accepted',
      details: {
        recruiterId: updatedRecruiter._id.toString(),
        companyId: updatedRecruiter.companyId.toString(),
        email: updatedRecruiter.email,
        role: updatedRecruiter.role,
        isExistingUser: !!existingUser,
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      timestamp: new Date(),
    });

    return formatRecruiter(updatedRecruiter);
  }

  /**
   * Lists recruiters for a company with pagination, sorting, and search.
   * College officers can view recruiters for companies in their directory.
   * Company users can view recruiters for their own company.
   */
  async listRecruiters(
    companyId: string,
    caller: CallerContext,
    filters: RecruiterQueryFilters
  ): Promise<PaginatedRecruiterListResponse> {
    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      throw new RecruiterError('Invalid company ID format.', 'INVALID_ID', 400);
    }
    const companyObjectId = new mongoose.Types.ObjectId(companyId);

    // Authorization check
    const isCollegeOfficer =
      caller.role === 'college_admin' ||
      caller.role === 'tpo' ||
      caller.role === 'dept_coordinator';

    const isCompanyUser =
      caller.role === 'company_admin' ||
      caller.role === 'company_recruiter' ||
      caller.role === 'interviewer';

    if (isCollegeOfficer) {
      if (!caller.orgId) {
        throw new RecruiterError(
          'Tenant context missing from session.',
          'TENANT_CONTEXT_REQUIRED',
          403
        );
      }
      const collegeProfile = await CollegeCompanyProfileModel.findOne({
        orgId: new mongoose.Types.ObjectId(caller.orgId),
        companyId: companyObjectId,
      });

      if (!collegeProfile) {
        throw new RecruiterError(
          'Company is not registered in your college directory.',
          'COMPANY_NOT_FOUND',
          404
        );
      }
    } else if (isCompanyUser) {
      const callerRecruiter = await CompanyRecruiterModel.findOne({
        companyId: companyObjectId,
        userId: new mongoose.Types.ObjectId(caller.userId),
        status: 'active',
      });

      if (!callerRecruiter) {
        throw new RecruiterError(
          'You are not authorized to view recruiters for this company.',
          'FORBIDDEN',
          403
        );
      }
    } else {
      throw new RecruiterError(
        'You do not have permission to view recruiters.',
        'FORBIDDEN',
        403
      );
    }

    const query: Record<string, unknown> = { companyId: companyObjectId };

    if (filters.status) {
      query.status = filters.status;
    }
    if (filters.role) {
      query.role = filters.role;
    }
    if (filters.search) {
      const searchRegex = { $regex: escapeRegex(filters.search), $options: 'i' };
      query.$or = [{ name: searchRegex }, { email: searchRegex }];
    }

    const total = await CompanyRecruiterModel.countDocuments(query);
    const totalPages = Math.ceil(total / filters.limit);
    const sortDirection: 1 | -1 = filters.sortOrder === 'asc' ? 1 : -1;
    const sortField = filters.sortBy;

    const recruiters = await CompanyRecruiterModel.find(query)
      .sort({ [sortField]: sortDirection })
      .skip((filters.page - 1) * filters.limit)
      .limit(filters.limit);

    return {
      items: recruiters.map(formatRecruiter),
      total,
      page: filters.page,
      limit: filters.limit,
      totalPages,
    };
  }

  /**
   * Resends an invitation token with a refreshed 7-day expiration.
   */
  async resendInvitation(
    companyId: string,
    recruiterId: string,
    caller: CallerContext,
    context: AuditContext
  ): Promise<RecruiterInviteResult> {
    if (
      !mongoose.Types.ObjectId.isValid(companyId) ||
      !mongoose.Types.ObjectId.isValid(recruiterId)
    ) {
      throw new RecruiterError('Invalid ID format.', 'INVALID_ID', 400);
    }

    const companyObjectId = new mongoose.Types.ObjectId(companyId);
    const recruiterObjectId = new mongoose.Types.ObjectId(recruiterId);

    await this.verifyManagePermission(companyObjectId, caller);

    const recruiter = await CompanyRecruiterModel.findOne({
      _id: recruiterObjectId,
      companyId: companyObjectId,
    });

    if (!recruiter) {
      throw new RecruiterError(
        'Recruiter not found for this company.',
        'RECRUITER_NOT_FOUND',
        404
      );
    }

    if (recruiter.status === 'active') {
      throw new RecruiterError(
        'Recruiter is already active. Cannot resend invitation.',
        'RECRUITER_ALREADY_ACTIVE',
        400
      );
    }

    const rawToken = generateSessionToken();
    const tokenHash = hashSessionToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    recruiter.status = 'pending_invitation';
    recruiter.invitationTokenHash = tokenHash;
    recruiter.invitationExpiresAt = expiresAt;
    await recruiter.save();

    await AuditLogModel.create({
      orgId: caller.orgId ? new mongoose.Types.ObjectId(caller.orgId) : undefined,
      userId: new mongoose.Types.ObjectId(caller.userId),
      action: 'recruiter_invitation_reissued',
      details: {
        recruiterId: recruiter._id.toString(),
        companyId: companyObjectId.toString(),
        email: recruiter.email,
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      timestamp: new Date(),
    });

    return {
      recruiter: formatRecruiter(recruiter),
      invitationToken: rawToken,
      invitationExpiresAt: expiresAt.toISOString(),
    };
  }

  /**
   * Revokes a pending invitation.
   */
  async revokeInvitation(
    companyId: string,
    recruiterId: string,
    caller: CallerContext,
    context: AuditContext
  ): Promise<RecruiterAssociationResponse> {
    if (
      !mongoose.Types.ObjectId.isValid(companyId) ||
      !mongoose.Types.ObjectId.isValid(recruiterId)
    ) {
      throw new RecruiterError('Invalid ID format.', 'INVALID_ID', 400);
    }

    const companyObjectId = new mongoose.Types.ObjectId(companyId);
    const recruiterObjectId = new mongoose.Types.ObjectId(recruiterId);

    await this.verifyManagePermission(companyObjectId, caller);

    const recruiter = await CompanyRecruiterModel.findOne({
      _id: recruiterObjectId,
      companyId: companyObjectId,
    });

    if (!recruiter) {
      throw new RecruiterError(
        'Recruiter not found for this company.',
        'RECRUITER_NOT_FOUND',
        404
      );
    }

    if (recruiter.status === 'active') {
      throw new RecruiterError(
        'Cannot revoke an already accepted invitation. Use deactivation instead.',
        'INVALID_STATUS_TRANSITION',
        400
      );
    }

    if (recruiter.status === 'inactive') {
      throw new RecruiterError(
        'Invitation is already revoked or inactive.',
        'NO_STATE_CHANGE',
        400
      );
    }

    recruiter.status = 'inactive';
    recruiter.invitationTokenHash = null;
    recruiter.invitationExpiresAt = null;
    await recruiter.save();

    await AuditLogModel.create({
      orgId: caller.orgId ? new mongoose.Types.ObjectId(caller.orgId) : undefined,
      userId: new mongoose.Types.ObjectId(caller.userId),
      action: 'recruiter_invitation_revoked',
      details: {
        recruiterId: recruiter._id.toString(),
        companyId: companyObjectId.toString(),
        email: recruiter.email,
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      timestamp: new Date(),
    });

    return formatRecruiter(recruiter);
  }

  /**
   * Deactivates an active recruiter.
   */
  async deactivateRecruiter(
    companyId: string,
    recruiterId: string,
    caller: CallerContext,
    context: AuditContext
  ): Promise<RecruiterAssociationResponse> {
    if (
      !mongoose.Types.ObjectId.isValid(companyId) ||
      !mongoose.Types.ObjectId.isValid(recruiterId)
    ) {
      throw new RecruiterError('Invalid ID format.', 'INVALID_ID', 400);
    }

    const companyObjectId = new mongoose.Types.ObjectId(companyId);
    const recruiterObjectId = new mongoose.Types.ObjectId(recruiterId);

    await this.verifyManagePermission(companyObjectId, caller);

    const recruiter = await CompanyRecruiterModel.findOne({
      _id: recruiterObjectId,
      companyId: companyObjectId,
    });

    if (!recruiter) {
      throw new RecruiterError(
        'Recruiter not found for this company.',
        'RECRUITER_NOT_FOUND',
        404
      );
    }

    if (recruiter.status === 'inactive') {
      throw new RecruiterError(
        'Recruiter is already inactive.',
        'NO_STATE_CHANGE',
        400
      );
    }

    if (recruiter.status === 'pending_invitation') {
      throw new RecruiterError(
        'Invitation is pending. Use revocation instead of deactivation.',
        'INVALID_STATUS_TRANSITION',
        400
      );
    }

    if (!isValidRecruiterStatusTransition(recruiter.status, 'inactive')) {
      throw new RecruiterError(
        `Invalid status transition from '${recruiter.status}' to 'inactive'.`,
        'INVALID_STATUS_TRANSITION',
        400
      );
    }

    recruiter.status = 'inactive';
    await recruiter.save();

    await AuditLogModel.create({
      orgId: caller.orgId ? new mongoose.Types.ObjectId(caller.orgId) : undefined,
      userId: new mongoose.Types.ObjectId(caller.userId),
      action: 'recruiter_deactivated',
      details: {
        recruiterId: recruiter._id.toString(),
        companyId: companyObjectId.toString(),
        email: recruiter.email,
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      timestamp: new Date(),
    });

    return formatRecruiter(recruiter);
  }

  /**
   * Internal helper to verify caller permission to manage (revoke, resend, deactivate) recruiters.
   */
  private async verifyManagePermission(
    companyObjectId: mongoose.Types.ObjectId,
    caller: CallerContext
  ): Promise<void> {
    const isCollegeOfficer =
      caller.role === 'college_admin' || caller.role === 'tpo';
    const isCompanyAdmin = caller.role === 'company_admin';

    if (isCollegeOfficer) {
      if (!caller.orgId) {
        throw new RecruiterError(
          'Tenant context missing from session.',
          'TENANT_CONTEXT_REQUIRED',
          403
        );
      }
      const collegeProfile = await CollegeCompanyProfileModel.findOne({
        orgId: new mongoose.Types.ObjectId(caller.orgId),
        companyId: companyObjectId,
      });

      if (!collegeProfile) {
        throw new RecruiterError(
          'Company is not registered in your college directory.',
          'COMPANY_NOT_FOUND',
          404
        );
      }
    } else if (isCompanyAdmin) {
      const adminRecord = await CompanyRecruiterModel.findOne({
        companyId: companyObjectId,
        userId: new mongoose.Types.ObjectId(caller.userId),
        role: 'company_admin',
        status: 'active',
      });

      if (!adminRecord) {
        throw new RecruiterError(
          'You are not an authorized company admin for this company.',
          'FORBIDDEN',
          403
        );
      }
    } else {
      throw new RecruiterError(
        'You do not have permission to manage recruiters.',
        'FORBIDDEN',
        403
      );
    }
  }
}

export const recruiterService = new RecruiterService();
