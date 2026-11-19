# GlobeVPN Control Plane API Documentation

Base URL (local dev): `http://localhost:8000/api`  
Interactive Swagger UI: `http://localhost:8000/docs`

## Authentication

- `POST /api/auth/guest` — Issues a free-tier guest JWT without payment or signup.
  - Body: `{ "device_id": "optional-string" }`
- `POST /api/auth/register` — Creates a free-tier email/password account (bcrypt hashed) and returns a JWT.
  - Body: `{ "email": "user@example.com", "password": "min-8-char-password" }`
- `POST /api/auth/login` — Authenticates an existing account and returns a JWT.

Include `Authorization: Bearer <access_token>` on authenticated endpoints.

## Servers & Health

- `GET /api/servers?country_code=US&operational_only=true`
  - Returns verified operational servers sorted by health status and measured latency.
- `GET /api/servers/countries?operational_only=true`
  - Returns countries that have at least one operational server, with best measured latency and recommended `server_id`.
- `GET /api/servers/{server_id}`
  - Returns detailed status, latency, and load for a single server.
- `GET /api/servers/health?refresh=false`
  - Returns aggregate health counts (`total_registered`, `operational_healthy`, `degraded`, `offline`) and server list. Set `refresh=true` to trigger immediate live TCP/TLS probes.

## Connection Sessions (Authenticated)

- `POST /api/connect/session`
  - Body: `{ "server_id": "optional-id", "country_code": "optional-code" }`
  - Selects a healthy server with available capacity, enforces free-tier fair-use daily session limits, and returns authorized proxy configuration + session expiry.
- `POST /api/disconnect/session`
  - Body: `{ "session_id": "ses_...", "reason": "user_requested" }`
  - Marks the session disconnected and decrements server active connection count.

## User Profile, Usage & IP

- `GET /api/user/profile` (Authenticated) — Returns `user_id`, `email`, `is_guest`, `plan_tier`, `created_at`.
- `GET /api/user/usage` (Authenticated) — Returns daily sessions used/limit, max session duration, rate limit, active session ID, and fair-use policy text.
- `GET /api/user/current-ip` — Returns the real remote IP observed by the backend.

## Admin Infrastructure (Requires `X-Admin-Key` Header)

- `POST /api/admin/servers` — Registers or updates an authorized proxy node and immediately runs a real TCP/TLS health probe.
