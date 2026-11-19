import asyncio
import logging
import socket
import ssl
import time
from datetime import datetime, timezone
from typing import Optional, Tuple

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.models import Server, ServerHealthLog

logger = logging.getLogger("globevpn.health")


async def probe_server(
    hostname: str,
    port: int,
    scheme: str,
    timeout: float,
) -> Tuple[str, Optional[int], Optional[str]]:
    """
    Performs a real TCP (and TLS for https scheme) reachability check against
    an authorized proxy node and measures real round-trip latency in ms.
    Never fabricates latency or availability.
    """
    start = time.perf_counter()
    try:
        if scheme == "https":
            ssl_ctx = ssl.create_default_context()
            reader, writer = await asyncio.wait_for(
                asyncio.open_connection(hostname, port, ssl=ssl_ctx, server_hostname=hostname),
                timeout=timeout,
            )
        else:
            reader, writer = await asyncio.wait_for(
                asyncio.open_connection(hostname, port),
                timeout=timeout,
            )
        latency_ms = max(1, int((time.perf_counter() - start) * 1000))
        writer.close()
        try:
            await writer.wait_closed()
        except Exception:
            pass
        status = "healthy" if latency_ms < 800 else "degraded"
        return status, latency_ms, None
    except asyncio.TimeoutError:
        return "offline", None, f"Connection timed out after {timeout}s"
    except (OSError, ssl.SSLError, socket.gaierror) as exc:
        return "offline", None, str(exc)[:240]


async def check_and_update_server(db: Session, server: Server) -> Server:
    settings = get_settings()
    status, latency_ms, error_msg = await probe_server(
        hostname=server.hostname,
        port=server.port,
        scheme=server.scheme,
        timeout=settings.health_check_timeout_seconds,
    )
    now = datetime.now(timezone.utc)
    server.status = status
    server.latency_ms = latency_ms
    server.is_operational = status in ("healthy", "degraded")
    server.last_health_check_at = now

    log_entry = ServerHealthLog(
        server_id=server.id,
        status=status,
        latency_ms=latency_ms,
        error_message=error_msg,
        checked_at=now,
    )
    db.add(log_entry)
    db.commit()
    db.refresh(server)

    logger.info(
        "Health probe completed",
        extra={
            "extra_data": {
                "server_id": server.id,
                "status": status,
                "latency_ms": latency_ms,
            }
        },
    )
    return server


async def check_all_servers(db: Session) -> None:
    servers = db.query(Server).all()
    for srv in servers:
        await check_and_update_server(db, srv)
