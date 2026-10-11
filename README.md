# Placement Intelligence Platform

Multi-tenant SaaS platform for college placement operations, training and placement officers (TPOs), students, and company recruiters.

## Architecture Baseline

- **Architecture:** Modular Monolith
- **Repository:** `pnpm` workspaces monorepo
- **Frontend (`apps/web`):** Typecheck-only stub (no React/Vite runtime build yet; foundation phase stub)
- **Backend (`apps/api`):** Typecheck-only stub (no Express server listener yet; foundation phase stub)
- **Shared Contracts (`packages/contracts`):** Zod 4 schemas and DTOs
- **Tooling Configuration (`packages/config`):** Centralized ESLint flat config and Prettier config
- **Database:** MongoDB with replica-set transactions (deferred to foundation task)
- **Authentication:** Server-side sessions with secure, httpOnly cookies (deferred to auth task)

## Repository Structure

```text
.
├── apps/
│   ├── api/                 # Express backend modular monolith (typecheck stub)
│   └── web/                 # React SPA frontend (typecheck stub)
├── packages/
│   ├── config/              # Shared ESLint and Prettier configs
│   └── contracts/           # Shared Zod 4 schemas, DTOs, and enums
├── docs/                    # Architecture documentation, ADRs, and blueprint
│   ├── adr/                 # Architecture Decision Records (Drafts)
│   ├── architecture.md      # System architecture document
│   └── placement-platform-blueprint.md # Canonical product and engineering blueprint
├── .github/                 # Workflows and PR templates
└── tsconfig.base.json       # Strict TypeScript compiler options
```

## Prerequisites

- Node.js >= 24 (< 25)
- pnpm >= 9.0.0

## Available Scripts

```bash
# Install workspace dependencies
pnpm install

# Run TypeScript type check across all packages
pnpm run typecheck

# Run real ESLint checks across repository
pnpm run lint

# Automatically fix ESLint errors
pnpm run lint:fix

# Check formatting with Prettier
pnpm run format:check

# Format repository files with Prettier
pnpm run format

# Build buildable workspace packages (contracts, api)
pnpm run build

# Run tests across packages if defined
pnpm run test
```
