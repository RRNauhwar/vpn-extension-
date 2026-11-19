from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient


def test_system_health(client: TestClient):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_no_fabricated_servers_and_honest_coming_soon_countries(client: TestClient):
    """Strict rule: zero operational servers by default; planned countries report coming_soon."""
    servers_resp = client.get("/api/servers")
    assert servers_resp.status_code == 200
    assert servers_resp.json() == []

    # operational_only=true returns []
    op_countries = client.get("/api/servers/countries?operational_only=true")
    assert op_countries.status_code == 200
    assert op_countries.json() == []

    # Default dynamic country registry shows planned countries as coming_soon with null endpoints
    all_countries = client.get("/api/servers/countries")
    assert all_countries.status_code == 200
    data = all_countries.json()
    assert len(data) >= 10
    assert all(c["availability_status"] == "coming_soon" for c in data)
    assert all(c["actual_server_id"] is None for c in data)
    assert all(c["server_endpoint"] is None for c in data)


def test_guest_and_account_auth_flows(client: TestClient):
    guest_resp = client.post("/api/auth/guest", json={"device_id": "device-abc-123"})
    assert guest_resp.status_code == 201
    guest_data = guest_resp.json()
    assert guest_data["is_guest"] is True
    assert guest_data["plan_tier"] == "free"
    assert guest_data["access_token"]

    headers = {"Authorization": f"Bearer {guest_data['access_token']}"}
    prof = client.get("/api/user/profile", headers=headers)
    assert prof.status_code == 200
    assert prof.json()["is_guest"] is True

    usage = client.get("/api/user/usage", headers=headers)
    assert usage.status_code == 200
    assert usage.json()["daily_sessions_used"] == 0

    reg = client.post(
        "/api/auth/register",
        json={"email": "alice@example.com", "password": "StrongPassword123!"},
    )
    assert reg.status_code == 201
    assert reg.json()["email"] == "alice@example.com"
    assert reg.json()["is_guest"] is False

    dup = client.post(
        "/api/auth/register",
        json={"email": "alice@example.com", "password": "StrongPassword123!"},
    )
    assert dup.status_code == 409

    login_ok = client.post(
        "/api/auth/login",
        json={"email": "alice@example.com", "password": "StrongPassword123!"},
    )
    assert login_ok.status_code == 200
    login_bad = client.post(
        "/api/auth/login",
        json={"email": "alice@example.com", "password": "wrong-password"},
    )
    assert login_bad.status_code == 401


def test_admin_registration_rotation_heartbeat_and_session_lifecycle(client: TestClient):
    unauth = client.post("/api/admin/servers", json={})
    assert unauth.status_code == 403

    # Register an unreachable server -> country becomes "unavailable"
    with patch(
        "app.services.health_monitor.probe_server",
        new=AsyncMock(return_value=("offline", None, "Connection refused")),
    ):
        dead_resp = client.post(
            "/api/admin/servers",
            headers={"X-Admin-Key": "test-admin-key"},
            json={
                "id": "dead-node-01",
                "country_code": "ZZ",
                "country_name": "Offline Test",
                "flag_emoji": "🧪",
                "region": "Test",
                "name": "Offline Node",
                "city": "Nowhere",
                "hostname": "127.0.0.1",
                "port": 1,
                "scheme": "http",
                "tier": "free",
            },
        )
    assert dead_resp.status_code == 201
    assert dead_resp.json()["is_operational"] is False

    # Register a live HTTPS exit node with public_exit_ip -> country becomes "available"
    with patch(
        "app.services.health_monitor.probe_server",
        new=AsyncMock(return_value=("healthy", 24, None)),
    ):
        live_resp = client.post(
            "/api/admin/servers",
            headers={"X-Admin-Key": "test-admin-key"},
            json={
                "id": "us-nyc-01",
                "country_code": "US",
                "country_name": "United States",
                "flag_emoji": "🇺🇸",
                "region": "North America",
                "name": "New York #1",
                "city": "New York",
                "hostname": "us-nyc-01.globevpn.example",
                "port": 443,
                "scheme": "https",
                "public_exit_ip": "198.51.100.42",
                "tier": "free",
                "auth_username": "proxyuser",
                "auth_password": "proxypass_initial_secret",
            },
        )
    assert live_resp.status_code == 201
    assert live_resp.json()["is_operational"] is True
    assert live_resp.json()["latency_ms"] == 24

    # Verify dynamic country registry states
    countries = {c["code"]: c for c in client.get("/api/servers/countries").json()}
    assert countries["US"]["availability_status"] == "available"
    assert countries["US"]["actual_server_id"] == "us-nyc-01"
    assert countries["US"]["server_endpoint"] == "us-nyc-01.globevpn.example:443"
    assert countries["US"]["supported_protocol"] == "https_proxy"
    assert countries["US"]["public_exit_ip"] == "198.51.100.42"
    assert countries["ZZ"]["availability_status"] == "unavailable"
    assert countries["DE"]["availability_status"] == "coming_soon"

    # Rotate credentials via admin API
    rot = client.post(
        "/api/admin/servers/us-nyc-01/rotate-credentials",
        headers={"X-Admin-Key": "test-admin-key"},
        json={},
    )
    assert rot.status_code == 200
    rotated = rot.json()
    assert rotated["username"] != "proxyuser"
    assert len(rotated["password"]) >= 16

    # Node heartbeat updates active connections and exit IP
    with patch(
        "app.services.health_monitor.probe_server",
        new=AsyncMock(return_value=("healthy", 19, None)),
    ):
        hb = client.post(
            "/api/admin/servers/us-nyc-01/heartbeat",
            headers={"X-Admin-Key": "test-admin-key"},
            json={"active_connections": 7, "public_exit_ip": "198.51.100.42"},
        )
    assert hb.status_code == 200
    assert hb.json()["latency_ms"] == 19

    # Connect session delivers rotated credentials + expected_exit_ip
    guest = client.post("/api/auth/guest", json={}).json()
    headers = {"Authorization": f"Bearer {guest['access_token']}"}
    conn = client.post(
        "/api/connect/session",
        headers=headers,
        json={"country_code": "US"},
    )
    assert conn.status_code == 200
    conn_data = conn.json()
    assert conn_data["protection_scope"] == "browser_proxy_only"
    assert conn_data["expected_exit_ip"] == "198.51.100.42"
    assert conn_data["proxy"]["username"] == rotated["username"]
    assert conn_data["proxy"]["password"] == rotated["password"]

    # Disconnect session cleanly
    disc = client.post(
        "/api/disconnect/session",
        headers=headers,
        json={"session_id": conn_data["session_id"], "reason": "user_clicked_disconnect"},
    )
    assert disc.status_code == 200
    assert disc.json()["status"] == "disconnected"
