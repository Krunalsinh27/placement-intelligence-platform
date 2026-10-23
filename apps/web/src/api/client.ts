export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number,
    public details?: Array<{ path?: string; issue: string }>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiErrorPayload {
  error: {
    code: string;
    message: string;
    details?: Array<{ path?: string; issue: string }>;
    requestId?: string;
  };
}

export interface ApiSuccessPayload<T> {
  data: T;
  meta: {
    requestId: string;
    timestamp?: string;
  };
}

export const API_BASE_URL = ''; // Proxied via Vite to http://localhost:4000 in dev

/**
 * Standard typed HTTP fetch wrapper for PlacePilot frontend API clients.
 * Automatically enforces credentials: 'include', JSON headers, and error parsing.
 */
export async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      credentials: 'include', // Ensure HttpOnly session cookie is transmitted and preserved
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
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
      // Non-JSON response (e.g., gateway 502/504)
    }

    const code = payload?.error?.code ?? (res.status === 401 ? 'UNAUTHORIZED' : 'UNKNOWN_ERROR');
    const message = payload?.error?.message ?? `Request failed with status ${res.status}`;
    const details = payload?.error?.details;

    throw new ApiError(message, code, res.status, details);
  }

  const json = (await res.json()) as ApiSuccessPayload<T>;
  return json.data;
}
