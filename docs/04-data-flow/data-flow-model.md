# Phase 4 — Data and Information Flow Modeling

Diagram sources (paste into https://mermaid.live or draw.io's Mermaid import):
- `er-diagram.mmd` — Entity-Relationship model
- `dfd-level0.mmd` — DFD Level 0 (context diagram)
- `dfd-level1.mmd` — DFD Level 1 (process decomposition)

## 1. ER Diagram Notes

Primary keys (`id`) are all autoincrement integers. Every foreign key is named exactly as it appears in `prisma/schema.prisma`, so the diagram and the running schema never drift apart. Cardinalities:

- `Role 1 ──< many User` — a role may be assigned to many users; a user holds exactly one role.
- `Resource 1 ──< many Permission` — a resource is protected by one or more permissions (e.g. `PAYROLL_READ`, `PAYROLL_WRITE`, `PAYROLL_APPROVE` all point at the `PAYROLL` resource).
- `Role many ──< many Permission` *through* `RolePermission` — the admin-defined baseline mapping.
- `User many ──< many Permission` *through* `UserPermission` — direct grants, including the ones created automatically when an `AccessRequest` is approved (`sourceAccessRequestId` links back to it).
- `AccessRequest 1 ──o| UserPermission` — optional one-to-one: a request *may* produce exactly one direct grant (only on approval; a rejected request produces none).

## 2. DFD Level 0 — Context Diagram

**External entities:** User/Browser, Cloudflare Turnstile (CAPTCHA verification service), ipapi.co/Nominatim (IP and reverse geolocation for login audit trail — best-effort, not security-critical).

**Process 0:** the SentinelIAM application as a single opaque box at this level.

**Data store:** the Postgres database as a single store at this level.

**Trust boundaries (3):**
1. Public Internet ↔ Application Server — the most important boundary: everything crossing it is untrusted input.
2. Application Server ↔ Database — a private-network boundary; only the application server holds DB credentials.
3. (implicit) Application Server ↔ External Services — outbound-only calls to Turnstile/geolocation, no inbound trust granted to them beyond their specific verdict/lookup response.

## 3. DFD Level 1 — Process Decomposition

Decomposes Process 0 into four processes, matching the actual route groups in `src/app/api/`:

| Process | Route group | Trust boundary crossed |
|---|---|---|
| 2.0 Authentication | `/api/auth/*` | Public Internet → Edge Middleware → App Server → DB |
| 3.0 Access Request Workflow | `/api/access-requests`, `/api/admin/access-requests/*` | Same, plus a resource-scoped authorization check inside the process |
| 4.0 Identity Administration | `/api/admin/users`, `/api/admin/roles`, `/api/admin/permissions`, `/api/admin/resources` | Same, gated additionally to Administrator-only at the edge |
| 5.0 Audit Logging | `/api/admin/audit-log`, plus write-side calls from every other process | Internal only on the write side; read side crosses back out to Auditor/Administrator |

**New boundary introduced at Level 1:** the Edge Middleware (`src/middleware.ts`) is drawn as its own trust zone between the public internet and the application processes. This is deliberate — it's a *coarse* gate (JWT validity + cached role/permission claims, up to 15 minutes stale) and every process behind it still re-verifies authority against live database state for its specific sensitive action (see `src/lib/authz.ts`). The diagram makes that two-layer defense visible rather than implying the edge check alone is sufficient.

## 4. Consistency with Use Case and ER Models

- Every **data store** in the DFD maps 1:1 to a group of **entities** in the ER diagram (D1 = `User`/`Passkey`/`PasswordResetToken`, D2 = `Role`/`Resource`/`Permission`/`RolePermission`/`UserPermission`, D3 = `AccessRequest`, D4 = `AuditLog`).
- Every **process** in the DFD corresponds to one or more **use cases** from Phase 3 (Process 3.0 "Access Request Workflow" = UC-04 Submit Access Request + UC-05 Approve/Reject Access Request).
- The **trust-boundary-crossing authorization check** drawn inside Process 3.0 and 4.0 is the same `assertCanApprove` / `assertCanAssignRole` logic documented in the UC-05 exception flow (Phase 3) and expanded on in the STRIDE table (Phase 7) — the three documents describe one real mechanism from three angles, not three different ones.
