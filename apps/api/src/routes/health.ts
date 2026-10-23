import { Router } from 'express';
import type { Request, Response, Router as ExpressRouter } from 'express';
import type { ApiResponseMeta } from '@placement-platform/contracts';
import { getDatabaseStatus } from '../config/database.js';
import type { DatabaseStatus } from '../config/database.js';

export const healthRouter: ExpressRouter = Router();

export interface HealthResponse {
  status: 'ok';
  service: string;
  version: string;
  environment: string;
  database: DatabaseStatus;
  meta: ApiResponseMeta;
}

healthRouter.get('/health', (_req: Request, res: Response) => {
  const body: HealthResponse = {
    status: 'ok',
    service: 'placement-platform-api',
    version: '0.1.0',
    environment: process.env['NODE_ENV'] ?? 'development',
    database: getDatabaseStatus(),
    meta: {
      requestId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    },
  };
  res.status(200).json(body);
});

