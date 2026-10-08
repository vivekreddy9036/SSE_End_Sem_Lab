# Phase 7 — Threat Modeling and Security Analysis

Built against the actual DFD (Phase 4) and architecture (Phase 5) — every element referenced below exists in those diagrams and in the running code.

## 1. Asset Inventory and CIA Classification

| # | Asset | Confidentiality | Integrity | Availability | Why it matters |
|---|---|---|---|---|---|
| 1 | Password hashes (`User.passwordHash`) | High | High | — | Compromise enables account takeover across every system this password is reused on |
| 2 | TOTP secrets (`User.totpSecret`) | High | High | — | Compromise lets an attacker generate valid 2FA codes, defeating the second factor entirely |
| 3 | JWT signing secret (`JWT_SECRET` env var) | Critical | Critical | — | Compromise lets an attacker forge *any* session for *any* user with *any* permissions — the single highest-value secret in the system |
| 4 | Session tokens (access + refresh JWT) | High | High | — | A stolen token is a stolen session for up to 15 minutes (access) or 7 days (refresh) |
| 5 | Password-reset tokens | High | High | Medium | A guessable or leaked token is a full account-takeover path that bypasses the password entirely |
| 6 | Role → Permission → Resource mapping (`RolePermission`) | Medium | Critical | Medium | This table *is* the authorization policy — its integrity determines who can do what, system-wide |
| 7 | Direct permission grants (`UserPermission`) | Medium | Critical | Medium | Same as above but per-user; a forged row here is an undetected privilege grant |
| 8 | Audit log (`AuditLog`) | Medium | Critical | High | Its integrity is what makes every other control verifiable after the fact; if it can be altered or deleted, every other security claim in this document becomes unfalsifiable |
| 9 | Access-request justifications | Low–Medium | Low | — | May contain business-sensitive text (e.g. "need payroll access to investigate a compensation dispute") |
| 10 | Database credentials (`DATABASE_URL`) | Critical | — | Critical | Direct compromise of every asset above at once |

## 2. STRIDE Threat Table

| DFD Element | Threat | STRIDE | Impact | Mitigation |
|---|---|---|---|---|
| Login data flow (User → Process 2.0) | Credential-stuffing bot submits stolen email/password pairs | **S**poofing | Account takeover | 5-attempt account lockout (15 min) + separate IP-based rate limit (5/60s) + mandatory CAPTCHA |
| Login data flow | Attacker intercepts/alters the request in transit | **T**ampering | Credential theft or request manipulation | TLS required in production (`Secure` cookie flag set when `NODE_ENV=production`) |
| Access/refresh token (cookie) | Attacker forges a JWT with arbitrary claims | **T**ampering | Full account impersonation, arbitrary privilege claim | HMAC-SHA256 signature (`jose`), verified server-side on every request; secret never exposed to the client |
| Password-reset token flow | Attacker guesses or brute-forces a reset token | **S**poofing | Account takeover without the password | 256-bit `crypto.randomBytes` token, sha256-hashed at rest, single-use, 30-minute TTL |
| Role-assignment process (4.0) | Authenticated-but-unauthorized user calls the role-assignment endpoint directly | **E**levation of Privilege | Attacker grants themselves or a confederate elevated access | `requireRoleAuth(["ADMIN"])` at the route + `assertCanAssignRole` re-verified live (also blocks self-role-change and non-Admin-granting-Admin) |
| Access-request approval process (3.0) | An Approver scoped to one resource approves a request for a *different* resource they don't own | **E**levation of Privilege | Unauthorized access grant outside the approver's actual authority | `assertCanApprove` checks the specific permission's resource against the approver's *current* effective permissions, not their cached role |
| Audit log data store | Attacker (or malicious insider) deletes or edits log rows to cover tracks | **R**epudiation + **T**ampering | Loss of non-repudiation for every other security control | No API route exposes update/delete on `AuditLog`; writes are append-only via `audit.ts`, reads require `AUDIT_LOG_READ` |
| TOTP secret data store | Database breach exposes `totpSecret` column | **I**nformation Disclosure | Attacker can generate valid 2FA codes for every user | AES-256-GCM encryption at rest (`crypto.ts`); breaching the DB alone is insufficient without `TOTP_ENCRYPTION_KEY` |
| Login process | Volumetric request flood against `/api/auth/login` | **D**enial of Service | Legitimate users unable to authenticate; DB connection pool exhaustion | Sliding-window IP rate limiter (`rate-limit.ts`) rejects before the password-check/DB-query path runs |
| Registration process | Scripted mass account creation | **D**enial of Service / Spoofing | Resource exhaustion, fake-account pollution | Same rate limiter + mandatory CAPTCHA on `/api/auth/register` |
| User lookup by email (login, forgot-password) | Differentiated responses reveal whether an email is registered | **I**nformation Disclosure | Account enumeration enabling targeted credential-stuffing | Identical generic response for "wrong password," "no such account," and "deactivated account" (see UC-02 Exception Flows) |
| Permission catalog endpoint (`/api/permissions`) | Any authenticated user enumerates every resource/permission in the system | **I**nformation Disclosure | Low — reveals the *shape* of the access-control model, not any actual grant | Accepted risk: deliberately open to any authenticated user, since knowing what exists is required to request it; what you *hold* remains protected |

## 3. Information Flow Analysis (≥3 Sensitive Assets)

### 3.1 Password
```
[Browser form input] --(TLS)--> [/api/auth/login or /register]
  --> bcrypt.compare() / bcrypt.hash()  (in-memory only, cost factor 12)
  --> User.passwordHash column (bcrypt digest, one-way)
```
**Flow boundary check:** the plaintext password exists in process memory only for the duration of the bcrypt call. It is never logged (`console.error` calls throughout the auth routes log error objects, not request bodies), never written to any column, and never included in any API response, audit-log `detail` string, or JWT payload. The *only* persisted artifact is the one-way hash.

### 3.2 TOTP Secret
```
[generateTotpSecret()] --> encryptTotpSecret() --(AES-256-GCM)--> User.totpSecret column
                                                                        |
[2FA verify request] <-- decryptTotpSecret() <--------------------------
  --> verifyTotpToken() (in-memory comparison only)
```
**Flow boundary check:** the raw base32 secret is shown to the user exactly once, at setup time, in the QR code / manual-entry response (`POST /api/auth/2fa/setup`) — this is an intentional, unavoidable boundary crossing (the user's authenticator app needs it) and is the only point the plaintext secret ever leaves the server process after initial generation. From then on, every use decrypts it in-memory for a single comparison and discards it; it is never re-displayed.

### 3.3 Audit Log Entries
```
[Any security event in auth.ts / authz.ts / totp.ts / passkey.ts]
  --> auditLog(userId, action, detail, ip)  (fire-and-forget via Next's after())
  --> AuditLog table (INSERT only — no UPDATE/DELETE route exists)
       |
       --> GET /api/admin/audit-log  (requires AUDIT_LOG_READ permission)
       --> Admin/Auditor UI table
```
**Flow boundary check:** the write path has no caller-supplied data beyond `detail` (a short descriptive string built server-side, e.g. `"${permission.code} -> role ${role.code}"` — never raw request bodies, so it can't become a log-injection or stored-XSS vector). The read path is gated identically at the edge (`middleware.ts`) and inside the route handler itself (`session.permissions.includes("AUDIT_LOG_READ")`), closing the gap where a revoked permission on a stale JWT could otherwise still read the log for up to 15 minutes.

## 4. Vulnerability Analysis (≥6)

| # | Vulnerability | Affected Element | Related Threat (§2) | Impact | Mitigation |
|---|---|---|---|---|---|
| 1 | Missing live re-authorization on role assignment (the "before" state documented in Phase 1/12) | Role-assignment process | Elevation of Privilege | A user who once held `ROLE_MGMT_MANAGE` — or any flawed check relying only on a cached JWT claim — could grant Administrator to any account including their own | `assertCanAssignRole` re-checks against current DB state, blocks self-role-change unconditionally, and requires the *acting* user to currently hold ADMIN before granting ADMIN to someone else |
| 2 | Predictable or weakly-random password-reset tokens (CWE-330) | Password-reset flow | Spoofing | Attacker could brute-force or predict a valid reset token and take over any account without its password | `randomBytes(32)` (256 bits of entropy), hashed with sha256 before storage, 30-minute expiry, single-use enforced by `usedAt` |
| 3 | Account enumeration via differentiated auth error messages (CWE-203) | Login / registration / forgot-password | Information Disclosure | Attacker builds a list of valid registered emails to target with credential stuffing or phishing | Uniform error text across "no such account," "wrong password," and "deactivated" cases |
| 4 | Missing or insufficient rate limiting on authentication endpoints (CWE-307) | `/api/auth/login`, `/api/auth/register` | Denial of Service, Spoofing | Unlimited automated login/registration attempts | IP-scoped sliding-window limiter (5 req/60s) independent of and layered with the account-level lockout |
| 5 | Secrets stored in plaintext at rest (CWE-312) | TOTP secret column | Information Disclosure | A database-only breach (e.g. leaked backup, misconfigured access) would fully compromise every user's 2FA | AES-256-GCM encryption keyed by `TOTP_ENCRYPTION_KEY`, which is never stored in the same place as the database |
| 6 | Incorrect authorization scope on approval actions (CWE-863) | Access-request approval process | Elevation of Privilege | An approver with narrow, legitimate authority (e.g. DevOps-only) could approve requests for unrelated, more sensitive resources (e.g. Payroll) if the check only verified "is an approver" rather than "is an approver *for this resource*" | `assertCanApprove` joins the specific permission's `resourceId` against the approver's own effective `APPROVE`/`MANAGE` permissions before allowing the decision |
| 7 | SQL injection via string-concatenated queries (CWE-89) | Any database read/write | Tampering, Information Disclosure | Attacker-controlled input reaching a raw SQL string could read or modify arbitrary data | Eliminated by construction: all application queries go through Prisma Client's parameterized query builder; no raw SQL string concatenation exists in any route or service file |
| 8 | Hardcoded secrets committed to source control (CWE-798) | `.env` (JWT secret, DB credentials, TOTP key) | Information Disclosure (of the master secrets) | Compromise of every other asset in §1 simultaneously | `.env` is git-ignored (verified before every commit in this project — see `/docs/11-secure-build`); `.env.example` documents required variables with placeholder values only |
