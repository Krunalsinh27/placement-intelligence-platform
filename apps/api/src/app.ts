import express from 'express';
import type { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { healthRouter } from './routes/health.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { academicRouter } from './modules/academics/academic.routes.js';
import { studentRouter } from './modules/students/student.routes.js';
import { companyRouter } from './modules/companies/company.routes.js';
import { recruiterRouter } from './modules/companies/recruiter.routes.js';
import { getEnv } from './config/env.js';

export function createApp(): Express {
  const env = getEnv();
  const app = express();

  // ── Security & Core Middlewares ──────────────────────────────────────────
  app.use(
    cors({
      origin: env.CLIENT_URL,
      credentials: true,
    })
  );
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));

  // ── Routes ────────────────────────────────────────────────────────────────
  app.use('/api/v1', healthRouter);
  app.use('/api/v1', authRouter);
  app.use('/api/v1', academicRouter);
  app.use('/api/v1', studentRouter);
  app.use('/api/v1', companyRouter);
  app.use('/api/v1', recruiterRouter);

  // ── 404 Handler ───────────────────────────────────────────────────────────
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'The requested endpoint does not exist.',
        requestId: 'n/a',
      },
    });
  });

  // ── Global Error Handler ──────────────────────────────────────────────────
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    // Gracefully handle malformed JSON payloads from express.json()
    if (
      err instanceof SyntaxError &&
      'status' in err &&
      (err as { status?: number }).status === 400 &&
      'body' in err
    ) {
      res.status(400).json({
        error: {
          code: 'MALFORMED_JSON',
          message: 'Malformed JSON in request body.',
          requestId: crypto.randomUUID(),
        },
      });
      return;
    }

    if (env.NODE_ENV !== 'production' && env.NODE_ENV !== 'test') {
      console.error('[error]', err);
    }
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred.',
        requestId: 'n/a',
      },
    });
  });

  return app;
}
