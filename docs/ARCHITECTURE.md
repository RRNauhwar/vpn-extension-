# GlobeVPN Architecture & Technical Feasibility

## 1. Connectivity Architecture Decision

| Option | Feasibility in Pure Chrome MV3 | Scope | Decision |
| :--- | :--- | :--- | :--- |
| WireGuard / OpenVPN (OS VPN) | Not possible without a native companion daemon (Chrome extensions lack raw sockets and TUN/TAP access; `chrome.vpnProvider` is ChromeOS-only) | Full device | Deferred (backend schema remains protocol-extensible) |
| Encrypted HTTPS Proxy (`chrome.proxy` + `webRequestAuthProvider`) | Fully supported in Chrome MV3 | Chrome browser traffic only | **Selected** |

## 2. Core Components

1. **Chrome Extension (`extension/`)**
   - **Service Worker (`src/background/service-worker.ts`):** Handles proxy auth challenges via `chrome.webRequest.onAuthRequired` (`webRequestAuthProvider`), fatal proxy errors via `chrome.proxy.onProxyError`, startup/restart cleanup, and `chrome.alarms` periodic health checks.
   - **Proxy Manager (`src/background/proxy-manager.ts`):** Applies `chrome.proxy.settings` (`fixed_servers`), stores session credentials strictly in RAM-only `chrome.storage.session`, and configures `chrome.privacy.network.webRTCIPHandlingPolicy` (`disable_non_proxied_udp`) and `networkPredictionEnabled` (`false`).
   - **Connection Manager (`src/background/connection-manager.ts`):** Executes a verified 8-step connect flow (capture original IP -> request session -> apply proxy -> verify live public IP -> mark connected) with automatic fail-safe rollback on any error.
   - **Popup & Options UI (`src/popup/`, `src/options/`):** Dark navy (`#0B1020`) + electric blue (`#3B82F6`) + violet (`#7C3AED`) React + Tailwind UI. Displays only real operational servers returned by the backend.

2. **Control Plane Backend (`backend/`)**
   - **FastAPI + Pydantic v2:** Strict input/output validation, structured JSON logging (with secret redaction), and OpenAPI documentation.
   - **PostgreSQL + SQLAlchemy 2.0:** Stores `countries`, `servers`, `users`, `connection_sessions`, and `server_health_logs` (`backend/app/database/schema.sql`).
   - **Redis Rate Limiter:** Sliding-window per-user and per-IP rate limiting with in-memory fallback.
   - **Live Health Monitor:** Periodic real TCP/TLS probes measuring genuine latency and operational availability. Offline nodes are automatically excluded from client listings.

3. **Authorized Exit Node Infrastructure (`infra/proxy-node/`)**
   - Containerized GOST v3 authenticated HTTPS (`http+tls`) proxy for production VPS nodes, plus a local development HTTP CONNECT mode in `docker-compose.yml`.
   - New regions/countries are added via `POST /api/admin/servers` (or `infra/proxy-node/register_node.py`) without modifying or republishing the Chrome extension.
