# Regional VPS Exit-Node Provisioning Guide

This guide provisions an authorized TLS-encrypted HTTPS proxy exit node on any Ubuntu 22.04/24.04 VPS (DigitalOcean, Hetzner, Vultr, AWS Lightsail, etc.) and registers it with your hosted GlobeVPN control plane.

> **Cost & Provisioning Notice:** No VPS instances have been purchased or provisioned automatically. Provision nodes only in regions you authorize and budget for.

## Prerequisites
- Hosted GlobeVPN control plane deployed (e.g., via `render.yaml` or `fly.toml`) at `https://api.globevpn.example`
- A fresh Ubuntu VPS in the target country (e.g., Frankfurt, Germany) with ports `80` (for Let's Encrypt renewal) and `443` open
- A DNS `A` record pointing `de-fra-01.globevpn.example` to the VPS public IPv4 address

## Step 1: Install Docker & Obtain TLS Certificate
```bash
sudo apt-get update && sudo apt-get install -y docker.io docker-compose-plugin certbot python3
sudo certbot certonly --standalone -d de-fra-01.globevpn.example --non-interactive --agree-tos -m ops@globevpn.example
```

## Step 2: Launch the Authenticated HTTPS Proxy Container
```bash
sudo mkdir -p /opt/globevpn-node
# Copy infra/proxy-node/* and infra/vps/rotate_credentials.py into /opt/globevpn-node
export PROXY_DOMAIN=de-fra-01.globevpn.example
export PROXY_AUTH_USER="gv_de_fra_01"
export PROXY_AUTH_PASS="$(python3 -c 'import secrets; print(secrets.token_urlsafe(24))')"

cat <<EOF | sudo tee /opt/globevpn-node/.env.node > /dev/null
PROXY_DOMAIN=${PROXY_DOMAIN}
PROXY_AUTH_USER=${PROXY_AUTH_USER}
PROXY_AUTH_PASS=${PROXY_AUTH_PASS}
EOF
sudo chmod 600 /opt/globevpn-node/.env.node

cd /opt/globevpn-node
sudo docker compose -f docker-compose.node.yml --env-file .env.node up -d --build
```

## Step 3: Register Node with Hosted Control Plane
```bash
PUBLIC_IP="$(curl -4 -s https://api.ipify.org)"
python3 register_node.py \
  --api-url "https://api.globevpn.example" \
  --admin-key "${ADMIN_API_KEY}" \
  --id "de-fra-01" \
  --country-code "DE" \
  --country-name "Germany" \
  --flag "🇩🇪" \
  --region "Europe" \
  --name "Frankfurt #1" \
  --city "Frankfurt" \
  --hostname "${PROXY_DOMAIN}" \
  --port 443 \
  --scheme https \
  --tier free \
  --auth-user "${PROXY_AUTH_USER}" \
  --auth-pass "${PROXY_AUTH_PASS}"
```
As soon as the control plane's live TLS probe succeeds, **Germany** automatically switches from **Coming soon** to **Available** in every installed GlobeVPN Chrome extension — zero extension rebuild or user action required.

## Step 4: Automate Daily Credential Rotation (Cron)
```bash
# Run daily at 04:00 UTC to rotate proxy credentials and restart the node cleanly
0 4 * * * /usr/bin/python3 /opt/globevpn-node/rotate_credentials.py \
  --api-url https://api.globevpn.example \
  --admin-key "$ADMIN_API_KEY" \
  --server-id de-fra-01 \
  --env-file /opt/globevpn-node/.env.node \
  --restart-compose >> /var/log/globevpn-rotate.log 2>&1
```
