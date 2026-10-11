# ADR 0002: Shared Database Multi-Tenancy with Scoped Repository Layer

- **Status:** Draft (Proposed)
- **Date:** 2026-10-12
- **Context:** Selecting the multi-tenancy storage model for collegiate data isolation.

## Decision

Adopt a shared MongoDB database with tenant-scoped documents (`orgId` attached to every tenant-owned document). Tenant isolation is enforced through a mandatory repository layer reading `orgId` from the verified session context, coupled with compound indexes prefixed by `orgId`.

## Consequences

### Positive

- Lowest operational cost and simplest schema migrations.
- Simple cross-tenant aggregated analytics for platform administrators.
- Supports colleges of 500–5,000 students efficiently on modest infrastructure.

### Negative / Trade-offs

- A coding bug could theoretically leak cross-tenant data.
- Requires automated tenant-isolation regression test suites before production.
