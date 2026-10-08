import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

// Use the direct database URL for seeding (not Accelerate proxy)
const prisma = new PrismaClient({
  datasourceUrl: process.env.DIRECT_DATABASE_URL,
});

// Use fixed password for production - all users default to this password
// For security: Change this password immediately after first login
const DEFAULT_PASSWORD = process.env.SEED_DEFAULT_PASSWORD || "SentinelIAM@2026";

async function main() {
  console.log("🌱 Seeding SentinelIAM database...\n");

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  // ─── Roles ─────────────────────────────────────────
  // Deliberate least-privilege split: ADMIN manages identities/roles/permissions
  // (the IAM system itself) but holds no baseline business-data access — that
  // has to flow through an Access Request + Approver, same as any other user.
  const [admin, approver, auditor, user] = await Promise.all([
    prisma.role.upsert({
      where: { code: "ADMIN" },
      update: {},
      create: { code: "ADMIN", name: "Administrator", description: "Manages users, roles, permissions and resources.", isSystem: true },
    }),
    prisma.role.upsert({
      where: { code: "APPROVER" },
      update: {},
      create: { code: "APPROVER", name: "Approver", description: "Reviews and approves/rejects access requests for resources they own." },
    }),
    prisma.role.upsert({
      where: { code: "AUDITOR" },
      update: {},
      create: { code: "AUDITOR", name: "Auditor", description: "Read-only access to audit logs for compliance review." },
    }),
    prisma.role.upsert({
      where: { code: "USER" },
      update: {},
      create: { code: "USER", name: "Standard User", description: "No baseline resource access; must request access." },
    }),
  ]);
  console.log("✓ 4 roles created");

  // ─── Resources ─────────────────────────────────────
  const [roleMgmt, adminConsole, auditLogRes, hrPortal, payroll, customerDb, devops] =
    await Promise.all([
      prisma.resource.upsert({ where: { code: "ROLE_MGMT" }, update: {}, create: { code: "ROLE_MGMT", name: "Role Administration", description: "Assigning roles and permissions to users.", sensitivity: "CRITICAL" } }),
      prisma.resource.upsert({ where: { code: "ADMIN_CONSOLE" }, update: {}, create: { code: "ADMIN_CONSOLE", name: "Admin Console", description: "User/resource/permission management UI.", sensitivity: "CRITICAL" } }),
      prisma.resource.upsert({ where: { code: "AUDIT_LOG" }, update: {}, create: { code: "AUDIT_LOG", name: "Audit Log Console", description: "System-wide security event log.", sensitivity: "HIGH" } }),
      prisma.resource.upsert({ where: { code: "HR_PORTAL" }, update: {}, create: { code: "HR_PORTAL", name: "HR Portal", description: "Employee records.", sensitivity: "HIGH" } }),
      prisma.resource.upsert({ where: { code: "PAYROLL" }, update: {}, create: { code: "PAYROLL", name: "Payroll System", description: "Salary and compensation data.", sensitivity: "CRITICAL" } }),
      prisma.resource.upsert({ where: { code: "CUSTOMER_DB" }, update: {}, create: { code: "CUSTOMER_DB", name: "Customer Database", description: "Customer PII records.", sensitivity: "HIGH" } }),
      prisma.resource.upsert({ where: { code: "DEVOPS" }, update: {}, create: { code: "DEVOPS", name: "DevOps Pipeline", description: "CI/CD and deployment credentials.", sensitivity: "MEDIUM" } }),
    ]);
  console.log("✓ 7 resources created");

  // ─── Permissions ───────────────────────────────────
  const perm = async (code: string, name: string, action: string, resourceId: number) =>
    prisma.permission.upsert({ where: { code }, update: {}, create: { code, name, action, resourceId } });

  const [
    roleMgmtManage, adminConsoleAdmin, auditLogRead,
    hrRead, , hrApprove,
    payrollRead, , payrollApprove,
    , ,
    , , devopsApprove,
  ] = await Promise.all([
    perm("ROLE_MGMT_MANAGE", "Assign/revoke roles", "MANAGE", roleMgmt.id),
    perm("ADMIN_CONSOLE_ADMIN", "Full admin console access", "ADMIN", adminConsole.id),
    perm("AUDIT_LOG_READ", "View audit log", "READ", auditLogRes.id),
    perm("HR_PORTAL_READ", "View employee records", "READ", hrPortal.id),
    perm("HR_PORTAL_WRITE", "Edit employee records", "WRITE", hrPortal.id),
    perm("HR_PORTAL_APPROVE", "Approve HR Portal access requests", "APPROVE", hrPortal.id),
    perm("PAYROLL_READ", "View payroll data", "READ", payroll.id),
    perm("PAYROLL_WRITE", "Edit payroll data", "WRITE", payroll.id),
    perm("PAYROLL_APPROVE", "Approve Payroll access requests", "APPROVE", payroll.id),
    perm("CUSTOMER_DB_READ", "View customer records", "READ", customerDb.id),
    perm("CUSTOMER_DB_WRITE", "Edit customer records", "WRITE", customerDb.id),
    perm("DEVOPS_READ", "View pipeline config", "READ", devops.id),
    perm("DEVOPS_WRITE", "Edit pipeline config", "WRITE", devops.id),
    perm("DEVOPS_APPROVE", "Approve DevOps access requests", "APPROVE", devops.id),
  ]);
  console.log("✓ 14 permissions created");

  // ─── Bootstrap admin user (needed as grantedById for RolePermission rows) ──
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@sentineliam.test" },
    update: {},
    create: { email: "admin@sentineliam.test", passwordHash, fullName: "System Administrator", roleId: admin.id },
  });

  // ─── Role → Permission mapping (admin-defined baseline) ────────────────
  const grant = async (roleId: number, permissionId: number) =>
    prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId, permissionId } },
      update: {},
      create: { roleId, permissionId, grantedById: adminUser.id },
    });

  await Promise.all([
    grant(admin.id, roleMgmtManage.id),
    grant(admin.id, adminConsoleAdmin.id),
    grant(admin.id, auditLogRead.id),
    grant(auditor.id, auditLogRead.id),
    grant(approver.id, hrApprove.id),
    grant(approver.id, payrollApprove.id),
    grant(approver.id, devopsApprove.id),
    // USER role intentionally gets nothing by default — must request access.
  ]);
  console.log("✓ baseline role→permission grants created");

  // ─── Remaining users ────────────────────────────────
  const upsertUser = (email: string, fullName: string, roleId: number) =>
    prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, passwordHash, fullName, roleId },
    });

  const [, , , alice, bob] = await Promise.all([
    upsertUser("approver.hr@sentineliam.test", "Priya Approver (HR/Payroll)", approver.id),
    upsertUser("approver.ops@sentineliam.test", "Raj Approver (DevOps)", approver.id),
    upsertUser("auditor@sentineliam.test", "Meena Auditor", auditor.id),
    upsertUser("alice@sentineliam.test", "Alice User", user.id),
    upsertUser("bob@sentineliam.test", "Bob User", user.id),
    upsertUser("carol@sentineliam.test", "Carol User", user.id),
  ]);
  console.log("✓ 6 additional users created (2 approvers, 1 auditor, 3 standard users)");

  // ─── Sample access requests (demo data for the approval workflow) ──────
  await prisma.accessRequest.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      requesterId: alice.id,
      permissionId: payrollRead.id,
      justification: "Need read access to payroll to reconcile Q1 reimbursements.",
      status: "PENDING",
    },
  });
  await prisma.accessRequest.upsert({
    where: { id: 2 },
    update: {},
    create: {
      id: 2,
      requesterId: bob.id,
      permissionId: hrRead.id,
      justification: "Onboarding new hires requires read access to HR Portal.",
      status: "PENDING",
    },
  });
  console.log("✓ 2 sample access requests created");

  const totalUsers = 1 + 6;
  console.log(`\n✅ Seeding complete! Total: ${totalUsers} users`);
  console.log(`   Default password for all users: ${DEFAULT_PASSWORD}`);
  console.log(`   ⚠️  PRODUCTION WARNING: Change this password after first login!`);
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
