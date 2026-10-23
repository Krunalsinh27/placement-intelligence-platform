import { describe, it, expect } from 'vitest';
import {
  CompanyCreateSchema,
  CompanyUpdateSchema,
  CompanyVerifyRequestSchema,
  CompanyTierUpdateRequestSchema,
  RecruiterInviteRequestSchema,
  CompanyQueryFiltersSchema,
  GlobalCompanySchema,
  CollegeCompanyProfileResponseSchema,
  PaginatedCompanyListResponseSchema,
  RecruiterAssociationResponseSchema,
  normalizeCompanyWebsite,
  isValidCompanyStatusTransition,
  isValidRecruiterStatusTransition,
  RECRUITER_STATUS_TRANSITIONS,
  RecruiterAcceptInviteRequestSchema,
  RecruiterQueryFiltersSchema,
  PaginatedRecruiterListResponseSchema,
  RecruiterInviteResponseDataSchema,
} from '../companies.js';

describe('Company and Recruiter Contracts', () => {
  const validCompanyId = '507f1f77bcf86cd799439011';
  const validOrgId = '507f1f77bcf86cd799439022';

  const baseValidCompanyInput = {
    name: 'Acme Corporation',
    legalName: 'Acme Technologies Pvt Ltd',
    website: 'https://acme.example.com',
    industry: 'Enterprise Software',
    description: 'Global leader in cloud automation and enterprise infrastructure.',
    tier: 'tier_1' as const,
    location: {
      city: 'Bengaluru',
      state: 'Karnataka',
      country: 'India',
      addressLine: 'Block C, Electronic City Phase 1',
    },
    primaryContact: {
      name: 'Rohan Sharma',
      email: '  Rohan.Sharma@ACME.EXAMPLE.COM  ',
      phone: '+91 9876543210',
      designation: 'Lead Campus Recruiter',
    },
    notes: 'Key recruiter for 2026 computer science batch.',
  };

  describe('CompanyCreateSchema', () => {
    it('validates a valid company and normalizes primary contact email', () => {
      const result = CompanyCreateSchema.safeParse(baseValidCompanyInput);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Acme Corporation');
        expect(result.data.website).toBe('https://acme.example.com');
        expect(result.data.tier).toBe('tier_1');
        expect(result.data.primaryContact?.email).toBe('rohan.sharma@acme.example.com');
        expect(result.data.primaryContact?.name).toBe('Rohan Sharma');
        expect(result.data.location?.city).toBe('Bengaluru');
      }
    });

    it('defaults tier to tier_3 when omitted', () => {
      const { tier: _, ...inputWithoutTier } = baseValidCompanyInput;
      const result = CompanyCreateSchema.safeParse(inputWithoutTier);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tier).toBe('tier_3');
      }
    });

    it('accepts all valid company tiers', () => {
      const tiers = ['tier_1', 'tier_2', 'tier_3', 'mass_recruiter', 'startup'] as const;
      for (const tier of tiers) {
        const result = CompanyCreateSchema.safeParse({
          ...baseValidCompanyInput,
          tier,
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.tier).toBe(tier);
        }
      }
    });

    it('rejects unrecognized company tier', () => {
      const result = CompanyCreateSchema.safeParse({
        ...baseValidCompanyInput,
        tier: 'super_dream', // Not in approved tier enum
      });

      expect(result.success).toBe(false);
    });

    it('accepts both http and https website URLs', () => {
      const httpResult = CompanyCreateSchema.safeParse({
        ...baseValidCompanyInput,
        website: 'http://acme.org',
      });
      expect(httpResult.success).toBe(true);

      const httpsResult = CompanyCreateSchema.safeParse({
        ...baseValidCompanyInput,
        website: 'https://secure.acme.org/careers',
      });
      expect(httpsResult.success).toBe(true);
    });

    it('rejects website URLs with non-http/https protocols (e.g. ftp, javascript)', () => {
      const ftpResult = CompanyCreateSchema.safeParse({
        ...baseValidCompanyInput,
        website: 'ftp://ftp.acme.org',
      });
      expect(ftpResult.success).toBe(false);
      if (!ftpResult.success) {
        expect(ftpResult.error.issues[0]?.message).toMatch(/http or https/i);
      }

      const jsResult = CompanyCreateSchema.safeParse({
        ...baseValidCompanyInput,
        website: 'javascript:alert(1)',
      });
      expect(jsResult.success).toBe(false);
    });

    it('rejects malformed website URLs without protocol', () => {
      const result = CompanyCreateSchema.safeParse({
        ...baseValidCompanyInput,
        website: 'acme.example.com',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toMatch(/valid website URL/i);
      }
    });

    it('rejects company name shorter than 2 characters', () => {
      const result = CompanyCreateSchema.safeParse({
        ...baseValidCompanyInput,
        name: 'A',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toMatch(/at least 2 characters/i);
      }
    });

    it('rejects company name longer than 150 characters', () => {
      const result = CompanyCreateSchema.safeParse({
        ...baseValidCompanyInput,
        name: 'A'.repeat(151),
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toMatch(/cannot exceed 150 characters/i);
      }
    });

    it('rejects invalid primary contact email', () => {
      const result = CompanyCreateSchema.safeParse({
        ...baseValidCompanyInput,
        primaryContact: {
          ...baseValidCompanyInput.primaryContact,
          email: 'not-an-email',
        },
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toMatch(/valid email address/i);
      }
    });

    it('strips client-supplied orgId, status, and verification fields', () => {
      const result = CompanyCreateSchema.safeParse({
        ...baseValidCompanyInput,
        orgId: 'attacker-injected-org',
        status: 'verified',
        isVerified: true,
        verificationDetails: {
          verifiedBy: 'attacker',
        },
      });

      expect(result.success).toBe(true);
      if (result.success) {
        const raw = result.data as Record<string, unknown>;
        expect(raw['orgId']).toBeUndefined();
        expect(raw['status']).toBeUndefined();
        expect(raw['isVerified']).toBeUndefined();
        expect(raw['verificationDetails']).toBeUndefined();
      }
    });
  });

  describe('CompanyUpdateSchema', () => {
    it('rejects empty update payload', () => {
      const result = CompanyUpdateSchema.safeParse({});
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toMatch(/at least one field/i);
      }
    });

    it('accepts update of permitted college-specific fields (primaryContact and notes)', () => {
      const result = CompanyUpdateSchema.safeParse({
        primaryContact: {
          name: 'Ananya Verma',
          email: 'ananya@acme.example.com',
          phone: '+91 9876543210',
          designation: 'Campus Relationship Lead',
        },
        notes: 'Priority recruiter for next campus season.',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.primaryContact?.name).toBe('Ananya Verma');
        expect(result.data.notes).toBe('Priority recruiter for next campus season.');
      }
    });

    it('rejects payload containing only global company fields (name, industry, website)', () => {
      const result = CompanyUpdateSchema.safeParse({
        name: 'Acme Cloud Technologies',
        industry: 'Cloud Infrastructure',
        website: 'https://newdomain.com',
      });
      // Global company fields are stripped, leaving empty object which fails the at-least-one-field refinement
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toMatch(/at least one field/i);
      }
    });

    it('strips status, tier, and orgId from update payload', () => {
      const result = CompanyUpdateSchema.safeParse({
        notes: 'Valid note update',
        status: 'verified',
        tier: 'tier_1',
        orgId: 'attacker-org',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        const raw = result.data as Record<string, unknown>;
        expect(raw['notes']).toBe('Valid note update');
        expect(raw['status']).toBeUndefined();
        expect(raw['tier']).toBeUndefined();
        expect(raw['orgId']).toBeUndefined();
      }
    });
  });

  describe('CompanyVerifyRequestSchema', () => {
    it('validates verification status with optional remarks for non-blacklist status', () => {
      const result = CompanyVerifyRequestSchema.safeParse({
        status: 'verified',
        remarks: 'GST and corporate registration verified against MCA portal.',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('verified');
        expect(result.data.remarks).toBe(
          'GST and corporate registration verified against MCA portal.'
        );
      }
    });

    it('accepts blacklisted status with mandatory detailed remarks', () => {
      const blacklisted = CompanyVerifyRequestSchema.safeParse({
        status: 'blacklisted',
        remarks: 'Revoked offers without cause in 2025 season.',
      });
      expect(blacklisted.success).toBe(true);
    });

    it('rejects blacklisted status when remarks are missing or too short', () => {
      const missingRemarks = CompanyVerifyRequestSchema.safeParse({
        status: 'blacklisted',
      });
      expect(missingRemarks.success).toBe(false);
      if (!missingRemarks.success) {
        expect(missingRemarks.error.issues[0]?.message).toMatch(/meaningful remark/i);
      }

      const shortRemarks = CompanyVerifyRequestSchema.safeParse({
        status: 'blacklisted',
        remarks: 'bad',
      });
      expect(shortRemarks.success).toBe(false);
    });

    it('accepts inactive status without remarks', () => {
      const inactive = CompanyVerifyRequestSchema.safeParse({
        status: 'inactive',
      });
      expect(inactive.success).toBe(true);
    });

    it('rejects invalid status value', () => {
      const result = CompanyVerifyRequestSchema.safeParse({
        status: 'approved_unconditionally',
      });
      expect(result.success).toBe(false);
    });

    it('strips client-supplied orgId', () => {
      const result = CompanyVerifyRequestSchema.safeParse({
        status: 'verified',
        orgId: 'malicious-org-override',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.data as Record<string, unknown>)['orgId']).toBeUndefined();
      }
    });
  });

  describe('CompanyTierUpdateRequestSchema', () => {
    it('validates tier update with mandatory reason', () => {
      const result = CompanyTierUpdateRequestSchema.safeParse({
        tier: 'tier_1',
        reason: 'Offered 25 LPA CTC in previous cycle',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tier).toBe('tier_1');
        expect(result.data.reason).toBe('Offered 25 LPA CTC in previous cycle');
      }
    });

    it('rejects tier update when reason is missing or shorter than 5 chars', () => {
      const missingReason = CompanyTierUpdateRequestSchema.safeParse({
        tier: 'tier_1',
      });
      expect(missingReason.success).toBe(false);

      const shortReason = CompanyTierUpdateRequestSchema.safeParse({
        tier: 'tier_1',
        reason: 'ok',
      });
      expect(shortReason.success).toBe(false);
    });

    it('rejects unrecognized tier', () => {
      const result = CompanyTierUpdateRequestSchema.safeParse({
        tier: 'tier_vip',
        reason: 'Valid reason for upgrade',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Status State Machine & Website Normalization Utilities', () => {
    it('correctly validates allowed and disallowed company status transitions', () => {
      expect(isValidCompanyStatusTransition('pending_verification', 'verified')).toBe(true);
      expect(isValidCompanyStatusTransition('pending_verification', 'blacklisted')).toBe(true);
      expect(isValidCompanyStatusTransition('pending_verification', 'inactive')).toBe(true);

      expect(isValidCompanyStatusTransition('verified', 'blacklisted')).toBe(true);
      expect(isValidCompanyStatusTransition('verified', 'inactive')).toBe(true);
      expect(isValidCompanyStatusTransition('verified', 'pending_verification')).toBe(false);

      expect(isValidCompanyStatusTransition('inactive', 'verified')).toBe(true);
      expect(isValidCompanyStatusTransition('inactive', 'blacklisted')).toBe(true);
      expect(isValidCompanyStatusTransition('inactive', 'pending_verification')).toBe(false);

      expect(isValidCompanyStatusTransition('blacklisted', 'pending_verification')).toBe(true);
      expect(isValidCompanyStatusTransition('blacklisted', 'inactive')).toBe(true);
      expect(isValidCompanyStatusTransition('blacklisted', 'verified')).toBe(false);

      // Repeated transitions are not allowed
      expect(isValidCompanyStatusTransition('verified', 'verified')).toBe(false);
      expect(isValidCompanyStatusTransition('blacklisted', 'blacklisted')).toBe(false);
      expect(isValidCompanyStatusTransition('pending_verification', 'pending_verification')).toBe(false);
    });

    it('normalizes website URLs consistently and conservatively', () => {
      expect(normalizeCompanyWebsite('https://www.google.com/')).toBe('https://www.google.com');
      expect(normalizeCompanyWebsite('HTTPS://WWW.GOOGLE.COM')).toBe('https://www.google.com');
      expect(normalizeCompanyWebsite('https://www.google.com:443/')).toBe('https://www.google.com');
      expect(normalizeCompanyWebsite('http://google.com/')).toBe('http://google.com');
      expect(normalizeCompanyWebsite('https://google.com?utm_source=feed#team')).toBe('https://google.com');
      expect(normalizeCompanyWebsite('https://acme.github.io/careers/')).toBe('https://acme.github.io/careers');

      // Subdomains kept distinct
      expect(normalizeCompanyWebsite('https://app.acme.com')).not.toBe(normalizeCompanyWebsite('https://acme.com'));

      // Empty / invalid
      expect(normalizeCompanyWebsite(null)).toBeNull();
      expect(normalizeCompanyWebsite('')).toBeNull();
      expect(normalizeCompanyWebsite('not-a-url')).toBeNull();
      expect(normalizeCompanyWebsite('ftp://example.com')).toBeNull();
    });
  });

  describe('RecruiterInviteRequestSchema', () => {
    const validInvite = {
      companyId: validCompanyId,
      name: 'Priya Patel',
      email: '  Priya.Patel@ACME.EXAMPLE.COM  ',
      phone: '+91 9123456789',
      designation: 'Technical Recruiter',
      role: 'company_recruiter' as const,
    };

    it('validates recruiter invite and normalizes email', () => {
      const result = RecruiterInviteRequestSchema.safeParse(validInvite);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.companyId).toBe(validCompanyId);
        expect(result.data.name).toBe('Priya Patel');
        expect(result.data.email).toBe('priya.patel@acme.example.com');
        expect(result.data.role).toBe('company_recruiter');
      }
    });

    it('defaults role to company_recruiter when omitted', () => {
      const { role: _, ...inviteWithoutRole } = validInvite;
      const result = RecruiterInviteRequestSchema.safeParse(inviteWithoutRole);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.role).toBe('company_recruiter');
      }
    });

    it('accepts company_admin and interviewer roles', () => {
      const adminResult = RecruiterInviteRequestSchema.safeParse({
        ...validInvite,
        role: 'company_admin',
      });
      expect(adminResult.success).toBe(true);

      const interviewerResult = RecruiterInviteRequestSchema.safeParse({
        ...validInvite,
        role: 'interviewer',
      });
      expect(interviewerResult.success).toBe(true);
    });

    it('strictly rejects college-side roles (privilege escalation defense)', () => {
      const forbiddenRoles = [
        'college_admin',
        'tpo',
        'dept_coordinator',
        'faculty_mentor',
        'student',
        'support_staff',
        'platform_super_admin',
      ];

      for (const forbiddenRole of forbiddenRoles) {
        const result = RecruiterInviteRequestSchema.safeParse({
          ...validInvite,
          role: forbiddenRole,
        });
        expect(result.success).toBe(false);
      }
    });

    it('rejects invalid companyId format', () => {
      const result = RecruiterInviteRequestSchema.safeParse({
        ...validInvite,
        companyId: 'invalid-company-id',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toMatch(/invalid company ID format/i);
      }
    });

    it('strips client-supplied orgId and userId', () => {
      const result = RecruiterInviteRequestSchema.safeParse({
        ...validInvite,
        orgId: 'attacker-org',
        userId: 'attacker-user',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        const raw = result.data as Record<string, unknown>;
        expect(raw['orgId']).toBeUndefined();
        expect(raw['userId']).toBeUndefined();
      }
    });
  });

  describe('CompanyQueryFiltersSchema', () => {
    it('provides sensible defaults for pagination and sorting', () => {
      const result = CompanyQueryFiltersSchema.safeParse({});

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(20);
        expect(result.data.sortBy).toBe('createdAt');
        expect(result.data.sortOrder).toBe('desc');
      }
    });

    it('coerces string numbers from query parameters', () => {
      const result = CompanyQueryFiltersSchema.safeParse({
        page: '3',
        limit: '50',
        status: 'verified',
        tier: 'tier_1',
        search: 'Acme',
        sortBy: 'name',
        sortOrder: 'asc',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(3);
        expect(result.data.limit).toBe(50);
        expect(result.data.status).toBe('verified');
        expect(result.data.tier).toBe('tier_1');
        expect(result.data.search).toBe('Acme');
        expect(result.data.sortBy).toBe('name');
        expect(result.data.sortOrder).toBe('asc');
      }
    });

    it('rejects limit exceeding 100', () => {
      const result = CompanyQueryFiltersSchema.safeParse({
        limit: '150',
      });
      expect(result.success).toBe(false);
    });

    it('rejects page number less than 1', () => {
      const result = CompanyQueryFiltersSchema.safeParse({
        page: '0',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Response Contracts', () => {
    it('validates GlobalCompanySchema output', () => {
      const globalCompany = {
        id: validCompanyId,
        name: 'Acme Global',
        legalName: 'Acme Global Technologies Inc.',
        website: 'https://acme.example.com',
        industry: 'Cloud Infrastructure',
        description: 'Worldwide infrastructure software',
        location: {
          city: 'San Jose',
          state: 'California',
          country: 'USA',
          addressLine: null,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = GlobalCompanySchema.safeParse(globalCompany);
      expect(result.success).toBe(true);
    });

    it('validates CollegeCompanyProfileResponseSchema and PaginatedCompanyListResponseSchema', () => {
      const collegeProfile = {
        id: '607f1f77bcf86cd799439099',
        companyId: validCompanyId,
        orgId: validOrgId,
        company: {
          id: validCompanyId,
          name: 'Acme Global',
          legalName: null,
          website: 'https://acme.example.com',
          industry: 'Software',
          description: null,
          location: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        status: 'verified' as const,
        tier: 'tier_1' as const,
        verificationDetails: {
          verifiedBy: 'tpo-user-123',
          verifiedAt: new Date().toISOString(),
          remarks: 'Verified for 2026 drive',
        },
        primaryContact: {
          name: 'Rohan Sharma',
          email: 'rohan@acme.example.com',
          phone: '+91 9876543210',
          designation: 'Campus Lead',
        },
        notes: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = CollegeCompanyProfileResponseSchema.safeParse(collegeProfile);
      expect(result.success).toBe(true);

      const paginatedResult = PaginatedCompanyListResponseSchema.safeParse({
        items: [collegeProfile],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
      expect(paginatedResult.success).toBe(true);
    });

    it('validates RecruiterAssociationResponseSchema output', () => {
      const recruiterAssociation = {
        id: '707f1f77bcf86cd799439088',
        companyId: validCompanyId,
        orgId: validOrgId,
        userId: '807f1f77bcf86cd799439077',
        name: 'Priya Patel',
        email: 'priya.patel@acme.example.com',
        phone: '+91 9123456789',
        designation: 'Technical Recruiter',
        role: 'company_recruiter' as const,
        status: 'active' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = RecruiterAssociationResponseSchema.safeParse(recruiterAssociation);
      expect(result.success).toBe(true);
    });

    it('validates RecruiterInviteResponseDataSchema output', () => {
      const inviteData = {
        recruiter: {
          id: '707f1f77bcf86cd799439088',
          companyId: validCompanyId,
          orgId: validOrgId,
          userId: null,
          name: 'Priya Patel',
          email: 'priya.patel@acme.example.com',
          phone: null,
          designation: null,
          role: 'company_recruiter' as const,
          status: 'pending_invitation' as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        invitationToken: 'test-token-at-least-16-chars-long',
        invitationExpiresAt: new Date().toISOString(),
      };

      const result = RecruiterInviteResponseDataSchema.safeParse(inviteData);
      expect(result.success).toBe(true);
    });

    it('validates RecruiterAcceptInviteRequestSchema', () => {
      // Valid without password
      const withoutPassword = { token: 'valid-token-32-chars-long-hex123' };
      expect(RecruiterAcceptInviteRequestSchema.safeParse(withoutPassword).success).toBe(true);

      // Valid with password
      const withPassword = {
        token: 'valid-token-32-chars-long-hex123',
        password: 'securePassword123!',
      };
      expect(RecruiterAcceptInviteRequestSchema.safeParse(withPassword).success).toBe(true);

      // Invalid: token too short
      const shortToken = { token: 'short' };
      expect(RecruiterAcceptInviteRequestSchema.safeParse(shortToken).success).toBe(false);

      // Invalid: password too short
      const shortPassword = {
        token: 'valid-token-32-chars-long-hex123',
        password: 'short',
      };
      expect(RecruiterAcceptInviteRequestSchema.safeParse(shortPassword).success).toBe(false);
    });

    it('validates RecruiterQueryFiltersSchema and defaults', () => {
      const defaultFilters = RecruiterQueryFiltersSchema.parse({});
      expect(defaultFilters.page).toBe(1);
      expect(defaultFilters.limit).toBe(20);
      expect(defaultFilters.sortBy).toBe('createdAt');
      expect(defaultFilters.sortOrder).toBe('desc');

      const customFilters = RecruiterQueryFiltersSchema.parse({
        page: '2',
        limit: '50',
        search: 'Jane',
        role: 'company_admin',
        status: 'active',
        sortBy: 'name',
        sortOrder: 'asc',
      });
      expect(customFilters.page).toBe(2);
      expect(customFilters.limit).toBe(50);
      expect(customFilters.search).toBe('Jane');
      expect(customFilters.role).toBe('company_admin');
      expect(customFilters.status).toBe('active');
      expect(customFilters.sortBy).toBe('name');
      expect(customFilters.sortOrder).toBe('asc');
    });

    it('validates PaginatedRecruiterListResponseSchema', () => {
      const paginatedResult = PaginatedRecruiterListResponseSchema.safeParse({
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });
      expect(paginatedResult.success).toBe(true);
    });
  });

  describe('Recruiter Status State Machine', () => {
    it('defines expected permitted transitions', () => {
      expect(RECRUITER_STATUS_TRANSITIONS.pending_invitation).toEqual(['active', 'inactive']);
      expect(RECRUITER_STATUS_TRANSITIONS.active).toEqual(['inactive']);
      expect(RECRUITER_STATUS_TRANSITIONS.inactive).toEqual(['pending_invitation']);
    });

    it('validates permitted transitions with isValidRecruiterStatusTransition', () => {
      expect(isValidRecruiterStatusTransition('pending_invitation', 'active')).toBe(true);
      expect(isValidRecruiterStatusTransition('pending_invitation', 'inactive')).toBe(true);
      expect(isValidRecruiterStatusTransition('active', 'inactive')).toBe(true);
      expect(isValidRecruiterStatusTransition('inactive', 'pending_invitation')).toBe(true);
    });

    it('rejects identical state transitions (from === to)', () => {
      expect(isValidRecruiterStatusTransition('pending_invitation', 'pending_invitation')).toBe(false);
      expect(isValidRecruiterStatusTransition('active', 'active')).toBe(false);
      expect(isValidRecruiterStatusTransition('inactive', 'inactive')).toBe(false);
    });

    it('rejects illegal state transitions', () => {
      expect(isValidRecruiterStatusTransition('active', 'pending_invitation')).toBe(false);
      expect(isValidRecruiterStatusTransition('inactive', 'active')).toBe(false);
    });
  });
});

