-- GlobeVPN PostgreSQL Database Schema
-- Designed for multi-region authorized proxy infrastructure, free/pro tiers,
-- and future protocol extensibility (https_proxy, socks5, wireguard).

CREATE TABLE IF NOT EXISTS countries (
    id SERIAL PRIMARY KEY,
    code VARCHAR(10) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    flag_emoji VARCHAR(16) NOT NULL DEFAULT '',
    region VARCHAR(64) NOT NULL DEFAULT 'Global',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS servers (
    id VARCHAR(64) PRIMARY KEY,
    country_id INTEGER NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    city VARCHAR(100) NOT NULL,
    hostname VARCHAR(255) NOT NULL,
    port INTEGER NOT NULL DEFAULT 443,
    scheme VARCHAR(16) NOT NULL DEFAULT 'https', -- https | http | socks5
    protocol_type VARCHAR(32) NOT NULL DEFAULT 'browser_proxy', -- browser_proxy | wireguard
    public_exit_ip VARCHAR(64),
    tier VARCHAR(16) NOT NULL DEFAULT 'free', -- free | pro
    status VARCHAR(24) NOT NULL DEFAULT 'unknown', -- healthy | degraded | offline | maintenance | unknown
    is_operational BOOLEAN NOT NULL DEFAULT FALSE,
    latency_ms INTEGER,
    active_connections INTEGER NOT NULL DEFAULT 0,
    max_connections INTEGER NOT NULL DEFAULT 250,
    auth_username_env VARCHAR(128),
    auth_password_env VARCHAR(128),
    auth_username_direct VARCHAR(128),
    auth_password_direct VARCHAR(255),
    last_health_check_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_servers_country_status
    ON servers(country_id, status, is_operational);

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255),
    is_guest BOOLEAN NOT NULL DEFAULT TRUE,
    device_fingerprint_hash VARCHAR(64),
    plan_tier VARCHAR(16) NOT NULL DEFAULT 'free', -- free | pro
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    daily_sessions_used INTEGER NOT NULL DEFAULT 0,
    daily_reset_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS connection_sessions (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    server_id VARCHAR(64) NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    status VARCHAR(24) NOT NULL DEFAULT 'active', -- active | disconnected | expired | failed
    client_ip_hash VARCHAR(64),
    proxy_scheme VARCHAR(16) NOT NULL DEFAULT 'https',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    disconnect_reason VARCHAR(128)
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_status
    ON connection_sessions(user_id, status);

CREATE TABLE IF NOT EXISTS server_health_logs (
    id SERIAL PRIMARY KEY,
    server_id VARCHAR(64) NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    status VARCHAR(24) NOT NULL,
    latency_ms INTEGER,
    error_message VARCHAR(255),
    checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_health_logs_server_time
    ON server_health_logs(server_id, checked_at DESC);
