import type { AuthUser, LoginRequest } from '@placement-platform/contracts';

import { ApiError } from './client.js';
export { ApiError } from './client.js';

interface ApiErrorPayload {
  error: {
    code: string;
    message: string;
    details?: Array<{ path?: string; issue: string }>;
    requestId?: string;
  };
}

interface ApiSuccessPayload<T> {
  data: T;
  meta: {
    requestId: string;
    timestamp?: string;
  };
}

const API_BASE_URL = ''; // Proxied via Vite to http://localhost:4000 in dev

function getFriendlyErrorMessage(code: string, defaultMessage: string): string {
  switch (code) {
    case 'INVALID_CREDENTIALS':
      return 'Invalid email or password. Please check your credentials and try again.';
    case 'USER_INACTIVE':
      return 'Your account has been deactivated. Please contact your college placement administrator.';
    case 'ORGANIZATION_INACTIVE':
      return 'Your college organization account is currently inactive or suspended.';
    case 'TOO_MANY_REQUESTS':
      return 'Too many login attempts. Please wait 15 minutes before trying again.';
    case 'CSRF_REJECTED':
    case 'CSRF_FORBIDDEN_ORIGIN':
      return 'Cross-site request validation failed. Please refresh the page.';
    case 'VALIDATION_ERROR':
      return 'Please enter a valid email address and password.';
    case 'MALFORMED_JSON':
      return 'Invalid request format.';
    case 'INTERNAL_SERVER_ERROR':
      return 'A server error occurred. Please try again in a few moments.';
    default:
      return defaultMessage || 'An unexpected error occurred. Please try again.';
  }
}

/**
 * Authenticates user credentials with the server.
 * Sets the HttpOnly session cookie on success.
 */
export async function login(credentials: LoginRequest): Promise<AuthUser> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Ensure HttpOnly session cookie is saved
      body: JSON.stringify(credentials),
    });
  } catch {
    throw new ApiError(
      'Unable to connect to the API server. Please check your network connection.',
      'NETWORK_ERROR',
      0
    );
  }

  if (!res.ok) {
    let payload: ApiErrorPayload | null = null;
    try {
      payload = (await res.json()) as ApiErrorPayload;
    } catch {
      // Non-JSON error response from proxy or gateway
    }

    const code = payload?.error?.code ?? 'UNKNOWN_ERROR';
    const rawMessage = payload?.error?.message ?? `HTTP ${res.status}`;
    const friendlyMessage = getFriendlyErrorMessage(code, rawMessage);

    throw new ApiError(friendlyMessage, code, res.status, payload?.error?.details);
  }

  const json = (await res.json()) as ApiSuccessPayload<{ user: AuthUser }>;
  return json.data.user;
}

/**
 * Fetches the currently authenticated user session.
 * - Returns AuthUser if active session exists (HTTP 200).
 * - Returns null if unauthenticated (HTTP 401).
 * - Throws ApiError if the server is unreachable or reports HTTP 5xx.
 */
export async function getMe(): Promise<AuthUser | null> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
      method: 'GET',
      credentials: 'include', // Transmit HttpOnly session cookie
    });
  } catch {
    throw new ApiError(
      'Cannot connect to the backend server. Make sure the API is running on http://localhost:4000.',
      'API_UNAVAILABLE',
      0
    );
  }

  // Normal unauthenticated state: no active session cookie
  if (res.status === 401) {
    return null;
  }

  if (!res.ok) {
    throw new ApiError(
      `Backend error while verifying session (HTTP ${res.status}).`,
      'SERVER_ERROR',
      res.status
    );
  }

  const json = (await res.json()) as ApiSuccessPayload<{ user: AuthUser }>;
  return json.data.user;
}

/**
 * Revokes the current session and clears the session cookie.
 */
export async function logout(): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/api/v1/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });
  } catch (error) {
    // Even if network fails during logout, client state will still be cleared
    console.warn('[auth] Network error during logout:', error);
  }
}
