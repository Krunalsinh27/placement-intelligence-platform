import { Router } from 'express';
import type { Request, Response, Router as ExpressRouter } from 'express';
import crypto from 'node:crypto';
import {
  StudentProfileCreateSchema,
  StudentProfileUpdateSchema,
  StudentVerifyRequestSchema,
  StudentStatusUpdateRequestSchema,
  StudentQueryFiltersSchema,
} from '@placement-platform/contracts';
import { studentService, StudentError } from './student.service.js';
import { requireAuth, requireRole, getTenantScope } from '../../middlewares/auth.js';
import { csrfProtection } from '../../middlewares/csrf.js';
import { validateBody } from '../../middlewares/validate.js';

export const studentRouter: ExpressRouter = Router();

/**
 * POST /api/v1/students
 * Creates a new student profile. Only college_admin and tpo can perform this action.
 */
studentRouter.post(
  '/students',
  requireAuth,
  csrfProtection,
  requireRole('college_admin', 'tpo'),
  validateBody(StudentProfileCreateSchema),
  async (req: Request, res: Response): Promise<void> => {
    const requestId = crypto.randomUUID();
    try {
      const orgId = getTenantScope(req);
      const student = await studentService.createStudent(orgId, req.body, {
        userId: req.session?.userId,
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      });

      res.status(201).json({
        data: student,
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      if (error instanceof StudentError) {
        res.status(error.statusCode).json({
          error: {
            code: error.code,
            message: error.message,
            requestId,
          },
        });
        return;
      }

      console.error('[students] Error creating student:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred while creating the student.',
          requestId,
        },
      });
    }
  }
);

/**
 * GET /api/v1/students
 * Paginated, filtered, and searchable directory of students.
 * Enforces department-level scoping for department coordinators.
 */
studentRouter.get(
  '/students',
  requireAuth,
  requireRole('college_admin', 'tpo', 'dept_coordinator'),
  async (req: Request, res: Response): Promise<void> => {
    const requestId = crypto.randomUUID();
    try {
      const orgId = getTenantScope(req);
      const filters = StudentQueryFiltersSchema.parse(req.query);

      const coordinatorDeptId =
        req.session?.role === 'dept_coordinator' ? req.session.departmentId : null;

      const result = await studentService.listStudents(
        orgId,
        filters,
        coordinatorDeptId
      );

      res.status(200).json({
        data: result,
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      if (error instanceof StudentError) {
        res.status(error.statusCode).json({
          error: {
            code: error.code,
            message: error.message,
            requestId,
          },
        });
        return;
      }

      console.error('[students] Error listing students:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred while listing students.',
          requestId,
        },
      });
    }
  }
);

/**
 * GET /api/v1/students/:id
 * Retrieves a single student profile.
 */
studentRouter.get(
  '/students/:id',
  requireAuth,
  requireRole('college_admin', 'tpo', 'dept_coordinator'),
  async (req: Request, res: Response): Promise<void> => {
    const requestId = crypto.randomUUID();
    try {
      const orgId = getTenantScope(req);
      const coordinatorDeptId =
        req.session?.role === 'dept_coordinator' ? req.session.departmentId : null;

      const student = await studentService.getStudentById(
        orgId,
        req.params.id as string,
        coordinatorDeptId
      );

      res.status(200).json({
        data: student,
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      if (error instanceof StudentError) {
        res.status(error.statusCode).json({
          error: {
            code: error.code,
            message: error.message,
            requestId,
          },
        });
        return;
      }

      console.error('[students] Error getting student by ID:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred while retrieving the student.',
          requestId,
        },
      });
    }
  }
);

/**
 * PUT /api/v1/students/:id
 * Updates an existing student profile. Only college_admin and tpo can perform this action.
 */
studentRouter.put(
  '/students/:id',
  requireAuth,
  csrfProtection,
  requireRole('college_admin', 'tpo'),
  validateBody(StudentProfileUpdateSchema),
  async (req: Request, res: Response): Promise<void> => {
    const requestId = crypto.randomUUID();
    try {
      const orgId = getTenantScope(req);
      const student = await studentService.updateStudent(
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
        data: student,
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      if (error instanceof StudentError) {
        res.status(error.statusCode).json({
          error: {
            code: error.code,
            message: error.message,
            requestId,
          },
        });
        return;
      }

      console.error('[students] Error updating student:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred while updating the student.',
          requestId,
        },
      });
    }
  }
);

/**
 * PATCH /api/v1/students/:id/verify
 * Verifies academic data. Allowed for college_admin, tpo, and dept_coordinator (scoped).
 */
studentRouter.patch(
  '/students/:id/verify',
  requireAuth,
  csrfProtection,
  requireRole('college_admin', 'tpo', 'dept_coordinator'),
  validateBody(StudentVerifyRequestSchema),
  async (req: Request, res: Response): Promise<void> => {
    const requestId = crypto.randomUUID();
    try {
      const orgId = getTenantScope(req);
      const coordinatorDeptId =
        req.session?.role === 'dept_coordinator' ? req.session.departmentId : null;

      const student = await studentService.verifyStudent(
        orgId,
        req.params.id as string,
        req.body,
        {
          userId: req.session?.userId,
          ipAddress: req.ip || req.socket.remoteAddress,
          userAgent: req.headers['user-agent'],
        },
        coordinatorDeptId
      );

      res.status(200).json({
        data: student,
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      if (error instanceof StudentError) {
        res.status(error.statusCode).json({
          error: {
            code: error.code,
            message: error.message,
            requestId,
          },
        });
        return;
      }

      console.error('[students] Error verifying student:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred while verifying the student.',
          requestId,
        },
      });
    }
  }
);

/**
 * PATCH /api/v1/students/:id/status
 * Updates student placement status. Only college_admin and tpo can perform this action.
 */
studentRouter.patch(
  '/students/:id/status',
  requireAuth,
  csrfProtection,
  requireRole('college_admin', 'tpo'),
  validateBody(StudentStatusUpdateRequestSchema),
  async (req: Request, res: Response): Promise<void> => {
    const requestId = crypto.randomUUID();
    try {
      const orgId = getTenantScope(req);
      const student = await studentService.updateStatus(
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
        data: student,
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      if (error instanceof StudentError) {
        res.status(error.statusCode).json({
          error: {
            code: error.code,
            message: error.message,
            requestId,
          },
        });
        return;
      }

      console.error('[students] Error updating student status:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred while updating the student status.',
          requestId,
        },
      });
    }
  }
);
