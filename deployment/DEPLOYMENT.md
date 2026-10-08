# CoATS V2 — Production Deployment Guide

## Hyperledger Fabric on Google Cloud Platform

> **Classification**: Government project — Security is the top priority.  
> **Network**: Hyperledger Fabric 2.5 with Raft consensus, TLS everywhere, Fabric CA for identity management.  
> **Target**: Single GCP VM (scalable to multi-VM).

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     GCP VPC (coats-vpc)                         │
│                     Subnet: 10.10.1.0/24                        │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │         GCE VM: coats-fabric-node                        │   │
│  │         Ubuntu 22.04 LTS, e2-standard-4                  │   │
│  │         Shielded VM (Secure Boot + vTPM)                 │   │
│  │                                                          │   │
│  │  ┌─────────────────────────────────────────────────────┐ │   │
│  │  │          Docker Compose Network                     │ │   │
│  │  │                                                     │ │   │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │ │   │
│  │  │  │ Orderer  │  │ Peer0    │  │ CouchDB (State)  │  │ │   │
│  │  │  │ :7050    │  │ :7051    │  │ (internal only)  │  │ │   │
│  │  │  │ Raft     │  │ CoATSMSP │  │                  │  │ │   │
│  │  │  └──────────┘  └────┬─────┘  └──────────────────┘  │ │   │
│  │  │                     │                               │ │   │
│  │  │  ┌──────────┐  ┌───┴────────┐                      │ │   │
│  │  │  │ CA       │  │ CA         │                      │ │   │
│  │  │  │ Orderer  │  │ CoATS Org  │                      │ │   │
│  │  │  │ :7054    │  │ :8054      │                      │ │   │
│  │  │  │ (local)  │  │ (local)    │                      │ │   │
│  │  │  └──────────┘  └────────────┘                      │ │   │
│  │  └─────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────┘   │
│                          │                                      │
│                   GCP Firewall                                  │
│              SSH(:22) → admin IPs only                          │
│             gRPC(:7051) → app IPs only                          │
│              All other ingress → DENY                           │
└─────────────────────────────────────────────────────────────────┘
                           │
                    TLS (gRPC-S)
                           │
                ┌──────────┴──────────┐
                │   Next.js App       │
                │   (Vercel / VM)     │
                │   src/lib/fabric.ts │
                └─────────────────────┘
```

### Security Measures

| Layer | Measure | Details |
|-------|---------|---------|
| Network | GCP VPC + Firewall | Private subnet, restricted ingress |
| Network | Cloud NAT | No direct inbound except allowed ports |
| Network | UFW (host) | Defense-in-depth firewall on VM |
| Transport | TLS 1.2+ | All Fabric components use mutual TLS |
| Identity | Fabric CA | X.509 certificate-based identity |
| Identity | NodeOUs | Fine-grained role identification |
| Data | SHA-256 fingerprints | No PII stored on blockchain |
| VM | Shielded VM | Secure Boot + vTPM + Integrity Monitoring |
| VM | OS Login | GCP IAM-based SSH (no static keys on VM) |
| VM | fail2ban | SSH brute-force protection |
| VM | Unattended upgrades | Auto security patches |
| Access | SSH restrictions | Key-only auth, root disabled |
| CouchDB | Auth required | Username/password, not exposed externally |

---

## Prerequisites

### On Your Windows Machine

1. **WSL 2** (Ubuntu):
   ```powershell
   wsl --install -d Ubuntu-22.04
   ```

2. **Google Cloud CLI** (in WSL):
   ```bash
   curl https://sdk.cloud.google.com | bash
   exec -l $SHELL
   gcloud init
   gcloud auth login
   ```

3. **GCP Project**:
   - Create a project at https://console.cloud.google.com
   - Enable billing
   - Enable Compute Engine API:
     ```bash
     gcloud services enable compute.googleapis.com
     ```

---

## Step-by-Step Deployment

### Phase 1: GCP Infrastructure

Run from WSL on your Windows machine:

```bash
cd /mnt/c/Vivek\'s\ Workspace/Projects/CoATS\ V2

# Set your GCP project and admin IP
export GCP_PROJECT_ID="your-gcp-project-id"
export ADMIN_SSH_CIDR="$(curl -s ifconfig.me)/32"  # Your public IP
export APP_GRPC_CIDR="0.0.0.0/0"  # Restrict later to your app's IP

# Create GCP infrastructure
chmod +x deployment/gcp/setup-infrastructure.sh
bash deployment/gcp/setup-infrastructure.sh
```

This creates:
- VPC network with private subnet
- Security-hardened firewall rules
- Cloud NAT for outbound internet
- Static external IP
- Ubuntu 22.04 GCE VM with Shielded VM features

### Phase 2: VM Provisioning

```bash
# SSH into the VM
gcloud compute ssh coats-fabric-node --zone=asia-south1-a

# Upload provisioning script
gcloud compute scp deployment/gcp/provision-vm.sh \
  coats-fabric-node:/tmp/provision-vm.sh --zone=asia-south1-a

# On the VM:
sudo bash /tmp/provision-vm.sh
```

This installs:
- Docker Engine + Compose V2
- Hyperledger Fabric 2.5.12 binaries
- Fabric CA 1.5.13 binaries
- Node.js 20 LTS
- System hardening (UFW, fail2ban, SSH hardening)

**Important**: Log out and back in after provisioning (for Docker group):
```bash
exit
gcloud compute ssh coats-fabric-node --zone=asia-south1-a
```

### Phase 3: Deploy Fabric Network

```bash
# Upload the fabric-network directory to the VM
gcloud compute scp --recurse fabric-network/ \
  coats-fabric-node:/opt/coats-fabric/fabric-network --zone=asia-south1-a

# Also upload the chaincode
gcloud compute scp --recurse chaincode/ \
  coats-fabric-node:/opt/coats-fabric/chaincode --zone=asia-south1-a

# SSH into VM
gcloud compute ssh coats-fabric-node --zone=asia-south1-a

# Navigate to fabric network directory
cd /opt/coats-fabric/fabric-network

# Configure environment
cp .env.example .env
nano .env  # Set EXTERNAL_HOST to VM's external IP
```

**Critical**: Set `EXTERNAL_HOST` in `.env` to the VM's external IP:
```bash
# Get the VM's external IP
curl -s ifconfig.me
# Set it in .env
sed -i "s|EXTERNAL_HOST=.*|EXTERNAL_HOST=\"$(curl -s ifconfig.me)\"|" .env
```

### Phase 4: Start the Network

```bash
# Make scripts executable
chmod +x scripts/*.sh

# Start the entire Fabric network
bash scripts/network.sh up
```

This single command:
1. Generates strong random passwords for all components
2. Starts Fabric Certificate Authorities
3. Enrolls all identities (orderer, peer, admin, client)
4. Starts orderer, peer, and CouchDB
5. Creates the `coats-channel` application channel
6. Deploys and initializes the CoATS chaincode

### Phase 5: Export Certificates for Next.js App

```bash
# Export as PEM files (for local development)
bash scripts/network.sh export --files

# Export as base64 (for Vercel environment variables)
bash scripts/network.sh export --base64
```

Copy the output and add to your Next.js app's environment:

**For local development** (`.env`):
```env
FABRIC_PEER_ENDPOINT="<VM_EXTERNAL_IP>:7051"
FABRIC_PEER_HOSTNAME="peer0.coats.gov.in"
FABRIC_CHANNEL="coats-channel"
FABRIC_CHAINCODE="coats-chaincode"
FABRIC_MSP_ID="CoATSMSP"
FABRIC_TLS_CERT_PATH="./fabric-certs/tls-ca.crt"
FABRIC_CERT_PATH="./fabric-certs/admin-cert.pem"
FABRIC_KEY_PATH="./fabric-certs/admin-key.pem"
```

**For Vercel** (Environment Variables):
```env
FABRIC_PEER_ENDPOINT="<VM_EXTERNAL_IP>:7051"
FABRIC_PEER_HOSTNAME="peer0.coats.gov.in"
FABRIC_CHANNEL="coats-channel"
FABRIC_CHAINCODE="coats-chaincode"
FABRIC_MSP_ID="CoATSMSP"
FABRIC_TLS_CERT_B64="<base64-value>"
FABRIC_CERT_B64="<base64-value>"
FABRIC_KEY_B64="<base64-value>"
```

---

## Operational Commands

### Network Management

```bash
cd /opt/coats-fabric/fabric-network

# Check status
bash scripts/network.sh status

# Restart (preserves crypto, ledger data)
bash scripts/network.sh restart

# Full teardown (WARNING: deletes all data)
bash scripts/network.sh down

# Start fresh
bash scripts/network.sh up
```

### Chaincode Upgrade

When you update `chaincode/coats-chaincode/index.js`:

```bash
# Upload new chaincode
gcloud compute scp --recurse chaincode/ \
  coats-fabric-node:/opt/coats-fabric/chaincode --zone=asia-south1-a

# SSH into VM
gcloud compute ssh coats-fabric-node --zone=asia-south1-a
cd /opt/coats-fabric/fabric-network

# Update .env: increment CHAINCODE_VERSION and CHAINCODE_SEQUENCE
nano .env

# Deploy new version
bash scripts/network.sh deploy
```

### Monitoring

```bash
# View container logs
docker logs -f peer0.coats.gov.in --tail 100
docker logs -f orderer.coats.gov.in --tail 100

# Prometheus metrics (from VM)
curl -s localhost:9444/metrics  # Peer metrics
curl -s localhost:9443/metrics  # Orderer metrics

# Disk usage
docker system df
df -h /var/lib/docker
```

---

## Backup & Recovery

### What to Back Up

| Item | Location | How |
|------|----------|-----|
| Crypto material | `organizations/` | `tar czf crypto-backup.tar.gz organizations/` |
| Channel artifacts | `channel-artifacts/` | `tar czf channel-backup.tar.gz channel-artifacts/` |
| Ledger data | Docker volumes | `docker run --rm -v orderer.coats.gov.in:/data -v $(pwd):/backup alpine tar czf /backup/orderer-ledger.tar.gz /data` |
| CouchDB data | Docker volumes | `docker run --rm -v couchdb0.data:/data -v $(pwd):/backup alpine tar czf /backup/couchdb-backup.tar.gz /data` |
| .env file | `fabric-network/.env` | Copy securely |

### Automated Backup Script

```bash
#!/bin/bash
BACKUP_DIR="/opt/coats-fabric/backups/$(date +%Y%m%d)"
mkdir -p "${BACKUP_DIR}"
cd /opt/coats-fabric/fabric-network

tar czf "${BACKUP_DIR}/crypto.tar.gz" organizations/ channel-artifacts/
cp .env "${BACKUP_DIR}/.env.backup"

# Ledger backups
for vol in orderer.coats.gov.in peer0.coats.gov.in couchdb0.data; do
  docker run --rm -v "${vol}:/data" -v "${BACKUP_DIR}:/backup" \
    alpine tar czf "/backup/${vol}.tar.gz" /data
done

echo "Backup complete: ${BACKUP_DIR}"
```

---

## Troubleshooting

### Common Issues

**1. "Fabric CA TLS cert not found"**
- CA container hasn't started yet. Check: `docker logs ca.orderer.coats.gov.in`
- Ensure the `organizations/fabric-ca/` directory is writable.

**2. "Peer failed to join channel"**
- Orderer needs time after joining. The script retries automatically.
- Check: `docker logs orderer.coats.gov.in --tail 50`

**3. "Chaincode install timeout"**
- Node.js chaincode takes time to build. Be patient (up to 5 minutes).
- Check: `docker logs peer0.coats.gov.in --tail 100`

**4. "gRPC connection refused from Next.js app"**
- Verify GCP firewall allows port 7051 from your app's IP.
- Verify TLS hostname: `FABRIC_PEER_HOSTNAME` must match the cert's SAN.
- Test connectivity: `openssl s_client -connect <VM_IP>:7051`

**5. "Permission denied: /var/run/docker.sock"**
- Add user to docker group: `sudo usermod -aG docker $USER`
- Log out and back in.

---

## Security Checklist

Before going live, verify:

- [ ] All passwords in `.env` are auto-generated (no defaults)
- [ ] `EXTERNAL_HOST` is set to the VM's real IP
- [ ] GCP firewall `ADMIN_SSH_CIDR` is restricted to your admin IPs
- [ ] GCP firewall `APP_GRPC_CIDR` is restricted to your Next.js app's IPs
- [ ] SSH: Root login disabled, password auth disabled
- [ ] CouchDB port (5984) is NOT exposed externally
- [ ] CA ports (7054, 8054) are bound to localhost only
- [ ] Orderer admin port (7053) is bound to localhost only
- [ ] TLS is enabled on all Fabric components
- [ ] `.env` file is NOT committed to Git
- [ ] `organizations/` directory is NOT committed to Git
- [ ] VM has unattended security upgrades enabled
- [ ] fail2ban is running: `sudo systemctl status fail2ban`
- [ ] Backups are configured and tested
- [ ] Prometheus metrics are being collected (if monitoring is set up)
