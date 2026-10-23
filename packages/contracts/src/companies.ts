import { z } from 'zod';

// ─── Enums & Value Schemas ───────────────────────────────────────────────────

export const CompanyStatusSchema = z.enum([
  'pending_verification',
  'verified',
  'blacklisted',
  'inactive',
]);
export type CompanyStatus = z.infer<typeof CompanyStatusSchema>;

export const CompanyTierSchema = z.enum([
  'tier_1',
  'tier_2',
  'tier_3',
  'mass_recruiter',
  'startup',
]);
export type CompanyTier = z.infer<typeof CompanyTierSchema>;

export const CompanyRecruiterRoleSchema = z.enum([
  'company_admin',
  'company_recruiter',
  'interviewer',
]);
export type CompanyRecruiterRole = z.infer<typeof CompanyRecruiterRoleSchema>;

export const RecruiterAssociationStatusSchema = z.enum([
  'active',
  'pending_invitation',
  'inactive',
]);
export type RecruiterAssociationStatus = z.infer<typeof RecruiterAssociationStatusSchema>;

/**
 * Normalizes email address by trimming whitespace and converting to lowercase.
 */
export const CompanyEmailSchema = z
  .string()
  .trim()
  .email('Please enter a valid email address')
  .transform((val) => val.toLowerCase());

/**
 * Normalizes website URLs using a conservative, deterministic policy:
 * - Lowercases scheme and hostname
 * - Strips default ports (80 for http, 443 for https)
 * - Strips trailing slash on root pathname
 * - Strips query parameters and hash fragments
 * - Preserves explicit subdomains and path components
 * - Returns null for invalid or missing URLs
 */
export function normalizeCompanyWebsite(url?: string | null): string | null {
  if (!url || typeof url !== 'string') {
    return null;
  }
  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    const hostname = parsed.hostname.toLowerCase();
    const isDefaultPort =
      (parsed.protocol === 'http:' && parsed.port === '80') ||
      (parsed.protocol === 'https:' && parsed.port === '443') ||
      !parsed.port;
    const host = isDefaultPort ? hostname : `${hostname}:${parsed.port}`;
    let pathname = parsed.pathname;
    if (pathname === '/') {
      pathname = '';
    } else if (pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }
    return `${parsed.protocol.toLowerCase()}//${host}${pathname}`;
  } catch {
    return null;
  }
}

/**
 * Validates website URLs, requiring http or https protocols.
 */
export const WebsiteUrlSchema = z
  .string()
  .trim()
  .url('Please enter a valid website URL')
  .refine(
    (url) => {
      try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch {
        return false;
      }
    },
    { message: 'Website URL must use HTTP or HTTPS protocol' }
  );

export const CompanyLocationSchema = z.object({
  city: z.string().trim().max(100, 'City cannot exceed 100 characters').optional().nullable(),
  state: z.string().trim().max(100, 'State cannot exceed 100 characters').optional().nullable(),
  country: z.string().trim().max(100, 'Country cannot exceed 100 characters').optional().nullable(),
  addressLine: z
    .string()
    .trim()
    .max(250, 'Address cannot exceed 250 characters')
    .optional()
    .nullable(),
});
export type CompanyLocation = z.infer<typeof CompanyLocationSchema>;

export const CompanyContactPersonSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Contact person name is required')
    .max(100, 'Contact person name cannot exceed 100 characters'),
  email: CompanyEmailSchema,
  phone: z
    .string()
    .trim()
    .min(7, 'Phone number must be at least 7 characters')
    .max(20, 'Phone number cannot exceed 20 characters')
    .optional()
    .nullable(),
  designation: z
    .string()
    .trim()
    .max(100, 'Designation cannot exceed 100 characters')
    .optional()
    .nullable(),
});
export type CompanyContactPerson = z.infer<typeof CompanyContactPersonSchema>;

export const CompanyVerificationDetailsSchema = z.object({
  verifiedBy: z.string().optional(),
  verifiedAt: z.string().datetime().optional(),
  remarks: z.string().trim().max(500, 'Remarks cannot exceed 500 characters').optional(),
});
export type CompanyVerificationDetails = z.infer<typeof CompanyVerificationDetailsSchema>;

// ─── Status State Machine & Permitted Transitions ─────────────────────────────

export const COMPANY_STATUS_TRANSITIONS: Record<CompanyStatus, readonly CompanyStatus[]> = {
  pending_verification: ['verified', 'blacklisted', 'inactive'],
  verified: ['blacklisted', 'inactive'],
  inactive: ['verified', 'blacklisted'],
  blacklisted: ['pending_verification', 'inactive'],
} as const;

export function isValidCompanyStatusTransition(from: CompanyStatus, to: CompanyStatus): boolean {
  if (from === to) return false;
  return COMPANY_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

export const RECRUITER_STATUS_TRANSITIONS: Record<
  RecruiterAssociationStatus,
  readonly RecruiterAssociationStatus[]
> = {
  pending_invitation: ['active', 'inactive'],
  active: ['inactive'],
  inactive: ['pending_invitation'],
} as const;

export function isValidRecruiterStatusTransition(
  from: RecruiterAssociationStatus,
  to: RecruiterAssociationStatus
): boolean {
  if (from === to) return false;
  return RECRUITER_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

// ─── Global Company Schemas ──────────────────────────────────────────────────

export const GlobalCompanySchema = z.object({
  id: z.string(),
  name: z.string(),
  legalName: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  industry: z.string(),
  description: z.string().optional().nullable(),
  location: CompanyLocationSchema.optional().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type GlobalCompany = z.infer<typeof GlobalCompanySchema>;

// ─── Client-Facing Request Schemas (No orgId accepted) ───────────────────────

/**
 * Creation schema for registering a company within a college's placement directory.
 * Sets up global identity details and college-specific metadata.
 * Verification status is always determined server-side (defaulting to pending_verification).
 * Website is optional to accommodate companies without an online presence.
 */
export const CompanyCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Company name must be at least 2 characters')
    .max(150, 'Company name cannot exceed 150 characters'),
  legalName: z
    .string()
    .trim()
    .min(2, 'Legal name must be at least 2 characters')
    .max(150, 'Legal name cannot exceed 150 characters')
    .optional()
    .nullable(),
  website: WebsiteUrlSchema.optional().nullable(),
  industry: z
    .string()
    .trim()
    .min(2, 'Industry must be at least 2 characters')
    .max(100, 'Industry cannot exceed 100 characters'),
  description: z
    .string()
    .trim()
    .max(2000, 'Description cannot exceed 2000 characters')
    .optional()
    .nullable(),
  tier: CompanyTierSchema.default('tier_3').optional(),
  location: CompanyLocationSchema.optional().nullable(),
  primaryContact: CompanyContactPersonSchema.optional().nullable(),
  notes: z.string().trim().max(1000, 'Notes cannot exceed 1000 characters').optional().nullable(),
});
export type CompanyCreateInput = z.infer<typeof CompanyCreateSchema>;

/**
 * Update schema for college-specific company relationship attributes.
 * College officers cannot modify global master company fields (name, website, industry, etc.)
 * through this tenant-scoped endpoint. Privileged attributes (status, tier) require dedicated endpoints.
 */
export const CompanyUpdateSchema = z
  .object({
    primaryContact: CompanyContactPersonSchema.optional().nullable(),
    notes: z.string().trim().max(1000, 'Notes cannot exceed 1000 characters').optional().nullable(),
  })
  .refine((data) => data.primaryContact !== undefined || data.notes !== undefined, {
    message: 'At least one field must be provided for update',
  });
export type CompanyUpdateInput = z.infer<typeof CompanyUpdateSchema>;

/**
 * Privileged verification schema restricted to college_admin / tpo.
 * Blacklisting requires a meaningful remark justifying the action.
 */
export const CompanyVerifyRequestSchema = z
  .object({
    status: CompanyStatusSchema,
    remarks: z
      .string()
      .trim()
      .max(500, 'Remarks cannot exceed 500 characters')
      .optional()
      .nullable(),
  })
  .refine(
    (data) => {
      if (data.status === 'blacklisted') {
        return !!data.remarks && data.remarks.trim().length >= 5;
      }
      return true;
    },
    {
      message: 'A meaningful remark (minimum 5 characters) is required when blacklisting a company',
      path: ['remarks'],
    }
  );
export type CompanyVerifyRequest = z.infer<typeof CompanyVerifyRequestSchema>;

/**
 * Privileged tier assignment schema restricted to college_admin / tpo.
 * Tier updates require an explicit reason explaining the change.
 */
export const CompanyTierUpdateRequestSchema = z.object({
  tier: CompanyTierSchema,
  reason: z
    .string()
    .trim()
    .min(5, 'A meaningful reason (minimum 5 characters) is required for tier updates')
    .max(500, 'Reason cannot exceed 500 characters'),
});
export type CompanyTierUpdateRequest = z.infer<typeof CompanyTierUpdateRequestSchema>;

/**
 * Recruiter invitation schema restricted to company_admin or college TPO inviting recruiters.
 * Disallows college-level roles.
 */
export const RecruiterInviteRequestSchema = z.object({
  companyId: z
    .string()
    .trim()
    .min(1, 'Company ID is required')
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid company ID format'),
  name: z
    .string()
    .trim()
    .min(2, 'Recruiter name must be at least 2 characters')
    .max(100, 'Recruiter name cannot exceed 100 characters'),
  email: CompanyEmailSchema,
  phone: z
    .string()
    .trim()
    .min(7, 'Phone number must be at least 7 characters')
    .max(20, 'Phone number cannot exceed 20 characters')
    .optional()
    .nullable(),
  designation: z
    .string()
    .trim()
    .max(100, 'Designation cannot exceed 100 characters')
    .optional()
    .nullable(),
  role: CompanyRecruiterRoleSchema.default('company_recruiter'),
});
export type RecruiterInviteRequest = z.infer<typeof RecruiterInviteRequestSchema>;

// ─── Query Filter & Pagination Schemas ────────────────────────────────────────

export const CompanyQueryFiltersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  status: CompanyStatusSchema.optional(),
  tier: CompanyTierSchema.optional(),
  industry: z.string().trim().optional(),
  sortBy: z.enum(['name', 'tier', 'status', 'createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
export type CompanyQueryFilters = z.infer<typeof CompanyQueryFiltersSchema>;

// ─── Response Schemas ────────────────────────────────────────────────────────

export const CollegeCompanyProfileResponseSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  orgId: z.string(),
  company: GlobalCompanySchema,
  status: CompanyStatusSchema,
  tier: CompanyTierSchema,
  verificationDetails: CompanyVerificationDetailsSchema.optional().nullable(),
  primaryContact: CompanyContactPersonSchema.optional().nullable(),
  notes: z.string().optional().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type CollegeCompanyProfileResponse = z.infer<typeof CollegeCompanyProfileResponseSchema>;

export const PaginatedCompanyListResponseSchema = z.object({
  items: z.array(CollegeCompanyProfileResponseSchema),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  limit: z.number().int().min(1),
  totalPages: z.number().int().min(0),
});
export type PaginatedCompanyListResponse = z.infer<typeof PaginatedCompanyListResponseSchema>;

export const RecruiterAssociationResponseSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  orgId: z.string().optional().nullable(),
  userId: z.string().optional().nullable(),
  name: z.string(),
  email: z.string(),
  phone: z.string().optional().nullable(),
  designation: z.string().optional().nullable(),
  role: CompanyRecruiterRoleSchema,
  status: RecruiterAssociationStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type RecruiterAssociationResponse = z.infer<typeof RecruiterAssociationResponseSchema>;

export const RecruiterAcceptInviteRequestSchema = z.object({
  token: z
    .string()
    .trim()
    .min(16, 'Invitation token must be at least 16 characters')
    .max(128, 'Invitation token cannot exceed 128 characters'),
  password: z.string().min(8, 'Password must be at least 8 characters long').optional(),
});
export type RecruiterAcceptInviteRequest = z.infer<typeof RecruiterAcceptInviteRequestSchema>;

export const RecruiterQueryFiltersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  role: CompanyRecruiterRoleSchema.optional(),
  status: RecruiterAssociationStatusSchema.optional(),
  sortBy: z.enum(['name', 'role', 'status', 'createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
export type RecruiterQueryFilters = z.infer<typeof RecruiterQueryFiltersSchema>;

export const PaginatedRecruiterListResponseSchema = z.object({
  items: z.array(RecruiterAssociationResponseSchema),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  limit: z.number().int().min(1),
  totalPages: z.number().int().min(0),
});
export type PaginatedRecruiterListResponse = z.infer<typeof PaginatedRecruiterListResponseSchema>;

export const RecruiterInviteResponseDataSchema = z.object({
  recruiter: RecruiterAssociationResponseSchema,
  invitationToken: z.string().optional(),
  invitationExpiresAt: z.string().datetime().optional(),
});
export type RecruiterInviteResponseData = z.infer<typeof RecruiterInviteResponseDataSchema>;
