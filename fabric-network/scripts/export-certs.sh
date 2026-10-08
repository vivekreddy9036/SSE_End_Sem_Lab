#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# CoATS Fabric Network — Export Certificates for Next.js App
# ═══════════════════════════════════════════════════════════════════════════════
#
# Exports the three certificates needed by the Next.js app (src/lib/fabric.ts):
#   1. TLS CA cert (for gRPC TLS connection to peer)
#   2. Client identity cert (enrolled via Fabric CA)
#   3. Client private key
#
# Two output modes:
#   --files   → copies PEM files to ../fabric-certs/ (for local dev)
#   --base64  → prints base64-encoded values (for Vercel / serverless env vars)
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=utils.sh
source "${SCRIPT_DIR}/utils.sh"

CERTS_OUTPUT="${PROJECT_ROOT}/fabric-certs"
CLIENT_MSP="${ORGANIZATIONS_DIR}/coatsOrg/users/Client@coats.gov.in/msp"
PEER_TLS="${ORGANIZATIONS_DIR}/coatsOrg/peers/peer0.coats.gov.in/tls"


function verifySourceCerts() {
  local MISSING=0

  [[ -f "${PEER_TLS}/ca.crt" ]]          || { errorln "Missing: peer TLS CA cert"; MISSING=1; }
  [[ -d "${CLIENT_MSP}/signcerts" ]]      || { errorln "Missing: client signcerts dir"; MISSING=1; }
  [[ -d "${CLIENT_MSP}/keystore" ]]       || { errorln "Missing: client keystore dir"; MISSING=1; }

  [[ $MISSING -eq 0 ]] || fataln "Source certificates not found. Run enrollment first."
}


function exportFiles() {
  infoln "─── Exporting certificates as PEM files ───"
  verifySourceCerts

  mkdir -p "${CERTS_OUTPUT}"

  cp "${PEER_TLS}/ca.crt"                "${CERTS_OUTPUT}/tls-ca.crt"
  cp "${CLIENT_MSP}/signcerts/"*          "${CERTS_OUTPUT}/admin-cert.pem"
  cp "${CLIENT_MSP}/keystore/"*           "${CERTS_OUTPUT}/admin-key.pem"

  # Restrictive permissions
  chmod 600 "${CERTS_OUTPUT}/admin-key.pem"
  chmod 644 "${CERTS_OUTPUT}/tls-ca.crt" "${CERTS_OUTPUT}/admin-cert.pem"

  successln "Certificates exported to: ${CERTS_OUTPUT}/"
  echo ""
  infoln "Add these to your .env (local dev):"
  echo "  FABRIC_PEER_ENDPOINT=\"<VM_IP>:${PEER0_PORT:-7051}\""
  echo "  FABRIC_PEER_HOSTNAME=\"peer0.coats.gov.in\""
  echo "  FABRIC_CHANNEL=\"${CHANNEL_NAME}\""
  echo "  FABRIC_CHAINCODE=\"${CHAINCODE_NAME}\""
  echo "  FABRIC_MSP_ID=\"${COATS_MSP}\""
  echo "  FABRIC_TLS_CERT_PATH=\"./fabric-certs/tls-ca.crt\""
  echo "  FABRIC_CERT_PATH=\"./fabric-certs/admin-cert.pem\""
  echo "  FABRIC_KEY_PATH=\"./fabric-certs/admin-key.pem\""
  echo ""
}


function exportBase64() {
  infoln "─── Exporting certificates as Base64 (for Vercel / production env vars) ───"
  verifySourceCerts

  local TLS_B64 CERT_B64 KEY_B64
  TLS_B64=$(base64 -w 0 "${PEER_TLS}/ca.crt")
  CERT_B64=$(base64 -w 0 "${CLIENT_MSP}/signcerts/"*)
  KEY_B64=$(base64 -w 0 "${CLIENT_MSP}/keystore/"*)

  echo ""
  successln "Copy these environment variables to your deployment platform:"
  echo ""
  echo "FABRIC_PEER_ENDPOINT=\"<VM_EXTERNAL_IP>:${PEER0_PORT:-7051}\""
  echo "FABRIC_PEER_HOSTNAME=\"peer0.coats.gov.in\""
  echo "FABRIC_CHANNEL=\"${CHANNEL_NAME}\""
  echo "FABRIC_CHAINCODE=\"${CHAINCODE_NAME}\""
  echo "FABRIC_MSP_ID=\"${COATS_MSP}\""
  echo ""
  echo "FABRIC_TLS_CERT_B64=\"${TLS_B64}\""
  echo ""
  echo "FABRIC_CERT_B64=\"${CERT_B64}\""
  echo ""
  echo "FABRIC_KEY_B64=\"${KEY_B64}\""
  echo ""
}


# ═══════════════════════════════════════════════════════════════════════════════
# Usage
# ═══════════════════════════════════════════════════════════════════════════════

function usage() {
  echo "Usage: $0 [--files|--base64]"
  echo ""
  echo "  --files   Export PEM files to fabric-certs/ (local dev)"
  echo "  --base64  Print base64 values (Vercel / production)"
  echo ""
  exit 1
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  case "${1:-}" in
    --files)  exportFiles ;;
    --base64) exportBase64 ;;
    *)        usage ;;
  esac
fi
