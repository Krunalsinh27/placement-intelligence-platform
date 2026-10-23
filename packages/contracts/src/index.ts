import { z } from 'zod';

/**
 * Common standard API response envelopes as defined in architecture Section I.
 */
export const ApiResponseMetaSchema = z.object({
  requestId: z.string(),
  timestamp: z.string().datetime().optional(),
});

export const apiSuccessSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    data: dataSchema,
    meta: ApiResponseMetaSchema,
  });

export const ApiErrorItemSchema = z.object({
  path: z.string().optional(),
  issue: z.string(),
});

export const ApiErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.array(ApiErrorItemSchema).optional(),
    requestId: z.string(),
  }),
});

export type ApiResponseMeta = z.infer<typeof ApiResponseMetaSchema>;
export type ApiErrorItem = z.infer<typeof ApiErrorItemSchema>;
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;

export * from './auth.js';
export * from './academics.js';
export * from './students.js';
export * from './companies.js';
