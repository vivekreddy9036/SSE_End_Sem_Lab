import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
} from "@simplewebauthn/server";
import { prisma } from "./prisma";

// ── WebAuthn Relying Party config ─────────────────────
// RP_ID = your domain (no protocol, no port)
const RP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "CoATS";
const RP_ID = process.env.WEBAUTHN_RP_ID || "localhost";

/**
 * Extract the browser origin from the incoming request.
 * Falls back to WEBAUTHN_ORIGIN env var, then http://localhost:3000.
 */
export function getOriginFromRequest(req: Request): string {
  const origin = req.headers.get("origin");
  if (origin) return origin;

  const referer = req.headers.get("referer");
  if (referer) {
    try {
      const url = new URL(referer);
      return url.origin;
    } catch { /* ignore */ }
  }

  return process.env.WEBAUTHN_ORIGIN || "http://localhost:3000";
}

// ── DB-backed challenge store ─────────────────────────
// Stores the active WebAuthn challenge directly on the User row.
// This survives HMR reloads and Vercel serverless cold starts.
const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function storeChallenge(userId: number, challenge: string) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      webauthnChallenge: challenge,
      webauthnChallengeExp: new Date(Date.now() + CHALLENGE_TTL_MS),
    },
  });
}

async function consumeChallenge(userId: number): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { webauthnChallenge: true, webauthnChallengeExp: true },
  });

  // Clear the challenge from DB regardless of outcome (one-time use)
  await prisma.user.update({
    where: { id: userId },
    data: { webauthnChallenge: null, webauthnChallengeExp: null },
  });

  if (!user?.webauthnChallenge) return null;
  if (user.webauthnChallengeExp && user.webauthnChallengeExp < new Date()) return null;

  return user.webauthnChallenge;
}

// ── Registration (setup) ──────────────────────────────

export async function getRegistrationOptions(userId: number, username: string) {
  // Fetch existing passkeys so the authenticator doesn't re-register them
  const existingPasskeys = await prisma.passkey.findMany({
    where: { userId },
    select: { credentialId: true, transports: true },
  });

  const excludeCredentials = existingPasskeys.map((pk) => ({
    id: pk.credentialId,
    transports: pk.transports
      ? (JSON.parse(pk.transports) as AuthenticatorTransportFuture[])
      : undefined,
  }));

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userName: username,
    attestationType: "none", // no attestation needed for passkeys
    excludeCredentials,
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });

  await storeChallenge(userId, options.challenge);
  return options;
}

export async function verifyAndSaveRegistration(
  userId: number,
  response: RegistrationResponseJSON,
  friendlyName?: string,
  expectedOrigin?: string
) {
  const expectedChallenge = await consumeChallenge(userId);
  if (!expectedChallenge) {
    throw new Error("Registration challenge expired or not found. Please try again.");
  }

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: expectedOrigin || process.env.WEBAUTHN_ORIGIN || "http://localhost:3000",
    expectedRPID: RP_ID,
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new Error("Passkey registration verification failed.");
  }

  const {
    credential,
    credentialDeviceType,
    credentialBackedUp,
  } = verification.registrationInfo;

  // Save the passkey credential to DB
  await prisma.passkey.create({
    data: {
      userId,
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey),
      counter: BigInt(credential.counter),
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
      transports: credential.transports
        ? JSON.stringify(credential.transports)
        : null,
      friendlyName: friendlyName || null,
    },
  });

  // Enable passkey flag on user if not already
  await prisma.user.update({
    where: { id: userId },
    data: { passkeyEnabled: true },
  });

  return verification;
}

// ── Authentication (login verification) ───────────────

export async function getAuthenticationOptions(userId: number) {
  const passkeys = await prisma.passkey.findMany({
    where: { userId },
    select: { credentialId: true, transports: true },
  });

  if (passkeys.length === 0) {
    throw new Error("No passkeys registered for this account.");
  }

  const allowCredentials = passkeys.map((pk) => ({
    id: pk.credentialId,
    transports: pk.transports
      ? (JSON.parse(pk.transports) as AuthenticatorTransportFuture[])
      : undefined,
  }));

  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    allowCredentials,
    userVerification: "preferred",
  });

  await storeChallenge(userId, options.challenge);
  return options;
}

export async function verifyAuthentication(
  userId: number,
  response: AuthenticationResponseJSON,
  expectedOrigin?: string
) {
  const expectedChallenge = await consumeChallenge(userId);
  if (!expectedChallenge) {
    throw new Error("Authentication challenge expired or not found. Please try again.");
  }

  // Find the passkey that matches the credential used
  const passkey = await prisma.passkey.findUnique({
    where: { credentialId: response.id },
  });

  if (!passkey || passkey.userId !== userId) {
    throw new Error("Passkey not found or does not belong to this account.");
  }

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: expectedOrigin || process.env.WEBAUTHN_ORIGIN || "http://localhost:3000",
    expectedRPID: RP_ID,
    credential: {
      id: passkey.credentialId,
      publicKey: new Uint8Array(passkey.publicKey),
      counter: Number(passkey.counter),
      transports: passkey.transports
        ? (JSON.parse(passkey.transports) as AuthenticatorTransportFuture[])
        : undefined,
    },
  });

  if (!verification.verified) {
    throw new Error("Passkey authentication failed.");
  }

  // Update counter and last used timestamp
  await prisma.passkey.update({
    where: { id: passkey.id },
    data: {
      counter: BigInt(verification.authenticationInfo.newCounter),
      lastUsedAt: new Date(),
    },
  });

  return verification;
}
