# Phase 2 — Requirements Engineering (SRS)

## 1. Stakeholders / Actors

| Actor | Description | Justification |
|---|---|---|
| **Administrator** | Manages users, roles, permissions, and resources — the `User → Role → Permission → Resource` mapping itself. Holds no baseline business-data access. | Explicitly required by the problem statement. |
| **Approver** | Holds `APPROVE`/`MANAGE` authority over one or more specific resources (e.g. HR Portal, Payroll). Reviews access requests scoped to those resources only. | Explicitly required ("Access approval"). Modeled as a distinct actor rather than folding approval into Administrator, to enforce separation of duties — see `/docs/07-threat-model`. |
| **Standard User** | Registers, authenticates, and requests access to resources. Holds no permissions by default. | Explicitly required ("User registration", "Access requests"). |
| **Auditor** *(justified additional actor)* | Read-only access to the system-wide audit log. No ability to modify users, roles, or permissions. | Not named in the problem statement, but required to satisfy its own security goal ("audit requirements") without granting audit visibility to anyone who can also *cause* the events being audited — an Administrator reviewing their own audit trail is a weaker control than an independent read-only Auditor role. |

## 2. Functional Requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-01 | A user shall be able to self-register with email, password, and full name. | Must |
| FR-02 | A registered user shall be able to log in with email + password, followed by mandatory second-factor verification (TOTP or Passkey). | Must |
| FR-03 | A user who forgets their password shall be able to request a reset link and set a new password via a single-use, time-limited token. | Must |
| FR-04 | An Administrator shall be able to create Roles, Resources, and Permissions, and define which Permissions a Role grants (`Role → Permission → Resource`). | Must |
| FR-05 | An Administrator shall be able to assign or change a user's Role. | Must |
| FR-06 | A user shall be able to submit an Access Request for a specific Permission, with a justification. | Must |
| FR-07 | An Approver holding authority over a resource shall be able to approve or reject Access Requests for permissions on that resource. | Must |
| FR-08 | Approving an Access Request shall grant the requester that permission directly, independent of their Role. | Must |
| FR-09 | An Administrator shall be able to deactivate or reactivate a user account. | Must |
| FR-10 | A deactivated account shall be rejected at login. | Must |
| FR-11 | Every security-relevant action shall be recorded in an audit log, visible to Administrators and Auditors. | Must |
| FR-12 | A user shall be able to enroll a Passkey (WebAuthn) as an alternative second factor to TOTP. | Should |
| FR-13 | A granted permission may optionally expire after a set duration. | Could |

## 3. Non-Functional Requirements

| ID | Requirement | Priority |
|---|---|---|
| NFR-01 | Access tokens shall expire within 15 minutes; sessions shall be renewable via a separate, longer-lived refresh token. | Must |
| NFR-02 | The system shall respond to standard CRUD operations within 500ms under normal load (single-instance dev/test deployment). | Should |
| NFR-03 | The UI shall be usable on both desktop and tablet viewport widths. | Should |
| NFR-04 | The system shall be deployable via a single Docker container plus a managed Postgres instance. | Must |
| NFR-05 | All API error responses shall avoid leaking whether a specific email/account exists (account-enumeration resistance). | Must |

## 4. Security Requirements

| ID | Requirement | CIA | Priority |
|---|---|---|---|
| SR-01 | Passwords shall be hashed with bcrypt (cost factor ≥ 10) and never stored or logged in plaintext. | Confidentiality | Must |
| SR-02 | TOTP secrets shall be encrypted at rest (AES-256-GCM). | Confidentiality | Must |
| SR-03 | A login account shall lock for 15 minutes after 5 consecutive failed password attempts. | Availability* / Integrity | Must |
| SR-04 | All authentication endpoints shall be rate-limited per IP address, independent of account-level lockout. | Availability | Must |
| SR-05 | Role assignment shall require the acting user to hold `ROLE_MGMT_MANAGE`, and no user may change their own role. | Integrity | Must |
| SR-06 | Granting the Administrator role to another user shall require the acting user to already hold the Administrator role, re-verified against current DB state (not a cached token claim). | Integrity | Must |
| SR-07 | Approving an Access Request shall require the approver to hold `APPROVE`/`MANAGE` on that specific permission's resource, not merely "being an Administrator." | Integrity | Must |
| SR-08 | Password-reset tokens shall be single-use, expire within 30 minutes, and be stored only as a salted hash. | Confidentiality / Integrity | Must |
| SR-09 | Every login (success/failure/lockout), role change, permission grant/revoke, access-request decision, and account activation/deactivation shall be written to an immutable audit log with timestamp, actor, and IP. | Integrity (non-repudiation) | Must |
| SR-10 | The audit log shall be readable only by users holding `AUDIT_LOG_READ`. | Confidentiality | Must |
| SR-11 | All authentication-adjacent forms (login, registration, password-reset request) shall require a CAPTCHA challenge to deter automated credential-stuffing. | Availability / Integrity | Should |

\* *Availability here refers to protecting legitimate availability of the broader system by denying an attacker's automated attempts — the tradeoff against the account owner's own short-term availability is the standard lockout cost, and is time-boxed to 15 minutes for exactly that reason.*

## 5. Prioritization Summary

Using MoSCoW: **13 Must**, **3 Should**, **1 Could**. Authentication, authorization (role assignment + approval guards), and audit logging are uniformly "Must" — they are the core of what an IAM platform exists to do, and partial delivery of any of them would make the system untrustworthy rather than merely incomplete.
