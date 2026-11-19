from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.models import Country, Server
from app.schemas.schemas import CountrySummary, ServerHealthSummary, ServerSummary
from app.services.health_monitor import check_all_servers
from app.services.server_selector import compute_load_percent

router = APIRouter(prefix="/servers", tags=["Servers"])


def to_server_summary(server: Server) -> ServerSummary:
    return ServerSummary(
        id=server.id,
        name=server.name,
        country_code=server.country.code,
        country_name=server.country.name,
        flag_emoji=server.country.flag_emoji,
        city=server.city,
        hostname=server.hostname,
        port=server.port,
        scheme=server.scheme,
        protocol_type=server.protocol_type,
        public_exit_ip=server.public_exit_ip,
        tier=server.tier,
        status=server.status,
        is_operational=server.is_operational,
        latency_ms=server.latency_ms,
        load_percent=compute_load_percent(server),
        last_health_check_at=server.last_health_check_at,
    )


@router.get("", response_model=List[ServerSummary])
def list_servers(
    country_code: Optional[str] = Query(default=None),
    operational_only: bool = Query(default=True),
    db: Session = Depends(get_db),
) -> List[ServerSummary]:
    """
    Lists registered proxy servers. By default returns only servers verified as
    operational by real health checks — never fabricated servers.
    """
    query = db.query(Server).join(Country).filter(Country.is_active.is_(True))
    if operational_only:
        query = query.filter(Server.is_operational.is_(True))
    if country_code:
        query = query.filter(Country.code == country_code.upper())

    servers = query.all()
    servers.sort(
        key=lambda s: (
            0 if s.status == "healthy" else 1,
            s.latency_ms if s.latency_ms is not None else 99999,
        )
    )
    return [to_server_summary(s) for s in servers]


@router.get("/countries", response_model=List[CountrySummary])
def list_countries(
    operational_only: bool = Query(
        default=False,
        description="If true, omit unprovisioned/offline countries. Defaults to false so UI can show Coming soon / Unavailable honestly.",
    ),
    db: Session = Depends(get_db),
) -> List[CountrySummary]:
    """
    Dynamic country registry:
    - Countries with >=1 live healthy/degraded server return availability_status='available'
      with real server_id, endpoint, protocol, and measured latency.
    - Countries with registered servers that are all offline/full return 'unavailable'.
    - Planned countries with no provisioned nodes return 'coming_soon' and null server fields.
    """
    countries = db.query(Country).filter(Country.is_active.is_(True)).order_by(Country.name).all()
    results: List[CountrySummary] = []

    for country in countries:
        all_servers = list(country.servers)
        op_servers = [
            s
            for s in all_servers
            if s.is_operational
            and s.status in ("healthy", "degraded")
            and s.active_connections < s.max_connections
        ]
        if operational_only and not op_servers:
            continue

        op_servers.sort(
            key=lambda s: (
                0 if s.status == "healthy" else 1,
                s.latency_ms if s.latency_ms is not None else 99999,
                compute_load_percent(s),
            )
        )
        best = op_servers[0] if op_servers else None

        if best is not None:
            availability = "available"
            health = "healthy" if best.status == "healthy" else "degraded"
            endpoint = f"{best.hostname}:{best.port}"
            protocol = f"{best.scheme}_proxy"
            server_id = best.id
            exit_ip = best.public_exit_ip
            latency = best.latency_ms
        elif len(all_servers) > 0:
            availability = "unavailable"
            health = "offline"
            endpoint = None
            protocol = None
            server_id = None
            exit_ip = None
            latency = None
        else:
            availability = "coming_soon"
            health = "unprovisioned"
            endpoint = None
            protocol = None
            server_id = None
            exit_ip = None
            latency = None

        results.append(
            CountrySummary(
                code=country.code,
                name=country.name,
                flag_emoji=country.flag_emoji,
                region=country.region,
                availability_status=availability,
                health_status=health,
                operational_server_count=len(op_servers),
                actual_server_id=server_id,
                server_endpoint=endpoint,
                supported_protocol=protocol,
                public_exit_ip=exit_ip,
                best_latency_ms=latency,
                recommended_server_id=server_id,
            )
        )

    order_rank = {"available": 0, "unavailable": 1, "coming_soon": 2}
    results.sort(
        key=lambda c: (
            order_rank[c.availability_status],
            c.best_latency_ms if c.best_latency_ms is not None else 99999,
            c.name,
        )
    )
    return results


@router.get("/health", response_model=ServerHealthSummary)
async def get_servers_health(
    refresh: bool = Query(default=False, description="Trigger live TCP/TLS health probes before returning"),
    db: Session = Depends(get_db),
) -> ServerHealthSummary:
    if refresh:
        await check_all_servers(db)

    servers = db.query(Server).join(Country).all()
    healthy = sum(1 for s in servers if s.is_operational and s.status == "healthy")
    degraded = sum(1 for s in servers if s.is_operational and s.status == "degraded")
    offline = sum(1 for s in servers if not s.is_operational or s.status == "offline")

    return ServerHealthSummary(
        total_registered=len(servers),
        operational_healthy=healthy,
        degraded=degraded,
        offline=offline,
        checked_at=datetime.now(timezone.utc),
        servers=[to_server_summary(s) for s in servers],
    )


@router.get("/{server_id}", response_model=ServerSummary)
def get_server(server_id: str, db: Session = Depends(get_db)) -> ServerSummary:
    server = db.query(Server).join(Country).filter(Server.id == server_id).first()
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Server '{server_id}' not found.",
        )
    return to_server_summary(server)
