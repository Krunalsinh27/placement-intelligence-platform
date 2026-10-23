import { describe, it, expect } from 'vitest';
import {
  canManageAcademics,
  canViewAcademics,
  canViewStudents,
  canCreateOrEditStudents,
  canVerifyStudents,
  canUpdateStudentStatus,
  isCoordinatorScoped,
  canViewCompanies,
  canManageCompanies,
  canVerifyOrTierCompany,
  canManageRecruiters,
} from '../utils/permissions.js';
describe('Frontend Role-Based Permission Matrix (Step 7)', () => {

  describe('canManageAcademics()', () => {
    it('allows only college_admin and tpo to manage departments and batches', () => {
      expect(canManageAcademics('college_admin')).toBe(true);
      expect(canManageAcademics('tpo')).toBe(true);
      expect(canManageAcademics('dept_coordinator')).toBe(false);
      expect(canManageAcademics('faculty_mentor')).toBe(false);
      expect(canManageAcademics('student')).toBe(false);
      expect(canManageAcademics('company_recruiter')).toBe(false);
      expect(canManageAcademics(undefined)).toBe(false);
    });
  });

  describe('canViewAcademics()', () => {
    it('allows college_admin, tpo, dept_coordinator, and faculty_mentor to view academic structure', () => {
      expect(canViewAcademics('college_admin')).toBe(true);
      expect(canViewAcademics('tpo')).toBe(true);
      expect(canViewAcademics('dept_coordinator')).toBe(true);
      expect(canViewAcademics('faculty_mentor')).toBe(true);
      expect(canViewAcademics('student')).toBe(false);
      expect(canViewAcademics('company_recruiter')).toBe(false);
      expect(canViewAcademics(undefined)).toBe(false);
    });
  });

  describe('canViewStudents()', () => {
    it('allows college_admin, tpo, and dept_coordinator to access student directory', () => {
      expect(canViewStudents('college_admin')).toBe(true);
      expect(canViewStudents('tpo')).toBe(true);
      expect(canViewStudents('dept_coordinator')).toBe(true);
      expect(canViewStudents('faculty_mentor')).toBe(false);
      expect(canViewStudents('student')).toBe(false);
      expect(canViewStudents('company_recruiter')).toBe(false);
      expect(canViewStudents(undefined)).toBe(false);
    });
  });

  describe('canCreateOrEditStudents()', () => {
    it('permits only college_admin and tpo to create or edit student profiles', () => {
      expect(canCreateOrEditStudents('college_admin')).toBe(true);
      expect(canCreateOrEditStudents('tpo')).toBe(true);
      expect(canCreateOrEditStudents('dept_coordinator')).toBe(false);
      expect(canCreateOrEditStudents('faculty_mentor')).toBe(false);
      expect(canCreateOrEditStudents('student')).toBe(false);
      expect(canCreateOrEditStudents(undefined)).toBe(false);
    });
  });

  describe('canVerifyStudents()', () => {
    it('permits college_admin, tpo, and dept_coordinator (scoped) to verify student records', () => {
      expect(canVerifyStudents('college_admin')).toBe(true);
      expect(canVerifyStudents('tpo')).toBe(true);
      expect(canVerifyStudents('dept_coordinator')).toBe(true);
      expect(canVerifyStudents('faculty_mentor')).toBe(false);
      expect(canVerifyStudents('student')).toBe(false);
      expect(canVerifyStudents(undefined)).toBe(false);
    });
  });

  describe('canUpdateStudentStatus()', () => {
    it('permits only college_admin and tpo to change student placement status', () => {
      expect(canUpdateStudentStatus('college_admin')).toBe(true);
      expect(canUpdateStudentStatus('tpo')).toBe(true);
      expect(canUpdateStudentStatus('dept_coordinator')).toBe(false);
      expect(canUpdateStudentStatus('faculty_mentor')).toBe(false);
      expect(canUpdateStudentStatus('student')).toBe(false);
      expect(canUpdateStudentStatus(undefined)).toBe(false);
    });
  });

  describe('isCoordinatorScoped()', () => {
    it('identifies dept_coordinator for department-restricted UI views', () => {
      expect(isCoordinatorScoped('dept_coordinator')).toBe(true);
      expect(isCoordinatorScoped('college_admin')).toBe(false);
      expect(isCoordinatorScoped('tpo')).toBe(false);
      expect(isCoordinatorScoped('faculty_mentor')).toBe(false);
      expect(isCoordinatorScoped('student')).toBe(false);
      expect(isCoordinatorScoped(undefined)).toBe(false);
    });
  });

  describe('canViewCompanies()', () => {
    it('allows college_admin, tpo, dept_coordinator, and company users to view companies', () => {
      expect(canViewCompanies('college_admin')).toBe(true);
      expect(canViewCompanies('tpo')).toBe(true);
      expect(canViewCompanies('dept_coordinator')).toBe(true);
      expect(canViewCompanies('company_admin')).toBe(true);
      expect(canViewCompanies('company_recruiter')).toBe(true);
      expect(canViewCompanies('interviewer')).toBe(true);
      expect(canViewCompanies('faculty_mentor')).toBe(false);
      expect(canViewCompanies('student')).toBe(false);
      expect(canViewCompanies(undefined)).toBe(false);
    });
  });

  describe('canManageCompanies()', () => {
    it('allows only college_admin and tpo to register and edit company profiles', () => {
      expect(canManageCompanies('college_admin')).toBe(true);
      expect(canManageCompanies('tpo')).toBe(true);
      expect(canManageCompanies('dept_coordinator')).toBe(false);
      expect(canManageCompanies('company_admin')).toBe(false);
      expect(canManageCompanies('student')).toBe(false);
      expect(canManageCompanies(undefined)).toBe(false);
    });
  });

  describe('canVerifyOrTierCompany()', () => {
    it('allows only college_admin and tpo to transition verification status or tier', () => {
      expect(canVerifyOrTierCompany('college_admin')).toBe(true);
      expect(canVerifyOrTierCompany('tpo')).toBe(true);
      expect(canVerifyOrTierCompany('dept_coordinator')).toBe(false);
      expect(canVerifyOrTierCompany('company_admin')).toBe(false);
      expect(canVerifyOrTierCompany(undefined)).toBe(false);
    });
  });

  describe('canManageRecruiters()', () => {
    it('allows college_admin, tpo, and company_admin to manage recruiter invitations', () => {
      expect(canManageRecruiters('college_admin')).toBe(true);
      expect(canManageRecruiters('tpo')).toBe(true);
      expect(canManageRecruiters('company_admin')).toBe(true);
      expect(canManageRecruiters('company_recruiter')).toBe(false);
      expect(canManageRecruiters('dept_coordinator')).toBe(false);
      expect(canManageRecruiters('student')).toBe(false);
      expect(canManageRecruiters(undefined)).toBe(false);
    });
  });
});
