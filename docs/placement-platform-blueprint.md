# AI-Powered Placement Intelligence Platform — Product & Engineering Blueprint

Status: PLAN ONLY. Approved baseline for implementation.

## A. Executive Summary and Product Vision

What it is: A multi-tenant SaaS where each college (tenant) runs its whole placement process: academic structure, student profiles, companies, drives, eligibility, applications, interviews, offers, and reports. Companies get scoped access to only the drives and students they are authorized to see.

### Core Principles
1. **Correctness before cleverness:** Eligibility, shortlisting, and offers are decided by explicit rules and human actions, never by AI.
2. **Tenant isolation is the #1 security property:** Every query is tenant-scoped by server-side context (`orgId`), never by a client-supplied ID.
3. **MVP first:** One college, one TPO, students, companies, drives, applications, offers, basic reports. No Redis, no Kubernetes, no microservices at start.
4. **AI is optional:** The product is fully useful with AI turned off.
5. **Auditable:** Every sensitive action leaves an immutable audit record.

## B. Assumptions, Scope, Risks

### Assumptions
- India-centric colleges (CGPA, backlogs, LPA compensation, dream/super-dream policies).
- Students per college: 500–5,000. Total early scale: under 50k students. MongoDB on Atlas replica set.
- Companies are invited by the TPO; a company can recruit at multiple colleges.

### Scope Boundaries (Deliberately out of MVP)
- Online coding-test engine (integrate third-party links first).
- Video interviews (store meeting links).
- Billing/payments automation, mobile apps, SSO/SAML, self-hosted AI.

## C. Roles and Permissions Matrix

### Roles
- **Platform Roles:** `platform_super_admin`, `platform_support_operator`.
- **Organization Roles:** `college_admin`, `tpo`, `dept_coordinator`, `faculty_mentor`, `student`, `company_admin`, `company_recruiter`, `interviewer`, `support_staff`.

### Security Constraints
- SuperAdmin has no default access to student PII.
- Recruiters see applicant profile data only after shortlisting visibility rules apply.
- Multi-organization membership resolves tenant context on server session.

## D. Core Workflows & State Machines

1. **Student Eligibility:** Deterministic rule evaluation (`minCgpa`, `backlogs`, department, batch) producing snapshot with reasons. Override requires audit log and reason.
2. **Placement Drive Lifecycle:** Draft → PendingApproval → Approved → Published → ApplicationsClosed → InProgress → Completed → Archived.
3. **Application Lifecycle:** Applied → Withdrawn | Shortlisted | InRound | Selected | Rejected | OfferExtended | Closed.
4. **Offer Lifecycle:** Draft → Extended → Accepted | Declined | Expired | Revoked → Confirmed → Joined | NotJoined.

## E. System Architecture & Tech Stack

- **Architecture:** Modular Monolith (API + worker processes).
- **Frontend:** React, TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query.
- **Backend:** Node.js 22 LTS, Express, TypeScript, Mongoose.
- **Contracts:** Zod schemas shared across frontend and backend.
- **Database:** MongoDB with replica sets for multi-document ACID transactions.
- **Auth:** Server-side sessions with httpOnly, SameSite=Lax cookies, argon2id password hashing.
- **Logging:** Structured Pino JSON logging.
