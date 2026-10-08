import { TOTP, Secret } from "otpauth";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { encrypt, decrypt } from "./crypto";

const TOTP_ISSUER = process.env.NEXT_PUBLIC_APP_NAME || "CoATS";
const TOTP_PERIOD = 30; // seconds
const TOTP_DIGITS = 6;
const TOTP_ALGORITHM = "SHA1"; // Google Authenticator default

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const RECOVERY_CODE_COUNT = 8;

// ── TOTP Generation ─────────────────────────────────

/**
 * Generate a new TOTP secret for a user.
 */
export function generateTotpSecret(): string {
  const secret = new Secret({ size: 20 }); // 160-bit secret
  return secret.base32;
}

/**
 * Create a TOTP instance from a base32 secret.
 */
function createTotp(secret: string, username: string): TOTP {
  return new TOTP({
    issuer: TOTP_ISSUER,
    label: username,
    algorithm: TOTP_ALGORITHM,
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD,
    secret: Secret.fromBase32(secret),
  });
}

/**
 * Generate the otpauth:// URI for QR code scanning.
 */
export function generateTotpUri(secret: string, username: string): string {
  const totp = createTotp(secret, username);
  return totp.toString();
}

/**
 * Verify a TOTP token with a ±1 window tolerance (30s before/after).
 */
export function verifyTotpToken(secret: string, token: string): boolean {
  const totp = createTotp(secret, "verify");
  const delta = totp.validate({ token, window: 1 });
  return delta !== null;
}

// ── Encryption helpers ──────────────────────────────

/**
 * Encrypt a TOTP secret for database storage.
 */
export function encryptTotpSecret(secret: string): string {
  return encrypt(secret);
}

/**
 * Decrypt a TOTP secret from database storage.
 */
export function decryptTotpSecret(encrypted: string): string {
  return decrypt(encrypted);
}

// ── Recovery Codes ──────────────────────────────────

/**
 * Generate a set of recovery codes and their bcrypt hashes.
 * Returns both plaintext (to show user once) and hashed (to store).
 */
export async function generateRecoveryCodes(): Promise<{
  plaintext: string[];
  hashed: string[];
}> {
  const codes: string[] = [];
  const hashes: string[] = [];

  for (let i = 0; i < RECOVERY_CODE_COUNT; i++) {
    // Format: XXXX-XXXX (8 hex chars with dash)
    const raw = randomBytes(4).toString("hex").toUpperCase();
    const code = `${raw.slice(0, 4)}-${raw.slice(4)}`;
    codes.push(code);
    const hash = await bcrypt.hash(code, 10);
    hashes.push(hash);
  }

  return { plaintext: codes, hashed: hashes };
}

/**
 * Verify a recovery code against a list of hashed codes.
 * Returns the index of the matched code, or -1 if no match.
 */
export async function verifyRecoveryCode(
  code: string,
  hashedCodes: string[]
): Promise<number> {
  const normalized = code.toUpperCase().trim();
  for (let i = 0; i < hashedCodes.length; i++) {
    if (hashedCodes[i] === "") continue; // already used
    const match = await bcrypt.compare(normalized, hashedCodes[i]);
    if (match) return i;
  }
  return -1;
}

// ── Account Lock ────────────────────────────────────

export { MAX_FAILED_ATTEMPTS, LOCKOUT_DURATION_MS };

/**
 * Check if an account is currently locked due to failed OTP attempts.
 */
export function isAccountLocked(lockedUntil: Date | null): boolean {
  if (!lockedUntil) return false;
  return new Date() < lockedUntil;
}

/**
 * Calculate the lockout expiry timestamp.
 */
export function getLockoutExpiry(): Date {
  return new Date(Date.now() + LOCKOUT_DURATION_MS);
}
