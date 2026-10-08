#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# CoATS — GCP VM Provisioning Script
# ═══════════════════════════════════════════════════════════════════════════════
#
# Run this ON the GCP VM after creation. Installs:
#   1. Docker Engine + Compose V2
#   2. Hyperledger Fabric binaries (peer, configtxgen, osnadmin, fabric-ca-client)
#   3. System hardening (UFW, fail2ban, unattended upgrades)
#   4. Node.js 20 LTS (for chaincode)
#
# Usage:
#   gcloud compute ssh coats-fabric-node --zone=asia-south1-a
#   curl -sSL <this-script-url> | sudo bash
#   # OR copy the file and run:
#   sudo bash provision-vm.sh
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ─── Configuration ──────────────────────────────────────────────────────────
FABRIC_VERSION="2.5.12"
FABRIC_CA_VERSION="1.5.13"
NODE_MAJOR=20

# ─── Colors ─────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; BLUE='\033[0;34m'; NC='\033[0m'
info() { echo -e "${BLUE}[PROV]${NC} $*"; }
ok()   { echo -e "${GREEN}[OK]${NC}   $*"; }
err()  { echo -e "${RED}[ERR]${NC}  $*"; exit 1; }

[[ $EUID -eq 0 ]] || err "Run as root: sudo bash provision-vm.sh"

echo ""
echo "  ╔══════════════════════════════════════════════════════════════╗"
echo "  ║   CoATS — VM Provisioning                                   ║"
echo "  ╚══════════════════════════════════════════════════════════════╝"
echo ""


# ═══════════════════════════════════════════════════════════════════════════════
# 1. System Updates
# ═══════════════════════════════════════════════════════════════════════════════

info "Updating system packages..."
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y -qq
ok "System updated."


# ═══════════════════════════════════════════════════════════════════════════════
# 2. Install Docker Engine + Compose V2
# ═══════════════════════════════════════════════════════════════════════════════

info "Installing Docker Engine..."
if command -v docker &>/dev/null; then
  info "Docker already installed: $(docker --version)"
else
  apt-get install -y -qq ca-certificates curl gnupg lsb-release

  apt-get install -y -qq ca-certificates curl gnupg lsb-release
  install -m 0755 -d /etc/apt/keyrings
  install -m 0755 -d /etc/apt/sources-list.d
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --batch --yes --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg

  ARCH=$(dpkg --print-architecture)
  CODENAME=$(lsb_release -cs)
  echo "deb [arch=${ARCH} signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${CODENAME} stable" \
    > /etc/apt/sources-list.d/docker.list

  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

# Add the current sudo user to docker group
if [[ -n "${SUDO_USER:-}" ]]; then
  usermod -aG docker "${SUDO_USER}"
  info "Added ${SUDO_USER} to docker group."
fi

systemctl enable docker
systemctl start docker
ok "Docker installed: $(docker --version)"


# ═══════════════════════════════════════════════════════════════════════════════
# 3. Install Node.js 20 LTS
# ═══════════════════════════════════════════════════════════════════════════════

info "Installing Node.js ${NODE_MAJOR}.x..."
if command -v node &>/dev/null && node --version | grep -q "v${NODE_MAJOR}"; then
  info "Node.js already installed: $(node --version)"
else
  curl -fsSL https://deb.nodesource.com/setup_${NODE_MAJOR}.x | bash -
  apt-get install -y -qq nodejs
fi
ok "Node.js installed: $(node --version)"


# ═══════════════════════════════════════════════════════════════════════════════
# 4. Install Hyperledger Fabric Binaries
# ═══════════════════════════════════════════════════════════════════════════════

info "Installing Hyperledger Fabric binaries v${FABRIC_VERSION}..."
FABRIC_BIN_DIR="/usr/local/fabric"
mkdir -p "${FABRIC_BIN_DIR}"

cd /tmp

# Download Fabric binaries
if [[ ! -f "${FABRIC_BIN_DIR}/bin/peer" ]] || ! "${FABRIC_BIN_DIR}/bin/peer" version 2>/dev/null | grep -q "${FABRIC_VERSION}"; then
  info "Downloading Fabric ${FABRIC_VERSION} binaries..."
  curl -sSL "https://github.com/hyperledger/fabric/releases/download/v${FABRIC_VERSION}/hyperledger-fabric-linux-amd64-${FABRIC_VERSION}.tar.gz" \
    | tar xz -C "${FABRIC_BIN_DIR}"
fi

# Download Fabric CA binaries
if [[ ! -f "${FABRIC_BIN_DIR}/bin/fabric-ca-client" ]]; then
  info "Downloading Fabric CA ${FABRIC_CA_VERSION} binaries..."
  curl -sSL "https://github.com/hyperledger/fabric-ca/releases/download/v${FABRIC_CA_VERSION}/hyperledger-fabric-ca-linux-amd64-${FABRIC_CA_VERSION}.tar.gz" \
    | tar xz -C "${FABRIC_BIN_DIR}"
fi

# Add to system PATH
cat > /etc/profile.d/fabric.sh <<'EOF'
export PATH="/usr/local/fabric/bin:$PATH"
EOF
chmod +x /etc/profile.d/fabric.sh
export PATH="/usr/local/fabric/bin:$PATH"

ok "Fabric binaries installed: $(peer version 2>&1 | head -1)"

# Pull Docker images
info "Pulling Hyperledger Fabric Docker images..."
docker pull "hyperledger/fabric-peer:${FABRIC_VERSION%%.*}.${FABRIC_VERSION#*.}"
docker pull "hyperledger/fabric-orderer:${FABRIC_VERSION%%.*}.${FABRIC_VERSION#*.}"
docker pull "hyperledger/fabric-ca:${FABRIC_CA_VERSION%%.*}.${FABRIC_CA_VERSION#*.}"
docker pull "hyperledger/fabric-ccenv:${FABRIC_VERSION%%.*}.${FABRIC_VERSION#*.}"
docker pull "hyperledger/fabric-nodeenv:${FABRIC_VERSION%%.*}.${FABRIC_VERSION#*.}"
docker pull "couchdb:3.3"
ok "Docker images pulled."


# ═══════════════════════════════════════════════════════════════════════════════
# 5. Install Python3 (for config update scripts)
# ═══════════════════════════════════════════════════════════════════════════════

info "Ensuring Python3 is available..."
apt-get install -y -qq python3
ok "Python3: $(python3 --version)"


# ═══════════════════════════════════════════════════════════════════════════════
# 6. System Hardening
# ═══════════════════════════════════════════════════════════════════════════════

info "Applying system hardening..."

# UFW Firewall (defense in depth, alongside GCP firewall)
apt-get install -y -qq ufw
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    comment "SSH"
ufw allow 7051/tcp  comment "Fabric peer gRPC"
echo "y" | ufw enable
ok "UFW firewall enabled."

# Fail2Ban (SSH brute-force protection)
apt-get install -y -qq fail2ban
systemctl enable fail2ban
systemctl start fail2ban
ok "Fail2Ban enabled."

# Unattended security upgrades
apt-get install -y -qq unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades 2>/dev/null || true
ok "Unattended upgrades enabled."

# SSH hardening
if ! grep -q "PermitRootLogin no" /etc/ssh/sshd_config; then
  sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
  sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
  sed -i 's/^#\?X11Forwarding.*/X11Forwarding no/' /etc/ssh/sshd_config
  systemctl restart sshd
  ok "SSH hardened (root login disabled, password auth disabled)."
fi


# ═══════════════════════════════════════════════════════════════════════════════
# 7. Create deployment directory
# ═══════════════════════════════════════════════════════════════════════════════

DEPLOY_DIR="/opt/coats-fabric"
mkdir -p "${DEPLOY_DIR}"
if [[ -n "${SUDO_USER:-}" ]]; then
  chown -R "${SUDO_USER}:${SUDO_USER}" "${DEPLOY_DIR}"
fi
ok "Deployment directory ready: ${DEPLOY_DIR}"


echo ""
echo "  ╔══════════════════════════════════════════════════════════════╗"
echo "  ║   VM Provisioning Complete                                   ║"
echo "  ║                                                              ║"
echo "  ║   Docker:   $(docker --version | cut -d, -f1)"
echo "  ║   Node.js:  $(node --version)"
echo "  ║   Fabric:   v${FABRIC_VERSION}"
echo "  ║   CA:       v${FABRIC_CA_VERSION}"
echo "  ║                                                              ║"
echo "  ║   Next Steps:                                                ║"
echo "  ║   1. Log out and back in (for docker group)                  ║"
echo "  ║   2. Copy fabric-network/ to ${DEPLOY_DIR}/"
echo "  ║   3. cd ${DEPLOY_DIR}/fabric-network"
echo "  ║   4. cp .env.example .env && nano .env                       ║"
echo "  ║   5. bash scripts/network.sh up                              ║"
echo "  ╚══════════════════════════════════════════════════════════════╝"
echo ""
