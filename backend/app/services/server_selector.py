from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.models import Country, Server


def compute_load_percent(server: Server) -> int:
    if server.max_connections <= 0:
        return 100
    pct = int((server.active_connections / server.max_connections) * 100)
    return max(0, min(100, pct))


def select_best_server(
    db: Session,
    plan_tier: str,
    server_id: Optional[str] = None,
    country_code: Optional[str] = None,
) -> Optional[Server]:
    """
    Selects an operational, healthy (or degraded) server with available capacity.
    Respects tier entitlements (free users can access free-tier servers; pro users access all).
    """
    query = db.query(Server).join(Country).filter(
        Server.is_operational.is_(True),
        Server.status.in_(["healthy", "degraded"]),
        Country.is_active.is_(True),
    )

    if plan_tier == "free":
        query = query.filter(Server.tier == "free")

    if server_id:
        candidate = query.filter(Server.id == server_id).first()
        if candidate and candidate.active_connections < candidate.max_connections:
            return candidate
        return None

    if country_code:
        query = query.filter(Country.code == country_code.upper())

    candidates: List[Server] = [
        s for s in query.all() if s.active_connections < s.max_connections
    ]
    if not candidates:
        return None

    # Prefer healthy over degraded, then lowest latency, then lowest load
    candidates.sort(
        key=lambda s: (
            0 if s.status == "healthy" else 1,
            s.latency_ms if s.latency_ms is not None else 99999,
            compute_load_percent(s),
        )
    )
    return candidates[0]
