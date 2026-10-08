#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# CoATS — GCP Infrastructure Setup
# ═══════════════════════════════════════════════════════════════════════════════
#
# Creates GCP resources for the Hyperledger Fabric network:
#   1. VPC network with private subnet
#   2. Firewall rules (security-hardened)
#   3. Cloud NAT (for outbound internet from private VM)
#   4. Static external IP
#   5. GCE VM instance (Ubuntu 22.04 LTS)
#
# Prerequisites:
#   - gcloud CLI installed and authenticated
#   - A GCP project with billing enabled
#   - Compute Engine API enabled
#
# Usage (run from WSL or Cloud Shell):
#   chmod +x setup-infrastructure.sh
#   ./setup-infrastructure.sh
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ─── Configuration ──────────────────────────────────────────────────────────
# Modify these values for your deployment.

PROJECT_ID="${GCP_PROJECT_ID:?Set GCP_PROJECT_ID environment variable}"
REGION="${GCP_REGION:-asia-south1}"                      # Mumbai (closest for India)
ZONE="${GCP_ZONE:-asia-south1-a}"
VM_NAME="${GCP_VM_NAME:-coats-fabric-node}"
MACHINE_TYPE="${GCP_MACHINE_TYPE:-e2-standard-4}"        # 4 vCPU, 16 GB RAM
DISK_SIZE="${GCP_DISK_SIZE:-100}"                         # GB, SSD
VPC_NAME="coats-vpc"
SUBNET_NAME="coats-subnet"
SUBNET_RANGE="10.10.1.0/24"
STATIC_IP_NAME="coats-fabric-ip"
NAT_NAME="coats-nat"
ROUTER_NAME="coats-router"

# Restrict SSH access to these CIDRs (your admin IP + office)
ADMIN_CIDR="${ADMIN_SSH_CIDR:?Set ADMIN_SSH_CIDR (e.g. 203.0.113.5/32)}"

# Restrict peer gRPC to these CIDRs (your app deployment IP / Vercel)
APP_CIDR="${APP_GRPC_CIDR:-0.0.0.0/0}"  # Restrict in production!

# ─── Colors ─────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; BLUE='\033[0;34m'; NC='\033[0m'
info() { echo -e "${BLUE}[GCP]${NC} $*"; }
ok()   { echo -e "${GREEN}[OK]${NC}  $*"; }
err()  { echo -e "${RED}[ERR]${NC} $*"; exit 1; }

# ═══════════════════════════════════════════════════════════════════════════════
echo ""
echo "  ╔══════════════════════════════════════════════════════════════╗"
echo "  ║   CoATS — GCP Infrastructure Setup                         ║"
echo "  ║   Project: ${PROJECT_ID}"
echo "  ║   Region:  ${REGION} / ${ZONE}"
echo "  ╚══════════════════════════════════════════════════════════════╝"
echo ""

gcloud config set project "${PROJECT_ID}"

# ═══════════════════════════════════════════════════════════════════════════════
# 1. Enable Required APIs
# ═══════════════════════════════════════════════════════════════════════════════

info "Enabling required GCP APIs..."
gcloud services enable compute.googleapis.com
ok "APIs enabled."


# ═══════════════════════════════════════════════════════════════════════════════
# 2. Create VPC Network
# ═══════════════════════════════════════════════════════════════════════════════

info "Creating VPC: ${VPC_NAME}..."
if gcloud compute networks describe "${VPC_NAME}" &>/dev/null; then
  info "VPC ${VPC_NAME} already exists, skipping."
else
  gcloud compute networks create "${VPC_NAME}" \
    --subnet-mode=custom \
    --bgp-routing-mode=regional
  ok "VPC created."
fi

info "Creating subnet: ${SUBNET_NAME} (${SUBNET_RANGE})..."
if gcloud compute networks subnets describe "${SUBNET_NAME}" --region="${REGION}" &>/dev/null; then
  info "Subnet already exists, skipping."
else
  gcloud compute networks subnets create "${SUBNET_NAME}" \
    --network="${VPC_NAME}" \
    --region="${REGION}" \
    --range="${SUBNET_RANGE}" \
    --enable-private-ip-google-access
  ok "Subnet created."
fi


# ═══════════════════════════════════════════════════════════════════════════════
# 3. Firewall Rules (Security-Hardened)
# ═══════════════════════════════════════════════════════════════════════════════

info "Creating firewall rules..."

# SSH — restricted to admin IPs only
gcloud compute firewall-rules create "coats-allow-ssh" \
  --network="${VPC_NAME}" \
  --allow=tcp:22 \
  --source-ranges="${ADMIN_CIDR}" \
  --target-tags="coats-fabric" \
  --description="SSH access restricted to admin IPs" \
  --priority=1000 2>/dev/null || info "Firewall rule coats-allow-ssh already exists."

# Peer gRPC (7051) — restricted to app deployment IPs
gcloud compute firewall-rules create "coats-allow-peer-grpc" \
  --network="${VPC_NAME}" \
  --allow=tcp:7051 \
  --source-ranges="${APP_CIDR}" \
  --target-tags="coats-fabric" \
  --description="Fabric peer gRPC for Next.js app" \
  --priority=1000 2>/dev/null || info "Firewall rule coats-allow-peer-grpc already exists."

# Internal — allow all traffic within VPC (for future multi-VM)
gcloud compute firewall-rules create "coats-allow-internal" \
  --network="${VPC_NAME}" \
  --allow=tcp,udp,icmp \
  --source-ranges="${SUBNET_RANGE}" \
  --target-tags="coats-fabric" \
  --description="Internal communication within CoATS VPC" \
  --priority=1000 2>/dev/null || info "Firewall rule coats-allow-internal already exists."

# DENY all other ingress (explicit, defense in depth)
gcloud compute firewall-rules create "coats-deny-all-ingress" \
  --network="${VPC_NAME}" \
  --action=DENY \
  --rules=all \
  --source-ranges="0.0.0.0/0" \
  --target-tags="coats-fabric" \
  --description="Deny all other ingress traffic" \
  --priority=65534 2>/dev/null || info "Firewall rule coats-deny-all-ingress already exists."

ok "Firewall rules configured."


# ═══════════════════════════════════════════════════════════════════════════════
# 4. Cloud NAT (for outbound internet from private subnet)
# ═══════════════════════════════════════════════════════════════════════════════

info "Setting up Cloud NAT..."
if gcloud compute routers describe "${ROUTER_NAME}" --region="${REGION}" &>/dev/null; then
  info "Router already exists."
else
  gcloud compute routers create "${ROUTER_NAME}" \
    --network="${VPC_NAME}" \
    --region="${REGION}"
fi

gcloud compute routers nats create "${NAT_NAME}" \
  --router="${ROUTER_NAME}" \
  --region="${REGION}" \
  --nat-all-subnet-ip-ranges \
  --auto-allocate-nat-external-ips 2>/dev/null || info "NAT already exists."

ok "Cloud NAT configured."


# ═══════════════════════════════════════════════════════════════════════════════
# 5. Static External IP
# ═══════════════════════════════════════════════════════════════════════════════

info "Reserving static external IP..."
if gcloud compute addresses describe "${STATIC_IP_NAME}" --region="${REGION}" &>/dev/null; then
  info "Static IP already reserved."
else
  gcloud compute addresses create "${STATIC_IP_NAME}" \
    --region="${REGION}" \
    --network-tier=PREMIUM
fi

EXTERNAL_IP=$(gcloud compute addresses describe "${STATIC_IP_NAME}" \
  --region="${REGION}" --format='get(address)')
ok "Static IP: ${EXTERNAL_IP}"


# ═══════════════════════════════════════════════════════════════════════════════
# 6. Create VM Instance
# ═══════════════════════════════════════════════════════════════════════════════

info "Creating VM: ${VM_NAME} (${MACHINE_TYPE})..."
if gcloud compute instances describe "${VM_NAME}" --zone="${ZONE}" &>/dev/null; then
  info "VM already exists."
else
  gcloud compute instances create "${VM_NAME}" \
    --zone="${ZONE}" \
    --machine-type="${MACHINE_TYPE}" \
    --subnet="${SUBNET_NAME}" \
    --network-tier=PREMIUM \
    --address="${EXTERNAL_IP}" \
    --tags="coats-fabric" \
    --image-family=ubuntu-2204-lts \
    --image-project=ubuntu-os-cloud \
    --boot-disk-size="${DISK_SIZE}GB" \
    --boot-disk-type=pd-ssd \
    --shielded-secure-boot \
    --shielded-vtpm \
    --shielded-integrity-monitoring \
    --metadata=enable-oslogin=TRUE \
    --scopes=default,storage-ro
  ok "VM created."
fi

echo ""
echo "  ╔══════════════════════════════════════════════════════════════╗"
echo "  ║   GCP Infrastructure Ready                                  ║"
echo "  ║                                                              ║"
echo "  ║   VM:     ${VM_NAME}"
echo "  ║   IP:     ${EXTERNAL_IP}"
echo "  ║   Zone:   ${ZONE}"
echo "  ║                                                              ║"
echo "  ║   Next Steps:                                                ║"
echo "  ║   1. SSH: gcloud compute ssh ${VM_NAME} --zone=${ZONE}"
echo "  ║   2. Run: provision-vm.sh (on the VM)                       ║"
echo "  ║   3. Run: network.sh up (on the VM)                         ║"
echo "  ╚══════════════════════════════════════════════════════════════╝"
echo ""
