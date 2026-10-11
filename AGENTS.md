# Agent Engineering Guidelines — Placement Intelligence Platform

## Operating Principles

1. **Source of Truth:** Treat `docs/placement-platform-blueprint.md` as the authoritative architectural baseline. Do not change architecture, data model, security rules, or MVP boundaries without explicit user authorization.
2. **Safety First:**
   - Never run destructive git commands (`git reset --hard`, `git clean -fd`).
   - Never commit or push without explicit approval.
   - Never create or commit secrets, real student data, or production credentials.
   - Never disable or weaken tests or linting to get a passing build.
3. **Incremental Scaffolding:** Implement vertical slices step-by-step. Keep changes small (< 300 lines per task where practical).
4. **Tenant Isolation:** Enforce server-side tenant scoping (`orgId`) on every model query. Never trust client-supplied `orgId`.
5. **Shared Contracts:** Keep request/response schemas, DTOs, and status transition tables in `packages/contracts`. Modules communicate via services, never by directly mutating foreign models.
6. **Testing Discipline:** Every reported test or validation result must be backed by actual terminal execution and inspection.
