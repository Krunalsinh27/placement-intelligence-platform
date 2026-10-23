import { describe, it, expect } from 'vitest';
import { envSchema } from '../config/env.js';

describe('Environment validation (envSchema)', () => {
  const validDevEnv = {
    NODE_ENV: 'development',
    PORT: '4000',
    CLIENT_URL: 'http://localhost:5173',
    MONGODB_URI:
      'mongodb+srv://user:pass@cluster.mongodb.net/testdb?retryWrites=true&w=majority',
    SESSION_SECRET: 'this-is-a-very-secure-secret-with-more-than-32-characters',
    LOG_LEVEL: 'info',
  };

  it('validates a complete and correct environment config', () => {
    const result = envSchema.safeParse(validDevEnv);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.PORT).toBe(4000);
      expect(result.data.NODE_ENV).toBe('development');
    }
  });

  it('coerces numeric string PORT to number', () => {
    const result = envSchema.safeParse({
      ...validDevEnv,
      PORT: '5000',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.PORT).toBe(5000);
    }
  });

  it('rejects SESSION_SECRET shorter than 32 characters', () => {
    const result = envSchema.safeParse({
      ...validDevEnv,
      SESSION_SECRET: 'too-short-secret',
    });
    expect(result.success).toBe(false);
  });

  it('rejects MONGODB_URI not starting with mongodb:// or mongodb+srv://', () => {
    const result = envSchema.safeParse({
      ...validDevEnv,
      MONGODB_URI: 'http://not-a-mongo-url',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing MONGODB_URI in development mode', () => {
    const { MONGODB_URI: _unused, ...missingUriEnv } = validDevEnv;
    const result = envSchema.safeParse(missingUriEnv);
    expect(result.success).toBe(false);
  });

  it('rejects missing SESSION_SECRET in development mode', () => {
    const { SESSION_SECRET: _unused, ...missingSecretEnv } = validDevEnv;
    const result = envSchema.safeParse(missingSecretEnv);
    expect(result.success).toBe(false);
  });

  it('provides safe fallbacks when MONGODB_URI and SESSION_SECRET are omitted in test mode', () => {
    const result = envSchema.safeParse({ NODE_ENV: 'test' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.MONGODB_URI).toBe('mongodb://localhost:27017/placement_test');
      expect(typeof result.data.SESSION_SECRET).toBe('string');
      expect(result.data.SESSION_SECRET.length).toBeGreaterThanOrEqual(32);
    }
  });

  it('rejects invalid CLIENT_URL format', () => {
    const result = envSchema.safeParse({
      ...validDevEnv,
      CLIENT_URL: 'not-a-valid-url',
    });
    expect(result.success).toBe(false);
  });
});
