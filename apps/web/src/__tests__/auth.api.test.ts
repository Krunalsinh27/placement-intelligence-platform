import { describe, it, expect, vi, beforeEach } from 'vitest';
import { login, getMe, logout, ApiError } from '../api/auth.js';

describe('Frontend Auth API Client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('login()', () => {
    it('sends credentials: "include" and returns AuthUser on success (HTTP 200)', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'tpo@college.edu',
        fullName: 'Prof. Demo Coordinator',
        activeOrgId: 'org-456',
        role: 'tpo' as const,
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: { user: mockUser },
          meta: { requestId: 'req-1' },
        }),
      } as Response);

      const user = await login({
        email: 'tpo@college.edu',
        password: 'Password123!',
      });

      expect(user).toEqual(mockUser);
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/v1/auth/login',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'tpo@college.edu',
            password: 'Password123!',
          }),
        })
      );
    });

    it('translates INVALID_CREDENTIALS error to user-friendly message', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password.',
            requestId: 'req-2',
          },
        }),
      } as Response);

      await expect(
        login({ email: 'tpo@college.edu', password: 'WrongPassword!' })
      ).rejects.toThrow(
        'Invalid email or password. Please check your credentials and try again.'
      );
    });

    it('translates TOO_MANY_REQUESTS rate limit to user-friendly message', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({
          error: {
            code: 'TOO_MANY_REQUESTS',
            message: 'Too many login attempts.',
            requestId: 'req-3',
          },
        }),
      } as Response);

      await expect(
        login({ email: 'tpo@college.edu', password: 'Password123!' })
      ).rejects.toThrow('Too many login attempts. Please wait 15 minutes before trying again.');
    });

    it('handles network failure with a friendly NETWORK_ERROR message', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Failed to fetch'));

      await expect(
        login({ email: 'tpo@college.edu', password: 'Password123!' })
      ).rejects.toThrow('Unable to connect to the API server.');
    });
  });

  describe('getMe()', () => {
    it('sends credentials: "include" and returns AuthUser on HTTP 200', async () => {
      const mockUser = {
        id: 'user-789',
        email: 'admin@college.edu',
        fullName: 'Dr. Placement Head',
        activeOrgId: 'org-101',
        role: 'college_admin' as const,
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: { user: mockUser },
          meta: { requestId: 'req-4' },
        }),
      } as Response);

      const user = await getMe();
      expect(user).toEqual(mockUser);
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/v1/auth/me',
        expect.objectContaining({
          method: 'GET',
          credentials: 'include',
        })
      );
    });

    it('returns null on HTTP 401 without throwing (unauthenticated session)', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 401,
      } as Response);

      const user = await getMe();
      expect(user).toBeNull();
    });

    it('throws ApiError on network error to distinguish offline backend from unauthenticated (Requirement 1)', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(getMe()).rejects.toThrowError(ApiError);
      await expect(getMe()).rejects.toThrow('Cannot connect to the backend server');
    });
  });

  describe('logout()', () => {
    it('sends POST /api/v1/auth/logout with credentials: "include"', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: { success: true } }),
      } as Response);

      await logout();

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/v1/auth/logout',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
        })
      );
    });
  });
});
