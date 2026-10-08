#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# CoATS Hyperledger Fabric Network — Main Orchestrator
# ═══════════════════════════════════════════════════════════════════════════════
#
# Usage:
#   ./network.sh up       — Start CAs, generate crypto, start network, create channel
#   ./network.sh down     — Stop and remove all containers and volumes
#   ./network.sh deploy   — Package, install, approve, commit chaincode
#   ./network.sh export   — Export certificates for Next.js app (--files or --base64)
#   ./network.sh restart  — Stop and restart the network (preserves crypto)
#   ./network.sh status   — Show running containers and channel info
#
# Prerequisites:
#   - Docker 24+ with Compose V2
#   - Fabric binaries (peer, configtxgen, osnadmin, fabric-ca-client) in PATH
#   - .env file configured (copy from .env.example)
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=utils.sh
source "${SCRIPT_DIR}/utils.sh"
# shellcheck source=enroll.sh
source "${SCRIPT_DIR}/enroll.sh"
# shellcheck source=channel.sh
source "${SCRIPT_DIR}/channel.sh"
# shellcheck source=deploy-chaincode.sh
source "${SCRIPT_DIR}/deploy-chaincode.sh"
# shellcheck source=export-certs.sh
source "${SCRIPT_DIR}/export-certs.sh"


# ═══════════════════════════════════════════════════════════════════════════════
# Generate Strong Passwords (if not yet set)
# ═══════════════════════════════════════════════════════════════════════════════

function generatePasswords() {
  local ENV_FILE="${FABRIC_NET_DIR}/.env"
  local MODIFIED=0

  # Check each password placeholder and replace with a generated value
  for VAR in CA_ORDERER_ADMIN_PASSWORD CA_COATS_ADMIN_PASSWORD COUCHDB_PASSWORD \
             ORDERER_PASSWORD ORDERER_ADMIN_PASSWORD PEER0_PASSWORD \
             COATS_ADMIN_PASSWORD COATS_CLIENT_PASSWORD; do

    local CURRENT
    CURRENT=$(grep "^${VAR}=" "${ENV_FILE}" | cut -d= -f2- | tr -d '"')

    if [[ "${CURRENT}" == "<GENERATE_STRONG_PASSWORD>" || -z "${CURRENT}" ]]; then
      local NEW_PASSWORD
      NEW_PASSWORD=$(openssl rand -hex 32)
      sed -i "s|^${VAR}=.*|${VAR}=\"${NEW_PASSWORD}\"|" "${ENV_FILE}"
      MODIFIED=1
    fi
  done

  if [[ $MODIFIED -eq 1 ]]; then
    infoln "Generated strong passwords in .env"
    # Re-source the env file with new passwords
    set -a
    # shellcheck source=/dev/null
    source "${ENV_FILE}"
    set +a
  fi
}


# ═══════════════════════════════════════════════════════════════════════════════
# Network Up — Full Setup
# ═══════════════════════════════════════════════════════════════════════════════

function networkUp() {
  echo ""
  echo "  ╔══════════════════════════════════════════════════════════════╗"
  echo "  ║     CoATS Hyperledger Fabric Network — Starting Up         ║"
  echo "  ╚══════════════════════════════════════════════════════════════╝"
  echo ""

  # ── Step 0: Prerequisites ──
  verifyPrerequisites

  # ── Step 1: Generate passwords if needed ──
  generatePasswords

  # ── Step 2: Start Certificate Authorities ──
  infoln "Step 1/5: Starting Certificate Authorities..."
  dockerComposeCA up -d
  waitForContainer "ca.orderer.coats.gov.in" 60
  waitForContainer "ca.coats.gov.in" 60
  sleep 5  # Allow CAs to generate TLS certs

  # ── Step 3: Generate Crypto Material ──
  infoln "Step 2/5: Generating crypto material via Fabric CAs..."
  mkdir -p "${ORGANIZATIONS_DIR}" "${CHANNEL_ARTIFACTS_DIR}"
  createOrdererOrg
  createCoATSOrg

  # ── Step 4: Start Network (Orderer, Peer, CouchDB) ──
  infoln "Step 3/5: Starting orderer, peer, and CouchDB..."
  dockerComposeNet up -d
  waitForContainer "orderer.coats.gov.in" 60
  waitForContainer "couchdb0.coats.gov.in" 60
  waitForContainer "peer0.coats.gov.in" 60
  sleep 5  # Allow services to fully initialize

  # ── Step 5: Create and Join Channel ──
  infoln "Step 4/5: Creating channel and joining nodes..."
  createChannel

  # ── Step 6: Deploy Chaincode ──
  infoln "Step 5/5: Deploying CoATS chaincode..."
  deployChaincode

  echo ""
  echo "  ╔══════════════════════════════════════════════════════════════╗"
  echo "  ║     CoATS Fabric Network — RUNNING                        ║"
  echo "  ║                                                            ║"
  echo "  ║  Orderer:  localhost:${ORDERER_PORT:-7050}  (gRPC + TLS)             ║"
  echo "  ║  Peer0:    localhost:${PEER0_PORT:-7051}  (gRPC + TLS)             ║"
  echo "  ║  Channel:  ${CHANNEL_NAME}                          ║"
  echo "  ║  CC:       ${CHAINCODE_NAME} v${CHAINCODE_VERSION}                  ║"
  echo "  ║                                                            ║"
  echo "  ║  Next: ./network.sh export --files                        ║"
  echo "  ║        or  ./network.sh export --base64                   ║"
  echo "  ╚══════════════════════════════════════════════════════════════╝"
  echo ""
}


# ═══════════════════════════════════════════════════════════════════════════════
# Network Down — Full Cleanup
# ═══════════════════════════════════════════════════════════════════════════════

function networkDown() {
  echo ""
  infoln "Stopping CoATS Fabric Network..."

  # Stop network containers (remove orphans and volumes)
  dockerComposeNet down --volumes --remove-orphans 2>/dev/null || true
  # Stop CA containers (remove orphans and volumes)
  dockerComposeCA down --volumes --remove-orphans 2>/dev/null || true

  # Force-remove any leftover named volumes with our project prefix
  docker volume ls -q | grep -E "^coats-fabric" | xargs -r docker volume rm 2>/dev/null || true

  # Remove chaincode containers (dynamically created by peer)
  docker ps -a --filter "name=dev-peer0" --format '{{.ID}}' | xargs -r docker rm -f 2>/dev/null || true
  # Remove chaincode images
  docker images --filter "reference=dev-peer0*" --format '{{.ID}}' | xargs -r docker rmi -f 2>/dev/null || true

  # Clean generated material
  rm -rf "${ORGANIZATIONS_DIR}"
  rm -rf "${CHANNEL_ARTIFACTS_DIR}"
  rm -f "${FABRIC_NET_DIR}/${CHAINCODE_NAME}.tar.gz"

  successln "CoATS Fabric Network stopped and cleaned."
  echo ""
}


# ═══════════════════════════════════════════════════════════════════════════════
# Network Restart (preserves crypto material)
# ═══════════════════════════════════════════════════════════════════════════════

function networkRestart() {
  infoln "Restarting CoATS Fabric Network (preserving crypto)..."
  dockerComposeNet restart
  dockerComposeCA restart
  sleep 10
  successln "Network restarted."
}


# ═══════════════════════════════════════════════════════════════════════════════
# Status
# ═══════════════════════════════════════════════════════════════════════════════

function networkStatus() {
  echo ""
  infoln "─── Docker Containers ───"
  docker ps --filter "network=coats-fabric-network" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

  echo ""
  infoln "─── Channel Info ───"
  if command -v osnadmin &>/dev/null; then
    setOrdererAdminEnv
    osnadmin channel list \
      -o "localhost:${ORDERER_ADMIN_PORT:-7053}" \
      --ca-file "${ORDERER_CA}" \
      --client-cert "${ORDERER_ADMIN_TLS_SIGN_CERT}" \
      --client-key "${ORDERER_ADMIN_TLS_PRIVATE_KEY}" 2>/dev/null || warnln "Could not query orderer channels."
  fi
  echo ""
}


# ═══════════════════════════════════════════════════════════════════════════════
# Entry Point
# ═══════════════════════════════════════════════════════════════════════════════

function printUsage() {
  echo ""
  echo "Usage: $0 <command> [options]"
  echo ""
  echo "Commands:"
  echo "  up        Start the entire Fabric network from scratch"
  echo "  down      Stop and remove all containers, volumes, and crypto"
  echo "  deploy    Deploy (or upgrade) the CoATS chaincode"
  echo "  export    Export certificates for the Next.js app"
  echo "              --files   → PEM files to fabric-certs/"
  echo "              --base64  → base64 strings for env vars"
  echo "  restart   Restart containers (preserve crypto material)"
  echo "  status    Show running containers and channel info"
  echo ""
}

case "${1:-}" in
  up)       networkUp ;;
  down)     networkDown ;;
  deploy)   deployChaincode ;;
  export)   shift; exportFiles; exportBase64 ;;
  restart)  networkRestart ;;
  status)   networkStatus ;;
  *)        printUsage ;;
esac
