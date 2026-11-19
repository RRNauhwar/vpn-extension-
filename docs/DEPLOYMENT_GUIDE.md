# GlobeVPN Production Deployment Guide

## 1. Deploy the Control Plane (Backend)

1. Provision a Linux VM or managed container platform (e.g., AWS ECS, Render, Fly.io, DigitalOcean) with HTTPS termination (Caddy, Nginx, or cloud load balancer) at a domain such as `https://api.globevpn.example`.
2. Provision managed PostgreSQL 16 and Redis 7.
3. Set production environment variables (see `.env.example`):
   - `APP_ENV=production`
   - `JWT_SECRET_KEY` (64+ bytes random)
   - `ADMIN_API_KEY` (64+ bytes random)
   - `DATABASE_URL` (PostgreSQL TLS connection string)
   - `REDIS_URL` (Redis connection string)
   - `CORS_ORIGINS=chrome-extension://<YOUR_PUBLISHED_EXTENSION_ID>`
   - `LOCAL_PROXY_ENABLED=false`
4. Apply `backend/app/database/schema.sql` and run the `backend/Dockerfile` container.

## 2. Provision Authorized Multi-Region TLS Exit Nodes

For each country you wish to support (e.g., US, UK, Germany, Singapore, Japan):

1. Provision a VPS in that region with a dedicated DNS A/AAAA record (e.g., `de-fra-01.globevpn.example`).
2. Obtain a valid TLS certificate via Let's Encrypt (`certbot certonly --standalone -d de-fra-01.globevpn.example`).
3. Copy `infra/proxy-node/` to the VPS and start the authenticated HTTPS proxy:
   ```bash
   export PROXY_DOMAIN=de-fra-01.globevpn.example
   export PROXY_AUTH_USER=node_de_fra_01
   export PROXY_AUTH_PASS="<strong-random-password>"
   docker compose -f docker-compose.node.yml up -d --build
   ```
4. Register the node with your control plane (the backend immediately probes TLS reachability and measures latency):
   ```bash
   python3 infra/proxy-node/register_node.py \
     --api-url https://api.globevpn.example \
     --admin-key "$ADMIN_API_KEY" \
     --id de-fra-01 \
     --country-code DE \
     --country-name Germany \
     --flag "🇩🇪" \
     --region Europe \
     --name "Frankfurt #1" \
     --city Frankfurt \
     --hostname de-fra-01.globevpn.example \
     --port 443 \
     --scheme https \
     --tier free \
     --auth-user "$PROXY_AUTH_USER" \
     --auth-pass "$PROXY_AUTH_PASS"
   ```
   The country and server will appear automatically in all installed Chrome extensions with zero extension code changes.

## 3. Build & Publish to the Chrome Web Store

1. Update `extension/src/config/branding.ts` `defaultApiBaseUrl` to your production HTTPS API URL (`https://api.globevpn.example/api`).
2. Build the production bundle:
   ```bash
   cd extension
   npm ci
   npm test
   npm run build
   ```
3. Zip the contents of `extension/dist/` (`cd dist && zip -r ../globevpn-mv3.zip .`).
4. In the Chrome Web Store Developer Dashboard:
   - Upload `globevpn-mv3.zip`.
   - Justify each permission (`proxy`, `privacy`, `webRequest`, `webRequestAuthProvider`, `storage`, `alarms`, `notifications`, `<all_urls>`) accurately as browser-level proxy routing and proxy authentication.
   - Publish a clear privacy policy matching `docs/SECURITY_AND_LIMITATIONS.md`.
