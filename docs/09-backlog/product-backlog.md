# Phase 9 — Product Backlog and Jira/Scrum

## 1. Epics

| Epic ID | Epic | Description |
|---|---|---|
| EPIC-1 | Authentication & Account Lifecycle | Registration, login, MFA, lockout, password reset, account activation state |
| EPIC-2 | Role & Permission Administration | Admin-defined `User → Role → Permission → Resource` model, role assignment, account deactivation |
| EPIC-3 | Access Request & Approval Workflow | Self-service requests, scoped approval queue, approval decisions and their effect |
| EPIC-4 | Audit & Compliance | Read-only visibility into every security-relevant event |

## 2. Product Backlog (13 User Stories)

| Story ID | Epic | User Story | Priority | Acceptance Criteria |
|---|---|---|---|---|
| US-01 | EPIC-1 | As a **new user**, I want to register an account with my email and password, so that I can access the platform. | Must | • Rejects duplicate emails with a generic message (no account-enumeration leak) • Password hashed with bcrypt before storage • Requires CAPTCHA • New account starts with the baseline `USER` role and zero permissions |
| US-02 | EPIC-1 | As a **registered user**, I want to be required to set up two-factor authentication on my first login, so that my account can't be protected by a password alone. | Must | • Login cannot complete without TOTP or Passkey enrolled • QR code + manual-entry secret shown once • 8 single-use recovery codes issued on successful enrollment |
| US-03 | EPIC-1 | As a **user**, I want my account to lock for 15 minutes after 5 consecutive failed login attempts, so that attackers can't brute-force my password. | Must | • Failed-attempt counter increments per failure, resets on success • Lockout is time-boxed (15 min), not permanent • Locked state returns HTTP 423, distinct from invalid-credentials 401 |
| US-04 | EPIC-1 | As a **user who forgot my password**, I want to request a reset link and set a new password, so that I can regain access without contacting an admin. | Must | • Reset token is single-use and expires in 30 minutes • Same response text whether or not the email exists • Successful reset also clears any existing login lockout |
| US-05 | EPIC-2 | As an **Administrator**, I want to define Roles, Resources, and Permissions, so that I can model the organization's access-control policy. | Must | • Resource requires a sensitivity level (`LOW`/`MEDIUM`/`HIGH`/`CRITICAL`) • Permission is always scoped to exactly one Resource • Only `ADMIN` role can reach these endpoints |
| US-06 | EPIC-2 | As an **Administrator**, I want to assign or change a user's Role, so that their access reflects their current job function. | Must | • Role change takes effect in the user's permissions on next token refresh (≤15 min) or next login • Change is recorded in the audit log |
| US-07 | EPIC-2 | As the **system**, I want to block a role assignment if the acting admin tries to change their own role or grant Admin without already being an Admin, so that the role-assignment feature can never be used to self-escalate. | Must | • Self-role-change always rejected (403), even for an existing Administrator • Granting `ADMIN` requires the *acting* user to currently hold `ADMIN`, re-checked against live DB state • Both block types are independently audited |
| US-08 | EPIC-3 | As a **Standard User**, I want to browse available permissions and submit an access request with a justification, so that I can get access to resources I need for my job. | Must | • Duplicate pending requests for the same permission are rejected • Justification requires at least 10 characters • Request appears immediately in "My Access Requests" with `PENDING` status |
| US-09 | EPIC-3 | As an **Approver**, I want to see only the access requests for resources I have approval authority over, so that I'm not shown decisions outside my scope. | Must | • List is pre-filtered server-side, not just hidden in the UI • `ADMIN` sees all requests regardless of resource • An Approver with zero approval permissions sees an empty queue |
| US-10 | EPIC-3 | As an **Approver**, I want to approve or reject an access request with an optional note, so that the requester understands the decision and an approval takes effect immediately. | Must | • Approval creates/updates a `UserPermission` grant in the same transaction as the status update • Approval authority is re-verified live at decision time, not from a cached session • Decision is recorded with reviewer identity and timestamp |
| US-11 | EPIC-3 | As the **system**, I want to prevent a user from approving their own access request, so that holding an unrelated approval permission on the same resource can never be used for self-approval. | Must | • Self-review is rejected unconditionally (403), checked before the resource-ownership check • Attempt is recorded in the audit log, not just silently rejected |
| US-12 | EPIC-2 | As an **Administrator**, I want to deactivate or reactivate a user account, so that I can immediately revoke access for someone who has left or is under review. | Must | • Deactivated account is rejected at login with the same generic message as invalid credentials • Admin cannot deactivate their own account • Reactivation restores login ability without resetting role/permissions |
| US-13 | EPIC-4 | As an **Auditor**, I want to view a read-only, paginated log of every security-relevant event, so that I can verify compliance and investigate incidents without being able to alter history. | Must | • No update/delete endpoint exists for audit entries at any permission level • Access requires `AUDIT_LOG_READ`, held by `ADMIN` and `AUDITOR` roles by default • Each entry shows actor, action, detail, IP, and timestamp |

## 3. Sprint Plan

### Sprint 1 — "Secure the front door"
**Sprint Goal:** Ship a complete, safe authentication foundation — registration, mandatory MFA, lockout, and password reset — so that no user can reach the system without passing through hardened identity verification.

| Story ID | Points |
|---|---|
| US-01 | 5 |
| US-02 | 8 |
| US-03 | 3 |
| US-04 | 5 |
| US-12 | 3 |
| **Sprint 1 total** | **24** |

### Sprint 2 — "Govern access, prove it happened"
**Sprint Goal:** Ship the full access-governance loop — admin-defined roles/permissions, the request-and-approval workflow with its privilege-escalation guards, and auditor-visible history — so that every access decision in the system is deliberate, scoped, and provable after the fact.

| Story ID | Points |
|---|---|
| US-05 | 5 |
| US-06 | 3 |
| US-07 | 5 |
| US-08 | 5 |
| US-09 | 5 |
| US-10 | 8 |
| US-11 | 3 |
| US-13 | 5 |
| **Sprint 2 total** | **39** |

See `/docs/10-sprint` for the board, daily scrum log, burndown charts, velocity, and retrospective.

## 4. Jira Setup

A CSV ready for Jira's bulk-import (**Jira Settings → System → External System Import → CSV**) is at `jira-import.csv` in this folder — it includes Summary, Issue Type, Epic Link, Priority, and Story Points columns matching Jira's default field names.

**If creating manually instead:**
1. Create a new **Scrum** project (Jira → Create Project → Scrum).
2. Create the 4 epics from §1 first (Issue Type = Epic).
3. Create the 13 stories from §2 (Issue Type = Story), linking each to its epic, setting Priority and Story Points (use the point values in §3).
4. Create two sprints under Backlog, named "Sprint 1 — Secure the front door" and "Sprint 2 — Govern access, prove it happened," and drag each story into the sprint listed in §3.
