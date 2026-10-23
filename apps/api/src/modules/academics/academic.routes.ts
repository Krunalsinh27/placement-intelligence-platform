import { Router } from 'express';
import type { Request, Response, Router as ExpressRouter } from 'express';
import crypto from 'node:crypto';
import {
  DepartmentCreateSchema,
  DepartmentUpdateSchema,
  AcademicBatchCreateSchema,
  AcademicBatchUpdateSchema,
} from '@placement-platform/contracts';
import { academicService, AcademicError } from './academic.service.js';
import { requireAuth, requireRole, getTenantScope } from '../../middlewares/auth.js';
import { csrfProtection } from '../../middlewares/csrf.js';
import { validateBody } from '../../middlewares/validate.js';

export const academicRouter: ExpressRouter = Router();

// ─── Department Endpoints ───────────────────────────────────────────────────

/**
 * POST /api/v1/academics/departments
 * Creates a new academic department. Only college_admin and tpo can perform this action.
 */
academicRouter.post(
  '/academics/departments',
  requireAuth,
  csrfProtection,
  requireRole('college_admin', 'tpo'),
  validateBody(DepartmentCreateSchema),
  async (req: Request, res: Response): Promise<void> => {
    const requestId = crypto.randomUUID();
    try {
      const orgId = getTenantScope(req);
      const department = await academicService.createDepartment(orgId, req.body, {
        userId: req.session?.userId,
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      });

      res.status(201).json({
        data: department,
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      if (error instanceof AcademicError) {
        res.status(error.statusCode).json({
          error: {
            code: error.code,
            message: error.message,
            requestId,
          },
        });
        return;
      }

      console.error('[academics] Error creating department:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred while creating the department.',
          requestId,
        },
      });
    }
  }
);

/**
 * GET /api/v1/academics/departments
 * Lists all academic departments for the authenticated college.
 */
academicRouter.get(
  '/academics/departments',
  requireAuth,
  requireRole('college_admin', 'tpo', 'dept_coordinator', 'faculty_mentor'),
  async (req: Request, res: Response): Promise<void> => {
    const requestId = crypto.randomUUID();
    try {
      const orgId = getTenantScope(req);
      const departments = await academicService.listDepartments(orgId);

      res.status(200).json({
        data: departments,
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      if (error instanceof AcademicError) {
        res.status(error.statusCode).json({
          error: {
            code: error.code,
            message: error.message,
            requestId,
          },
        });
        return;
      }

      console.error('[academics] Error listing departments:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred while listing departments.',
          requestId,
        },
      });
    }
  }
);

/**
 * PUT /api/v1/academics/departments/:id
 * Updates an existing department. Only college_admin and tpo can perform this action.
 */
academicRouter.put(
  '/academics/departments/:id',
  requireAuth,
  csrfProtection,
  requireRole('college_admin', 'tpo'),
  validateBody(DepartmentUpdateSchema),
  async (req: Request, res: Response): Promise<void> => {
    const requestId = crypto.randomUUID();
    try {
      const orgId = getTenantScope(req);
      const department = await academicService.updateDepartment(
        orgId,
        req.params.id as string,
        req.body,
        {
          userId: req.session?.userId,
          ipAddress: req.ip || req.socket.remoteAddress,
          userAgent: req.headers['user-agent'],
        }
      );

      res.status(200).json({
        data: department,
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      if (error instanceof AcademicError) {
        res.status(error.statusCode).json({
          error: {
            code: error.code,
            message: error.message,
            requestId,
          },
        });
        return;
      }

      console.error('[academics] Error updating department:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred while updating the department.',
          requestId,
        },
      });
    }
  }
);

// ─── Academic Batch Endpoints ───────────────────────────────────────────────

/**
 * POST /api/v1/academics/batches
 * Creates a new academic batch. Only college_admin and tpo can perform this action.
 */
academicRouter.post(
  '/academics/batches',
  requireAuth,
  csrfProtection,
  requireRole('college_admin', 'tpo'),
  validateBody(AcademicBatchCreateSchema),
  async (req: Request, res: Response): Promise<void> => {
    const requestId = crypto.randomUUID();
    try {
      const orgId = getTenantScope(req);
      const batch = await academicService.createBatch(orgId, req.body, {
        userId: req.session?.userId,
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      });

      res.status(201).json({
        data: batch,
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      if (error instanceof AcademicError) {
        res.status(error.statusCode).json({
          error: {
            code: error.code,
            message: error.message,
            requestId,
          },
        });
        return;
      }

      console.error('[academics] Error creating academic batch:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred while creating the academic batch.',
          requestId,
        },
      });
    }
  }
);

/**
 * GET /api/v1/academics/batches
 * Lists all academic batches for the authenticated college.
 */
academicRouter.get(
  '/academics/batches',
  requireAuth,
  requireRole('college_admin', 'tpo', 'dept_coordinator', 'faculty_mentor'),
  async (req: Request, res: Response): Promise<void> => {
    const requestId = crypto.randomUUID();
    try {
      const orgId = getTenantScope(req);
      const batches = await academicService.listBatches(orgId);

      res.status(200).json({
        data: batches,
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      if (error instanceof AcademicError) {
        res.status(error.statusCode).json({
          error: {
            code: error.code,
            message: error.message,
            requestId,
          },
        });
        return;
      }

      console.error('[academics] Error listing academic batches:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred while listing academic batches.',
          requestId,
        },
      });
    }
  }
);

/**
 * PUT /api/v1/academics/batches/:id
 * Updates an existing academic batch. Only college_admin and tpo can perform this action.
 */
academicRouter.put(
  '/academics/batches/:id',
  requireAuth,
  csrfProtection,
  requireRole('college_admin', 'tpo'),
  validateBody(AcademicBatchUpdateSchema),
  async (req: Request, res: Response): Promise<void> => {
    const requestId = crypto.randomUUID();
    try {
      const orgId = getTenantScope(req);
      const batch = await academicService.updateBatch(
        orgId,
        req.params.id as string,
        req.body,
        {
          userId: req.session?.userId,
          ipAddress: req.ip || req.socket.remoteAddress,
          userAgent: req.headers['user-agent'],
        }
      );

      res.status(200).json({
        data: batch,
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      if (error instanceof AcademicError) {
        res.status(error.statusCode).json({
          error: {
            code: error.code,
            message: error.message,
            requestId,
          },
        });
        return;
      }

      console.error('[academics] Error updating academic batch:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred while updating the academic batch.',
          requestId,
        },
      });
    }
  }
);
