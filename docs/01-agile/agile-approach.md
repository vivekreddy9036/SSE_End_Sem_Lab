# Phase 1 — Agile Process and Development Approach

## 1. Selected Approach: Scrum with XP Practices

**Scrum** is the backbone (sprints, backlog, daily scrum, review, retrospective — see `/docs/09-backlog` and `/docs/10-sprint`), augmented with three **Extreme Programming (XP)** practices that matter specifically because this is a security-critical system:

| XP Practice | Why it's needed here |
|---|---|
| **Test-First / Continuous Testing** | Authorization logic (`src/lib/authz.ts`) is the system's core risk surface. Unit + integration tests on every guard (`assertCanAssignRole`, `assertCanApprove`) catch privilege-escalation regressions before they reach a sprint review, not after. |
| **Pair/Peer Code Review** | Every change to `src/lib/auth.ts`, `authz.ts`, or any `/api/admin/*` route requires a second reviewer before merge (see `/docs/11-secure-build`) — security-relevant code is exactly where a second set of eyes earns its cost. |
| **Continuous Integration** | Schema changes, authz changes, and route changes are coupled tightly enough (see the Batch A work: schema → auth.ts → authz.ts → routes, all in one coherent pass) that a CI pipeline running type-check + lint + tests on every push is the only way to keep that coupling from silently breaking. |

### Justification
A pure waterfall approach would force a complete, frozen requirements/design phase before any code — but this project's actual build order (reuse an existing secure auth stack → pivot the domain model → discover real bugs via smoke-testing → fix them) only worked *because* the process allowed iterating in short, testable increments. Scrum's sprint cadence matches that naturally. Kanban was considered and rejected: a continuous-flow board without sprint boundaries would make it harder to produce the two discrete Sprint Plans, burndown charts, and velocity figures Phase 9/10 explicitly require.

## 2. Agile Manifesto Principle Mapping

| # | Manifesto Principle | How this project applies it |
|---|---|---|
| 1 | *Working software is the primary measure of progress.* | Every phase's documentation (threat model, architecture, attack tree) was written **after** the corresponding feature was actually built and smoke-tested — e.g. the STRIDE table in Phase 7 describes real API routes that exist and run, not a planned design. |
| 2 | *Welcome changing requirements, even late in development.* | The original codebase was a law-enforcement complaint tracker; the entire domain was pivoted to IAM mid-stream (new schema, new auth payload, new routes) without restarting the project — the reusable security core (JWT, TOTP, WebAuthn, audit log) is what made that change cheap. |
| 3 | *Business people and developers must work together daily.* | The product owner's priorities (stated directly in conversation — "make sure DB and everything is changed", "I need complete... storys epics... perfectly") were translated into backlog items the same session they were raised, not queued for a later planning ceremony. |
| 4 | *Continuous attention to technical excellence and good design enhances agility.* | The privilege-escalation guard (`assertCanAssignRole`) and the approval-authority guard (`assertCanApprove`) were designed as reusable, testable functions in `authz.ts` rather than inlined per-route checks — the design investment paid off immediately when the same guard logic was needed in three different routes. |
| 5 | *Simplicity — the art of maximizing the amount of work not done — is essential.* | The access-control model deliberately stops at one role per user plus direct permission overrides (`UserPermission`), rather than building a full hierarchical RBAC+ABAC engine — enough to satisfy every requirement in the problem statement, no more. |
| 6 | *The best architectures, requirements, and designs emerge from self-organizing teams.* | The decision to reuse the existing auth/MFA/audit stack rather than rebuild from scratch emerged from inspecting what already existed, not from a top-down architecture mandate — the design "emerged" from the codebase's actual state. |
| 7 | *At regular intervals, the team reflects on how to become more effective, then tunes and adjusts.* | The seed-script bug (hardcoded PK breaking the autoincrement sequence) and the seed-data design smell (two "scoped" approvers sharing one flat role) were both caught by smoke-testing *before* being written up as finished work — the retrospective habit of "test before declaring done" is baked into the workflow (see Sprint Retrospective, `/docs/10-sprint`). |

## 3. Refactoring Opportunities (Before/After)

### Refactor 1 — Decouple authorization from a specific domain hierarchy

**Before** (`src/lib/api-auth.ts`, pre-pivot):
```ts
const ROLE_HIERARCHY: Record<string, number> = {
  INS: 1, DSP: 2, ADSP: 3, SP: 4, DIG: 5,
};

export function requireMinRole(session: JwtPayload, minRole: RoleCode): Response | null {
  const userLevel = ROLE_HIERARCHY[session.roleCode] ?? 0;
  const requiredLevel = ROLE_HIERARCHY[minRole] ?? 0;
  if (userLevel < requiredLevel) return apiError(`Forbidden — requires at least ${minRole} role`, 403);
  return null;
}

export function requireBranchAccess(session: JwtPayload, branchId: number): Response | null {
  if (session.isSupervisory) return null;
  if (session.branchId !== branchId) return apiError("Forbidden — you do not have access to this branch", 403);
  return null;
}
```
This hardcodes a five-rank police hierarchy and a branch-scoping rule directly into the auth helper — neither concept exists in an IAM domain, and the "higher rank sees more" assumption doesn't generalize (an Auditor should see audit logs without being able to approve payroll access, which a linear hierarchy can't express).

**After** (`src/lib/authz.ts`):
```ts
export async function getEffectivePermissions(userId: number): Promise<string[]> {
  // role-granted ∪ direct UserPermission grants (not expired)
}

export function requirePermission(session: JwtPayload, permissionCode: string): Response | null {
  if (!session.permissions.includes(permissionCode)) {
    return apiError(`Forbidden — requires permission ${permissionCode}`, 403);
  }
  return null;
}
```
Authorization is now expressed as "do you hold this specific permission" rather than "are you ranked high enough" — a flat, composable model that scales to arbitrary resources without new hierarchy levels. **Why this matters for security, not just cleanliness:** a rank-based model conflates seniority with authority; the permission model enforces the actual principle this app needs — least privilege, checked per-resource.

### Refactor 2 — Replace hardcoded seed IDs with idempotent existence checks

**Before** (`prisma/seed.ts`):
```ts
await prisma.accessRequest.upsert({
  where: { id: 1 },
  update: {},
  create: { id: 1, requesterId: alice.id, permissionId: payrollRead.id, /* ... */ },
});
```
This was caught during Batch A smoke-testing: Postgres's autoincrement sequence for `access_requests` doesn't advance when a row is inserted with an explicit `id`, so the very first real `AccessRequest.create()` call collided with `id: 1` and threw `P2002` (unique constraint violation) — a 500 error on the self-service access-request endpoint.

**After**:
```ts
const existingSampleRequests = await prisma.accessRequest.count({
  where: { requesterId: { in: [alice.id, bob.id] } },
});
if (existingSampleRequests === 0) {
  await prisma.accessRequest.createMany({ data: [/* no explicit ids */] });
}
```
Idempotency now comes from checking whether the seed data already exists, not from pinning primary keys — the database's own sequence stays authoritative. **Maintainability improvement:** this is the general pattern for *any* future seed data added to this file; pinning IDs would reintroduce the same class of bug every time.

## 4. Limitations and Risks of Agile for a Security-Critical System

| Risk | Mitigation |
|---|---|
| **Security requirements are easy to under-specify in a fast-moving backlog.** Agile's bias toward shippable increments can tempt a team to defer "non-functional" security work (rate-limiting, audit logging, lockout policy) in favor of visible features, since security work often has no direct UI. | Security requirements are written as explicit, independently-estimated backlog items with their own acceptance criteria (see `/docs/09-backlog` — several stories are pure security stories: account lockout, audit logging, privilege-escalation guard), not folded silently into feature stories where they can be dropped under time pressure. |
| **Short sprints discourage deep threat modeling, which doesn't fit neatly into a two-week box.** STRIDE analysis and attack-tree construction are naturally done once against a stabilized design, not incrementally re-done every sprint — but a strict "working software every sprint" mindset can treat that as wasted non-coding time. | Threat modeling (Phase 7/8) is treated as its own first-class deliverable, done once the core architecture is stable (post Batch A), and explicitly re-visited whenever a schema or authz change lands — rather than skipped because it doesn't produce a demoable UI increment. |
