import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  generateSessionToken,
  hashSessionToken,
} from '../utils/password.js';

describe('Password and Token utilities', () => {
  it('hashes password with Argon2id and verifies successfully', async () => {
    const raw = 'SuperSecureP@ss123';
    const hash = await hashPassword(raw);

    expect(hash).toContain('$argon2id$');
    const isValid = await verifyPassword(hash, raw);
    expect(isValid).toBe(true);
  });

  it('rejects incorrect password verification', async () => {
    const hash = await hashPassword('CorrectPassword123');
    const isValid = await verifyPassword(hash, 'WrongPassword456');
    expect(isValid).toBe(false);
  });

  it('generates 256-bit cryptographically random tokens (64 hex characters)', () => {
    const token1 = generateSessionToken();
    const token2 = generateSessionToken();

    expect(token1).toHaveLength(64);
    expect(token2).toHaveLength(64);
    expect(token1).not.toBe(token2);
  });

  it('computes deterministic SHA-256 token hash', () => {
    const token = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
    const hash1 = hashSessionToken(token);
    const hash2 = hashSessionToken(token);

    expect(hash1).toHaveLength(64);
    expect(hash1).toBe(hash2);
  });
});
