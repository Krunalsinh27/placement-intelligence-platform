import type {
  StudentProfileCreateInput,
  StudentProfileUpdateInput,
  StudentProfileResponse,
  StudentVerifyRequest,
  StudentStatusUpdateRequest,
  StudentQueryFilters,
  PaginatedStudentListResponse,
} from '@placement-platform/contracts';
import { apiRequest } from './client.js';
export { ApiError } from './client.js';

/**
 * Serializes supported student query filters into a URL query string.
 * Strictly ignores unauthorized or unexpected parameters such as orgId.
 */
export function buildStudentQueryString(filters?: Partial<StudentQueryFilters>): string {
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
  if (
    filters.departmentId !== undefined &&
    filters.departmentId !== null &&
    filters.departmentId.trim() !== ''
  ) {
    params.set('departmentId', filters.departmentId.trim());
  }
  if (filters.batchId !== undefined && filters.batchId !== null && filters.batchId.trim() !== '') {
    params.set('batchId', filters.batchId.trim());
  }
  if (filters.status !== undefined && filters.status !== null) {
    params.set('status', filters.status);
  }
  if (filters.minCgpa !== undefined && filters.minCgpa !== null) {
    params.set('minCgpa', String(filters.minCgpa));
  }
  if (filters.maxActiveBacklogs !== undefined && filters.maxActiveBacklogs !== null) {
    params.set('maxActiveBacklogs', String(filters.maxActiveBacklogs));
  }
  if (filters.isVerified !== undefined && filters.isVerified !== null) {
    params.set('isVerified', String(filters.isVerified));
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
 * Lists students with pagination, search, and filtering.
 */
export async function listStudents(
  filters?: Partial<StudentQueryFilters>
): Promise<PaginatedStudentListResponse> {
  const qs = buildStudentQueryString(filters);
  return apiRequest<PaginatedStudentListResponse>(`/api/v1/students${qs}`, {
    method: 'GET',
  });
}

/**
 * Retrieves a single student profile by ID.
 */
export async function getStudentById(id: string): Promise<StudentProfileResponse> {
  return apiRequest<StudentProfileResponse>(`/api/v1/students/${encodeURIComponent(id)}`, {
    method: 'GET',
  });
}

/**
 * Creates a new student profile.
 * Strips tenant and user ownership fields (orgId, userId) to preserve server-side isolation.
 */
export async function createStudent(
  input: StudentProfileCreateInput
): Promise<StudentProfileResponse> {
  const { ...sanitized } = input as Record<string, unknown>;
  delete sanitized.orgId;
  delete sanitized.userId;

  return apiRequest<StudentProfileResponse>('/api/v1/students', {
    method: 'POST',
    body: JSON.stringify(sanitized),
  });
}

/**
 * Updates an existing student profile.
 * Strips tenant, user ownership, and immutable fields (orgId, userId, enrollmentNumber).
 */
export async function updateStudent(
  id: string,
  input: StudentProfileUpdateInput
): Promise<StudentProfileResponse> {
  const { ...sanitized } = input as Record<string, unknown>;
  delete sanitized.orgId;
  delete sanitized.userId;
  delete sanitized.enrollmentNumber;

  return apiRequest<StudentProfileResponse>(`/api/v1/students/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(sanitized),
  });
}

/**
 * Verifies or un-verifies a student's profile.
 */
export async function verifyStudent(
  id: string,
  input: StudentVerifyRequest
): Promise<StudentProfileResponse> {
  return apiRequest<StudentProfileResponse>(`/api/v1/students/${encodeURIComponent(id)}/verify`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

/**
 * Updates a student's placement status.
 */
export async function updateStudentStatus(
  id: string,
  input: StudentStatusUpdateRequest
): Promise<StudentProfileResponse> {
  return apiRequest<StudentProfileResponse>(`/api/v1/students/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}
