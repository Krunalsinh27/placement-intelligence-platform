import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildCompanyQueryString,
  listCompanies,
  getCompany,
  createCompany,
  updateCompany,
  verifyCompany,
  updateCompanyTier,
  listRecruiters,
  inviteRecruiter,
  resendRecruiterInvitation,
  revokeRecruiterInvitation,
  deactivateRecruiter,
  acceptRecruiterInvitation,
} from '../api/companies.js';

describe('Company and Recruiter API Client (Phase 6, Step 4)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('buildCompanyQueryString()', () => {
    it('constructs correct query string with all parameters', () => {
      const qs = buildCompanyQueryString({
        page: 2,
        limit: 25,
        search: 'Google',
        status: 'verified',
        tier: 'tier_1',
        sortBy: 'name',
        sortOrder: 'asc',
      });

      expect(qs).toBe(
        '?page=2&limit=25&search=Google&status=verified&tier=tier_1&sortBy=name&sortOrder=asc'
      );
    });

    it('returns empty string when no filters or defaults are provided', () => {
      const qs = buildCompanyQueryString({});
      expect(qs).toBe('');
    });

    it('skips undefined, null, or empty string values', () => {
      const qs = buildCompanyQueryString({
        search: '',
        status: undefined,
        tier: undefined,
        page: 1,
      });

      expect(qs).toBe('?page=1');
    });
  });

  describe('listCompanies()', () => {
    it('calls GET /api/v1/companies with correct query and credentials', async () => {
      const mockResult = {
        items: [{ id: 'c1', company: { name: 'Acme Corp' }, status: 'verified' }],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: mockResult }),
      });

      const result = await listCompanies({ search: 'Acme' });

      expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/companies?search=Acme', {
        headers: {},
        credentials: 'include',
      });
      expect(result).toEqual(mockResult);
    });

    it('throws descriptive error on 403 Forbidden with parsed error payload', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({
          error: {
            code: 'FORBIDDEN',
            message: 'Forbidden access to company directory',
          },
        }),
      });

      await expect(listCompanies()).rejects.toThrow('Forbidden access to company directory');
    });
  });

  describe('getCompany()', () => {
    it('calls GET /api/v1/companies/:id', async () => {
      const mockCompany = { id: 'c1', company: { name: 'Tech Innovations' } };
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: mockCompany }),
      });

      const result = await getCompany('c1');

      expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/companies/c1', {
        headers: {},
        credentials: 'include',
      });
      expect(result).toEqual(mockCompany);
    });
  });

  describe('createCompany()', () => {
    it('calls POST /api/v1/companies with valid payload', async () => {
      const payload = {
        name: 'Nexus Soft',
        industry: 'Software',
        website: 'https://nexus.io',
      };
      const mockResult = { id: 'c2', company: { name: 'Nexus Soft' } };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: mockResult }),
      });

      const result = await createCompany(payload);

      expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      expect(result).toEqual(mockResult);
    });

    it('propagates 409 conflict error message for duplicate website or name', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({
          error: {
            code: 'DUPLICATE_RESOURCE',
            message: 'A company with this normalized website domain already exists',
          },
        }),
      });

      await expect(
        createCompany({ name: 'Nexus', industry: 'IT', website: 'https://nexus.io' })
      ).rejects.toThrow('A company with this normalized website domain already exists');
    });
  });

  describe('updateCompany()', () => {
    it('calls PUT /api/v1/companies/:id with college profile updates', async () => {
      const updatePayload = {
        notes: 'Preferred campus recruitment partner',
        primaryContact: {
          name: 'Jane Doe',
          email: 'jane@acme.org',
          phone: '+919876543210',
          designation: 'Head of Campus HR',
        },
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: { id: 'c1', ...updatePayload } }),
      });

      const result = await updateCompany('c1', updatePayload);

      expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/companies/c1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updatePayload),
      });
      expect(result.notes).toBe('Preferred campus recruitment partner');
    });
  });

  describe('verifyCompany()', () => {
    it('calls PATCH /api/v1/companies/:id/verify with status and remarks', async () => {
      const payload = {
        status: 'blacklisted' as const,
        remarks: 'Repeated non-compliance with offer guidelines',
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: { id: 'c1', status: 'blacklisted' } }),
      });

      await verifyCompany('c1', payload);

      expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/companies/c1/verify', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
    });
  });

  describe('updateCompanyTier()', () => {
    it('calls PATCH /api/v1/companies/:id/tier with tier and reason', async () => {
      const payload = {
        tier: 'tier_1' as const,
        reason: 'Offers over 25 LPA package across all departments',
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: { id: 'c1', tier: 'tier_1' } }),
      });

      await updateCompanyTier('c1', payload);

      expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/companies/c1/tier', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
    });
  });

  describe('Recruiter Management API calls', () => {
    it('listRecruiters calls GET /api/v1/companies/:id/recruiters', async () => {
      const mockList = [{ id: 'r1', name: 'John Recruiter', email: 'john@acme.com', role: 'company_admin' }];
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: mockList }),
      });

      const result = await listRecruiters('c1');
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/companies/c1/recruiters', {
        headers: {},
        credentials: 'include',
      });
      expect(result).toEqual(mockList);
    });

    it('inviteRecruiter calls POST /api/v1/companies/:id/recruiters/invite', async () => {
      const payload = {
        name: 'Sara HR',
        email: 'sara@acme.com',
        role: 'company_recruiter' as const,
      };
      const mockInviteResponse = {
        invitationId: 'inv123',
        invitationToken: 'raw_sec_token_999',
        expiresAt: '2026-11-01T00:00:00.000Z',
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: mockInviteResponse }),
      });

      const result = await inviteRecruiter('c1', payload);
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/companies/c1/recruiters/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...payload, companyId: 'c1' }),
      });
      expect(result.invitationToken).toBe('raw_sec_token_999');
    });

    it('resendRecruiterInvitation calls POST /api/v1/companies/:id/recruiters/:invId/resend', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: { invitationToken: 'new_token_777' } }),
      });

      const result = await resendRecruiterInvitation('c1', 'inv123');
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/v1/companies/c1/recruiters/inv123/resend',
        {
          method: 'POST',
          headers: {},
          credentials: 'include',
        }
      );
      expect(result.invitationToken).toBe('new_token_777');
    });

    it('revokeRecruiterInvitation calls POST /api/v1/companies/:id/recruiters/:invId/revoke', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: { message: 'Invitation revoked successfully' } }),
      });

      await revokeRecruiterInvitation('c1', 'inv123');
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/v1/companies/c1/recruiters/inv123/revoke',
        {
          method: 'POST',
          headers: {},
          credentials: 'include',
        }
      );
    });

    it('deactivateRecruiter calls POST /api/v1/companies/:id/recruiters/:recId/deactivate', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: { message: 'Recruiter membership deactivated' } }),
      });

      await deactivateRecruiter('c1', 'rec456');
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/v1/companies/c1/recruiters/rec456/deactivate',
        {
          method: 'POST',
          headers: {},
          credentials: 'include',
        }
      );
    });

    it('acceptRecruiterInvitation calls POST /api/v1/recruiters/accept-invitation', async () => {
      const payload = {
        token: 'test_token',
        password: 'ValidPassword123!',
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: { message: 'Invitation accepted successfully' } }),
      });

      await acceptRecruiterInvitation(payload);
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/recruiters/accept-invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
    });
  });
});
