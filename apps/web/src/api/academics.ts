import type {
  DepartmentCreateInput,
  DepartmentUpdateInput,
  DepartmentResponse,
  AcademicBatchCreateInput,
  AcademicBatchUpdateInput,
  AcademicBatchResponse,
} from '@placement-platform/contracts';
import { apiRequest } from './client.js';
export { ApiError } from './client.js';

/**
 * Lists all academic departments for the authenticated college.
 */
export async function listDepartments(): Promise<DepartmentResponse[]> {
  return apiRequest<DepartmentResponse[]>('/api/v1/academics/departments', {
    method: 'GET',
  });
}

/**
 * Creates a new academic department.
 * Strips client-supplied tenant identifiers (orgId) to uphold server-derived tenancy.
 */
export async function createDepartment(
  input: DepartmentCreateInput
): Promise<DepartmentResponse> {
  const { ...sanitized } = input as Record<string, unknown>;
  delete sanitized.orgId;

  return apiRequest<DepartmentResponse>('/api/v1/academics/departments', {
    method: 'POST',
    body: JSON.stringify(sanitized),
  });
}

/**
 * Updates an existing academic department by ID.
 * Strips client-supplied tenant identifiers (orgId).
 */
export async function updateDepartment(
  id: string,
  input: DepartmentUpdateInput
): Promise<DepartmentResponse> {
  const { ...sanitized } = input as Record<string, unknown>;
  delete sanitized.orgId;

  return apiRequest<DepartmentResponse>(
    `/api/v1/academics/departments/${encodeURIComponent(id)}`,
    {
      method: 'PUT',
      body: JSON.stringify(sanitized),
    }
  );
}

/**
 * Lists all academic batches for the authenticated college.
 */
export async function listBatches(): Promise<AcademicBatchResponse[]> {
  return apiRequest<AcademicBatchResponse[]>('/api/v1/academics/batches', {
    method: 'GET',
  });
}

/**
 * Creates a new academic batch.
 * Strips client-supplied tenant identifiers (orgId) to uphold server-derived tenancy.
 */
export async function createBatch(
  input: AcademicBatchCreateInput
): Promise<AcademicBatchResponse> {
  const { ...sanitized } = input as Record<string, unknown>;
  delete sanitized.orgId;

  return apiRequest<AcademicBatchResponse>('/api/v1/academics/batches', {
    method: 'POST',
    body: JSON.stringify(sanitized),
  });
}

/**
 * Updates an existing academic batch by ID.
 * Strips client-supplied tenant identifiers (orgId).
 */
export async function updateBatch(
  id: string,
  input: AcademicBatchUpdateInput
): Promise<AcademicBatchResponse> {
  const { ...sanitized } = input as Record<string, unknown>;
  delete sanitized.orgId;

  return apiRequest<AcademicBatchResponse>(
    `/api/v1/academics/batches/${encodeURIComponent(id)}`,
    {
      method: 'PUT',
      body: JSON.stringify(sanitized),
    }
  );
}
