import mongoose from 'mongoose';
import { CompanyModel, type ICompany } from '../../models/company.model.js';
import {
  CollegeCompanyProfileModel,
  type ICollegeCompanyProfile,
} from '../../models/college-company-profile.model.js';
import { AuditLogModel } from '../../models/audit-log.model.js';
import {
  type CompanyCreateInput,
  type CompanyUpdateInput,
  type CompanyVerifyRequest,
  type CompanyTierUpdateRequest,
  type CompanyQueryFilters,
  type CollegeCompanyProfileResponse,
  type PaginatedCompanyListResponse,
  isValidCompanyStatusTransition,
  normalizeCompanyWebsite,
} from '@placement-platform/contracts';

export interface AuditContext {
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export class CompanyError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'CompanyError';
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatCollegeCompany(
  profileDoc: Pick<
    ICollegeCompanyProfile,
    | '_id'
    | 'orgId'
    | 'status'
    | 'tier'
    | 'verificationDetails'
    | 'primaryContact'
    | 'notes'
    | 'createdAt'
    | 'updatedAt'
  >,
  companyDoc: ICompany
): CollegeCompanyProfileResponse {
  return {
    id: profileDoc._id.toString(),
    companyId: companyDoc._id.toString(),
    orgId: profileDoc.orgId.toString(),
    company: {
      id: companyDoc._id.toString(),
      name: companyDoc.name,
      legalName: companyDoc.legalName ?? null,
      website: companyDoc.website ?? null,
      industry: companyDoc.industry,
      description: companyDoc.description ?? null,
      location: companyDoc.location
        ? {
            city: companyDoc.location.city ?? null,
            state: companyDoc.location.state ?? null,
            country: companyDoc.location.country ?? null,
            addressLine: companyDoc.location.addressLine ?? null,
          }
        : null,
      createdAt: companyDoc.createdAt.toISOString(),
      updatedAt: companyDoc.updatedAt.toISOString(),
    },
    status: profileDoc.status,
    tier: profileDoc.tier,
    verificationDetails: profileDoc.verificationDetails
      ? {
          verifiedBy: profileDoc.verificationDetails.verifiedBy
            ? profileDoc.verificationDetails.verifiedBy.toString()
            : undefined,
          verifiedAt: profileDoc.verificationDetails.verifiedAt
            ? profileDoc.verificationDetails.verifiedAt.toISOString()
            : undefined,
          remarks: profileDoc.verificationDetails.remarks ?? undefined,
        }
      : null,
    primaryContact: profileDoc.primaryContact
      ? {
          name: profileDoc.primaryContact.name,
          email: profileDoc.primaryContact.email,
          phone: profileDoc.primaryContact.phone ?? null,
          designation: profileDoc.primaryContact.designation ?? null,
        }
      : null,
    notes: profileDoc.notes ?? null,
    createdAt: profileDoc.createdAt.toISOString(),
    updatedAt: profileDoc.updatedAt.toISOString(),
  };
}

export class CompanyService {
  /**
   * Registers a company relationship for the authenticated college.
   * If the global company does not exist, creates it.
   * If an existing company is found by website, checks for conflicting details.
   */
  async createCompany(
    orgId: string,
    input: CompanyCreateInput,
    context: AuditContext
  ): Promise<CollegeCompanyProfileResponse> {
    const orgObjectId = new mongoose.Types.ObjectId(orgId);
    const normalizedWebsite = normalizeCompanyWebsite(input.website);

    // 1. Check if global company already exists with this normalized website (if website provided)
    let company: ICompany | null = null;

    if (normalizedWebsite) {
      company = await CompanyModel.findOne({ website: normalizedWebsite });
    }

    if (company) {
      // Conflict detection: verify that submitted core details do not contradict the existing company
      const nameConflict =
        input.name.trim().toLowerCase() !== company.name.trim().toLowerCase();
      const industryConflict =
        input.industry.trim().toLowerCase() !== company.industry.trim().toLowerCase();

      if (nameConflict || industryConflict) {
        throw new CompanyError(
          `A company with website '${company.website}' already exists as '${company.name}' (${company.industry}). The submitted details ('${input.name.trim()}', '${input.industry.trim()}') conflict with the existing record.`,
          'COMPANY_DATA_CONFLICT',
          409
        );
      }
    } else {
      try {
        company = await CompanyModel.create({
          name: input.name.trim(),
          legalName: input.legalName?.trim() || null,
          website: normalizedWebsite,
          industry: input.industry.trim(),
          description: input.description?.trim() || null,
          location: input.location
            ? {
                city: input.location.city?.trim() || null,
                state: input.location.state?.trim() || null,
                country: input.location.country?.trim() || null,
                addressLine: input.location.addressLine?.trim() || null,
              }
            : null,
        });
      } catch (err: unknown) {
        // Safe duplicate-key handling for concurrent creation
        if (
          normalizedWebsite &&
          typeof err === 'object' &&
          err !== null &&
          'code' in err &&
          (err as { code: number }).code === 11000
        ) {
          company = await CompanyModel.findOne({ website: normalizedWebsite });
          if (!company) {
            throw err;
          }
          // Validate conflicts on concurrently created company
          const nameConflict =
            input.name.trim().toLowerCase() !== company.name.trim().toLowerCase();
          const industryConflict =
            input.industry.trim().toLowerCase() !== company.industry.trim().toLowerCase();

          if (nameConflict || industryConflict) {
            throw new CompanyError(
              `A company with website '${company.website}' already exists as '${company.name}' (${company.industry}). The submitted details conflict with the existing record.`,
              'COMPANY_DATA_CONFLICT',
              409
            );
          }
        } else {
          throw err;
        }
      }
    }

    // 2. Check if this college already has an active or pending association with this company
    const existingProfile = await CollegeCompanyProfileModel.findOne({
      orgId: orgObjectId,
      companyId: company._id,
    });

    if (existingProfile) {
      throw new CompanyError(
        'This company is already registered in your college directory.',
        'DUPLICATE_RESOURCE',
        409
      );
    }

    // 3. Create the college-specific relationship profile with duplicate race safety
    let profile: ICollegeCompanyProfile;
    try {
      profile = await CollegeCompanyProfileModel.create({
        orgId: orgObjectId,
        companyId: company._id,
        status: 'pending_verification',
        tier: input.tier || 'tier_3',
        primaryContact: input.primaryContact
          ? {
              name: input.primaryContact.name.trim(),
              email: input.primaryContact.email.trim().toLowerCase(),
              phone: input.primaryContact.phone?.trim() || null,
              designation: input.primaryContact.designation?.trim() || null,
            }
          : null,
        notes: input.notes?.trim() || null,
      });
    } catch (err: unknown) {
      if (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code: number }).code === 11000
      ) {
        throw new CompanyError(
          'This company is already registered in your college directory.',
          'DUPLICATE_RESOURCE',
          409
        );
      }
      throw err;
    }

    // 4. Record audit log
    await AuditLogModel.create({
      orgId: orgObjectId,
      userId: context.userId ? new mongoose.Types.ObjectId(context.userId) : undefined,
      action: 'company_created',
      details: {
        collegeCompanyId: profile._id.toString(),
        companyId: company._id.toString(),
        name: company.name,
        tier: profile.tier,
        status: profile.status,
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      timestamp: new Date(),
    });

    return formatCollegeCompany(profile, company);
  }

  /**
   * Lists and searches company profiles for the authenticated college.
   * Performs database-side full result set sorting across page boundaries.
   */
  async listCompanies(
    orgId: string,
    filters: CompanyQueryFilters
  ): Promise<PaginatedCompanyListResponse> {
    const orgObjectId = new mongoose.Types.ObjectId(orgId);
    const profileQuery: Record<string, unknown> = { orgId: orgObjectId };

    if (filters.status) {
      profileQuery.status = filters.status;
    }
    if (filters.tier) {
      profileQuery.tier = filters.tier;
    }

    // Filter by global company properties (name or industry) if provided
    if (filters.search || filters.industry) {
      const companyQuery: Record<string, unknown> = {};
      if (filters.search) {
        companyQuery.name = { $regex: escapeRegex(filters.search), $options: 'i' };
      }
      if (filters.industry) {
        companyQuery.industry = { $regex: escapeRegex(filters.industry), $options: 'i' };
      }

      const matchingCompanies = await CompanyModel.find(companyQuery).select('_id');
      const matchingCompanyIds = matchingCompanies.map((c) => c._id);
      profileQuery.companyId = { $in: matchingCompanyIds };
    }

    const total = await CollegeCompanyProfileModel.countDocuments(profileQuery);
    const totalPages = Math.ceil(total / filters.limit);
    const sortDirection: 1 | -1 = filters.sortOrder === 'asc' ? 1 : -1;

    // Database-level sorting across the full result set before skip/limit pagination
    if (filters.sortBy === 'name') {
      const aggregateResult = await CollegeCompanyProfileModel.aggregate<{
        _id: mongoose.Types.ObjectId;
        orgId: mongoose.Types.ObjectId;
        companyId: mongoose.Types.ObjectId;
        status: ICollegeCompanyProfile['status'];
        tier: ICollegeCompanyProfile['tier'];
        verificationDetails: ICollegeCompanyProfile['verificationDetails'];
        primaryContact: ICollegeCompanyProfile['primaryContact'];
        notes: ICollegeCompanyProfile['notes'];
        createdAt: Date;
        updatedAt: Date;
        companyDoc: ICompany;
      }>([
        { $match: profileQuery },
        {
          $lookup: {
            from: 'companies',
            localField: 'companyId',
            foreignField: '_id',
            as: 'companyDoc',
          },
        },
        { $unwind: '$companyDoc' },
        {
          $sort: {
            'companyDoc.name': sortDirection,
            _id: sortDirection,
          },
        },
        { $skip: (filters.page - 1) * filters.limit },
        { $limit: filters.limit },
      ]);

      const items: CollegeCompanyProfileResponse[] = aggregateResult.map((doc) =>
        formatCollegeCompany(doc, doc.companyDoc)
      );

      return {
        items,
        total,
        page: filters.page,
        limit: filters.limit,
        totalPages,
      };
    }

    // For profile-level fields (createdAt, status, tier), query directly on collection
    const sortField = filters.sortBy;
    const sortOptions: Record<string, 1 | -1> = { [sortField]: sortDirection };

    const docProfiles = await CollegeCompanyProfileModel.find(profileQuery)
      .sort(sortOptions)
      .skip((filters.page - 1) * filters.limit)
      .limit(filters.limit)
      .populate<{ companyId: ICompany }>('companyId');

    const items: CollegeCompanyProfileResponse[] = [];
    for (const profile of docProfiles) {
      if (profile.companyId && typeof profile.companyId === 'object') {
        items.push(formatCollegeCompany(profile, profile.companyId));
      }
    }

    return {
      items,
      total,
      page: filters.page,
      limit: filters.limit,
      totalPages,
    };
  }

  /**
   * Retrieves a single college company profile by its ID.
   */
  async getCompanyById(
    orgId: string,
    id: string
  ): Promise<CollegeCompanyProfileResponse> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new CompanyError('Invalid company ID format.', 'INVALID_ID', 400);
    }

    const orgObjectId = new mongoose.Types.ObjectId(orgId);
    const profile = await CollegeCompanyProfileModel.findOne({
      _id: new mongoose.Types.ObjectId(id),
      orgId: orgObjectId,
    });

    if (!profile) {
      throw new CompanyError(
        'Company profile not found in your college directory.',
        'COMPANY_NOT_FOUND',
        404
      );
    }

    const company = await CompanyModel.findById(profile.companyId);
    if (!company) {
      throw new CompanyError(
        'Referenced global company does not exist.',
        'GLOBAL_COMPANY_NOT_FOUND',
        404
      );
    }

    return formatCollegeCompany(profile, company);
  }

  /**
   * Updates permitted college-specific company relationship fields (primaryContact, notes).
   * College officers cannot modify global master company fields or privileged status/tier.
   */
  async updateCompany(
    orgId: string,
    id: string,
    input: CompanyUpdateInput,
    context: AuditContext
  ): Promise<CollegeCompanyProfileResponse> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new CompanyError('Invalid company ID format.', 'INVALID_ID', 400);
    }

    const orgObjectId = new mongoose.Types.ObjectId(orgId);
    const profile = await CollegeCompanyProfileModel.findOne({
      _id: new mongoose.Types.ObjectId(id),
      orgId: orgObjectId,
    });

    if (!profile) {
      throw new CompanyError(
        'Company profile not found in your college directory.',
        'COMPANY_NOT_FOUND',
        404
      );
    }

    const company = await CompanyModel.findById(profile.companyId);
    if (!company) {
      throw new CompanyError(
        'Referenced global company does not exist.',
        'GLOBAL_COMPANY_NOT_FOUND',
        404
      );
    }

    // Update college-specific fields only (Global company master is untouched)
    if (input.primaryContact !== undefined) {
      profile.primaryContact = input.primaryContact
        ? {
            name: input.primaryContact.name.trim(),
            email: input.primaryContact.email.trim().toLowerCase(),
            phone: input.primaryContact.phone?.trim() || null,
            designation: input.primaryContact.designation?.trim() || null,
          }
        : null;
    }
    if (input.notes !== undefined) {
      profile.notes = input.notes?.trim() || null;
    }

    await profile.save();

    // Record audit log
    await AuditLogModel.create({
      orgId: orgObjectId,
      userId: context.userId ? new mongoose.Types.ObjectId(context.userId) : undefined,
      action: 'company_updated',
      details: {
        collegeCompanyId: profile._id.toString(),
        companyId: company._id.toString(),
        updatedFields: Object.keys(input),
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      timestamp: new Date(),
    });

    return formatCollegeCompany(profile, company);
  }

  /**
   * Updates company verification status (privileged action for college_admin / tpo).
   * Enforces status transition state machine, prevents duplicate transitions,
   * and requires justification for sensitive transitions.
   */
  async verifyCompany(
    orgId: string,
    id: string,
    input: CompanyVerifyRequest,
    context: AuditContext
  ): Promise<CollegeCompanyProfileResponse> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new CompanyError('Invalid company ID format.', 'INVALID_ID', 400);
    }

    const orgObjectId = new mongoose.Types.ObjectId(orgId);
    const profile = await CollegeCompanyProfileModel.findOne({
      _id: new mongoose.Types.ObjectId(id),
      orgId: orgObjectId,
    });

    if (!profile) {
      throw new CompanyError(
        'Company profile not found in your college directory.',
        'COMPANY_NOT_FOUND',
        404
      );
    }

    const company = await CompanyModel.findById(profile.companyId);
    if (!company) {
      throw new CompanyError(
        'Referenced global company does not exist.',
        'GLOBAL_COMPANY_NOT_FOUND',
        404
      );
    }

    // 1. Prevent repeated identical transitions
    if (profile.status === input.status) {
      throw new CompanyError(
        `Company is already in '${input.status}' status.`,
        'NO_STATE_CHANGE',
        400
      );
    }

    // 2. Validate permitted transition via state machine
    if (!isValidCompanyStatusTransition(profile.status, input.status)) {
      throw new CompanyError(
        `Invalid status transition from '${profile.status}' to '${input.status}'.`,
        'INVALID_STATUS_TRANSITION',
        400
      );
    }

    // 3. Sensitive transition reason requirement
    if (
      (input.status === 'blacklisted' || profile.status === 'blacklisted') &&
      (!input.remarks || input.remarks.trim().length < 5)
    ) {
      throw new CompanyError(
        'A detailed remark (minimum 5 characters) is required for this status transition.',
        'REMARKS_REQUIRED',
        400
      );
    }

    const previousStatus = profile.status;
    profile.status = input.status;

    if (input.status === 'verified') {
      profile.verificationDetails = {
        verifiedBy: context.userId ? new mongoose.Types.ObjectId(context.userId) : null,
        verifiedAt: new Date(),
        remarks: input.remarks?.trim() || null,
      };
    } else if (input.remarks) {
      profile.verificationDetails = {
        verifiedBy:
          profile.verificationDetails?.verifiedBy ??
          (context.userId ? new mongoose.Types.ObjectId(context.userId) : null),
        verifiedAt: profile.verificationDetails?.verifiedAt ?? new Date(),
        remarks: input.remarks.trim(),
      };
    }

    await profile.save();

    // Record immutable audit event with full transition history
    await AuditLogModel.create({
      orgId: orgObjectId,
      userId: context.userId ? new mongoose.Types.ObjectId(context.userId) : undefined,
      action: 'company_verified',
      details: {
        collegeCompanyId: profile._id.toString(),
        companyId: company._id.toString(),
        previousStatus,
        newStatus: input.status,
        remarks: input.remarks?.trim() || null,
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      timestamp: new Date(),
    });

    return formatCollegeCompany(profile, company);
  }

  /**
   * Updates company tier (privileged action for college_admin / tpo).
   * Prevents duplicate tier assignments and requires explicit justification.
   */
  async updateTier(
    orgId: string,
    id: string,
    input: CompanyTierUpdateRequest,
    context: AuditContext
  ): Promise<CollegeCompanyProfileResponse> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new CompanyError('Invalid company ID format.', 'INVALID_ID', 400);
    }

    const orgObjectId = new mongoose.Types.ObjectId(orgId);
    const profile = await CollegeCompanyProfileModel.findOne({
      _id: new mongoose.Types.ObjectId(id),
      orgId: orgObjectId,
    });

    if (!profile) {
      throw new CompanyError(
        'Company profile not found in your college directory.',
        'COMPANY_NOT_FOUND',
        404
      );
    }

    const company = await CompanyModel.findById(profile.companyId);
    if (!company) {
      throw new CompanyError(
        'Referenced global company does not exist.',
        'GLOBAL_COMPANY_NOT_FOUND',
        404
      );
    }

    // Prevent repeated identical tier assignments
    if (profile.tier === input.tier) {
      throw new CompanyError(
        `Company is already assigned to '${input.tier}'.`,
        'NO_STATE_CHANGE',
        400
      );
    }

    if (!input.reason || input.reason.trim().length < 5) {
      throw new CompanyError(
        'A meaningful reason (minimum 5 characters) is required for tier updates.',
        'REASON_REQUIRED',
        400
      );
    }

    const previousTier = profile.tier;
    profile.tier = input.tier;

    await profile.save();

    // Record audit log
    await AuditLogModel.create({
      orgId: orgObjectId,
      userId: context.userId ? new mongoose.Types.ObjectId(context.userId) : undefined,
      action: 'company_tier_updated',
      details: {
        collegeCompanyId: profile._id.toString(),
        companyId: company._id.toString(),
        previousTier,
        newTier: input.tier,
        reason: input.reason.trim(),
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      timestamp: new Date(),
    });

    return formatCollegeCompany(profile, company);
  }
}

export const companyService = new CompanyService();
