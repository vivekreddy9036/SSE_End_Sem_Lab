#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# CoATS Fabric Network — Channel Operations
# ═══════════════════════════════════════════════════════════════════════════════
#
# Creates the application channel using the Channel Participation API
# (Fabric 2.3+, no system channel) and joins orderers + peers.
#
# Called by network.sh — not intended to be run standalone.
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=utils.sh
source "${SCRIPT_DIR}/utils.sh"


# ═══════════════════════════════════════════════════════════════════════════════
# Generate Channel Genesis Block
# ═══════════════════════════════════════════════════════════════════════════════

function generateChannelBlock() {
  infoln "─── Generating channel genesis block ───"

  mkdir -p "${CHANNEL_ARTIFACTS_DIR}"

  export FABRIC_CFG_PATH="${FABRIC_NET_DIR}"

  configtxgen \
    -profile CoATSChannel \
    -outputBlock "${CHANNEL_ARTIFACTS_DIR}/${CHANNEL_NAME}.block" \
    -channelID "${CHANNEL_NAME}"

  [[ -f "${CHANNEL_ARTIFACTS_DIR}/${CHANNEL_NAME}.block" ]] \
    || fataln "Failed to generate channel genesis block."

  successln "Channel genesis block generated: ${CHANNEL_NAME}.block"
}


# ═══════════════════════════════════════════════════════════════════════════════
# Join Orderer to Channel (via osnadmin Channel Participation API)
# ═══════════════════════════════════════════════════════════════════════════════

function joinOrdererToChannel() {
  infoln "─── Joining orderer to channel: ${CHANNEL_NAME} ───"

  setOrdererAdminEnv

  osnadmin channel join \
    --channelID "${CHANNEL_NAME}" \
    --config-block "${CHANNEL_ARTIFACTS_DIR}/${CHANNEL_NAME}.block" \
    -o "localhost:${ORDERER_ADMIN_PORT:-7053}" \
    --ca-file "${ORDERER_CA}" \
    --client-cert "${ORDERER_ADMIN_TLS_SIGN_CERT}" \
    --client-key "${ORDERER_ADMIN_TLS_PRIVATE_KEY}"

  successln "Orderer joined channel: ${CHANNEL_NAME}"

  # Verify
  infoln "Verifying orderer channel membership..."
  osnadmin channel list \
    -o "localhost:${ORDERER_ADMIN_PORT:-7053}" \
    --ca-file "${ORDERER_CA}" \
    --client-cert "${ORDERER_ADMIN_TLS_SIGN_CERT}" \
    --client-key "${ORDERER_ADMIN_TLS_PRIVATE_KEY}"
}


# ═══════════════════════════════════════════════════════════════════════════════
# Join Peer to Channel
# ═══════════════════════════════════════════════════════════════════════════════

function joinPeerToChannel() {
  infoln "─── Joining peer0 to channel: ${CHANNEL_NAME} ───"

  setPeerEnv

  # Retry logic — orderer may need a moment after joining
  local MAX_RETRIES=5
  local DELAY=3

  for i in $(seq 1 $MAX_RETRIES); do
    if peer channel join \
      -b "${CHANNEL_ARTIFACTS_DIR}/${CHANNEL_NAME}.block" \
      -o "localhost:${ORDERER_PORT:-7050}" \
      --tls \
      --cafile "${ORGANIZATIONS_DIR}/ordererOrg/orderers/orderer.coats.gov.in/tls/ca.crt"; then
      successln "Peer0 joined channel: ${CHANNEL_NAME}"
      return 0
    fi
    warnln "Attempt ${i}/${MAX_RETRIES} failed. Retrying in ${DELAY}s..."
    sleep $DELAY
  done

  fataln "Peer0 failed to join channel after ${MAX_RETRIES} attempts."
}


# ═══════════════════════════════════════════════════════════════════════════════
# Set Anchor Peer
# ═══════════════════════════════════════════════════════════════════════════════

function setAnchorPeer() {
  infoln "─── Setting anchor peer for CoATSOrg ───"

  setPeerEnv

  # Wait for orderer to be ready to serve channel requests
  sleep 5

  # Fetch the current channel config (with retry)
  local MAX_RETRIES=5
  local DELAY=4
  for i in $(seq 1 $MAX_RETRIES); do
    if peer channel fetch config "${CHANNEL_ARTIFACTS_DIR}/config_block.pb" \
      -o "localhost:${ORDERER_PORT:-7050}" \
      -c "${CHANNEL_NAME}" \
      --tls \
      --cafile "${ORGANIZATIONS_DIR}/ordererOrg/orderers/orderer.coats.gov.in/tls/ca.crt"; then
      break
    fi
    if [[ $i -eq $MAX_RETRIES ]]; then
      fataln "Failed to fetch channel config after ${MAX_RETRIES} attempts."
    fi
    warnln "Attempt ${i}/${MAX_RETRIES} failed. Retrying in ${DELAY}s..."
    sleep $DELAY
  done

  # (original fetch below is now replaced by retry above, skip duplicate)
  true ||  peer channel fetch config "${CHANNEL_ARTIFACTS_DIR}/config_block.pb" \
    -o "localhost:${ORDERER_PORT:-7050}" \
    -c "${CHANNEL_NAME}" \
    --tls \
    --cafile "${ORGANIZATIONS_DIR}/ordererOrg/orderers/orderer.coats.gov.in/tls/ca.crt"

  # Decode, modify, encode, compute update
  cd "${CHANNEL_ARTIFACTS_DIR}"

  configtxlator proto_decode --input config_block.pb --type common.Block \
    --output config_block.json

  # Extract config from block
  python3 -c "
import json, sys
with open('config_block.json') as f:
    block = json.load(f)
with open('config.json', 'w') as f:
    json.dump(block['data']['data'][0]['payload']['data']['config'], f)
"

  # Add anchor peer
  python3 -c "
import json
with open('config.json') as f:
    config = json.load(f)
anchor = config['channel_group']['groups']['Application']['groups']['CoATSOrg']
anchor['values']['AnchorPeers'] = {
    'mod_policy': 'Admins',
    'value': {
        'anchor_peers': [{'host': 'peer0.coats.gov.in', 'port': 7051}]
    },
    'version': '0'
}
with open('modified_config.json', 'w') as f:
    json.dump(config, f)
"

  configtxlator proto_encode --input config.json --type common.Config \
    --output config.pb
  configtxlator proto_encode --input modified_config.json --type common.Config \
    --output modified_config.pb
  configtxlator compute_update --channel_id "${CHANNEL_NAME}" \
    --original config.pb --updated modified_config.pb \
    --output config_update.pb
  configtxlator proto_decode --input config_update.pb --type common.ConfigUpdate \
    --output config_update.json

  python3 -c "
import json
with open('config_update.json') as f:
    update = json.load(f)
envelope = {
    'payload': {
        'header': {
            'channel_header': {
                'channel_id': '${CHANNEL_NAME}',
                'type': 2
            }
        },
        'data': {'config_update': update}
    }
}
with open('config_update_in_envelope.json', 'w') as f:
    json.dump(envelope, f)
"

  configtxlator proto_encode --input config_update_in_envelope.json \
    --type common.Envelope --output config_update_in_envelope.pb

  cd "${FABRIC_NET_DIR}"

  peer channel update \
    -f "${CHANNEL_ARTIFACTS_DIR}/config_update_in_envelope.pb" \
    -c "${CHANNEL_NAME}" \
    -o "localhost:${ORDERER_PORT:-7050}" \
    --tls \
    --cafile "${ORGANIZATIONS_DIR}/ordererOrg/orderers/orderer.coats.gov.in/tls/ca.crt"

  successln "Anchor peer set for CoATSOrg."
}


# ═══════════════════════════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════════════════════════

function createChannel() {
  generateChannelBlock
  joinOrdererToChannel
  joinPeerToChannel
  setAnchorPeer
  successln "Channel ${CHANNEL_NAME} fully configured."
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  createChannel
fi
