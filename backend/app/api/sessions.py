from datetime import datetime, timedelta, timezone
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_client_ip, get_current_user
from app.api.servers import to_server_summary
from app.core.config import get_settings
from app.core.security import hash_identifier
from app.database.session import get_db
from app.models.models import ConnectionSession, Server, User
from app.schemas.schemas import (
    ConnectSessionRequest,
    ConnectSessionResponse,
    DisconnectSessionRequest,
    DisconnectSessionResponse,
    ProxyConfigPayload,
)
from app.services.proxy_credentials import (
    describe_transport_encryption,
    resolve_proxy_credentials,
)
from app.services.server_selector import select_best_server

router = APIRouter(tags=["Connection Sessions"])

# Safe default bypass list: local loopback only so control-plane localhost dev works
# without leaking external domains.
DEFAULT_BYPASS_LIST = [
    "127.0.0.1",
    "localhost",
    "::1",
    "<local>",
]


@router.post("/connect/session", response_model=ConnectSessionResponse)
def connect_session(
    payload: ConnectSessionRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ConnectSessionResponse:
    settings = get_settings()

    # Fair-use daily session limit for free tier
    if (
        current_user.plan_tier == "free"
        and current_user.daily_sessions_used >= settings.free_tier_max_daily_sessions
    ):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                f"Free-tier daily limit reached ({settings.free_tier_max_daily_sessions} sessions/day). "
                "Try again after the 24-hour reset."
            ),
        )

    server = select_best_server(
        db=db,
        plan_tier=current_user.plan_tier,
        server_id=payload.server_id,
        country_code=payload.country_code,
    )
    if not server:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "No operational proxy servers are currently available for your selection. "
                "Ensure at least one authorized proxy node is running and healthy."
            ),
        )

    # Close any prior active session for this user cleanly
    now = datetime.now(timezone.utc)
    prior_sessions = (
        db.query(ConnectionSession)
        .filter(
            ConnectionSession.user_id == current_user.id,
            ConnectionSession.status == "active",
        )
        .all()
    )
    for old in prior_sessions:
        old.status = "disconnected"
        old.ended_at = now
        old.disconnect_reason = "superseded_by_new_session"
        old_server = db.query(Server).filter(Server.id == old.server_id).first()
        if old_server and old_server.active_connections > 0:
            old_server.active_connections -= 1

    max_minutes = (
        settings.pro_tier_max_session_minutes
        if current_user.plan_tier == "pro"
        else settings.free_tier_max_session_minutes
    )
    expires_at = now + timedelta(minutes=max_minutes)

    username, password = resolve_proxy_credentials(server)

    session = ConnectionSession(
        id=f"ses_{uuid.uuid4().hex[:16]}",
        user_id=current_user.id,
        server_id=server.id,
        status="active",
        client_ip_hash=hash_identifier(get_client_ip(request)),
        proxy_scheme=server.scheme,
        started_at=now,
        expires_at=expires_at,
    )
    server.active_connections += 1
    current_user.daily_sessions_used += 1

    db.add(session)
    db.commit()
    db.refresh(session)
    db.refresh(server)

    return ConnectSessionResponse(
        session_id=session.id,
        server=to_server_summary(server),
        proxy=ProxyConfigPayload(
            scheme=server.scheme,
            host=server.hostname,
            port=server.port,
            username=username,
            password=password,
            bypass_list=DEFAULT_BYPASS_LIST,
            encryption_note=describe_transport_encryption(server.scheme),
        ),
        expected_exit_ip=server.public_exit_ip,
        expires_at=expires_at,
        max_session_minutes=max_minutes,
        protection_scope="browser_proxy_only",
    )


@router.post("/disconnect/session", response_model=DisconnectSessionResponse)
def disconnect_session(
    payload: DisconnectSessionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DisconnectSessionResponse:
    session = (
        db.query(ConnectionSession)
        .filter(
            ConnectionSession.id == payload.session_id,
            ConnectionSession.user_id == current_user.id,
        )
        .first()
    )
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found for this user.",
        )

    now = datetime.now(timezone.utc)
    if session.status == "active":
        session.status = "disconnected"
        session.ended_at = now
        session.disconnect_reason = payload.reason or "user_requested"
        server = db.query(Server).filter(Server.id == session.server_id).first()
        if server and server.active_connections > 0:
            server.active_connections -= 1
        db.commit()
        db.refresh(session)

    return DisconnectSessionResponse(
        session_id=session.id,
        status=session.status,
        ended_at=session.ended_at or now,
    )
