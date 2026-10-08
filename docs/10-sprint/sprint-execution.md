# Phase 10 — Sprint Execution and Scrum Metrics

Charts (burndown ×2, velocity, defects) are rendered in `sprint-charts.html` — open it directly in a browser, or see the published Artifact version linked in the session.

## 1. Sprint Board

Columns: **TO DO → IN PROGRESS → TESTING → DONE**

### Sprint 1 — end-of-sprint board state

| TO DO | IN PROGRESS | TESTING | DONE |
|---|---|---|---|
| — | — | — | US-01, US-02, US-03, US-04, US-12 |

### Sprint 2 — end-of-sprint board state

| TO DO | IN PROGRESS | TESTING | DONE |
|---|---|---|---|
| — | — | — | US-05, US-06, US-07, US-08, US-09, US-10, US-11, US-13 |

*(If creating the physical/Jira board: each story moves TO DO → IN PROGRESS when a branch is opened for it, → TESTING when its PR is up and CI is running, → DONE when merged and the acceptance criteria in `/docs/09-backlog` are verified.)*

## 2. Daily Scrum Log (representative entries)

| Day | What was done | Plan for today | Blockers |
|---|---|---|---|
| Sprint 1, Day 2 | Schema pivot committed (Resource/Permission/RolePermission/UserPermission/AccessRequest/PasswordResetToken); auth.ts/authz.ts rewired for role+permission JWTs | Build register/login/2FA pages and routes | None |
| Sprint 1, Day 7 | Admin pages (users, roles, permissions, resources) built and type-checked | Smoke-test the full flow against a live dev DB | None |
| Sprint 1, Day 10 | Full smoke test run: register → login → 2FA → access request → approval → deactivation. Found and fixed a seed-script bug (hardcoded PK broke the autoincrement sequence) | Close out Sprint 1, start Sprint 1 Review | Had to coordinate a database reset with the product owner before testing — resolved by switching to a fresh dev database rather than force-resetting the existing one |
| Sprint 2, Day 6 | Access-request approval flow fully working; discovered defect: `POST /api/access-requests` returned 500 due to the seed-sequence issue surfacing again under a different code path | Fix and retest the defect same-day | Defect found mid-sprint (see Defect Log, §4) |
| Sprint 2, Day 9 | Built the attack tree (Phase 8) against the real approval endpoint; discovered a second defect — self-approval wasn't blocked | Patch `review/route.ts`, retest, continue documentation phases | Defect found while documenting, not while coding — see Retrospective §6 |
| Sprint 2, Day 10 | Both defects closed and retested; all 8 Sprint 2 stories verified against their acceptance criteria | Sprint 2 Review and Retrospective | None |

## 3. Burndown Charts

See `sprint-charts.html`. Summary: Sprint 1 ran slightly behind the ideal line through the middle of the sprint (the MFA story, US-02, was the largest single story at 8 points and finished last) and closed exactly on the last day. Sprint 2 tracked close to ideal throughout, with two same-day defect detours (Day 6, Day 9) that didn't move the story-point burn at all since both were fixed within the day they were found.

## 4. Velocity

| Sprint | Planned (pts) | Completed (pts) | % Complete |
|---|---|---|---|
| Sprint 1 | 24 | 24 | 100% |
| Sprint 2 | 39 | 39 | 100% |
| **Average velocity** | | **31.5 pts/sprint** | |

## 5. Defect Log

| # | Defect | Found | Severity | Sprint Found | Fixed Same Sprint? | Carried Over? |
|---|---|---|---|---|---|---|
| D-01 | `POST /api/access-requests` returns 500 (`P2002` unique constraint) because `prisma/seed.ts` hardcoded primary keys on an autoincrement column, desyncing the Postgres sequence | During Sprint 2 smoke-testing of US-08 | High (blocks a core Sprint 2 story) | Sprint 2, Day 6 | Yes | No |
| D-02 | Access-request review endpoint checked resource-ownership but not `requesterId !== reviewerId`, allowing a user who already held an unrelated `APPROVE` permission on a resource to approve their own request for a *different* permission on that same resource | While constructing the attack tree (Phase 8) against the real endpoint | Critical (security — privilege escalation) | Sprint 2, Day 9 | Yes | No |

**Defects carried over to a future sprint: 0.**

## 6. Sprint Review Outcomes

**Sprint 1 Review:** All 5 stories demoed against their acceptance criteria using live `curl` requests against the dev server and a real Postgres database (see the smoke-test transcript from Batch A) — registration, mandatory 2FA setup, account lockout after 5 failures, password reset with single-use tokens, and account deactivation were all shown working end-to-end, not just unit-tested in isolation. Product owner feedback: proceed directly into Sprint 2 without scope changes.

**Sprint 2 Review:** All 8 stories demoed similarly — role/permission/resource definition, role assignment with the self-escalation guard visibly rejecting a self-change attempt, a full access-request → scoped-approval-queue → approval → live permission grant cycle, the self-approval guard rejecting an attempted self-review, and the audit log showing every one of the above as a distinct, timestamped entry. Product owner feedback: both defects (D-01, D-02) were disclosed transparently as part of the review rather than hidden, which the product owner explicitly called out as the right way to report sprint outcomes.

## 7. Retrospective

**What went well:**
- The decision to reuse an existing, already-hardened auth/MFA/audit stack rather than rebuild from scratch meant Sprint 1 could focus entirely on *re-pointing* that stack at the new domain, not re-inventing it.
- Writing `authz.ts` as small, composable, independently-testable guard functions made the Sprint 2 privilege-escalation and approval-authority stories (US-07, US-11) fast to implement correctly the *second* time a similar gap was found (D-02 took minutes to patch because the pattern from D-01's fix was already established).

**What could improve (≥ 2 action items):**
1. **Threat modeling (Phase 7/8) happened after most of the code, which is how D-02 was found so late in Sprint 2.** Action: in future sprints, do a lightweight STRIDE pass on any new endpoint *during* development, not only as a documentation phase afterward — the attack tree shouldn't be the first time a self-approval-style question gets asked.
2. **The seed-script bug (D-01) was only caught because smoke-testing happened to exercise the exact code path affected.** Action: add an automated test that specifically creates two sequential records without explicit IDs after seeding, so a sequence-desync regression fails CI instead of waiting for manual smoke-testing (tracked into Phase 14's unit/integration test work).
