import { randomBytes, createHash, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";

const TOKEN_BYTES = 32; // 256-bit raw token
const TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Create a password-reset token for a user. The raw token is returned once
 * (to email/display to the user) and only its sha256 hash is persisted —
 * the DB never holds a usable credential, mirroring how passwordHash works.
 */
export async function createPasswordResetToken(
  userId: number,
  requestIp: string | null
): Promise<string> {
  const rawToken = randomBytes(TOKEN_BYTES).toString("hex");
  await prisma.passwordResetToken.create({
    data: {
      userId,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
      requestIp,
    },
  });
  return rawToken;
}

/**
 * Validate a raw reset token: must exist, be unexpired, and unused.
 * Returns the userId on success, or null otherwise. Comparison is on the
 * hash's DB lookup (indexed, unique) — no need for timing-safe compare here
 * since sha256(token) is already a one-way, unguessable lookup key, but we
 * still use timingSafeEqual on the stored hash to avoid any observable
 * short-circuit behavior in the string comparison itself.
 */
export async function consumePasswordResetToken(
  rawToken: string
): Promise<{ userId: number; tokenId: number } | null> {
  const tokenHash = hashToken(rawToken);

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
  });

  if (!record) return null;
  if (record.usedAt) return null;
  if (record.expiresAt < new Date()) return null;

  const expectedHash = Buffer.from(hashToken(rawToken));
  const storedHash = Buffer.from(record.tokenHash);
  if (
    expectedHash.length !== storedHash.length ||
    !timingSafeEqual(expectedHash, storedHash)
  ) {
    return null;
  }

  // Single-use: mark consumed immediately so a leaked/re-sent link can't be replayed.
  await prisma.passwordResetToken.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });

  return { userId: record.userId, tokenId: record.id };
}
