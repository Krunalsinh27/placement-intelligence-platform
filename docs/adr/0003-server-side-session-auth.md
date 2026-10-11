# ADR 0003: Server-Side Session Authentication with Secure Cookies

- **Status:** Draft (Proposed)
- **Date:** 2026-10-12
- **Context:** Selecting authentication mechanism for first-party web clients.

## Decision

Adopt server-side sessions over stateless JWTs stored in browser storage (`localStorage`/`sessionStorage`). Sessions will use cryptographically random 256-bit identifiers stored hashed in MongoDB and transmitted via `httpOnly`, `Secure`, `SameSite=Lax` cookies.

## Consequences

### Positive

- Immunity to XSS credential theft via JavaScript.
- Immediate server-side session revocation (e.g. staff departure, student graduation, compromised credentials).
- Simplified session rotation on privilege transitions.

### Negative / Trade-offs

- Stateful storage requirement for active sessions.
- Requires CSRF mitigation (SameSite cookies + origin checks + custom request header validation).
