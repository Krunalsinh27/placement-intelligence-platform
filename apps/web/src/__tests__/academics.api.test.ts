import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  listDepartments,
  createDepartment,
  updateDepartment,
  listBatches,
  createBatch,
  updateBatch,
  ApiError,
} from '../api/academics.js';
import type {
  DepartmentResponse,
  DepartmentCreateInput,
  DepartmentUpdateInput,
  AcademicBatchResponse,
  AcademicBatchCreateInput,
} from '@placement-platform/contracts';

describe('Frontend Academic API Client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ─── Department Operations ─────────────────────────────────────────────────

  describe('listDepartments()', () => {
    it('sends GET /api/v1/academics/departments with credentials: "include" and returns departments', async () => {
      const mockDepartments: DepartmentResponse[] = [
        {
          id: 'dept-1',
          orgId: 'org-1',
          name: 'Computer Science and Engineering',
          code: 'CSE',
          status: 'active',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'dept-2',
          orgId: 'org-1',
          name: 'Information Technology',
          code: 'IT',
          status: 'active',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ];

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: mockDepartments,
          meta: { requestId: 'req-dept-1' },
        }),
      } as Response);

      const result = await listDepartments();

      expect(result).toEqual(mockDepartments);
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/v1/academics/departments',
        expect.objectContaining({
          method: 'GET',
          credentials: 'include',
        })
      );
    });
  });

  describe('createDepartment()', () => {
    it('sends POST /api/v1/academics/departments with credentials: "include" and JSON body', async () => {
      const mockCreated: DepartmentResponse = {
        id: 'dept-3',
        orgId: 'org-1',
        name: 'Mechanical Engineering',
        code: 'ME',
        status: 'active',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({
          data: mockCreated,
          meta: { requestId: 'req-dept-2' },
        }),
      } as Response);

      const result = await createDepartment({
        name: 'Mechanical Engineering',
        code: 'ME',
        status: 'active',
      });

      expect(result).toEqual(mockCreated);
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/v1/academics/departments',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            name: 'Mechanical Engineering',
            code: 'ME',
            status: 'active',
          }),
        })
      );
    });

    it('strips orgId if injected by caller to uphold server-derived tenancy', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({
          data: { id: 'dept-3' },
          meta: { requestId: 'req-dept-3' },
        }),
      } as Response);

      const payloadWithOrg = {
        name: 'Civil Engineering',
        code: 'CE',
        status: 'active' as const,
        orgId: 'malicious-org-id',
      };

      await createDepartment(payloadWithOrg as unknown as DepartmentCreateInput);

      const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0]!;
      const parsedBody = JSON.parse(fetchCall[1]?.body as string);
      expect(parsedBody.orgId).toBeUndefined();
      expect(parsedBody.name).toBe('Civil Engineering');
    });
  });

  describe('updateDepartment()', () => {
    it('sends PUT /api/v1/academics/departments/:id with credentials: "include" and encodes id', async () => {
      const mockUpdated: DepartmentResponse = {
        id: 'dept-1',
        orgId: 'org-1',
        name: 'Computer Science and Engineering (Updated)',
        code: 'CSE',
        status: 'active',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: mockUpdated,
          meta: { requestId: 'req-dept-4' },
        }),
      } as Response);

      const result = await updateDepartment('dept-1', {
        name: 'Computer Science and Engineering (Updated)',
      });

      expect(result).toEqual(mockUpdated);
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/v1/academics/departments/dept-1',
        expect.objectContaining({
          method: 'PUT',
          credentials: 'include',
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            name: 'Computer Science and Engineering (Updated)',
          }),
        })
      );
    });

    it('strips orgId from department update body', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: { id: 'dept-1' },
          meta: { requestId: 'req-dept-5' },
        }),
      } as Response);

      await updateDepartment('dept-1', {
        status: 'inactive',
        orgId: 'spoofed-org',
      } as unknown as DepartmentUpdateInput);

      const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0]!;
      const parsedBody = JSON.parse(fetchCall[1]?.body as string);
      expect(parsedBody.orgId).toBeUndefined();
      expect(parsedBody.status).toBe('inactive');
    });
  });

  // ─── Batch Operations ──────────────────────────────────────────────────────

  describe('listBatches()', () => {
    it('sends GET /api/v1/academics/batches with credentials: "include" and returns batches', async () => {
      const mockBatches: AcademicBatchResponse[] = [
        {
          id: 'batch-1',
          orgId: 'org-1',
          name: 'Class of 2026',
          startYear: 2022,
          graduationYear: 2026,
          status: 'active',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ];

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: mockBatches,
          meta: { requestId: 'req-batch-1' },
        }),
      } as Response);

      const result = await listBatches();

      expect(result).toEqual(mockBatches);
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/v1/academics/batches',
        expect.objectContaining({
          method: 'GET',
          credentials: 'include',
        })
      );
    });
  });

  describe('createBatch()', () => {
    it('sends POST /api/v1/academics/batches with credentials: "include" and JSON body', async () => {
      const mockCreated: AcademicBatchResponse = {
        id: 'batch-2',
        orgId: 'org-1',
        name: 'Class of 2027',
        startYear: 2023,
        graduationYear: 2027,
        status: 'active',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({
          data: mockCreated,
          meta: { requestId: 'req-batch-2' },
        }),
      } as Response);

      const result = await createBatch({
        name: 'Class of 2027',
        startYear: 2023,
        graduationYear: 2027,
      });

      expect(result).toEqual(mockCreated);
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/v1/academics/batches',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            name: 'Class of 2027',
            startYear: 2023,
            graduationYear: 2027,
          }),
        })
      );
    });

    it('strips orgId if present in createBatch input', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({
          data: { id: 'batch-2' },
          meta: { requestId: 'req-batch-3' },
        }),
      } as Response);

      await createBatch({
        name: 'Class of 2027',
        startYear: 2023,
        graduationYear: 2027,
        orgId: 'rogue-org',
      } as unknown as AcademicBatchCreateInput);

      const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0]!;
      const parsedBody = JSON.parse(fetchCall[1]?.body as string);
      expect(parsedBody.orgId).toBeUndefined();
    });
  });

  describe('updateBatch()', () => {
    it('sends PUT /api/v1/academics/batches/:id with credentials: "include"', async () => {
      const mockUpdated: AcademicBatchResponse = {
        id: 'batch-1',
        orgId: 'org-1',
        name: 'Class of 2026 (Graduated)',
        startYear: 2022,
        graduationYear: 2026,
        status: 'graduated',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z',
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: mockUpdated,
          meta: { requestId: 'req-batch-4' },
        }),
      } as Response);

      const result = await updateBatch('batch-1', {
        name: 'Class of 2026 (Graduated)',
        status: 'graduated',
      });

      expect(result).toEqual(mockUpdated);
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/v1/academics/batches/batch-1',
        expect.objectContaining({
          method: 'PUT',
          credentials: 'include',
        })
      );
    });
  });

  // ─── Error Handling ────────────────────────────────────────────────────────

  describe('Error handling', () => {
    it('throws ApiError with statusCode 401 when unauthenticated', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required. Please sign in.',
          },
        }),
      } as Response);

      await expect(listDepartments()).rejects.toThrowError(ApiError);
      await expect(listDepartments()).rejects.toMatchObject({
        statusCode: 401,
        code: 'UNAUTHORIZED',
        message: 'Authentication required. Please sign in.',
      });
    });

    it('throws ApiError with details on 400 validation error', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request payload.',
            details: [{ path: 'code', issue: 'Department code must be at least 2 characters' }],
          },
        }),
      } as Response);

      const errorPromise = createDepartment({ name: 'Computer Science', code: 'C' });
      await expect(errorPromise).rejects.toThrowError(ApiError);
      await expect(errorPromise).rejects.toMatchObject({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        details: [{ path: 'code', issue: 'Department code must be at least 2 characters' }],
      });
    });

    it('throws ApiError on 409 conflict (duplicate resource)', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({
          error: {
            code: 'DUPLICATE_RESOURCE',
            message: 'Department with code CSE already exists in this college.',
          },
        }),
      } as Response);

      await expect(
        createDepartment({ name: 'Computer Science', code: 'CSE' })
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'DUPLICATE_RESOURCE',
        message: 'Department with code CSE already exists in this college.',
      });
    });

    it('throws ApiError on 404 not found', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({
          error: {
            code: 'DEPARTMENT_NOT_FOUND',
            message: 'Department not found.',
          },
        }),
      } as Response);

      await expect(
        updateDepartment('dept-nonexistent', { name: 'New Name' })
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'DEPARTMENT_NOT_FOUND',
      });
    });

    it('throws ApiError with NETWORK_ERROR and statusCode 0 on fetch failure', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network offline'));

      await expect(listDepartments()).rejects.toMatchObject({
        statusCode: 0,
        code: 'NETWORK_ERROR',
        message: 'Unable to connect to the API server. Please check your network connection.',
      });
    });
  });
});
