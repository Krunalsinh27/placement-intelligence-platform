import { z } from 'zod';

export const UserRoleSchema = z.enum([
  // Platform Roles
  'platform_super_admin',
  'platform_support_operator',
  // Organization / College Roles
  'college_admin',
  'tpo',
  'dept_coordinator',
  'faculty_mentor',
  'student',
  'company_admin',
  'company_recruiter',
  'interviewer',
  'support_staff',
]);

export type UserRole = z.infer<typeof UserRoleSchema>;

export const LoginRequestSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const AuthUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  fullName: z.string(),
  activeOrgId: z.string().nullable(),
  role: UserRoleSchema,
});

export type AuthUser = z.infer<typeof AuthUserSchema>;

export const AuthResponseDataSchema = z.object({
  user: AuthUserSchema,
});

export type AuthResponseData = z.infer<typeof AuthResponseDataSchema>;
