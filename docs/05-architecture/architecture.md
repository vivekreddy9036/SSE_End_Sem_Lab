# Phase 5 — Software Architecture and Design Engineering

Diagram source: `architecture.mmd` (paste into https://mermaid.live).

## 1. Architectural Style: Layered (N-Tier) Monolith with a Server-Rendered BFF

**Chosen style:** a layered architecture — Presentation → API/Controller → Domain/Service → Data Access → Database — implemented as a single Next.js application (the framework's App Router gives both the UI and the API routes in one deployable unit, i.e. a "Backend-for-Frontend" shape without a separate network hop between page and API).

**Justification:**
- **Scope fit.** An IAM platform of this scope (single team, moderate traffic, one primary data store) gains nothing from splitting into microservices — a monolith with clean internal layering gets the same separation-of-concerns benefit without the operational cost of service-to-service auth, network partitioning, and distributed tracing that a security-critical system would otherwise have to defend.
- **Security locality.** Keeping authentication, authorization, and audit logic in one deployable unit (`src/lib/*`) means there is exactly one codebase to review for the security-critical paths, not N services each with their own copy of "is this user allowed to do this."
- **Matches what was already there.** The reused auth/MFA/audit stack (Batch A) was already built this way; preserving the architectural style avoided a costly rewrite and let the domain pivot (complaint-tracking → IAM) happen entirely within the existing layer boundaries.

## 2. Components and Responsibilities

| Layer | Component | Responsibility | Interface |
|---|---|---|---|
| Presentation | Auth Pages | Registration, login, 2FA setup/verify, password reset UI | HTTPS, cookies |
| Presentation | Self-Service Pages | Dashboard, access-request submission + history | HTTPS, cookies |
| Presentation | Admin Pages | User/role/permission/resource management, approval queue, audit log viewer | HTTPS, cookies |
| Controller | `/api/auth/*` | Parses/validates requests, orchestrates `auth.ts`/`totp.ts`/`passkey.ts`, issues cookies | REST (JSON) |
| Controller | `/api/access-requests`, `/api/admin/access-requests/*` | Create/list/review access requests, enforce approval authority | REST (JSON) |
| Controller | `/api/admin/users`, `/roles`, `/permissions`, `/resources` | Identity-structure CRUD, enforce Administrator-only + privilege-escalation checks | REST (JSON) |
| Controller | `/api/admin/audit-log` | Paginated, permission-gated audit read | REST (JSON) |
| Domain/Service | `auth.ts` | JWT sign/verify, cookie construction, 2FA-pending token | Function calls |
| Domain/Service | `authz.ts` | Computes effective permissions; privilege-escalation and approval-authority guards | Function calls |
| Domain/Service | `totp.ts` + `crypto.ts` | TOTP secret generation/encryption, recovery codes, shared lockout-timer logic | Function calls |
| Domain/Service | `passkey.ts` | WebAuthn registration/authentication ceremonies | Function calls |
| Domain/Service | `password-reset.ts` | Hashed, single-use, time-limited reset tokens | Function calls |
| Domain/Service | `audit.ts` | Non-blocking audit writes, IP/geo resolution | Function calls |
| Domain/Service | `rate-limit.ts` | In-memory sliding-window limiter, keyed by IP | Function calls |
| Data Access | Prisma Client | Type-safe query builder generated from `schema.prisma` | SQL (Postgres wire protocol) |
| Infrastructure | `middleware.ts` | Edge-level JWT verification + coarse role/permission gate, before any controller runs | Next.js middleware API |

## 3. Design Concepts / Patterns Applied (≥ 4)

1. **Layered Architecture** — described above; strict one-directional dependency (Presentation → Controller → Service → Data Access), no layer reaches backward.
2. **Guard / Chain-of-Responsibility for Authorization** — `requireAuth`, `requireRole`, `requirePermission`, `assertCanAssignRole`, `assertCanApprove` are small, composable functions each checking one condition and short-circuiting on failure, rather than one large conditional per route. Any route composes exactly the guards it needs.
3. **Strategy Pattern for Second-Factor Verification** — TOTP and Passkey are two interchangeable strategies satisfying the same contract ("prove possession of a second factor"); the login flow doesn't care which one ran, only that `verified === true` came back, letting a new method (e.g. SMS OTP) be added without touching the login controller.
4. **Repository / Data-Mapper via ORM** — Prisma Client is the single data-access abstraction; no raw SQL string-building exists anywhere in a controller or service, which closes off SQL injection as an attack class by construction rather than by discipline.
5. **Defense in Depth (architectural, not just a single pattern)** — authorization is checked twice on every sensitive action: once coarsely at the edge (`middleware.ts`, from a JWT that can be up to 15 minutes stale) and once precisely inside the controller/service layer against live database state (`authz.ts`). Neither check alone is trusted as sufficient.

## 4. Mapping: Authentication, Access-Decision, and Audit/Logging to Components

| Concern | Primary Component(s) |
|---|---|
| **Authentication** | `/api/auth/login`, `/api/auth/2fa/*`, `/api/auth/passkey/*` (controllers) → `auth.ts`, `totp.ts`, `passkey.ts` (services) → `User`, `Passkey` (entities) |
| **Access decision** (the IAM equivalent of "evaluation/results" — a bounded request that produces a recorded, binding outcome) | `/api/access-requests`, `/api/admin/access-requests/[id]/review` (controllers) → `authz.ts` (`assertCanApprove`) → `AccessRequest`, `UserPermission` (entities) |
| **Audit / logging** | Every controller and service above calls `audit.ts` → `AuditLog` entity; read access is itself gated by `AUDIT_LOG_READ`, enforced in both `middleware.ts` (coarse) and `/api/admin/audit-log` (precise) |
