import type { Request, Response, NextFunction } from 'express';
import type { ZodTypeAny } from 'zod';
import crypto from 'node:crypto';

export function validateBody<T extends ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        issue: issue.message,
      }));

      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request payload.',
          details,
          requestId: crypto.randomUUID(),
        },
      });
      return;
    }

    req.body = result.data;
    next();
  };
}
