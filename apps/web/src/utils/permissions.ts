import type { UserRole } from '@placement-platform/contracts';

/**
 * Checks if the user role can create or update academic structure (departments, batches).
 * Backend permits only college_admin and tpo.
 */
export function canManageAcademics(role?: UserRole): boolean {
  return role === 'college_admin' || role === 'tpo';
}

/**
 * Checks if the user role can view academic departments and batches.
 * Backend permits college_admin, tpo, dept_coordinator, and faculty_mentor.
 */
export function canViewAcademics(role?: UserRole): boolean {
  return (
    role === 'college_admin' ||
    role === 'tpo' ||
    role === 'dept_coordinator' ||
    role === 'faculty_mentor'
  );
}

/**
 * Checks if the user role can access the student directory.
 * Backend permits college_admin, tpo, and dept_coordinator.
 */
export function canViewStudents(role?: UserRole): boolean {
  return role === 'college_admin' || role === 'tpo' || role === 'dept_coordinator';
}

/**
 * Checks if the user role can create new student profiles or edit existing ones.
 * Backend permits only college_admin and tpo.
 */
export function canCreateOrEditStudents(role?: UserRole): boolean {
  return role === 'college_admin' || role === 'tpo';
}

/**
 * Checks if the user role can verify student academic records.
 * Backend permits college_admin, tpo, and dept_coordinator (scoped).
 */
export function canVerifyStudents(role?: UserRole): boolean {
  return role === 'college_admin' || role === 'tpo' || role === 'dept_coordinator';
}

/**
 * Checks if the user role can change student placement status (unplaced/placed/opted_out/blocked).
 * Backend permits only college_admin and tpo.
 */
export function canUpdateStudentStatus(role?: UserRole): boolean {
  return role === 'college_admin' || role === 'tpo';
}

/**
 * Checks if the user has coordinator-restricted department scope.
 */
export function isCoordinatorScoped(role?: UserRole): boolean {
  return role === 'dept_coordinator';
}

/**
 * Checks if the user role can view the company directory and recruiter rosters.
 * Backend permits college_admin, tpo, dept_coordinator, and company users.
 */
export function canViewCompanies(role?: UserRole): boolean {
  return (
    role === 'college_admin' ||
    role === 'tpo' ||
    role === 'dept_coordinator' ||
    role === 'company_admin' ||
    role === 'company_recruiter' ||
    role === 'interviewer'
  );
}

/**
 * Checks if the user role can register new companies or edit college-specific company profiles.
 * Backend permits college_admin and tpo.
 */
export function canManageCompanies(role?: UserRole): boolean {
  return role === 'college_admin' || role === 'tpo';
}

/**
 * Checks if the user role can verify company status or update tier.
 * Backend permits college_admin and tpo.
 */
export function canVerifyOrTierCompany(role?: UserRole): boolean {
  return role === 'college_admin' || role === 'tpo';
}

/**
 * Checks if the user role can invite recruiters or manage recruiter invitations.
 * Backend permits college_admin, tpo, and company_admin.
 */
export function canManageRecruiters(role?: UserRole): boolean {
  return role === 'college_admin' || role === 'tpo' || role === 'company_admin';
}

