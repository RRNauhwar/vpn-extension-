from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Country(Base):
    __tablename__ = "countries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(10), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    flag_emoji: Mapped[str] = mapped_column(String(16), default="", nullable=False)
    region: Mapped[str] = mapped_column(String(64), default="Global", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    servers: Mapped[List["Server"]] = relationship(
        "Server", back_populates="country", cascade="all, delete-orphan"
    )


class Server(Base):
    __tablename__ = "servers"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    country_id: Mapped[int] = mapped_column(ForeignKey("countries.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    city: Mapped[str] = mapped_column(String(100), nullable=False)
    hostname: Mapped[str] = mapped_column(String(255), nullable=False)
    port: Mapped[int] = mapped_column(Integer, default=443, nullable=False)
    scheme: Mapped[str] = mapped_column(String(16), default="https", nullable=False)
    protocol_type: Mapped[str] = mapped_column(String(32), default="browser_proxy", nullable=False)
    public_exit_ip: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    tier: Mapped[str] = mapped_column(String(16), default="free", nullable=False)
    status: Mapped[str] = mapped_column(String(24), default="unknown", nullable=False, index=True)
    is_operational: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    latency_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    active_connections: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_connections: Mapped[int] = mapped_column(Integer, default=250, nullable=False)
    auth_username_env: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    auth_password_env: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    auth_username_direct: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    auth_password_direct: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    last_health_check_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    country: Mapped["Country"] = relationship("Country", back_populates="servers")
    sessions: Mapped[List["ConnectionSession"]] = relationship("ConnectionSession", back_populates="server")
    health_logs: Mapped[List["ServerHealthLog"]] = relationship(
        "ServerHealthLog", back_populates="server", cascade="all, delete-orphan"
    )


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), unique=True, index=True, nullable=True)
    password_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_guest: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    device_fingerprint_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    plan_tier: Mapped[str] = mapped_column(String(16), default="free", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    daily_sessions_used: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    daily_reset_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    sessions: Mapped[List["ConnectionSession"]] = relationship("ConnectionSession", back_populates="user")


class ConnectionSession(Base):
    __tablename__ = "connection_sessions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    server_id: Mapped[str] = mapped_column(ForeignKey("servers.id", ondelete="CASCADE"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(24), default="active", nullable=False, index=True)
    client_ip_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    proxy_scheme: Mapped[str] = mapped_column(String(16), default="https", nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    disconnect_reason: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="sessions")
    server: Mapped["Server"] = relationship("Server", back_populates="sessions")


class ServerHealthLog(Base):
    __tablename__ = "server_health_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    server_id: Mapped[str] = mapped_column(ForeignKey("servers.id", ondelete="CASCADE"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(24), nullable=False)
    latency_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    checked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    server: Mapped["Server"] = relationship("Server", back_populates="health_logs")
