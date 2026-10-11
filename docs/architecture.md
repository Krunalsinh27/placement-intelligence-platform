# Placement Intelligence Platform — System Architecture

## 1. Architectural Style: Modular Monolith

The platform is organized as a modular monolith within a `pnpm` workspaces repository. Rather than decomposing into early microservices, domain modules reside in a single codebase with strictly defined boundaries.

### Core Boundaries

- **Contracts (`packages/contracts`):** Defines pure types, Zod schemas, status state transitions, and permission definitions. Contains zero I/O or database dependencies.
- **Backend API (`apps/api`):** Express application structured into modular domain packages (`auth`, `organizations`, `academics`, `students`, `companies`, `drives`, `applications`, `interviews`, `offers`, `reports`). Modules interact via explicit service interfaces, never by reaching into another module's database models.
- **Frontend SPA (`apps/web`):** React SPA using Vite, Tailwind CSS, shadcn/ui, TanStack Query, and React Router.

## 2. Multi-Tenancy Architecture

- **Model:** Shared MongoDB database with tenant-scoped documents (`orgId` field on all tenant-owned entities).
- **Enforcement:** Enforced at the server repository level using scoped queries (`orgId: session.orgId`). Client-supplied `orgId` headers or parameters are never trusted for authority.
- **Indexes:** Compound indexes with `orgId` as the leading key ensure strict query isolation and index performance.

## 3. Session & Security Model

- **Authentication:** Stateful server-side sessions with cryptographic identifiers stored hashed in the database.
- **Cookies:** Transported via `__Host-` prefixed, `httpOnly`, `Secure`, `SameSite=Lax` cookies.
- **CSRF Defense:** SameSite cookie isolation + custom header requirement + origin validation.
- **Authorization:** Table-driven role and permission matrix evaluated server-side.
