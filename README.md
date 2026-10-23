# Placement Intelligence Platform

Multi-tenant SaaS platform for college placement operations, training and placement officers (TPOs), students, and company recruiters.

## Architecture Baseline

- **Architecture:** Modular Monolith
- **Repository:** `pnpm` workspaces monorepo
- **Frontend (`apps/web`):** React 19 + TypeScript + Vite SPA
- **Backend (`apps/api`):** Express 4 + TypeScript HTTP API
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

- Node.js >= 22 (< 23) — see `.nvmrc`
- pnpm >= 9.0.0

## Quick Start

### 1 — Install dependencies

```bash
pnpm install
```

### 2 — Set up environment variables

```bash
# Copy the example file (never commit the real .env)
cp .env.example .env
```

The defaults in `.env.example` work for local development without any changes.

### 3 — Run the backend API

```bash
# In one terminal:
pnpm dev:api
# API starts at http://localhost:4000
```

### 4 — Run the frontend

```bash
# In a second terminal:
pnpm dev:web
# Web app starts at http://localhost:5173
```

Or start **both at the same time** with:

```bash
pnpm dev
```

### 5 — Test the health endpoint

```bash
# Using curl:
curl http://localhost:4000/api/v1/health

# Expected response:
# {
#   "status": "ok",
#   "service": "placement-platform-api",
#   "version": "0.1.0",
#   "environment": "development",
#   "meta": { "requestId": "...", "timestamp": "..." }
# }
```

The web frontend also shows a **"API Online" / "API Offline"** badge in the top-right corner and a full health detail panel at the bottom of the dashboard.

## Available Scripts

```bash
# Start both frontend and backend in parallel (development)
pnpm dev

# Start backend only
pnpm dev:api

# Start frontend only
pnpm dev:web

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

# Build all buildable workspace packages
pnpm run build

# Run tests across packages
pnpm run test
```

## Running Tests

```bash
# Run all tests (api package currently has health endpoint tests)
pnpm test

# Or run API tests only:
pnpm --filter @placement-platform/api test
```

## Current Status (Phase 1)

| Feature | Status |
|---|---|
| Express API server | ✅ Done |
| `GET /api/v1/health` endpoint | ✅ Done |
| React + Vite frontend | ✅ Done |
| Dashboard shell + sidebar | ✅ Done |
| Backend connection indicator | ✅ Done |
| Placeholder metric cards | ✅ Done |
| Health endpoint tests (vitest) | ✅ Done |
| MongoDB connection | ⏳ Phase 2 |
| Authentication | ⏳ Phase 2 |
| Business workflows | ⏳ Future |
