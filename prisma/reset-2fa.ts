import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Delete all passkeys
  const deleted = await prisma.passkey.deleteMany({});
  console.log(`Deleted ${deleted.count} passkeys`);

  // Reset 2FA for all users
  const result = await prisma.user.updateMany({
    data: {
      totpEnabled: false,
      totpSecret: null,
      totpBackupCodes: null,
      totpFailedCount: 0,
      totpLockedUntil: null,
      passkeyEnabled: false,
    },
  });
  console.log(`Reset 2FA for ${result.count} users`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
