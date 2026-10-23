import { Router } from 'express';
import type { Request, Response, Router as ExpressRouter } from 'express';
import crypto from 'node:crypto';
import {
  CompanyCreateSchema,
  CompanyUpdateSchema,
  CompanyVerifyRequestSchema,
  CompanyTierUpdateRequestSchema,
  CompanyQueryFiltersSchema,
} from '@placement-platform/contracts';
import { companyService, CompanyError } from './company.service.js';
import { requireAuth, requireRole, getTenantScope } from '../../middlewares/auth.js';
import { csrfProtection } from '../../middlewares/csrf.js';
import { validateBody } from '../../middlewares/validate.js';

export const companyRouter: ExpressRouter = Router();

/**
 * POST /api/v1/companies
 * Registers a new company relationship for the authenticated college.
 * Only college_admin and tpo can perform this action.
 */
companyRouter.post(
  '/companies',
  requireAuth,
  csrfProtection,
  requireRole('college_admin', 'tpo'),
  validateBody(CompanyCreateSchema),
  async (req: Request, res: Response): Promise<void> => {
    const requestId = crypto.randomUUID();
    try {
      const orgId = getTenantScope(req);
      const company = await companyService.createCompany(orgId, req.body, {
        userId: req.session?.userId,
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      });

      res.status(201).json({
        data: company,
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      if (error instanceof CompanyError) {
        res.status(error.statusCode).json({
          error: {
            code: error.code,
            message: error.message,
            requestId,
          },
        });
        return;
      }
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: number }).code === 11000
      ) {
        res.status(409).json({
          error: {
            code: 'DUPLICATE_RESOURCE',
            message: 'This company is already registered in your college directory.',
            requestId,
          },
        });
        return;
      }

      console.error('[companies] Error creating company:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred while creating the company.',
          requestId,
        },
      });
    }
  }
);

/**
 * GET /api/v1/companies
 * Paginated, filtered, and searchable directory of companies for this college.
 */
companyRouter.get(
  '/companies',
  requireAuth,
  requireRole('college_admin', 'tpo', 'dept_coordinator'),
  async (req: Request, res: Response): Promise<void> => {
    const requestId = crypto.randomUUID();
    try {
      const orgId = getTenantScope(req);
      const parsedFilters = CompanyQueryFiltersSchema.safeParse(req.query);
      if (!parsedFilters.success) {
        const details = parsedFilters.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          issue: issue.message,
        }));
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters.',
            details,
            requestId,
          },
        });
        return;
      }

      const result = await companyService.listCompanies(orgId, parsedFilters.data);

      res.status(200).json({
        data: result,
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      if (error instanceof CompanyError) {
        res.status(error.statusCode).json({
          error: {
            code: error.code,
            message: error.message,
            requestId,
          },
        });
        return;
      }

      console.error('[companies] Error listing companies:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred while listing companies.',
          requestId,
        },
      });
    }
  }
);

/**
 * GET /api/v1/companies/:id
 * Retrieves a single college company profile by its ID.
 */
companyRouter.get(
  '/companies/:id',
  requireAuth,
  requireRole('college_admin', 'tpo', 'dept_coordinator'),
  async (req: Request, res: Response): Promise<void> => {
    const requestId = crypto.randomUUID();
    try {
      const orgId = getTenantScope(req);
      const company = await companyService.getCompanyById(orgId, req.params.id as string);

      res.status(200).json({
        data: company,
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      if (error instanceof CompanyError) {
        res.status(error.statusCode).json({
          error: {
            code: error.code,
            message: error.message,
            requestId,
          },
        });
        return;
      }

      console.error('[companies] Error getting company by ID:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred while retrieving the company.',
          requestId,
        },
      });
    }
  }
);

/**
 * PUT /api/v1/companies/:id
 * Updates permitted company information. Only college_admin and tpo can perform this action.
 */
companyRouter.put(
  '/companies/:id',
  requireAuth,
  csrfProtection,
  requireRole('college_admin', 'tpo'),
  validateBody(CompanyUpdateSchema),
  async (req: Request, res: Response): Promise<void> => {
    const requestId = crypto.randomUUID();
    try {
      const orgId = getTenantScope(req);
      const company = await companyService.updateCompany(orgId, req.params.id as string, req.body, {
        userId: req.session?.userId,
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      });

      res.status(200).json({
        data: company,
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      if (error instanceof CompanyError) {
        res.status(error.statusCode).json({
          error: {
            code: error.code,
            message: error.message,
            requestId,
          },
        });
        return;
      }

      console.error('[companies] Error updating company:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred while updating the company.',
          requestId,
        },
      });
    }
  }
);

/**
 * PATCH /api/v1/companies/:id/verify
 * Updates company verification status. Only college_admin and tpo can perform this action.
 */
companyRouter.patch(
  '/companies/:id/verify',
  requireAuth,
  csrfProtection,
  requireRole('college_admin', 'tpo'),
  validateBody(CompanyVerifyRequestSchema),
  async (req: Request, res: Response): Promise<void> => {
    const requestId = crypto.randomUUID();
    try {
      const orgId = getTenantScope(req);
      const company = await companyService.verifyCompany(orgId, req.params.id as string, req.body, {
        userId: req.session?.userId,
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      });

      res.status(200).json({
        data: company,
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      if (error instanceof CompanyError) {
        res.status(error.statusCode).json({
          error: {
            code: error.code,
            message: error.message,
            requestId,
          },
        });
        return;
      }

      console.error('[companies] Error verifying company:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred while verifying the company.',
          requestId,
        },
      });
    }
  }
);

/**
 * PATCH /api/v1/companies/:id/tier
 * Updates company tier. Only college_admin and tpo can perform this action.
 */
companyRouter.patch(
  '/companies/:id/tier',
  requireAuth,
  csrfProtection,
  requireRole('college_admin', 'tpo'),
  validateBody(CompanyTierUpdateRequestSchema),
  async (req: Request, res: Response): Promise<void> => {
    const requestId = crypto.randomUUID();
    try {
      const orgId = getTenantScope(req);
      const company = await companyService.updateTier(orgId, req.params.id as string, req.body, {
        userId: req.session?.userId,
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      });

      res.status(200).json({
        data: company,
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      if (error instanceof CompanyError) {
        res.status(error.statusCode).json({
          error: {
            code: error.code,
            message: error.message,
            requestId,
          },
        });
        return;
      }

      console.error('[companies] Error updating company tier:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred while updating the company tier.',
          requestId,
        },
      });
    }
  }
);
