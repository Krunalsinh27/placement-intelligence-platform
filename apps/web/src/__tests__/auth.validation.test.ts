import { describe, it, expect } from 'vitest';
import { LoginRequestSchema } from '@placement-platform/contracts';

describe('Frontend Auth Client-side Validation (LoginRequestSchema)', () => {
  it('accepts valid email and valid password', () => {
    const result = LoginRequestSchema.safeParse({
      email: 'tpo.demo@example.com',
      password: 'Password123!',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('tpo.demo@example.com');
      expect(result.data.password).toBe('Password123!');
    }
  });

  it('trims leading and trailing whitespace from email', () => {
    const result = LoginRequestSchema.safeParse({
      email: '   tpo.demo@example.com   ',
      password: 'Password123!',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('tpo.demo@example.com');
    }
  });

  it('rejects an invalid email format with a clear error message', () => {
    const result = LoginRequestSchema.safeParse({
      email: 'not-an-email',
      password: 'Password123!',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const emailIssue = result.error.issues.find((i) => i.path[0] === 'email');
      expect(emailIssue).toBeDefined();
      expect(emailIssue?.message).toBe('Please enter a valid email address');
    }
  });

  it('rejects passwords shorter than 8 characters with a clear error message', () => {
    const result = LoginRequestSchema.safeParse({
      email: 'tpo.demo@example.com',
      password: 'short',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const passwordIssue = result.error.issues.find((i) => i.path[0] === 'password');
      expect(passwordIssue).toBeDefined();
      expect(passwordIssue?.message).toBe('Password must be at least 8 characters long');
    }
  });

  it('rejects both empty email and empty password simultaneously', () => {
    const result = LoginRequestSchema.safeParse({
      email: '',
      password: '',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0]);
      expect(paths).toContain('email');
      expect(paths).toContain('password');
    }
  });
});
