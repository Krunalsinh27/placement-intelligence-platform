import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Searches upward for the nearest .env file (supports monorepo root and package-level execution).
 */
function findEnvFile(): string | undefined {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const candidateDirs = [
    process.cwd(),
    path.resolve(process.cwd(), '..'),
    path.resolve(process.cwd(), '../..'),
    path.resolve(currentDir, '../../../..'), // Monorepo root from apps/api/src/config
    path.resolve(currentDir, '../../..'),
  ];

  for (const dir of candidateDirs) {
    const candidatePath = path.resolve(dir, '.env');
    if (fs.existsSync(candidatePath)) {
      return candidatePath;
    }
  }
  return undefined;
}

// Load environment variables before schema evaluation
const envFilePath = findEnvFile();
if (envFilePath) {
  loadDotenv({ path: envFilePath });
} else {
  loadDotenv();
}

const baseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  MONGODB_URI: z
    .string()
    .min(1, 'MONGODB_URI is required.')
    .regex(
      /^mongodb(?:\+srv)?:\/\//,
      'MONGODB_URI must start with "mongodb://" or "mongodb+srv://"'
    )
    .optional(),
  SESSION_SECRET: z
    .string()
    .min(
      32,
      'SESSION_SECRET must be at least 32 characters long for cryptographic security (ADR 0003)'
    )
    .optional(),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),
});

export const envSchema = baseEnvSchema
  .superRefine((data, ctx) => {
    if (data.NODE_ENV !== 'test') {
      if (!data.MONGODB_URI) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'MONGODB_URI is required. Please provide your MongoDB Atlas connection string in .env',
          path: ['MONGODB_URI'],
        });
      }
      if (!data.SESSION_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'SESSION_SECRET is required. Please provide a secret of at least 32 characters in .env',
          path: ['SESSION_SECRET'],
        });
      }
    }
  })
  .transform((data) => ({
    ...data,
    MONGODB_URI: data.MONGODB_URI ?? 'mongodb://localhost:27017/placement_test',
    SESSION_SECRET:
      data.SESSION_SECRET ?? 'test-secret-at-least-32-characters-long-for-testing-only',
  }));

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

/**
 * Validates process.env or a supplied environment record against the Env schema.
 * Throws a formatted ZodError if validation fails.
 */
export function validateEnv(source: Record<string, unknown> = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const errorDetails = result.error.issues
      .map((issue) => `  - [${issue.path.join('.') || 'ENV'}]: ${issue.message}`)
      .join('\n');
    throw new Error(
      `[env] Environment validation failed:\n${errorDetails}\n\nPlease check your .env configuration.`
    );
  }
  return result.data;
}

/**
 * Returns the cached validated environment, or runs validation if not yet cached.
 */
export function getEnv(): Env {
  if (!cachedEnv) {
    cachedEnv = validateEnv();
  }
  return cachedEnv;
}

/**
 * Reset cached environment (useful for testing different env configurations).
 */
export function resetEnvCache(): void {
  cachedEnv = null;
}
