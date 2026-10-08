# Phase 8 — Attack Tree and Security Architecture Refinement

Diagram source: `attack-tree.mmd` (paste into https://mermaid.live). Green = fully blocked by an existing control; yellow = partially mitigated, residual risk remains; red = open (none currently, see below).

## 1. Root Goal

**Attacker goal:** Obtain `PAYROLL_WRITE` — write access to the Payroll System, a `CRITICAL`-sensitivity resource — without going through a legitimate approval. Chosen because it's the highest-value target in the seeded data and exercises every layer of the authorization model: authentication, role assignment, and approval-authority scoping all have to hold for this goal to be denied.

## 2. Attack Paths (AND/OR)

### Path A — Compromise an account that already holds the access (OR)
- **A1. Credential stuffing / brute force** (AND: valid email + guessable password, within the lockout threshold) — **Blocked**: 5-attempt account lockout + independent IP rate limit.
- **A2. Real-time phishing relay** of password + TOTP code (AND: convincing lure, victim completes both steps inside the ~30s TOTP validity window) — **Partially mitigated**: MFA defeats simple credential phishing, but a *real-time* relay attack (attacker proxies the live login flow) is a known class of TOTP weakness that this design does not fully close. Passkeys (WebAuthn) *do* close it — the credential is origin-bound and can't be relayed — so the residual risk is specifically for users who rely on TOTP instead of a Passkey.
- **A3. Steal the session cookie via XSS** (AND: an XSS vector exists + the cookie is JS-readable) — **Blocked**: cookies are `HttpOnly`; even a successful XSS injection cannot read the token.
- **A4. Steal the refresh token from the browser/device** (AND: physical or malware access to the victim's machine) — **Partially mitigated**: `HttpOnly` stops script-based theft, but a device-level compromise (malware with filesystem/cookie-store access) is outside any browser-side control; the 7-day refresh token window is the bounded blast radius.

### Path B — Exploit a flawed authorization check (OR)
- **B1. Call the role-assignment endpoint directly**, bypassing the UI's disabled self-role-change button (AND: endpoint exists + no server-side re-verification) — **Blocked**: `assertCanAssignRole` is enforced in the route handler itself, independent of the UI; it was specifically designed assuming the UI guard would be bypassed.
- **B2. Approve one's own access request** using an unrelated `APPROVE` permission already held on the same resource (AND: no `requesterId !== reviewerId` check) — **Blocked** — *this was an actual gap found while building this attack tree* (see §4). The review endpoint now rejects self-review unconditionally, before the resource-ownership check even runs.
- **B3. Forge a JWT's permissions claim** (AND: obtain `JWT_SECRET`) — **Partially mitigated**: the signature makes forgery without the secret infeasible; the residual risk is entirely about *protecting the secret itself* (see Path D).

### Path C — Abuse the legitimate workflow (OR)
- **C1. Submit a request, then social-engineer a legitimate approver** into approving it under false pretenses — **Partially mitigated**: the justification field and the approver's visibility into the requester's identity make this harder than an anonymous request, but social engineering a human decision-maker is not something software alone can fully close; this is a residual risk accepted and left to approver training (see Phase 15 operational controls).
- **C2. Race condition** — submit/retry hoping a request slips through approval in the narrow window before a role/permission change should have revoked the approver's authority — **Blocked**: `assertCanApprove` re-checks live at the moment of decision, and the whole decision (status update + permission grant) is one database transaction — there's no window where a stale authorization check and the actual grant can observe different states.

### Path D — Compromise infrastructure directly (OR)
- **D1. Exfiltrate `.env`/`DATABASE_URL`** from the server or a CI secrets store — **Partially mitigated**: out of the application's own control surface; addressed operationally in Phase 11 (secret management) and Phase 15 (hardening checklist), not by application code.
- **D2. Write directly to `user_permissions`** via leaked DB credentials, bypassing the application entirely — **Partially mitigated**: same as D1 — this is why DB credential protection and least-privilege DB roles matter as much as the application-layer controls documented elsewhere in this project.

## 3. Preventive vs. Detective Controls

| Control | Type | Addresses |
|---|---|---|
| Account lockout + IP rate limiting | Preventive | A1 |
| HttpOnly, SameSite cookies | Preventive | A3 |
| `assertCanAssignRole` (self-change block, admin-grants-admin-only) | Preventive | B1 |
| `assertCanApprove` + self-approval block + transactional decision | Preventive | B2, C2 |
| WebAuthn/Passkey origin-binding | Preventive | A2 (for users who enroll a Passkey) |
| Audit log (`LOGIN_FAILED`, `ROLE_ASSIGNMENT_BLOCKED`, `ACCESS_APPROVAL_BLOCKED`, etc.) | **Detective** | All paths — every blocked attempt above is independently recorded, so a pattern of B1/B2/C2 attempts is visible to an Auditor even though each individual attempt already fails |

## 4. Security Architecture Refinement

Building this attack tree directly produced one real fix, demonstrating the intended feedback loop from threat modeling back into the implementation:

**Finding (B2):** `src/app/api/admin/access-requests/[id]/review/route.ts` checked that the approver held `APPROVE`/`MANAGE` on the *resource*, but never checked that the approver wasn't also the *requester*. A user holding, say, `PAYROLL_APPROVE` for legitimate reasons could request `PAYROLL_WRITE` for themselves and then approve their own request — the resource-ownership check alone doesn't express "approval must come from someone other than the beneficiary."

**Refinement applied:** added an unconditional self-review guard immediately after loading the request, before the resource-ownership check:
```ts
if (accessRequest.requesterId === session.userId) {
  auditLog(session.userId, "ACCESS_APPROVAL_BLOCKED", `Request #${requestId} (self-approval attempt)`, ip);
  return apiError("Forbidden — you cannot review your own access request", 403);
}
```
This closes B2 completely and adds it to the audited event set, so even an *attempt* is now visible to an Auditor — turning a silent gap into both a closed path and a detective signal.
