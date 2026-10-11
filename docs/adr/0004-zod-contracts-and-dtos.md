# ADR 0004: Shared Zod Contracts and DTOs

- **Status:** Draft (Proposed)
- **Date:** 2026-10-12
- **Context:** Preventing contract drift between frontend and backend in a monorepo.

## Decision

Define all API request bodies, response payloads, query parameter schemas, enums, and state transitions in a pure TypeScript package (`packages/contracts`) using Zod. Both `apps/api` and `apps/web` import directly from this package.

## Consequences

### Positive

- Single source of truth eliminating frontend/backend interface drift.
- Automatic runtime validation on API endpoints and static type derivation via `z.infer`.
- Facilitates auto-generation of OpenAPI specifications via `zod-to-openapi`.

### Negative / Trade-offs

- `packages/contracts` must remain pure TypeScript with zero runtime side-effects or heavy external dependencies.
