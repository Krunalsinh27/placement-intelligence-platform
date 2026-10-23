import { Router } from 'express';
import type { Request, Response, Router as ExpressRouter } from 'express';
import crypto from 'node:crypto';
import {
  RecruiterInviteRequestSchema,
  RecruiterAcceptInviteRequestSchema,
  RecruiterQueryFiltersSchema,
} from '@placement-platform/contracts';
import { recruiterService, RecruiterError } from './recruiter.service.js';
import {
  requireAuth,
  requireRole,
  optionalAuth,
} from '../../middlewares/auth.js';
import { csrfProtection } from '../../middlewares/csrf.js';
import { validateBody } from '../../middlewares/validate.js';

export const recruiterRouter: ExpressRouter = Router();

/**
 * POST /api/v1/companies/:companyId/recruiters/invite
 * Invites a recruiter or interviewer for a company.
 * Authorized for college_admin, tpo, and company_admin.
 */
recruiterRouter.post(
  '/companies/:companyId/recruiters/invite',
  requireAuth,
  csrfProtection,
  requireRole('college_admin', 'tpo', 'company_admin'),
  validateBody(RecruiterInviteRequestSchema),
  async (req: Request, res: Response): Promise<void> => {
    const requestId = crypto.randomUUID();
    try {
      const companyId = req.params.companyId as string;
      const caller = {
        orgId: req.session?.orgId ?? null,
        userId: req.session!.userId,
        role: req.session!.role,
        email: req.session?.user.email,
      };

      const result = await recruiterService.inviteRecruiter(
        companyId,
        caller,
        req.body,
        {
          userId: req.session?.userId,
          ipAddress: req.ip || req.socket.remoteAddress,
          userAgent: req.headers['user-agent'],
        }
      );

      res.status(201).json({
        data: result,
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      if (error instanceof RecruiterError) {
        res.status(error.statusCode).json({
          error: {
            code: error.code,
            message: error.message,
            requestId,
          },
        });
        return;
      }

      console.error('[recruiters] Error inviting recruiter:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred while inviting the recruiter.',
          requestId,
        },
      });
    }
  }
);

/**
 * POST /api/v1/recruiters/accept-invitation
 * Accepts an invitation using a raw cryptographic token.
 * Existing users must authenticate first with matching account.
 * New users provide a password to initialize their account.
 */
recruiterRouter.post(
  '/recruiters/accept-invitation',
  optionalAuth,
  validateBody(RecruiterAcceptInviteRequestSchema),
  async (req: Request, res: Response): Promise<void> => {
    const requestId = crypto.randomUUID();
    try {
      const authenticatedUser = req.session
        ? {
            userId: req.session.userId,
            email: req.session.user.email,
          }
        : null;

      const result = await recruiterService.acceptInvitation(
        req.body,
        authenticatedUser,
        {
          userId: req.session?.userId,
          ipAddress: req.ip || req.socket.remoteAddress,
          userAgent: req.headers['user-agent'],
        }
      );

      res.status(200).json({
        data: result,
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      if (error instanceof RecruiterError) {
        res.status(error.statusCode).json({
          error: {
            code: error.code,
            message: error.message,
            requestId,
          },
        });
        return;
      }

      console.error('[recruiters] Error accepting invitation:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred while accepting the invitation.',
          requestId,
        },
      });
    }
  }
);

/**
 * GET /api/v1/companies/:companyId/recruiters
 * Paginated and searchable list of recruiters for a company.
 */
recruiterRouter.get(
  '/companies/:companyId/recruiters',
  requireAuth,
  requireRole(
    'college_admin',
    'tpo',
    'dept_coordinator',
    'company_admin',
    'company_recruiter',
    'interviewer'
  ),
  async (req: Request, res: Response): Promise<void> => {
    const requestId = crypto.randomUUID();
    try {
      const companyId = req.params.companyId as string;
      const caller = {
        orgId: req.session?.orgId ?? null,
        userId: req.session!.userId,
        role: req.session!.role,
        email: req.session?.user.email,
      };

      const parsedFilters = RecruiterQueryFiltersSchema.safeParse(req.query);
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

      const result = await recruiterService.listRecruiters(
        companyId,
        caller,
        parsedFilters.data
      );

      res.status(200).json({
        data: result,
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      if (error instanceof RecruiterError) {
        res.status(error.statusCode).json({
          error: {
            code: error.code,
            message: error.message,
            requestId,
          },
        });
        return;
      }

      console.error('[recruiters] Error listing recruiters:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred while listing recruiters.',
          requestId,
        },
      });
    }
  }
);

/**
 * POST /api/v1/companies/:companyId/recruiters/:id/resend
 * Resends an invitation with a refreshed 7-day token.
 */
recruiterRouter.post(
  '/companies/:companyId/recruiters/:id/resend',
  requireAuth,
  csrfProtection,
  requireRole('college_admin', 'tpo', 'company_admin'),
  async (req: Request, res: Response): Promise<void> => {
    const requestId = crypto.randomUUID();
    try {
      const companyId = req.params.companyId as string;
      const recruiterId = req.params.id as string;
      const caller = {
        orgId: req.session?.orgId ?? null,
        userId: req.session!.userId,
        role: req.session!.role,
        email: req.session?.user.email,
      };

      const result = await recruiterService.resendInvitation(
        companyId,
        recruiterId,
        caller,
        {
          userId: req.session?.userId,
          ipAddress: req.ip || req.socket.remoteAddress,
          userAgent: req.headers['user-agent'],
        }
      );

      res.status(200).json({
        data: result,
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      if (error instanceof RecruiterError) {
        res.status(error.statusCode).json({
          error: {
            code: error.code,
            message: error.message,
            requestId,
          },
        });
        return;
      }

      console.error('[recruiters] Error resending invitation:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred while resending the invitation.',
          requestId,
        },
      });
    }
  }
);

/**
 * POST /api/v1/companies/:companyId/recruiters/:id/revoke
 * Revokes a pending recruiter invitation.
 */
recruiterRouter.post(
  '/companies/:companyId/recruiters/:id/revoke',
  requireAuth,
  csrfProtection,
  requireRole('college_admin', 'tpo', 'company_admin'),
  async (req: Request, res: Response): Promise<void> => {
    const requestId = crypto.randomUUID();
    try {
      const companyId = req.params.companyId as string;
      const recruiterId = req.params.id as string;
      const caller = {
        orgId: req.session?.orgId ?? null,
        userId: req.session!.userId,
        role: req.session!.role,
        email: req.session?.user.email,
      };

      const result = await recruiterService.revokeInvitation(
        companyId,
        recruiterId,
        caller,
        {
          userId: req.session?.userId,
          ipAddress: req.ip || req.socket.remoteAddress,
          userAgent: req.headers['user-agent'],
        }
      );

      res.status(200).json({
        data: result,
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      if (error instanceof RecruiterError) {
        res.status(error.statusCode).json({
          error: {
            code: error.code,
            message: error.message,
            requestId,
          },
        });
        return;
      }

      console.error('[recruiters] Error revoking invitation:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred while revoking the invitation.',
          requestId,
        },
      });
    }
  }
);

/**
 * POST /api/v1/companies/:companyId/recruiters/:id/deactivate
 * Deactivates an active recruiter.
 */
recruiterRouter.post(
  '/companies/:companyId/recruiters/:id/deactivate',
  requireAuth,
  csrfProtection,
  requireRole('college_admin', 'tpo', 'company_admin'),
  async (req: Request, res: Response): Promise<void> => {
    const requestId = crypto.randomUUID();
    try {
      const companyId = req.params.companyId as string;
      const recruiterId = req.params.id as string;
      const caller = {
        orgId: req.session?.orgId ?? null,
        userId: req.session!.userId,
        role: req.session!.role,
        email: req.session?.user.email,
      };

      const result = await recruiterService.deactivateRecruiter(
        companyId,
        recruiterId,
        caller,
        {
          userId: req.session?.userId,
          ipAddress: req.ip || req.socket.remoteAddress,
          userAgent: req.headers['user-agent'],
        }
      );

      res.status(200).json({
        data: result,
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      if (error instanceof RecruiterError) {
        res.status(error.statusCode).json({
          error: {
            code: error.code,
            message: error.message,
            requestId,
          },
        });
        return;
      }

      console.error('[recruiters] Error deactivating recruiter:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred while deactivating the recruiter.',
          requestId,
        },
      });
    }
  }
);
