from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, EmailStr, Field


# --- Auth ---

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class GuestAuthRequest(BaseModel):
    device_id: Optional[str] = Field(default=None, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user_id: str
    email: Optional[str] = None
    is_guest: bool
    plan_tier: str


# --- Servers & Dynamic Country Registry ---

class ServerSummary(BaseModel):
    id: str
    name: str
    country_code: str
    country_name: str
    flag_emoji: str
    city: str
    hostname: str
    port: int
    scheme: str
    protocol_type: str
    public_exit_ip: Optional[str] = None
    tier: str
    status: str
    is_operational: bool
    latency_ms: Optional[int] = None
    load_percent: int
    last_health_check_at: Optional[datetime] = None


class CountrySummary(BaseModel):
    code: str
    name: str
    flag_emoji: str
    region: str
    availability_status: Literal["available", "unavailable", "coming_soon"]
    health_status: Literal["healthy", "degraded", "offline", "unprovisioned"]
    operational_server_count: int
    actual_server_id: Optional[str] = None
    server_endpoint: Optional[str] = None
    supported_protocol: Optional[str] = None
    public_exit_ip: Optional[str] = None
    best_latency_ms: Optional[int] = None
    recommended_server_id: Optional[str] = None


class ServerHealthSummary(BaseModel):
    total_registered: int
    operational_healthy: int
    degraded: int
    offline: int
    checked_at: datetime
    servers: List[ServerSummary]


class RegisterServerRequest(BaseModel):
    id: str = Field(min_length=2, max_length=64, pattern=r"^[a-zA-Z0-9_-]+$")
    country_code: str = Field(min_length=2, max_length=10)
    country_name: str = Field(min_length=2, max_length=100)
    flag_emoji: str = Field(default="", max_length=16)
    region: str = Field(default="Global", max_length=64)
    name: str = Field(min_length=2, max_length=120)
    city: str = Field(min_length=2, max_length=100)
    hostname: str = Field(min_length=2, max_length=255)
    port: int = Field(ge=1, le=65535)
    scheme: Literal["https", "http", "socks5"] = "https"
    public_exit_ip: Optional[str] = None
    tier: Literal["free", "pro"] = "free"
    max_connections: int = Field(default=250, ge=1, le=50000)
    auth_username: Optional[str] = None
    auth_password: Optional[str] = None


class RotateCredentialsRequest(BaseModel):
    new_username: Optional[str] = Field(default=None, min_length=4, max_length=128)
    new_password: Optional[str] = Field(default=None, min_length=16, max_length=255)


class RotateCredentialsResponse(BaseModel):
    server_id: str
    username: str
    password: str
    rotated_at: datetime


class NodeHeartbeatRequest(BaseModel):
    active_connections: int = Field(ge=0, le=100000)
    public_exit_ip: Optional[str] = None
    status: Optional[Literal["healthy", "degraded", "maintenance"]] = None


# --- Connection Sessions ---

class ConnectSessionRequest(BaseModel):
    server_id: Optional[str] = None
    country_code: Optional[str] = None


class ProxyConfigPayload(BaseModel):
    scheme: str
    host: str
    port: int
    username: Optional[str] = None
    password: Optional[str] = None
    bypass_list: List[str]
    encryption_note: str


class ConnectSessionResponse(BaseModel):
    session_id: str
    server: ServerSummary
    proxy: ProxyConfigPayload
    expected_exit_ip: Optional[str] = None
    expires_at: datetime
    max_session_minutes: int
    protection_scope: str = "browser_proxy_only"


class DisconnectSessionRequest(BaseModel):
    session_id: str
    reason: Optional[str] = Field(default="user_requested", max_length=128)


class DisconnectSessionResponse(BaseModel):
    session_id: str
    status: str
    ended_at: datetime


# --- User Profile, Usage & IP ---

class UserProfileResponse(BaseModel):
    user_id: str
    email: Optional[str] = None
    is_guest: bool
    plan_tier: str
    created_at: datetime


class UserUsageResponse(BaseModel):
    plan_tier: str
    daily_sessions_used: int
    daily_sessions_limit: int
    max_session_minutes: int
    rate_limit_per_minute: int
    active_session_id: Optional[str] = None
    fair_use_policy: str


class CurrentIpResponse(BaseModel):
    ip: str
    source: str
    checked_at: datetime
