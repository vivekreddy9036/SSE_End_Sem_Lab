# Phase 6 — User Interface Design

All four screens below are real, running pages (not mockups) — see the referenced file paths. Screenshots should be taken directly from `npm run dev` for the final submission.

## Screen 1 — Login (`src/app/(auth)/login/page.tsx`)

| Aspect | Detail |
|---|---|
| **User** | Any actor (Standard User, Approver, Administrator, Auditor) |
| **Goal** | Authenticate with email + password, then complete MFA |
| **Navigation** | Entry point for unauthenticated visitors (middleware redirects here); links out to Register and Forgot Password |
| **Inputs** | Email, password, Cloudflare Turnstile CAPTCHA |
| **Feedback** | Inline red error banner on failure; spinner + "Signing in..." on submit; CAPTCHA auto-resets after a failed attempt |
| **Error Handling** | Generic "Invalid credentials" for wrong password, nonexistent account, *and* deactivated account — no information disclosure about which case occurred |
| **Security Considerations** | Rate-limited server-side (5/min/IP) independent of the CAPTCHA; password never logged; HttpOnly cookies only, no token ever touches `localStorage`/JS-readable storage |

## Screen 2 — My Access Requests (`src/app/(app)/access-requests/page.tsx`)

| Aspect | Detail |
|---|---|
| **User** | Standard User (any authenticated actor can also use this to request *more* access) |
| **Goal** | Browse the permission catalog, submit a justified access request, track its status |
| **Navigation** | Reachable from the sidebar ("My Access Requests") and from the Dashboard's "Request access" link when the user has zero permissions |
| **Inputs** | Permission dropdown (resource + permission name), free-text justification (min 10 chars) |
| **Feedback** | Submitted request immediately appears in the table below with a `PENDING` badge; status badges update to `APPROVED`/`REJECTED` (color-coded) once reviewed, with the reviewer's note shown inline |
| **Error Handling** | Duplicate pending request for the same permission is rejected client-visibly ("You already have a pending request for this permission") rather than silently creating a second row |
| **Security Considerations** | The permission catalog endpoint (`/api/permissions`) is read-only metadata — browsing what exists is not sensitive, only being granted it is; submitting a request grants nothing by itself |

## Screen 3 — Admin: Users (`src/app/(app)/admin/users/page.tsx`)

| Aspect | Detail |
|---|---|
| **User** | Administrator |
| **Goal** | View every account, change a user's role, deactivate/reactivate accounts |
| **Navigation** | Admin-only sidebar entry; middleware redirects any non-Administrator away from `/admin/users` before the page even renders |
| **Inputs** | Per-row role `<Select>`, per-row Deactivate/Reactivate button |
| **Feedback** | Status badges (`Active` / `Locked` / `Deactivated`) computed live from `isActive` and `lockedUntil`; 2FA method badges (`TOTP`, `Passkey`, or "Not set up") |
| **Error Handling** | The role selector and deactivate button are both `disabled` on the admin's own row — the UI prevents the self-escalation/self-lockout mistake before the request is even sent, backed by the same guard server-side |
| **Security Considerations** | Every role change and status change is a privileged, audited mutation (`ROLE_ASSIGNED`/`ROLE_ASSIGNMENT_BLOCKED`, `ACCOUNT_DEACTIVATED`/`ACCOUNT_REACTIVATED`) |

## Screen 4 — Approval Queue (`src/app/(app)/admin/access-requests/page.tsx`)

*(the IAM analog of a "results" screen — it shows the recorded outcome of a decision process)*

| Aspect | Detail |
|---|---|
| **User** | Approver (any user holding an `APPROVE`/`MANAGE` permission on some resource), or Administrator |
| **Goal** | Review pending access requests scoped to resources the approver actually owns, and record a decision |
| **Navigation** | Sidebar entry only visible to users who hold at least one approval permission (computed client-side from the session's permission list, re-checked server-side) |
| **Inputs** | Approve / Reject buttons per row; a "Show all" toggle to review historical decisions |
| **Feedback** | Sensitivity badge on each resource (`LOW`/`MEDIUM`/`HIGH`/`CRITICAL`) so an approver sees the stakes at a glance; decided rows show the reviewer's name in place of action buttons |
| **Error Handling** | If authority was revoked between page load and the click (race condition), the server rejects with 403 and the row stays actionable for someone who still has authority — the UI doesn't need special-case handling because the API contract already degrades safely |
| **Security Considerations** | The list itself is pre-scoped server-side to what this approver can act on — there's no "all requests" view that happens to also disable buttons for the ones you can't approve; you simply never see them |

## Golden Rules Applied (Shneiderman)

| Rule | Where it shows up |
|---|---|
| **Strive for consistency** | Every admin list page shares the same `Card` + `Table` + action-column layout; every form uses the same `Label`/`Input`/`Button` components from one shared UI kit |
| **Offer informative feedback** | Status badges, inline error banners, and audit-worthy actions all surface an immediate visual result — nothing is a silent no-op |
| **Design for closure** | Submitting an access request, a role change, or an approval decision all end in a visible state change (new table row, updated badge) — the user always knows the action completed |
| **Prevent errors** | Self-role-change and self-deactivation controls are disabled in the UI, not just rejected after submission; duplicate pending requests are blocked before creating a confusing second row |
| **Permit easy reversal** | Account deactivation is reversible (Reactivate button); a rejected access request can simply be resubmitted |
| **Support internal locus of control** | The approver chooses when to review and can filter to pending-only or see full history — the system never auto-decides on their behalf |
| **Reduce short-term memory load** | The Approval Queue shows the requester, resource, permission, *and* justification together in one row — the approver never has to look something up in another screen to make the decision |
