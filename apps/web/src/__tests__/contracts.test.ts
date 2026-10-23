/**
 * Smoke test: verify the contracts package resolves correctly from the web app.
 * This runs in Node (no DOM required) and confirms the shared package wiring works.
 */
import { describe, it, expect } from 'vitest';
import { ApiResponseMetaSchema } from '@placement-platform/contracts';

describe('contracts integration (web)', () => {
  it('ApiResponseMetaSchema validates a correct meta object', () => {
    const result = ApiResponseMetaSchema.safeParse({
      requestId: 'test-id-123',
      timestamp: '2026-01-01T00:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });

  it('ApiResponseMetaSchema rejects an object missing requestId', () => {
    const result = ApiResponseMetaSchema.safeParse({
      timestamp: '2026-01-01T00:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });
});
