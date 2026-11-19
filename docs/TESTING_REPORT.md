# GlobeVPN Testing & Verification Report

This report records only tests that were **actually executed** in this environment, and explicitly separates live browser/infrastructure leak checks that must be executed once Docker or remote VPS exit nodes are running.

---

## 1. Executed Automated Tests (PASSED)

### A. Backend API & Session Lifecycle (`pytest`)
- **Command:** `cd backend && .venv/bin/pytest -v`
- **Runtime:** Python 3.11.0, pytest 8.4.2
- **Result:** **4 passed, 0 failed (0.61s)**

| Test Case | Status | Verified Behavior |
| :--- | :--- | :--- |
| `test_system_health` | **PASSED** | `GET /health` returns HTTP 200 `{status: "ok"}`. |
| `test_no_fabricated_servers_by_default` | **PASSED** | `GET /api/servers` and `GET /api/servers/countries` return `[]` when no real nodes are registered. |
| `test_guest_and_account_auth_flows` | **PASSED** | Guest JWT issuance, `/api/user/profile`, `/api/user/usage`, account registration, duplicate email `409`, valid login `200`, and invalid password `401`. |
| `test_admin_registration_health_probe_and_session_lifecycle` | **PASSED** | `403` without `X-Admin-Key`, offline node hidden from operational listings, healthy node surfaced with latency, `POST /api/connect/session` returns `browser_proxy_only` + authorized credentials, `POST /api/disconnect/session` cleans up active count, and `GET /api/user/current-ip` returns observed IP. |

### B. Chrome Extension Unit & Build Verification (`vitest`, `tsc`, `vite`)
- **Commands:** `cd extension && npm test && npm run build`
- **Runtime:** Node.js v22.18.0, TypeScript 5.6.3, Vitest 2.1.9, Vite 5.4.21
- **Result:** **4 passed, 0 failed (Vitest); 0 errors (`tsc --noEmit`); clean MV3 bundle in `extension/dist/` (948ms)**

| Test Case / Check | Status | Verified Behavior |
| :--- | :--- | :--- |
| `rejects invalid proxy schemes or ports` | **PASSED** | Blocks unsupported schemes (e.g., `ftp`) and out-of-range ports (`> 65535`). |
| `validates API URLs (HTTPS or localhost only)` | **PASSED** | Permits `https://` and `http://localhost`, rejects insecure remote `http://` endpoints. |
| `applies HTTPS proxy configuration and stores credentials in RAM-only session storage` | **PASSED** | Calls `chrome.storage.session.set` (never `localStorage`) and `chrome.proxy.settings.set` with `fixed_servers` + `scheme: "https"`. |
| `clears proxy settings and wipes session credentials on disconnect` | **PASSED** | Calls `chrome.storage.session.remove` and `chrome.proxy.settings.clear`. |
| `tsc --noEmit && vite build` | **PASSED** | Emits `dist/manifest.json`, `dist/service-worker.js`, `dist/index.html`, `dist/options.html`, `dist/assets/*`, and `dist/icons/icon{16,32,48,128}.png`. |

---

## 2. Live Browser, Infrastructure & Privacy Leak Checks (NOT YET EXECUTED)

Docker is not installed in this local environment and remote VPS exit nodes have not been provisioned yet. Execute each check below once you run `docker compose up --build` (or deploy a production TLS VPS node) and load `extension/dist` in Chrome:

| Check | Status | Verification Procedure |
| :--- | :--- | :--- |
| Extension installation & permissions audit | Pending live Chrome | Load `extension/dist` at `chrome://extensions` (Developer mode); verify zero manifest warnings. |
| Real proxy auth (`onAuthRequired`) & IP change | Pending live proxy | Connect to a remote VPS TLS node; confirm Original IP differs from verified Current IP and matches the VPS exit IP. |
| WebRTC leak test | Pending live Chrome | While connected, open `https://browserleaks.com/webrtc` and confirm no local/ISP IP is exposed and `WebRTC: protected` is shown in popup. |
| DNS & IPv6 leak test | Pending live VPS | Open `https://ipleak.net` and `https://dnsleaktest.com`; confirm DNS resolvers match the proxy exit region and check whether OS IPv6 leaks outside the proxy. |
| QUIC / proxy bypass audit | Pending live VPS | Inspect `chrome://net-export` while connected to verify target sites route through the configured `https` proxy and only loopback entries appear in `bypassList`. |
| Service worker suspension & browser restart | Pending live Chrome | Let the MV3 service worker go idle (`chrome://serviceworker-internals`), verify proxy stays active, then restart Chrome and verify clean rollback (or auto-connect if enabled). |
| Credential exposure check | Pending live Chrome | Inspect DevTools Application -> Local Storage & `chrome.storage.local`; confirm proxy password never appears on disk (only in `chrome.storage.session` while connected). |
