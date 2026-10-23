import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CompanyCreateSchema,
  CompanyUpdateSchema,
  CompanyVerifyRequestSchema,
  CompanyTierUpdateRequestSchema,
  RecruiterInviteRequestSchema,
  RecruiterAcceptInviteRequestSchema,
  isValidCompanyStatusTransition,
  isValidRecruiterStatusTransition,
} from '@placement-platform/contracts';
import {
  canViewCompanies,
  canManageCompanies,
  canVerifyOrTierCompany,
  canManageRecruiters,
} from '../utils/permissions.js';

describe('Company and Recruiter UI Validation & Business Logic (Phase 6, Step 4)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ─── Company Registration Form Validation ──────────────────────────────────

  describe('Company Registration Form Validation', () => {
    const validCompanyInput = {
      name: 'Google LLC',
      legalName: 'Google India Private Limited',
      industry: 'Technology & Cloud',
      website: 'https://google.com',
      description: 'Global technology leader specializing in search and cloud computing.',
      tier: 'tier_1' as const,
      location: {
        city: 'Bangalore',
        state: 'Karnataka',
        country: 'India',
        addressLine: 'RMZ Infinity, Old Madras Road',
      },
      primaryContact: {
        name: 'Anita Sharma',
        email: 'anita.sharma@google.com',
        phone: '+919876543210',
        designation: 'University Relations Lead',
      },
      notes: 'Premier campus recruiter since 2018',
    };

    it('accepts valid complete company registration payload', () => {
      const result = CompanyCreateSchema.safeParse(validCompanyInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Google LLC');
        expect(result.data.website).toBe('https://google.com');
        expect(result.data.primaryContact?.email).toBe('anita.sharma@google.com');
      }
    });

    it('rejects company name shorter than 2 characters', () => {
      const result = CompanyCreateSchema.safeParse({
        ...validCompanyInput,
        name: 'G',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const nameIssue = result.error.issues.find((i) => i.path.includes('name'));
        expect(nameIssue?.message).toContain('at least 2 characters');
      }
    });

    it('rejects invalid website URL format', () => {
      const result = CompanyCreateSchema.safeParse({
        ...validCompanyInput,
        website: 'invalid-url-without-scheme',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const siteIssue = result.error.issues.find((i) => i.path.includes('website'));
        expect(siteIssue?.message).toContain('valid website URL');
      }
    });

    it('allows omitting website or supplying empty/null', () => {
      const inputWithoutWebsite = {
        name: 'Local Tech Solutions',
        industry: 'IT Services',
      };

      const result = CompanyCreateSchema.safeParse(inputWithoutWebsite);
      expect(result.success).toBe(true);
    });

    it('rejects invalid contact email format', () => {
      const result = CompanyCreateSchema.safeParse({
        ...validCompanyInput,
        primaryContact: {
          ...validCompanyInput.primaryContact,
          email: 'not-an-email',
        },
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const emailIssue = result.error.issues.find((i) => i.path.includes('email'));
        expect(emailIssue?.message).toContain('valid email');
      }
    });
  });

  // ─── College-Specific Company Profile Edit Validation ─────────────────────

  describe('College-Specific Company Profile Edit Validation', () => {
    it('accepts updates strictly for college-specific fields (primaryContact, notes)', () => {
      const validProfileEdit = {
        primaryContact: {
          name: 'Rajesh Kumar',
          email: 'rajesh.k@acme.com',
          phone: '+919988776655',
          designation: 'Campus Recruitment Manager',
        },
        notes: 'Updated contact for 2026-2027 placement season.',
      };

      const result = CompanyUpdateSchema.safeParse(validProfileEdit);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.notes).toBe('Updated contact for 2026-2027 placement season.');
      }
    });

    it('rejects update payload when no fields are provided', () => {
      const result = CompanyUpdateSchema.safeParse({});
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain(
          'At least one field must be provided for update'
        );
      }
    });

    it('disallows or strips global master fields from college profile updates', () => {
      const attemptGlobalMutation = {
        notes: 'Updating notes',
        name: 'Hacked Global Name',
        website: 'https://hacked.com',
      };

      const result = CompanyUpdateSchema.safeParse(attemptGlobalMutation);
      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as Record<string, unknown>;
        expect(data.name).toBeUndefined();
        expect(data.website).toBeUndefined();
        expect(data.notes).toBe('Updating notes');
      }
    });
  });

  // ─── Company Verification Modal Validation ─────────────────────────────────

  describe('Company Verification Modal Validation', () => {
    it('accepts valid verification status without remarks when not blacklisted', () => {
      const result = CompanyVerifyRequestSchema.safeParse({
        status: 'verified',
        remarks: 'College MoU verified and active',
      });

      expect(result.success).toBe(true);
    });

    it('requires remarks with at least 5 characters when status is blacklisted', () => {
      const resultMissingRemarks = CompanyVerifyRequestSchema.safeParse({
        status: 'blacklisted',
      });

      expect(resultMissingRemarks.success).toBe(false);
      if (!resultMissingRemarks.success) {
        expect(resultMissingRemarks.error.issues[0]?.message).toContain('minimum 5 characters');
      }

      const resultTooShort = CompanyVerifyRequestSchema.safeParse({
        status: 'blacklisted',
        remarks: 'bad',
      });

      expect(resultTooShort.success).toBe(false);
      if (!resultTooShort.success) {
        expect(resultTooShort.error.issues[0]?.message).toContain('minimum 5 characters');
      }

      const resultValidRemarks = CompanyVerifyRequestSchema.safeParse({
        status: 'blacklisted',
        remarks: 'Offer revocations reported in 2025 cohort',
      });

      expect(resultValidRemarks.success).toBe(true);
    });

    it('validates status transitions according to state machine', () => {
      expect(isValidCompanyStatusTransition('pending_verification', 'verified')).toBe(true);
      expect(isValidCompanyStatusTransition('pending_verification', 'blacklisted')).toBe(true);
      expect(isValidCompanyStatusTransition('verified', 'blacklisted')).toBe(true);
      expect(isValidCompanyStatusTransition('blacklisted', 'pending_verification')).toBe(true);
      // Same status transition is disallowed
      expect(isValidCompanyStatusTransition('verified', 'verified')).toBe(false);
    });
  });

  // ─── Company Tier Modal Validation ─────────────────────────────────────────

  describe('Company Tier Modal Validation', () => {
    it('accepts valid tier selection with justification of 5+ characters', () => {
      const result = CompanyTierUpdateRequestSchema.safeParse({
        tier: 'tier_1',
        reason: 'Offers > 20 LPA CTC for software engineers',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tier).toBe('tier_1');
      }
    });

    it('rejects tier update if justification reason is shorter than 5 characters', () => {
      const result = CompanyTierUpdateRequestSchema.safeParse({
        tier: 'tier_1',
        reason: 'ok',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const reasonIssue = result.error.issues.find((i) => i.path.includes('reason'));
        expect(reasonIssue?.message).toContain('minimum 5 characters');
      }
    });

    it('rejects unrecognized tier values', () => {
      const result = CompanyTierUpdateRequestSchema.safeParse({
        tier: 'super_dream',
        reason: 'Exceptional packages offered',
      });

      expect(result.success).toBe(false);
    });
  });

  // ─── Recruiter Invitation Form Validation ──────────────────────────────────

  describe('Recruiter Invitation Form Validation', () => {
    it('accepts valid recruiter invitation with company_recruiter role', () => {
      const result = RecruiterInviteRequestSchema.safeParse({
        companyId: '507f1f77bcf86cd799439011',
        name: 'Sarah Connor',
        email: 'sarah.connor@cyberdyne.com',
        role: 'company_recruiter',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.role).toBe('company_recruiter');
        expect(result.data.email).toBe('sarah.connor@cyberdyne.com');
      }
    });

    it('accepts company_admin and interviewer roles', () => {
      expect(
        RecruiterInviteRequestSchema.safeParse({
          companyId: '507f1f77bcf86cd799439011',
          name: 'Tech Admin',
          email: 'admin@cyberdyne.com',
          role: 'company_admin',
        }).success
      ).toBe(true);

      expect(
        RecruiterInviteRequestSchema.safeParse({
          companyId: '507f1f77bcf86cd799439011',
          name: 'Panel Interviewer',
          email: 'interviewer@cyberdyne.com',
          role: 'interviewer',
        }).success
      ).toBe(true);
    });

    it('rejects invalid email addresses', () => {
      const result = RecruiterInviteRequestSchema.safeParse({
        companyId: '507f1f77bcf86cd799439011',
        name: 'Bad Email',
        email: 'not-an-email',
        role: 'company_recruiter',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const emailIssue = result.error.issues.find((i) => i.path.includes('email'));
        expect(emailIssue?.message).toContain('valid email');
      }
    });

    it('rejects non-company roles like student or tpo', () => {
      const result = RecruiterInviteRequestSchema.safeParse({
        companyId: '507f1f77bcf86cd799439011',
        name: 'Invalid Role',
        email: 'test@cyberdyne.com',
        role: 'student',
      });

      expect(result.success).toBe(false);
    });

    it('validates recruiter status transitions', () => {
      expect(isValidRecruiterStatusTransition('pending_invitation', 'active')).toBe(true);
      expect(isValidRecruiterStatusTransition('active', 'inactive')).toBe(true);
      expect(isValidRecruiterStatusTransition('inactive', 'pending_invitation')).toBe(true);
      expect(isValidRecruiterStatusTransition('active', 'active')).toBe(false);
    });
  });

  // ─── Role Gating and Action Availability ───────────────────────────────────

  describe('Role-Gated Actions and Authorization Rules', () => {
    it('allows TPO and College Admin to perform all company operations', () => {
      expect(canViewCompanies('tpo')).toBe(true);
      expect(canManageCompanies('tpo')).toBe(true);
      expect(canVerifyOrTierCompany('tpo')).toBe(true);
      expect(canManageRecruiters('tpo')).toBe(true);

      expect(canViewCompanies('college_admin')).toBe(true);
      expect(canManageCompanies('college_admin')).toBe(true);
      expect(canVerifyOrTierCompany('college_admin')).toBe(true);
      expect(canManageRecruiters('college_admin')).toBe(true);
    });

    it('allows Department Coordinator to view companies but prevents mutation', () => {
      expect(canViewCompanies('dept_coordinator')).toBe(true);
      expect(canManageCompanies('dept_coordinator')).toBe(false);
      expect(canVerifyOrTierCompany('dept_coordinator')).toBe(false);
      expect(canManageRecruiters('dept_coordinator')).toBe(false);
    });

    it('allows Company Admin to manage recruiters but not verify college tier', () => {
      expect(canViewCompanies('company_admin')).toBe(true);
      expect(canManageCompanies('company_admin')).toBe(false);
      expect(canVerifyOrTierCompany('company_admin')).toBe(false);
      expect(canManageRecruiters('company_admin')).toBe(true);
    });

    it('denies faculty mentors and students company management capabilities', () => {
      expect(canViewCompanies('student')).toBe(false);
      expect(canManageCompanies('student')).toBe(false);
      expect(canVerifyOrTierCompany('student')).toBe(false);
      expect(canManageRecruiters('student')).toBe(false);

      expect(canViewCompanies('faculty_mentor')).toBe(false);
      expect(canManageCompanies('faculty_mentor')).toBe(false);
      expect(canVerifyOrTierCompany('faculty_mentor')).toBe(false);
      expect(canManageRecruiters('faculty_mentor')).toBe(false);
    });
  });

  // ─── Invitation Acceptance Schema Validation ───────────────────────────────

  describe('Recruiter Acceptance Schema Validation', () => {
    it('validates token minimum length for acceptance', () => {
      const valid = RecruiterAcceptInviteRequestSchema.safeParse({
        token: '0123456789abcdef0123456789abcdef',
        password: 'ValidPassword123!',
      });
      expect(valid.success).toBe(true);

      const tooShort = RecruiterAcceptInviteRequestSchema.safeParse({
        token: 'short',
        password: 'ValidPassword123!',
      });
      expect(tooShort.success).toBe(false);
    });
  });
});
