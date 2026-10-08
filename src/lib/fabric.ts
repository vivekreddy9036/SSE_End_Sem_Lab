/**
 * Hyperledger Fabric Integration — CoATS V2
 *
 * Supports two cert loading modes — auto-detected from env vars:
 *
 * LOCAL DEV (file paths):
 *   FABRIC_TLS_CERT_PATH, FABRIC_CERT_PATH, FABRIC_KEY_PATH
 *   → reads PEM files from the filesystem (fabric-certs/ folder)
 *
 * PRODUCTION / VERCEL (base64 strings):
 *   FABRIC_TLS_CERT_B64, FABRIC_CERT_B64, FABRIC_KEY_B64
 *   → decodes base64 strings stored as environment variables
 *   → required for platforms like Vercel with no persistent filesystem
 *
 * FABRIC_ENABLED is false when neither mode is configured — app works
 * completely normally without a Fabric network.
 * All calls are fire-and-forget, never blocking API responses.
 */

import * as grpc from "@grpc/grpc-js";
import {
  connect,
  type Contract,
  type Identity,
  type Signer,
  signers,
} from "@hyperledger/fabric-gateway";
import * as crypto from "crypto";
import * as fs from "fs";
import { prisma } from "@/lib/prisma";

// ── Configuration ──────────────────────────────────────────────────────────

const FABRIC_PEER_ENDPOINT_RAW = process.env.FABRIC_PEER_ENDPOINT ?? "";
// Use ipv4: scheme for direct IP addresses to bypass DNS resolution
const FABRIC_PEER_ENDPOINT = FABRIC_PEER_ENDPOINT_RAW && !FABRIC_PEER_ENDPOINT_RAW.includes("://")
  ? `ipv4:${FABRIC_PEER_ENDPOINT_RAW}`
  : FABRIC_PEER_ENDPOINT_RAW;
const FABRIC_CHANNEL       = process.env.FABRIC_CHANNEL       ?? "coats-channel";
const FABRIC_CHAINCODE     = process.env.FABRIC_CHAINCODE     ?? "coats-chaincode";
const FABRIC_MSP_ID        = process.env.FABRIC_MSP_ID        ?? "CoATSMSP";
const FABRIC_PEER_HOSTNAME = process.env.FABRIC_PEER_HOSTNAME ?? "";

// File-path mode (local dev)
const FABRIC_TLS_CERT_PATH = process.env.FABRIC_TLS_CERT_PATH ?? "";
const FABRIC_CERT_PATH     = process.env.FABRIC_CERT_PATH     ?? "";
const FABRIC_KEY_PATH      = process.env.FABRIC_KEY_PATH      ?? "";

// Base64 mode (Vercel / serverless production)
const FABRIC_TLS_CERT_B64  = process.env.FABRIC_TLS_CERT_B64  ?? "";
const FABRIC_CERT_B64      = process.env.FABRIC_CERT_B64      ?? "";
const FABRIC_KEY_B64       = process.env.FABRIC_KEY_B64       ?? "";

// Enabled if endpoint is set AND either mode has certs
const HAS_FILE_CERTS = !!(FABRIC_TLS_CERT_PATH && FABRIC_CERT_PATH && FABRIC_KEY_PATH);
const HAS_B64_CERTS  = !!(FABRIC_TLS_CERT_B64  && FABRIC_CERT_B64  && FABRIC_KEY_B64);
const FABRIC_ENABLED = !!(FABRIC_PEER_ENDPOINT && (HAS_FILE_CERTS || HAS_B64_CERTS));

if (!FABRIC_ENABLED) {
  console.info("[Fabric] Not configured — blockchain anchoring disabled.");
}

// ── Cert Loading ───────────────────────────────────────────────────────────

/**
 * Returns cert buffers from either base64 env vars (Vercel)
 * or file paths (local dev) — whichever is configured.
 */
function loadCerts(): { tlsCert: Buffer; certificate: Buffer; privateKeyPem: Buffer } {
  if (HAS_B64_CERTS) {
    return {
      tlsCert:       Buffer.from(FABRIC_TLS_CERT_B64, "base64"),
      certificate:   Buffer.from(FABRIC_CERT_B64,     "base64"),
      privateKeyPem: Buffer.from(FABRIC_KEY_B64,      "base64"),
    };
  }
  return {
    tlsCert:       fs.readFileSync(FABRIC_TLS_CERT_PATH),
    certificate:   fs.readFileSync(FABRIC_CERT_PATH),
    privateKeyPem: fs.readFileSync(FABRIC_KEY_PATH),
  };
}

// ── Connection Helper ───────────────────────────────────────────────────────

interface FabricConnection {
  contract: Contract;
  close: () => void;
}

function getConnection(): FabricConnection {
  const { tlsCert, certificate, privateKeyPem } = loadCerts();

  const tlsCredentials = grpc.credentials.createSsl(tlsCert);
  const grpcClient = new grpc.Client(FABRIC_PEER_ENDPOINT, tlsCredentials, {
    "grpc.ssl_target_name_override": FABRIC_PEER_HOSTNAME,
  });

  const privateKey = crypto.createPrivateKey(privateKeyPem);
  const identity: Identity = { mspId: FABRIC_MSP_ID, credentials: certificate };
  const signer: Signer = signers.newPrivateKeySigner(privateKey);

  const gateway = connect({ client: grpcClient, identity, signer });
  const network = gateway.getNetwork(FABRIC_CHANNEL);
  const contract = network.getContract(FABRIC_CHAINCODE);

  return {
    contract,
    close: () => {
      gateway.close();
      grpcClient.close();
    },
  };
}

// ── Internal Submit Helper ──────────────────────────────────────────────────

/**
 * Submits a transaction to Fabric and returns the transaction ID.
 * Throws on failure — callers handle the error.
 */
async function submitTx(
  fnName: string,
  ...args: string[]
): Promise<string> {
  const { contract, close } = getConnection();
  try {
    const resultBytes = await contract.submitTransaction(fnName, ...args);
    const result = JSON.parse(Buffer.from(resultBytes).toString()) as { txId?: string };
    return result.txId ?? "unknown";
  } finally {
    close();
  }
}

// ── Public API — Fire-and-Forget ────────────────────────────────────────────
// Each function returns void and never throws. Errors are logged only.
// Matching the exact pattern of auditLog() in src/lib/audit.ts.

/**
 * Anchor a new case creation event on the Fabric ledger.
 * Called after prisma.case.create() succeeds.
 * @param caseId  The DB primary key of the Case row (used to save the TX ID back).
 */
export function fabricRecordCaseCreated(
  caseUid: string,
  officerId: number,
  branchId: number,
  crimeNumber: string,
  caseId: number
): void {
  if (!FABRIC_ENABLED) return;

  const timestamp = new Date().toISOString();
  submitTx(
    "recordCaseCreated",
    caseUid,
    String(officerId),
    String(branchId),
    crimeNumber,
    timestamp
  )
    .then((txId) => {
      console.info(`[Fabric] Case created anchored: ${caseUid} | TX: ${txId}`);
      prisma.case
        .update({ where: { id: caseId }, data: { blockchainTxId: txId } })
        .catch((err) => console.error("[Fabric] Failed to save blockchainTxId for case:", err));
    })
    .catch((err) => {
      console.error("[Fabric] recordCaseCreated failed:", err?.message ?? err);
      // Log each detail for actionable debugging
      if (Array.isArray(err?.details)) {
        err.details.forEach((d: { address?: string; message?: string }) =>
          console.error(`  [Fabric detail] ${d.address} → ${d.message}`)
        );
      }
    });
}

/**
 * Anchor a stage change event on the Fabric ledger.
 * Called after prisma.case.update() changes stageId.
 */
export function fabricRecordStageChange(
  caseUid: string,
  officerId: number,
  oldStageId: number,
  newStageId: number
): void {
  if (!FABRIC_ENABLED) return;

  const timestamp = new Date().toISOString();
  submitTx(
    "recordStageChange",
    caseUid,
    String(officerId),
    String(oldStageId),
    String(newStageId),
    timestamp
  )
    .then((txId) => console.info(`[Fabric] Stage change anchored: ${caseUid} ${oldStageId}→${newStageId} | TX: ${txId}`))
    .catch((err) => console.error("[Fabric] recordStageChange failed:", err));
}

/**
 * Anchor a progress entry event on the Fabric ledger.
 * Called after prisma.caseProgress.create() succeeds.
 */
export function fabricRecordProgress(
  caseUid: string,
  officerId: number,
  progressDate: string,
  progressId: number
): void {
  if (!FABRIC_ENABLED) return;

  const timestamp = new Date().toISOString();
  submitTx(
    "recordProgress",
    caseUid,
    String(officerId),
    progressDate,
    String(progressId),
    timestamp
  )
    .then((txId) => {
      console.info(`[Fabric] Progress anchored: ${caseUid} | TX: ${txId}`);
      prisma.caseProgress
        .update({ where: { id: progressId }, data: { blockchainTxId: txId } })
        .catch((err) => console.error("[Fabric] Failed to save blockchainTxId for progress:", err));
    })
    .catch((err) => console.error("[Fabric] recordProgress failed:", err));
}

/**
 * Anchor an action completion event on the Fabric ledger.
 * Called after prisma.caseAction.update() marks action completed.
 */
export function fabricRecordActionCompleted(
  caseUid: string,
  officerId: number,
  actionId: number
): void {
  if (!FABRIC_ENABLED) return;

  const timestamp = new Date().toISOString();
  submitTx(
    "recordActionCompleted",
    caseUid,
    String(officerId),
    String(actionId),
    timestamp
  )
    .then((txId) => {
      console.info(`[Fabric] Action completed anchored: action#${actionId} | TX: ${txId}`);
      prisma.caseAction
        .update({ where: { id: actionId }, data: { blockchainTxId: txId } })
        .catch((err) => console.error("[Fabric] Failed to save blockchainTxId for action:", err));
    })
    .catch((err) => console.error("[Fabric] recordActionCompleted failed:", err));
}


// ── Public API — Query Functions ────────────────────────────────────────────
// These are NOT fire-and-forget — they return data to the caller.

/** Whether the Fabric blockchain integration is configured and active. */
export function isFabricEnabled(): boolean {
  return FABRIC_ENABLED;
}

/**
 * Query a transaction from the blockchain. Returns the evaluated result.
 * Unlike submitTx(), this does NOT create a new transaction on the ledger.
 */
async function evaluateQuery(
  fnName: string,
  ...args: string[]
): Promise<string> {
  if (!FABRIC_ENABLED) throw new Error("Fabric is not configured");

  const { contract, close } = getConnection();
  try {
    const resultBytes = await contract.evaluateTransaction(fnName, ...args);
    return Buffer.from(resultBytes).toString();
  } finally {
    close();
  }
}

/** Get the immutable case creation record from the ledger. */
export async function fabricGetCaseRecord(caseUid: string): Promise<unknown> {
  const raw = await evaluateQuery("getCaseRecord", caseUid);
  return JSON.parse(raw);
}

/** Get the full history of a case (all creation-record writes). */
export async function fabricGetCaseHistory(caseUid: string): Promise<unknown[]> {
  const raw = await evaluateQuery("getCaseHistory", caseUid);
  return JSON.parse(raw);
}

/** Get all stage-change records for a case. */
export async function fabricGetStageHistory(caseUid: string): Promise<unknown[]> {
  const raw = await evaluateQuery("getStageHistory", caseUid);
  return JSON.parse(raw);
}

/** Get all progress records for a case. */
export async function fabricGetProgressHistory(caseUid: string): Promise<unknown[]> {
  const raw = await evaluateQuery("getProgressHistory", caseUid);
  return JSON.parse(raw);
}
