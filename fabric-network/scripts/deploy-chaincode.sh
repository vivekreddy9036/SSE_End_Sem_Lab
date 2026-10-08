#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# CoATS Fabric Network — Chaincode Deployment (Fabric Lifecycle)
# ═══════════════════════════════════════════════════════════════════════════════
#
# Packages, installs, approves, and commits the CoATS chaincode
# using the Fabric 2.x lifecycle process.
#
# Chaincode source: ../chaincode/coats-chaincode/
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=utils.sh
source "${SCRIPT_DIR}/utils.sh"


# ═══════════════════════════════════════════════════════════════════════════════
# 1. Package Chaincode
# ═══════════════════════════════════════════════════════════════════════════════

function packageChaincode() {
  local CC_LABEL="${CHAINCODE_NAME}_${CHAINCODE_VERSION}"
  local CC_PACKAGE="${FABRIC_NET_DIR}/${CHAINCODE_NAME}.tar.gz"

  infoln "─── Packaging chaincode: ${CC_LABEL} ───"

  setPeerEnv

  # Remove old package if exists
  rm -f "${CC_PACKAGE}"

  peer lifecycle chaincode package "${CC_PACKAGE}" \
    --path "${CHAINCODE_SRC}" \
    --lang node \
    --label "${CC_LABEL}"

  [[ -f "${CC_PACKAGE}" ]] || fataln "Chaincode package not created."

  successln "Chaincode packaged: ${CC_PACKAGE}"
}


# ═══════════════════════════════════════════════════════════════════════════════
# 2. Install Chaincode on Peer
# ═══════════════════════════════════════════════════════════════════════════════

function installChaincode() {
  local CC_PACKAGE="${FABRIC_NET_DIR}/${CHAINCODE_NAME}.tar.gz"

  infoln "─── Installing chaincode on peer0 ───"

  setPeerEnv

  peer lifecycle chaincode install "${CC_PACKAGE}"

  successln "Chaincode installed on peer0."

  # Query installed to get package ID
  infoln "Querying installed chaincodes..."
  peer lifecycle chaincode queryinstalled
}


# ═══════════════════════════════════════════════════════════════════════════════
# 3. Get Package ID
# ═══════════════════════════════════════════════════════════════════════════════

function getPackageId() {
  local CC_LABEL="${CHAINCODE_NAME}_${CHAINCODE_VERSION}"

  setPeerEnv

  PACKAGE_ID=$(peer lifecycle chaincode queryinstalled \
    --output json 2>/dev/null \
    | python3 -c "
import json, sys
data = json.load(sys.stdin)
for cc in data.get('installed_chaincodes', []):
    if cc.get('label') == '${CC_LABEL}':
        print(cc['package_id'])
        sys.exit(0)
sys.exit(1)
") || fataln "Package ID not found for label: ${CC_LABEL}"

  infoln "Package ID: ${PACKAGE_ID}"
  export PACKAGE_ID
}


# ═══════════════════════════════════════════════════════════════════════════════
# 4. Approve Chaincode for Organization
# ═══════════════════════════════════════════════════════════════════════════════

function approveChaincode() {
  infoln "─── Approving chaincode for CoATSOrg ───"

  getPackageId
  setPeerEnv

  peer lifecycle chaincode approveformyorg \
    -o "localhost:${ORDERER_PORT:-7050}" \
    --tls \
    --cafile "${ORGANIZATIONS_DIR}/ordererOrg/orderers/orderer.coats.gov.in/tls/ca.crt" \
    --channelID "${CHANNEL_NAME}" \
    --name "${CHAINCODE_NAME}" \
    --version "${CHAINCODE_VERSION}" \
    --package-id "${PACKAGE_ID}" \
    --sequence "${CHAINCODE_SEQUENCE}" \
    --init-required

  successln "Chaincode approved for CoATSOrg."
}


# ═══════════════════════════════════════════════════════════════════════════════
# 5. Check Commit Readiness
# ═══════════════════════════════════════════════════════════════════════════════

function checkCommitReadiness() {
  infoln "─── Checking commit readiness ───"

  setPeerEnv

  peer lifecycle chaincode checkcommitreadiness \
    --channelID "${CHANNEL_NAME}" \
    --name "${CHAINCODE_NAME}" \
    --version "${CHAINCODE_VERSION}" \
    --sequence "${CHAINCODE_SEQUENCE}" \
    --init-required \
    --output json
}


# ═══════════════════════════════════════════════════════════════════════════════
# 6. Commit Chaincode
# ═══════════════════════════════════════════════════════════════════════════════

function commitChaincode() {
  infoln "─── Committing chaincode to channel ───"

  setPeerEnv

  peer lifecycle chaincode commit \
    -o "localhost:${ORDERER_PORT:-7050}" \
    --tls \
    --cafile "${ORGANIZATIONS_DIR}/ordererOrg/orderers/orderer.coats.gov.in/tls/ca.crt" \
    --channelID "${CHANNEL_NAME}" \
    --name "${CHAINCODE_NAME}" \
    --version "${CHAINCODE_VERSION}" \
    --sequence "${CHAINCODE_SEQUENCE}" \
    --init-required \
    --peerAddresses "localhost:${PEER0_PORT:-7051}" \
    --tlsRootCertFiles "${ORGANIZATIONS_DIR}/coatsOrg/peers/peer0.coats.gov.in/tls/ca.crt"

  successln "Chaincode committed to channel: ${CHANNEL_NAME}"

  # Verify
  infoln "Querying committed chaincodes..."
  peer lifecycle chaincode querycommitted \
    --channelID "${CHANNEL_NAME}" \
    --name "${CHAINCODE_NAME}"
}


# ═══════════════════════════════════════════════════════════════════════════════
# 7. Initialize Chaincode (call InitLedger)
# ═══════════════════════════════════════════════════════════════════════════════

function initChaincode() {
  infoln "─── Initializing chaincode (InitLedger) ───"

  setPeerEnv

  peer chaincode invoke \
    -o "localhost:${ORDERER_PORT:-7050}" \
    --tls \
    --cafile "${ORGANIZATIONS_DIR}/ordererOrg/orderers/orderer.coats.gov.in/tls/ca.crt" \
    -C "${CHANNEL_NAME}" \
    -n "${CHAINCODE_NAME}" \
    --peerAddresses "localhost:${PEER0_PORT:-7051}" \
    --tlsRootCertFiles "${ORGANIZATIONS_DIR}/coatsOrg/peers/peer0.coats.gov.in/tls/ca.crt" \
    --isInit \
    -c '{"function":"InitLedger","Args":[]}'

  successln "Chaincode initialized successfully."
}


# ═══════════════════════════════════════════════════════════════════════════════
# Full Deployment Pipeline
# ═══════════════════════════════════════════════════════════════════════════════

function deployChaincode() {
  infoln "═══ Starting CoATS Chaincode Deployment ═══"

  packageChaincode
  installChaincode
  approveChaincode
  checkCommitReadiness
  commitChaincode
  sleep 3
  initChaincode

  echo ""
  successln "═══ CoATS Chaincode deployed and initialized! ═══"
  echo ""
}


if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  deployChaincode
fi
