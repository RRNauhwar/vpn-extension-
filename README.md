# GlobeVPN — Encrypted Browser Proxy for Chrome (Manifest V3)

GlobeVPN is a production-ready Chrome Manifest V3 browser proxy extension paired with a FastAPI + PostgreSQL + Redis control plane and an authorized TLS proxy exit-node deployment kit.

> **Scope Transparency:** GlobeVPN provides **browser-level encrypted proxy protection** for Chrome HTTP/HTTPS/FTP traffic via Chrome's `proxy` and `privacy` APIs. It is **not** a full-device OS-level VPN and does not tunnel non-browser desktop applications.

## Repository Layout

- `extension/` — Chrome Manifest V3 extension (TypeScript, React 18, Vite, Tailwind CSS)
- `backend/` — FastAPI control plane (PostgreSQL/SQLAlchemy, Redis rate limiting, JWT + guest auth, live TCP/TLS health probing)
- `infra/proxy-node/` — Authorized GOST TLS proxy exit node Docker kit + CLI registration script
- `docker-compose.yml` — Full local stack (PostgreSQL, Redis, FastAPI backend, and a real local authenticated proxy container)
- `docs/` — Architecture, API reference, security/leak limitations, testing report, and production deployment guide

## Quick Start (Local Development)

### 1. Configure Environment
```bash
cp .env.example .env
# Edit .env and replace placeholder secrets before running
```

### 2. Start the Control Plane & Local Proxy Node
With Docker:
```bash
docker compose up --build
```
Or run the FastAPI backend directly (SQLite dev fallback):
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
API docs are available at `http://localhost:8000/docs`.

### 3. Build & Load the Chrome Extension
```bash
cd extension
npm install
npm run build
```
1. Open `chrome://extensions` in Google Chrome.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select `extension/dist`.
4. Pin **GlobeVPN** to the Chrome toolbar, complete onboarding, and connect to any operational node.

## Documentation

- [Architecture & Feasibility](docs/ARCHITECTURE.md)
- [API Documentation](docs/API_DOCUMENTATION.md)
- [Security & Limitations](docs/SECURITY_AND_LIMITATIONS.md)
- [Production Deployment Guide](docs/DEPLOYMENT_GUIDE.md)
- [Testing Report](docs/TESTING_REPORT.md)
