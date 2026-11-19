from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.api.servers import to_server_summary
from app.core.security import generate_ephemeral_token
from app.database.session import get_db
from app.models.models import Country, Server
from app.schemas.schemas import (
    NodeHeartbeatRequest,
    RegisterServerRequest,
    RotateCredentialsRequest,
    RotateCredentialsResponse,
    ServerSummary,
)
from app.services.health_monitor import check_and_update_server

router = APIRouter(
    prefix="/admin",
    tags=["Admin Infrastructure"],
    dependencies=[Depends(require_admin)],
)


@router.post("/servers", response_model=ServerSummary, status_code=status.HTTP_201_CREATED)
async def register_server(
    payload: RegisterServerRequest,
    db: Session = Depends(get_db),
) -> ServerSummary:
    """
    Registers or updates an authorized proxy node and immediately runs a real
    TCP/TLS health check so only genuinely reachable servers become operational.
    """
    code = payload.country_code.upper()
    country = db.query(Country).filter(Country.code == code).first()
    if not country:
        country = Country(
            code=code,
            name=payload.country_name,
            flag_emoji=payload.flag_emoji,
            region=payload.region,
            is_active=True,
        )
        db.add(country)
        db.commit()
        db.refresh(country)

    server = db.query(Server).filter(Server.id == payload.id).first()
    if not server:
        server = Server(
            id=payload.id,
            country_id=country.id,
            name=payload.name,
            city=payload.city,
            hostname=payload.hostname,
            port=payload.port,
            scheme=payload.scheme,
            public_exit_ip=payload.public_exit_ip,
            tier=payload.tier,
            max_connections=payload.max_connections,
            auth_username_direct=payload.auth_username,
            auth_password_direct=payload.auth_password,
            status="unknown",
            is_operational=False,
        )
        db.add(server)
    else:
        server.country_id = country.id
        server.name = payload.name
        server.city = payload.city
        server.hostname = payload.hostname
        server.port = payload.port
        server.scheme = payload.scheme
        server.public_exit_ip = payload.public_exit_ip
        server.tier = payload.tier
        server.max_connections = payload.max_connections
        if payload.auth_username is not None:
            server.auth_username_direct = payload.auth_username
        if payload.auth_password is not None:
            server.auth_password_direct = payload.auth_password

    db.commit()
    db.refresh(server)

    # Probe real reachability right away
    server = await check_and_update_server(db, server)
    return to_server_summary(server)


@router.post("/servers/{server_id}/rotate-credentials", response_model=RotateCredentialsResponse)
def rotate_server_credentials(
    server_id: str,
    payload: RotateCredentialsRequest,
    db: Session = Depends(get_db),
) -> RotateCredentialsResponse:
    """
    Rotates proxy credentials for an authorized exit node.
    Intended to be invoked by automated VPS node rotation jobs.
    """
    server = db.query(Server).filter(Server.id == server_id).first()
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Server '{server_id}' not found.",
        )

    new_user = payload.new_username or f"gv_{generate_ephemeral_token(8)}"
    new_pass = payload.new_password or generate_ephemeral_token(24)

    server.auth_username_direct = new_user
    server.auth_password_direct = new_pass
    server.auth_username_env = None
    server.auth_password_env = None
    db.commit()

    return RotateCredentialsResponse(
        server_id=server.id,
        username=new_user,
        password=new_pass,
        rotated_at=datetime.now(timezone.utc),
    )


@router.post("/servers/{server_id}/heartbeat", response_model=ServerSummary)
async def node_heartbeat(
    server_id: str,
    payload: NodeHeartbeatRequest,
    db: Session = Depends(get_db),
) -> ServerSummary:
    """
    Receives automated telemetry from a regional VPS node and verifies
    reachability via a live probe.
    """
    server = db.query(Server).join(Country).filter(Server.id == server_id).first()
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Server '{server_id}' not found.",
        )

    server.active_connections = payload.active_connections
    if payload.public_exit_ip:
        server.public_exit_ip = payload.public_exit_ip

    if payload.status == "maintenance":
        server.status = "maintenance"
        server.is_operational = False
        db.commit()
        db.refresh(server)
        return to_server_summary(server)

    db.commit()
    server = await check_and_update_server(db, server)
    return to_server_summary(server)
