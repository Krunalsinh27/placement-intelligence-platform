import type {
  CompanyCreateInput,
  CompanyUpdateInput,
  CompanyVerifyRequest,
  CompanyTierUpdateRequest,
  CompanyQueryFilters,
  CollegeCompanyProfileResponse,
  PaginatedCompanyListResponse,
  RecruiterInviteRequest,
  RecruiterAcceptInviteRequest,
  RecruiterQueryFilters,
  RecruiterAssociationResponse,
  PaginatedRecruiterListResponse,
  RecruiterInviteResponseData,
} from '@placement-platform/contracts';
import { apiRequest } from './client.js';
export { ApiError } from './client.js';

/**
 * Serializes supported company query filters into a URL query string.
 */
export function buildCompanyQueryString(filters?: Partial<CompanyQueryFilters>): string {
  if (!filters) return '';

  const params = new URLSearchParams();

  if (filters.page !== undefined && filters.page !== null) {
    params.set('page', String(filters.page));
  }
  if (filters.limit !== undefined && filters.limit !== null) {
    params.set('limit', String(filters.limit));
  }
  if (filters.search !== undefined && filters.search !== null && filters.search.trim() !== '') {
    params.set('search', filters.search.trim());
  }
  if (filters.status !== undefined && filters.status !== null) {
    params.set('status', filters.status);
  }
  if (filters.tier !== undefined && filters.tier !== null) {
    params.set('tier', filters.tier);
  }
  if (filters.industry !== undefined && filters.industry !== null && filters.industry.trim() !== '') {
    params.set('industry', filters.industry.trim());
  }
  if (filters.sortBy !== undefined && filters.sortBy !== null) {
    params.set('sortBy', filters.sortBy);
  }
  if (filters.sortOrder !== undefined && filters.sortOrder !== null) {
    params.set('sortOrder', filters.sortOrder);
  }

  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

/**
 * Serializes supported recruiter query filters into a URL query string.
 */
export function buildRecruiterQueryString(filters?: Partial<RecruiterQueryFilters>): string {
  if (!filters) return '';

  const params = new URLSearchParams();

  if (filters.page !== undefined && filters.page !== null) {
    params.set('page', String(filters.page));
  }
  if (filters.limit !== undefined && filters.limit !== null) {
    params.set('limit', String(filters.limit));
  }
  if (filters.search !== undefined && filters.search !== null && filters.search.trim() !== '') {
    params.set('search', filters.search.trim());
  }
  if (filters.status !== undefined && filters.status !== null) {
    params.set('status', filters.status);
  }
  if (filters.role !== undefined && filters.role !== null) {
    params.set('role', filters.role);
  }
  if (filters.sortBy !== undefined && filters.sortBy !== null) {
    params.set('sortBy', filters.sortBy);
  }
  if (filters.sortOrder !== undefined && filters.sortOrder !== null) {
    params.set('sortOrder', filters.sortOrder);
  }

  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

// ─── Company API Functions ────────────────────────────────────────────────────

/**
 * Retrieves a paginated list of companies registered in the college directory.
 */
export async function listCompanies(
  filters?: Partial<CompanyQueryFilters>
): Promise<PaginatedCompanyListResponse> {
  const qs = buildCompanyQueryString(filters);
  return apiRequest<PaginatedCompanyListResponse>(`/api/v1/companies${qs}`);
}

/**
 * Retrieves full details for a single company profile.
 */
export async function getCompany(id: string): Promise<CollegeCompanyProfileResponse> {
  return apiRequest<CollegeCompanyProfileResponse>(`/api/v1/companies/${encodeURIComponent(id)}`);
}

/**
 * Registers a new company relationship in the college directory.
 */
export async function createCompany(
  input: CompanyCreateInput
): Promise<CollegeCompanyProfileResponse> {
  return apiRequest<CollegeCompanyProfileResponse>('/api/v1/companies', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/**
 * Updates permitted college-specific company relationship fields (primaryContact, notes).
 */
export async function updateCompany(
  id: string,
  input: CompanyUpdateInput
): Promise<CollegeCompanyProfileResponse> {
  return apiRequest<CollegeCompanyProfileResponse>(
    `/api/v1/companies/${encodeURIComponent(id)}`,
    {
      method: 'PUT',
      body: JSON.stringify(input),
    }
  );
}

/**
 * Updates company verification status (privileged action for college_admin / tpo).
 */
export async function verifyCompany(
  id: string,
  input: CompanyVerifyRequest
): Promise<CollegeCompanyProfileResponse> {
  return apiRequest<CollegeCompanyProfileResponse>(
    `/api/v1/companies/${encodeURIComponent(id)}/verify`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    }
  );
}

/**
 * Updates company tier (privileged action for college_admin / tpo).
 */
export async function updateCompanyTier(
  id: string,
  input: CompanyTierUpdateRequest
): Promise<CollegeCompanyProfileResponse> {
  return apiRequest<CollegeCompanyProfileResponse>(
    `/api/v1/companies/${encodeURIComponent(id)}/tier`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    }
  );
}

// ─── Recruiter API Functions ──────────────────────────────────────────────────

/**
 * Lists recruiters for a company with pagination, sorting, and search.
 */
export async function listRecruiters(
  companyId: string,
  filters?: Partial<RecruiterQueryFilters>
): Promise<PaginatedRecruiterListResponse> {
  const qs = buildRecruiterQueryString(filters);
  return apiRequest<PaginatedRecruiterListResponse>(
    `/api/v1/companies/${encodeURIComponent(companyId)}/recruiters${qs}`
  );
}

/**
 * Invites a recruiter or interviewer for a company.
 */
export async function inviteRecruiter(
  companyId: string,
  input: Omit<RecruiterInviteRequest, 'companyId'> & { companyId?: string }
): Promise<RecruiterInviteResponseData> {
  const payload: RecruiterInviteRequest = {
    ...input,
    companyId: input.companyId || companyId,
  };
  return apiRequest<RecruiterInviteResponseData>(
    `/api/v1/companies/${encodeURIComponent(companyId)}/recruiters/invite`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
}

/**
 * Resends an invitation token with a refreshed 7-day expiration.
 */
export async function resendRecruiterInvitation(
  companyId: string,
  recruiterId: string
): Promise<RecruiterInviteResponseData> {
  return apiRequest<RecruiterInviteResponseData>(
    `/api/v1/companies/${encodeURIComponent(companyId)}/recruiters/${encodeURIComponent(recruiterId)}/resend`,
    {
      method: 'POST',
    }
  );
}

/**
 * Revokes a pending recruiter invitation.
 */
export async function revokeRecruiterInvitation(
  companyId: string,
  recruiterId: string
): Promise<RecruiterAssociationResponse> {
  return apiRequest<RecruiterAssociationResponse>(
    `/api/v1/companies/${encodeURIComponent(companyId)}/recruiters/${encodeURIComponent(recruiterId)}/revoke`,
    {
      method: 'POST',
    }
  );
}

/**
 * Deactivates an active recruiter.
 */
export async function deactivateRecruiter(
  companyId: string,
  recruiterId: string
): Promise<RecruiterAssociationResponse> {
  return apiRequest<RecruiterAssociationResponse>(
    `/api/v1/companies/${encodeURIComponent(companyId)}/recruiters/${encodeURIComponent(recruiterId)}/deactivate`,
    {
      method: 'POST',
    }
  );
}

/**
 * Accepts an invitation using a raw cryptographic token.
 */
export async function acceptRecruiterInvitation(
  input: RecruiterAcceptInviteRequest
): Promise<RecruiterAssociationResponse> {
  return apiRequest<RecruiterAssociationResponse>('/api/v1/recruiters/accept-invitation', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
