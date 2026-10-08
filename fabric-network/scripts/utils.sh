#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# CoATS Fabric Network — Utility Functions
# ═══════════════════════════════════════════════════════════════════════════════
# Sourced by all other scripts. Not executed directly.
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

function infoln()  { echo -e "${BLUE}[INFO]${NC}  $*"; }
function successln() { echo -e "${GREEN}[OK]${NC}    $*"; }
function warnln()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
function errorln() { echo -e "${RED}[ERROR]${NC} $*"; }
function fataln()  { echo -e "${RED}[FATAL]${NC} $*"; exit 1; }

# ─── Paths ──────────────────────────────────────────────────────────────────

# Root of the fabric-network directory
FABRIC_NET_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPTS_DIR="${FABRIC_NET_DIR}/scripts"
ORGANIZATIONS_DIR="${FABRIC_NET_DIR}/organizations"
CHANNEL_ARTIFACTS_DIR="${FABRIC_NET_DIR}/channel-artifacts"
PROJECT_ROOT="$(cd "${FABRIC_NET_DIR}/.." && pwd)"
CHAINCODE_SRC="${PROJECT_ROOT}/chaincode/coats-chaincode"

# ─── Load .env ──────────────────────────────────────────────────────────────

if [[ -f "${FABRIC_NET_DIR}/.env" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "${FABRIC_NET_DIR}/.env"
  set +a
else
  fataln "Missing ${FABRIC_NET_DIR}/.env — copy from .env.example and configure."
fi

# ─── Defaults ───────────────────────────────────────────────────────────────

CHANNEL_NAME="${CHANNEL_NAME:-coats-channel}"
CHAINCODE_NAME="${CHAINCODE_NAME:-coats-chaincode}"
CHAINCODE_VERSION="${CHAINCODE_VERSION:-1.0}"
CHAINCODE_SEQUENCE="${CHAINCODE_SEQUENCE:-1}"
ORDERER_MSP="${ORDERER_MSP:-OrdererMSP}"
COATS_MSP="${COATS_MSP:-CoATSMSP}"

# ─── Verify Prerequisites ──────────────────────────────────────────────────

function verifyPrerequisites() {
  local MISSING=0

  for cmd in docker peer configtxgen osnadmin fabric-ca-client; do
    if ! command -v "$cmd" &>/dev/null; then
      errorln "Required command not found: $cmd"
      MISSING=1
    fi
  done

  if ! docker compose version &>/dev/null; then
    errorln "Docker Compose V2 not found (docker compose)"
    MISSING=1
  fi

  if [[ $MISSING -eq 1 ]]; then
    fataln "Install missing prerequisites. See deployment/DEPLOYMENT.md"
  fi

  successln "All prerequisites verified."
}

# ─── Docker Compose Helpers ─────────────────────────────────────────────────

function dockerComposeCA() {
  docker compose -f "${FABRIC_NET_DIR}/docker-compose-ca.yaml" \
    --env-file "${FABRIC_NET_DIR}/.env" "$@"
}

function dockerComposeNet() {
  docker compose -f "${FABRIC_NET_DIR}/docker-compose-net.yaml" \
    --env-file "${FABRIC_NET_DIR}/.env" "$@"
}

# ─── Wait for Container Health ──────────────────────────────────────────────

function waitForContainer() {
  local CONTAINER="$1"
  local MAX_WAIT="${2:-60}"
  local ELAPSED=0

  infoln "Waiting for ${CONTAINER} to be ready..."

  while [[ $ELAPSED -lt $MAX_WAIT ]]; do
    if docker inspect --format='{{.State.Running}}' "$CONTAINER" 2>/dev/null | grep -q true; then
      successln "${CONTAINER} is running."
      return 0
    fi
    sleep 2
    ELAPSED=$((ELAPSED + 2))
  done

  fataln "${CONTAINER} did not start within ${MAX_WAIT}s."
}

# ─── Peer Environment Setup ────────────────────────────────────────────────

function setPeerEnv() {
  export FABRIC_CFG_PATH="${FABRIC_NET_DIR}"
  export CORE_PEER_TLS_ENABLED=true
  export CORE_PEER_LOCALMSPID="${COATS_MSP}"
  export CORE_PEER_TLS_ROOTCERT_FILE="${ORGANIZATIONS_DIR}/coatsOrg/peers/peer0.coats.gov.in/tls/ca.crt"
  export CORE_PEER_MSPCONFIGPATH="${ORGANIZATIONS_DIR}/coatsOrg/users/Admin@coats.gov.in/msp"
  export CORE_PEER_ADDRESS="localhost:${PEER0_PORT:-7051}"
}

# ─── Orderer Admin Environment ──────────────────────────────────────────────

function setOrdererAdminEnv() {
  export ORDERER_CA="${ORGANIZATIONS_DIR}/ordererOrg/orderers/orderer.coats.gov.in/tls/ca.crt"
  export ORDERER_ADMIN_TLS_SIGN_CERT="${ORGANIZATIONS_DIR}/ordererOrg/orderers/orderer.coats.gov.in/tls/server.crt"
  export ORDERER_ADMIN_TLS_PRIVATE_KEY="${ORGANIZATIONS_DIR}/ordererOrg/orderers/orderer.coats.gov.in/tls/server.key"
}
