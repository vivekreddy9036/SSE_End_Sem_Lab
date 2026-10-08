import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";

// Use the direct database URL for seeding (not Accelerate proxy)
const prisma = new PrismaClient({
  datasourceUrl: process.env.DIRECT_DATABASE_URL,
});

// Use fixed password for production - all users default to this password
// For security: Change this password immediately after first login
const DEFAULT_PASSWORD = process.env.SEED_DEFAULT_PASSWORD || "CoATS@2026";

async function main() {
  console.log("🌱 Seeding CoATS database...\n");

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  // ─── Branches ──────────────────────────────────────
  const branches = await Promise.all([
    prisma.branch.upsert({
      where: { code: "HQ" },
      update: {},
      create: { code: "HQ", name: "Headquarters", isHeadquarters: true },
    }),
    prisma.branch.upsert({
      where: { code: "CNI" },
      update: {},
      create: { code: "CNI", name: "Chennai" },
    }),
    prisma.branch.upsert({
      where: { code: "MDU" },
      update: {},
      create: { code: "MDU", name: "Madurai" },
    }),
    prisma.branch.upsert({
      where: { code: "CMB" },
      update: {},
      create: { code: "CMB", name: "Coimbatore" },
    }),
  ]);

  const [hq, cni, mdu, cmb] = branches;
  console.log(`✓ ${branches.length} branches created`);

  // ─── Roles ─────────────────────────────────────────
  const roles = await Promise.all([
    prisma.role.upsert({
      where: { code: "DIG" },
      update: {},
      create: { code: "DIG", name: "Deputy Inspector General", isSupervisory: true },
    }),
    prisma.role.upsert({
      where: { code: "SP" },
      update: {},
      create: { code: "SP", name: "Superintendent of Police", isSupervisory: true },
    }),
    prisma.role.upsert({
      where: { code: "ADSP" },
      update: {},
      create: { code: "ADSP", name: "Additional Superintendent of Police", isSupervisory: false },
    }),
    prisma.role.upsert({
      where: { code: "DSP" },
      update: {},
      create: { code: "DSP", name: "Deputy Superintendent of Police", isSupervisory: false },
    }),
    prisma.role.upsert({
      where: { code: "INS" },
      update: {},
      create: { code: "INS", name: "Inspector", isSupervisory: false },
    }),
  ]);

  const [dig, sp, adsp, dsp, ins] = roles;
  console.log(`✓ ${roles.length} roles created`);

  // ─── Case Stages ───────────────────────────────────
  const stages = await Promise.all([
    prisma.caseStage.upsert({
      where: { code: "UI" },
      update: {},
      create: { code: "UI", name: "Under Investigation" },
    }),
    prisma.caseStage.upsert({
      where: { code: "PT" },
      update: {},
      create: { code: "PT", name: "Pending Trial" },
    }),
    prisma.caseStage.upsert({
      where: { code: "HC" },
      update: {},
      create: { code: "HC", name: "Pending Before High Court" },
    }),
    prisma.caseStage.upsert({
      where: { code: "SC" },
      update: {},
      create: { code: "SC", name: "Pending Before Supreme Court" },
    }),
  ]);

  console.log(`✓ ${stages.length} case stages created`);

  // ─── Users ─────────────────────────────────────────
  // Helper to create/update user
  const upsertUser = (
    username: string,
    fullName: string,
    roleId: number,
    branchId: number
  ) =>
    prisma.user.upsert({
      where: { username },
      update: {},
      create: { username, passwordHash, fullName, roleId, branchId },
    });

  // Supervisory Officers (5)
  const supervisory = await Promise.all([
    upsertUser("DIG ATS", "DIG Anti Terrorism Squad", dig.id, hq.id),
    upsertUser("SP ATS HQ", "SP ATS Headquarters", sp.id, hq.id),
    upsertUser("SP ATS CNI", "SP ATS Chennai", sp.id, cni.id),
    upsertUser("SP ATS MDU", "SP ATS Madurai", sp.id, mdu.id),
    upsertUser("SP ATS CMB", "SP ATS Coimbatore", sp.id, cmb.id),
  ]);

  console.log(`✓ ${supervisory.length} supervisory officers created`);

  // Case Holding Officers (20)
  const caseHolders = await Promise.all([
    // Additional SPs
    upsertUser("ADSP HQ", "ADSP Headquarters", adsp.id, hq.id),
    upsertUser("ADSP CNI", "ADSP Chennai", adsp.id, cni.id),
    upsertUser("ADSP MDU", "ADSP Madurai", adsp.id, mdu.id),
    upsertUser("ADSP CMB", "ADSP Coimbatore", adsp.id, cmb.id),

    // DSPs
    upsertUser("DSP CNI", "DSP Chennai", dsp.id, cni.id),
    upsertUser("DSP MDU", "DSP Madurai", dsp.id, mdu.id),
    upsertUser("DSP CMB", "DSP Coimbatore", dsp.id, cmb.id),

    // Inspectors — Chennai
    upsertUser("INS1CNI", "Inspector 1 Chennai", ins.id, cni.id),
    upsertUser("INS2CNI", "Inspector 2 Chennai", ins.id, cni.id),
    upsertUser("INS3CNI", "Inspector 3 Chennai", ins.id, cni.id),
    upsertUser("INS4CNI", "Inspector 4 Chennai", ins.id, cni.id),

    // Inspectors — Madurai
    upsertUser("INS1MDU", "Inspector 1 Madurai", ins.id, mdu.id),
    upsertUser("INS2MDU", "Inspector 2 Madurai", ins.id, mdu.id),
    upsertUser("INS3MDU", "Inspector 3 Madurai", ins.id, mdu.id),
    upsertUser("INS4MDU", "Inspector 4 Madurai", ins.id, mdu.id),

    // Inspectors — Coimbatore
    upsertUser("INS1CMB", "Inspector 1 Coimbatore", ins.id, cmb.id),
    upsertUser("INS2CMB", "Inspector 2 Coimbatore", ins.id, cmb.id),
    upsertUser("INS3CMB", "Inspector 3 Coimbatore", ins.id, cmb.id),
    upsertUser("INS4CMB", "Inspector 4 Coimbatore", ins.id, cmb.id),

    // Admin Inspector
    upsertUser("INSADMIN", "Inspector Admin", ins.id, hq.id),
  ]);

  console.log(`✓ ${caseHolders.length} case holding officers created`);

  console.log(
    `\n✅ Seeding complete! Total: ${supervisory.length + caseHolders.length} users`
  );
  console.log(`   Default password for all users: ${DEFAULT_PASSWORD}`);
  console.log(`   ⚠️  PRODUCTION WARNING: Change this password after first login!`);
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
